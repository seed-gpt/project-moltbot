import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getDb, getPool, authMiddleware, AppError } from '@moltbot/shared';
import { eq, or, desc, sql, count } from 'drizzle-orm';
import { agents, wallets, transactions } from '../db/schema.js';

const router = express.Router();

const depositSchema = z.object({
  amount: z.number().int().positive('Amount must be a positive integer'),
});

const transferSchema = z.object({
  to_handle: z.string().min(1, 'Recipient handle is required'),
  amount: z.number().int().positive('Amount must be a positive integer'),
  memo: z.string().optional(),
});

// GET /wallet - Get wallet balance and recent transactions
router.get('/wallet', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const db = getDb();

    const walletResult = await db.select({ balance: wallets.balance, currency: wallets.currency })
      .from(wallets).where(eq(wallets.agentId, agent.id));
    if (walletResult.length === 0) throw new AppError(404, 'Wallet not found');

    const txResult = await db.select().from(transactions)
      .where(or(eq(transactions.fromAgentId, agent.id), eq(transactions.toAgentId, agent.id)))
      .orderBy(desc(transactions.createdAt)).limit(5);

    res.json({ balance: walletResult[0].balance, currency: walletResult[0].currency, recent_transactions: txResult });
  } catch (err) {
    next(err);
  }
});

// POST /wallet/deposit - Deposit funds
router.post('/wallet/deposit', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const body = depositSchema.parse(req.body);
    const db = getDb();

    const [updated] = await db.update(wallets)
      .set({ balance: sql`${wallets.balance} + ${body.amount}` })
      .where(eq(wallets.agentId, agent.id)).returning({ balance: wallets.balance });
    if (!updated) throw new AppError(404, 'Wallet not found');

    await db.insert(transactions).values({ type: 'deposit', amount: body.amount, toAgentId: agent.id, memo: 'Deposit to wallet' });

    res.json({ success: true, new_balance: updated.balance, amount_deposited: body.amount });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
    next(err);
  }
});

// POST /wallet/transfer - Transfer funds to another agent
router.post('/wallet/transfer', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const agent = (req as any).agent;
    const body = transferSchema.parse(req.body);
    const db = getDb();

    const recipient = await db.select({ id: agents.id }).from(agents).where(eq(agents.handle, body.to_handle));
    if (recipient.length === 0) throw new AppError(404, 'Recipient not found', 'RECIPIENT_NOT_FOUND');
    const recipientId = recipient[0].id;
    if (recipientId === agent.id) throw new AppError(400, 'Cannot transfer to yourself', 'SELF_TRANSFER');

    await client.query('BEGIN');

    const senderResult = await client.query('SELECT balance FROM wallets WHERE agent_id = $1 FOR UPDATE', [agent.id]);
    if (senderResult.rows.length === 0) { await client.query('ROLLBACK'); throw new AppError(404, 'Sender wallet not found'); }
    const senderBalance = senderResult.rows[0].balance;
    if (senderBalance < body.amount) { await client.query('ROLLBACK'); throw new AppError(400, 'Insufficient funds', 'INSUFFICIENT_FUNDS'); }

    await client.query('UPDATE wallets SET balance = balance - $1 WHERE agent_id = $2', [body.amount, agent.id]);
    await client.query('UPDATE wallets SET balance = balance + $1 WHERE agent_id = $2', [body.amount, recipientId]);
    await client.query(
      'INSERT INTO transactions (type, amount, from_agent_id, to_agent_id, memo) VALUES ($1, $2, $3, $4, $5)',
      ['transfer', body.amount, agent.id, recipientId, body.memo || null]
    );

    await client.query('COMMIT');
    res.json({ success: true, amount_transferred: body.amount, recipient: body.to_handle, new_balance: senderBalance - body.amount });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => { });
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
    next(err);
  } finally {
    client.release();
  }
});

// GET /wallet/transactions - Get paginated transaction history
router.get('/wallet/transactions', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;
    const db = getDb();

    const txResult = await db.select().from(transactions)
      .where(or(eq(transactions.fromAgentId, agent.id), eq(transactions.toAgentId, agent.id)))
      .orderBy(desc(transactions.createdAt)).limit(limit).offset(offset);

    const [{ total }] = await db.select({ total: count() }).from(transactions)
      .where(or(eq(transactions.fromAgentId, agent.id), eq(transactions.toAgentId, agent.id)));

    res.json({
      transactions: txResult,
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
