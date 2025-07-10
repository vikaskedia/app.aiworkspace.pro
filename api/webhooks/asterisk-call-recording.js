import { createClient } from '@supabase/supabase-js'
import multer from 'multer'
import fs from 'fs'
import path from 'path'

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Gitea configuration
const GITEA_HOST = process.env.VITE_GITEA_HOST
const GITEA_TOKEN = process.env.VITE_GITEA_TOKEN
const GITEA_USERNAME = 'associateattorney'

// Webhook authentication
const ASTERISK_WEBHOOK_SECRET = process.env.ASTERISK_WEBHOOK_SECRET

// Ensure upload directory exists
const uploadDir = '/tmp/uploads/'
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
  console.log(`📁 Created upload directory: ${uploadDir}`)
}

// Configure multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      console.log(`📂 Setting destination to: ${uploadDir}`)
      cb(null, uploadDir)
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
      const filename = file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname)
      console.log(`📄 Generated filename: ${filename}`)
      cb(null, filename)
    }
  }),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 1 // Only one audio file expected
  },
  fileFilter: (req, file, cb) => {
    console.log('🔍 File validation:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      fieldname: file.fieldname
    })
    
    // Accept audio files by MIME type or file extension
    const isAudioMimeType = file.mimetype && file.mimetype.startsWith('audio/')
    const hasAudioExtension = file.originalname && /\.(wav|mp3|mp4|m4a|aac|ogg|flac|wma)$/i.test(file.originalname)
    const isOctetStream = file.mimetype === 'application/octet-stream' // Common for unknown binary files
    
    if (isAudioMimeType || hasAudioExtension || isOctetStream) {
      console.log('✅ File accepted for upload')
      cb(null, true)
    } else {
      console.log('❌ File rejected - not an audio file')
      cb(new Error(`File type not supported. MIME: ${file.mimetype}, Extension: ${path.extname(file.originalname)}`), false)
    }
  }
})

// Helper function to get authenticated download URL
function getAuthenticatedDownloadUrl(downloadUrl) {
  if (!downloadUrl) return '';
  
  try {
    const url = new URL(downloadUrl);
    url.searchParams.set('token', GITEA_TOKEN);
    return url.toString();
  } catch (error) {
    console.error('Error creating authenticated URL:', error);
    return downloadUrl;
  }
}

