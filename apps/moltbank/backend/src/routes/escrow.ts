import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getFirestore, authMiddleware, AppError } from '@moltbot/shared';

const router = express.Router();

const createEscrowSchema = z.object({
  counterparty_handle: z.string().min(1, 'Counterparty handle is required'),
  amount: z.number().int().positive('Amount must be a positive integer'),
  description: z.string().optional(),
});

// POST /escrow/create
router.post('/escrow/create', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const body = createEscrowSchema.parse(req.body);
    const db = getFirestore();

    const cpSnap = await db.collection('agents').where('handle', '==', body.counterparty_handle).limit(1).get();
    if (cpSnap.empty) throw new AppError(404, 'Counterparty not found', 'COUNTERPARTY_NOT_FOUND');
    const counterpartyId = cpSnap.docs[0].id;
    if (counterpartyId === agent.id) throw new AppError(400, 'Cannot create escrow with yourself', 'SELF_ESCROW');

    const escrowData = await db.runTransaction(async (tx) => {
      const walletRef = db.collection('wallets').doc(agent.id);
      const walletDoc = await tx.get(walletRef);
      if (!walletDoc.exists) throw new AppError(404, 'Wallet not found');
      const balance = walletDoc.data()?.balance || 0;
      if (balance < body.amount) throw new AppError(400, 'Insufficient funds', 'INSUFFICIENT_FUNDS');

      tx.update(walletRef, { balance: balance - body.amount });

      const escrowRef = db.collection('escrows').doc();
      const escrow = {
        creatorId: agent.id, counterpartyId, amount: body.amount,
        description: body.description || null, status: 'active',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      tx.set(escrowRef, escrow);

      const txRef = db.collection('transactions').doc();
      tx.set(txRef, {
        type: 'escrow_lock', amount: body.amount, fromAgentId: agent.id,
        participants: [agent.id], memo: `Funds locked in escrow #${escrowRef.id}`,
        createdAt: new Date().toISOString(),
      });

      return { id: escrowRef.id, ...escrow };
    });

    res.status(201).json({ escrow: escrowData });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
    next(err);
  }
});

// GET /escrow
router.get('/escrow', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const db = getFirestore();

    const [created, counterparty] = await Promise.all([
      db.collection('escrows').where('creatorId', '==', agent.id).orderBy('createdAt', 'desc').get(),
      db.collection('escrows').where('counterpartyId', '==', agent.id).orderBy('createdAt', 'desc').get(),
    ]);

    const seen = new Set<string>();
    const result: any[] = [];
    for (const doc of [...created.docs, ...counterparty.docs]) {
      if (!seen.has(doc.id)) { seen.add(doc.id); result.push({ id: doc.id, ...doc.data() }); }
    }
    result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    res.json({ escrows: result });
  } catch (err) { next(err); }
});

// POST /escrow/:id/release
router.post('/escrow/:id/release', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const { id } = req.params;
    const db = getFirestore();

    const released = await db.runTransaction(async (tx) => {
      const escrowRef = db.collection('escrows').doc(id);
      const escrowDoc = await tx.get(escrowRef);
      if (!escrowDoc.exists) throw new AppError(404, 'Escrow not found');
      const escrow = escrowDoc.data()!;
      if (escrow.creatorId !== agent.id) throw new AppError(403, 'Only the creator can release escrow funds', 'FORBIDDEN');
      if (escrow.status !== 'active') throw new AppError(400, `Cannot release escrow with status: ${escrow.status}`, 'INVALID_STATUS');

      const walletRef = db.collection('wallets').doc(escrow.counterpartyId);
      const walletDoc = await tx.get(walletRef);
      const bal = walletDoc.exists ? (walletDoc.data()?.balance || 0) : 0;
      if (walletDoc.exists) { tx.update(walletRef, { balance: bal + escrow.amount }); }
      else { tx.set(walletRef, { agentId: escrow.counterpartyId, balance: escrow.amount, currency: 'USD', createdAt: new Date().toISOString() }); }

      tx.update(escrowRef, { status: 'released', updatedAt: new Date().toISOString() });

      const txRef = db.collection('transactions').doc();
      tx.set(txRef, {
        type: 'escrow_release', amount: escrow.amount, toAgentId: escrow.counterpartyId,
        participants: [escrow.counterpartyId], memo: `Escrow #${id} released`,
        createdAt: new Date().toISOString(),
      });

      return escrow.amount;
    });

    res.json({ success: true, escrow_id: id, amount_released: released, status: 'released' });
  } catch (err) { next(err); }
});

// POST /escrow/:id/dispute
router.post('/escrow/:id/dispute', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const { id } = req.params;
    const db = getFirestore();

    const escrowDoc = await db.collection('escrows').doc(id).get();
    if (!escrowDoc.exists) throw new AppError(404, 'Escrow not found');
    const escrow = escrowDoc.data()!;
    if (escrow.creatorId !== agent.id && escrow.counterpartyId !== agent.id) throw new AppError(403, 'You are not part of this escrow', 'FORBIDDEN');
    if (escrow.status !== 'active') throw new AppError(400, `Cannot dispute escrow with status: ${escrow.status}`, 'INVALID_STATUS');

    await db.collection('escrows').doc(id).update({ status: 'disputed', updatedAt: new Date().toISOString() });
    res.json({ success: true, escrow_id: id, status: 'disputed', message: 'Escrow marked as disputed. Funds are locked pending resolution.' });
  } catch (err) { next(err); }
});

export default router;
