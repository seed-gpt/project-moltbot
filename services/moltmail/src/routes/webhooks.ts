import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query, authMiddleware, AppError } from '@moltbot/shared';
import { randomUUID } from 'node:crypto';

const router = express.Router();

const subscribeWebhookSchema = z.object({
  url: z.string().url().max(500),
  events: z.array(z.enum(['email.received', 'email.sent', 'email.delivered', 'email.failed'])),
});

const inboundEmailSchema = z.object({
  from: z.string().email(),
  to: z.string().email(),
  subject: z.string().optional(),
  body_text: z.string().optional(),
  body_html: z.string().optional(),
  message_id: z.string().optional(),
});

// POST /webhooks/inbound - Receive inbound emails (public endpoint)
router.post('/webhooks/inbound', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const body = inboundEmailSchema.parse(req.body);

    // Find agent by recipient email address
    const addressResult = await query(
      'SELECT agent_id FROM email_addresses WHERE address = $1 AND verified = true',
      [body.to]
    );

    if (addressResult.rows.length === 0) {
      throw new AppError(404, 'Recipient address not found', 'RECIPIENT_NOT_FOUND');
    }

    const agentId = addressResult.rows[0].agent_id;
    const messageId = body.message_id || `<${randomUUID()}@agentmail.xyz>`;

    // Store the inbound email
    const emailResult = await query(
      `INSERT INTO emails (from_address, to_address, subject, body_text, body_html, status, direction, message_id, agent_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, from_address, to_address, subject, created_at`,
      [body.from, body.to, body.subject || '(no subject)', body.body_text || '', body.body_html || null, 'received', 'inbound', messageId, agentId]
    );

    const email = emailResult.rows[0];

    // Get agent's webhook subscriptions
    const webhooksResult = await query(
      `SELECT url, events FROM email_webhooks
       WHERE agent_id = $1 AND active = true`,
      [agentId]
    );

    // Forward to webhooks (fire-and-forget, don't await)
    for (const webhook of webhooksResult.rows) {
      const events = webhook.events || [];
      if (events.length === 0 || events.includes('email.received')) {
        // In production, use a queue or job system
        fetch(webhook.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'email.received',
            email: {
              id: email.id,
              from: email.from_address,
              to: email.to_address,
              subject: email.subject,
              body_text: body.body_text,
              body_html: body.body_html,
              received_at: email.created_at,
            },
          }),
        }).catch(() => {
          // Silently fail webhook delivery
        });
      }
    }

    res.status(201).json({
      message: 'Email received',
      email_id: email.id,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    next(err);
  }
});

// POST /webhooks/subscribe - Subscribe to webhook events
router.post('/webhooks/subscribe', authMiddleware(query), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const body = subscribeWebhookSchema.parse(req.body);

    const result = await query(
      `INSERT INTO email_webhooks (agent_id, url, events, active)
       VALUES ($1, $2, $3, $4)
       RETURNING id, url, events, active, created_at`,
      [agent.id, body.url, body.events, true]
    );

    res.status(201).json({
      webhook: result.rows[0],
      message: 'Webhook subscription created',
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    next(err);
  }
});

// GET /webhooks - List webhook subscriptions
router.get('/webhooks', authMiddleware(query), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;

    const result = await query(
      'SELECT id, url, events, active, created_at FROM email_webhooks WHERE agent_id = $1 ORDER BY created_at DESC',
      [agent.id]
    );

    res.json({ webhooks: result.rows });
  } catch (err) {
    next(err);
  }
});

// DELETE /webhooks/:id - Remove webhook subscription
router.delete('/webhooks/:id', authMiddleware(query), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const { id } = req.params;

    const result = await query(
      'DELETE FROM email_webhooks WHERE id = $1 AND agent_id = $2 RETURNING id',
      [id, agent.id]
    );

    if (result.rows.length === 0) {
      throw new AppError(404, 'Webhook not found or access denied', 'WEBHOOK_NOT_FOUND');
    }

    res.json({
      message: 'Webhook subscription removed',
      webhook_id: id,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