// Helper to parse filename and extract call info
function parseAsteriskFilename(filename) {
  // Example: external-8158-6502040547-20250709-063905-1752068345.0.wav
  // Example: out-6502040547-8158-20250709-064211-1752068531.6.wav
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

function parseAsteriskDate(dateStr, timeStr) {
  // dateStr: YYYYMMDD, timeStr: HHMMSS
  if (!dateStr || !timeStr) return null;
  const y = dateStr.slice(0, 4);
  const m = dateStr.slice(4, 6);
  const d = dateStr.slice(6, 8);
  const h = timeStr.slice(0, 2);
  const min = timeStr.slice(2, 4);
  const s = timeStr.slice(4, 6);
  return `${y}-${m}-${d} ${h}:${min}:${s}+00`;
}

// Main webhook handler
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

  // Use multer middleware
  upload.single('audio_file')(req, res, async (err) => {
    if (err) {
      console.error('❌ Multer error:', err);
      return res.status(400).json({ error: 'File upload error', details: err.message });
    }

    try {
      console.log('📞 Asterisk call recording webhook called');
      
      const audioFile = req.file

      // Validate required fields
      if (!audioFile) {
        return res.status(400).json({ error: 'audio_file is required' })
      }

      // Parse filename
      const parsed = parseAsteriskFilename(audioFile.originalname);
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
      if (!conversations || conversations.length === 0) {
        return res.status(404).json({ error: 'No conversation found for these phone numbers' });
      }
      const conversation = conversations[0];

      // Generate unique filename for Gitea
      const timestamp = Date.now()
      const currentDate = new Date()
      const year = currentDate.getFullYear()
      const month = String(currentDate.getMonth() + 1).padStart(2, '0')
      const day = String(currentDate.getDate()).padStart(2, '0')
      const fileExtension = path.extname(audioFile.originalname) || '.wav'
      const uniqueFileName = `call_${timestamp}${fileExtension}`
      const giteaPath = `call_recordings/asterisk/${year}/${month}/${day}/${uniqueFileName}`

      console.log(`⬆️ Uploading to Gitea: ${giteaPath}`)
      console.log(`📁 File details:`, {
        originalname: audioFile.originalname,
        filename: audioFile.filename,
        path: audioFile.path,
        size: audioFile.size,
        mimetype: audioFile.mimetype
      })

      // Check if temporary file exists and has content
      if (!fs.existsSync(audioFile.path)) {
        throw new Error(`Temporary file not found: ${audioFile.path}`)
      }

      // Wait a moment to ensure file is fully written (especially in serverless environments)
      await new Promise(resolve => setTimeout(resolve, 100))

      const fileStats = fs.statSync(audioFile.path)
      console.log(`📊 File stats:`, {
        size: fileStats.size,
        exists: true
      })

      if (fileStats.size === 0) {
        throw new Error(`Temporary file is empty (0 bytes): ${audioFile.path}`)
      }

      // Double-check file size matches what multer reported
      if (fileStats.size !== audioFile.size) {
        console.warn(`⚠️ File size mismatch - Multer: ${audioFile.size}, Actual: ${fileStats.size}`)
      }

      // Read file and convert to base64 for Gitea
      console.log(`📖 Reading file from: ${audioFile.path}`)
      const fileContent = fs.readFileSync(audioFile.path, { encoding: 'base64' })
      
      console.log(`📦 Base64 content length: ${fileContent.length} characters`)
      
      if (!fileContent || fileContent.length === 0) {
        throw new Error('Failed to read file content or file is empty')
      }

      // Upload to Gitea
      const giteaResponse = await fetch(
        `${GITEA_HOST}/api/v1/repos/associateattorney/wvl-ops/contents/${giteaPath}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `token ${GITEA_TOKEN}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          },
          body: JSON.stringify({
            message: `Upload Asterisk call recording: ${audioFile.originalname}`,
            content: fileContent,
            branch: 'main'
          })
        }
      )

      if (!giteaResponse.ok) {
        const errorText = await giteaResponse.text()
        console.error('❌ Gitea upload error:', errorText)
        throw new Error(`Failed to upload to Gitea: ${giteaResponse.status}`)
      }

      const giteaData = await giteaResponse.json()
      const publicUrl = getAuthenticatedDownloadUrl(giteaData.content.download_url)

      // Insert into call_recordings
      const { data: insertedRecording, error: insertError } = await supabase
        .from('call_recordings')
        .insert({
          matter_id: conversation.matter_id,
          conversation_id: conversation.id,
          filename: audioFile.originalname,
          file_size: audioFile.size,
          mime_type: audioFile.mimetype,
          gitea_path: giteaPath,
          public_url: publicUrl,
          git_sha: giteaData.content.sha,
          recorded_at: parsed.recorded_at,
          processing_status: 'pending' // Will be processed by cron job
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
          callRecordingId: insertedRecording.id, // Pass the actual call recording ID
        })
      }).catch(error => {
        console.error('❌ Failed to start transcription:', error);
        // Don't fail the webhook if transcription fails
      });

      console.log(`✅ Uploaded to Gitea successfully`)
      console.log(`🔗 Gitea response:`, {
        path: giteaData.content.path,
        size: giteaData.content.size,
        sha: giteaData.content.sha,
        download_url: giteaData.content.download_url,
        public_url: publicUrl
      })

      // Verify the uploaded file size
      if (giteaData.content.size === 0) {
        console.error(`❌ Gitea file size is 0 - something went wrong with the upload`)
        throw new Error('Uploaded file to Gitea has 0 bytes')
      }

      console.log(`📏 Original: ${audioFile.size} bytes → Base64: ${fileContent.length} chars → Gitea: ${giteaData.content.size} bytes`)

      // Clean up temporary file
      if (fs.existsSync(audioFile.path)) {
        fs.unlinkSync(audioFile.path)
      }

      // Return success response
      return res.status(200).json({
        success: true,
        message: 'Call recording uploaded and recorded successfully',
        data: {
          filename: audioFile.originalname,
          file_size: audioFile.size,
          gitea_path: giteaPath,
          public_url: publicUrl,
          uploaded_at: new Date().toISOString(),
          conversation_id: conversation.id,
          matter_id: conversation.matter_id
        }
      })

    } catch (error) {
      console.error('❌ Webhook error:', error)
      
      // Clean up temporary file if it exists
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path)
      }

      return res.status(500).json({ 
        error: 'Failed to process call recording',
        details: error.message 
      })
    }
  })
} 