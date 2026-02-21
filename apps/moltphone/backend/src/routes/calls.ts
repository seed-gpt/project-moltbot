import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getFirestore, authMiddleware, AppError } from '@moltbot/shared';

const router = express.Router();

const callSchema = z.object({
  to_number: z.string().regex(/^\+[1-9]\d{1,14}$/, 'Must be E.164 format'),
  assistant_config: z.object({
    first_message: z.string().min(1),
    system_prompt: z.string().min(1),
    voice: z.string().optional(),
    model: z.string().optional(),
  }),
});

const webappCallSchema = z.object({
  phoneNumber: z.string().regex(/^\+[1-9]\d{1,14}$/, 'Must be E.164 format'),
  task: z.string().min(1),
  agentName: z.string().optional(),
});

// POST /call/webapp (Unauthenticated endpoint for the landing page)
router.post('/call/webapp', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const body = webappCallSchema.parse(req.body);
    const db = getFirestore();

    const vapiKey = process.env.VAPI_API_KEY;
    const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;

    if (!vapiKey || !phoneNumberId) {
      res.status(503).json({ error: 'Voice calling service is not configured' });
      return;
    }

    const firstMessage = `Hello, this is ${body.agentName || 'an AI assistant'}. I'm calling on behalf of a user from MoltPhone.`;
    const systemPrompt = `You are an AI assistant making an outbound call. Your objective is: ${body.task}\n\nBe concise, polite, and helpful. Stay focused on the task.`;

    // Call the Vapi API to actually place the outbound call
    const vapiResponse = await fetch('https://api.vapi.ai/call', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${vapiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phoneNumberId,
        customer: { number: body.phoneNumber },
        assistant: {
          firstMessage,
          model: {
            provider: 'openai',
            model: 'gpt-4o-mini',
            systemMessage: systemPrompt,
          },
          voice: {
            provider: '11labs',
            voiceId: 'jennifer',
          },
        },
      }),
    });

    const vapiData = await vapiResponse.json();

    if (!vapiResponse.ok) {
      console.error('Vapi API error:', vapiData);
      res.status(vapiResponse.status).json({ error: vapiData.message || 'Failed to initiate call via Vapi' });
      return;
    }

    // Store the call record in Firestore
    const callRef = await db.collection('calls').add({
      agentId: 'webapp',
      direction: 'outbound',
      toNumber: body.phoneNumber,
      status: 'queued',
      vapiCallId: vapiData.id,
      assistantConfig: { first_message: firstMessage, system_prompt: systemPrompt },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    res.status(201).json({
      callId: callRef.id,
      vapiCallId: vapiData.id,
      status: vapiData.status || 'queued',
      to_number: body.phoneNumber,
      direction: 'outbound',
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    next(err);
  }
});

// POST /call
router.post('/call', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const body = callSchema.parse(req.body);
    const db = getFirestore();

    const callRef = await db.collection('calls').add({
      agentId: agent.id, direction: 'outbound', toNumber: body.to_number,
      status: 'queued', assistantConfig: body.assistant_config,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });

    res.status(201).json({
      call: { id: callRef.id, status: 'queued', to_number: body.to_number, direction: 'outbound' },
    });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
    next(err);
  }
});

// GET /calls
router.get('/calls', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const db = getFirestore();

    const snapshot = await db.collection('calls')
      .where('agentId', '==', agent.id)
      .orderBy('createdAt', 'desc').limit(limit).get();

    const calls = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ calls });
  } catch (err) { next(err); }
});

// POST /call/end/:id
router.post('/call/end/:id', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const { id } = req.params;
    const db = getFirestore();

    const callDoc = await db.collection('calls').doc(id).get();
    if (!callDoc.exists) throw new AppError(404, 'Call not found');
    if (callDoc.data()?.agentId !== agent.id) throw new AppError(403, 'Access denied');

    await db.collection('calls').doc(id).update({
      status: 'ended', endedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });

    res.json({ success: true, call_id: id, status: 'ended' });
  } catch (err) { next(err); }
});

// GET /calls/stats
router.get('/calls/stats', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const db = getFirestore();

    const all = await db.collection('calls').where('agentId', '==', agent.id).get();
    let total = 0, completed = 0, failed = 0;
    all.docs.forEach(doc => {
      total++;
      const s = doc.data().status;
      if (s === 'ended' || s === 'completed') completed++;
      else if (s === 'failed' || s === 'error') failed++;
    });

    res.json({ total_calls: total, completed_calls: completed, failed_calls: failed, in_progress: total - completed - failed });
  } catch (err) { next(err); }
});

export default router;
