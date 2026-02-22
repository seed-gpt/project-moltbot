import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getFirestore, authMiddleware, AppError } from '@moltbot/shared';
import { getLogger } from '../middleware/logger.js';

const router = express.Router();


// POST /webhooks/vapi - Receive Vapi callbacks (public)
router.post('/webhooks/vapi', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const log = getLogger('webhooks');
  try {
    const db = getFirestore();
    const payload = req.body;
    const callId = payload.call?.id || payload.phone_call_id;
    if (!callId) { res.json({ received: true }); return; }

    log.info('Vapi webhook received', { callId, type: payload.type });

    const callDoc = await db.collection('calls').doc(callId).get();
    if (!callDoc.exists) {
      log.warn('Vapi callback for unknown call', { callId });
      res.json({ received: true });
      return;
    }

    const callData = callDoc.data()!;
    if (payload.type === 'transcript') {
      await db.collection('calls').doc(callId).collection('transcripts').add({
        role: payload.role || 'unknown', content: payload.transcript || '', timestamp: new Date().toISOString(),
      });
      log.info('Transcript entry saved', { callId, role: payload.role });
    }

    if (payload.type === 'end-of-call-report' || payload.type === 'status-update') {
      await db.collection('calls').doc(callId).update({
        status: payload.status || callData.status, updatedAt: new Date().toISOString(),
      });
      log.info('Call status updated via Vapi', { callId, status: payload.status });
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

// POST /webhooks/twilio-status - Twilio call status callback
router.post('/webhooks/twilio-status', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const db = getFirestore();
    const { CallSid, CallStatus, CallDuration, Timestamp } = req.body;

    if (!CallSid) { res.sendStatus(200); return; }

    const log = getLogger('webhooks');
    log.info('Twilio status callback received', { CallSid, CallStatus, CallDuration });

    // Find call by Twilio SID
    const snapshot = await db.collection('calls')
      .where('twilioCallSid', '==', CallSid)
      .limit(1).get();

    if (snapshot.empty) {
      log.warn('No call found for Twilio SID', { CallSid });
      res.sendStatus(200);
      return;
    }

    const callDoc = snapshot.docs[0];
    const callData = callDoc.data();

    // Map Twilio status to our status + callResult
    const statusMap: Record<string, string> = {
      'queued': 'queued',
      'initiated': 'initiated',
      'ringing': 'ringing',
      'in-progress': 'in-progress',
      'completed': 'completed',
      'busy': 'failed',
      'no-answer': 'failed',
      'failed': 'failed',
      'canceled': 'failed',
    };

    const callResultMap: Record<string, string> = {
      'completed': 'success',
      'busy': 'failure',
      'no-answer': 'failure',
      'failed': 'failure',
      'canceled': 'failure',
    };

    const update: any = {
      status: statusMap[CallStatus] || CallStatus,
      updatedAt: new Date().toISOString(),
    };

    if (callResultMap[CallStatus]) {
      update.callResult = callResultMap[CallStatus];
    }
    if (CallDuration) {
      update.duration = parseInt(CallDuration, 10);
    }
    if (CallStatus === 'completed' || callResultMap[CallStatus] === 'failure') {
      update.endedAt = Timestamp || new Date().toISOString();
    }

    await db.collection('calls').doc(callDoc.id).update(update);

    // Fan out to agent webhooks
    const hooks = await db.collection('callWebhooks')
      .where('agentId', '==', callData.agentId).where('active', '==', true).get();
    for (const hook of hooks.docs) {
      const hookData = hook.data();
      if (hookData.events?.includes('status-update') || hookData.events?.length === 0) {
        fetch(hookData.url, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'status-update',
            call_id: callDoc.id,
            data: { callStatus: CallStatus, callResult: callResultMap[CallStatus], duration: CallDuration },
          }),
        }).catch(() => { });
      }
    }

    res.sendStatus(200);
  } catch (err) { next(err); }
});

// POST /webhooks/twilio-connect-action - ConversationRelay session ended
router.post('/webhooks/twilio-connect-action', async (req: Request, res: Response): Promise<void> => {
  const log = getLogger('webhooks');
  log.info('Twilio Connect Action — session ended', { body: req.body });
  // Return empty TwiML to end the call gracefully
  res.type('text/xml');
  res.send('<Response><Hangup/></Response>');
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
