import express, { Request, Response, NextFunction } from 'express';
import { getFirestore, authMiddleware, AppError } from '@moltbot/shared';

const router = express.Router();

// GET /inbox
router.get('/inbox', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const db = getFirestore();

    let query = db.collection('emails')
      .where('agentId', '==', agent.id).where('direction', '==', 'inbound');
    if (req.query.unread === 'true') query = query.where('status', '==', 'received');

    const snapshot = await query.orderBy('createdAt', 'desc').limit(limit).get();
    const emails = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const total = (await db.collection('emails')
      .where('agentId', '==', agent.id).where('direction', '==', 'inbound').count().get()).data().count;

    res.json({ emails, pagination: { limit, offset: 0, total } });
  } catch (err) { next(err); }
});

// GET /inbox/:id
router.get('/inbox/:id', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const { id } = req.params;
    const db = getFirestore();

    const doc = await db.collection('emails').doc(id).get();
    if (!doc.exists) throw new AppError(404, 'Email not found or access denied', 'EMAIL_NOT_FOUND');
    const data = doc.data()!;
    if (data.agentId !== agent.id || data.direction !== 'inbound') throw new AppError(404, 'Email not found or access denied', 'EMAIL_NOT_FOUND');

    res.json({ email: { id: doc.id, ...data } });
  } catch (err) { next(err); }
});

// DELETE /inbox/:id
router.delete('/inbox/:id', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const { id } = req.params;
    const db = getFirestore();

    const doc = await db.collection('emails').doc(id).get();
    if (!doc.exists) throw new AppError(404, 'Email not found or access denied', 'EMAIL_NOT_FOUND');
    const data = doc.data()!;
    if (data.agentId !== agent.id || data.direction !== 'inbound') throw new AppError(404, 'Email not found or access denied', 'EMAIL_NOT_FOUND');

    await db.collection('emails').doc(id).delete();
    res.json({ message: 'Email deleted successfully', email_id: id });
  } catch (err) { next(err); }
});

export default router;
