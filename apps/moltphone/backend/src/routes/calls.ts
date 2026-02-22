import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getFirestore, authMiddleware, AppError } from '@moltbot/shared';
import { createLogger, type Logger } from '../middleware/logger.js';

const router = express.Router();

/** Active call mode — defaults to LIVE_AI_AGENT */
const CALL_MODE = process.env.CALL_MODE || 'LIVE_AI_AGENT';

const callSchema = z.object({
  to_number: z.string().regex(/^\+[1-9]\d{1,14}$/, 'Must be E.164 format'),
  assistant_config: z.object({
    first_message: z.string().min(1),
    system_prompt: z.string().min(1),
    voice: z.string().optional(),
    model: z.string().optional(),
    error_message: z.string().optional(),
  }),
});

const webappCallSchema = z.object({
  phoneNumber: z.string().regex(/^\+[1-9]\d{1,14}$/, 'Must be E.164 format'),
  task: z.string().min(1),
  agentName: z.string().optional(),
});

// ── helpers ──────────────────────────────────────────────────────

function getLog(req: Request): Logger {
  return (req as any).log || createLogger('unknown', 'calls');
}

function getRequestId(req: Request): string {
  return (req as any).requestId || 'unknown';
}

function getTwilioConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;
  return { accountSid, authToken, fromNumber };
}

function validateTwilioConfig(res: Response, log: Logger): boolean {
  const { accountSid, authToken, fromNumber } = getTwilioConfig();
  if (!accountSid || !authToken || !fromNumber) {
    log.error('Twilio not configured', { accountSid: !!accountSid, authToken: !!authToken, fromNumber: !!fromNumber });
    res.status(503).json({ error: 'Voice calling service is not configured' });
    return false;
  }
  return true;
}

function validateLiveAIConfig(res: Response, log: Logger): boolean {
  if (CALL_MODE === 'LIVE_AI_AGENT') {
    if (!process.env.OPENAI_API_KEY) {
      log.error('OPENAI_API_KEY not set for LIVE_AI_AGENT mode');
      res.status(503).json({ error: 'Live AI agent requires OPENAI_API_KEY' });
      return false;
    }
    if (!process.env.APP_BASE_URL) {
      log.error('APP_BASE_URL not set for LIVE_AI_AGENT mode');
      res.status(503).json({ error: 'Live AI agent requires APP_BASE_URL' });
      return false;
    }
  }
  return true;
}

