import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { systemPrompt, spreadsheetData, workspaceId } = req.body;

    if (!systemPrompt || !spreadsheetData) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Format spreadsheet data for AI analysis
    const formattedData = formatSpreadsheetForAI(spreadsheetData);
    
    // Create the user message with spreadsheet data
    const userMessage = `Please analyze the following portfolio data:

Spreadsheet Data:
${formattedData}

Please provide a comprehensive analysis based on the system prompt.`;

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userMessage
        }
      ],
      max_tokens: 2000,
      temperature: 0.7
    });

    const aiResponse = completion.choices[0].message.content;

    return res.status(200).json({
      success: true,
      response: aiResponse
    });

  } catch (error) {
    console.error('AI Portfolio Analysis Error:', error);
    return res.status(500).json({
      error: 'Failed to analyze portfolio data',
      details: error.message
    });
  }
}

function formatSpreadsheetForAI(spreadsheetData) {
  const { columns, data } = spreadsheetData;
  
  if (!columns || !data || data.length === 0) {
    return 'No data available';
  }

  // Create a formatted table string
  let formatted = 'Portfolio Data:\n\n';
  
  // Add column headers
  const headers = columns.map(col => col.label).join(' | ');
  formatted += headers + '\n';
  formatted += '-'.repeat(headers.length) + '\n';
  
  // Add data rows
  data.forEach(row => {
    const rowData = columns.map(col => row[col.key] || '').join(' | ');
    formatted += rowData + '\n';
  });

  return formatted;
} 