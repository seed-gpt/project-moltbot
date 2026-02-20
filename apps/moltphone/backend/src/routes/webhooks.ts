import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getDb, authMiddleware, AppError } from '@moltbot/shared';
import { eq, and, desc } from 'drizzle-orm';
import { calls, transcripts, callWebhooks } from '../db/schema.js';

const router = express.Router();

const subscribeWebhookSchema = z.object({
  url: z.string().url().max(500),
  events: z.array(z.string()).optional().default([]),
});

// POST /webhooks/vapi - Public Vapi callback
router.post('/webhooks/vapi', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const event = req.body;
    const eventType = event.type;
    if (!eventType) { res.status(400).json({ error: 'Missing event type' }); return; }

    const db = getDb();

    switch (eventType) {
      case 'call.started':
        if (event.call_id && event.vapi_call_id) {
          await db.update(calls).set({ status: 'in_progress', vapiCallId: event.vapi_call_id }).where(eq(calls.id, event.call_id));
        }
        break;
      case 'call.ended':
        if (event.call_id) {
          await db.update(calls).set({
            status: 'completed', durationSeconds: event.duration_seconds || 0,
            costCents: event.cost_cents || 0, endedAt: new Date(),
          }).where(eq(calls.id, event.call_id));
        }
        break;
      case 'transcript.update':
        if (event.call_id && event.transcript) {
          await db.insert(transcripts).values({
            callId: event.call_id, role: event.transcript.role,
            content: event.transcript.content, timestampMs: event.transcript.timestamp_ms || 0,
          });
        }
        break;
    }

    res.status(200).json({ received: true });
  } catch (err) { next(err); }
});

// POST /webhooks/subscribe
router.post('/webhooks/subscribe', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const body = subscribeWebhookSchema.parse(req.body);
    const db = getDb();

    const [wh] = await db.insert(callWebhooks).values({ agentId: agent.id, url: body.url, events: body.events }).returning();
    res.status(201).json({ webhook: wh });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
    next(err);
  }
});

// GET /webhooks
router.get('/webhooks', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const db = getDb();
    const result = await db.select().from(callWebhooks).where(eq(callWebhooks.agentId, agent.id)).orderBy(desc(callWebhooks.createdAt));
    res.json({ webhooks: result });
  } catch (err) { next(err); }
});

// DELETE /webhooks/:id
router.delete('/webhooks/:id', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const db = getDb();
    const result = await db.delete(callWebhooks)
      .where(and(eq(callWebhooks.id, req.params.id), eq(callWebhooks.agentId, agent.id))).returning({ id: callWebhooks.id });
    if (result.length === 0) throw new AppError(404, 'Webhook not found', 'WEBHOOK_NOT_FOUND');
    res.json({ message: 'Webhook deleted', id: result[0].id });
  } catch (err) { next(err); }
});

export default router;
