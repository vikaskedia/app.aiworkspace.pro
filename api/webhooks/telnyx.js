import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const payload = req.body
    
    // Log all webhook events for debugging
    await supabase
      .from('telnyx_webhook_events')
      .insert({
        event_type: payload.data?.event_type || 'unknown',
        message_id: payload.data?.payload?.id || null,
        payload: payload,
        processed: false
      })

    // Handle different event types
    const eventType = payload.data?.event_type
    const eventData = payload.data?.payload

    console.log('Telnyx Webhook Event:', eventType, eventData?.id)
    console.log('Full webhook payload:', JSON.stringify(payload, null, 2))

    switch (eventType) {
      case 'message.sent':
        await handleMessageSent(eventData)
        break
        
      case 'message.finalized':
        await handleMessageDelivered(eventData)
        break
        
      case 'message.failed':
        await handleMessageFailed(eventData)
        break
        
      case 'message.received':
        await handleMessageReceived(eventData)
        break
        
      default:
        console.log('Unhandled event type:', eventType)
    }

    return res.status(200).json({ success: true })

  } catch (error) {
    console.error('Webhook Error:', error)
    return res.status(500).json({ error: 'Webhook processing failed' })
  }
}

async function handleMessageSent(eventData) {
  const { error } = await supabase
    .from('messages')
    .update({
      status: 'sent',
      webhook_data: eventData
    })
    .eq('telnyx_message_id', eventData.id)
    
  if (error) {
    console.error('Error updating sent message:', error)
  }
}

async function handleMessageDelivered(eventData) {
  const { error } = await supabase
    .from('messages')
    .update({
      status: 'delivered',
      delivered_at: new Date().toISOString(),
      webhook_data: eventData
    })
    .eq('telnyx_message_id', eventData.id)
    
  if (error) {
    console.error('Error updating delivered message:', error)
  }
}

async function handleMessageFailed(eventData) {
  const { error } = await supabase
    .from('messages')
    .update({
      status: 'failed',
      failed_reason: eventData.errors?.[0]?.detail || 'Unknown error',
      webhook_data: eventData
    })
    .eq('telnyx_message_id', eventData.id)
    
  if (error) {
    console.error('Error updating failed message:', error)
  }
}

async function handleMessageReceived(eventData) {
  try {
    const fromPhone = eventData.from.phone_number;
    const toPhone = eventData.to[0].phone_number;
    const messageText = eventData.text || '';
    const cc = eventData.cc;
    // Check if this is an MMS message with media
    const hasMedia = eventData.media && eventData.media.length > 0;
    const messageType = hasMedia ? 'MMS' : 'SMS';

    // Find the matter based on the receiving phone number
    const { data: matters, error: matterError } = await supabase
      .from('matters')
      .select('id, phone_numbers')
      .not('phone_numbers', 'is', null);

    if (matterError) throw matterError;

    let matterId = null;
    for (const matter of matters || []) {
      const phoneNumbers = matter.phone_numbers || [];
      if (phoneNumbers.some(p => p.number === toPhone)) {
        matterId = matter.id;
        break;
      }
    }

    if (!matterId) {
      console.error('No matter found for phone number:', toPhone);
      return;
    }

    // Prepare media files array if this is MMS
    let mediaFiles = null;
    let mediaUrls = null;
    if (hasMedia) {
      mediaFiles = eventData.media.map(media => ({
        id: `telnyx-${Date.now()}-${Math.random()}`,
        filename: media.content_type.split('/')[1] || 'media',
        size: media.size || 0,
        mimetype: media.content_type,
        public_url: media.url,
        source: 'telnyx',
        received_at: new Date().toISOString()
      }));
      mediaUrls = eventData.media.map(media => media.url);
    }

    // Create preview text for conversation
    let previewText = messageText;
    if (hasMedia && !messageText.trim()) {
      previewText = `📎 ${eventData.media.length} attachment(s)`;
    } else if (hasMedia && messageText.trim()) {
      previewText = `📎 ${messageText.substring(0, 80)}...`;
    }

    // --- GROUP MESSAGE LOGIC ---
    let groupKey = null;
    if (Array.isArray(cc) && cc.length > 1 && fromPhone) {
      // Compute group key
      const groupNumbers = Array.from(new Set([fromPhone, ...cc])).sort();
      groupKey = groupNumbers.join('-');
      // Upsert group_conversations
      const { error: groupConvError } = await supabase
        .from('group_conversations')
        .upsert([
          {
            group_key: groupKey,
            participants: groupNumbers,
            last_message_at: new Date().toISOString(),
            last_message_preview: previewText.substring(0, 100),
            matter_id: matterId
          }
        ], { onConflict: 'group_key'});
      if (groupConvError) {
        console.error('Error upserting group_conversations:', groupConvError);
      }
    }else{
      console.log('No group key found', 'cc', cc, 'fromPhone', fromPhone);
    }
    // --- END GROUP MESSAGE LOGIC ---

    // Find or create conversation (for 1:1, fallback)
    let conversation = null;
    let { data: conv, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('matter_id', matterId)
      .eq('from_phone_number', toPhone)
      .eq('to_phone_number', fromPhone)
      .single();
    if (convError && convError.code !== 'PGRST116') {
      throw convError;
    }
    // Create conversation if it doesn't exist
    if (!conv) {
      const { data: newConv, error: createError } = await supabase
        .from('conversations')
        .insert({
          matter_id: matterId,
          from_phone_number: toPhone,
          to_phone_number: fromPhone,
          contact_name: null,
          last_message_at: new Date().toISOString(),
          last_message_preview: previewText.substring(0, 100)
        })
        .select()
        .single();
      if (createError) throw createError;
      conversation = newConv;
    } else {
      // Update existing conversation
      await supabase
        .from('conversations')
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: previewText.substring(0, 100)
        })
        .eq('id', conv.id);
      conversation = conv;
    }

    // Create message record (always)
    const { error: msgError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversation ? conversation.id : null,
        telnyx_message_id: eventData.id,
        direction: 'inbound',
        from_phone_number: fromPhone,
        to_phone_number: toPhone,
        message_body: messageText,
        message_type: messageType,
        media_files: mediaFiles,
        media_urls: mediaUrls,
        status: 'received',
        webhook_data: eventData,
        group_key: groupKey || null
      });
    if (msgError) throw msgError;

    console.log(`Received ${messageType} message processed successfully`, {
      hasMedia,
      mediaCount: mediaFiles ? mediaFiles.length : 0,
      groupKey
    });
  } catch (error) {
    console.error('Error handling received message:', error);
  }
} 