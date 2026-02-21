import express, { Request, Response, NextFunction } from 'express';
import { getFirestore } from '@moltbot/shared';

const router = express.Router();

// GET /leaderboard
router.get('/leaderboard', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const db = getFirestore();

    const agentsSnap = await db.collection('agents').get();
    const leaderboard: any[] = [];

    for (const agentDoc of agentsSnap.docs) {
      const agent = agentDoc.data();
      const txSnap = await db.collection('transactions')
        .where('participants', 'array-contains', agentDoc.id).get();
      let totalVolume = 0;
      txSnap.docs.forEach(doc => { totalVolume += doc.data().amount || 0; });

      leaderboard.push({
        agent_id: agentDoc.id, handle: agent.handle, name: agent.name,
        total_volume: totalVolume, transaction_count: txSnap.size,
      });
    }

    leaderboard.sort((a, b) => b.total_volume - a.total_volume);
    const top50 = leaderboard.slice(0, 50).map((item, index) => ({ rank: index + 1, ...item }));

    res.json({ leaderboard: top50 });
  } catch (err) { next(err); }
});

// GET /stats
router.get('/stats', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const db = getFirestore();

    const totalAgents = (await db.collection('agents').count().get()).data().count;
    const txSnap = await db.collection('transactions').get();
    let totalVolume = 0;
    txSnap.docs.forEach(doc => { totalVolume += doc.data().amount || 0; });

    const escrowSnap = await db.collection('escrows').get();
    let activeEscrows = 0, escrowValue = 0;
    escrowSnap.docs.forEach(doc => {
      const d = doc.data();
      if (d.status === 'active') { activeEscrows++; escrowValue += d.amount || 0; }
    });

    res.json({
      total_agents: totalAgents,
      total_transaction_volume: totalVolume,
      total_escrows: escrowSnap.size,
      active_escrows: activeEscrows,
      total_escrow_value: escrowValue,
    });
  } catch (err) { next(err); }
});

export default router;
