export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { audioUrl, callRecordingId, fileSize } = req.body;
  if (!audioUrl) return res.status(400).json({ error: 'audioUrl is required' });

  // Initialize Supabase client for call recording updates
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  console.log('🚀 Get data from API call to transcribe-summary:', 'callRecordingId:', callRecordingId, 'audioUrl:', audioUrl, 'fileSize:', fileSize);
  try {
    // Update processing status to 'processing'
    if (callRecordingId) {
      await supabase
        .from('call_recordings')
        .update({ processing_status: 'processing' })
        .eq('id', callRecordingId);
    }

    // 1. Download the audio file
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error('Failed to download audio file');
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
      throw new Error('Deepgram error: ' + errorText);
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
      throw new Error('No transcript found in Deepgram response');
    }

    // 3. Send transcript to OpenAI for summary
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', { 
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
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
      throw new Error('OpenAI error: ' + errorText);
    }
    const openaiData = await openaiRes.json();
    const summary = openaiData.choices?.[0]?.message?.content?.trim() || '';

    // 4. Update call recording if callRecordingId is provided
    if (callRecordingId) {
      const { error: updateError } = await supabase
        .from('call_recordings')
        .update({
          recording_transcript: transcript,
          recording_summary: summary,
          processing_status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', callRecordingId);

      if (updateError) {
        console.error('Failed to update call recording:', updateError);
        // Don't fail the entire request if update fails
      } else {
        console.log('✅ Successfully updated call recording with transcript and summary');
      }
    }

    // 5. Return both transcript and summary
    return res.status(200).json({ transcript, summary });

  } catch (error) {
    console.error('❌ Transcription/Summary error:', error);
    
    // Update processing status to failed if callRecordingId is provided
    if (callRecordingId) {
      await supabase
        .from('call_recordings')
        .update({
          processing_status: 'failed',
          recording_transcript: error.message,
          updated_at: new Date().toISOString()
        })
        .eq('id', callRecordingId);
    }

    return res.status(500).json({ 
      error: 'Failed to process audio',
      details: error.message 
    });
  }
} 