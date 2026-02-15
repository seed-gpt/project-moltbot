import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query, authMiddleware, AppError } from '@moltbot/shared';
import { randomUUID } from 'node:crypto';

const router = express.Router();

const sendEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().max(500).optional(),
  body_text: z.string(),
  body_html: z.string().optional(),
});

// POST /send - Send email
router.post('/send', authMiddleware(query), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const body = sendEmailSchema.parse(req.body);

    // Get agent's primary email address
    const addressResult = await query(
      'SELECT address FROM email_addresses WHERE agent_id = $1 AND verified = true ORDER BY created_at ASC LIMIT 1',
      [agent.id]
    );

    if (addressResult.rows.length === 0) {
      throw new AppError(400, 'No verified email address found. Please add an @agentmail.xyz address first.', 'NO_ADDRESS');
    }

    const fromAddress = addressResult.rows[0].address;

    // Simple rate limiting: check emails sent in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentEmails = await query(
      `SELECT COUNT(*) as count FROM emails
       WHERE agent_id = $1 AND direction = 'outbound' AND created_at > $2`,
      [agent.id, oneHourAgo]
    );

    if (parseInt(recentEmails.rows[0].count) >= 100) {
      throw new AppError(429, 'Rate limit exceeded. Maximum 100 emails per hour.', 'RATE_LIMIT');
    }

    // Generate message ID
    const messageId = `<${randomUUID()}@agentmail.xyz>`;

    // Insert email record
    const result = await query(
      `INSERT INTO emails (from_address, to_address, subject, body_text, body_html, status, direction, message_id, agent_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, from_address, to_address, subject, status, message_id, created_at`,
      [fromAddress, body.to, body.subject || '(no subject)', body.body_text, body.body_html || null, 'queued', 'outbound', messageId, agent.id]
    );

    res.status(201).json({
      email: result.rows[0],
      message: 'Email queued for sending',
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    next(err);
  }
});

// GET /sent - Get sent emails (paginated)
router.get('/sent', authMiddleware(query), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await query(
      `SELECT id, from_address, to_address, subject, status, message_id, created_at
       FROM emails
       WHERE agent_id = $1 AND direction = 'outbound'
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [agent.id, limit, offset]
    );

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM emails WHERE agent_id = $1 AND direction = 'outbound'`,
      [agent.id]
    );

    res.json({
      emails: result.rows,
      pagination: {
        limit,
        offset,
        total: parseInt(countResult.rows[0].total),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
