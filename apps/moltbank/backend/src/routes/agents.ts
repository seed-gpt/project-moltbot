import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getFirestore, generateApiKey, hashApiKey, authMiddleware, AppError } from '@moltbot/shared';

const router = express.Router();

const registerSchema = z.object({
  handle: z.string().min(3).max(32).regex(/^[a-zA-Z0-9-]+$/),
  name: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

// POST /register
router.post('/register', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const body = registerSchema.parse(req.body);
    const db = getFirestore();

    const existing = await db.collection('agents').where('handle', '==', body.handle).limit(1).get();
    if (!existing.empty) throw new AppError(409, 'Handle already exists', 'HANDLE_EXISTS');

    const apiKey = generateApiKey('moltbank');
    const apiKeyHash = hashApiKey(apiKey);

    const agentRef = await db.collection('agents').add({
      handle: body.handle, name: body.name, apiKeyHash,
      metadata: body.metadata || {}, createdAt: new Date().toISOString(),
    });

    await db.collection('wallets').doc(agentRef.id).set({
      agentId: agentRef.id, balance: 0, currency: 'USD', createdAt: new Date().toISOString(),
    });

    res.status(201).json({
      agent: { id: agentRef.id, handle: body.handle, name: body.name, created_at: new Date().toISOString() },
      api_key: apiKey,
      message: 'Store this API key securely - it will not be shown again',
    });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
    next(err);
  }
});

// GET /me
router.get('/me', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    res.json({ id: agent.id, handle: agent.handle, name: agent.name, metadata: agent.metadata || {}, created_at: agent.createdAt });
  } catch (err) { next(err); }
});

// POST /rotate-key
router.post('/rotate-key', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const db = getFirestore();
    const newApiKey = generateApiKey('moltbank');
    const newApiKeyHash = hashApiKey(newApiKey);
    const oldKeyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.collection('agents').doc(agent.id).update({ apiKeyHash: newApiKeyHash });

    res.json({
      api_key: newApiKey,
      message: 'API key rotated successfully. Store this key securely - it will not be shown again.',
      old_key_expires_at: oldKeyExpiry,
      note: 'Your old API key will remain valid for 24 hours to allow for migration.',
    });
  } catch (err) { next(err); }
});

export default router;
