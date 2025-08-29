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
        
      // Fax event handlers
      case 'fax.queued':
        await handleFaxQueued(eventData)
        break
        
      case 'fax.media.processed':
        await handleFaxMediaProcessed(eventData)
        break
        
      case 'fax.sending.started':
        await handleFaxSendingStarted(eventData)
        break
        
      case 'fax.delivered':
        await handleFaxDelivered(eventData)
        break
        
      case 'fax.failed':
        await handleFaxFailed(eventData)
        break
        
      case 'fax.received':
        await handleFaxReceived(eventData)
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

    // Find the workspace based on the receiving phone number
    const { data: workspaces, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id, phone_numbers')
      .not('phone_numbers', 'is', null);

    if (workspaceError) throw workspaceError;

    let workspaceId = null;
    for (const workspace of workspaces || []) {
      const phoneNumbers = workspace.phone_numbers || [];
      if (phoneNumbers.some(p => p.number === toPhone)) {
        workspaceId = workspace.id;
        break;
      }
    }

    if (!workspaceId) {
      console.error('No workspace found for phone number:', toPhone);
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
            workspace_id: workspaceId
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
      .eq('workspace_id', workspaceId)
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
          workspace_id: workspaceId,
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

// ============ FAX EVENT HANDLERS ============
async function handleFaxQueued(eventData) {
  try {
    console.log('Handling fax queued:', eventData.fax_id);
    
    // Update fax status to queued
    const { error } = await supabase
      .from('faxes')
      .update({
        status: 'queued',
        metadata: eventData,
        updated_at: new Date().toISOString()
      })
      .eq('telnyx_id', eventData.fax_id);
      
    if (error) {
      console.error('Error updating queued fax:', error);
    }
  } catch (error) {
    console.error('Error handling fax queued:', error);
  }
}

async function handleFaxMediaProcessed(eventData) {
  try {
    console.log('Handling fax media processed:', eventData.fax_id);
    
    // Update fax status to media.processed
    const { error } = await supabase
      .from('faxes')
      .update({
        status: 'media.processed',
        metadata: eventData,
        updated_at: new Date().toISOString()
      })
      .eq('telnyx_id', eventData.fax_id);
      
    if (error) {
      console.error('Error updating media processed fax:', error);
    }
  } catch (error) {
    console.error('Error handling fax media processed:', error);
  }
}

async function handleFaxSendingStarted(eventData) {
  try {
    console.log('Handling fax sending started:', eventData.fax_id);
    
    // Update fax status to sending
    const { error } = await supabase
      .from('faxes')
      .update({
        status: 'sending',
        metadata: eventData,
        updated_at: new Date().toISOString()
      })
      .eq('telnyx_id', eventData.fax_id);
      
    if (error) {
      console.error('Error updating sending fax:', error);
    }
  } catch (error) {
    console.error('Error handling fax sending started:', error);
  }
}

async function handleFaxDelivered(eventData) {
  try {
    console.log('Handling fax delivered:', eventData.fax_id);
    
    // Update fax status to delivered with additional data
    const { error } = await supabase
      .from('faxes')
      .update({
        status: 'delivered',
        pages: eventData.page_count || null,
        // store other event details inside metadata JSONB
        metadata: Object.assign({}, eventData, { delivered_at: new Date().toISOString() }),
        updated_at: new Date().toISOString()
      })
      .eq('telnyx_id', eventData.fax_id);
      
    if (error) {
      console.error('Error updating delivered fax:', error);
    }
  } catch (error) {
    console.error('Error handling fax delivered:', error);
  }
}

async function handleFaxFailed(eventData) {
  try {
    console.log('Handling fax failed:', eventData.fax_id);
    
    // Update fax status to failed with reason
    const { error } = await supabase
      .from('faxes')
      .update({
        status: 'failed',
        status_reason: eventData.errors?.[0]?.detail || eventData.error_message || 'Unknown error',
        metadata: eventData,
        updated_at: new Date().toISOString()
      })
      .eq('telnyx_id', eventData.fax_id);
      
    if (error) {
      console.error('Error updating failed fax:', error);
    }
  } catch (error) {
    console.error('Error handling fax failed:', error);
  }
}

async function handleFaxReceived(eventData) {
  try {
    console.log('Handling fax received:', eventData.fax_id);
    
    const fromPhone = eventData.from;
    const toPhone = eventData.to;
    
    // Find the workspace based on the receiving fax number
    const { data: workspaces, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id, fax_numbers')
      .not('fax_numbers', 'is', null);

    if (workspaceError) throw workspaceError;

    let workspaceId = null;
    for (const workspace of workspaces || []) {
      const faxNumbers = workspace.fax_numbers || [];
      if (faxNumbers.some(f => f.number === toPhone)) {
        workspaceId = workspace.id;
        break;
      }
    }

    if (!workspaceId) {
      console.error('No workspace found for fax number:', toPhone);
      return;
    }

    // Create or update fax record for received fax
    const { error } = await supabase
      .from('faxes')
      .upsert({
        telnyx_id: eventData.fax_id,
        workspace_id: workspaceId,
        connection_id: eventData.connection_id || null,
        direction: 'inbound',
        from_number: fromPhone,
        to_number: toPhone,
        status: 'received',
        file_url: eventData.media_url || eventData.original_media_url || null,
        pages: eventData.page_count || null,
        // keep additional event details in metadata
        metadata: eventData
      }, { 
        onConflict: 'telnyx_id',
        ignoreDuplicates: false 
      });
      
    if (error) {
      console.error('Error creating/updating received fax:', error);
    }
  } catch (error) {
    console.error('Error handling fax received:', error);
  }
} 