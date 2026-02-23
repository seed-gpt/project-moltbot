import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../../src/app.js';

const app = createApp();

describe('Escrow Routes', () => {
  describe('POST /escrow/create', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app).post('/escrow/create').send({
        counterparty_handle: 'other-agent',
        amount: 5000,
        description: 'Test escrow'
      });
      expect(res.status).toBe(401);
    });

    it('returns 401 with invalid auth header', async () => {
      const res = await request(app).post('/escrow/create')
        .set('Authorization', 'InvalidToken')
        .send({
          counterparty_handle: 'other-agent',
          amount: 5000,
          description: 'Test escrow'
        });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /escrow', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app).get('/escrow');
      expect(res.status).toBe(401);
    });

    it('returns 401 with invalid auth header', async () => {
      const res = await request(app).get('/escrow')
        .set('Authorization', 'InvalidToken');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /escrow/:id/release', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app).post('/escrow/1/release');
      expect(res.status).toBe(401);
    });

    it('returns 401 with invalid auth header', async () => {
      const res = await request(app).post('/escrow/1/release')
        .set('Authorization', 'InvalidToken');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /escrow/:id/dispute', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app).post('/escrow/1/dispute');
      expect(res.status).toBe(401);
    });

    it('returns 401 with invalid auth header', async () => {
      const res = await request(app).post('/escrow/1/dispute')
        .set('Authorization', 'InvalidToken');
      expect(res.status).toBe(401);
    });
  });
});
