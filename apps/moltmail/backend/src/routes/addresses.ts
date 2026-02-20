import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getDb, authMiddleware, AppError } from '@moltbot/shared';
import { eq, desc } from 'drizzle-orm';
import { emailAddresses } from '../db/schema.js';

const router = express.Router();

const addAddressSchema = z.object({
  address: z.string().email().refine(
    (email) => email.endsWith('@agentmail.xyz'),
    { message: 'Email must be an @agentmail.xyz address' }
  ),
});

// GET /addresses
router.get('/addresses', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const db = getDb();
    const result = await db.select().from(emailAddresses).where(eq(emailAddresses.agentId, agent.id)).orderBy(desc(emailAddresses.createdAt));
    res.json({ addresses: result });
  } catch (err) { next(err); }
});

// POST /addresses/add
router.post('/addresses/add', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const body = addAddressSchema.parse(req.body);
    const db = getDb();

    const existing = await db.select({ id: emailAddresses.id }).from(emailAddresses).where(eq(emailAddresses.address, body.address));
    if (existing.length > 0) throw new AppError(409, 'Email address already exists', 'ADDRESS_EXISTS');

    const [addr] = await db.insert(emailAddresses).values({ agentId: agent.id, address: body.address, verified: true }).returning();
    res.status(201).json({ address: addr, message: `Email address ${body.address} added successfully` });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
    next(err);
  }
});

export default router;
