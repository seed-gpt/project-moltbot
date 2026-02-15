import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query, authMiddleware, AppError } from '@moltbot/shared';

const router = express.Router();

// Validation schemas
const subscribeWebhookSchema = z.object({
  url: z.string().url().max(500),
  events: z.array(z.string()).optional().default([]),
});

// POST /webhooks/vapi - Public endpoint for Vapi callbacks
router.post('/webhooks/vapi', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const event = req.body;
    const eventType = event.type;

    if (!eventType) {
      res.status(400).json({ error: 'Missing event type' });
      return;
    }

    // Handle different event types
    switch (eventType) {
      case 'call.started':
        if (event.call_id && event.vapi_call_id) {
          await query(
            `UPDATE calls SET status = $1, vapi_call_id = $2 WHERE id = $3`,
            ['in_progress', event.vapi_call_id, event.call_id]
          );
        }
        break;

      case 'call.ended':
        if (event.call_id) {
          const duration = event.duration_seconds || 0;
          const cost = event.cost_cents || 0;
          await query(
            `UPDATE calls SET status = $1, duration_seconds = $2, cost_cents = $3, ended_at = NOW() WHERE id = $4`,
            ['completed', duration, cost, event.call_id]
          );
        }
        break;

      case 'transcript.update':
        if (event.call_id && event.transcript) {
          const transcript = event.transcript;
          await query(
            `INSERT INTO transcripts (call_id, role, content, timestamp_ms)
             VALUES ($1, $2, $3, $4)`,
            [event.call_id, transcript.role, transcript.content, transcript.timestamp_ms || 0]
          );
        }
        break;

      default:
        // Unknown event type, just acknowledge
        break;
    }

    res.status(200).json({ received: true });
  } catch (err) {
    next(err);
  }
});

// POST /webhooks/subscribe - Register agent webhook
router.post('/webhooks/subscribe', authMiddleware(query), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const body = subscribeWebhookSchema.parse(req.body);

    const result = await query(
      `INSERT INTO call_webhooks (agent_id, url, events)
       VALUES ($1, $2, $3)
       RETURNING id, agent_id, url, events, active, created_at`,
      [agent.id, body.url, body.events]
    );

    res.status(201).json({
      webhook: result.rows[0],
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    next(err);
  }
});

// GET /webhooks - List subscriptions
router.get('/webhooks', authMiddleware(query), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;

    const result = await query(
      `SELECT id, url, events, active, created_at
       FROM call_webhooks
       WHERE agent_id = $1
       ORDER BY created_at DESC`,
      [agent.id]
    );

    res.json({
      webhooks: result.rows,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /webhooks/:id - Remove subscription
router.delete('/webhooks/:id', authMiddleware(query), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const webhookId = req.params.id;

    const result = await query(
      `DELETE FROM call_webhooks WHERE id = $1 AND agent_id = $2 RETURNING id`,
      [webhookId, agent.id]
    );

    if (result.rows.length === 0) {
      throw new AppError(404, 'Webhook not found', 'WEBHOOK_NOT_FOUND');
    }

    res.json({
      message: 'Webhook deleted',
      id: result.rows[0].id,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
