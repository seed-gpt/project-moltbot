import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getFirestore, authMiddleware, AppError } from '@moltbot/shared';

const router = express.Router();

const depositSchema = z.object({ amount: z.number().int().positive('Amount must be a positive integer') });
const transferSchema = z.object({
  to_handle: z.string().min(1, 'Recipient handle is required'),
  amount: z.number().int().positive('Amount must be a positive integer'),
  memo: z.string().optional(),
});

// GET /wallet
router.get('/wallet', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const db = getFirestore();

    const walletDoc = await db.collection('wallets').doc(agent.id).get();
    if (!walletDoc.exists) throw new AppError(404, 'Wallet not found');
    const wallet = walletDoc.data()!;

    const txSnap = await db.collection('transactions')
      .where('participants', 'array-contains', agent.id)
      .orderBy('createdAt', 'desc').limit(5).get();
    const recent = txSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    res.json({ balance: wallet.balance, currency: wallet.currency, recent_transactions: recent });
  } catch (err) { next(err); }
});

// POST /wallet/deposit
router.post('/wallet/deposit', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const body = depositSchema.parse(req.body);
    const db = getFirestore();

    const newBalance = await db.runTransaction(async (tx) => {
      const walletRef = db.collection('wallets').doc(agent.id);
      const walletDoc = await tx.get(walletRef);
      if (!walletDoc.exists) throw new AppError(404, 'Wallet not found');
      const updated = (walletDoc.data()?.balance || 0) + body.amount;
      tx.update(walletRef, { balance: updated });
      return updated;
    });

    await db.collection('transactions').add({
      type: 'deposit', amount: body.amount, toAgentId: agent.id,
      participants: [agent.id], memo: 'Deposit to wallet', createdAt: new Date().toISOString(),
    });

    res.json({ success: true, new_balance: newBalance, amount_deposited: body.amount });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
    next(err);
  }
});

// POST /wallet/transfer
router.post('/wallet/transfer', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const body = transferSchema.parse(req.body);
    const db = getFirestore();

    const recipientSnap = await db.collection('agents').where('handle', '==', body.to_handle).limit(1).get();
    if (recipientSnap.empty) throw new AppError(404, 'Recipient not found', 'RECIPIENT_NOT_FOUND');
    const recipientId = recipientSnap.docs[0].id;
    if (recipientId === agent.id) throw new AppError(400, 'Cannot transfer to yourself', 'SELF_TRANSFER');

    const newBalance = await db.runTransaction(async (tx) => {
      const senderRef = db.collection('wallets').doc(agent.id);
      const recipientRef = db.collection('wallets').doc(recipientId);
      const [senderDoc, recipientDoc] = await Promise.all([tx.get(senderRef), tx.get(recipientRef)]);

      if (!senderDoc.exists) throw new AppError(404, 'Sender wallet not found');
      const senderBalance = senderDoc.data()?.balance || 0;
      if (senderBalance < body.amount) throw new AppError(400, 'Insufficient funds', 'INSUFFICIENT_FUNDS');

      tx.update(senderRef, { balance: senderBalance - body.amount });
      const recipientBalance = recipientDoc.exists ? (recipientDoc.data()?.balance || 0) : 0;
      if (recipientDoc.exists) {
        tx.update(recipientRef, { balance: recipientBalance + body.amount });
      } else {
        tx.set(recipientRef, { agentId: recipientId, balance: body.amount, currency: 'USD', createdAt: new Date().toISOString() });
      }
      return senderBalance - body.amount;
    });

    await db.collection('transactions').add({
      type: 'transfer', amount: body.amount, fromAgentId: agent.id, toAgentId: recipientId,
      participants: [agent.id, recipientId], memo: body.memo || null, createdAt: new Date().toISOString(),
    });

    res.json({ success: true, amount_transferred: body.amount, recipient: body.to_handle, new_balance: newBalance });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
    next(err);
  }
});

// GET /wallet/transactions
router.get('/wallet/transactions', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const db = getFirestore();

    const snapshot = await db.collection('transactions')
      .where('participants', 'array-contains', agent.id)
      .orderBy('createdAt', 'desc').limit(limit).get();

    const txs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const total = (await db.collection('transactions').where('participants', 'array-contains', agent.id).count().get()).data().count;

    res.json({ transactions: txs, pagination: { page: 1, limit, total, total_pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
});

export default router;
