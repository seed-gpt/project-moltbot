import express, { Request, Response } from 'express';
import { verifyStripeWebhook, getFirestore } from '@moltbot/shared';
import { getLogger } from '../middleware/logger.js';

const router = express.Router();

const PACKAGE_TOKENS: Record<string, number> = {
    starter: 100,
    pro: 500,
    enterprise: 2000,
};

/**
 * POST /webhooks/stripe — public endpoint (no auth)
 * Raw body required for Stripe signature verification — mounted before json() middleware.
 */
router.post(
    '/webhooks/stripe',
    express.raw({ type: 'application/json' }),
    async (req: Request, res: Response): Promise<void> => {
        const log = getLogger('stripe-webhook');
        const sig = req.headers['stripe-signature'];

        if (!sig || typeof sig !== 'string') {
            log.warn('Missing stripe-signature header');
            res.status(400).json({ error: 'Missing stripe-signature header' });
            return;
        }

        let event;
        try {
            event = verifyStripeWebhook(req.body as Buffer, sig);
        } catch (err: any) {
            log.warn('Webhook signature verification failed', { error: err.message });
            res.status(400).json({ error: `Webhook verification failed: ${err.message}` });
            return;
        }

        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as any;
            const userId: string = session.client_reference_id || session.metadata?.userId;
            const packageName: string = session.metadata?.packageName;

            if (!userId || !packageName) {
                log.warn('checkout.session.completed missing metadata', { sessionId: session.id });
                res.json({ received: true });
                return;
            }

            const tokensToAdd = PACKAGE_TOKENS[packageName] ?? 0;

            try {
                const db = getFirestore();

                // Idempotency check — avoid double-crediting the same session
                const existingPaid = await db.collection('tokenPurchases')
                    .where('stripeSessionId', '==', session.id)
                    .where('status', '==', 'paid')
                    .limit(1).get();

                if (!existingPaid.empty) {
                    log.info('Duplicate webhook, skipping', { sessionId: session.id });
                    res.json({ received: true });
                    return;
                }

                // Credit tokens in a transaction
                await db.runTransaction(async (tx) => {
                    const balRef = db.collection('tokenBalances').doc(userId);
                    const balDoc = await tx.get(balRef);
                    const current = balDoc.exists ? (balDoc.data()?.balance || 0) : 0;
                    tx.set(balRef, { agentId: userId, balance: current + tokensToAdd, updatedAt: new Date().toISOString() }, { merge: true });
                });

                // Mark pending purchase(s) as paid
                const pendingSnap = await db.collection('tokenPurchases')
                    .where('stripeSessionId', '==', session.id)
                    .where('status', '==', 'pending')
                    .get();

                const batch = db.batch();
                pendingSnap.docs.forEach(doc => batch.update(doc.ref, { status: 'paid', paidAt: new Date().toISOString() }));
                await batch.commit();

                log.info('Tokens credited', { userId, packageName, tokensAdded: tokensToAdd, sessionId: session.id });
            } catch (err: any) {
                log.error('Failed to credit tokens', { error: err.message, sessionId: session.id });
                // Return 500 so Stripe retries
                res.status(500).json({ error: 'Internal error crediting tokens' });
                return;
            }
        }

        res.json({ received: true });
    },
);

export default router;
