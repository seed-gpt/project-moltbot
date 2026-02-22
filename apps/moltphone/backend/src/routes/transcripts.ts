import express, { Request, Response, NextFunction } from 'express';
import { getFirestore, authMiddleware, AppError } from '@moltbot/shared';
import { getLogger } from '../middleware/logger.js';

const router = express.Router();

// GET /calls/:id/transcript
router.get('/calls/:id/transcript', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const log = getLogger('transcripts');
  try {
    const agent = (req as any).agent;
    const { id } = req.params;
    const db = getFirestore();

    const callDoc = await db.collection('calls').doc(id).get();
    if (!callDoc.exists) throw new AppError(404, 'Call not found');
    if (callDoc.data()?.agentId !== agent.id) throw new AppError(403, 'Access denied');

    const snapshot = await db.collection('calls').doc(id).collection('transcripts')
      .orderBy('timestamp', 'asc').get();

    const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    log.info('Transcript retrieved', { callId: id, entries: entries.length });
    res.json({ call_id: id, transcript: entries });
  } catch (err) { next(err); }
});

export default router;
