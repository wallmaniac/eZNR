// src/lib/ziaAPI.js

/**
 * Call the Zia AI assistant server endpoint.
 * @param {Object} payload 
 * @param {Array} payload.messages - Chat history messages
 * @param {String} payload.systemPrompt - The system prompt
 * @param {Array} payload.tools - Optional function calling tools
 * @returns {Promise<Object>} The response data { text } or { function_call }
 */
export const apiCallZia = async ({ messages, systemPrompt, tools }) => {
    const res = await fetch('/api/zia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, systemPrompt, tools }),
    });
    
    const data = await res.json();
    if (!res.ok) {
        const err = new Error(data.error || `API error ${res.status}`);
        err.isRateLimit = data.isRateLimit || res.status === 429;
        err.retryAfter = data.retryAfter || 30;
        throw err;
    }
    return data;
};
