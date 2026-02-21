import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getFirestore, authMiddleware, AppError } from '@moltbot/shared';
import { randomUUID } from 'node:crypto';

const router = express.Router();

const sendEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().max(500).optional(),
  body_text: z.string(),
  body_html: z.string().optional(),
});

// POST /send
router.post('/send', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const body = sendEmailSchema.parse(req.body);
    const db = getFirestore();

    const addrSnap = await db.collection('emailAddresses')
      .where('agentId', '==', agent.id).where('verified', '==', true).limit(1).get();
    if (addrSnap.empty) throw new AppError(400, 'No verified email address found. Please add an @agentmail.xyz address first.', 'NO_ADDRESS');

    // Rate limiting: max 100 emails per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const recentSnap = await db.collection('emails')
      .where('agentId', '==', agent.id).where('direction', '==', 'outbound')
      .where('createdAt', '>', oneHourAgo).get();
    if (recentSnap.size >= 100) throw new AppError(429, 'Rate limit exceeded. Maximum 100 emails per hour.', 'RATE_LIMIT');

    const messageId = `<${randomUUID()}@agentmail.xyz>`;
    const emailRef = await db.collection('emails').add({
      fromAddress: addrSnap.docs[0].data().address, toAddress: body.to,
      subject: body.subject || '(no subject)', bodyText: body.body_text, bodyHtml: body.body_html || null,
      status: 'queued', direction: 'outbound', messageId, agentId: agent.id, createdAt: new Date().toISOString(),
    });

    res.status(201).json({
      email: { id: emailRef.id, fromAddress: addrSnap.docs[0].data().address, toAddress: body.to, status: 'queued', messageId },
      message: 'Email queued for sending',
    });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
    next(err);
  }
});

// GET /sent
router.get('/sent', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const db = getFirestore();

    const snapshot = await db.collection('emails')
      .where('agentId', '==', agent.id).where('direction', '==', 'outbound')
      .orderBy('createdAt', 'desc').limit(limit).get();
    const emails = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const total = (await db.collection('emails')
      .where('agentId', '==', agent.id).where('direction', '==', 'outbound').count().get()).data().count;

    res.json({ emails, pagination: { limit, offset: 0, total } });
  } catch (err) { next(err); }
});

export default router;
