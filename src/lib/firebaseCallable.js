/**
 * firebaseCallable.js
 * 
 * Calls Firebase v2 (Cloud Run) functions through our Next.js proxy route.
 * This avoids all browser CORS and IAM issues — the call goes:
 *   Browser → /api/firebase-proxy (Vercel server) → Firebase Cloud Run
 * 
 * Usage:
 *   import { callFirebaseFunction } from '@/lib/firebaseCallable';


export async function callFirebaseFunction(name, data = {}) {
    const res = await fetch('/api/firebase-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ functionName: name, data }),
    });

    const json = await res.json();

    if (!res.ok) {
        throw new Error(json.error || `Firebase function ${name} failed (${res.status})`);
    }

    // Firebase onCall response format: { result: ... }
    return json.result ?? json;
}
