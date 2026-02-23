import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getFirestore, authMiddleware, AppError, createCheckoutSession } from '@moltbot/shared';
import { getLogger, getRequestId } from '../middleware/logger.js';

const router = express.Router();

/** Price IDs provisioned via Stripe CLI */
const PACKAGES: Record<string, { tokens: number; priceCents: number; name: string; priceId: string }> = {
    starter: { tokens: 100, priceCents: 1000, name: 'Starter', priceId: process.env.STRIPE_PRICE_STARTER || 'price_1T42uYGTbAphZ7vmsoCvuTZK' },
    pro: { tokens: 500, priceCents: 4000, name: 'Pro', priceId: process.env.STRIPE_PRICE_PRO || 'price_1T42ufGTbAphZ7vm5AtNw2ID' },
    enterprise: { tokens: 2000, priceCents: 12000, name: 'Enterprise', priceId: process.env.STRIPE_PRICE_ENTERPRISE || 'price_1T42ugGTbAphZ7vmNNSTO2Yx' },
};

const checkoutSchema = z.object({
    package: z.enum(['starter', 'pro', 'enterprise']),
});

// GET /tokens/packages — public list of available packages
router.get('/tokens/packages', (_req: Request, res: Response): void => {
    res.json({
        packages: Object.entries(PACKAGES).map(([key, pkg]) => ({
            id: key,
            name: pkg.name,
            tokens: pkg.tokens,
            price_cents: pkg.priceCents,
        })),
    });
});

// GET /tokens/balance — returns current token balance for authenticated user
router.get('/tokens/balance', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const agent = (req as any).agent;
        const db = getFirestore();
        const doc = await db.collection('tokenBalances').doc(agent.id).get();
        const balance = doc.exists ? (doc.data()?.balance || 0) : 0;
        res.json({ balance, packages: Object.entries(PACKAGES).map(([key, pkg]) => ({ id: key, name: pkg.name, tokens: pkg.tokens, price_cents: pkg.priceCents })) });
    } catch (err) { next(err); }
});

// POST /tokens/checkout — creates a Stripe Checkout session and returns the URL
router.post('/tokens/checkout', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const log = getLogger('tokens');
    try {
        const agent = (req as any).agent;
        const body = checkoutSchema.parse(req.body);
        const pkg = PACKAGES[body.package];
        const db = getFirestore();

        const baseUrl = process.env.WEBAPP_BASE_URL || 'https://app.moltphone.xyz';
        const session = await createCheckoutSession({
            priceId: pkg.priceId,
            userId: agent.id,
            packageName: body.package,
            successUrl: `${baseUrl}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${baseUrl}?checkout=cancelled`,
            customerEmail: agent.email || undefined,
        });

        // Store a pending purchase record keyed by Stripe session ID
        await db.collection('tokenPurchases').add({
            agentId: agent.id,
            packageName: body.package,
            tokenAmount: pkg.tokens,
            priceCents: pkg.priceCents,
            stripeSessionId: session.id,
            status: 'pending',
            createdAt: new Date().toISOString(),
        });

        log.info('Checkout session created', { agentId: agent.id, package: body.package, sessionId: session.id, requestId: getRequestId() });
        res.status(201).json({ url: session.url, session_id: session.id });
    } catch (err) {
        if (err instanceof z.ZodError) {
            res.status(400).json({ error: 'Validation failed', details: err.errors });
            return;
        }
        next(err);
    }
});

// GET /tokens/history — purchase history for authenticated user
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
