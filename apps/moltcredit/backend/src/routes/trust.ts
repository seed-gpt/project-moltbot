import express, { Request, Response, NextFunction } from 'express';
import { getDb } from '@moltbot/shared';
import { eq, count, sum, sql } from 'drizzle-orm';
import { agents, creditLines, creditTransactions } from '../db/schema.js';

const router = express.Router();

// GET /trust/:handle
router.get('/trust/:handle', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { handle } = req.params;
        const db = getDb();

        const agentResult = await db.select({ id: agents.id, handle: agents.handle, name: agents.name, createdAt: agents.createdAt })
            .from(agents).where(eq(agents.handle, handle));
        if (agentResult.length === 0) { res.status(404).json({ error: 'Agent not found' }); return; }
        const agent = agentResult[0];

        const [{ creditCount }] = await db.select({ creditCount: count() }).from(creditLines)
            .where(eq(creditLines.granteeId, agent.id));

        const stats = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE ct.type = 'draw') as total_draws,
        COUNT(*) FILTER (WHERE ct.type = 'repay') as total_repays,
        COALESCE(SUM(ct.amount) FILTER (WHERE ct.type = 'draw'), 0) as total_draw_amount,
        COALESCE(SUM(ct.amount) FILTER (WHERE ct.type = 'repay'), 0) as total_repay_amount
      FROM credit_transactions ct
      JOIN credit_lines cl ON ct.credit_line_id = cl.id
      WHERE cl.grantee_id = ${agent.id}
    `);

        const s = (stats as any).rows[0];
        const totalDraws = parseInt(s.total_draws) || 0;
        const totalRepays = parseInt(s.total_repays) || 0;
        const monthsActive = Math.max(1, Math.floor((Date.now() - new Date(agent.createdAt!).getTime()) / (30 * 24 * 60 * 60 * 1000)));

        const repaymentRate = totalDraws > 0 ? (totalRepays / totalDraws) * 40 : 0;
        const creditScore = Math.min(creditCount * 20, 20);
        const ageScore = Math.min(monthsActive * 5, 40);
        const trustScore = Math.min(Math.round(repaymentRate + creditScore + ageScore), 100);

        res.json({
            handle: agent.handle, name: agent.name, trust_score: trustScore,
            breakdown: { repayment_rate: Math.round(repaymentRate), credit_network: creditScore, account_age: ageScore },
            summary: {
                credit_lines_received: creditCount, total_draws: totalDraws, total_repayments: totalRepays,
                total_draw_amount: parseInt(s.total_draw_amount), total_repay_amount: parseInt(s.total_repay_amount), months_active: monthsActive
            },
        });
    } catch (err) { next(err); }
});

// GET /stats
router.get('/stats', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const db = getDb();
        const [{ totalAgents }] = await db.select({ totalAgents: count() }).from(agents);
        const [lineStats] = await db.select({
            total: count(), totalLimit: sum(creditLines.limitAmount), totalUsed: sum(creditLines.usedAmount),
        }).from(creditLines).where(eq(creditLines.status, 'active'));
        const [txStats] = await db.select({ total: count(), totalVolume: sum(creditTransactions.amount) }).from(creditTransactions);

        res.json({
            total_agents: totalAgents,
            active_credit_lines: lineStats.total,
            total_credit_limit: parseInt(String(lineStats.totalLimit || 0)),
            total_credit_used: parseInt(String(lineStats.totalUsed || 0)),
            total_transactions: txStats.total,
            total_volume: parseInt(String(txStats.totalVolume || 0)),
        });
    } catch (err) { next(err); }
});

export default router;
