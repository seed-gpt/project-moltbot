import express from 'express';
import { errorMiddleware, notFoundMiddleware, query } from '@moltbot/shared';
import swaggerUi from 'swagger-ui-express';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import agentsRouter from './routes/agents.js';
import walletRouter from './routes/wallet.js';
import escrowRouter from './routes/escrow.js';
import statsRouter from './routes/stats.js';

export function createApp() {
  const app = express();

  app.use(express.json());

  // Load OpenAPI spec for Swagger UI
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const openapiSpec = parse(readFileSync(join(__dirname, '../openapi.yml'), 'utf-8'));

  // Swagger UI documentation
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'MoltBank API Documentation',
  }));

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'moltbank' });
  });

  // Readiness check endpoint (includes DB check)
  app.get('/ready', async (_req, res) => {
    try {
      await query('SELECT 1');
      res.status(200).json({ status: 'ready', db: 'connected' });
    } catch {
      res.status(503).json({ status: 'not_ready', db: 'disconnected' });
    }
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
