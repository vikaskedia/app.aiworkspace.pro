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

// Configure multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: '/tmp/uploads/',
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
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

// Helper function to normalize phone numbers
function normalizePhoneNumber(phoneNumber) {
  if (!phoneNumber) return null;
  
  // Remove all non-digit characters
  const digits = phoneNumber.replace(/\D/g, '');
  
  // Add +1 if it's a 10-digit US number
  if (digits.length === 10) {
    return `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  return `+${digits}`;
}

// Helper function to extract phone numbers from filename
function extractPhoneNumbersFromFilename(filename) {
  console.log(`🔍 Attempting to extract phone numbers from filename: ${filename}`)
  
  // Common Asterisk filename patterns:
  // recording_15551234567_15551234568.wav
  // call_5551234567-5551234568_timestamp.wav
  // out_15551234567_15551234568.wav
  // in_15551234567_15551234568.wav
  
  const patterns = [
    // Pattern: recording_caller_called.ext
    /recording[_-](\d{10,11})[_-](\d{10,11})/i,
    // Pattern: call_caller-called_timestamp.ext
    /call[_-](\d{10,11})[_-](\d{10,11})/i,
    // Pattern: out_caller_called.ext
    /out[_-](\d{10,11})[_-](\d{10,11})/i,
    // Pattern: in_caller_called.ext
    /in[_-](\d{10,11})[_-](\d{10,11})/i,
    // Pattern: caller_called_anything.ext
    /^(\d{10,11})[_-](\d{10,11})/,
    // Pattern: anything_caller_called.ext
    /[_-](\d{10,11})[_-](\d{10,11})/
  ]
  
  for (const pattern of patterns) {
    const match = filename.match(pattern)
    if (match) {
      const caller = normalizePhoneNumber(match[1])
      const called = normalizePhoneNumber(match[2])
      console.log(`✅ Extracted phone numbers: ${caller} -> ${called}`)
      return { caller, called }
    }
  }
  
  console.log(`❌ Could not extract phone numbers from filename`)
  return null
}

// Helper function to get default matter (first matter or configured default)
async function getDefaultMatter() {
  try {
    // Try to get matter ID from environment variable first
    const defaultMatterId = process.env.ASTERISK_DEFAULT_MATTER_ID
    if (defaultMatterId) {
      const { data: matter, error } = await supabase
        .from('matters')
        .select('id, phone_numbers, git_repo')
        .eq('id', parseInt(defaultMatterId))
        .single()
      
      if (!error && matter) {
        console.log(`✅ Using configured default matter: ${matter.id}`)
        return matter
      }
    }
    
    // Fallback: get the first available matter
    const { data: matters, error } = await supabase
      .from('matters')
      .select('id, phone_numbers, git_repo')
      .not('phone_numbers', 'is', null)
      .limit(1)
    
    if (error || !matters?.length) {
      throw new Error('No matters found in database')
    }
    
    console.log(`⚠️ Using first available matter as fallback: ${matters[0].id}`)
    return matters[0]
    
  } catch (error) {
    console.error('Error getting default matter:', error)
    throw error
  }
}

// Helper function to find or create conversation
async function findOrCreateConversation(matterId, fromPhone, toPhone, callStartTime) {
  try {
    // Try to find existing conversation (check both directions)
    let { data: conversation, error: findError } = await supabase
      .from('conversations')
      .select('*')
      .eq('matter_id', matterId)
      .or(`and(from_phone_number.eq.${fromPhone},to_phone_number.eq.${toPhone}),and(from_phone_number.eq.${toPhone},to_phone_number.eq.${fromPhone})`)
      .order('last_message_at', { ascending: false })
      .limit(1)
      .single()

    if (findError && findError.code !== 'PGRST116') {
      throw findError
    }

    if (conversation) {
      console.log(`📞 Found existing conversation: ${conversation.id}`)
      
      // Update last message time
      await supabase
        .from('conversations')
        .update({
          last_message_at: callStartTime,
          last_message_preview: '📞 Call recording'
        })
        .eq('id', conversation.id)
        
      return conversation
    }

    // Create new conversation if not found
    console.log(`📞 Creating new conversation for ${fromPhone} <-> ${toPhone}`)
    
    const { data: newConversation, error: createError } = await supabase
      .from('conversations')
      .insert({
        matter_id: matterId,
        from_phone_number: fromPhone,
        to_phone_number: toPhone,
        contact_name: null,
        last_message_at: callStartTime,
        last_message_preview: '📞 Call recording'
      })
      .select()
      .single()

    if (createError) throw createError

    console.log(`✅ Created new conversation: ${newConversation.id}`)
    return newConversation

  } catch (error) {
    console.error('Error finding/creating conversation:', error)
    throw error
  }
}

// Helper function to find matter by phone number
async function findMatterByPhoneNumber(phoneNumber) {
  try {
    const { data: matters, error } = await supabase
      .from('matters')
      .select('id, phone_numbers, git_repo')
      .not('phone_numbers', 'is', null)

    if (error) throw error

    for (const matter of matters || []) {
      const phoneNumbers = matter.phone_numbers || []
      if (phoneNumbers.some(p => p.number === phoneNumber)) {
        return matter
      }
    }

    return null
  } catch (error) {
    console.error('Error finding matter by phone number:', error)
    throw error
  }
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

      // Read file and convert to base64 for Gitea
      const fileContent = fs.readFileSync(audioFile.path, { encoding: 'base64' })

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

      console.log(`✅ Uploaded to Gitea successfully`)

      // Clean up temporary file
      if (fs.existsSync(audioFile.path)) {
        fs.unlinkSync(audioFile.path)
      }

      // Return success response
      return res.status(200).json({
        success: true,
        message: 'Call recording uploaded successfully',
        data: {
          filename: audioFile.originalname,
          file_size: audioFile.size,
          gitea_path: giteaPath,
          public_url: publicUrl,
          uploaded_at: new Date().toISOString()
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