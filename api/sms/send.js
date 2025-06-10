import { createClient } from '@supabase/supabase-js'
import telnyx from 'telnyx'

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Initialize Telnyx client
const telnyxClient = telnyx(process.env.TELNYX_API_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Debug: Check if API key is loaded
  //console.log('Telnyx API Key exists:', !!process.env.TELNYX_API_KEY)
  //console.log('Telnyx API Key starts with KEY:', process.env.TELNYX_API_KEY?.startsWith('KEY'))

  try {
    const { from, to, message, matter_id, media_files, subject } = req.body
    //console.log('SMS Request:', { from, to, message: message?.substring(0, 50), matter_id })

    // Validate required fields
    if (!from || !to || !matter_id) {
      return res.status(400).json({ 
        error: 'Missing required fields: from, to, matter_id' 
      })
    }

    // For MMS, either message or media_files is required
    const isMMSMessage = media_files && media_files.length > 0
    if (!message && !isMMSMessage) {
      return res.status(400).json({ 
        error: 'Either message text or media files are required' 
      })
    }

    // Validate phone number format (basic validation)
    const phoneRegex = /^\+1\d{10}$/
    if (!phoneRegex.test(from) || !phoneRegex.test(to)) {
      return res.status(400).json({ 
        error: 'Invalid phone number format. Use +1XXXXXXXXXX' 
      })
    }

    //console.log('Finding/creating conversation...')
    // Find or create conversation
    let { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('matter_id', matter_id)
      .eq('from_phone_number', from)
      .eq('to_phone_number', to)
      .single()

    if (convError && convError.code !== 'PGRST116') {
      throw convError
    }

    //console.log('Conversation found/created:', conversation?.id)

    // Create conversation if it doesn't exist
    if (!conversation) {
      //console.log('Creating new conversation...')
      const { data: newConv, error: createError } = await supabase
        .from('conversations')
        .insert({
          matter_id,
          from_phone_number: from,
          to_phone_number: to,
          contact_name: null, // Can be updated later
          last_message_at: new Date().toISOString(),
          last_message_preview: message.substring(0, 100),
          unread_count: 0
        })
        .select()
        .single()

      if (createError) throw createError
      conversation = newConv
    }

    //console.log('Creating message record...')
    // Create message record with pending status
    const { data: messageRecord, error: msgError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        direction: 'outbound',
        from_phone_number: from,
        to_phone_number: to,
        message_body: message || '',
        status: 'pending',
        message_type: isMMSMessage ? 'MMS' : 'SMS',
        media_files: media_files || null,
        media_urls: isMMSMessage ? media_files.map(f => f.public_url) : null,
        subject: subject || null
      })
      .select()
      .single()

    if (msgError) throw msgError

    //console.log('Message record created:', messageRecord.id)
    console.log(`Sending ${isMMSMessage ? 'MMS' : 'SMS'} via Telnyx...`)
    
    // Prepare Telnyx message payload
    const telnyxPayload = {
      from: from,
      to: to,
      text: message || ''
    }

    // Add MMS-specific fields if this is an MMS message
    if (isMMSMessage) {
      telnyxPayload.media_urls = media_files.map(f => f.public_url)
      if (subject) {
        telnyxPayload.subject = subject
      }
    }
    
    // Send message via Telnyx
    const messageResponse = await telnyxClient.messages.create(telnyxPayload)

    console.log('Telnyx response:', messageResponse.data)

    // Update message record with Telnyx message ID and sent status
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        telnyx_message_id: messageResponse.data.id,
        status: 'sent',
        webhook_data: messageResponse.data
      })
      .eq('id', messageRecord.id)

    if (updateError) throw updateError

    // Update conversation with latest message info
    const previewText = isMMSMessage && !message ? 
      `📎 ${media_files.length} attachment(s)` : 
      (message || '').substring(0, 100)
      
    await supabase
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: previewText
      })
      .eq('id', conversation.id)

    console.log(`${isMMSMessage ? 'MMS' : 'SMS'} sent successfully!`)
    console.log('Conversation updated, sending success response')
    
    return res.status(200).json({
      success: true,
      message_id: messageRecord.id,
      telnyx_message_id: messageResponse.data.id,
      conversation_id: conversation.id,
      message_type: isMMSMessage ? 'MMS' : 'SMS',
      media_count: media_files ? media_files.length : 0,
      debug: {
        conversation_id: conversation.id,
        message_count: 1,
        matter_id: matter_id
      }
    })

  } catch (error) {
    console.error('SMS Send Error:', error)
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    })
    
    return res.status(500).json({ 
      error: 'Failed to send SMS',
      details: error.message,
      errorType: error.name
    })
  }
} 