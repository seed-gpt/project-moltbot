import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getDb, getPool, authMiddleware, AppError } from '@moltbot/shared';
import { eq, or, desc } from 'drizzle-orm';
import { agents, wallets, escrows } from '../db/schema.js';

const router = express.Router();

const createEscrowSchema = z.object({
  counterparty_handle: z.string().min(1, 'Counterparty handle is required'),
  amount: z.number().int().positive('Amount must be a positive integer'),
  description: z.string().optional(),
});

// POST /escrow/create
router.post('/escrow/create', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const agent = (req as any).agent;
    const body = createEscrowSchema.parse(req.body);
    const db = getDb();

    const cp = await db.select({ id: agents.id }).from(agents).where(eq(agents.handle, body.counterparty_handle));
    if (cp.length === 0) throw new AppError(404, 'Counterparty not found', 'COUNTERPARTY_NOT_FOUND');
    const counterpartyId = cp[0].id;
    if (counterpartyId === agent.id) throw new AppError(400, 'Cannot create escrow with yourself', 'SELF_ESCROW');

    await client.query('BEGIN');

    const walletResult = await client.query('SELECT balance FROM wallets WHERE agent_id = $1 FOR UPDATE', [agent.id]);
    if (walletResult.rows.length === 0) { await client.query('ROLLBACK'); throw new AppError(404, 'Wallet not found'); }
    if (walletResult.rows[0].balance < body.amount) { await client.query('ROLLBACK'); throw new AppError(400, 'Insufficient funds', 'INSUFFICIENT_FUNDS'); }

    await client.query('UPDATE wallets SET balance = balance - $1 WHERE agent_id = $2', [body.amount, agent.id]);

    const escrowResult = await client.query(
      `INSERT INTO escrows (creator_id, counterparty_id, amount, description, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, creator_id, counterparty_id, amount, description, status, created_at`,
      [agent.id, counterpartyId, body.amount, body.description || null, 'active']
    );
    const escrow = escrowResult.rows[0];

    await client.query(
      `INSERT INTO transactions (type, amount, from_agent_id, memo) VALUES ($1, $2, $3, $4)`,
      ['escrow_lock', body.amount, agent.id, `Funds locked in escrow #${escrow.id}`]
    );

    await client.query('COMMIT');
    res.status(201).json({ escrow });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => { });
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
    next(err);
  } finally {
    client.release();
  }
});

// GET /escrow - List agent's escrows
router.get('/escrow', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const db = getDb();

    const result = await db.select({
      id: escrows.id, creatorId: escrows.creatorId, counterpartyId: escrows.counterpartyId,
      amount: escrows.amount, description: escrows.description, status: escrows.status,
      createdAt: escrows.createdAt, updatedAt: escrows.updatedAt,
    }).from(escrows)
      .where(or(eq(escrows.creatorId, agent.id), eq(escrows.counterpartyId, agent.id)))
      .orderBy(desc(escrows.createdAt));

    res.json({ escrows: result });
  } catch (err) {
    next(err);
  }
});

// POST /escrow/:id/release
router.post('/escrow/:id/release', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const agent = (req as any).agent;
    const escrowId = req.params.id;

    await client.query('BEGIN');
    const escrowResult = await client.query('SELECT id, creator_id, counterparty_id, amount, status FROM escrows WHERE id = $1 FOR UPDATE', [escrowId]);
    if (escrowResult.rows.length === 0) { await client.query('ROLLBACK'); throw new AppError(404, 'Escrow not found'); }

    const escrow = escrowResult.rows[0];
    if (escrow.creator_id !== agent.id) { await client.query('ROLLBACK'); throw new AppError(403, 'Only the creator can release escrow funds', 'FORBIDDEN'); }
    if (escrow.status !== 'active') { await client.query('ROLLBACK'); throw new AppError(400, `Cannot release escrow with status: ${escrow.status}`, 'INVALID_STATUS'); }

    await client.query('UPDATE wallets SET balance = balance + $1 WHERE agent_id = $2', [escrow.amount, escrow.counterparty_id]);
    await client.query('UPDATE escrows SET status = $1, updated_at = NOW() WHERE id = $2', ['released', escrowId]);
    await client.query(
      `INSERT INTO transactions (type, amount, to_agent_id, memo) VALUES ($1, $2, $3, $4)`,
      ['escrow_release', escrow.amount, escrow.counterparty_id, `Escrow #${escrowId} released`]
    );

    await client.query('COMMIT');
    res.json({ success: true, escrow_id: escrowId, amount_released: escrow.amount, status: 'released' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => { });
    next(err);
  } finally {
    client.release();
  }
});

// POST /escrow/:id/dispute
router.post('/escrow/:id/dispute', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const escrowId = req.params.id;
    const db = getDb();

    const result = await db.select().from(escrows).where(eq(escrows.id, escrowId));
    if (result.length === 0) throw new AppError(404, 'Escrow not found');

    const escrow = result[0];
    if (escrow.creatorId !== agent.id && escrow.counterpartyId !== agent.id) {
      throw new AppError(403, 'You are not part of this escrow', 'FORBIDDEN');
    }
    if (escrow.status !== 'active') {
      throw new AppError(400, `Cannot dispute escrow with status: ${escrow.status}`, 'INVALID_STATUS');
    }

    await db.update(escrows).set({ status: 'disputed', updatedAt: new Date() }).where(eq(escrows.id, escrowId));

    res.json({ success: true, escrow_id: escrowId, status: 'disputed', message: 'Escrow marked as disputed. Funds are locked pending resolution.' });
  } catch (err) {
    next(err);
  }
});

export default router;
