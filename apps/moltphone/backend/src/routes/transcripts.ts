import express, { Request, Response, NextFunction } from 'express';
import { getDb, authMiddleware, AppError } from '@moltbot/shared';
import { eq, and, asc } from 'drizzle-orm';
import { calls, transcripts } from '../db/schema.js';

const router = express.Router();

// GET /calls/:id/transcript
router.get('/calls/:id/transcript', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const callId = req.params.id;
    const db = getDb();

    const call = await db.select({ id: calls.id }).from(calls)
      .where(and(eq(calls.id, callId), eq(calls.agentId, agent.id)));
    if (call.length === 0) throw new AppError(404, 'Call not found', 'CALL_NOT_FOUND');

    const result = await db.select().from(transcripts)
      .where(eq(transcripts.callId, callId)).orderBy(asc(transcripts.timestampMs));

    res.json({ call_id: callId, transcript: result });
  } catch (err) { next(err); }
});

export default router;
