import express from 'express';
import { errorMiddleware, notFoundMiddleware } from '@moltbot/shared';
import agentsRouter from './routes/agents.js';
import walletRouter from './routes/wallet.js';
import escrowRouter from './routes/escrow.js';
import statsRouter from './routes/stats.js';

export function createApp() {
  const app = express();

  app.use(express.json());

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'moltbank' });
  });

  // Mount route handlers
  app.use('/', agentsRouter);        // /register, /me
  app.use('/', walletRouter);        // /wallet, /wallet/deposit, /wallet/transfer, /wallet/transactions
  app.use('/', escrowRouter);        // /escrow/create, /escrow, /escrow/:id/release, /escrow/:id/dispute
  app.use('/', statsRouter);         // /leaderboard, /stats

  // Error handling middleware (must be last)
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
