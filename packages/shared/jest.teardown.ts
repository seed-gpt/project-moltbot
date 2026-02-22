/**
 * Shared Jest setup — terminates Firestore gRPC connections when the process exits.
 * Register via `setupFiles` in jest.config.js to prevent open-handle exit failures.
 */
import { terminateFirestore } from './src/firestore.js';

// Use beforeExit (not exit) so we can do async cleanup before Node shuts down
process.on('beforeExit', async () => {
    await terminateFirestore();
});
