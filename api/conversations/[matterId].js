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
    // Extract matterId from path or query
    const { matterId } = req.query
    const pathMatterId = req.url?.split('/').pop()
    const finalMatterId = matterId || pathMatterId

    console.log('Conversations API called with matterId:', finalMatterId)
    console.log('Request URL:', req.url)
    console.log('Query params:', req.query)

    if (!finalMatterId) {
      return res.status(400).json({ error: 'Matter ID is required' })
    }

    // Fetch conversations for the matter with latest message info
    const { data: conversations, error } = await supabase
      .from('conversations')
      .select(`
        *,
        messages(
          id,
          message_body,
          created_at,
          direction,
          status
        )
      `)
      .eq('matter_id', finalMatterId)
      .order('last_message_at', { ascending: false })

    if (error) throw error

    // Transform the data to match frontend format
    const transformedConversations = conversations.map(conv => {
      const latestMessage = conv.messages?.[0]
      
      return {
        id: conv.id,
        contact: conv.contact_name || conv.to_phone_number,
        phoneNumber: conv.to_phone_number,
        lastMessage: conv.last_message_preview || latestMessage?.message_body || '',
        lastMessageTime: conv.last_message_at || conv.created_at,
        unread: conv.unread_count || 0,
        fromPhoneNumber: conv.from_phone_number
      }
    })

    return res.status(200).json({
      success: true,
      conversations: transformedConversations
    })

  } catch (error) {
    console.error('Fetch Conversations Error:', error)
    return res.status(500).json({ 
      error: 'Failed to fetch conversations',
      details: error.message 
    })
  }
} 