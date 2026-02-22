import 'dotenv/config';
import { createServer } from 'node:http';
import { createApp } from './app.js';
import { attachConversationRelayWS } from './services/conversation-relay.js';

const PORT = process.env.PORT || 3003;
const app = createApp();
const server = createServer(app);

// Attach ConversationRelay WebSocket server
const CALL_MODE = process.env.CALL_MODE || 'LIVE_AI_AGENT';
if (CALL_MODE === 'LIVE_AI_AGENT') {
  attachConversationRelayWS(server);
}

server.listen(PORT, () => {
  console.log(`Moltphone service listening on port ${PORT} (mode: ${CALL_MODE})`);
});
