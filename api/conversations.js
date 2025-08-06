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
    const { workspaceId } = req.query

    console.log('Conversations API called with workspaceId:', workspaceId)

    if (!workspaceId) {
      return res.status(400).json({ error: 'Workspace ID is required' })
    }

    // Get user from Supabase auth context
    // The frontend should be making authenticated requests to this API
    // We'll use the service role key to bypass RLS for this API call
    // since we need to get user-specific data
    
    // For now, we'll get the user from the Authorization header if provided
    // but the frontend should handle auth through Supabase client
    let userId = null
    
    const authHeader = req.headers.authorization
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser(token)
        if (!authError && user) {
          userId = user.id
        }
      } catch (error) {
        console.log('Auth header parsing failed, continuing without user context')
      }
    }

    // Fetch conversations for the workspace using pagination to get ALL records
    let allConversations = []
    let offset = 0
    const batchSize = 1000
    let hasMore = true

    console.log('Starting to fetch conversations for workspace:', workspaceId)

    while (hasMore) {
      const { data: conversationBatch, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('last_message_at', { ascending: false })
        .range(offset, offset + batchSize - 1)

      if (error) throw error

      console.log(`Fetched batch ${Math.floor(offset/batchSize) + 1}: ${conversationBatch?.length || 0} conversations`)

      if (conversationBatch && conversationBatch.length > 0) {
        allConversations = allConversations.concat(conversationBatch)
        offset += batchSize
        
        // If we got less than the batch size, we've reached the end
        if (conversationBatch.length < batchSize) {
          hasMore = false
        }
      } else {
        hasMore = false
      }
    }

    const conversations = allConversations
    console.log('Total conversations fetched:', conversations.length)

    // Get user-specific unread counts if user is authenticated
    let unreadCountMap = {}
    if (userId) {
      const { data: unreadCounts, error: unreadError } = await supabase
        .rpc('get_conversation_unread_counts_for_user', {
          user_id_param: userId,
          workspace_id_param: parseInt(workspaceId)
        })

      if (unreadError) {
        console.error('Error getting unread counts:', unreadError)
        // Continue without unread counts if there's an error
      } else if (unreadCounts) {
        unreadCounts.forEach(item => {
          unreadCountMap[item.conversation_id] = item.unread_count
        })
      }
    }

    // Transform the data to match frontend format
    const transformedConversations = conversations.map(conv => {
      const userUnreadCount = unreadCountMap[conv.id] || 0
      
      return {
        id: conv.id,
        contact: conv.contact_name || conv.to_phone_number,
        phoneNumber: conv.to_phone_number,
        lastMessage: conv.last_message_preview || '',
        lastMessageTime: conv.last_message_at || conv.created_at,
        unread: userUnreadCount, // Use user-specific unread count
        fromPhoneNumber: conv.from_phone_number,
        toPhoneNumber: conv.to_phone_number,
        status: conv.status || 'primary'
      }
    })

    // Fetch group conversations for the workspace
    const { data: groupConversations, error: groupError } = await supabase
      .from('group_conversations')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('last_message_at', { ascending: false })

    if (groupError) {
      console.error('Error fetching group conversations:', groupError)
      // Continue without group conversations if there's an error
    }

    console.log('Found group conversations:', groupConversations?.length || 0)

    // Transform group conversations to match frontend format
    const transformedGroupConversations = (groupConversations || []).map(groupConv => {
      return {
        id: groupConv.group_key, // Use group_key as ID for frontend
        participants: groupConv.participants || [],
        lastMessage: groupConv.last_message_preview || '',
        lastMessageTime: groupConv.last_message_at || groupConv.created_at,
        type: 'group',
        messages: [] // Will be loaded separately when selected
      }
    })

    return res.status(200).json({
      success: true,
      conversations: transformedConversations,
      groupConversations: transformedGroupConversations
    })

  } catch (error) {
    console.error('Fetch Conversations Error:', error)
    return res.status(500).json({ 
      error: 'Failed to fetch conversations',
      details: error.message 
    })
  }
} 