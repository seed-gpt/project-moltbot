import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getDb, authMiddleware, AppError } from '@moltbot/shared';
import { eq, and, desc } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { emailAddresses, emails, emailWebhooks } from '../db/schema.js';

const router = express.Router();

const subscribeWebhookSchema = z.object({
  url: z.string().url().max(500),
  events: z.array(z.enum(['email.received', 'email.sent', 'email.delivered', 'email.failed'])),
});

const inboundEmailSchema = z.object({
  from: z.string().email(), to: z.string().email(), subject: z.string().optional(),
  body_text: z.string().optional(), body_html: z.string().optional(), message_id: z.string().optional(),
});

// POST /webhooks/inbound
router.post('/webhooks/inbound', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const body = inboundEmailSchema.parse(req.body);
    const db = getDb();

    const addr = await db.select({ agentId: emailAddresses.agentId }).from(emailAddresses)
      .where(and(eq(emailAddresses.address, body.to), eq(emailAddresses.verified, true)));
    if (addr.length === 0) throw new AppError(404, 'Recipient address not found', 'RECIPIENT_NOT_FOUND');

    const agentId = addr[0].agentId;
    const messageId = body.message_id || `<${randomUUID()}@agentmail.xyz>`;

    const [email] = await db.insert(emails).values({
      fromAddress: body.from, toAddress: body.to, subject: body.subject || '(no subject)',
      bodyText: body.body_text || '', bodyHtml: body.body_html || null, status: 'received',
      direction: 'inbound', messageId, agentId,
    }).returning();

    const hooks = await db.select({ url: emailWebhooks.url, events: emailWebhooks.events }).from(emailWebhooks)
      .where(and(eq(emailWebhooks.agentId, agentId), eq(emailWebhooks.active, true)));

    for (const wh of hooks) {
      const events = wh.events || [];
      if (events.length === 0 || events.includes('email.received')) {
        fetch(wh.url, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'email.received', email: { id: email.id, from: email.fromAddress, to: email.toAddress, subject: email.subject, body_text: body.body_text, body_html: body.body_html, received_at: email.createdAt } }),
        }).catch(() => { });
      }
    }

    res.status(201).json({ message: 'Email received', email_id: email.id });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
    next(err);
  }
});

// POST /webhooks/subscribe
router.post('/webhooks/subscribe', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const body = subscribeWebhookSchema.parse(req.body);
    const db = getDb();

    const [wh] = await db.insert(emailWebhooks).values({ agentId: agent.id, url: body.url, events: body.events, active: true }).returning();
    res.status(201).json({ webhook: wh, message: 'Webhook subscription created' });
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
    const result = await db.select().from(emailWebhooks).where(eq(emailWebhooks.agentId, agent.id)).orderBy(desc(emailWebhooks.createdAt));
    res.json({ webhooks: result });
  } catch (err) { next(err); }
});

// DELETE /webhooks/:id
router.delete('/webhooks/:id', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const { id } = req.params;
    const db = getDb();

    const result = await db.delete(emailWebhooks).where(and(eq(emailWebhooks.id, id), eq(emailWebhooks.agentId, agent.id))).returning({ id: emailWebhooks.id });
    if (result.length === 0) throw new AppError(404, 'Webhook not found or access denied', 'WEBHOOK_NOT_FOUND');
    res.json({ message: 'Webhook subscription removed', webhook_id: id });
  } catch (err) { next(err); }
});

export default router;
