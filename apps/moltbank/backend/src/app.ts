import express from 'express';
import { errorMiddleware, notFoundMiddleware, getFirestore } from '@moltbot/shared';
import swaggerUi from 'swagger-ui-express';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import agentsRouter from './routes/agents.js';
import walletRouter from './routes/wallet.js';
import escrowRouter from './routes/escrow.js';
import statsRouter from './routes/stats.js';
import directoryRouter from './routes/directory.js';

export function createApp() {
  const app = express();

  app.use(express.json());

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const openapiSpec = parse(readFileSync(join(__dirname, '../openapi.yml'), 'utf-8'));

  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'MoltBank API Documentation',
  }));

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'moltbank' });
  });

  app.get('/ready', async (_req, res) => {
    try {
      const db = getFirestore();
      await db.collection('agents').limit(1).get();
      res.status(200).json({ status: 'ready', db: 'connected' });
    } catch {
      res.status(503).json({ status: 'not_ready', db: 'disconnected' });
    }
  });

  app.use('/', agentsRouter);
  app.use('/', walletRouter);
  app.use('/', escrowRouter);
  app.use('/', statsRouter);
  app.use('/', directoryRouter);

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
