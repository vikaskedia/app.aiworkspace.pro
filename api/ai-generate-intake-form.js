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
    const { tableName = 'sc_patient_intake', tableStructure } = req.body || {};

    if (!tableName) {
      return res.status(400).json({ error: 'tableName is required in the request body' });
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!openaiApiKey) {
      return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });
    }

    // ─────────────────────────────────────────────────────────────
    // Manual table structure support
    // 1. Retrieve the column list from Supabase (see instructions below).
    // 2. Paste it between the backticks in MANUAL_TABLE_STRUCTURE **OR**
    //    send it in the POST body as `tableStructure`.
    // ─────────────────────────────────────────────────────────────
    const MANUAL_TABLE_STRUCTURE = `
    id,bigint,NO,1
    server_side_row_uuid,uuid,YES,2
    ptuuid,uuid,YES,3
    first_name,character varying,YES,4
    last_name,character varying,YES,5
    gender,character varying,YES,6
    dob,date,YES,7
    email,character varying,YES,8
    phone_number,character varying,YES,9
    insurance_details,text,YES,10
    cc_name,character varying,YES,11
    cc_number,character varying,YES,12
    cc_expiry_month,character varying,YES,13
    cc_expiry_year,character varying,YES,14
    cc_cvv,character varying,YES,15
    provider_uuid,uuid,YES,16
    billing_zip_code,character varying,YES,17
    how_can_we_help,text,YES,18
    status,text,YES,19
    added_by,uuid,NO,20
    added_on,timestamp with time zone,YES,21
    ibook_status,text,YES,22
    is_coverage_checking_done,text,YES,23
    `;

    const effectiveTableStructure = (tableStructure || MANUAL_TABLE_STRUCTURE).trim();

    if (!effectiveTableStructure) {
      return res.status(400).json({
        error: 'tableStructure is required (either supply it in the POST body or paste into MANUAL_TABLE_STRUCTURE).'
      });
    }

    // Old Postgres-introspection logic removed – we now rely on the manually
    // supplied table definition.

    // Build prompts for OpenAI
    const systemPrompt = `You are a senior full-stack developer. Your task is to design a JSON definition for an intake form that will be auto-generated on the front-end. Follow these rules strictly:
1. Only output valid minified JSON (no markdown, no comments).
2. The JSON must be an array where each object represents one field that maps to a column in the database table.
3. Each object MUST have: "name" (exact column name), "label" (human readable), and "type" (text|number|date|boolean|textarea|select|email|phone|checkbox).
4. Infer sensible field types from the Postgres data types.
5. For enum-like or foreign-key columns return "options": ["option1", "option2", ...] when obvious.
6. Use the incoming table structure to cover every column except typical metadata columns like id, created_at, updated_at.
7. Keep labels Title Cased and user friendly.
If you cannot infer anything - make your best reasonable assumption.`;

    const userPrompt = `Here is the Postgres table structure for ${tableName}: ${effectiveTableStructure}\n\nGenerate the JSON form definition now:`;

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
        max_tokens: 800
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

    // Try to parse JSON from the AI response – some models may wrap in markdown
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
      tableStructure: effectiveTableStructure,
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