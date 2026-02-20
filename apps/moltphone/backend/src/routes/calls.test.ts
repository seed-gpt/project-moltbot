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
