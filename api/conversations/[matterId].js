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
    // Extract workspaceId from path or query
    const { workspaceId } = req.query
    const pathWorkspaceId = req.url?.split('/').pop()
    const finalWorkspaceId = workspaceId || pathWorkspaceId

    console.log('Conversations API called with workspaceId:', finalWorkspaceId)
    console.log('Request URL:', req.url)
    console.log('Query params:', req.query)

    if (!finalWorkspaceId) {
      return res.status(400).json({ error: 'Workspace ID is required' })
    }

    // Fetch conversations for the workspace with latest message info
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
      .eq('matter_id', finalWorkspaceId)
      .order('last_message_at', { ascending: false })
      .limit(10000)

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
        fromPhoneNumber: conv.from_phone_number,
        status: conv.status || 'primary'
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