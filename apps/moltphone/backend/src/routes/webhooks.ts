import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getFirestore, authMiddleware, AppError } from '@moltbot/shared';

const router = express.Router();

// POST /webhooks/vapi - Receive Vapi callbacks (public)
router.post('/webhooks/vapi', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const db = getFirestore();
    const payload = req.body;
    const callId = payload.call?.id || payload.phone_call_id;
    if (!callId) { res.json({ received: true }); return; }

    const callDoc = await db.collection('calls').doc(callId).get();
    if (!callDoc.exists) { res.json({ received: true }); return; }

    const callData = callDoc.data()!;
    if (payload.type === 'transcript') {
      await db.collection('calls').doc(callId).collection('transcripts').add({
        role: payload.role || 'unknown', content: payload.transcript || '', timestamp: new Date().toISOString(),
      });
    }

    if (payload.type === 'end-of-call-report' || payload.type === 'status-update') {
      await db.collection('calls').doc(callId).update({
        status: payload.status || callData.status, updatedAt: new Date().toISOString(),
      });
    }

    // Fan out to registered webhooks
    const hooks = await db.collection('callWebhooks')
      .where('agentId', '==', callData.agentId).where('active', '==', true).get();
    for (const hook of hooks.docs) {
      const hookData = hook.data();
      if (hookData.events?.includes(payload.type) || hookData.events?.length === 0) {
        fetch(hookData.url, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: payload.type, call_id: callId, data: payload }),
        }).catch(() => { });
      }
    }

    res.json({ received: true });
  } catch (err) { next(err); }
});

const subscribeSchema = z.object({
  url: z.string().url(), events: z.array(z.string()).optional(),
});

// POST /webhooks/subscribe
router.post('/webhooks/subscribe', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const body = subscribeSchema.parse(req.body);
    const db = getFirestore();

    const ref = await db.collection('callWebhooks').add({
      agentId: agent.id, url: body.url, events: body.events || [],
      active: true, createdAt: new Date().toISOString(),
    });

    res.status(201).json({ webhook: { id: ref.id, url: body.url, events: body.events || [], active: true } });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
    next(err);
  }
});

// GET /webhooks
router.get('/webhooks', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const db = getFirestore();
    const snapshot = await db.collection('callWebhooks').where('agentId', '==', agent.id).get();
    const webhooks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ webhooks });
  } catch (err) { next(err); }
});

// DELETE /webhooks/:id
router.delete('/webhooks/:id', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const { id } = req.params;
    const db = getFirestore();

    const doc = await db.collection('callWebhooks').doc(id).get();
    if (!doc.exists) throw new AppError(404, 'Webhook not found');
    if (doc.data()?.agentId !== agent.id) throw new AppError(403, 'Access denied');

    await db.collection('callWebhooks').doc(id).delete();
    res.json({ message: 'Webhook deleted successfully', webhook_id: id });
  } catch (err) { next(err); }
});

export default router;
