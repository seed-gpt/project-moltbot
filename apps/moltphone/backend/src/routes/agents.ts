import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getDb, generateApiKey, hashApiKey, authMiddleware, AppError } from '@moltbot/shared';
import { eq } from 'drizzle-orm';
import { agents, tokenBalances } from '../db/schema.js';

const router = express.Router();

const registerSchema = z.object({
    handle: z.string()
        .min(3, 'Handle must be at least 3 characters')
        .max(32, 'Handle must be at most 32 characters')
        .regex(/^[a-zA-Z0-9-]+$/, 'Handle must contain only alphanumeric characters and hyphens'),
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Valid email is required'),
    metadata: z.record(z.unknown()).optional(),
});

// POST /register - Register a new agent
router.post('/register', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const body = registerSchema.parse(req.body);
        const db = getDb();

        const existing = await db.select({ id: agents.id }).from(agents).where(eq(agents.handle, body.handle));
        if (existing.length > 0) {
            throw new AppError(409, 'Handle already exists', 'HANDLE_EXISTS');
        }

        const apiKey = generateApiKey('moltphone');
        const apiKeyHash = hashApiKey(apiKey);

        const [agent] = await db.insert(agents).values({
            handle: body.handle,
            name: body.name,
            apiKeyHash,
            metadata: { email: body.email, ...(body.metadata || {}) },
        }).returning({ id: agents.id, handle: agents.handle, name: agents.name, createdAt: agents.createdAt });

        // Auto-create token balance for the new agent
        await db.insert(tokenBalances).values({ agentId: agent.id, balance: 0 });

        res.status(201).json({
            agent: { id: agent.id, handle: agent.handle, name: agent.name, created_at: agent.createdAt },
            api_key: apiKey,
            message: 'Store this API key securely — it will not be shown again.',
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
router.get('/me', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const agent = (req as any).agent;
        const db = getDb();

        const result = await db.select({
            id: agents.id, handle: agents.handle, name: agents.name, metadata: agents.metadata, createdAt: agents.createdAt,
        }).from(agents).where(eq(agents.id, agent.id));

        if (result.length === 0) throw new AppError(404, 'Agent not found');

        const a = result[0];
        res.json({ id: a.id, handle: a.handle, name: a.name, email: (a.metadata as any)?.email || '', created_at: a.createdAt });
    } catch (err) {
        next(err);
    }
});

// POST /rotate-key - Rotate API key
router.post('/rotate-key', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const agent = (req as any).agent;
        const db = getDb();

        const newApiKey = generateApiKey('moltphone');
        const newApiKeyHash = hashApiKey(newApiKey);

        const current = await db.select({ apiKeyHash: agents.apiKeyHash }).from(agents).where(eq(agents.id, agent.id));
        if (current.length === 0) throw new AppError(404, 'Agent not found');

        await db.update(agents).set({ apiKeyHash: newApiKeyHash }).where(eq(agents.id, agent.id));

        res.json({
            api_key: newApiKey,
            message: 'API key rotated successfully. Store this key securely — it will not be shown again.',
        });
    } catch (err) {
        next(err);
    }
});

export default router;
