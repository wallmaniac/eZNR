'use client';

// ============================================================================
// FIRESTORE SESSION HELPERS
// Questionnaire & Training session management (tokens, dispatch, responses)
// 
// NOTE: The legacy localStorage→Firestore sync functions were removed.
// All CRUD operations now go through dataStore.js which writes to Firestore
// automatically on every create/update/delete.
// ============================================================================

import { db } from './firebase';
import {
    collection as fsCollection,
    doc,
    getDocs,
    deleteDoc,
    setDoc,
} from 'firebase/firestore';



// ─── Questionnaire session helpers (for email dispatch feature) ───────────────
export async function createQuestionnaireSession(session) {
    const ref = doc(fsCollection(db, 'questionnaire_sessions'));
    const raw = {
        ...session,
        id: ref.id,
        createdAt: new Date().toISOString(),
        status: 'sent', // sent | opened | completed | expired
    };
    // Sanitize: Firestore rejects undefined values
    const data = sanitize(raw);
    await setDoc(ref, data);
    return data;
}

export async function getQuestionnaireSession(token) {
    const { getDocs, query, where } = await import('firebase/firestore');
    const q = query(
        fsCollection(db, 'questionnaire_sessions'),
        where('token', '==', token)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return snap.docs[0].data();
}

// Strip undefined values from an object (Firestore rejects undefined)
function sanitize(obj) {
    if (obj === undefined) return null;
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(sanitize);
    return Object.fromEntries(
        Object.entries(obj)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, sanitize(v)])
    );
}

export async function saveQuestionnaireResponse(sessionId, answers, grade = null) {
    const ref = doc(db, 'questionnaire_responses', sessionId);
    await setDoc(ref, sanitize({
        sessionId,
        answers,
        grade, // may include details array — sanitized so no undefined values
        submittedAt: new Date().toISOString(),
    }));
    // Also update session status (only store summary, not full details)
    const sessionRef = doc(db, 'questionnaire_sessions', sessionId);
    await setDoc(sessionRef, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        grade: grade ? { percentage: grade.percentage, passed: grade.passed } : null,
    }, { merge: true });
}

// ─── Get all sessions for a specific questionnaire ───────────────────────────
export async function getSessionsForQuestionnaire(questionnaireId) {
    const { getDocs, query, where, orderBy } = await import('firebase/firestore');
    try {
        const q = query(
            fsCollection(db, 'questionnaire_sessions'),
            where('questionnaireId', '==', questionnaireId),
            orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data());
    } catch (err) {
        // If index not ready, fallback without orderBy
        console.warn('Falling back to unordered query:', err.message);
        const q = query(
            fsCollection(db, 'questionnaire_sessions'),
            where('questionnaireId', '==', questionnaireId)
        );
        const snap = await getDocs(q);
        const results = snap.docs.map(d => d.data());
        results.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        return results;
    }
}

// ─── Mark a session as opened (when worker opens the link) ───────────────────
export async function markSessionOpened(sessionId) {
    const sessionRef = doc(db, 'questionnaire_sessions', sessionId);
    await setDoc(sessionRef, {
        status: 'opened',
        openedAt: new Date().toISOString(),
    }, { merge: true });
}

// ─── Get a specific questionnaire response ───────────────────────────────────
export async function getQuestionnaireResponse(sessionId) {
    const { getDoc } = await import('firebase/firestore');
    const ref = doc(db, 'questionnaire_responses', sessionId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return snap.data();
}

// ─── Generate a unique token for questionnaire sessions ──────────────────────
export function generateToken() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    const array = new Uint8Array(24);
    if (typeof window !== 'undefined' && window.crypto) {
        window.crypto.getRandomValues(array);
        for (let i = 0; i < 24; i++) {
            token += chars[array[i] % chars.length];
        }
    } else {
        for (let i = 0; i < 24; i++) {
            token += chars[Math.floor(Math.random() * chars.length)];
        }
    }
    return token;
}

// ─── Training session helpers (for training module dispatch) ─────────────────
export async function createTrainingSession(session) {
    const ref = doc(fsCollection(db, 'training_sessions'));
    const data = {
        ...session,
        id: ref.id,
        createdAt: new Date().toISOString(),
        status: 'sent', // sent | opened | completed
    };
    await setDoc(ref, data);
    return data;
}

export async function getTrainingSession(token) {
    const { getDocs, query, where } = await import('firebase/firestore');
    const q = query(
        fsCollection(db, 'training_sessions'),
        where('token', '==', token)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return snap.docs[0].data();
}

export async function saveTrainingResponse(sessionId, answers, grade = null) {
    const ref = doc(db, 'training_responses', sessionId);
    await setDoc(ref, sanitize({
        sessionId,
        answers,
        grade,
        submittedAt: new Date().toISOString(),
    }));
    const sessionRef = doc(db, 'training_sessions', sessionId);
    await setDoc(sessionRef, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        grade: grade ? { percentage: grade.percentage, passed: grade.passed } : null,
    }, { merge: true });
}

export async function markTrainingSessionOpened(sessionId) {
    const sessionRef = doc(db, 'training_sessions', sessionId);
    await setDoc(sessionRef, {
        status: 'opened',
        openedAt: new Date().toISOString(),
    }, { merge: true });
}

export async function getSessionsForTraining(trainingId) {
    const { getDocs, query, where, orderBy } = await import('firebase/firestore');
    try {
        const q = query(
            fsCollection(db, 'training_sessions'),
            where('trainingId', '==', trainingId),
            orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data());
    } catch (err) {
        const q = query(
            fsCollection(db, 'training_sessions'),
            where('trainingId', '==', trainingId)
        );
        const snap = await getDocs(q);
        const results = snap.docs.map(d => d.data());
        results.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        return results;
    }
}

export async function getTrainingResponse(sessionId) {
    const { getDoc } = await import('firebase/firestore');
    const ref = doc(db, 'training_responses', sessionId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return snap.data();
}
