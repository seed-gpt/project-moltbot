import { randomBytes, createHmac } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { getFirestore } from './firestore.js';

const PREFIXES: Record<string, string> = {
  moltbank: 'mb_',
  moltcredit: 'mc_',
  moltmail: 'mm_',
  moltphone: 'mp_',
};

export function generateApiKey(service: string = 'moltbank'): string {
  const prefix = PREFIXES[service] || 'mk_';
  const key = randomBytes(32).toString('hex');
  return `${prefix}${key}`;
}

export function hashApiKey(apiKey: string): string {
  const salt = process.env.API_KEY_SALT || 'default-salt';
  return createHmac('sha256', salt).update(apiKey).digest('hex');
}

export function authMiddleware() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return;
    }
    const apiKey = authHeader.slice(7);
    const keyHash = hashApiKey(apiKey);
    try {
      const db = getFirestore();
      const snapshot = await db.collection('agents')
        .where('apiKeyHash', '==', keyHash).limit(1).get();

      if (snapshot.empty) {
        res.status(401).json({ error: 'Invalid API key' });
        return;
      }
      const doc = snapshot.docs[0];
      (req as any).agent = { id: doc.id, ...doc.data() };
      next();
    } catch (err) {
      next(err);
    }
  };
}
