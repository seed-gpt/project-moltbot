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

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      res.status(503).json({ error: 'Voice calling service is not configured' });
      return;
    }

    const agentName = body.agentName || 'an AI assistant';
    const greeting = `Hello, this is ${agentName} calling from MoltPhone. ${body.task}`;

    // Build TwiML for the call
    const twiml = `<Response><Say voice="alice">${greeting.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Say><Pause length="2"/><Say voice="alice">Thank you for your time. Goodbye.</Say></Response>`;

    // Call Twilio REST API to place the outbound call
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`;
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const params = new URLSearchParams();
    params.append('To', body.phoneNumber);
    params.append('From', fromNumber);
    params.append('Twiml', twiml);

    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const twilioData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error('Twilio API error:', twilioData);
      res.status(twilioResponse.status).json({
        error: twilioData.message || 'Failed to initiate call via Twilio',
        code: twilioData.code,
      });
      return;
    }

    // Store the call record in Firestore
    const callRef = await db.collection('calls').add({
      agentId: 'webapp',
      direction: 'outbound',
      toNumber: body.phoneNumber,
      status: 'queued',
      twilioCallSid: twilioData.sid,
      task: body.task,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    res.status(201).json({
      callId: callRef.id,
      twilioCallSid: twilioData.sid,
      status: twilioData.status || 'queued',
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

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      res.status(503).json({ error: 'Voice calling service is not configured' });
      return;
    }

    // Deduct 1 token via transaction
    const balRef = db.collection('tokenBalances').doc(agent.id);
    const newBalance = await db.runTransaction(async (tx) => {
      const balDoc = await tx.get(balRef);
      const current = balDoc.exists ? (balDoc.data()?.balance || 0) : 0;
      if (current < 1) return -1;
      const updated = current - 1;
      tx.set(balRef, { agentId: agent.id, balance: updated, updatedAt: new Date().toISOString() }, { merge: true });
      return updated;
    });

    if (newBalance < 0) {
      res.status(402).json({ error: 'Insufficient token balance', balance: 0 });
      return;
    }

    // Build TwiML from assistant_config
    const greeting = `${body.assistant_config.first_message}`;
    const twiml = `<Response><Say voice="${body.assistant_config.voice || 'alice'}">${greeting.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Say><Pause length="2"/><Say voice="${body.assistant_config.voice || 'alice'}">Thank you for your time. Goodbye.</Say></Response>`;

    // Call Twilio REST API
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`;
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const params = new URLSearchParams();
    params.append('To', body.to_number);
    params.append('From', fromNumber);
    params.append('Twiml', twiml);

    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const twilioData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      // Refund the token on Twilio failure
      await db.runTransaction(async (tx) => {
        const balDoc = await tx.get(balRef);
        const current = balDoc.exists ? (balDoc.data()?.balance || 0) : 0;
        tx.set(balRef, { agentId: agent.id, balance: current + 1, updatedAt: new Date().toISOString() }, { merge: true });
      });
      console.error('Twilio API error:', twilioData);
      res.status(twilioResponse.status).json({
        error: twilioData.message || 'Failed to initiate call via Twilio',
        code: twilioData.code,
      });
      return;
    }

    // Store call record with Twilio SID
    const callRef = await db.collection('calls').add({
      agentId: agent.id, direction: 'outbound', toNumber: body.to_number,
      status: 'queued', twilioCallSid: twilioData.sid,
      assistantConfig: body.assistant_config,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });

    res.status(201).json({
      call: { id: callRef.id, status: twilioData.status || 'queued', to_number: body.to_number, direction: 'outbound', twilioCallSid: twilioData.sid },
      remaining_balance: newBalance,
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

// GET /calls/:id
router.get('/calls/:id', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const { id } = req.params;
    const db = getFirestore();

    const callDoc = await db.collection('calls').doc(id).get();
    if (!callDoc.exists) throw new AppError(404, 'Call not found');
    if (callDoc.data()?.agentId !== agent.id) throw new AppError(403, 'Access denied');

    res.json({ call: { id: callDoc.id, ...callDoc.data() } });
  } catch (err) { next(err); }
});

export default router;
