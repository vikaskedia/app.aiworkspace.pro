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

  // Since files are stored in the root of the bucket, use filename directly
  const filenameOnly = filePath.includes('/') ? filePath.split('/').pop() : filePath;

  // List the root of the bucket and search for the filename
  const { data: fileInfo, error: fileError } = await supabase
    .storage
    .from(bucket)
    .list('', {
      search: filenameOnly
    });

  const fileMeta = fileInfo && fileInfo.find(f => f.name === filenameOnly);
  if (fileError || !fileMeta) {
    console.error('❌ File not found in Supabase Storage:', fileError, 'fileInfo:', fileInfo, 'filePath:', filePath);
    return res.status(404).json({ error: 'File not found in Supabase Storage' });
  }

  const fileSize = fileMeta?.metadata?.size || 0;
  if (fileSize === 0) {
    return res.status(400).json({ error: 'File size is 0 bytes' });
  }

  // Generate Supabase public URL (use filenameOnly for the path)
  const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(filenameOnly);
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
      .select('id, workspace_id')
      .or(`and(from_phone_number.like.%${parsed.from_phone_number}%,to_phone_number.like.%${parsed.to_phone_number}%),and(from_phone_number.like.%${parsed.to_phone_number}%,to_phone_number.like.%${parsed.from_phone_number}%)`)
      .limit(1);
    if (convError) throw convError;

    let conversation;
    let workspaceId;
    let fullFromPhone = parsed.from_phone_number;
    let fullToPhone = parsed.to_phone_number;

    if (!conversations || conversations.length === 0) {
      // No conversation found, try to find a matching workspace
      console.log('📞 No existing conversation found, searching for matching workspace');
      const { data: workspaces, error: workspaceError } = await supabase
        .from('workspaces')
        .select('id, phone_numbers')
        .not('phone_numbers', 'is', null);
      if (workspaceError) throw workspaceError;
      workspaceId = null;
      let matchedMatter = null;
      for (const workspace of workspaces) {
        if (workspace.phone_numbers && Array.isArray(workspace.phone_numbers)) {
          const phoneMatch = workspace.phone_numbers.find(phone => {
            const phoneNum = phone.number;
            return (
              phoneNum === parsed.from_phone_number ||
              phoneNum === parsed.to_phone_number ||
              (phoneNum && parsed.from_phone_number && phoneNum.slice(-4) === parsed.from_phone_number.slice(-4)) ||
              (phoneNum && parsed.to_phone_number && phoneNum.slice(-4) === parsed.to_phone_number.slice(-4))
            );
          });
          if (phoneMatch) {
            workspaceId = workspace.id;
            matchedMatter = workspace;
            break;
          }
        }
      }
      if (!workspaceId) {
        // No matching workspace found, return error
        console.log('❌ No workspace matches for these phone numbers to create new conversation');
        return res.status(400).json({ error: 'No workspace matches for these phone numbers to create new conversation' });
      }
      // Replace 4-digit phone numbers with full numbers from workspace
      if (parsed.from_phone_number && parsed.from_phone_number.length === 4) {
        const match = matchedMatter.phone_numbers.find(phone => phone.number && phone.number.slice(-4) === parsed.from_phone_number);
        if (match) fullFromPhone = match.number;
      }
      if (parsed.to_phone_number && parsed.to_phone_number.length === 4) {
        const match = matchedMatter.phone_numbers.find(phone => phone.number && phone.number.slice(-4) === parsed.to_phone_number);
        if (match) fullToPhone = match.number;
      }
      const { data: newConversation, error: createConvError } = await supabase
        .from('conversations')
        .insert({
          workspace_id: workspaceId,
          from_phone_number: fullFromPhone,
          to_phone_number: fullToPhone
        })
        .select('id, workspace_id')
        .single();
      if (createConvError) throw createConvError;
      conversation = newConversation;
      console.log('✅ Created new conversation:', conversation);
    } else {
      conversation = conversations[0];
      workspaceId = conversation.workspace_id;
    }

    // Insert into call_recordings (no Gitea, only Supabase public URL)
    const { data: insertedRecording, error: insertError } = await supabase
      .from('call_recordings')
      .insert({
        workspace_id: conversation.workspace_id,
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
    if (fileSize === 44) {
      console.log('⏭️ Skipping transcription: fileSize is 44 bytes (likely empty/corrupted audio)');
    } else {
      console.log('🎤 Starting background transcription and summary generation...');
      fetch('https://app.aiworkspace.pro/api/transcribe-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioUrl: publicUrl,
          callRecordingId: insertedRecording.id,
          fileSize: fileSize
        })
      }).catch(error => {
        console.error('❌ Failed to start transcription:', error);
      });
      console.log('🚀 FIRING transcription API call to:', 'https://app.aiworkspace.pro/api/transcribe-summary', 'callRecordingId:', insertedRecording.id, 'audioUrl:', publicUrl, 'fileSize:', fileSize);
    }

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
        workspace_id: conversation.workspace_id
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