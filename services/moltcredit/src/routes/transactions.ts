import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query, authMiddleware, AppError } from '@moltbot/shared';

const router = express.Router();

const drawSchema = z.object({
    amount: z.number().int().positive('Amount must be positive'),
    memo: z.string().optional(),
});

const repaySchema = z.object({
    amount: z.number().int().positive('Amount must be positive'),
    memo: z.string().optional(),
});

// POST /credit/:id/draw - Draw against a credit line
router.post('/credit/:id/draw', authMiddleware(query), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const agent = (req as any).agent;
        const { id } = req.params;
        const body = drawSchema.parse(req.body);

        // Begin transaction
        await query('BEGIN');

        // Get credit line (only grantee can draw)
        const lineResult = await query(
            'SELECT * FROM credit_lines WHERE id = $1 AND grantee_id = $2 AND status = $3',
            [id, agent.id, 'active']
        );

        if (lineResult.rows.length === 0) {
            await query('ROLLBACK');
            throw new AppError(404, 'Credit line not found or you are not the grantee', 'CREDIT_LINE_NOT_FOUND');
        }

        const line = lineResult.rows[0];
        const available = line.limit_amount - line.used_amount;

        if (body.amount > available) {
            await query('ROLLBACK');
            throw new AppError(400, `Insufficient credit. Available: ${available}, requested: ${body.amount}`, 'INSUFFICIENT_CREDIT');
        }

        // Update used_amount
        await query(
            'UPDATE credit_lines SET used_amount = used_amount + $1, updated_at = NOW() WHERE id = $2',
            [body.amount, id]
        );

        // Create transaction record
        const txResult = await query(
            `INSERT INTO credit_transactions (credit_line_id, amount, type, memo)
       VALUES ($1, $2, $3, $4)
       RETURNING id, credit_line_id, amount, type, memo, created_at`,
            [id, body.amount, 'draw', body.memo || null]
        );

        await query('COMMIT');

        res.status(201).json({
            transaction: txResult.rows[0],
            credit_line: {
                id: line.id,
                used_amount: line.used_amount + body.amount,
                available_amount: available - body.amount,
                limit_amount: line.limit_amount,
            },
            message: `Drew ${body.amount} cents from credit line`,
        });
    } catch (err) {
        if (err instanceof z.ZodError) {
            res.status(400).json({ error: 'Validation failed', details: err.errors });
            return;
        }
        next(err);
    }
});

// POST /credit/:id/repay - Repay a credit line
router.post('/credit/:id/repay', authMiddleware(query), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const agent = (req as any).agent;
        const { id } = req.params;
        const body = repaySchema.parse(req.body);

        await query('BEGIN');

        const lineResult = await query(
            'SELECT * FROM credit_lines WHERE id = $1 AND grantee_id = $2',
            [id, agent.id]
        );

        if (lineResult.rows.length === 0) {
            await query('ROLLBACK');
            throw new AppError(404, 'Credit line not found or you are not the grantee', 'CREDIT_LINE_NOT_FOUND');
        }

        const line = lineResult.rows[0];

        if (body.amount > line.used_amount) {
            await query('ROLLBACK');
            throw new AppError(400, `Cannot repay more than owed. Owed: ${line.used_amount}, repaying: ${body.amount}`, 'OVERPAYMENT');
        }

        await query(
            'UPDATE credit_lines SET used_amount = used_amount - $1, updated_at = NOW() WHERE id = $2',
            [body.amount, id]
        );

        const txResult = await query(
            `INSERT INTO credit_transactions (credit_line_id, amount, type, memo)
       VALUES ($1, $2, $3, $4)
       RETURNING id, credit_line_id, amount, type, memo, created_at`,
            [id, body.amount, 'repay', body.memo || null]
        );

        await query('COMMIT');

        res.status(201).json({
            transaction: txResult.rows[0],
            credit_line: {
                id: line.id,
                used_amount: line.used_amount - body.amount,
                available_amount: (line.limit_amount - line.used_amount) + body.amount,
                limit_amount: line.limit_amount,
            },
            message: `Repaid ${body.amount} cents on credit line`,
        });
    } catch (err) {
        if (err instanceof z.ZodError) {
            res.status(400).json({ error: 'Validation failed', details: err.errors });
            return;
        }
        next(err);
    }
});

// GET /credit/balance/:handle - Get net balance with specific agent
router.get('/credit/balance/:handle', authMiddleware(query), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const agent = (req as any).agent;
        const { handle } = req.params;

        const otherResult = await query('SELECT id, handle FROM agents WHERE handle = $1', [handle]);
        if (otherResult.rows.length === 0) {
            throw new AppError(404, 'Agent not found', 'AGENT_NOT_FOUND');
        }

        const other = otherResult.rows[0];

        // Credit I've given to them
        const givenResult = await query(
            'SELECT COALESCE(SUM(used_amount), 0) as total FROM credit_lines WHERE grantor_id = $1 AND grantee_id = $2 AND status = $3',
            [agent.id, other.id, 'active']
        );

        // Credit I've received from them
        const receivedResult = await query(
            'SELECT COALESCE(SUM(used_amount), 0) as total FROM credit_lines WHERE grantor_id = $1 AND grantee_id = $2 AND status = $3',
            [other.id, agent.id, 'active']
        );

        res.json({
            with_agent: handle,
            credit_given_used: parseInt(givenResult.rows[0].total),
            credit_received_used: parseInt(receivedResult.rows[0].total),
            net_balance: parseInt(receivedResult.rows[0].total) - parseInt(givenResult.rows[0].total),
        });
    } catch (err) {
        next(err);
    }
});

// GET /credit/:id/transactions - Paginated transaction history for a credit line
router.get('/credit/:id/transactions', authMiddleware(query), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const agent = (req as any).agent;
        const { id } = req.params;
        const page = parseInt(req.query.page as string) || 1;
        const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
        const offset = (page - 1) * limit;

        // Verify access
        const lineResult = await query(
            'SELECT id FROM credit_lines WHERE id = $1 AND (grantor_id = $2 OR grantee_id = $2)',
            [id, agent.id]
        );

        if (lineResult.rows.length === 0) {
            throw new AppError(404, 'Credit line not found or access denied', 'CREDIT_LINE_NOT_FOUND');
        }

        const txResult = await query(
            `SELECT id, amount, type, memo, created_at
       FROM credit_transactions
       WHERE credit_line_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
            [id, limit, offset]
        );

        const countResult = await query(
            'SELECT COUNT(*) as total FROM credit_transactions WHERE credit_line_id = $1',
            [id]
        );

        res.json({
            transactions: txResult.rows,
            pagination: {
                page,
                limit,
                total: parseInt(countResult.rows[0].total),
                total_pages: Math.ceil(parseInt(countResult.rows[0].total) / limit),
            },
        });
    } catch (err) {
        next(err);
    }
});

export default router;
