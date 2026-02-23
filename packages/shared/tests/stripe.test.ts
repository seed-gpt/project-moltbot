import { verifyStripeWebhook } from '../src/stripe.js';

describe('verifyStripeWebhook', () => {
    it('throws when STRIPE_WEBHOOK_SECRET is not set', () => {
        const originalSecret = process.env.STRIPE_WEBHOOK_SECRET;
        delete process.env.STRIPE_WEBHOOK_SECRET;
        expect(() => verifyStripeWebhook(Buffer.from('{}'), 'sig')).toThrow('STRIPE_WEBHOOK_SECRET not configured');
        process.env.STRIPE_WEBHOOK_SECRET = originalSecret;
    });

    it('throws on invalid signature when secret is set', () => {
        process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
        process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
        expect(() => verifyStripeWebhook(Buffer.from('{}'), 'bad-sig')).toThrow();
    });
});

describe('getStripeClient', () => {
    it('throws when STRIPE_SECRET_KEY is not set', async () => {
        const { getStripeClient } = await import('../src/stripe.js');
        const originalKey = process.env.STRIPE_SECRET_KEY;
        delete process.env.STRIPE_SECRET_KEY;
        // Reset singleton
        jest.resetModules();
        const fresh = await import('../src/stripe.js');
        expect(() => fresh.getStripeClient()).toThrow('STRIPE_SECRET_KEY not configured');
        process.env.STRIPE_SECRET_KEY = originalKey;
    });
});
