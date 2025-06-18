import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { conversationId } = req.query

    if (!conversationId) {
      return res.status(400).json({ error: 'Conversation ID is required' })
    }

    // Fetch messages for the conversation
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

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