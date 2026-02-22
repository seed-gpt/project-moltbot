import 'dotenv/config';
import { createServer } from 'node:http';
import { createApp } from './app.js';
import { attachConversationRelayWS } from './services/conversation-relay.js';
import { getLogger } from './middleware/logger.js';

const PORT = process.env.PORT || 3003;
const app = createApp();
const server = createServer(app);

// Attach ConversationRelay WebSocket server
const CALL_MODE = process.env.CALL_MODE || 'LIVE_AI_AGENT';
if (CALL_MODE === 'LIVE_AI_AGENT') {
  attachConversationRelayWS(server);
}

const log = getLogger('bootstrap');
server.listen(PORT, () => {
  log.info(`Moltphone service listening on port ${PORT}`, { port: PORT, mode: CALL_MODE });
});
