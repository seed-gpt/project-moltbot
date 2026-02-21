import express, { Request, Response, NextFunction } from 'express';
import { getFirestore, AppError } from '@moltbot/shared';

const router = express.Router();

// GET /directory
router.get('/directory', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const db = getFirestore();

    const agentsSnap = await db.collection('agents').orderBy('createdAt', 'desc').limit(limit).get();
    const agents: any[] = [];

    for (const doc of agentsSnap.docs) {
      const data = doc.data();
      const services: string[] = [];

      const [wallet, email, credit, call] = await Promise.all([
        db.collection('wallets').doc(doc.id).get(),
        db.collection('emailAddresses').where('agentId', '==', doc.id).limit(1).get(),
        db.collection('creditLines').where('grantorId', '==', doc.id).limit(1).get(),
        db.collection('calls').where('agentId', '==', doc.id).limit(1).get(),
      ]);
      if (wallet.exists) services.push('moltbank');
      if (!email.empty) services.push('moltmail');
      if (!credit.empty) services.push('moltcredit');
      if (!call.empty) services.push('moltphone');

      agents.push({ handle: data.handle, services });
    }

    const total = (await db.collection('agents').count().get()).data().count;
    const page = parseInt(req.query.page as string) || 1;
    res.json({ agents, pagination: { page, limit, total, total_pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
});

// GET /directory/:handle
router.get('/directory/:handle', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { handle } = req.params;
    const db = getFirestore();

    const agentSnap = await db.collection('agents').where('handle', '==', handle).limit(1).get();
    if (agentSnap.empty) { res.status(404).json({ error: 'Agent not found' }); return; }
    const agentDoc = agentSnap.docs[0];
    const agent = agentDoc.data();

    const services: string[] = [];
    const [wallet, email, credit, call] = await Promise.all([
      db.collection('wallets').doc(agentDoc.id).get(),
      db.collection('emailAddresses').where('agentId', '==', agentDoc.id).limit(1).get(),
      db.collection('creditLines').where('grantorId', '==', agentDoc.id).limit(1).get(),
      db.collection('calls').where('agentId', '==', agentDoc.id).limit(1).get(),
    ]);
    if (wallet.exists) services.push('moltbank');
    if (!email.empty) services.push('moltmail');
    if (!credit.empty) services.push('moltcredit');
    if (!call.empty) services.push('moltphone');

    let walletBalanceTier = 'none';
    if (wallet.exists) {
      const bal = wallet.data()?.balance || 0;
      if (bal >= 10000) walletBalanceTier = 'high';
      else if (bal >= 1000) walletBalanceTier = 'medium';
      else if (bal > 0) walletBalanceTier = 'low';
    }

    res.json({ handle: agent.handle, name: agent.name, services, wallet_balance_tier: walletBalanceTier, created_at: agent.createdAt });
  } catch (err) { next(err); }
});

export default router;
