/**
 * Universal Firebase Functions proxy.
 * Uses Firebase Admin SDK to get a valid Google OAuth token,
 * then calls Firebase v2 Cloud Run functions server-to-server.
 * 
 * POST /api/firebase-proxy
 * Body: { functionName: string, data: object }
 */

export const maxDuration = 300;

// Cache the token to avoid re-fetching on every request
let cachedToken = null;
let tokenExpiry = 0;

async function getGoogleAuthToken() {
    // Return cached token if still valid (with 5 min buffer)
    if (cachedToken && Date.now() < tokenExpiry - 300000) {
        return cachedToken;
    }

    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKeyRaw = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
    
    if (!clientEmail || !privateKeyRaw) {
        throw new Error('Firebase Admin credentials not configured (FIREBASE_ADMIN_CLIENT_EMAIL / FIREBASE_ADMIN_PRIVATE_KEY)');
    }

    const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

    // Build JWT for Google OAuth2
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 3600;
    const audience = 'https://oauth2.googleapis.com/token';
    const scope = 'https://www.googleapis.com/auth/cloud-platform';

    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
        iss: clientEmail,
        sub: clientEmail,
        aud: audience,
        iat: now,
        exp,
        scope,
    };

    const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
    const signingInput = `${b64(header)}.${b64(payload)}`;

    // Sign with private key using Web Crypto API (available in Edge/Node)
    const keyData = privateKey
        .replace('-----BEGIN PRIVATE KEY-----', '')
        .replace('-----END PRIVATE KEY-----', '')
        .replace(/\s/g, '');

    const binaryKey = Buffer.from(keyData, 'base64');
    const cryptoKey = await crypto.subtle.importKey(
        'pkcs8',
        binaryKey,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        cryptoKey,
        Buffer.from(signingInput)
    );

    const jwt = `${signingInput}.${Buffer.from(signature).toString('base64url')}`;

    // Exchange JWT for access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: jwt,
        }),
    });

    if (!tokenRes.ok) {
        const err = await tokenRes.text();
        throw new Error(`Failed to get Google auth token: ${err.substring(0, 200)}`);
    }

    const tokenData = await tokenRes.json();
    cachedToken = tokenData.access_token;
    tokenExpiry = Date.now() + (tokenData.expires_in * 1000);
    
    return cachedToken;
}

export async function POST(req) {
    try {
        const body = await req.json();
        const { functionName, data } = body;

        if (!functionName) {
            return new Response(JSON.stringify({ error: 'functionName is required' }), { status: 400 });
        }

        // Get authenticated token
        const token = await getGoogleAuthToken();

        // Call Firebase v2 Cloud Run function with auth
        const url = `https://europe-west1-eznr-ee559.cloudfunctions.net/${functionName}`;

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ data: data ?? {} }),
        });

        const text = await res.text();

        if (!res.ok) {
            console.error(`[firebase-proxy] ${functionName} failed (${res.status}):`, text.substring(0, 300));
            let errMsg = 'Firebase function error';
            try {
                const errJson = JSON.parse(text);
                errMsg = errJson.error?.message || errJson.message || errMsg;
            } catch {}
            return new Response(JSON.stringify({ error: errMsg }), { status: res.status });
        }

        return new Response(text, {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('[firebase-proxy] Error:', error.message);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
