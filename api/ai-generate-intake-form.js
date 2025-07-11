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
    const { tableName = 'sc_patient_intake' } = req.body || {};

    if (!tableName) {
      return res.status(400).json({ error: 'tableName is required in the request body' });
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!openaiApiKey) {
      return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });
    }

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return res.status(500).json({ error: 'VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured.' });
    }

    /*
      PostgREST (used by supabase-js) only exposes the schemas configured in
      supabase/config.toml → api.schemas (typically just "public" and
      "graphql_public"). That means we cannot query information_schema via the
      normal supabase client – the request will always fail with
      "schema must be one of the following: public, graphql_public".

      Instead we'll open a direct Postgres connection using the service DB
      credentials (SUPABASE_HOST + SUPABASE_DB_PASSWORD).  This avoids the RLS
      layer entirely and lets us query information_schema safely.
    */

    let supabaseHost = process.env.SUPABASE_HOST;
    const supabaseDbPassword = process.env.SUPABASE_DB_PASSWORD;

    if (!supabaseDbPassword) {
      return res.status(500).json({ error: 'SUPABASE_DB_PASSWORD env var is not configured' });
    }

    // If SUPABASE_HOST is not provided fall back to the host derived from VITE_SUPABASE_URL
    if (!supabaseHost) {
      try {
        const urlObj = new URL(supabaseUrl);
        //if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') {
          // Local Supabase dev server – default Postgres port is 54322 (per supabase CLI)
        //  supabaseHost = 'localhost';
        //  process.env.PGPORT = process.env.PGPORT || '54322';
        //} else {
          const projectRef = urlObj.hostname.split('.')[0];
          supabaseHost = `db.${projectRef}.supabase.co`;
        //}
      } catch {
        return res.status(500).json({ error: 'Unable to derive database host from VITE_SUPABASE_URL – please set SUPABASE_HOST env var explicitly.' });
      }
    }

    // Lazily import pg so it’s only bundled server-side
    const { Client } = await import('pg');

    // Prefer DATABASE_URL if provided – easier to keep consistent across envs
    const connectionString = process.env.DATABASE_URL;

    const pgClient = connectionString
      ? new Client({ connectionString, ssl: { rejectUnauthorized: false } })
      : new Client({
          host: supabaseHost || process.env.PGHOST,
          port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
          user: process.env.PGUSER || 'postgres',
          password: supabaseDbPassword || process.env.PGPASSWORD,
          database: process.env.PGDATABASE || 'postgres',
          ssl: { rejectUnauthorized: false }
        });

    await pgClient.connect();

    const { rows: columns } = await pgClient.query(
      `SELECT column_name, data_type, is_nullable, ordinal_position
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY ordinal_position`,
      [tableName]
    );

    await pgClient.end();

    if (!columns || columns.length === 0) {
      return res.status(404).json({ error: `No columns found for table ${tableName}` });
    }

    const tableStructure = columns.map(col => `${col.column_name} (${col.data_type}${col.is_nullable === 'YES' ? ', nullable' : ''})`).join(', ');

    // Build prompts for OpenAI
    const systemPrompt = `You are a senior full-stack developer. Your task is to design a JSON definition for an intake form that will be auto-generated on the front-end. Follow these rules strictly:
1. Only output valid minified JSON (no markdown, no comments).
2. The JSON must be an array where each object represents one field that maps to a column in the database table.
3. Each object MUST have: "name" (exact column name), "label" (human readable), and "type" (text|number|date|boolean|textarea|select|email|phone|checkbox).
4. Infer sensible field types from the Postgres data types.
5. For enum-like or foreign-key columns return "options": ["option1", "option2", ...] when obvious.
6. Use the incoming table structure to cover every column except typical metadata columns like id, created_at, updated_at.
7. Keep labels Title Cased and user friendly.
If you cannot infer anything – make your best reasonable assumption.`;

    const userPrompt = `Here is the Postgres table structure for ${tableName}: ${tableStructure}\n\nGenerate the JSON form definition now:`;

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
      columns,
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