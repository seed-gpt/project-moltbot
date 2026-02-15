import crypto from 'node:crypto';

const PREFIXES: Record<string, string> = {
  moltbank: 'mb_',
  moltcredit: 'mc_',
  moltmail: 'mm_',
  moltphone: 'mp_',
};

export function generateApiKey(service: string = 'moltbank'): string {
  const prefix = PREFIXES[service] || 'mk_';
  const key = crypto.randomBytes(32).toString('hex');
  return `${prefix}${key}`;
}

export function hashApiKey(apiKey: string): string {
  const salt = process.env.API_KEY_SALT || 'default-salt';
  return crypto.createHmac('sha256', salt).update(apiKey).digest('hex');
}

// Express middleware
import type { Request, Response, NextFunction } from 'express';

export function authMiddleware(queryFn: (text: string, params: unknown[]) => Promise<any>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return;
    }
    const apiKey = authHeader.slice(7);
    const keyHash = hashApiKey(apiKey);
    try {
      const result = await queryFn('SELECT id, handle, name FROM agents WHERE api_key_hash = $1', [keyHash]);
      if (result.rows.length === 0) {
        res.status(401).json({ error: 'Invalid API key' });
        return;
      }
      (req as any).agent = result.rows[0];
      next();
    } catch (err) {
      next(err);
    }
  };
}
