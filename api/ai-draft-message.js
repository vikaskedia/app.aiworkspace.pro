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
    const { conversation, contactName, context } = req.body;

    if (!conversation || !Array.isArray(conversation) || conversation.length === 0) {
      return res.status(400).json({ error: 'Conversation history is required' });
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    // Prepare the conversation context for ChatGPT
    const conversationContext = conversation
      .slice(-10) // Get last 10 messages to avoid token limits
      .map(msg => `${msg.direction === 'outbound' ? 'You' : (contactName || 'Contact')}: ${msg.text || '[Media message]'}`)
      .join('\n');

    const systemPrompt = `You are an AI assistant helping to draft professional and appropriate text message replies. 

Your task is to:
1. Analyze the conversation context and the most recent message
2. Generate a helpful, professional, and contextually appropriate reply
3. Keep the response concise and suitable for SMS/text messaging
4. Maintain a professional but friendly tone
5. Consider the nature of the conversation (legal, business, personal, etc.)

Context: ${context || 'This is a professional communication.'}

Respond in the following JSON format:
{
  "suggestedMessage": "the suggested reply message",
  "reasoning": "brief explanation of why this response is appropriate",
  "tone": "professional|friendly|formal|casual",
  "alternatives": [
    "alternative response option 1",
    "alternative response option 2"
  ]
}

Keep messages concise and appropriate for text messaging.`;

    const userPrompt = `Based on this conversation history, please suggest an appropriate reply:

${conversationContext}

Please suggest a professional and helpful response.`;

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
        temperature: 0.7,
        max_tokens: 800
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      return res.status(500).json({ error: 'Failed to generate message with AI' });
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
        suggestedMessage: "Thank you for your message. I'll get back to you shortly.",
        reasoning: "AI response could not be parsed, providing a safe default response.",
        tone: "professional",
        alternatives: [
          "Thanks for reaching out. I'll respond soon.",
          "Received your message. Will follow up shortly."
        ]
      };
    }

    return res.status(200).json({
      success: true,
      conversationLength: conversation.length,
      ...parsedResponse
    });

  } catch (error) {
    console.error('Error in AI message drafting:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
} 