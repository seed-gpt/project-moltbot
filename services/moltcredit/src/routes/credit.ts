import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query, authMiddleware, AppError } from '@moltbot/shared';

const router = express.Router();

const extendCreditSchema = z.object({
  grantee_handle: z.string().min(3, 'Grantee handle must be at least 3 characters'),
  limit_amount: z.number().int().positive('Limit amount must be positive'),
  memo: z.string().optional(),
});

// POST /credit/extend - Extend credit to another agent
router.post('/credit/extend', authMiddleware(query), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const body = extendCreditSchema.parse(req.body);

    // Validate not extending to self
    if (body.grantee_handle === agent.handle) {
      throw new AppError(400, 'Cannot extend credit to yourself', 'SELF_CREDIT');
    }

    // Find grantee by handle
    const granteeResult = await query(
      'SELECT id, handle FROM agents WHERE handle = $1',
      [body.grantee_handle]
    );

    if (granteeResult.rows.length === 0) {
      throw new AppError(404, 'Grantee not found', 'GRANTEE_NOT_FOUND');
    }

    const grantee = granteeResult.rows[0];

    // Check if active credit line already exists
    const existingLine = await query(
      'SELECT id FROM credit_lines WHERE grantor_id = $1 AND grantee_id = $2 AND status = $3',
      [agent.id, grantee.id, 'active']
    );

    if (existingLine.rows.length > 0) {
      throw new AppError(409, 'Active credit line already exists with this agent', 'CREDIT_LINE_EXISTS');
    }

    // Create credit line
    const result = await query(
      `INSERT INTO credit_lines (grantor_id, grantee_id, limit_amount, used_amount, currency, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, grantor_id, grantee_id, limit_amount, used_amount, currency, status, created_at, updated_at`,
      [agent.id, grantee.id, body.limit_amount, 0, 'USDC', 'active']
    );

    const creditLine = result.rows[0];

    res.status(201).json({
      credit_line: {
        id: creditLine.id,
        grantor_id: creditLine.grantor_id,
        grantee_id: creditLine.grantee_id,
        grantee_handle: body.grantee_handle,
        limit_amount: creditLine.limit_amount,
        used_amount: creditLine.used_amount,
        available_amount: creditLine.limit_amount - creditLine.used_amount,
        currency: creditLine.currency,
        status: creditLine.status,
        created_at: creditLine.created_at,
        updated_at: creditLine.updated_at,
      },
      message: `Credit line of ${body.limit_amount} USDC extended to ${body.grantee_handle}`,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    next(err);
  }
});

// GET /credit - Get credit lines (given and received)
router.get('/credit', authMiddleware(query), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;

    // Get credit lines given (as grantor)
    const givenResult = await query(
      `SELECT cl.*, a.handle as grantee_handle, a.name as grantee_name
       FROM credit_lines cl
       JOIN agents a ON cl.grantee_id = a.id
       WHERE cl.grantor_id = $1
       ORDER BY cl.created_at DESC`,
      [agent.id]
    );

    // Get credit lines received (as grantee)
    const receivedResult = await query(
      `SELECT cl.*, a.handle as grantor_handle, a.name as grantor_name
       FROM credit_lines cl
       JOIN agents a ON cl.grantor_id = a.id
       WHERE cl.grantee_id = $1
       ORDER BY cl.created_at DESC`,
      [agent.id]
    );

    const given = givenResult.rows.map((line: any) => ({
      id: line.id,
      grantee_id: line.grantee_id,
      grantee_handle: line.grantee_handle,
      grantee_name: line.grantee_name,
      limit_amount: line.limit_amount,
      used_amount: line.used_amount,
      available_amount: line.limit_amount - line.used_amount,
      currency: line.currency,
      status: line.status,
      created_at: line.created_at,
      updated_at: line.updated_at,
    }));

    const received = receivedResult.rows.map((line: any) => ({
      id: line.id,
      grantor_id: line.grantor_id,
      grantor_handle: line.grantor_handle,
      grantor_name: line.grantor_name,
      limit_amount: line.limit_amount,
      used_amount: line.used_amount,
      available_amount: line.limit_amount - line.used_amount,
      currency: line.currency,
      status: line.status,
      created_at: line.created_at,
      updated_at: line.updated_at,
    }));

    res.json({ given, received });
  } catch (err) {
    next(err);
  }
});

// GET /credit/:id - Get specific credit line with transactions
router.get('/credit/:id', authMiddleware(query), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const { id } = req.params;

    // Get credit line
    const lineResult = await query(
      `SELECT cl.*,
              grantor.handle as grantor_handle, grantor.name as grantor_name,
              grantee.handle as grantee_handle, grantee.name as grantee_name
       FROM credit_lines cl
       JOIN agents grantor ON cl.grantor_id = grantor.id
       JOIN agents grantee ON cl.grantee_id = grantee.id
       WHERE cl.id = $1 AND (cl.grantor_id = $2 OR cl.grantee_id = $2)`,
      [id, agent.id]
    );

    if (lineResult.rows.length === 0) {
      throw new AppError(404, 'Credit line not found or access denied', 'CREDIT_LINE_NOT_FOUND');
    }

    const line = lineResult.rows[0];

    // Get transactions for this credit line
    const txResult = await query(
      `SELECT id, amount, type, memo, created_at
       FROM credit_transactions
       WHERE credit_line_id = $1
       ORDER BY created_at DESC`,
      [id]
    );

    res.json({
      id: line.id,
      grantor_id: line.grantor_id,
      grantor_handle: line.grantor_handle,
      grantor_name: line.grantor_name,
      grantee_id: line.grantee_id,
      grantee_handle: line.grantee_handle,
      grantee_name: line.grantee_name,
      limit_amount: line.limit_amount,
      used_amount: line.used_amount,
      available_amount: line.limit_amount - line.used_amount,
      currency: line.currency,
      status: line.status,
      created_at: line.created_at,
      updated_at: line.updated_at,
      transactions: txResult.rows,
    });
  } catch (err) {
    next(err);
  }
});

// POST /credit/:id/revoke - Revoke a credit line
router.post('/credit/:id/revoke', authMiddleware(query), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const { id } = req.params;

    // Get credit line
    const lineResult = await query(
      'SELECT * FROM credit_lines WHERE id = $1 AND grantor_id = $2',
      [id, agent.id]
    );

    if (lineResult.rows.length === 0) {
      throw new AppError(404, 'Credit line not found or you are not the grantor', 'CREDIT_LINE_NOT_FOUND');
    }

    const line = lineResult.rows[0];

    // Check if any amount is used
    if (line.used_amount > 0) {
      throw new AppError(400, 'Cannot revoke credit line with outstanding balance', 'OUTSTANDING_BALANCE');
    }

    // Update status to revoked
    await query(
      'UPDATE credit_lines SET status = $1, updated_at = NOW() WHERE id = $2',
      ['revoked', id]
    );

    res.json({
      message: 'Credit line revoked successfully',
      credit_line_id: id,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
