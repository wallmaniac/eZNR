/**
 * WebAuthn helper — biometric login (fingerprint/face) for mobile.
 * Stores credential IDs in localStorage. Works only on HTTPS.
 */

const CREDENTIALS_KEY = 'eznr_webauthn_creds';

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

// Migrate legacy single credential if it exists
function migrateLegacyCredential() {
    if (typeof window === 'undefined') return;
    const legacyCred = localStorage.getItem('eznr_webauthn_cred');
    const legacyUserStr = localStorage.getItem('eznr_webauthn_user');
    if (legacyCred && legacyUserStr) {
        try {
            const legacyUser = JSON.parse(legacyUserStr);
            const creds = getStoredCredentials();
            if (!creds.some(c => c.userData.id === legacyUser.id)) {
                creds.push({ credentialId: legacyCred, userData: legacyUser });
                localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(creds));
            }
        } catch(e) {}
        localStorage.removeItem('eznr_webauthn_cred');
        localStorage.removeItem('eznr_webauthn_user');
    }
}

export function getStoredCredentials() {
    if (typeof window === 'undefined') return [];
    try {
        return JSON.parse(localStorage.getItem(CREDENTIALS_KEY)) || [];
    } catch {
        return [];
    }
}

/**
 * Check if ANY credential is saved on the device
 */
export function hasStoredCredential() {
    migrateLegacyCredential();
    return getStoredCredentials().length > 0;
}

/**
 * Check if a credential is saved for a specific user ID
 */
export function hasStoredCredentialForUser(userId) {
    migrateLegacyCredential();
    return getStoredCredentials().some(c => c.userData && c.userData.id === userId);
}

/**
 * Register a new credential (called after successful password login)
 */
export async function registerCredential(userId, username, userData) {
    if (!isWebAuthnAvailable()) {
        throw new Error('WebAuthn not available');
    }
    migrateLegacyCredential();

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
                authenticatorAttachment: 'platform',
                userVerification: 'required',
                residentKey: 'preferred',
            },
            timeout: 60000,
            attestation: 'none',
        },
    });

    const credentialId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
    
    // Add to list of credentials
    let creds = getStoredCredentials();
    // Remove existing credential for this user if they are re-enrolling
    creds = creds.filter(c => c.userData.id !== userId);
    creds.push({ credentialId, userData });
    localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(creds));

    return credential;
}

/**
 * Authenticate with stored credential (biometric prompt)
 */
export async function authenticateCredential() {
    if (!isWebAuthnAvailable() || !hasStoredCredential()) {
        return null;
    }

    const creds = getStoredCredentials();
    const allowCredentials = creds.map(c => ({
        type: 'public-key',
        id: Uint8Array.from(atob(c.credentialId), ch => ch.charCodeAt(0))
    }));

    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    try {
        const assertion = await navigator.credentials.get({
            publicKey: {
                challenge,
                rpId: RP.id,
                allowCredentials,
                userVerification: 'required',
                timeout: 60000,
            },
        });

        if (assertion) {
            const usedCredId = btoa(String.fromCharCode(...new Uint8Array(assertion.rawId)));
            const match = creds.find(c => c.credentialId === usedCredId);
            return match ? match.userData : null;
        }
    } catch (e) {
        console.warn('WebAuthn authentication failed:', e);
    }

    return null;
}

/**
 * Remove stored biometric credentials for a specific user
 */
export function clearBiometricCredentialForUser(userId) {
    migrateLegacyCredential();
    let creds = getStoredCredentials();
    creds = creds.filter(c => c.userData.id !== userId);
    localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(creds));
}

/**
 * Clear all biometric credentials on the device
 */
export function clearAllBiometricCredentials() {
    localStorage.removeItem(CREDENTIALS_KEY);
    localStorage.removeItem('eznr_webauthn_cred');
    localStorage.removeItem('eznr_webauthn_user');
}
