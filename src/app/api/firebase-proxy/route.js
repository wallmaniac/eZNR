/**
 * Universal Firebase Functions proxy.
 * Calls Firebase v2 functions server-side (no CORS issues)
 * and returns the result to the browser.
 * 
 * POST /api/firebase-proxy
 * Body: { functionName: string, data: object }
 */

export const maxDuration = 300; // 5 minutes for AI tasks

export async function POST(req) {
    try {
        const body = await req.json();
        const { functionName, data } = body;

        if (!functionName) {
            return new Response(JSON.stringify({ error: 'functionName is required' }), { status: 400 });
        }

        // Server-side call to Firebase Cloud Run — no CORS, no IAM issues
        const url = `https://europe-west1-eznr-ee559.cloudfunctions.net/${functionName}`;

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Pass along a service account token if needed, or rely on private network
            },
            body: JSON.stringify({ data: data ?? {} }),
        });

        const text = await res.text();

        if (!res.ok) {
            console.error(`[firebase-proxy] ${functionName} failed (${res.status}):`, text.substring(0, 300));
            
            // Try to parse error message from Firebase
            let errMsg = 'Firebase function error';
            try {
                const errJson = JSON.parse(text);
                errMsg = errJson.error?.message || errJson.message || errMsg;
            } catch {}
            
            return new Response(JSON.stringify({ error: errMsg }), { status: res.status });
        }

        // Return the response as-is
        return new Response(text, {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('[firebase-proxy] Error:', error.message);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
