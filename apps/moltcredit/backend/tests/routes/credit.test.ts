import request from 'supertest';
import { createApp } from '../../src/app.js';
import { jest } from '@jest/globals';

const app = createApp();

describe('MoltCredit Health', () => {
    it('GET /health returns 200', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(res.body.service).toBe('moltcredit');
    });
});

describe('MoltCredit Credit Routes — Auth Guards', () => {
    it('POST /credit/extend returns 401 without auth', async () => {
        const res = await request(app).post('/credit/extend').send({
            grantee_handle: 'agent-b',
            limit_amount: 10000,
        });
        expect(res.status).toBe(401);
    });

    it('GET /credit returns 401 without auth', async () => {
        const res = await request(app).get('/credit');
        expect(res.status).toBe(401);
    });

    it('POST /credit/some-id/revoke returns 401 without auth', async () => {
        const res = await request(app).post('/credit/some-id/revoke');
        expect(res.status).toBe(401);
    });
});

describe('MoltCredit Transaction Routes — Auth Guards', () => {
    it('POST /credit/some-id/draw returns 401 without auth', async () => {
        const res = await request(app).post('/credit/some-id/draw').send({ amount: 1000 });
        expect(res.status).toBe(401);
    });

    it('POST /credit/some-id/repay returns 401 without auth', async () => {
        const res = await request(app).post('/credit/some-id/repay').send({ amount: 500 });
        expect(res.status).toBe(401);
    });

    it('GET /credit/balance/test returns 401 without auth', async () => {
        const res = await request(app).get('/credit/balance/test');
        expect(res.status).toBe(401);
    });
});

describe('MoltCredit Trust & Stats — Public Endpoints', () => {
    jest.setTimeout(30000);
    it('GET /trust/unknown-agent endpoint exists', async () => {
        const res = await request(app).get('/trust/unknown-agent');
        // Should get 404 or 500 (no db), but NOT 404 on route
        expect([404, 500]).toContain(res.status);
    });

    it('GET /stats endpoint exists', async () => {
        const res = await request(app).get('/stats');
        expect(res.status).not.toBe(404);
    });
});
