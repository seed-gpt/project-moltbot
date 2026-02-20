import express, { Request, Response, NextFunction } from 'express';
import { getDb } from '@moltbot/shared';
import { count, sum, eq, sql } from 'drizzle-orm';
import { agents, transactions, escrows } from '../db/schema.js';

const router = express.Router();

// GET /leaderboard
router.get('/leaderboard', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const db = getDb();
    // Complex aggregation query — use sql template for flexibility
    const result = await db.execute(sql`
      SELECT a.id, a.handle, a.name,
        COALESCE(SUM(t.amount), 0) as total_volume,
        COUNT(t.id) as transaction_count
      FROM agents a
      LEFT JOIN transactions t ON (t.from_agent_id = a.id OR t.to_agent_id = a.id)
      GROUP BY a.id, a.handle, a.name
      ORDER BY total_volume DESC
      LIMIT 50
    `);

    res.json({
      leaderboard: (result as any).rows.map((row: any, index: number) => ({
        rank: index + 1, agent_id: row.id, handle: row.handle, name: row.name,
        total_volume: parseInt(row.total_volume), transaction_count: parseInt(row.transaction_count),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /stats
router.get('/stats', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const db = getDb();

    const [{ totalAgents }] = await db.select({ totalAgents: count() }).from(agents);
    const [{ totalVolume }] = await db.select({ totalVolume: sum(transactions.amount) }).from(transactions);
    const [{ totalEscrows }] = await db.select({ totalEscrows: count() }).from(escrows);
    const [{ activeEscrows }] = await db.select({ activeEscrows: count() }).from(escrows).where(eq(escrows.status, 'active'));
    const [{ escrowValue }] = await db.select({ escrowValue: sum(escrows.amount) }).from(escrows).where(eq(escrows.status, 'active'));

    res.json({
      total_agents: totalAgents,
      total_transaction_volume: parseInt(String(totalVolume || 0)),
      total_escrows: totalEscrows,
      active_escrows: activeEscrows,
      total_escrow_value: parseInt(String(escrowValue || 0)),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
