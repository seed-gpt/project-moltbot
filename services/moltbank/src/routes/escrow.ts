import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query, getPool, authMiddleware, AppError } from '@moltbot/shared';

const router = express.Router();

const createEscrowSchema = z.object({
  counterparty_handle: z.string().min(1, 'Counterparty handle is required'),
  amount: z.number().int().positive('Amount must be a positive integer'),
  description: z.string().optional(),
});

// POST /escrow/create - Create a new escrow
router.post('/escrow/create', authMiddleware(query), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const client = getPool();

  try {
    const agent = (req as any).agent;
    const body = createEscrowSchema.parse(req.body);

    // Find counterparty
    const counterpartyResult = await query(
      'SELECT id FROM agents WHERE handle = $1',
      [body.counterparty_handle]
    );

    if (counterpartyResult.rows.length === 0) {
      throw new AppError(404, 'Counterparty not found', 'COUNTERPARTY_NOT_FOUND');
    }

    const counterpartyId = counterpartyResult.rows[0].id;

    if (counterpartyId === agent.id) {
      throw new AppError(400, 'Cannot create escrow with yourself', 'SELF_ESCROW');
    }

    // Start transaction
    await client.query('BEGIN');

    // Check creator balance and lock funds
    const walletResult = await client.query(
      'SELECT balance FROM wallets WHERE agent_id = $1 FOR UPDATE',
      [agent.id]
    );

    if (walletResult.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new AppError(404, 'Wallet not found');
    }

    const balance = walletResult.rows[0].balance;

    if (balance < body.amount) {
      await client.query('ROLLBACK');
      throw new AppError(400, 'Insufficient funds', 'INSUFFICIENT_FUNDS');
    }

    // Deduct from creator's wallet
    await client.query(
      'UPDATE wallets SET balance = balance - $1 WHERE agent_id = $2',
      [body.amount, agent.id]
    );

    // Create escrow record
    const escrowResult = await client.query(
      `INSERT INTO escrows (creator_id, counterparty_id, amount, description, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, creator_id, counterparty_id, amount, description, status, created_at`,
      [agent.id, counterpartyId, body.amount, body.description || null, 'active']
    );

    const escrow = escrowResult.rows[0];

    // Create transaction record
    await client.query(
      `INSERT INTO transactions (type, amount, from_agent_id, memo, escrow_id)
       VALUES ($1, $2, $3, $4, $5)`,
      ['escrow_lock', body.amount, agent.id, `Funds locked in escrow #${escrow.id}`, escrow.id]
    );

    // Commit transaction
    await client.query('COMMIT');

    res.status(201).json({
      escrow: {
        id: escrow.id,
        creator_id: escrow.creator_id,
        counterparty_id: escrow.counterparty_id,
        amount: escrow.amount,
        description: escrow.description,
        status: escrow.status,
        created_at: escrow.created_at,
      },
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

// GET /escrow - List agent's escrows
router.get('/escrow', authMiddleware(query), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;

    const escrowResult = await query(
      `SELECT e.id, e.creator_id, e.counterparty_id, e.amount, e.description, e.status, e.created_at, e.updated_at,
              c.handle as creator_handle, cp.handle as counterparty_handle
       FROM escrows e
       JOIN agents c ON e.creator_id = c.id
       JOIN agents cp ON e.counterparty_id = cp.id
       WHERE e.creator_id = $1 OR e.counterparty_id = $1
       ORDER BY e.created_at DESC`,
      [agent.id]
    );

    res.json({
      escrows: escrowResult.rows.map(row => ({
        id: row.id,
        creator_id: row.creator_id,
        creator_handle: row.creator_handle,
        counterparty_id: row.counterparty_id,
        counterparty_handle: row.counterparty_handle,
        amount: row.amount,
        description: row.description,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// POST /escrow/:id/release - Release escrow funds to counterparty
router.post('/escrow/:id/release', authMiddleware(query), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const client = getPool();

  try {
    const agent = (req as any).agent;
    const escrowId = parseInt(req.params.id);

    if (isNaN(escrowId)) {
      throw new AppError(400, 'Invalid escrow ID');
    }

    // Start transaction
    await client.query('BEGIN');

    // Get escrow details
    const escrowResult = await client.query(
      'SELECT id, creator_id, counterparty_id, amount, status FROM escrows WHERE id = $1 FOR UPDATE',
      [escrowId]
    );

    if (escrowResult.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new AppError(404, 'Escrow not found');
    }

    const escrow = escrowResult.rows[0];

    // Only creator can release
    if (escrow.creator_id !== agent.id) {
      await client.query('ROLLBACK');
      throw new AppError(403, 'Only the creator can release escrow funds', 'FORBIDDEN');
    }

    // Check if escrow is active
    if (escrow.status !== 'active') {
      await client.query('ROLLBACK');
      throw new AppError(400, `Cannot release escrow with status: ${escrow.status}`, 'INVALID_STATUS');
    }

    // Add funds to counterparty wallet
    await client.query(
      'UPDATE wallets SET balance = balance + $1 WHERE agent_id = $2',
      [escrow.amount, escrow.counterparty_id]
    );

    // Update escrow status
    await client.query(
      'UPDATE escrows SET status = $1, updated_at = NOW() WHERE id = $2',
      ['released', escrowId]
    );

    // Create transaction record
    await client.query(
      `INSERT INTO transactions (type, amount, to_agent_id, memo, escrow_id)
       VALUES ($1, $2, $3, $4, $5)`,
      ['escrow_release', escrow.amount, escrow.counterparty_id, `Escrow #${escrowId} released`, escrowId]
    );

    // Commit transaction
    await client.query('COMMIT');

    res.json({
      success: true,
      escrow_id: escrowId,
      amount_released: escrow.amount,
      status: 'released',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  }
});

// POST /escrow/:id/dispute - Mark escrow as disputed
router.post('/escrow/:id/dispute', authMiddleware(query), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const escrowId = parseInt(req.params.id);

    if (isNaN(escrowId)) {
      throw new AppError(400, 'Invalid escrow ID');
    }

    // Get escrow details
    const escrowResult = await query(
      'SELECT id, creator_id, counterparty_id, status FROM escrows WHERE id = $1',
      [escrowId]
    );

    if (escrowResult.rows.length === 0) {
      throw new AppError(404, 'Escrow not found');
    }

    const escrow = escrowResult.rows[0];

    // Check if agent is part of the escrow
    if (escrow.creator_id !== agent.id && escrow.counterparty_id !== agent.id) {
      throw new AppError(403, 'You are not part of this escrow', 'FORBIDDEN');
    }

    // Check if escrow is active
    if (escrow.status !== 'active') {
      throw new AppError(400, `Cannot dispute escrow with status: ${escrow.status}`, 'INVALID_STATUS');
    }

    // Update escrow status
    await query(
      'UPDATE escrows SET status = $1, updated_at = NOW() WHERE id = $2',
      ['disputed', escrowId]
    );

    res.json({
      success: true,
      escrow_id: escrowId,
      status: 'disputed',
      message: 'Escrow marked as disputed. Funds are locked pending resolution.',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
