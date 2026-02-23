import express from 'express';
import cors from 'cors';
import { errorMiddleware, notFoundMiddleware, getFirestore } from '@moltbot/shared';
import swaggerUi from 'swagger-ui-express';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import creditRouter from './routes/credit.js';
import transactionsRouter from './routes/transactions.js';
import trustRouter from './routes/trust.js';

export function createApp() {
  const app = express();

  app.use(cors({
    origin: [
      'https://moltcredit.xyz',
      'https://www.moltcredit.xyz',
      'https://app.moltphone.xyz',
      /^http:\/\/localhost(:\d+)?$/,
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  app.use(express.json());

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const openapiSpec = parse(readFileSync(join(__dirname, '../openapi.yml'), 'utf-8'));

  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'MoltCredit API Documentation',
  }));

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'moltcredit' });
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

  app.use('/', creditRouter);
  app.use('/', transactionsRouter);
  app.use('/', trustRouter);

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
