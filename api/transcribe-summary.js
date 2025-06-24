export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { audioUrl } = req.body;
  if (!audioUrl) return res.status(400).json({ error: 'audioUrl is required' });

  // 1. Download the audio file
  const audioResponse = await fetch(audioUrl);
  if (!audioResponse.ok) {
    return res.status(400).json({ error: 'Failed to download audio file' });
  }
  const audioBuffer = await audioResponse.arrayBuffer();

  // 2. Send to Deepgram for transcription
  const deepgramRes = await fetch('https://api.deepgram.com/v1/listen?utterances=true&diarize=true&punctuate=true', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
      'Content-Type': 'audio/wav'
    },
    body: Buffer.from(audioBuffer)
  });

  if (!deepgramRes.ok) {
    const errorText = await deepgramRes.text();
    return res.status(500).json({ error: 'Deepgram error: ' + errorText });
  }
  const deepgramData = await deepgramRes.json();

  // Add this helper function at the top or before the handler
  function formatUtterances(utterances) {
    return utterances.map(u => {
      // Format timestamp as mm:ss
      const mins = Math.floor(u.start / 60);
      const secs = Math.floor(u.start % 60).toString().padStart(2, '0');
      const time = `${mins}:${secs}`;
      // Speaker label (can be 'Speaker 0', 'Speaker 1', etc.)
      const speaker = u.speaker !== undefined ? `Speaker ${u.speaker}` : 'Speaker';
      return `${time} ${speaker}: ${u.transcript}`;
    }).join('\n');
  }

  let transcript = '';
  if (deepgramData.results && deepgramData.results.utterances && deepgramData.results.utterances.length > 0) {
    transcript = formatUtterances(deepgramData.results.utterances);
  } else if (deepgramData.results && deepgramData.results.channels) {
    const channel = deepgramData.results.channels[0];
    if (channel.alternatives && channel.alternatives[0]) {
      transcript = channel.alternatives[0].transcript;
    }
  }
  if (!transcript) {
    return res.status(500).json({ error: 'No transcript found in Deepgram response' });
  }

  // 3. Send transcript to OpenAI for summary
  const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', { 
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.AI_PHONE_OPEN_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini-2024-07-18',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that creates concise, professional summaries of phone call transcripts. Focus on key points, decisions, and action items.'
        },
        {
          role: 'user',
          content: `Please provide a concise summary of the following phone call transcript. Focus on the key points, decisions made, and any action items mentioned. Keep the summary professional and clear.\n\nTranscript:\n${transcript}\n\nSummary:`
        }
      ],
      max_tokens: 500,
      temperature: 0.3
    })
  });

  if (!openaiRes.ok) {
    const errorText = await openaiRes.text();
    return res.status(500).json({ error: 'OpenAI error: ' + errorText });
  }
  const openaiData = await openaiRes.json();
  const summary = openaiData.choices?.[0]?.message?.content?.trim() || '';

  // 4. Return both transcript and summary
  return res.status(200).json({ transcript, summary });
} 