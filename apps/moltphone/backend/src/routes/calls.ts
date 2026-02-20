import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getDb, authMiddleware, AppError } from '@moltbot/shared';
import { eq, and, desc, count, sum, sql, inArray } from 'drizzle-orm';
import { calls } from '../db/schema.js';

const router = express.Router();

const callSchema = z.object({
  to_number: z.string().regex(/^\+[1-9]\d{1,14}$/, 'Invalid E.164 phone number format'),
  assistant_config: z.object({ first_message: z.string(), system_prompt: z.string(), voice: z.string().optional() }),
});

// POST /call
router.post('/call', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const body = callSchema.parse(req.body);
    const db = getDb();

    const [{ activeCount }] = await db.select({ activeCount: count() }).from(calls)
      .where(and(eq(calls.agentId, agent.id), inArray(calls.status, ['queued', 'ringing', 'in_progress'])));
    if (activeCount >= 10) throw new AppError(429, 'Rate limit exceeded. Maximum 10 concurrent calls.', 'RATE_LIMIT');

    const [call] = await db.insert(calls).values({
      agentId: agent.id, direction: 'outbound', toNumber: body.to_number, fromNumber: '+15551234567', status: 'queued',
    }).returning();

    res.status(201).json({ call_id: call.id, status: call.status, call });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
    next(err);
  }
});

// POST /call/end/:id
router.post('/call/end/:id', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const callId = req.params.id;
    const db = getDb();

    const result = await db.select({ id: calls.id, status: calls.status }).from(calls)
      .where(and(eq(calls.id, callId), eq(calls.agentId, agent.id)));
    if (result.length === 0) throw new AppError(404, 'Call not found', 'CALL_NOT_FOUND');
    if (!['queued', 'ringing', 'in_progress'].includes(result[0].status)) throw new AppError(400, 'Call is not active', 'CALL_NOT_ACTIVE');

    const [updated] = await db.update(calls).set({ status: 'cancelled', endedAt: new Date() }).where(eq(calls.id, callId)).returning();
    res.json({ message: 'Call ended', call: updated });
  } catch (err) { next(err); }
});

// GET /calls
router.get('/calls', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as string;
    const db = getDb();

    const conditions = [eq(calls.agentId, agent.id)];
    if (status) conditions.push(eq(calls.status, status));

    const result = await db.select({
      id: calls.id, direction: calls.direction, toNumber: calls.toNumber, fromNumber: calls.fromNumber,
      status: calls.status, durationSeconds: calls.durationSeconds, costCents: calls.costCents,
      createdAt: calls.createdAt, endedAt: calls.endedAt,
    }).from(calls).where(and(...conditions)).orderBy(desc(calls.createdAt)).limit(limit).offset(offset);

    const [{ total }] = await db.select({ total: count() }).from(calls).where(and(...conditions));
    res.json({ calls: result, pagination: { limit, offset, total } });
  } catch (err) { next(err); }
});

// GET /calls/:id
router.get('/calls/:id', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const db = getDb();
    const result = await db.select().from(calls).where(and(eq(calls.id, req.params.id), eq(calls.agentId, agent.id)));
    if (result.length === 0) throw new AppError(404, 'Call not found', 'CALL_NOT_FOUND');
    res.json({ call: result[0] });
  } catch (err) { next(err); }
});

// GET /calls/stats
router.get('/calls/stats', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const db = getDb();
    const [result] = await db.select({
      totalCalls: count(), totalDuration: sum(calls.durationSeconds), totalCost: sum(calls.costCents),
    }).from(calls).where(eq(calls.agentId, agent.id));

    res.json({
      stats: {
        total_calls: result.totalCalls,
        total_duration: parseInt(String(result.totalDuration || 0)),
        total_cost: parseInt(String(result.totalCost || 0)),
      }
    });
  } catch (err) { next(err); }
});

export default router;
