/**
 * Call the Zia AI assistant via our own Next.js API route.
 * This avoids all Cloud Run CORS/IAM issues by keeping the request same-origin.
 *
 * @param {Object} payload 
 * @param {Array} payload.messages - Chat history messages
 * @param {String} payload.systemPrompt - The system prompt
 * @param {Array} payload.tools - Optional function calling tools
 * @returns {Promise<Object>} The response data { text } or { function_call }
 */
export const apiCallZia = async ({ messages, systemPrompt, tools }) => {
    try {
        const res = await fetch('https://eznr-ai-backend-757041188739.europe-west1.run.app/api/zia', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages, systemPrompt, tools }),
        });

        const data = await res.json();

        if (!res.ok) {
            const error = new Error(data.error || 'API error');
            error.isRateLimit = data.isRateLimit || false;
            error.retryAfter = data.retryAfter || 30;
            throw error;
        }

        return data.result;
    } catch (err) {
        if (err.isRateLimit !== undefined) throw err;
        const error = new Error(err.message || 'API error');
        error.isRateLimit = false;
        throw error;
    }
};

