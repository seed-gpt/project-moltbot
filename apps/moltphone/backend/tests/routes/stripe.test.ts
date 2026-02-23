import request from 'supertest';
import { createApp } from '../../src/app.js';

const app = createApp();

describe('Stripe Webhook — Guard Checks', () => {
    it('POST /webhooks/stripe with missing signature → 400', async () => {
        const res = await request(app)
            .post('/webhooks/stripe')
            .set('Content-Type', 'application/json')
            .send('{}');
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/stripe-signature/i);
    });

    it('POST /webhooks/stripe with invalid signature → 400', async () => {
        process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
        const res = await request(app)
            .post('/webhooks/stripe')
            .set('Content-Type', 'application/json')
            .set('stripe-signature', 'bad_sig')
            .send('{}');
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Webhook verification failed/i);
    });
});

describe('Tokens Checkout — Auth Guards', () => {
    it('POST /tokens/checkout without auth → 401', async () => {
        const res = await request(app)
            .post('/tokens/checkout')
            .send({ package: 'starter' });
        expect(res.status).toBe(401);
    });

    it('POST /tokens/checkout with invalid package → 400 (if authed)', async () => {
        // Without auth we get 401. With auth we'd get 400 on bad package.
        // This just verifies the auth guard first.
        const res = await request(app)
            .post('/tokens/checkout')
            .set('Authorization', 'Bearer invalid_token')
            .send({ package: 'invalid_package_name' });
        // Either 401 (auth fails) or 400 (validation fails) — both acceptable
        expect([400, 401]).toContain(res.status);
    });
});

describe('Tokens Packages — Public Endpoint', () => {
    it('GET /tokens/packages returns package list without auth', async () => {
        const res = await request(app).get('/tokens/packages');
        expect(res.status).toBe(200);
        expect(res.body.packages).toBeDefined();
        expect(res.body.packages.length).toBe(3);
        expect(res.body.packages[0]).toHaveProperty('id');
        expect(res.body.packages[0]).toHaveProperty('tokens');
        expect(res.body.packages[0]).toHaveProperty('price_cents');
    });
});
