import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getDb, getPool, authMiddleware, AppError } from '@moltbot/shared';
import { eq, and, desc, count, sql } from 'drizzle-orm';
import { agents, creditLines, creditTransactions } from '../db/schema.js';

const router = express.Router();

const drawSchema = z.object({ amount: z.number().int().positive('Amount must be positive'), memo: z.string().optional() });
const repaySchema = z.object({ amount: z.number().int().positive('Amount must be positive'), memo: z.string().optional() });

// POST /credit/:id/draw
router.post('/credit/:id/draw', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const pool = getPool();
    const client = await pool.connect();
    try {
        const agent = (req as any).agent;
        const { id } = req.params;
        const body = drawSchema.parse(req.body);

        await client.query('BEGIN');
        const lineResult = await client.query('SELECT * FROM credit_lines WHERE id = $1 AND grantee_id = $2 AND status = $3', [id, agent.id, 'active']);
        if (lineResult.rows.length === 0) { await client.query('ROLLBACK'); throw new AppError(404, 'Credit line not found or you are not the grantee', 'CREDIT_LINE_NOT_FOUND'); }

        const line = lineResult.rows[0];
        const available = line.limit_amount - line.used_amount;
        if (body.amount > available) { await client.query('ROLLBACK'); throw new AppError(400, `Insufficient credit. Available: ${available}, requested: ${body.amount}`, 'INSUFFICIENT_CREDIT'); }

        await client.query('UPDATE credit_lines SET used_amount = used_amount + $1, updated_at = NOW() WHERE id = $2', [body.amount, id]);
        const txResult = await client.query(
            `INSERT INTO credit_transactions (credit_line_id, amount, type, memo) VALUES ($1, $2, $3, $4) RETURNING *`,
            [id, body.amount, 'draw', body.memo || null]
        );
        await client.query('COMMIT');

        res.status(201).json({
            transaction: txResult.rows[0],
            credit_line: { id: line.id, used_amount: line.used_amount + body.amount, available_amount: available - body.amount, limit_amount: line.limit_amount },
            message: `Drew ${body.amount} cents from credit line`,
        });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => { });
        if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
        next(err);
    } finally { client.release(); }
});

// POST /credit/:id/repay
router.post('/credit/:id/repay', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const pool = getPool();
    const client = await pool.connect();
    try {
        const agent = (req as any).agent;
        const { id } = req.params;
        const body = repaySchema.parse(req.body);

        await client.query('BEGIN');
        const lineResult = await client.query('SELECT * FROM credit_lines WHERE id = $1 AND grantee_id = $2', [id, agent.id]);
        if (lineResult.rows.length === 0) { await client.query('ROLLBACK'); throw new AppError(404, 'Credit line not found or you are not the grantee', 'CREDIT_LINE_NOT_FOUND'); }

        const line = lineResult.rows[0];
        if (body.amount > line.used_amount) { await client.query('ROLLBACK'); throw new AppError(400, `Cannot repay more than owed. Owed: ${line.used_amount}, repaying: ${body.amount}`, 'OVERPAYMENT'); }

        await client.query('UPDATE credit_lines SET used_amount = used_amount - $1, updated_at = NOW() WHERE id = $2', [body.amount, id]);
        const txResult = await client.query(
            `INSERT INTO credit_transactions (credit_line_id, amount, type, memo) VALUES ($1, $2, $3, $4) RETURNING *`,
            [id, body.amount, 'repay', body.memo || null]
        );
        await client.query('COMMIT');

        res.status(201).json({
            transaction: txResult.rows[0],
            credit_line: { id: line.id, used_amount: line.used_amount - body.amount, available_amount: (line.limit_amount - line.used_amount) + body.amount, limit_amount: line.limit_amount },
            message: `Repaid ${body.amount} cents on credit line`,
        });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => { });
        if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
        next(err);
    } finally { client.release(); }
});

// GET /credit/balance/:handle
router.get('/credit/balance/:handle', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const agent = (req as any).agent;
        const { handle } = req.params;
        const db = getDb();

        const other = await db.select({ id: agents.id }).from(agents).where(eq(agents.handle, handle));
        if (other.length === 0) throw new AppError(404, 'Agent not found', 'AGENT_NOT_FOUND');

        const [{ givenUsed }] = await db.select({ givenUsed: sql<number>`COALESCE(SUM(${creditLines.usedAmount}), 0)` })
            .from(creditLines).where(and(eq(creditLines.grantorId, agent.id), eq(creditLines.granteeId, other[0].id), eq(creditLines.status, 'active')));
        const [{ receivedUsed }] = await db.select({ receivedUsed: sql<number>`COALESCE(SUM(${creditLines.usedAmount}), 0)` })
            .from(creditLines).where(and(eq(creditLines.grantorId, other[0].id), eq(creditLines.granteeId, agent.id), eq(creditLines.status, 'active')));

        res.json({ with_agent: handle, credit_given_used: Number(givenUsed), credit_received_used: Number(receivedUsed), net_balance: Number(receivedUsed) - Number(givenUsed) });
    } catch (err) { next(err); }
});

// GET /credit/:id/transactions
router.get('/credit/:id/transactions', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const agent = (req as any).agent;
        const { id } = req.params;
        const page = parseInt(req.query.page as string) || 1;
        const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
        const offset = (page - 1) * limit;
        const db = getDb();

        const access = await db.select({ id: creditLines.id }).from(creditLines)
            .where(and(eq(creditLines.id, id), sql`(${creditLines.grantorId} = ${agent.id} OR ${creditLines.granteeId} = ${agent.id})`));
        if (access.length === 0) throw new AppError(404, 'Credit line not found or access denied', 'CREDIT_LINE_NOT_FOUND');

        const txs = await db.select().from(creditTransactions)
            .where(eq(creditTransactions.creditLineId, id)).orderBy(desc(creditTransactions.createdAt)).limit(limit).offset(offset);
        const [{ total }] = await db.select({ total: count() }).from(creditTransactions).where(eq(creditTransactions.creditLineId, id));

        res.json({ transactions: txs, pagination: { page, limit, total, total_pages: Math.ceil(total / limit) } });
    } catch (err) { next(err); }
});

export default router;
