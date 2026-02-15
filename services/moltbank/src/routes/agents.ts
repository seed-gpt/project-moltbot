import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query, generateApiKey, hashApiKey, authMiddleware, AppError } from '@moltbot/shared';

const router = express.Router();

const registerSchema = z.object({
  handle: z.string()
    .min(3, 'Handle must be at least 3 characters')
    .max(32, 'Handle must be at most 32 characters')
    .regex(/^[a-zA-Z0-9-]+$/, 'Handle must contain only alphanumeric characters and hyphens'),
  name: z.string().min(1, 'Name is required'),
  metadata: z.record(z.unknown()).optional(),
});

// POST /register - Register a new agent
router.post('/register', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const body = registerSchema.parse(req.body);

    // Check if handle is unique
    const existingAgent = await query(
      'SELECT id FROM agents WHERE handle = $1',
      [body.handle]
    );

    if (existingAgent.rows.length > 0) {
      throw new AppError(409, 'Handle already exists', 'HANDLE_EXISTS');
    }

    // Generate API key
    const apiKey = generateApiKey('moltbank');
    const apiKeyHash = hashApiKey(apiKey);

    // Insert agent
    const agentResult = await query(
      `INSERT INTO agents (handle, name, api_key_hash, metadata)
       VALUES ($1, $2, $3, $4)
       RETURNING id, handle, name, created_at`,
      [body.handle, body.name, apiKeyHash, body.metadata ? JSON.stringify(body.metadata) : null]
    );

    const agent = agentResult.rows[0];

    // Create wallet for the agent
    await query(
      'INSERT INTO wallets (agent_id, balance, currency) VALUES ($1, $2, $3)',
      [agent.id, 0, 'USD']
    );

    res.status(201).json({
      agent: {
        id: agent.id,
        handle: agent.handle,
        name: agent.name,
        created_at: agent.created_at,
      },
      api_key: apiKey,
      message: 'Store this API key securely - it will not be shown again',
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    next(err);
  }
});

// GET /me - Get current agent profile
router.get('/me', authMiddleware(query), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;

    const result = await query(
      'SELECT id, handle, name, metadata, created_at FROM agents WHERE id = $1',
      [agent.id]
    );

    if (result.rows.length === 0) {
      throw new AppError(404, 'Agent not found');
    }

    const agentData = result.rows[0];
    res.json({
      id: agentData.id,
      handle: agentData.handle,
      name: agentData.name,
      metadata: agentData.metadata,
      created_at: agentData.created_at,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
