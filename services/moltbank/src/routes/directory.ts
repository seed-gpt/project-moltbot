import express, { Request, Response, NextFunction } from 'express';
import { query } from '@moltbot/shared';

const router = express.Router();

// GET /directory - Paginated list of agents with services array
router.get('/directory', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;

    // Get agents with their services
    const agentsResult = await query(
      `SELECT
         a.id,
         a.handle,
         a.name,
         ARRAY_REMOVE(ARRAY[
           CASE WHEN EXISTS(SELECT 1 FROM wallets w WHERE w.agent_id = a.id) THEN 'moltbank' END,
           CASE WHEN EXISTS(SELECT 1 FROM email_addresses e WHERE e.agent_id = a.id) THEN 'moltmail' END,
           CASE WHEN EXISTS(SELECT 1 FROM credit_lines c WHERE c.grantor_id = a.id OR c.grantee_id = a.id) THEN 'moltcredit' END,
           CASE WHEN EXISTS(SELECT 1 FROM calls ca WHERE ca.agent_id = a.id) THEN 'moltphone' END
         ], NULL) as services
       FROM agents a
       ORDER BY a.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    // Get total count
    const countResult = await query('SELECT COUNT(*) as total FROM agents', []);
    const total = parseInt(countResult.rows[0].total);

    res.json({
      agents: agentsResult.rows.map((row: any) => ({
        handle: row.handle,
        services: row.services || [],
      })),
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /directory/:handle - Single agent profile
router.get('/directory/:handle', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { handle } = req.params;

    // Get agent details with services
    const agentResult = await query(
      `SELECT
         a.id,
         a.handle,
         a.name,
         a.created_at,
         w.balance,
         ARRAY_REMOVE(ARRAY[
           CASE WHEN EXISTS(SELECT 1 FROM wallets w2 WHERE w2.agent_id = a.id) THEN 'moltbank' END,
           CASE WHEN EXISTS(SELECT 1 FROM email_addresses e WHERE e.agent_id = a.id) THEN 'moltmail' END,
           CASE WHEN EXISTS(SELECT 1 FROM credit_lines c WHERE c.grantor_id = a.id OR c.grantee_id = a.id) THEN 'moltcredit' END,
           CASE WHEN EXISTS(SELECT 1 FROM calls ca WHERE ca.agent_id = a.id) THEN 'moltphone' END
         ], NULL) as services
       FROM agents a
       LEFT JOIN wallets w ON w.agent_id = a.id
       WHERE a.handle = $1`,
      [handle]
    );

    if (agentResult.rows.length === 0) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    const agent = agentResult.rows[0];

    // Determine wallet balance tier
    let walletBalanceTier = 'none';
    if (agent.balance !== null) {
      if (agent.balance >= 10000) {
        walletBalanceTier = 'high';
      } else if (agent.balance >= 1000) {
        walletBalanceTier = 'medium';
      } else if (agent.balance > 0) {
        walletBalanceTier = 'low';
      }
    }

    res.json({
      handle: agent.handle,
      name: agent.name,
      services: agent.services || [],
      wallet_balance_tier: walletBalanceTier,
      created_at: agent.created_at,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
