import express, { Request, Response, NextFunction } from 'express';
import { query, authMiddleware, AppError } from '@moltbot/shared';

const router = express.Router();

// GET /inbox - Get received emails (paginated)
router.get('/inbox', authMiddleware(query), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const unread = req.query.unread === 'true';

    // Build query based on unread filter
    let sqlQuery = `
      SELECT id, from_address, to_address, subject, status, message_id, created_at
      FROM emails
      WHERE agent_id = $1 AND direction = 'inbound'
    `;

    const params: any[] = [agent.id];

    if (unread) {
      // For now, we'll consider all emails as "read" since we don't have a read flag
      // In a real implementation, you'd add a 'read' boolean column
      sqlQuery += ' AND status = $' + (params.length + 1);
      params.push('received');
    }

    sqlQuery += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const result = await query(sqlQuery, params);

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM emails WHERE agent_id = $1 AND direction = 'inbound'`,
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

// GET /inbox/:id - Get specific email
router.get('/inbox/:id', authMiddleware(query), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const { id } = req.params;

    const result = await query(
      `SELECT id, from_address, to_address, subject, body_text, body_html, status, message_id, created_at
       FROM emails
       WHERE id = $1 AND agent_id = $2 AND direction = 'inbound'`,
      [id, agent.id]
    );

    if (result.rows.length === 0) {
      throw new AppError(404, 'Email not found or access denied', 'EMAIL_NOT_FOUND');
    }

    res.json({ email: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// DELETE /inbox/:id - Delete email
router.delete('/inbox/:id', authMiddleware(query), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const { id } = req.params;

    const result = await query(
      'DELETE FROM emails WHERE id = $1 AND agent_id = $2 AND direction = $3 RETURNING id',
      [id, agent.id, 'inbound']
    );

    if (result.rows.length === 0) {
      throw new AppError(404, 'Email not found or access denied', 'EMAIL_NOT_FOUND');
    }

    res.json({
      message: 'Email deleted successfully',
      email_id: id,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
