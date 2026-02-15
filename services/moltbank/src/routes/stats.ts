import express, { Request, Response, NextFunction } from 'express';
import { query } from '@moltbot/shared';

const router = express.Router();

// GET /leaderboard - Get top agents by transaction volume
router.get('/leaderboard', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const leaderboardResult = await query(
      `SELECT
         a.id,
         a.handle,
         a.name,
         COALESCE(SUM(CASE
           WHEN t.from_agent_id = a.id THEN t.amount
           WHEN t.to_agent_id = a.id THEN t.amount
           ELSE 0
         END), 0) as total_volume,
         COUNT(t.id) as transaction_count
       FROM agents a
       LEFT JOIN transactions t ON (t.from_agent_id = a.id OR t.to_agent_id = a.id)
       GROUP BY a.id, a.handle, a.name
       HAVING COUNT(t.id) > 0
       ORDER BY total_volume DESC
       LIMIT 50`,
      []
    );

    res.json({
      leaderboard: leaderboardResult.rows.map((row, index) => ({
        rank: index + 1,
        agent_id: row.id,
        handle: row.handle,
        name: row.name,
        total_volume: parseInt(row.total_volume),
        transaction_count: parseInt(row.transaction_count),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /stats - Get platform statistics
router.get('/stats', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Get total agents count
    const agentsResult = await query('SELECT COUNT(*) as total FROM agents', []);
    const totalAgents = parseInt(agentsResult.rows[0].total);

    // Get total transaction volume
    const volumeResult = await query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM transactions',
      []
    );
    const totalVolume = parseInt(volumeResult.rows[0].total);

    // Get total escrows count
    const escrowsResult = await query('SELECT COUNT(*) as total FROM escrows', []);
    const totalEscrows = parseInt(escrowsResult.rows[0].total);

    // Get active escrows count
    const activeEscrowsResult = await query(
      "SELECT COUNT(*) as total FROM escrows WHERE status = 'active'",
      []
    );
    const activeEscrows = parseInt(activeEscrowsResult.rows[0].total);

    // Get total escrow value (active only)
    const escrowValueResult = await query(
      "SELECT COALESCE(SUM(amount), 0) as total FROM escrows WHERE status = 'active'",
      []
    );
    const totalEscrowValue = parseInt(escrowValueResult.rows[0].total);

    res.json({
      total_agents: totalAgents,
      total_transaction_volume: totalVolume,
      total_escrows: totalEscrows,
      active_escrows: activeEscrows,
      total_escrow_value: totalEscrowValue,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
