import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '@/lib/firebase';

/**
 * Call the Zia AI assistant server endpoint.
 * @param {Object} payload 
 * @param {Array} payload.messages - Chat history messages
 * @param {String} payload.systemPrompt - The system prompt
 * @param {Array} payload.tools - Optional function calling tools
 * @returns {Promise<Object>} The response data { text } or { function_call }
 */
export const apiCallZia = async ({ messages, systemPrompt, tools }) => {
    try {
        const functions = getFunctions(app, 'europe-west1');
        const callableZia = httpsCallable(functions, 'zia');
        const res = await callableZia({ messages, systemPrompt, tools });
        return res.data;
    } catch (firebaseError) {
        // Map HttpsError code / details into the format expected by the frontend
        const error = new Error(firebaseError.message || 'API error');
        const isRateLimit = firebaseError.code === 'resource-exhausted' || firebaseError.details?.isRateLimit;
        error.isRateLimit = isRateLimit;
        error.retryAfter = firebaseError.details?.retryAfter || 30;
        throw error;
    }
};
