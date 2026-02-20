import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getDb, authMiddleware, AppError } from '@moltbot/shared';
import { eq, and, desc, count, gt, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { emailAddresses, emails } from '../db/schema.js';

const router = express.Router();

const sendEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().max(500).optional(),
  body_text: z.string(),
  body_html: z.string().optional(),
});

// POST /send
router.post('/send', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const body = sendEmailSchema.parse(req.body);
    const db = getDb();

    const addr = await db.select({ address: emailAddresses.address }).from(emailAddresses)
      .where(and(eq(emailAddresses.agentId, agent.id), eq(emailAddresses.verified, true))).limit(1);
    if (addr.length === 0) throw new AppError(400, 'No verified email address found. Please add an @agentmail.xyz address first.', 'NO_ADDRESS');

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const [{ recentCount }] = await db.select({ recentCount: count() }).from(emails)
      .where(and(eq(emails.agentId, agent.id), eq(emails.direction, 'outbound'), gt(emails.createdAt, oneHourAgo)));
    if (recentCount >= 100) throw new AppError(429, 'Rate limit exceeded. Maximum 100 emails per hour.', 'RATE_LIMIT');

    const messageId = `<${randomUUID()}@agentmail.xyz>`;
    const [email] = await db.insert(emails).values({
      fromAddress: addr[0].address, toAddress: body.to, subject: body.subject || '(no subject)',
      bodyText: body.body_text, bodyHtml: body.body_html || null, status: 'queued', direction: 'outbound', messageId, agentId: agent.id,
    }).returning();

    res.status(201).json({ email, message: 'Email queued for sending' });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
    next(err);
  }
});

// GET /sent
router.get('/sent', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const db = getDb();

    const result = await db.select({
      id: emails.id, fromAddress: emails.fromAddress, toAddress: emails.toAddress, subject: emails.subject,
      status: emails.status, messageId: emails.messageId, createdAt: emails.createdAt,
    }).from(emails)
      .where(and(eq(emails.agentId, agent.id), eq(emails.direction, 'outbound')))
      .orderBy(desc(emails.createdAt)).limit(limit).offset(offset);

    const [{ total }] = await db.select({ total: count() }).from(emails)
      .where(and(eq(emails.agentId, agent.id), eq(emails.direction, 'outbound')));

    res.json({ emails: result, pagination: { limit, offset, total } });
  } catch (err) { next(err); }
});

export default router;
