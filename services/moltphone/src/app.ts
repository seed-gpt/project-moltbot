import express from 'express';
import { errorMiddleware, notFoundMiddleware, query } from '@moltbot/shared';
import swaggerUi from 'swagger-ui-express';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import callsRouter from './routes/calls.js';
import transcriptsRouter from './routes/transcripts.js';
import webhooksRouter from './routes/webhooks.js';

export function createApp() {
  const app = express();

  app.use(express.json());

  // Load OpenAPI spec for Swagger UI
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const openapiSpec = parse(readFileSync(join(__dirname, '../openapi.yml'), 'utf-8'));

  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'MoltPhone API Documentation',
  }));

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'moltphone' });
  });

  app.get('/ready', async (_req, res) => {
    try {
      await query('SELECT 1');
      res.status(200).json({ status: 'ready', db: 'connected' });
    } catch {
      res.status(503).json({ status: 'not_ready', db: 'disconnected' });
    }
  });

  // Mount route handlers
  app.use('/', callsRouter);
  app.use('/', transcriptsRouter);
  app.use('/', webhooksRouter);

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
