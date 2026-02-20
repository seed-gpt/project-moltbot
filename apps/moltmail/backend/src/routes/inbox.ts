import express, { Request, Response, NextFunction } from 'express';
import { getDb, authMiddleware, AppError } from '@moltbot/shared';
import { eq, and, desc, count } from 'drizzle-orm';
import { emails } from '../db/schema.js';

const router = express.Router();

// GET /inbox
router.get('/inbox', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const db = getDb();

    const conditions = [eq(emails.agentId, agent.id), eq(emails.direction, 'inbound')];
    if (req.query.unread === 'true') conditions.push(eq(emails.status, 'received'));

    const result = await db.select({
      id: emails.id, fromAddress: emails.fromAddress, toAddress: emails.toAddress, subject: emails.subject,
      status: emails.status, messageId: emails.messageId, createdAt: emails.createdAt,
    }).from(emails)
      .where(and(...conditions))
      .orderBy(desc(emails.createdAt)).limit(limit).offset(offset);

    const [{ total }] = await db.select({ total: count() }).from(emails)
      .where(and(eq(emails.agentId, agent.id), eq(emails.direction, 'inbound')));

    res.json({ emails: result, pagination: { limit, offset, total } });
  } catch (err) { next(err); }
});

// GET /inbox/:id
router.get('/inbox/:id', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const { id } = req.params;
    const db = getDb();

    const result = await db.select().from(emails)
      .where(and(eq(emails.id, id), eq(emails.agentId, agent.id), eq(emails.direction, 'inbound')));
    if (result.length === 0) throw new AppError(404, 'Email not found or access denied', 'EMAIL_NOT_FOUND');

    res.json({ email: result[0] });
  } catch (err) { next(err); }
});

// DELETE /inbox/:id
router.delete('/inbox/:id', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const { id } = req.params;
    const db = getDb();

    const result = await db.delete(emails)
      .where(and(eq(emails.id, id), eq(emails.agentId, agent.id), eq(emails.direction, 'inbound'))).returning({ id: emails.id });
    if (result.length === 0) throw new AppError(404, 'Email not found or access denied', 'EMAIL_NOT_FOUND');

    res.json({ message: 'Email deleted successfully', email_id: id });
  } catch (err) { next(err); }
});

export default router;
