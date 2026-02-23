import request from 'supertest';
import { createApp } from '../../src/app.js';

const app = createApp();

describe('MoltMail Health', () => {
    it('GET /health returns 200', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(res.body.service).toBe('moltmail');
    });
});

describe('MoltMail Addresses — Auth Guards', () => {
    it('GET /addresses returns 401 without auth', async () => {
        const res = await request(app).get('/addresses');
        expect(res.status).toBe(401);
    });

    it('POST /addresses/add returns 401 without auth', async () => {
        const res = await request(app).post('/addresses/add').send({ address: 'test@agentmail.xyz' });
        expect(res.status).toBe(401);
    });
});

describe('MoltMail Emails — Auth Guards', () => {
    it('POST /send returns 401 without auth', async () => {
        const res = await request(app).post('/send').send({
            to: 'user@example.com',
            subject: 'Test',
            body_text: 'Hello',
        });
        expect(res.status).toBe(401);
    });

    it('GET /sent returns 401 without auth', async () => {
        const res = await request(app).get('/sent');
        expect(res.status).toBe(401);
    });
});

describe('MoltMail Inbox — Auth Guards', () => {
    it('GET /inbox returns 401 without auth', async () => {
        const res = await request(app).get('/inbox');
        expect(res.status).toBe(401);
    });

    it('GET /inbox/:id returns 401 without auth', async () => {
        const res = await request(app).get('/inbox/some-id');
        expect(res.status).toBe(401);
    });

    it('DELETE /inbox/:id returns 401 without auth', async () => {
        const res = await request(app).delete('/inbox/some-id');
        expect(res.status).toBe(401);
    });
});

describe('MoltMail Webhooks — Public & Auth', () => {
    it('POST /webhooks/inbound endpoint exists (public)', async () => {
        const res = await request(app).post('/webhooks/inbound').send({});
        expect(res.status).not.toBe(404);
    });

    it('POST /webhooks/subscribe returns 401 without auth', async () => {
        const res = await request(app).post('/webhooks/subscribe').send({
            url: 'https://example.com/hook',
            events: ['email.received'],
        });
        expect(res.status).toBe(401);
    });

    it('GET /webhooks returns 401 without auth', async () => {
        const res = await request(app).get('/webhooks');
        expect(res.status).toBe(401);
    });
});
