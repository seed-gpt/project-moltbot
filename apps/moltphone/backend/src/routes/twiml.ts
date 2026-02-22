import express, { Request, Response, NextFunction } from 'express';
import { getFirestore } from '@moltbot/shared';
import twilio from 'twilio';
import { getLogger } from '../middleware/logger.js';

const router = express.Router();
const VoiceResponse = twilio.twiml.VoiceResponse;

/**
 * GET/POST /twiml/conversation-relay
 * Twilio calls this webhook when the outbound call connects.
 */
router.all('/twiml/conversation-relay', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const log = getLogger('twiml');
    try {
        const callDocId = (req.query.callDocId || req.body?.callDocId || '') as string;
        log.info('TwiML webhook hit by Twilio', { callDocId, method: req.method, query: req.query, body: req.body });

        const db = getFirestore();

        let systemPrompt = 'You are a helpful AI phone assistant. Keep responses concise and conversational.';
        let welcomeGreeting = 'Hello! I am your AI assistant. How can I help you today?';
        let errorMessage = 'I apologize, I encountered an issue. Could you please repeat that?';

        if (callDocId) {
            const callDoc = await db.collection('calls').doc(callDocId).get();
            if (callDoc.exists) {
                const data = callDoc.data()!;
                log.info('Loaded call config from Firestore', { callDocId, hasAssistantConfig: !!data.assistantConfig, hasTask: !!data.task });
                if (data.assistantConfig?.system_prompt) {
                    systemPrompt = data.assistantConfig.system_prompt;
                }
                if (data.assistantConfig?.first_message) {
                    welcomeGreeting = data.assistantConfig.first_message;
                }
                if (data.task) {
                    welcomeGreeting = `Hello, this is an AI assistant calling from MoltPhone. ${data.task}`;
                }
                if (data.assistantConfig?.error_message) {
                    errorMessage = data.assistantConfig.error_message;
                }
            } else {
                log.warn('Call document not found in Firestore', { callDocId });
            }
        }

        const appBaseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
        const wsUrl = appBaseUrl.replace(/^http/, 'ws') + '/ws/conversation-relay';

        log.info('Generating ConversationRelay TwiML', { wsUrl, welcomeGreeting: welcomeGreeting.substring(0, 80), appBaseUrl });

        const response = new VoiceResponse();
        const connect = response.connect({
            action: `${appBaseUrl}/webhooks/twilio-connect-action`,
        });
        const conversationRelay = connect.conversationRelay({
            url: wsUrl,
            welcomeGreeting,
        });
        conversationRelay.parameter({ name: 'callDocId', value: callDocId });
        conversationRelay.parameter({ name: 'systemPrompt', value: systemPrompt });
        conversationRelay.parameter({ name: 'errorMessage', value: errorMessage });

        const twimlStr = response.toString();
        log.info('TwiML response generated', { twiml: twimlStr.substring(0, 200) });

        res.type('text/xml');
        res.send(twimlStr);
    } catch (err) {
        log.error('Error generating TwiML', { error: (err as Error).message });
        next(err);
    }
});

export default router;
