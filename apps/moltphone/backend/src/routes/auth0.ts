import express, { Request, Response, NextFunction } from 'express';
import { authMiddleware, AppError } from '@moltbot/shared';

const router = express.Router();

// GET /auth/me — Returns user profile for Auth0-authenticated users
router.get('/auth/me', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const agent = (req as any).agent;
        res.json({
            id: agent.id,
            handle: agent.handle || agent.email?.split('@')[0] || 'user',
            name: agent.name || '',
            email: agent.email || agent.metadata?.email || '',
            picture: agent.picture || '',
            authType: agent.authType || 'apikey',
            created_at: agent.createdAt,
        });
    } catch (err) { next(err); }
});

export default router;
