import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query, getPool, authMiddleware, AppError } from '@moltbot/shared';

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
router.get('/wallet', authMiddleware(query), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;

    // Get wallet balance
    const walletResult = await query(
      'SELECT balance, currency FROM wallets WHERE agent_id = $1',
      [agent.id]
    );

    if (walletResult.rows.length === 0) {
      throw new AppError(404, 'Wallet not found');
    }

    const wallet = walletResult.rows[0];

    // Get recent transactions (last 5)
    const txResult = await query(
      `SELECT id, type, amount, from_agent_id, to_agent_id, memo, created_at
       FROM transactions
       WHERE from_agent_id = $1 OR to_agent_id = $1
       ORDER BY created_at DESC
       LIMIT 5`,
      [agent.id]
    );

    res.json({
      balance: wallet.balance,
      currency: wallet.currency,
      recent_transactions: txResult.rows,
    });
  } catch (err) {
    next(err);
  }
});

// POST /wallet/deposit - Deposit funds
router.post('/wallet/deposit', authMiddleware(query), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const body = depositSchema.parse(req.body);

    // Update wallet balance
    const walletResult = await query(
      'UPDATE wallets SET balance = balance + $1 WHERE agent_id = $2 RETURNING balance',
      [body.amount, agent.id]
    );

    if (walletResult.rows.length === 0) {
      throw new AppError(404, 'Wallet not found');
    }

    // Create transaction record
    await query(
      `INSERT INTO transactions (type, amount, to_agent_id, memo)
       VALUES ($1, $2, $3, $4)`,
      ['deposit', body.amount, agent.id, 'Deposit to wallet']
    );

    res.json({
      success: true,
      new_balance: walletResult.rows[0].balance,
      amount_deposited: body.amount,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    next(err);
  }
});

// POST /wallet/transfer - Transfer funds to another agent
router.post('/wallet/transfer', authMiddleware(query), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const client = getPool();

  try {
    const agent = (req as any).agent;
    const body = transferSchema.parse(req.body);

    // Find recipient
    const recipientResult = await query(
      'SELECT id FROM agents WHERE handle = $1',
      [body.to_handle]
    );

    if (recipientResult.rows.length === 0) {
      throw new AppError(404, 'Recipient not found', 'RECIPIENT_NOT_FOUND');
    }

    const recipientId = recipientResult.rows[0].id;

    if (recipientId === agent.id) {
      throw new AppError(400, 'Cannot transfer to yourself', 'SELF_TRANSFER');
    }

    // Start transaction
    await client.query('BEGIN');

    // Check sender balance and deduct
    const senderResult = await client.query(
      'SELECT balance FROM wallets WHERE agent_id = $1 FOR UPDATE',
      [agent.id]
    );

    if (senderResult.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new AppError(404, 'Sender wallet not found');
    }

    const senderBalance = senderResult.rows[0].balance;

    if (senderBalance < body.amount) {
      await client.query('ROLLBACK');
      throw new AppError(400, 'Insufficient funds', 'INSUFFICIENT_FUNDS');
    }

    // Deduct from sender
    await client.query(
      'UPDATE wallets SET balance = balance - $1 WHERE agent_id = $2',
      [body.amount, agent.id]
    );

    // Add to recipient
    await client.query(
      'UPDATE wallets SET balance = balance + $1 WHERE agent_id = $2',
      [body.amount, recipientId]
    );

    // Create transaction record
    await client.query(
      `INSERT INTO transactions (type, amount, from_agent_id, to_agent_id, memo)
       VALUES ($1, $2, $3, $4, $5)`,
      ['transfer', body.amount, agent.id, recipientId, body.memo || null]
    );

    // Commit transaction
    await client.query('COMMIT');

    res.json({
      success: true,
      amount_transferred: body.amount,
      recipient: body.to_handle,
      new_balance: senderBalance - body.amount,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    next(err);
  }
});

// GET /wallet/transactions - Get paginated transaction history
router.get('/wallet/transactions', authMiddleware(query), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;

    const txResult = await query(
      `SELECT id, type, amount, from_agent_id, to_agent_id, memo, created_at
       FROM transactions
       WHERE from_agent_id = $1 OR to_agent_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [agent.id, limit, offset]
    );

    const countResult = await query(
      'SELECT COUNT(*) as total FROM transactions WHERE from_agent_id = $1 OR to_agent_id = $1',
      [agent.id]
    );

    const total = parseInt(countResult.rows[0].total);

    res.json({
      transactions: txResult.rows,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
