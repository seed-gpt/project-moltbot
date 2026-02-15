import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query, authMiddleware, AppError } from '@moltbot/shared';

const router = express.Router();

// Validation schemas
const callSchema = z.object({
  to_number: z.string().regex(/^\+[1-9]\d{1,14}$/, 'Invalid E.164 phone number format'),
  assistant_config: z.object({
    first_message: z.string(),
    system_prompt: z.string(),
    voice: z.string().optional(),
  }),
});

// POST /call - Initiate a call
router.post('/call', authMiddleware(query), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const body = callSchema.parse(req.body);

    // Rate limit: check concurrent calls
    const activeCalls = await query(
      `SELECT COUNT(*) as count FROM calls
       WHERE agent_id = $1 AND status IN ('queued', 'ringing', 'in_progress')`,
      [agent.id]
    );

    if (parseInt(activeCalls.rows[0].count) >= 10) {
      throw new AppError(429, 'Rate limit exceeded. Maximum 10 concurrent calls.', 'RATE_LIMIT');
    }

    // Create call record
    const result = await query(
      `INSERT INTO calls (agent_id, direction, to_number, from_number, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, agent_id, direction, to_number, from_number, status, created_at`,
      [agent.id, 'outbound', body.to_number, '+15551234567', 'queued']
    );

    res.status(201).json({
      call_id: result.rows[0].id,
      status: result.rows[0].status,
      call: result.rows[0],
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    next(err);
  }
});

// POST /call/end/:id - End an active call
router.post('/call/end/:id', authMiddleware(query), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const callId = req.params.id;

    // Verify call belongs to agent and is active
    const callResult = await query(
      `SELECT id, status FROM calls WHERE id = $1 AND agent_id = $2`,
      [callId, agent.id]
    );

    if (callResult.rows.length === 0) {
      throw new AppError(404, 'Call not found', 'CALL_NOT_FOUND');
    }

    const call = callResult.rows[0];
    if (!['queued', 'ringing', 'in_progress'].includes(call.status)) {
      throw new AppError(400, 'Call is not active', 'CALL_NOT_ACTIVE');
    }

    // Update call status
    const result = await query(
      `UPDATE calls SET status = $1, ended_at = NOW() WHERE id = $2
       RETURNING id, status, ended_at`,
      ['cancelled', callId]
    );

    res.json({
      message: 'Call ended',
      call: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
});

// GET /calls - Get call history (paginated)
router.get('/calls', authMiddleware(query), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as string;

    let queryStr = `SELECT id, direction, to_number, from_number, status, duration_seconds, cost_cents, created_at, ended_at
                    FROM calls
                    WHERE agent_id = $1`;
    const params: any[] = [agent.id];

    if (status) {
      queryStr += ` AND status = $${params.length + 1}`;
      params.push(status);
    }

    queryStr += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(queryStr, params);

    // Get total count
    let countQuery = `SELECT COUNT(*) as total FROM calls WHERE agent_id = $1`;
    const countParams: any[] = [agent.id];
    if (status) {
      countQuery += ` AND status = $2`;
      countParams.push(status);
    }

    const countResult = await query(countQuery, countParams);

    res.json({
      calls: result.rows,
      pagination: {
        limit,
        offset,
        total: parseInt(countResult.rows[0].total),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /calls/:id - Get call details
router.get('/calls/:id', authMiddleware(query), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const callId = req.params.id;

    const result = await query(
      `SELECT id, direction, to_number, from_number, status, duration_seconds, cost_cents, vapi_call_id, created_at, ended_at
       FROM calls
       WHERE id = $1 AND agent_id = $2`,
      [callId, agent.id]
    );

    if (result.rows.length === 0) {
      throw new AppError(404, 'Call not found', 'CALL_NOT_FOUND');
    }

    res.json({ call: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// GET /calls/stats - Get aggregate stats
router.get('/calls/stats', authMiddleware(query), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;

    const result = await query(
      `SELECT
        COUNT(*) as total_calls,
        COALESCE(SUM(duration_seconds), 0) as total_duration,
        COALESCE(SUM(cost_cents), 0) as total_cost
       FROM calls
       WHERE agent_id = $1`,
      [agent.id]
    );

    res.json({
      stats: {
        total_calls: parseInt(result.rows[0].total_calls),
        total_duration: parseInt(result.rows[0].total_duration),
        total_cost: parseInt(result.rows[0].total_cost),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
