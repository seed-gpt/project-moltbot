import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../app.js';

const app = createApp();

describe('Stats Routes', () => {
  describe('GET /leaderboard', () => {
    it('endpoint exists (not 404)', async () => {
      const res = await request(app).get('/leaderboard');
      // Should get 500 (no db connection) but NOT 404 (route exists)
      expect(res.status).not.toBe(404);
    });
  });

  describe('GET /stats', () => {
    it('endpoint exists (not 404)', async () => {
      const res = await request(app).get('/stats');
      // Should get 500 (no db connection) but NOT 404 (route exists)
      expect(res.status).not.toBe(404);
    });
  });
});
