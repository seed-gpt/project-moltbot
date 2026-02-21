import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getDb, authMiddleware, AppError } from '@moltbot/shared';
import { eq, desc, count, sql } from 'drizzle-orm';
import { tokenBalances, tokenPurchases } from '../db/schema.js';

const router = express.Router();

// Token packages
const PACKAGES: Record<string, { name: string; tokens: number; priceCents: number }> = {
    starter: { name: 'Starter', tokens: 100, priceCents: 1000 },
    pro: { name: 'Pro', tokens: 500, priceCents: 4000 },
    enterprise: { name: 'Enterprise', tokens: 2000, priceCents: 12000 },
};

const purchaseSchema = z.object({
    package: z.enum(['starter', 'pro', 'enterprise']),
});

// GET /tokens/balance - Get current token balance
router.get('/tokens/balance', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const agent = (req as any).agent;
        const db = getDb();

        const result = await db.select({ balance: tokenBalances.balance, updatedAt: tokenBalances.updatedAt })
            .from(tokenBalances).where(eq(tokenBalances.agentId, agent.id));

        if (result.length === 0) {
            // Auto-create if missing
            await db.insert(tokenBalances).values({ agentId: agent.id, balance: 0 });
            res.json({ balance: 0, packages: PACKAGES });
            return;
        }

        res.json({ balance: result[0].balance, updated_at: result[0].updatedAt, packages: PACKAGES });
    } catch (err) { next(err); }
});

// POST /tokens/purchase - Buy a token package
router.post('/tokens/purchase', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const agent = (req as any).agent;
        const body = purchaseSchema.parse(req.body);
        const pkg = PACKAGES[body.package];
        const db = getDb();

        // Credit tokens
        const updated = await db.update(tokenBalances)
            .set({
                balance: sql`${tokenBalances.balance} + ${pkg.tokens}`,
                updatedAt: new Date(),
            })
            .where(eq(tokenBalances.agentId, agent.id))
            .returning({ balance: tokenBalances.balance });

        if (updated.length === 0) {
            // Auto-create + credit
            await db.insert(tokenBalances).values({ agentId: agent.id, balance: pkg.tokens });
        }

        // Record purchase
        const [purchase] = await db.insert(tokenPurchases).values({
            agentId: agent.id,
            packageName: pkg.name,
            tokenAmount: pkg.tokens,
            priceCents: pkg.priceCents,
        }).returning();

        const newBalance = updated.length > 0 ? updated[0].balance : pkg.tokens;

        res.status(201).json({
            success: true,
            purchase: {
                id: purchase.id,
                package: pkg.name,
                tokens_added: pkg.tokens,
                price_cents: pkg.priceCents,
            },
            new_balance: newBalance,
        });
    } catch (err) {
        if (err instanceof z.ZodError) {
            res.status(400).json({ error: 'Validation failed', details: err.errors });
            return;
        }
        next(err);
    }
});

// GET /tokens/history - Paginated purchase history
router.get('/tokens/history', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const agent = (req as any).agent;
        const page = parseInt(req.query.page as string) || 1;
        const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
        const offset = (page - 1) * limit;
        const db = getDb();

        const purchases = await db.select().from(tokenPurchases)
            .where(eq(tokenPurchases.agentId, agent.id))
            .orderBy(desc(tokenPurchases.createdAt))
            .limit(limit).offset(offset);

        const [{ total }] = await db.select({ total: count() }).from(tokenPurchases)
            .where(eq(tokenPurchases.agentId, agent.id));

        res.json({
            purchases,
            pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
        });
    } catch (err) { next(err); }
});

export default router;
