import express, { Request, Response, NextFunction } from 'express';
import { query } from '@moltbot/shared';

const router = express.Router();

// GET /trust/:handle - Get trust score for an agent (public)
router.get('/trust/:handle', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { handle } = req.params;

        // Get agent
        const agentResult = await query('SELECT id, handle, name, created_at FROM agents WHERE handle = $1', [handle]);
        if (agentResult.rows.length === 0) {
            res.status(404).json({ error: 'Agent not found' });
            return;
        }

        const agent = agentResult.rows[0];

        // Get credit lines received (as grantee)
        const creditReceived = await query(
            'SELECT COUNT(*) as count FROM credit_lines WHERE grantee_id = $1 AND status = $2',
            [agent.id, 'active']
        );

        // Get total draws and repayments
        const drawStats = await query(
            `SELECT 
         COUNT(*) FILTER (WHERE ct.type = 'draw') as total_draws,
         COUNT(*) FILTER (WHERE ct.type = 'repay') as total_repays,
         COALESCE(SUM(ct.amount) FILTER (WHERE ct.type = 'draw'), 0) as total_draw_amount,
         COALESCE(SUM(ct.amount) FILTER (WHERE ct.type = 'repay'), 0) as total_repay_amount
       FROM credit_transactions ct
       JOIN credit_lines cl ON ct.credit_line_id = cl.id
       WHERE cl.grantee_id = $1`,
            [agent.id]
        );

        const stats = drawStats.rows[0];
        const totalDraws = parseInt(stats.total_draws) || 0;
        const totalRepays = parseInt(stats.total_repays) || 0;
        const creditCount = parseInt(creditReceived.rows[0].count) || 0;

        // Calculate months active
        const createdAt = new Date(agent.created_at);
        const monthsActive = Math.max(1, Math.floor((Date.now() - createdAt.getTime()) / (30 * 24 * 60 * 60 * 1000)));

        // Trust score formula:
        // repayment_rate (0-40) + credit_received_count (0-20) + age (0-40) = 0-100
        const repaymentRate = totalDraws > 0 ? (totalRepays / totalDraws) * 40 : 0;
        const creditScore = Math.min(creditCount * 20, 20);
        const ageScore = Math.min(monthsActive * 5, 40);
        const trustScore = Math.round(repaymentRate + creditScore + ageScore);

        res.json({
            handle: agent.handle,
            name: agent.name,
            trust_score: Math.min(trustScore, 100),
            breakdown: {
                repayment_rate: Math.round(repaymentRate),
                credit_network: creditScore,
                account_age: ageScore,
            },
            summary: {
                credit_lines_received: creditCount,
                total_draws: totalDraws,
                total_repayments: totalRepays,
                total_draw_amount: parseInt(stats.total_draw_amount),
                total_repay_amount: parseInt(stats.total_repay_amount),
                months_active: monthsActive,
            },
        });
    } catch (err) {
        next(err);
    }
});

// GET /stats - Global credit network stats (public)
router.get('/stats', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const agentsResult = await query('SELECT COUNT(*) as total FROM agents');
        const linesResult = await query('SELECT COUNT(*) as total, COALESCE(SUM(limit_amount), 0) as total_limit, COALESCE(SUM(used_amount), 0) as total_used FROM credit_lines WHERE status = $1', ['active']);
        const txResult = await query('SELECT COUNT(*) as total, COALESCE(SUM(amount), 0) as total_volume FROM credit_transactions');

        res.json({
            total_agents: parseInt(agentsResult.rows[0].total),
            active_credit_lines: parseInt(linesResult.rows[0].total),
            total_credit_limit: parseInt(linesResult.rows[0].total_limit),
            total_credit_used: parseInt(linesResult.rows[0].total_used),
            total_transactions: parseInt(txResult.rows[0].total),
            total_volume: parseInt(txResult.rows[0].total_volume),
        });
    } catch (err) {
        next(err);
    }
});

export default router;
