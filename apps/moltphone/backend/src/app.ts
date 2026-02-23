import express from 'express';
import cors from 'cors';
import { errorMiddleware, notFoundMiddleware, getFirestore } from '@moltbot/shared';
import swaggerUi from 'swagger-ui-express';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import agentsRouter from './routes/agents.js';
import callsRouter from './routes/calls.js';
import transcriptsRouter from './routes/transcripts.js';
import webhooksRouter from './routes/webhooks.js';
import tokensRouter from './routes/tokens.js';
import auth0Router from './routes/auth0.js';
import twimlRouter from './routes/twiml.js';
import stripeRouter from './routes/stripe.js';
import { requestIdMiddleware, requestLogMiddleware } from './middleware/logger.js';

export function createApp() {
  const app = express();

  app.use(cors({
    origin: [
      'https://app.moltphone.xyz',
      'https://moltphone.xyz',
      'https://www.moltphone.xyz',
      'https://moltcredit.xyz',
      'https://www.moltcredit.xyz',
      /^http:\/\/localhost(:\d+)?$/,
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  // ⚠ Mount stripe webhook BEFORE express.json() — needs raw body for sig verification
  app.use('/', stripeRouter);

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(requestIdMiddleware);
  app.use(requestLogMiddleware);

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
      const db = getFirestore();
      await db.collection('agents').limit(1).get();
      res.status(200).json({ status: 'ready', db: 'connected' });
    } catch {
      res.status(503).json({ status: 'not_ready', db: 'disconnected' });
    }
  });

  app.use('/', agentsRouter);
  app.use('/', callsRouter);
  app.use('/', transcriptsRouter);
  app.use('/', webhooksRouter);
  app.use('/', tokensRouter);
  app.use('/', auth0Router);
  app.use('/', twimlRouter);

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
