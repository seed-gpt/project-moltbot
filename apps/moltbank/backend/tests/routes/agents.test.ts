import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../../src/app.js';

const app = createApp();

describe('Agent Routes', () => {
  describe('POST /register', () => {
    it('validates handle is required', async () => {
      const res = await request(app).post('/register').send({ name: 'Test' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('validates handle format (alphanumeric and hyphens only)', async () => {
      const res = await request(app).post('/register').send({ handle: 'invalid handle!', name: 'Test' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('validates handle minimum length (3 chars)', async () => {
      const res = await request(app).post('/register').send({ handle: 'ab', name: 'Test' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('validates name is required', async () => {
      const res = await request(app).post('/register').send({ handle: 'valid-handle' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });
  });

  describe('GET /me', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app).get('/me');
      expect(res.status).toBe(401);
    });

    it('returns 401 with invalid auth header', async () => {
      const res = await request(app).get('/me').set('Authorization', 'InvalidToken');
      expect(res.status).toBe(401);
    });
  });
});
