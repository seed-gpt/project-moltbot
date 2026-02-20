import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getDb, authMiddleware, AppError } from '@moltbot/shared';
import { eq, and, desc, sql } from 'drizzle-orm';
import { agents, creditLines, creditTransactions } from '../db/schema.js';

const router = express.Router();

const extendCreditSchema = z.object({
  grantee_handle: z.string().min(3, 'Grantee handle must be at least 3 characters'),
  limit_amount: z.number().int().positive('Limit amount must be positive'),
  memo: z.string().optional(),
});

// POST /credit/extend
router.post('/credit/extend', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const body = extendCreditSchema.parse(req.body);
    const db = getDb();

    if (body.grantee_handle === agent.handle) throw new AppError(400, 'Cannot extend credit to yourself', 'SELF_CREDIT');

    const grantee = await db.select({ id: agents.id, handle: agents.handle }).from(agents).where(eq(agents.handle, body.grantee_handle));
    if (grantee.length === 0) throw new AppError(404, 'Grantee not found', 'GRANTEE_NOT_FOUND');

    const existing = await db.select({ id: creditLines.id }).from(creditLines)
      .where(and(eq(creditLines.grantorId, agent.id), eq(creditLines.granteeId, grantee[0].id), eq(creditLines.status, 'active')));
    if (existing.length > 0) throw new AppError(409, 'Active credit line already exists with this agent', 'CREDIT_LINE_EXISTS');

    const [cl] = await db.insert(creditLines).values({
      grantorId: agent.id, granteeId: grantee[0].id, limitAmount: body.limit_amount, usedAmount: 0, currency: 'USDC', status: 'active',
    }).returning();

    res.status(201).json({
      credit_line: { ...cl, grantee_handle: body.grantee_handle, available_amount: cl.limitAmount - cl.usedAmount },
      message: `Credit line of ${body.limit_amount} USDC extended to ${body.grantee_handle}`,
    });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
    next(err);
  }
});

// GET /credit
router.get('/credit', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const db = getDb();

    const given = await db.select({ cl: creditLines, granteeHandle: agents.handle, granteeName: agents.name })
      .from(creditLines).innerJoin(agents, eq(creditLines.granteeId, agents.id))
      .where(eq(creditLines.grantorId, agent.id)).orderBy(desc(creditLines.createdAt));

    const received = await db.select({ cl: creditLines, grantorHandle: agents.handle, grantorName: agents.name })
      .from(creditLines).innerJoin(agents, eq(creditLines.grantorId, agents.id))
      .where(eq(creditLines.granteeId, agent.id)).orderBy(desc(creditLines.createdAt));

    res.json({
      given: given.map(r => ({ ...r.cl, grantee_handle: r.granteeHandle, grantee_name: r.granteeName, available_amount: r.cl.limitAmount - r.cl.usedAmount })),
      received: received.map(r => ({ ...r.cl, grantor_handle: r.grantorHandle, grantor_name: r.grantorName, available_amount: r.cl.limitAmount - r.cl.usedAmount })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /credit/:id
router.get('/credit/:id', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const { id } = req.params;
    const db = getDb();

    const result = await db.execute(sql`
      SELECT cl.*, grantor.handle as grantor_handle, grantor.name as grantor_name,
             grantee.handle as grantee_handle, grantee.name as grantee_name
      FROM credit_lines cl
      JOIN agents grantor ON cl.grantor_id = grantor.id
      JOIN agents grantee ON cl.grantee_id = grantee.id
      WHERE cl.id = ${id} AND (cl.grantor_id = ${agent.id} OR cl.grantee_id = ${agent.id})
    `);

    const rows = (result as any).rows;
    if (rows.length === 0) throw new AppError(404, 'Credit line not found or access denied', 'CREDIT_LINE_NOT_FOUND');

    const txs = await db.select().from(creditTransactions)
      .where(eq(creditTransactions.creditLineId, id)).orderBy(desc(creditTransactions.createdAt));

    const line = rows[0];
    res.json({ ...line, available_amount: line.limit_amount - line.used_amount, transactions: txs });
  } catch (err) {
    next(err);
  }
});

// POST /credit/:id/revoke
router.post('/credit/:id/revoke', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const { id } = req.params;
    const db = getDb();

    const result = await db.select().from(creditLines).where(and(eq(creditLines.id, id), eq(creditLines.grantorId, agent.id)));
    if (result.length === 0) throw new AppError(404, 'Credit line not found or you are not the grantor', 'CREDIT_LINE_NOT_FOUND');
    if (result[0].usedAmount > 0) throw new AppError(400, 'Cannot revoke credit line with outstanding balance', 'OUTSTANDING_BALANCE');

    await db.update(creditLines).set({ status: 'revoked', updatedAt: new Date() }).where(eq(creditLines.id, id));
    res.json({ message: 'Credit line revoked successfully', credit_line_id: id });
  } catch (err) {
    next(err);
  }
});

// POST /credit/:id/settle
router.post('/credit/:id/settle', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const { id } = req.params;
    const db = getDb();

    const result = await db.select().from(creditLines).where(and(eq(creditLines.id, id), eq(creditLines.grantorId, agent.id)));
    if (result.length === 0) throw new AppError(404, 'Credit line not found or you are not the grantor', 'CREDIT_LINE_NOT_FOUND');

    const usedAmount = result[0].usedAmount;
    if (usedAmount > 0) {
      const [settlement] = await db.insert(creditTransactions).values({
        creditLineId: id, amount: usedAmount, type: 'settlement', memo: 'Credit line settlement',
      }).returning();
      await db.update(creditLines).set({ usedAmount: 0, updatedAt: new Date() }).where(eq(creditLines.id, id));
      res.json({ message: 'Credit line settled successfully', settlement, previous_balance: usedAmount, new_balance: 0 });
    } else {
      res.json({ message: 'No outstanding balance to settle', credit_line_id: id, balance: 0 });
    }
  } catch (err) {
    next(err);
  }
});

export default router;
