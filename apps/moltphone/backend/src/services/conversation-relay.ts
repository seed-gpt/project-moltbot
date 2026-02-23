import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HTTPServer } from 'node:http';
import { getFirestore } from '@moltbot/shared';
import { createLLMSession, type LLMSession } from './openai-llm.js';
import { getLogger, runInContext } from '../middleware/logger.js';

interface SessionState {
    callDocId: string;
    callSid: string;
    systemPrompt: string;
    errorMessage: string;
    llm: LLMSession;
    transcript: Array<{ role: string; content: string; timestamp: string }>;
}

/**
 * Attach the ConversationRelay WebSocket server to an existing HTTP server.
 */
export function attachConversationRelayWS(server: HTTPServer): WebSocketServer {
    const wss = new WebSocketServer({ server, path: '/ws/conversation-relay' });
    const bootLog = getLogger('conversation-relay');

    wss.on('connection', (ws: WebSocket) => {
        const connLog = getLogger('conversation-relay');
        connLog.info('WebSocket connection established');
        let session: SessionState | null = null;

        ws.on('message', async (data: Buffer) => {
            try {
                const msg = JSON.parse(data.toString());
                // Run inside the session's async context so getLogger() returns
                // a logger scoped to this call's ID
                const contextId = session?.callDocId || 'pre-setup';
                await runInContext(contextId, 'conversation-relay', () =>
                    handleMessage(ws, msg, session, (s) => { session = s; }),
                );
            } catch (err) {
                connLog.error('Error handling WebSocket message', { error: (err as Error).message });
            }
        });

        ws.on('close', async () => {
            const log = session
                ? getLogger('conversation-relay')
                : connLog;
            log.info('WebSocket closed');
            if (session) {
                await runInContext(session.callDocId, 'conversation-relay', () =>
                    saveTranscript(session!),
                );
            }
        });

        ws.on('error', (err) => {
            connLog.error('WebSocket error', { error: err.message });
        });
    });

    bootLog.info('WebSocket server attached at /ws/conversation-relay');
    return wss;
}

async function handleMessage(
    ws: WebSocket,
    msg: any,
    session: SessionState | null,
    setSession: (s: SessionState) => void,
): Promise<void> {
    const log = getLogger('conversation-relay');

    switch (msg.type) {
        case 'setup': {
            const params = msg.customParameters || {};
            const callDocId = params.callDocId || '';
            const systemPrompt = params.systemPrompt || 'You are a helpful AI phone assistant. Keep responses concise and conversational.';
            const errorMessage = params.errorMessage || 'I apologize, I encountered an issue. Could you please repeat that?';
            const model = params.model || undefined;

            log.info('Setup message received', {
                callSid: msg.callSid,
                direction: msg.direction,
                callDocId,
                model,
                from: msg.from,
                to: msg.to,
            });

            const llm = createLLMSession(systemPrompt, model);
            const newSession: SessionState = {
                callDocId,
                callSid: msg.callSid || '',
                systemPrompt,
                errorMessage,
                llm,
                transcript: [],
            };
            setSession(newSession);

            if (callDocId) {
                const db = getFirestore();
                await db.collection('calls').doc(callDocId).update({
                    status: 'in-progress',
                    updatedAt: new Date().toISOString(),
                });
                log.info('Call status updated to in-progress');
            }
            break;
        }

        case 'prompt': {
            if (!session) {
                log.error('Prompt received before setup');
                return;
            }

            const userText = msg.voicePrompt || '';
            if (!userText.trim()) return;

            log.info('Caller speech received', { text: userText });
            session.transcript.push({
                role: 'user',
                content: userText,
                timestamp: new Date().toISOString(),
            });

            let fullResponse = '';
            try {
                for await (const token of session.llm.generateResponse(userText)) {
                    fullResponse += token;
                    ws.send(JSON.stringify({ type: 'text', token, last: false }));
                }
                ws.send(JSON.stringify({ type: 'text', token: '', last: true }));

                // Detect [END_CALL] signal from the AI
                const shouldEndCall = fullResponse.includes('[END_CALL]');
                const cleanResponse = fullResponse.replace(/\[END_CALL\]/g, '').trim();

                session.transcript.push({
                    role: 'assistant',
                    content: cleanResponse,
                    timestamp: new Date().toISOString(),
                });

                log.info('AI response sent', { responseLength: cleanResponse.length, preview: cleanResponse.substring(0, 100), shouldEndCall });

                if (shouldEndCall) {
                    log.info('AI signaled END_CALL — hanging up');
                    // Save transcript before ending
                    await saveTranscript(session);
                    // Tell Twilio to end the call
                    ws.send(JSON.stringify({ type: 'end', handoffData: JSON.stringify({ reason: 'goal-completed' }) }));
                }
            } catch (err) {
                log.error('LLM error', { error: (err as Error).message });
                ws.send(JSON.stringify({
                    type: 'text',
                    token: session.errorMessage,
                    last: true,
                }));
            }
            break;
        }

        case 'interrupt': {
            log.info('Caller interrupted TTS', { utterance: msg.utteranceUntilInterrupt });
            break;
        }

        case 'dtmf': {
            log.info('DTMF digit received', { digit: msg.digit });
            break;
        }

        case 'error': {
            log.error('Error from Twilio ConversationRelay', { description: msg.description });
            break;
        }

        default: {
            log.info('Unknown message type', { type: msg.type, msg });
        }
    }
}

async function saveTranscript(session: SessionState): Promise<void> {
    if (!session.callDocId || session.transcript.length === 0) return;
    const log = getLogger('conversation-relay');

    try {
        const db = getFirestore();
        const batch = db.batch();

        for (const entry of session.transcript) {
            const ref = db.collection('calls').doc(session.callDocId).collection('transcripts').doc();
            batch.set(ref, entry);
        }

        await batch.commit();
        log.info('Transcript saved to Firestore', { entries: session.transcript.length, callDocId: session.callDocId });
    } catch (err) {
        log.error('Failed to save transcript', { error: (err as Error).message });
    }
}
