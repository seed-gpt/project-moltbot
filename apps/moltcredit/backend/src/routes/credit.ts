import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getFirestore, authMiddleware, AppError } from '@moltbot/shared';

const router = express.Router();

const extendCreditSchema = z.object({
  grantee_handle: z.string().min(3),
  limit_amount: z.number().int().positive(),
  memo: z.string().optional(),
});

// POST /credit/extend
router.post('/credit/extend', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const body = extendCreditSchema.parse(req.body);
    const db = getFirestore();

    if (body.grantee_handle === agent.handle) throw new AppError(400, 'Cannot extend credit to yourself', 'SELF_CREDIT');

    const granteeSnap = await db.collection('agents').where('handle', '==', body.grantee_handle).limit(1).get();
    if (granteeSnap.empty) throw new AppError(404, 'Grantee not found', 'GRANTEE_NOT_FOUND');
    const granteeId = granteeSnap.docs[0].id;

    const existing = await db.collection('creditLines')
      .where('grantorId', '==', agent.id).where('granteeId', '==', granteeId).where('status', '==', 'active').limit(1).get();
    if (!existing.empty) throw new AppError(409, 'Active credit line already exists with this agent', 'CREDIT_LINE_EXISTS');

    const clRef = await db.collection('creditLines').add({
      grantorId: agent.id, granteeId, limitAmount: body.limit_amount, usedAmount: 0,
      currency: 'USDC', status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });

    const cl = { id: clRef.id, grantorId: agent.id, granteeId, limitAmount: body.limit_amount, usedAmount: 0, currency: 'USDC', status: 'active' };
    res.status(201).json({
      credit_line: { ...cl, grantee_handle: body.grantee_handle, available_amount: body.limit_amount },
      message: `Credit line of ${body.limit_amount} USDC extended to ${body.grantee_handle}`,
    });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
    next(err);
  }
});

// GET /credit
router.get('/credit', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const db = getFirestore();

    const [givenSnap, receivedSnap] = await Promise.all([
      db.collection('creditLines').where('grantorId', '==', agent.id).orderBy('createdAt', 'desc').get(),
      db.collection('creditLines').where('granteeId', '==', agent.id).orderBy('createdAt', 'desc').get(),
    ]);

    const resolveAgent = async (id: string) => {
      const doc = await db.collection('agents').doc(id).get();
      return doc.exists ? { handle: doc.data()?.handle, name: doc.data()?.name } : { handle: 'unknown', name: 'Unknown' };
    };

    const given = await Promise.all(givenSnap.docs.map(async doc => {
      const d = doc.data();
      const grantee = await resolveAgent(d.granteeId);
      return { ...d, id: doc.id, grantee_handle: grantee.handle, grantee_name: grantee.name, available_amount: d.limitAmount - d.usedAmount };
    }));

    const received = await Promise.all(receivedSnap.docs.map(async doc => {
      const d = doc.data();
      const grantor = await resolveAgent(d.grantorId);
      return { ...d, id: doc.id, grantor_handle: grantor.handle, grantor_name: grantor.name, available_amount: d.limitAmount - d.usedAmount };
    }));

    res.json({ given, received });
  } catch (err) { next(err); }
});

// GET /credit/:id
router.get('/credit/:id', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const { id } = req.params;
    const db = getFirestore();

    const clDoc = await db.collection('creditLines').doc(id).get();
    if (!clDoc.exists) throw new AppError(404, 'Credit line not found or access denied', 'CREDIT_LINE_NOT_FOUND');
    const cl = clDoc.data()!;
    if (cl.grantorId !== agent.id && cl.granteeId !== agent.id) throw new AppError(404, 'Credit line not found or access denied', 'CREDIT_LINE_NOT_FOUND');

    const [grantor, grantee] = await Promise.all([
      db.collection('agents').doc(cl.grantorId).get(),
      db.collection('agents').doc(cl.granteeId).get(),
    ]);

    const txSnap = await db.collection('creditTransactions').where('creditLineId', '==', id).orderBy('createdAt', 'desc').get();
    const txs = txSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    res.json({
      ...cl, id, grantor_handle: grantor.data()?.handle, grantor_name: grantor.data()?.name,
      grantee_handle: grantee.data()?.handle, grantee_name: grantee.data()?.name,
      available_amount: cl.limitAmount - cl.usedAmount, transactions: txs,
    });
  } catch (err) { next(err); }
});

// POST /credit/:id/revoke
router.post('/credit/:id/revoke', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const { id } = req.params;
    const db = getFirestore();

    const clDoc = await db.collection('creditLines').doc(id).get();
    if (!clDoc.exists || clDoc.data()?.grantorId !== agent.id) throw new AppError(404, 'Credit line not found or you are not the grantor', 'CREDIT_LINE_NOT_FOUND');
    if (clDoc.data()?.usedAmount > 0) throw new AppError(400, 'Cannot revoke credit line with outstanding balance', 'OUTSTANDING_BALANCE');

    await db.collection('creditLines').doc(id).update({ status: 'revoked', updatedAt: new Date().toISOString() });
    res.json({ message: 'Credit line revoked successfully', credit_line_id: id });
  } catch (err) { next(err); }
});

// POST /credit/:id/settle
router.post('/credit/:id/settle', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const { id } = req.params;
    const db = getFirestore();

    const clDoc = await db.collection('creditLines').doc(id).get();
    if (!clDoc.exists || clDoc.data()?.grantorId !== agent.id) throw new AppError(404, 'Credit line not found or you are not the grantor', 'CREDIT_LINE_NOT_FOUND');

    const usedAmount = clDoc.data()?.usedAmount || 0;
    if (usedAmount > 0) {
      const txRef = await db.collection('creditTransactions').add({
        creditLineId: id, amount: usedAmount, type: 'settlement', memo: 'Credit line settlement', createdAt: new Date().toISOString(),
      });
      await db.collection('creditLines').doc(id).update({ usedAmount: 0, updatedAt: new Date().toISOString() });
      res.json({ message: 'Credit line settled successfully', settlement: { id: txRef.id, amount: usedAmount, type: 'settlement' }, previous_balance: usedAmount, new_balance: 0 });
    } else {
      res.json({ message: 'No outstanding balance to settle', credit_line_id: id, balance: 0 });
    }
  } catch (err) { next(err); }
});

export default router;
