/**
 * firebaseCallable.js
 * 
 * Calls Firebase v2 (Cloud Run) functions through our Next.js proxy route.
 * This avoids all browser CORS and IAM issues — the call goes:
 *   Browser → /api/firebase-proxy (Vercel server) → Firebase Cloud Run
 * 
 * Usage:
 *   import { callFirebaseFunction } from '@/lib/firebaseCallable';

import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '@/lib/firebase';

export async function callFirebaseFunction(name, data = {}) {
    try {
        const functions = getFunctions(app, 'europe-west1');
        const callable = httpsCallable(functions, name);
        const result = await callable(data);
        return result.data;
    } catch (error) {
        console.error(`Firebase function ${name} failed:`, error);
        throw error;
    }
}
