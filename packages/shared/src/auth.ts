import { randomBytes, createHmac } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { getFirestore } from './firestore.js';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const PREFIXES: Record<string, string> = {
  moltbank: 'mb_',
  moltcredit: 'mc_',
  moltmail: 'mm_',
  moltphone: 'mp_',
};

/* ─── API Key helpers (unchanged) ─── */

export function generateApiKey(service: string = 'moltbank'): string {
  const prefix = PREFIXES[service] || 'mk_';
  const key = randomBytes(32).toString('hex');
  return `${prefix}${key}`;
}

export function hashApiKey(apiKey: string): string {
  const salt = process.env.API_KEY_SALT || 'default-salt';
  return createHmac('sha256', salt).update(apiKey).digest('hex');
}

/* ─── Auth0 JWT helpers ─── */

let _jwksClient: jwksClient.JwksClient | null = null;

function getJwksClient(): jwksClient.JwksClient {
  if (_jwksClient) return _jwksClient;
  const domain = process.env.AUTH0_DOMAIN;
  if (!domain) throw new Error('AUTH0_DOMAIN not configured');
  _jwksClient = jwksClient({
    jwksUri: `https://${domain}/.well-known/jwks.json`,
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 10,
  });
  return _jwksClient;
}

function getSigningKey(header: jwt.JwtHeader): Promise<string> {
  return new Promise((resolve, reject) => {
    getJwksClient().getSigningKey(header.kid, (err, key) => {
      if (err) return reject(err);
      resolve(key!.getPublicKey());
    });
  });
}

function verifyAuth0Token(token: string): Promise<jwt.JwtPayload> {
  const domain = process.env.AUTH0_DOMAIN;
  const audience = process.env.AUTH0_AUDIENCE;
  if (!domain || !audience) throw new Error('AUTH0_DOMAIN / AUTH0_AUDIENCE not configured');

  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      (header, callback) => {
        getSigningKey(header).then(key => callback(null, key)).catch(callback);
      },
      {
        audience,
        issuer: `https://${domain}/`,
        algorithms: ['RS256'],
      },
      (err, decoded) => {
        if (err) return reject(err);
        resolve(decoded as jwt.JwtPayload);
      },
    );
  });
}

function isJwt(token: string): boolean {
  // JWTs have 3 dot-separated base64 parts; API keys start with a prefix like mp_
  return token.includes('.') && token.split('.').length === 3;
}

/* ─── Unified auth middleware ─── */

export function authMiddleware() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return;
    }
    const token = authHeader.slice(7);

    try {
      if (isJwt(token)) {
        // ── Auth0 JWT path ──
        const payload = await verifyAuth0Token(token);
        const auth0Sub = payload.sub!;
        const db = getFirestore();

        // Look up user by Auth0 sub in 'users' collection
        let userSnap = await db.collection('users')
          .where('auth0Sub', '==', auth0Sub).limit(1).get();

        if (userSnap.empty) {
          // Auto-create user record on first login
          const userRef = await db.collection('users').add({
            auth0Sub,
            email: payload[`https://api.moltphone.xyz/email`] || payload.email || '',
            name: payload[`https://api.moltphone.xyz/name`] || payload.name || '',
            picture: payload.picture || '',
            createdAt: new Date().toISOString(),
          });
          // Also create token balance
          await db.collection('tokenBalances').doc(userRef.id).set({
            agentId: userRef.id, balance: 5, updatedAt: new Date().toISOString(),
          });
          const newDoc = await userRef.get();
          (req as any).agent = { id: userRef.id, ...newDoc.data(), authType: 'auth0' };
        } else {
          const doc = userSnap.docs[0];
          (req as any).agent = { id: doc.id, ...doc.data(), authType: 'auth0' };
        }
        next();
      } else {
        // ── API Key path (original) ──
        const keyHash = hashApiKey(token);
        const db = getFirestore();
        const snapshot = await db.collection('agents')
          .where('apiKeyHash', '==', keyHash).limit(1).get();

        if (snapshot.empty) {
          res.status(401).json({ error: 'Invalid API key' });
          return;
        }
        const doc = snapshot.docs[0];
        (req as any).agent = { id: doc.id, ...doc.data(), authType: 'apikey' };
        next();
      }
    } catch (err: any) {
      if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
        res.status(401).json({ error: 'Invalid or expired token' });
        return;
      }
      next(err);
    }
  };
}
