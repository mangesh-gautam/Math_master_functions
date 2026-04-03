import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getDatabase } from 'firebase-admin/database';

// Initialize the app if it hasn't been initialized already
// In firebase-admin v13, initializeApp is idempotent if called with the same arguments,
// but checking getApps() is a safe and standard pattern for Cloud Functions.
const app = getApps().length === 0 ? initializeApp() : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const rtdb = getDatabase(app);

export default app;
