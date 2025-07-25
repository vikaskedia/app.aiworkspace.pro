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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { conversationId, matterId } = req.body

    console.log('Marking conversation as read:', conversationId)
    console.log('Matter ID:', matterId)

    if (!conversationId) {
      return res.status(400).json({ error: 'Conversation ID is required' })
    }

    if (!matterId) {
      return res.status(400).json({ error: 'Matter ID is required' })
    }

    // Get user from Authorization header if provided
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
        console.log('Auth header parsing failed')
      }
    }

    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' })
    }

    // Mark conversation as read for this specific user
    const { error } = await supabase
      .rpc('mark_conversation_as_read_for_user', {
        conversation_id_param: conversationId,
        user_id_param: userId,
        matter_id_param: parseInt(matterId)
      })

    if (error) throw error

    console.log('Conversation marked as read for user:', userId)

    return res.status(200).json({
      success: true,
      message: 'Conversation marked as read for user'
    })

  } catch (error) {
    console.error('Mark Read Error:', error)
    return res.status(500).json({ 
      error: 'Failed to mark conversation as read',
      details: error.message 
    })
  }
} 