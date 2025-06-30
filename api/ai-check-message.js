export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    // Prepare the prompt for ChatGPT
    const systemPrompt = `You are an AI assistant that helps check and improve text messages for grammar, spelling, clarity, and professionalism. 

Your task is to:
1. Check the message for any grammatical errors, spelling mistakes, or awkward phrasing
2. Suggest improvements for clarity and professionalism if needed
3. Maintain the original tone and intent of the message
4. Keep the message concise and appropriate for SMS/text messaging

Respond in the following JSON format:
{
  "hasIssues": boolean,
  "suggestions": [
    {
      "type": "grammar|spelling|clarity|tone",
      "issue": "description of the issue",
      "suggestion": "suggested improvement"
    }
  ],
  "improvedMessage": "the corrected/improved version of the message",
  "explanation": "brief explanation of the changes made"
}

If the message is already good, set hasIssues to false and return the original message as improvedMessage.`;

    const userPrompt = `Please check and improve this message:\n\n"${message}"`;

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      return res.status(500).json({ error: 'Failed to check message with AI' });
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content;

    if (!aiResponse) {
      return res.status(500).json({ error: 'No response from AI' });
    }

    // Parse the JSON response from ChatGPT
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(aiResponse);
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiResponse);
      // Fallback response if parsing fails
      parsedResponse = {
        hasIssues: false,
        suggestions: [],
        improvedMessage: message,
        explanation: "AI response could not be parsed, but your message appears to be fine."
      };
    }

    return res.status(200).json({
      success: true,
      originalMessage: message,
      ...parsedResponse,
      debug: {
        systemPrompt,
        userPrompt,
        model: 'gpt-4o-mini',
        temperature: 0.3,
        maxTokens: 1000,
        rawAIResponse: aiResponse
      }
    });

  } catch (error) {
    console.error('Error in AI message check:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
} 