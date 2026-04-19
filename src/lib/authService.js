'use client';

// ============================================================================
// AUTH SERVICE — Firebase Authentication + Firestore user profiles
// Handles: login, registration, user profile CRUD, role management
// ============================================================================

import { auth, db } from './firebase';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    onAuthStateChanged,
    updateProfile,
    updatePassword,
    updateEmail,
} from 'firebase/auth';
import {
    doc, getDoc, setDoc, updateDoc, collection,
    query, where, getDocs, serverTimestamp,
} from 'firebase/firestore';

// ── Constants ────────────────────────────────────────────────────────────────
export const ROLES = {
    SUPER_ADMIN: 'superadmin',
    COMPANY_ADMIN: 'companyadmin',
};

export const STORAGE_TIERS = {
    free: { label: '500 MB', bytes: 500 * 1024 * 1024 },
    standard: { label: '1 GB', bytes: 1024 * 1024 * 1024 },
    premium: { label: '2 GB', bytes: 2 * 1024 * 1024 * 1024 },
};

// ── Login ─────────────────────────────────────────────────────────────────────
export async function loginWithEmail(email, password) {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const profile = await getUserProfile(credential.user.uid);
    if (!profile) {
        throw new Error('USER_PROFILE_NOT_FOUND');
    }
    if (profile.aktivan === false) {
        await signOut(auth);
        throw new Error('ACCOUNT_DEACTIVATED');
    }
    return { uid: credential.user.uid, ...profile };
}

// ── Registration ──────────────────────────────────────────────────────────────
export async function registerCompanyAdmin({ email, password, firstName, lastName, companyName, phone, city, address }) {
    // 1. Create Firebase Auth user
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = credential.user.uid;

    // 2. Update Firebase Auth display name
    await updateProfile(credential.user, {
        displayName: `${firstName} ${lastName}`.trim(),
    });

    // 3. Create company document in Firestore
    const companyRef = doc(collection(db, 'companies'));
    const companyData = {
        naziv: companyName || 'Nova firma',
        skraceniNaziv: companyName || 'Nova firma',
        adresa: address || '',
        mjesto: city || '',
        telefon: phone || '',
        email: email || '',
        aktivan: true,
        storageTier: 'free',
        storageUsedBytes: 0,
        createdAt: new Date().toISOString(),
        createdBy: uid,
    };
    await setDoc(companyRef, companyData);

    // 4. Create user profile in Firestore (keyed by auth UID)
    const userProfile = {
        email,
        firstName: firstName || '',
        lastName: lastName || '',
        role: ROLES.COMPANY_ADMIN,
        companyIds: [companyRef.id],
        aktivan: true,
        createdAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'users', uid), userProfile);

    return {
        uid,
        ...userProfile,
        companyId: companyRef.id,
        companyName: companyData.naziv,
    };
}

// ── User Profile ──────────────────────────────────────────────────────────────
export async function getUserProfile(uid) {
    if (!uid) return null;
    try {
        const snap = await getDoc(doc(db, 'users', uid));
        if (!snap.exists()) return null;
        return { id: snap.id, ...snap.data() };
    } catch (err) {
        console.error('[authService] Failed to get user profile:', err);
        return null;
    }
}

export async function updateUserProfile(uid, data) {
    await updateDoc(doc(db, 'users', uid), {
        ...data,
        updatedAt: new Date().toISOString(),
    });
}

// ── Password Reset ────────────────────────────────────────────────────────────
export async function resetPassword(email) {
    await sendPasswordResetEmail(auth, email);
}

export async function updateUserPassword(newPassword) {
    if (!auth.currentUser) throw new Error("No user is currently signed in to Firebase");
    await updatePassword(auth.currentUser, newPassword);
}

export async function updateUserEmail(newEmail) {
    if (!auth.currentUser) throw new Error("No user is currently signed in to Firebase");
    await updateEmail(auth.currentUser, newEmail);
}

export async function updateUserName(firstName, lastName) {
    if (!auth.currentUser) throw new Error("No user is currently signed in to Firebase");
    await updateProfile(auth.currentUser, { displayName: `${firstName} ${lastName}` });
}

// ── Profile Logic ────────────────────────────────────────────────────────────────────
export async function logoutUser() {
    await signOut(auth);
}

// ── Auth State Observer ───────────────────────────────────────────────────────
export function onAuthChange(callback) {
    return onAuthStateChanged(auth, callback);
}

// ── Company CRUD ──────────────────────────────────────────────────────────────
export async function getCompany(companyId) {
    if (!companyId) return null;
    try {
        const snap = await getDoc(doc(db, 'companies', companyId));
        if (!snap.exists()) return null;
        return { id: snap.id, ...snap.data() };
    } catch (err) {
        console.error('[authService] Failed to get company:', err);
        return null;
    }
}

export async function getUserCompanies(companyIds) {
    if (!companyIds || companyIds.length === 0) return [];
    const companies = [];
    for (const cid of companyIds) {
        const c = await getCompany(cid);
        if (c) companies.push(c);
    }
    return companies;
}

// ── Super Admin Helpers ───────────────────────────────────────────────────────
export async function createSuperAdmin(uid) {
    // Promote an existing user to super admin
    await updateDoc(doc(db, 'users', uid), {
        role: ROLES.SUPER_ADMIN,
        updatedAt: new Date().toISOString(),
    });
}

export async function getAllCompanies() {
    const snap = await getDocs(collection(db, 'companies'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Alias used by AuthContext for SuperAdmin company loading
export const getAllCompaniesFromFirestore = getAllCompanies;


export async function getAllUsers() {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Role Checks ───────────────────────────────────────────────────────────────
export function isSuperAdmin(user) {
    return user?.role === ROLES.SUPER_ADMIN;
}

export function isCompanyAdmin(user) {
    return user?.role === ROLES.COMPANY_ADMIN || user?.role === ROLES.SUPER_ADMIN;
}

export function canAccessCompany(user, companyId) {
    if (!user || !companyId) return false;
    if (isSuperAdmin(user)) return true;
    return (user.companyIds || []).includes(companyId);
}
