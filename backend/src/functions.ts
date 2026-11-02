import { onRequest } from 'firebase-functions/v2/https';
import { app } from './app';

/**
 * Firebase Cloud Functions 2nd Generation HTTP Trigger
 * 
 * Exports the QuestAI Express application as a 2nd Generation Cloud Function.
 * Ready for future deployment without modifying the underlying Express app logic.
 * 
 * To deploy in the future:
 *   firebase deploy --only functions:questAiApi
 */
export const questAiApi = onRequest(
  {
    region: 'us-central1',
    cors: false, // Managed internally by the Express CORS middleware
    maxInstances: 10,
    memory: '512MiB',
    timeoutSeconds: 60,
  },
  app
);

