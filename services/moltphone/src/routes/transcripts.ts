import express, { Request, Response, NextFunction } from 'express';
import { query, authMiddleware, AppError } from '@moltbot/shared';

const router = express.Router();

// GET /calls/:id/transcript - Get full transcript for a call
router.get('/calls/:id/transcript', authMiddleware(query), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const callId = req.params.id;

    // Verify call belongs to agent
    const callResult = await query(
      `SELECT id FROM calls WHERE id = $1 AND agent_id = $2`,
      [callId, agent.id]
    );

    if (callResult.rows.length === 0) {
      throw new AppError(404, 'Call not found', 'CALL_NOT_FOUND');
    }

    // Get transcript entries
    const result = await query(
      `SELECT id, role, content, timestamp_ms
       FROM transcripts
       WHERE call_id = $1
       ORDER BY timestamp_ms ASC`,
      [callId]
    );

    res.json({
      call_id: callId,
      transcript: result.rows,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
