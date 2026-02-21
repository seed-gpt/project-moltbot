import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getFirestore, authMiddleware, AppError } from '@moltbot/shared';
import { randomUUID } from 'node:crypto';

const router = express.Router();

const subscribeWebhookSchema = z.object({
  url: z.string().url().max(500),
  events: z.array(z.enum(['email.received', 'email.sent', 'email.delivered', 'email.failed'])),
});

const inboundEmailSchema = z.object({
  from: z.string().email(), to: z.string().email(), subject: z.string().optional(),
  body_text: z.string().optional(), body_html: z.string().optional(), message_id: z.string().optional(),
});

// POST /webhooks/inbound
router.post('/webhooks/inbound', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const body = inboundEmailSchema.parse(req.body);
    const db = getFirestore();

    const addrSnap = await db.collection('emailAddresses')
      .where('address', '==', body.to).where('verified', '==', true).limit(1).get();
    if (addrSnap.empty) throw new AppError(404, 'Recipient address not found', 'RECIPIENT_NOT_FOUND');

    const agentId = addrSnap.docs[0].data().agentId;
    const messageId = body.message_id || `<${randomUUID()}@agentmail.xyz>`;

    const emailRef = await db.collection('emails').add({
      fromAddress: body.from, toAddress: body.to, subject: body.subject || '(no subject)',
      bodyText: body.body_text || '', bodyHtml: body.body_html || null, status: 'received',
      direction: 'inbound', messageId, agentId, createdAt: new Date().toISOString(),
    });

    const hooksSnap = await db.collection('emailWebhooks')
      .where('agentId', '==', agentId).where('active', '==', true).get();

    for (const hook of hooksSnap.docs) {
      const hookData = hook.data();
      const events = hookData.events || [];
      if (events.length === 0 || events.includes('email.received')) {
        fetch(hookData.url, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'email.received', email: { id: emailRef.id, from: body.from, to: body.to, subject: body.subject, body_text: body.body_text, body_html: body.body_html, received_at: new Date().toISOString() } }),
        }).catch(() => { });
      }
    }

    res.status(201).json({ message: 'Email received', email_id: emailRef.id });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
    next(err);
  }
});

// POST /webhooks/subscribe
router.post('/webhooks/subscribe', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const body = subscribeWebhookSchema.parse(req.body);
    const db = getFirestore();

    const ref = await db.collection('emailWebhooks').add({
      agentId: agent.id, url: body.url, events: body.events, active: true, createdAt: new Date().toISOString(),
    });

    res.status(201).json({ webhook: { id: ref.id, url: body.url, events: body.events, active: true }, message: 'Webhook subscription created' });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
    next(err);
  }
});

// GET /webhooks
router.get('/webhooks', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const db = getFirestore();
    const snapshot = await db.collection('emailWebhooks').where('agentId', '==', agent.id).orderBy('createdAt', 'desc').get();
    const webhooks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ webhooks });
  } catch (err) { next(err); }
});

// DELETE /webhooks/:id
router.delete('/webhooks/:id', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const { id } = req.params;
    const db = getFirestore();

    const doc = await db.collection('emailWebhooks').doc(id).get();
    if (!doc.exists) throw new AppError(404, 'Webhook not found or access denied', 'WEBHOOK_NOT_FOUND');
    if (doc.data()?.agentId !== agent.id) throw new AppError(404, 'Webhook not found or access denied', 'WEBHOOK_NOT_FOUND');

    await db.collection('emailWebhooks').doc(id).delete();
    res.json({ message: 'Webhook subscription removed', webhook_id: id });
  } catch (err) { next(err); }
});

export default router;
