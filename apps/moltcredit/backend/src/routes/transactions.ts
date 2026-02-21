import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getFirestore, authMiddleware, AppError } from '@moltbot/shared';

const router = express.Router();

const drawSchema = z.object({ amount: z.number().int().positive(), memo: z.string().optional() });
const repaySchema = z.object({ amount: z.number().int().positive(), memo: z.string().optional() });

// POST /credit/:id/draw
router.post('/credit/:id/draw', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const agent = (req as any).agent;
        const { id } = req.params;
        const body = drawSchema.parse(req.body);
        const db = getFirestore();

        const result = await db.runTransaction(async (tx) => {
            const clRef = db.collection('creditLines').doc(id);
            const clDoc = await tx.get(clRef);
            if (!clDoc.exists) throw new AppError(404, 'Credit line not found or you are not the grantee', 'CREDIT_LINE_NOT_FOUND');
            const cl = clDoc.data()!;
            if (cl.granteeId !== agent.id || cl.status !== 'active') throw new AppError(404, 'Credit line not found or you are not the grantee', 'CREDIT_LINE_NOT_FOUND');

            const available = cl.limitAmount - cl.usedAmount;
            if (body.amount > available) throw new AppError(400, `Insufficient credit. Available: ${available}, requested: ${body.amount}`, 'INSUFFICIENT_CREDIT');

            tx.update(clRef, { usedAmount: cl.usedAmount + body.amount, updatedAt: new Date().toISOString() });

            const txRef = db.collection('creditTransactions').doc();
            const txData = { creditLineId: id, amount: body.amount, type: 'draw', memo: body.memo || null, createdAt: new Date().toISOString() };
            tx.set(txRef, txData);

            return {
                transaction: { id: txRef.id, ...txData },
                credit_line: { id, used_amount: cl.usedAmount + body.amount, available_amount: available - body.amount, limit_amount: cl.limitAmount },
            };
        });

        res.status(201).json({ ...result, message: `Drew ${body.amount} cents from credit line` });
    } catch (err) {
        if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
        next(err);
    }
});

// POST /credit/:id/repay
router.post('/credit/:id/repay', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const agent = (req as any).agent;
        const { id } = req.params;
        const body = repaySchema.parse(req.body);
        const db = getFirestore();

        const result = await db.runTransaction(async (tx) => {
            const clRef = db.collection('creditLines').doc(id);
            const clDoc = await tx.get(clRef);
            if (!clDoc.exists) throw new AppError(404, 'Credit line not found or you are not the grantee', 'CREDIT_LINE_NOT_FOUND');
            const cl = clDoc.data()!;
            if (cl.granteeId !== agent.id) throw new AppError(404, 'Credit line not found or you are not the grantee', 'CREDIT_LINE_NOT_FOUND');
            if (body.amount > cl.usedAmount) throw new AppError(400, `Cannot repay more than owed. Owed: ${cl.usedAmount}, repaying: ${body.amount}`, 'OVERPAYMENT');

            tx.update(clRef, { usedAmount: cl.usedAmount - body.amount, updatedAt: new Date().toISOString() });

            const txRef = db.collection('creditTransactions').doc();
            const txData = { creditLineId: id, amount: body.amount, type: 'repay', memo: body.memo || null, createdAt: new Date().toISOString() };
            tx.set(txRef, txData);

            return {
                transaction: { id: txRef.id, ...txData },
                credit_line: { id, used_amount: cl.usedAmount - body.amount, available_amount: (cl.limitAmount - cl.usedAmount) + body.amount, limit_amount: cl.limitAmount },
            };
        });

        res.status(201).json({ ...result, message: `Repaid ${body.amount} cents on credit line` });
    } catch (err) {
        if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
        next(err);
    }
});

// GET /credit/balance/:handle
router.get('/credit/balance/:handle', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const agent = (req as any).agent;
        const { handle } = req.params;
        const db = getFirestore();

        const otherSnap = await db.collection('agents').where('handle', '==', handle).limit(1).get();
        if (otherSnap.empty) throw new AppError(404, 'Agent not found', 'AGENT_NOT_FOUND');
        const otherId = otherSnap.docs[0].id;

        const givenSnap = await db.collection('creditLines')
            .where('grantorId', '==', agent.id).where('granteeId', '==', otherId).where('status', '==', 'active').get();
        let givenUsed = 0;
        givenSnap.docs.forEach(doc => { givenUsed += doc.data().usedAmount || 0; });

        const receivedSnap = await db.collection('creditLines')
            .where('grantorId', '==', otherId).where('granteeId', '==', agent.id).where('status', '==', 'active').get();
        let receivedUsed = 0;
        receivedSnap.docs.forEach(doc => { receivedUsed += doc.data().usedAmount || 0; });

        res.json({ with_agent: handle, credit_given_used: givenUsed, credit_received_used: receivedUsed, net_balance: receivedUsed - givenUsed });
    } catch (err) { next(err); }
});

// GET /credit/:id/transactions
router.get('/credit/:id/transactions', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const agent = (req as any).agent;
        const { id } = req.params;
        const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
        const db = getFirestore();

        const clDoc = await db.collection('creditLines').doc(id).get();
        if (!clDoc.exists) throw new AppError(404, 'Credit line not found or access denied', 'CREDIT_LINE_NOT_FOUND');
        const cl = clDoc.data()!;
        if (cl.grantorId !== agent.id && cl.granteeId !== agent.id) throw new AppError(404, 'Credit line not found or access denied', 'CREDIT_LINE_NOT_FOUND');

        const txSnap = await db.collection('creditTransactions')
            .where('creditLineId', '==', id).orderBy('createdAt', 'desc').limit(limit).get();
        const txs = txSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const total = (await db.collection('creditTransactions').where('creditLineId', '==', id).count().get()).data().count;
        const page = parseInt(req.query.page as string) || 1;

        res.json({ transactions: txs, pagination: { page, limit, total, total_pages: Math.ceil(total / limit) } });
    } catch (err) { next(err); }
});

export default router;
