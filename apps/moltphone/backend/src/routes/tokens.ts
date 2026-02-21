import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getFirestore, authMiddleware, AppError } from '@moltbot/shared';

const router = express.Router();

const PACKAGES: Record<string, { tokens: number; priceCents: number; name: string }> = {
    starter: { tokens: 100, priceCents: 1000, name: 'Starter' },
    pro: { tokens: 500, priceCents: 4000, name: 'Pro' },
    enterprise: { tokens: 2000, priceCents: 12000, name: 'Enterprise' },
};

const purchaseSchema = z.object({
    package: z.enum(['starter', 'pro', 'enterprise']),
});

// GET /tokens/balance
router.get('/tokens/balance', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const agent = (req as any).agent;
        const db = getFirestore();

        const doc = await db.collection('tokenBalances').doc(agent.id).get();
        const balance = doc.exists ? (doc.data()?.balance || 0) : 0;

        res.json({
            balance,
            packages: Object.entries(PACKAGES).map(([key, pkg]) => ({
                id: key, name: pkg.name, tokens: pkg.tokens, price_cents: pkg.priceCents,
            })),
        });
    } catch (err) { next(err); }
});

// POST /tokens/purchase
router.post('/tokens/purchase', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const agent = (req as any).agent;
        const body = purchaseSchema.parse(req.body);
        const pkg = PACKAGES[body.package];
        const db = getFirestore();

        const newBalance = await db.runTransaction(async (tx) => {
            const balRef = db.collection('tokenBalances').doc(agent.id);
            const balDoc = await tx.get(balRef);
            const current = balDoc.exists ? (balDoc.data()?.balance || 0) : 0;
            const updated = current + pkg.tokens;
            tx.set(balRef, { agentId: agent.id, balance: updated, updatedAt: new Date().toISOString() }, { merge: true });
            return updated;
        });

        const purchaseRef = await db.collection('tokenPurchases').add({
            agentId: agent.id, packageName: body.package, tokenAmount: pkg.tokens,
            priceCents: pkg.priceCents, createdAt: new Date().toISOString(),
        });

        res.status(201).json({
            purchase: { id: purchaseRef.id, package: body.package, tokens_added: pkg.tokens, price_cents: pkg.priceCents },
            new_balance: newBalance,
        });
    } catch (err) {
        if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
        next(err);
    }
});

// GET /tokens/history
router.get('/tokens/history', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const agent = (req as any).agent;
        const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
        const db = getFirestore();

        const snapshot = await db.collection('tokenPurchases')
            .where('agentId', '==', agent.id)
            .orderBy('createdAt', 'desc').limit(limit).get();

        const purchases = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json({ purchases });
    } catch (err) { next(err); }
});

export default router;
