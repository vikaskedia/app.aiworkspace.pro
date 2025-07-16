import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { conversationId } = req.query

    if (!conversationId) {
      return res.status(400).json({ error: 'Conversation ID is required' })
    }

    // Determine if this is a group conversation (group_key) or regular conversation
    // Group keys are formatted as phone numbers joined by dashes (e.g., "+1234-+5678-+9012")
    const isGroupConversation = conversationId.includes('-') && conversationId.includes('+')
    
    let messages
    let error
    
    if (isGroupConversation) {
      // Fetch messages by group_key
      console.log('Fetching group messages for group_key:', conversationId)
      const result = await supabase
        .from('messages')
        .select('*')
        .eq('group_key', conversationId)
        .order('created_at', { ascending: true })
      messages = result.data
      error = result.error
    } else {
      // Fetch messages by conversation_id (existing logic)
      console.log('Fetching 1:1 messages for conversation_id:', conversationId)
      const result = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
      messages = result.data
      error = result.error
    }

    if (error) throw error

    // Transform the data to match frontend format
    const transformedMessages = messages.map(msg => ({
      id: msg.id,
      text: msg.message_body,
      direction: msg.direction,
      timestamp: new Date(msg.created_at),
      status: msg.status,
      telnyxId: msg.telnyx_message_id,
      messageType: msg.message_type,
      mediaFiles: msg.media_files || [],
      mediaUrls: msg.media_urls || [],
      fromPhoneNumber: msg.from_phone_number,
      toPhoneNumber: msg.to_phone_number,
      deliveredAt: msg.delivered_at,
      failedReason: msg.failed_reason,
      webhookData: msg.webhook_data,
      updatedAt: msg.updated_at,
      subject: msg.subject
    }))

    return res.status(200).json({
      success: true,
      messages: transformedMessages
    })

  } catch (error) {
    console.error('Fetch Messages Error:', error)
    return res.status(500).json({ 
      error: 'Failed to fetch messages',
      details: error.message 
    })
  }
} 