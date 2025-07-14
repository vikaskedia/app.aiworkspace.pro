import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Webhook authentication
const ASTERISK_WEBHOOK_SECRET = process.env.ASTERISK_WEBHOOK_SECRET

function parseAsteriskFilename(filename) {
  const inbound = /^external-(\d{4})-(\d{10,})-(\d{8})-(\d{6})-(\d+)\./;
  const outbound = /^out-(\d{10,})-(\d{4})-(\d{8})-(\d{6})-(\d+)\./;
  let match, direction;
  if ((match = filename.match(inbound))) {
    direction = 'inbound';
    return {
      direction,
      office_last4: match[1],
      other_number: match[2],
      date: match[3],
      time: match[4],
      timestamp: match[5],
      from_phone_number: match[2],
      to_phone_number: match[1],
      recorded_at: new Date(parseInt(match[5]) * 1000).toISOString()
    };
  } else if ((match = filename.match(outbound))) {
    direction = 'outbound';
    return {
      direction,
      other_number: match[1],
      office_last4: match[2],
      date: match[3],
      time: match[4],
      timestamp: match[5],
      from_phone_number: match[2],
      to_phone_number: match[1],
      recorded_at: new Date(parseInt(match[5]) * 1000).toISOString()
    };
  }
  return null;
}

export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Validate webhook secret if configured
  if (ASTERISK_WEBHOOK_SECRET) {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ Missing or invalid authorization header')
      return res.status(401).json({ error: 'Unauthorized - missing token' })
    }
    const providedSecret = authHeader.replace('Bearer ', '')
    if (providedSecret !== ASTERISK_WEBHOOK_SECRET) {
      console.error('❌ Invalid webhook secret')
      return res.status(401).json({ error: 'Unauthorized - invalid token' })
    }
  }

  // Parse JSON body
  let filename, bucket, filePath;
  try {
    if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
      ({ filename, bucket, path: filePath } = req.body);
    } else {
      // fallback for raw body
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      filename = body.filename;
      bucket = body.bucket;
      filePath = body.path;
    }
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  if (!filename || !bucket || !filePath) {
    return res.status(400).json({ error: 'Missing required metadata (filename, bucket, path)' });
  }

  // Check if file exists in Supabase Storage and get metadata
  const { data: fileInfo, error: fileError } = await supabase
    .storage
    .from(bucket)
    .list('', {
      search: filePath
    });

  if (fileError || !fileInfo || fileInfo.length === 0) {
    console.error('❌ File not found in Supabase Storage:', fileError);
    return res.status(404).json({ error: 'File not found in Supabase Storage' });
  }

  // Get file size from metadata if available, or use a default
  const fileSize = fileInfo[0]?.metadata?.size || 0;
  if (fileSize === 0) {
    return res.status(400).json({ error: 'File size is 0 bytes' });
  }

  // Generate Supabase public URL
  const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
  const publicUrl = publicUrlData?.publicUrl;

  try {
    // Parse filename
    const parsed = parseAsteriskFilename(filename);
    if (!parsed) {
      return res.status(400).json({ error: 'Could not parse filename for call info' });
    }

    // Query conversations table
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('id, matter_id')
      .or(`and(from_phone_number.like.%${parsed.from_phone_number}%,to_phone_number.like.%${parsed.to_phone_number}%),and(from_phone_number.like.%${parsed.to_phone_number}%,to_phone_number.like.%${parsed.from_phone_number}%)`)
      .limit(1);
    if (convError) throw convError;

    let conversation;
    let matterId;

    if (!conversations || conversations.length === 0) {
      // No conversation found, try to find a matching matter
      console.log('📞 No existing conversation found, searching for matching matter');
      const { data: matters, error: matterError } = await supabase
        .from('matters')
        .select('id, phone_numbers')
        .not('phone_numbers', 'is', null);
      if (matterError) throw matterError;
      matterId = null;
      for (const matter of matters) {
        if (matter.phone_numbers && Array.isArray(matter.phone_numbers)) {
          const phoneMatch = matter.phone_numbers.find(phone => {
            // Match full number or last 4 digits
            const phoneNum = phone.number;
            return (
              phoneNum === parsed.from_phone_number ||
              phoneNum === parsed.to_phone_number ||
              (phoneNum && parsed.from_phone_number && phoneNum.slice(-4) === parsed.from_phone_number.slice(-4)) ||
              (phoneNum && parsed.to_phone_number && phoneNum.slice(-4) === parsed.to_phone_number.slice(-4))
            );
          });
          if (phoneMatch) {
            matterId = matter.id;
            break;
          }
        }
      }
      if (!matterId) {
        // No matching matter found, return error
        console.log('❌ No matter matches for these phone numbers to create new conversation');
        return res.status(400).json({ error: 'No matter matches for these phone numbers to create new conversation' });
      }
      const { data: newConversation, error: createConvError } = await supabase
        .from('conversations')
        .insert({
          matter_id: matterId,
          from_phone_number: parsed.from_phone_number,
          to_phone_number: parsed.to_phone_number
        })
        .select('id, matter_id')
        .single();
      if (createConvError) throw createConvError;
      conversation = newConversation;
      console.log('✅ Created new conversation:', conversation);
    } else {
      conversation = conversations[0];
      matterId = conversation.matter_id;
    }

    // Insert into call_recordings (no Gitea, only Supabase public URL)
    const { data: insertedRecording, error: insertError } = await supabase
      .from('call_recordings')
      .insert({
        matter_id: conversation.matter_id,
        conversation_id: conversation.id,
        filename: filename,
        file_size: fileSize,
        mime_type: 'audio/wav',
        gitea_path: null,
        public_url: publicUrl,
        git_sha: null,
        recorded_at: parsed.recorded_at,
        processing_status: 'pending'
      })
      .select('id')
      .single();
    if (insertError) {
      console.error('❌ Failed to insert call_recording:', insertError);
      return res.status(500).json({ error: 'Failed to insert call_recording', details: insertError.message });
    }

    // Start background transcription and summary generation
    console.log('🎤 Starting background transcription and summary generation...');
    fetch('https://app.aiworkspace.pro/api/transcribe-summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audioUrl: publicUrl,
        callRecordingId: insertedRecording.id,
      })
    }).catch(error => {
      console.error('❌ Failed to start transcription:', error);
    });

    console.log(`✅ Stored in Supabase bucket only`);
    console.log(`🔗 Supabase public URL:`, publicUrl);

    return res.status(200).json({
      success: true,
      message: 'Call recording uploaded and recorded successfully',
      data: {
        filename: filename,
        file_size: fileSize,
        public_url: publicUrl,
        uploaded_at: new Date().toISOString(),
        conversation_id: conversation.id,
        matter_id: conversation.matter_id
      }
    });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    return res.status(500).json({
      error: 'Failed to process call recording',
      details: error.message
    });
  }
} 