import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query, authMiddleware, AppError } from '@moltbot/shared';

const router = express.Router();

const addAddressSchema = z.object({
  address: z.string().email().refine(
    (email) => email.endsWith('@agentmail.xyz'),
    { message: 'Email must be an @agentmail.xyz address' }
  ),
});

// GET /addresses - Get agent's email addresses
router.get('/addresses', authMiddleware(query), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;

    const result = await query(
      'SELECT id, address, verified, created_at FROM email_addresses WHERE agent_id = $1 ORDER BY created_at DESC',
      [agent.id]
    );

    res.json({ addresses: result.rows });
  } catch (err) {
    next(err);
  }
});

// POST /addresses/add - Add new email address
router.post('/addresses/add', authMiddleware(query), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const body = addAddressSchema.parse(req.body);

    // Check if address already exists
    const existing = await query(
      'SELECT id FROM email_addresses WHERE address = $1',
      [body.address]
    );

    if (existing.rows.length > 0) {
      throw new AppError(409, 'Email address already exists', 'ADDRESS_EXISTS');
    }

    // Insert new address
    const result = await query(
      `INSERT INTO email_addresses (agent_id, address, verified)
       VALUES ($1, $2, $3)
       RETURNING id, address, verified, created_at`,
      [agent.id, body.address, true] // Auto-verify for now
    );

    res.status(201).json({
      address: result.rows[0],
      message: `Email address ${body.address} added successfully`,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    next(err);
  }
});

export default router;
