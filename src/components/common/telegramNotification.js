// const TELEGRAM_API_URL = 'https://telegram-11q1s6qef-scs-projects-83c4512e.vercel.app/api/sendMessage';
const TELEGRAM_API_URL = 'https://telegram-bot-five-lyart.vercel.app/api/sendMessage';

function formatHtmlForTelegram(html) {
    // Replace paragraph tags with double line breaks for proper spacing
    html = html.replace(/<p>/g, '\n\n').replace(/<\/p>/g, '');

    // Add support for other tags (convert to Telegram-supported ones if necessary)
    // For example, convert <br> to \n
    html = html.replace(/<br\s*\/?>/g, '\n');

    // Handle other unsupported tags (if any) or strip them
    // Add more replacements as needed
    html = html.replace(/<\/?[^b|i|code|pre|a][^>]*>/g, ''); // Remove unsupported tags while keeping <b>, <i>, <code>, <a>

    return html.trim(); // Trim extra spaces or newlines
}

/**
 * Send a notification to Telegram
 * @param {Object} payload - The notification payload
 * @param {string} payload.workspaceId - The ID of the workspace
 * @param {string} payload.activityType - Type of activity (e.g., 'NEW_COMMENT', 'TASK_CREATED')
 * @param {string} payload.message - The message to send
 * @returns {Promise<Response>}
 */
export async function sendTelegramNotification(payload) {
    try {
        // Format the message if it contains HTML
        payload.message = formatHtmlForTelegram(payload.message);

        const response = await fetch(TELEGRAM_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Telegram API error: ${await response.text()}`);
        }

        return response;
    } catch (error) {
        console.error('Error sending Telegram notification:', error);
        // Don't throw the error - we don't want to break the main flow if Telegram fails
    }
}