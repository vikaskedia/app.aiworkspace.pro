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
    const authHeader = req.headers.authorization

    console.log('Marking conversation as read:', conversationId)

    if (!conversationId) {
      return res.status(400).json({ error: 'Conversation ID is required' })
    }

    if (!matterId) {
      return res.status(400).json({ error: 'Matter ID is required' })
    }

    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header required' })
    }

    // Extract user ID from JWT token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    const userId = user.id

    // Mark conversation as read for this specific user
    const { error } = await supabase
      .rpc('mark_conversation_as_read', {
        conversation_id_param: conversationId,
        user_id_param: userId,
        matter_id_param: parseInt(matterId)
      })

    if (error) throw error

    console.log('Conversation marked as read successfully for user:', userId)

    return res.status(200).json({
      success: true,
      message: 'Conversation marked as read'
    })

  } catch (error) {
    console.error('Mark Read Error:', error)
    return res.status(500).json({ 
      error: 'Failed to mark conversation as read',
      details: error.message 
    })
  }
} 