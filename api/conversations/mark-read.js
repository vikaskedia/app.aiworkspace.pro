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
    const { conversationId } = req.body

    console.log('Marking conversation as read:', conversationId)

    if (!conversationId) {
      return res.status(400).json({ error: 'Conversation ID is required' })
    }

    // Mark conversation as read by setting unread_count to 0
    const { error } = await supabase
      .from('conversations')
      .update({
        unread_count: 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId)

    if (error) throw error

    console.log('Conversation marked as read successfully')

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