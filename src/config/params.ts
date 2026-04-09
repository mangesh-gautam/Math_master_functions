import { defineSecret } from 'firebase-functions/params';

/**
 * Secret definition for the Firebase Web API Key.
 * Found in Firebase Console > Project Settings > General.
 * Set in production using: firebase functions:secrets:set FB_API_KEY
 */
export const fbApiKeySecret = defineSecret('FB_API_KEY');
export const adminAuthSecret = defineSecret("ADMIN_AUTH_SECRET");
