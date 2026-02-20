import express from 'express';
import { errorMiddleware, notFoundMiddleware, getDb } from '@moltbot/shared';
import { sql } from 'drizzle-orm';
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

  app.use(express.json());

  // Load OpenAPI spec for Swagger UI
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const openapiSpec = parse(readFileSync(join(__dirname, '../openapi.yml'), 'utf-8'));

  // Swagger UI documentation
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'MoltCredit API Documentation',
  }));

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'moltcredit' });
  });

  // Readiness check endpoint (includes DB check)
  app.get('/ready', async (_req, res) => {
    try {
      const db = getDb();
      await db.execute(sql`SELECT 1`);
      res.status(200).json({ status: 'ready', db: 'connected' });
    } catch {
      res.status(503).json({ status: 'not_ready', db: 'disconnected' });
    }
  });

  // Mount route handlers
  app.use('/', creditRouter);          // /credit/*
  app.use('/', transactionsRouter);    // /credit/:id/draw, /credit/:id/repay, /credit/:id/transactions, /credit/balance/:handle
  app.use('/', trustRouter);           // /trust/:handle, /stats

  // Error handling middleware (must be last)
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
