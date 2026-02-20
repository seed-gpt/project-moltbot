import express, { Request, Response, NextFunction } from 'express';
import { getDb } from '@moltbot/shared';
import { eq, desc, count, sql } from 'drizzle-orm';
import { agents, wallets } from '../db/schema.js';

const router = express.Router();

// GET /directory - Paginated list of agents
router.get('/directory', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;
    const db = getDb();

    // Complex query with subqueries for services detection - use sql template
    const result = await db.execute(sql`
      SELECT a.handle,
        ARRAY_REMOVE(ARRAY[
          CASE WHEN EXISTS(SELECT 1 FROM wallets w WHERE w.agent_id = a.id) THEN 'moltbank' END,
          CASE WHEN EXISTS(SELECT 1 FROM email_addresses e WHERE e.agent_id = a.id) THEN 'moltmail' END,
          CASE WHEN EXISTS(SELECT 1 FROM credit_lines c WHERE c.grantor_id = a.id OR c.grantee_id = a.id) THEN 'moltcredit' END,
          CASE WHEN EXISTS(SELECT 1 FROM calls ca WHERE ca.agent_id = a.id) THEN 'moltphone' END
        ], NULL) as services
      FROM agents a ORDER BY a.created_at DESC LIMIT ${limit} OFFSET ${offset}
    `);

    const [{ total }] = await db.select({ total: count() }).from(agents);

    res.json({
      agents: (result as any).rows.map((row: any) => ({ handle: row.handle, services: row.services || [] })),
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

// GET /directory/:handle - Single agent profile
router.get('/directory/:handle', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { handle } = req.params;
    const db = getDb();

    const result = await db.execute(sql`
      SELECT a.handle, a.name, a.created_at, w.balance,
        ARRAY_REMOVE(ARRAY[
          CASE WHEN EXISTS(SELECT 1 FROM wallets w2 WHERE w2.agent_id = a.id) THEN 'moltbank' END,
          CASE WHEN EXISTS(SELECT 1 FROM email_addresses e WHERE e.agent_id = a.id) THEN 'moltmail' END,
          CASE WHEN EXISTS(SELECT 1 FROM credit_lines c WHERE c.grantor_id = a.id OR c.grantee_id = a.id) THEN 'moltcredit' END,
          CASE WHEN EXISTS(SELECT 1 FROM calls ca WHERE ca.agent_id = a.id) THEN 'moltphone' END
        ], NULL) as services
      FROM agents a LEFT JOIN wallets w ON w.agent_id = a.id WHERE a.handle = ${handle}
    `);

    const rows = (result as any).rows;
    if (rows.length === 0) { res.status(404).json({ error: 'Agent not found' }); return; }

    const agent = rows[0];
    let walletBalanceTier = 'none';
    if (agent.balance !== null) {
      if (agent.balance >= 10000) walletBalanceTier = 'high';
      else if (agent.balance >= 1000) walletBalanceTier = 'medium';
      else if (agent.balance > 0) walletBalanceTier = 'low';
    }

    res.json({ handle: agent.handle, name: agent.name, services: agent.services || [], wallet_balance_tier: walletBalanceTier, created_at: agent.created_at });
  } catch (err) {
    next(err);
  }
});

export default router;