/** Build TwiML XML for RECORDED_MESSAGE mode */
function buildRecordedTwiml(message: string, voice: string = 'alice'): string {
  const escaped = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<Response><Say voice="${voice}">${escaped}</Say><Pause length="2"/><Say voice="${voice}">Thank you for your time. Goodbye.</Say></Response>`;
}

/** Place a call using Twilio REST API with inline TwiML (RECORDED_MESSAGE) */
async function placeRecordedCall(to: string, twiml: string, log: Logger) {
  const { accountSid, authToken, fromNumber } = getTwilioConfig();
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  const params = new URLSearchParams();
  params.append('To', to);
  params.append('From', fromNumber!);
  params.append('Twiml', twiml);

  log.info('Placing RECORDED_MESSAGE call via Twilio', { to, from: fromNumber });

  const resp = await fetch(twilioUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const data = await resp.json();
  log.info('Twilio response for RECORDED_MESSAGE', { status: resp.status, sid: data.sid, twilioStatus: data.status });
  return { response: resp, data };
}

/** Place a call using Twilio REST API with webhook URL (LIVE_AI_AGENT) */
async function placeLiveAICall(to: string, callDocId: string, log: Logger) {
  const { accountSid, authToken, fromNumber } = getTwilioConfig();
  const appBaseUrl = process.env.APP_BASE_URL!;
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  const webhookUrl = `${appBaseUrl}/twiml/conversation-relay?callDocId=${callDocId}`;
  const statusCallbackUrl = `${appBaseUrl}/webhooks/twilio-status`;

  const params = new URLSearchParams();
  params.append('To', to);
  params.append('From', fromNumber!);
  params.append('Url', webhookUrl);
  params.append('StatusCallback', statusCallbackUrl);
  params.append('StatusCallbackEvent', 'initiated ringing answered completed');
  params.append('StatusCallbackMethod', 'POST');

  log.info('Placing LIVE_AI_AGENT call via Twilio', {
    to, from: fromNumber, webhookUrl, statusCallbackUrl, callDocId,
  });

  const resp = await fetch(twilioUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const data = await resp.json();
  log.info('Twilio response for LIVE_AI_AGENT', { status: resp.status, sid: data.sid, twilioStatus: data.status, error: data.message });
  return { response: resp, data };
}

// ── POST /call/webapp ────────────────────────────────────────────

router.post('/call/webapp', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const log = getLog(req);
  const requestId = getRequestId(req);
  try {
    const body = webappCallSchema.parse(req.body);
    log.info('POST /call/webapp received', { mode: CALL_MODE, to: body.phoneNumber, task: body.task, requestId });

    if (!validateTwilioConfig(res, log)) return;
    if (!validateLiveAIConfig(res, log)) return;

    const db = getFirestore();
    const agentName = body.agentName || 'an AI assistant';

    if (CALL_MODE === 'LIVE_AI_AGENT') {
      log.info('Using LIVE_AI_AGENT mode');

      const callRef = await db.collection('calls').add({
        agentId: 'webapp',
        direction: 'outbound',
        toNumber: body.phoneNumber,
        status: 'queued',
        mode: 'LIVE_AI_AGENT',
        task: body.task,
        requestId,
        assistantConfig: {
          first_message: `Hello, this is ${agentName} calling from MoltPhone. ${body.task}`,
          system_prompt: `You are ${agentName}, a professional AI phone assistant from MoltPhone. Your task: ${body.task}. Be polite, concise, and professional. If the person asks questions, answer helpfully. When the task is complete, thank them and say goodbye.`,
          error_message: 'I apologize, I encountered a brief issue. Could you please repeat that?',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      log.info('Call record created in Firestore', { callDocId: callRef.id });

      const { response: twilioResponse, data: twilioData } = await placeLiveAICall(body.phoneNumber, callRef.id, log);

      if (!twilioResponse.ok) {
        await db.collection('calls').doc(callRef.id).delete();
        log.error('Twilio API error — deleting call record', { twilioError: twilioData });
        res.status(twilioResponse.status).json({
          error: twilioData.message || 'Failed to initiate call via Twilio',
          code: twilioData.code,
        });
        return;
      }

      await db.collection('calls').doc(callRef.id).update({
        twilioCallSid: twilioData.sid,
        updatedAt: new Date().toISOString(),
      });

      log.info('LIVE_AI_AGENT call placed successfully', { callDocId: callRef.id, twilioCallSid: twilioData.sid });

      res.status(201).json({
        callId: callRef.id,
        twilioCallSid: twilioData.sid,
        status: twilioData.status || 'queued',
        to_number: body.phoneNumber,
        direction: 'outbound',
        mode: 'LIVE_AI_AGENT',
      });
    } else {
      log.info('Using RECORDED_MESSAGE mode');

      const greeting = `Hello, this is ${agentName} calling from MoltPhone. ${body.task}`;
      const twiml = buildRecordedTwiml(greeting);
      const { response: twilioResponse, data: twilioData } = await placeRecordedCall(body.phoneNumber, twiml, log);

      if (!twilioResponse.ok) {
        log.error('Twilio API error', { twilioError: twilioData });
        res.status(twilioResponse.status).json({
          error: twilioData.message || 'Failed to initiate call via Twilio',
          code: twilioData.code,
        });
        return;
      }

      const callRef = await db.collection('calls').add({
        agentId: 'webapp',
        direction: 'outbound',
        toNumber: body.phoneNumber,
        status: 'queued',
        mode: 'RECORDED_MESSAGE',
        twilioCallSid: twilioData.sid,
        task: body.task,
        requestId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      log.info('RECORDED_MESSAGE call placed successfully', { callDocId: callRef.id, twilioCallSid: twilioData.sid });

      res.status(201).json({
        callId: callRef.id,
        twilioCallSid: twilioData.sid,
        status: twilioData.status || 'queued',
        to_number: body.phoneNumber,
        direction: 'outbound',
        mode: 'RECORDED_MESSAGE',
      });
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      log.warn('Validation failed', { errors: err.errors });
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    log.error('Unhandled error in POST /call/webapp', { error: (err as Error).message });
    next(err);
  }
});

// ── POST /call ───────────────────────────────────────────────────

router.post('/call', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const log = getLog(req);
  const requestId = getRequestId(req);
  try {
    const agent = (req as any).agent;
    const body = callSchema.parse(req.body);
    const db = getFirestore();

    log.info('POST /call received', { mode: CALL_MODE, to: body.to_number, agentId: agent.id, requestId });

    if (!validateTwilioConfig(res, log)) return;
    if (!validateLiveAIConfig(res, log)) return;

    // Deduct 1 token via transaction
    const balRef = db.collection('tokenBalances').doc(agent.id);
    const newBalance = await db.runTransaction(async (tx) => {
      const balDoc = await tx.get(balRef);
      const current = balDoc.exists ? (balDoc.data()?.balance || 0) : 0;
      if (current < 1) return -1;
      const updated = current - 1;
      tx.set(balRef, { agentId: agent.id, balance: updated, updatedAt: new Date().toISOString() }, { merge: true });
      return updated;
    });

    if (newBalance < 0) {
      log.warn('Insufficient token balance', { agentId: agent.id });
      res.status(402).json({ error: 'Insufficient token balance', balance: 0 });
      return;
    }

    log.info('Token deducted', { agentId: agent.id, newBalance });

    const refundToken = async () => {
      await db.runTransaction(async (tx) => {
        const balDoc = await tx.get(balRef);
        const current = balDoc.exists ? (balDoc.data()?.balance || 0) : 0;
        tx.set(balRef, { agentId: agent.id, balance: current + 1, updatedAt: new Date().toISOString() }, { merge: true });
      });
      log.info('Token refunded due to Twilio failure', { agentId: agent.id });
    };

    if (CALL_MODE === 'LIVE_AI_AGENT') {
      log.info('Using LIVE_AI_AGENT mode');

      const callRef = await db.collection('calls').add({
        agentId: agent.id,
        direction: 'outbound',
        toNumber: body.to_number,
        status: 'queued',
        mode: 'LIVE_AI_AGENT',
        requestId,
        assistantConfig: body.assistant_config,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      log.info('Call record created', { callDocId: callRef.id });

      const { response: twilioResponse, data: twilioData } = await placeLiveAICall(body.to_number, callRef.id, log);

      if (!twilioResponse.ok) {
        await refundToken();
        await db.collection('calls').doc(callRef.id).delete();
        log.error('Twilio API error', { twilioError: twilioData });
        res.status(twilioResponse.status).json({
          error: twilioData.message || 'Failed to initiate call via Twilio',
          code: twilioData.code,
        });
        return;
      }

      await db.collection('calls').doc(callRef.id).update({
        twilioCallSid: twilioData.sid,
        updatedAt: new Date().toISOString(),
      });

      log.info('LIVE_AI_AGENT call placed successfully', { callDocId: callRef.id, twilioCallSid: twilioData.sid });

      res.status(201).json({
        call: {
          id: callRef.id,
          status: twilioData.status || 'queued',
          to_number: body.to_number,
          direction: 'outbound',
          twilioCallSid: twilioData.sid,
          mode: 'LIVE_AI_AGENT',
        },
        remaining_balance: newBalance,
      });
    } else {
      log.info('Using RECORDED_MESSAGE mode');

      const greeting = body.assistant_config.first_message;
      const twiml = buildRecordedTwiml(greeting, body.assistant_config.voice);
      const { response: twilioResponse, data: twilioData } = await placeRecordedCall(body.to_number, twiml, log);

      if (!twilioResponse.ok) {
        await refundToken();
        log.error('Twilio API error', { twilioError: twilioData });
        res.status(twilioResponse.status).json({
          error: twilioData.message || 'Failed to initiate call via Twilio',
          code: twilioData.code,
        });
        return;
      }

      const callRef = await db.collection('calls').add({
        agentId: agent.id,
        direction: 'outbound',
        toNumber: body.to_number,
        status: 'queued',
        mode: 'RECORDED_MESSAGE',
        twilioCallSid: twilioData.sid,
        requestId,
        assistantConfig: body.assistant_config,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      log.info('RECORDED_MESSAGE call placed successfully', { callDocId: callRef.id, twilioCallSid: twilioData.sid });

      res.status(201).json({
        call: {
          id: callRef.id,
          status: twilioData.status || 'queued',
          to_number: body.to_number,
          direction: 'outbound',
          twilioCallSid: twilioData.sid,
          mode: 'RECORDED_MESSAGE',
        },
        remaining_balance: newBalance,
      });
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    next(err);
  }
});

// ── GET /calls ───────────────────────────────────────────────────

router.get('/calls', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const db = getFirestore();

    const snapshot = await db.collection('calls')
      .where('agentId', '==', agent.id)
      .orderBy('createdAt', 'desc').limit(limit).get();

    const calls = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ calls });
  } catch (err) { next(err); }
});

// ── POST /call/end/:id ───────────────────────────────────────────

router.post('/call/end/:id', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const { id } = req.params;
    const db = getFirestore();

    const callDoc = await db.collection('calls').doc(id).get();
    if (!callDoc.exists) throw new AppError(404, 'Call not found');
    if (callDoc.data()?.agentId !== agent.id) throw new AppError(403, 'Access denied');

    await db.collection('calls').doc(id).update({
      status: 'ended', endedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });

    res.json({ success: true, call_id: id, status: 'ended' });
  } catch (err) { next(err); }
});

// ── GET /calls/stats ─────────────────────────────────────────────

router.get('/calls/stats', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const db = getFirestore();

    const all = await db.collection('calls').where('agentId', '==', agent.id).get();
    let total = 0, completed = 0, failed = 0;
    all.docs.forEach(doc => {
      total++;
      const s = doc.data().status;
      if (s === 'ended' || s === 'completed') completed++;
      else if (s === 'failed' || s === 'error') failed++;
    });

    res.json({ total_calls: total, completed_calls: completed, failed_calls: failed, in_progress: total - completed - failed });
  } catch (err) { next(err); }
});

// ── GET /calls/:id ───────────────────────────────────────────────

router.get('/calls/:id', authMiddleware(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const agent = (req as any).agent;
    const { id } = req.params;
    const db = getFirestore();

    const callDoc = await db.collection('calls').doc(id).get();
    if (!callDoc.exists) throw new AppError(404, 'Call not found');
    if (callDoc.data()?.agentId !== agent.id) throw new AppError(403, 'Access denied');

    res.json({ call: { id: callDoc.id, ...callDoc.data() } });
  } catch (err) { next(err); }
});

export default router;
