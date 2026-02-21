import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getFirestore, authMiddleware, AppError } from '@moltbot/shared';

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
    const db = getFirestore();
    const snapshot = await db.collection('emailAddresses').where('agentId', '==', agent.id).orderBy('createdAt', 'desc').get();
    const addresses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ addresses });
  } catch (err) { next(err); }
});

// POST /addresses/add
router.post('/addresses/add', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const body = addAddressSchema.parse(req.body);
    const db = getFirestore();

    const existing = await db.collection('emailAddresses').where('address', '==', body.address).limit(1).get();
    if (!existing.empty) throw new AppError(409, 'Email address already exists', 'ADDRESS_EXISTS');

    const ref = await db.collection('emailAddresses').add({
      agentId: agent.id, address: body.address, verified: true, createdAt: new Date().toISOString(),
    });

    res.status(201).json({
      address: { id: ref.id, agentId: agent.id, address: body.address, verified: true },
      message: `Email address ${body.address} added successfully`,
    });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
    next(err);
  }
});

export default router;
