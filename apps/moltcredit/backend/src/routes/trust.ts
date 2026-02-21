import express, { Request, Response, NextFunction } from 'express';
import { getFirestore } from '@moltbot/shared';

const router = express.Router();

// GET /trust/:handle
router.get('/trust/:handle', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { handle } = req.params;
        const db = getFirestore();

        const agentSnap = await db.collection('agents').where('handle', '==', handle).limit(1).get();
        if (agentSnap.empty) { res.status(404).json({ error: 'Agent not found' }); return; }
        const agentDoc = agentSnap.docs[0];
        const agent = agentDoc.data();

        const creditCount = (await db.collection('creditLines').where('granteeId', '==', agentDoc.id).count().get()).data().count;

        const txSnap = await db.collection('creditTransactions').get();
        // Filter transactions for credit lines where this agent is grantee
        const clSnap = await db.collection('creditLines').where('granteeId', '==', agentDoc.id).get();
        const clIds = new Set(clSnap.docs.map(d => d.id));

        let totalDraws = 0, totalRepays = 0, totalDrawAmount = 0, totalRepayAmount = 0;
        txSnap.docs.forEach(doc => {
            const d = doc.data();
            if (!clIds.has(d.creditLineId)) return;
            if (d.type === 'draw') { totalDraws++; totalDrawAmount += d.amount || 0; }
            if (d.type === 'repay') { totalRepays++; totalRepayAmount += d.amount || 0; }
        });

        const monthsActive = Math.max(1, Math.floor((Date.now() - new Date(agent.createdAt).getTime()) / (30 * 24 * 60 * 60 * 1000)));
        const repaymentRate = totalDraws > 0 ? (totalRepays / totalDraws) * 40 : 0;
        const creditScore = Math.min(creditCount * 20, 20);
        const ageScore = Math.min(monthsActive * 5, 40);
        const trustScore = Math.min(Math.round(repaymentRate + creditScore + ageScore), 100);

        res.json({
            handle: agent.handle, name: agent.name, trust_score: trustScore,
            breakdown: { repayment_rate: Math.round(repaymentRate), credit_network: creditScore, account_age: ageScore },
            summary: {
                credit_lines_received: creditCount, total_draws: totalDraws, total_repayments: totalRepays,
                total_draw_amount: totalDrawAmount, total_repay_amount: totalRepayAmount, months_active: monthsActive
            },
        });
    } catch (err) { next(err); }
});

// GET /stats
router.get('/stats', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const db = getFirestore();
        const totalAgents = (await db.collection('agents').count().get()).data().count;
        const clSnap = await db.collection('creditLines').where('status', '==', 'active').get();
        let totalLimit = 0, totalUsed = 0;
        clSnap.docs.forEach(doc => { const d = doc.data(); totalLimit += d.limitAmount || 0; totalUsed += d.usedAmount || 0; });

        const txSnap = await db.collection('creditTransactions').get();
        let totalVolume = 0;
        txSnap.docs.forEach(doc => { totalVolume += doc.data().amount || 0; });

        res.json({
            total_agents: totalAgents, active_credit_lines: clSnap.size,
            total_credit_limit: totalLimit, total_credit_used: totalUsed,
            total_transactions: txSnap.size, total_volume: totalVolume,
        });
    } catch (err) { next(err); }
});

export default router;
