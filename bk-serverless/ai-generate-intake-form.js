export default async function handler(req, res) {
  // CORS headers for local development and browser calls
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
    // const { tableName = 'intake_for_ws_19', tableStructure } = req.body || {};
    // get the userPromp from post params
    const { tableName, userPrompt } = req.body || {};

    if (!tableName) {
      return res.status(400).json({ error: 'tableName is required in the request body' });
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!openaiApiKey) {
      return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });
    }

    // Build prompts for OpenAI to generate complete form with UI design
    const systemPrompt = `You are a senior full-stack developer specializing in Vue.js and modern UI design. Your task is to create a complete form definition with UI design, layout, and styling. 

Generate a JSON object with the following structure:
{
  "title": "Form title",
  "description": "Form description",
  "layout": "single-column|two-column|grid",
  "theme": "modern|professional|medical|minimal",
  "sections": [
    {
      "title": "Section title",
      "description": "Section description",
      "layout": "single-column|two-column|grid",
      "fields": [
        {
          "name": "exact_column_name",
          "label": "Human readable label",
          "type": "text|number|date|boolean|textarea|select|email|phone|checkbox|file",
          "required": true|false,
          "placeholder": "Placeholder text",
          "validation": {
            "pattern": "regex pattern",
            "message": "Validation message"
          },
          "options": ["option1", "option2"] // for select fields
        }
      ]
    }
  ],
  "styling": {
    "primaryColor": "#hex",
    "backgroundColor": "#hex",
    "borderRadius": "8px",
    "spacing": "16px"
  },
  "submitButton": {
    "text": "Submit",
    "style": "primary|secondary|success"
  }
}

Rules:
1. Only output valid JSON (no markdown, no comments)
2. Map every relevant column to a field (exclude id, created_at, updated_at, etc.)
3. Group related fields into logical sections
4. Use appropriate field types based on data types
5. Add validation where appropriate
6. Create a professional, modern design
7. Include responsive layout considerations`;

    // Call OpenAI Chat Completion
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 1500
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      return res.status(500).json({ error: 'OpenAI API request failed', details: errorText });
    }

    const respJson = await response.json();
    const aiContent = respJson.choices?.[0]?.message?.content?.trim();

    if (!aiContent) {
      return res.status(500).json({ error: 'Empty response from OpenAI' });
    }

    // Try to parse JSON from the AI response
    let formDefinition;
    try {
      formDefinition = JSON.parse(aiContent);
    } catch (parseErr) {
      // Attempt to extract JSON using regex fallback
      const match = aiContent.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (match) {
        try {
          formDefinition = JSON.parse(match[0]);
        } catch {
          console.error('Failed to parse extracted JSON', parseErr);
        }
      }
      if (!formDefinition) {
        return res.status(500).json({ error: 'Failed to parse JSON from AI response', raw: aiContent });
      }
    }

    return res.status(200).json({
      success: true,
      tableName,
      //tableStructure: effectiveTableStructure,
      formDefinition,
      debug: {
        systemPrompt,
        userPrompt,
        rawAIResponse: aiContent,
        model: 'gpt-4o-mini'
      }
    });

  } catch (err) {
    console.error('Unexpected error in ai-generate-intake-form', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
} 