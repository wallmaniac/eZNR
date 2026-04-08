/**
 * WebAuthn helper — biometric login (fingerprint/face) for mobile.
 * Stores credential ID in localStorage. Works only on HTTPS.
 */

const STORAGE_KEY = 'eznr_webauthn_cred';
const USER_DATA_KEY = 'eznr_webauthn_user';

// RP (relying party) info
const RP = {
    name: 'eZNR - Zaštita na radu',
    id: typeof window !== 'undefined' ? window.location.hostname : 'localhost',
};

/**
 * Check if WebAuthn is available on this device
 */
export function isWebAuthnAvailable() {
    return (
        typeof window !== 'undefined' &&
        window.PublicKeyCredential !== undefined &&
        window.location.protocol === 'https:' // WebAuthn requires HTTPS
    );
}

/**
 * Check if a credential is already registered
 */
export function hasStoredCredential() {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem(STORAGE_KEY);
}

/**
 * Get the stored user data associated with the biometric credential
 */
export function getStoredBiometricUser() {
    if (typeof window === 'undefined') return null;
    try {
        return JSON.parse(localStorage.getItem(USER_DATA_KEY));
    } catch {
        return null;
    }
}

/**
 * Register a new credential (called after successful password login)
 * @param {string} userId 
 * @param {string} username
 * @param {object} userData — full user object to store for auto-login
 */
export async function registerCredential(userId, username, userData) {
    if (!isWebAuthnAvailable()) {
        throw new Error('WebAuthn not available');
    }

    // Create a challenge (in production this should come from the server)
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const userIdBytes = new TextEncoder().encode(userId);

    const credential = await navigator.credentials.create({
        publicKey: {
            rp: RP,
            user: {
                id: userIdBytes,
                name: username,
                displayName: username,
            },
            challenge,
            pubKeyCredParams: [
                { type: 'public-key', alg: -7 },   // ES256
                { type: 'public-key', alg: -257 },  // RS256
            ],
            authenticatorSelection: {
                authenticatorAttachment: 'platform', // Built-in (fingerprint/face)
                userVerification: 'required',
                residentKey: 'preferred',
            },
            timeout: 60000,
            attestation: 'none',
        },
    });

    // Store credential ID for later authentication
    const credentialId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
    localStorage.setItem(STORAGE_KEY, credentialId);
    localStorage.setItem(USER_DATA_KEY, JSON.stringify(userData));

    return credential;
}

/**
 * Authenticate with stored credential (biometric prompt)
 * Returns the stored user data on success, null on failure.
 */
export async function authenticateCredential() {
    if (!isWebAuthnAvailable() || !hasStoredCredential()) {
        return null;
    }

    const credentialId = localStorage.getItem(STORAGE_KEY);
    const rawId = Uint8Array.from(atob(credentialId), c => c.charCodeAt(0));

    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    try {
        const assertion = await navigator.credentials.get({
            publicKey: {
                challenge,
                rpId: RP.id,
                allowCredentials: [{
                    type: 'public-key',
                    id: rawId,
                    transports: ['internal'],
                }],
                userVerification: 'required',
                timeout: 60000,
            },
        });

        if (assertion) {
            return getStoredBiometricUser();
        }
    } catch (e) {
        console.warn('WebAuthn authentication failed:', e);
    }

    return null;
}

/**
 * Remove stored biometric credentials
 */
export function clearBiometricCredentials() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(USER_DATA_KEY);
}
