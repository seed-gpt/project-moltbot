import express, { Request, Response, NextFunction } from 'express';
import { query } from '@moltbot/shared';

const router = express.Router();

// GET /leaderboard - Get top agents by transaction volume or trust score
router.get('/leaderboard', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sortParam = (req.query.sort as string) || 'volume';
    const validSorts = ['volume', 'transactions'];
    const sort = validSorts.includes(sortParam) ? sortParam : 'volume';

    // Determine ORDER BY clause
    let orderBy = 'total_volume DESC';
    if (sort === 'transactions') {
      orderBy = 'transaction_count DESC';
    }

    const leaderboardResult = await query(
      `SELECT
         a.id,
         a.handle,
         a.name,
         COALESCE(SUM(t.amount), 0) as total_volume,
         COUNT(t.id) as transaction_count,
         COALESCE(
           (SELECT COUNT(*) FROM credit_lines cl WHERE cl.grantor_id = a.id OR cl.grantee_id = a.id),
           0
         ) as credit_lines_count
       FROM agents a
       LEFT JOIN transactions t ON (t.from_agent_id = a.id OR t.to_agent_id = a.id)
       GROUP BY a.id, a.handle, a.name
       ORDER BY ${orderBy}
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
        credit_lines_count: parseInt(row.credit_lines_count),
      })),
      sort,
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
