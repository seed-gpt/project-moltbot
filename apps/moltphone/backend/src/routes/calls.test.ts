import request from 'supertest';
import { createApp } from '../app.js';

const app = createApp();

describe('MoltPhone Health', () => {
    it('GET /health returns 200', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(res.body.service).toBe('moltphone');
    });
});

describe('MoltPhone Agents — Auth Guards & Validation', () => {
    it('POST /register returns 400 without required fields', async () => {
        const res = await request(app).post('/register').send({ name: 'Test' });
        expect(res.status).toBe(400);
    });

    it('POST /register returns 400 with invalid handle', async () => {
        const res = await request(app).post('/register').send({ handle: 'a', name: 'Test', email: 'test@example.com' });
        expect(res.status).toBe(400);
    });

    it('POST /register returns 400 with invalid email', async () => {
        const res = await request(app).post('/register').send({ handle: 'valid-handle', name: 'Test', email: 'not-an-email' });
        expect(res.status).toBe(400);
    });

    it('GET /me returns 401 without auth', async () => {
        const res = await request(app).get('/me');
        expect(res.status).toBe(401);
    });

    it('POST /rotate-key returns 401 without auth', async () => {
        const res = await request(app).post('/rotate-key');
        expect(res.status).toBe(401);
    });
});

describe('MoltPhone Tokens — Auth Guards', () => {
    it('GET /tokens/balance returns 401 without auth', async () => {
        const res = await request(app).get('/tokens/balance');
        expect(res.status).toBe(401);
    });

    it('POST /tokens/purchase returns 401 without auth', async () => {
        const res = await request(app).post('/tokens/purchase').send({ package: 'starter' });
        expect(res.status).toBe(401);
    });

    it('GET /tokens/history returns 401 without auth', async () => {
        const res = await request(app).get('/tokens/history');
        expect(res.status).toBe(401);
    });
});

describe('MoltPhone Calls — Auth Guards', () => {
    it('POST /call returns 401 without auth', async () => {
        const res = await request(app).post('/call').send({
            to_number: '+1234567890',
            assistant_config: { first_message: 'Hello', system_prompt: 'You are a helpful agent' },
        });
        expect(res.status).toBe(401);
    });

    it('GET /calls returns 401 without auth', async () => {
        const res = await request(app).get('/calls');
        expect(res.status).toBe(401);
    });

    it('GET /calls/stats returns 401 without auth', async () => {
        const res = await request(app).get('/calls/stats');
        expect(res.status).toBe(401);
    });

    it('POST /call/end/some-id returns 401 without auth', async () => {
        const res = await request(app).post('/call/end/some-id');
        expect(res.status).toBe(401);
    });
});

describe('MoltPhone Transcripts — Auth Guards', () => {
    it('GET /calls/some-id/transcript returns 401 without auth', async () => {
        const res = await request(app).get('/calls/some-id/transcript');
        expect(res.status).toBe(401);
    });
});

describe('MoltPhone Webhooks — Public & Auth', () => {
    it('POST /webhooks/vapi endpoint exists (public)', async () => {
        const res = await request(app).post('/webhooks/vapi').send({});
        expect(res.status).not.toBe(404);
    });

    it('POST /webhooks/subscribe returns 401 without auth', async () => {
        const res = await request(app).post('/webhooks/subscribe').send({
            url: 'https://example.com/hook',
            events: ['call.started'],
        });
        expect(res.status).toBe(401);
    });

    it('GET /webhooks returns 401 without auth', async () => {
        const res = await request(app).get('/webhooks');
        expect(res.status).toBe(401);
    });
});
