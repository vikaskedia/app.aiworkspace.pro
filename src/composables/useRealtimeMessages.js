import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { supabase } from '../supabase'

export function useRealtimeMessages(matterId) {
  const conversations = ref([])
  const groupConversations = ref([]) // Store group conversations from API
  
  // Channels for subscriptions
  let conversationsChannel = null
  let messagesChannel = null
  let callRecordingsChannel = null
  let conversationReadStatusChannel = null

  // Computed properties
  const sortedConversations = computed(() => {
    return [...conversations.value].sort((a, b) => {
      const timeA = new Date(a.lastMessageTime || new Date())
      const timeB = new Date(b.lastMessageTime || new Date())
      return timeB - timeA
    })
  })

  // Get auth token for API calls
  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      return session.access_token
    }
    
    // Fallback: try to get from localStorage if session is not available
    try {
      const authData = localStorage.getItem('sb-auth-token')
      if (authData) {
        const parsed = JSON.parse(authData)
        return parsed.access_token
      }
    } catch (error) {
      console.error('Error parsing auth token from localStorage:', error)
    }
    
    return null
  }

  // --- GROUP MESSAGING LOGIC START ---
  // Note: Group logic moved to backend, this section is now simplified
  // groupConversations are now fetched directly from the API
  // --- GROUP MESSAGING LOGIC END ---

  // Event handlers
  const handleConversationChange = (payload) => {
    console.log('🔄 Conversation change:', payload.eventType, payload.new)
    
    switch (payload.eventType) {
      case 'INSERT':
        handleNewConversation(payload.new)
        break
      case 'UPDATE':
        handleConversationUpdate(payload.new)
        break
      case 'DELETE':
        handleConversationDelete(payload.old)
        break
    }
  }

  const handleMessageChange = async (payload) => {
    console.log('💬 Message change:', payload.eventType, payload.new)
    switch (payload.eventType) {
      case 'INSERT':
        await handleNewMessage(payload.new)
        await loadConversations()
        break
      case 'UPDATE':
        handleMessageUpdate(payload.new)
        break
      case 'DELETE':
        handleMessageDelete(payload.old)
        break
    }
  }

  const handleConversationReadStatusChange = async (payload) => {
    console.log('👁️ Conversation read status change:', payload.eventType, payload.new)
    
    // Reload conversations to get updated unread counts
    await loadConversations()
  }

  const handleNewConversation = (newConversation) => {
    // Check if conversation already exists
    const existingIndex = conversations.value.findIndex(c => c.id === newConversation.id)
    
    if (existingIndex === -1) {
      // Add new conversation
      const transformedConversation = transformConversation(newConversation)
      conversations.value.unshift(transformedConversation)
    }
  }

  const handleConversationUpdate = (updatedConversation) => {
    console.log('🔄 Conversation UPDATE event:', {
      id: updatedConversation.id,
      contact: updatedConversation.contact_name || updatedConversation.to_phone_number,
      lastMessagePreview: updatedConversation.last_message_preview,
      unreadCount: updatedConversation.unread_count,
      lastMessageAt: updatedConversation.last_message_at
    })
    
    const index = conversations.value.findIndex(c => c.id === updatedConversation.id)
    
    if (index !== -1) {
      // Update existing conversation
      conversations.value[index] = {
        ...conversations.value[index],
        ...transformConversation(updatedConversation)
      }
      
      // Move to top if it has new activity
      if (updatedConversation.last_message_at) {
        const conversation = conversations.value.splice(index, 1)[0]
        conversations.value.unshift(conversation)
      }
    }
  }

  const handleConversationDelete = (deletedConversation) => {
    const index = conversations.value.findIndex(c => c.id === deletedConversation.id)
    if (index !== -1) {
      conversations.value.splice(index, 1)
    }
  }

  const handleNewMessage = async (newMessage) => {
    // Find the conversation this message belongs to
    const conversationIndex = conversations.value.findIndex(c => c.id === newMessage.conversation_id)
    
    if (conversationIndex !== -1) {
      const conversation = conversations.value[conversationIndex]
      
      // If conversation has messages loaded, check for duplicates before adding
      if (conversation.messages && Array.isArray(conversation.messages)) {
        // Check if message already exists (prevent duplicates from optimistic updates)
        const existingMessage = conversation.messages.find(m => 
          m.id === newMessage.id || 
          (m.id && m.id.toString().startsWith('temp-') && 
           m.text === newMessage.message_body && 
           m.direction === newMessage.direction)
        )
        
        if (existingMessage) {
          // Replace temporary message with real one
          if (existingMessage.id && existingMessage.id.toString().startsWith('temp-')) {
            const messageIndex = conversation.messages.findIndex(m => m.id === existingMessage.id)
            if (messageIndex !== -1) {
              conversation.messages[messageIndex] = transformMessage(newMessage)
            }
          }
          // If it's a real message that already exists, ignore it
        } else {
          // Add new message only if it doesn't exist
          conversation.messages.push(transformMessage(newMessage))
        }
      }
      
      // Note: We don't update unread count or move conversation here
      // because the conversation UPDATE event will handle that with accurate database data
    } else {
      // Message for conversation not in current list - refresh conversations
      console.log('Message for unknown conversation, refreshing...')
      await loadConversations()
    }
  }

  const handleMessageUpdate = (updatedMessage) => {
    // Find conversation and update message status
    const conversation = conversations.value.find(c => c.id === updatedMessage.conversation_id)
    
    if (conversation && conversation.messages) {
      const messageIndex = conversation.messages.findIndex(m => m.id === updatedMessage.id)
      if (messageIndex !== -1) {
        conversation.messages[messageIndex] = {
          ...conversation.messages[messageIndex],
          ...transformMessage(updatedMessage)
        }
      }
    }
  }

  const handleMessageDelete = (deletedMessage) => {
    const conversation = conversations.value.find(c => c.id === deletedMessage.conversation_id)
    
    if (conversation && conversation.messages) {
      const messageIndex = conversation.messages.findIndex(m => m.id === deletedMessage.id)
      if (messageIndex !== -1) {
        conversation.messages.splice(messageIndex, 1)
      }
    }
  }

  // Call recording event handlers
  const handleCallRecordingChange = (payload) => {
    console.log('📞 Call recording change:', payload.eventType, payload.new)
    
    switch (payload.eventType) {
      case 'INSERT':
        handleNewCallRecording(payload.new)
        break
      case 'UPDATE':
        handleCallRecordingUpdate(payload.new)
        break
      case 'DELETE':
        handleCallRecordingDelete(payload.old)
        break
    }
  }

  const handleNewCallRecording = (newRecording) => {
    // Find the conversation this recording belongs to
    const conversation = conversations.value.find(c => c.id === newRecording.conversation_id)
    
    if (conversation) {
      // Initialize callRecordings array if it doesn't exist
      if (!conversation.callRecordings) {
        conversation.callRecordings = []
      }
      
      // Check if recording already exists
      const existingRecording = conversation.callRecordings.find(r => r.id === newRecording.id)
      
      if (!existingRecording) {
        // Add new recording
        conversation.callRecordings.push(newRecording)
        console.log('📞 Added new call recording to conversation:', newRecording.id)
      }
    }
  }

  const handleCallRecordingUpdate = (updatedRecording) => {
    // Find conversation and update recording
    const conversation = conversations.value.find(c => c.id === updatedRecording.conversation_id)
    
    if (conversation && conversation.callRecordings) {
      const recordingIndex = conversation.callRecordings.findIndex(r => r.id === updatedRecording.id)
      if (recordingIndex !== -1) {
        conversation.callRecordings[recordingIndex] = {
          ...conversation.callRecordings[recordingIndex],
          ...updatedRecording
        }
      }
    }
  }

  const handleCallRecordingDelete = (deletedRecording) => {
    const conversation = conversations.value.find(c => c.id === deletedRecording.conversation_id)
    
    if (conversation && conversation.callRecordings) {
      const recordingIndex = conversation.callRecordings.findIndex(r => r.id === deletedRecording.id)
      if (recordingIndex !== -1) {
        conversation.callRecordings.splice(recordingIndex, 1)
      }
    }
  }

  // Transform functions to match frontend format
  const transformConversation = (conv) => ({
    id: conv.id,
    contact: conv.contact_name || conv.to_phone_number,
    phoneNumber: conv.to_phone_number,
    fromPhoneNumber: conv.from_phone_number,
    lastMessage: conv.last_message_preview || '',
    lastMessageTime: conv.last_message_at || conv.created_at || new Date().toISOString(),
    unread: conv.unread || 0, // This will now come from user-specific API
    matterId: conv.matter_id,
    status: conv.status || 'primary'
  })

  const transformMessage = (msg) => ({
    id: msg.id,
    text: msg.message_body,
    direction: msg.direction,
    timestamp: msg.created_at || new Date().toISOString(),
    status: msg.status,
    telnyxId: msg.telnyx_message_id,
    messageType: msg.message_type,
    mediaFiles: msg.media_files || [],
    mediaUrls: msg.media_urls || []
  })

  // Load conversations from database
  const loadConversations = async () => {
    if (!matterId.value) return
    try {
      const token = await getAuthToken()
      const response = await fetch(`https://app.aiworkspace.pro/api/conversations?workspaceId=${matterId.value}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const result = await response.json()
      
      if (response.ok && result.success) {
        // Store current conversations with their messages for preservation
        const currentConversations = conversations.value
        const conversationsWithMessages = {}
        
        // Create a map of conversation ID to messages
        currentConversations.forEach(conv => {
          if (conv.messages && conv.messages.length > 0) {
            conversationsWithMessages[conv.id] = conv.messages
          }
        })
        
        conversations.value = result.conversations || []
        groupConversations.value = result.groupConversations || [] // Store group conversations from API
        
        // Restore messages for conversations that had them
        conversations.value.forEach(conv => {
          if (conversationsWithMessages[conv.id]) {
            conv.messages = conversationsWithMessages[conv.id]
          }
        })
        
        console.log('📱 Loaded conversations:', conversations.value.length)
        console.log('👥 Loaded group conversations:', groupConversations.value.length)
      } else {
        console.error('Failed to load conversations:', result.error)
      }
    } catch (error) {
      console.error('Error loading conversations:', error)
    }
  }

  // Load messages for a specific conversation (works for both 1:1 and group)
  const loadMessagesForConversation = async (conversationId) => {
    try {
      const response = await fetch(`https://app.aiworkspace.pro/api/messages/${conversationId}`)
      const result = await response.json()
      if (response.ok && result.success) {
        const messages = result.messages
        console.log('Loaded messages for conversation:', conversationId, messages)
        
        // Update conversation with loaded messages (works for both 1:1 and group)
        const conversation = conversations.value.find(c => c.id === conversationId)
        const groupConversationIndex = groupConversations.value.findIndex(gc => gc.id === conversationId)
        
        if (conversation) {
          conversation.messages = messages
        }
        if (groupConversationIndex !== -1) {
          // Update the entire object to trigger Vue reactivity
          groupConversations.value[groupConversationIndex] = {
            ...groupConversations.value[groupConversationIndex],
            messages: messages
          }
        }
        
        // Also load call recordings for this conversation (only for 1:1 conversations, not groups)
        // Group conversations use group keys (contains dashes), regular conversations use UUIDs
        const isGroupConversation = conversationId.includes('-') && conversationId.includes('+')
        if (!isGroupConversation) {
          await loadCallRecordingsForConversation(conversationId)
        }
        return messages
      } else {
        console.error('Failed to load messages:', result.error)
        return []
      }
    } catch (error) {
      console.error('Error loading messages:', error)
      return []
    }
  }

  // Load call recordings for a specific conversation
  const loadCallRecordingsForConversation = async (conversationId) => {
    try {
      const { data: recordings, error } = await supabase
        .from('call_recordings')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('recorded_at', { ascending: true });

      if (error) throw error;

      // Update conversation with loaded call recordings
      const conversation = conversations.value.find(c => c.id === conversationId)
      if (conversation) {
        conversation.callRecordings = recordings || [];
        console.log('📞 Loaded call recordings for conversation:', recordings?.length || 0);
      }
    } catch (error) {
      console.error('Error loading call recordings:', error);
    }
  }

  // Mark conversation as read
  const markConversationAsRead = async (conversationId) => {
    const conversation = conversations.value.find(c => c.id === conversationId)
    if (conversation) {
      // Optimistically update unread count
      conversation.unread = 0
    }
    
    try {
      const token = await getAuthToken()
      const response = await fetch('https://app.aiworkspace.pro/api/conversations/mark-read', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          conversationId,
          matterId: matterId.value
        })
      })
      
      if (!response.ok) {
        console.error('Failed to mark conversation as read')
        // Revert optimistic update
        if (conversation) {
          await loadConversations() // Reload to get correct state
        }
      }
    } catch (error) {
      console.error('Error marking conversation as read:', error)
    }
  }

  // Subscribe to conversations changes
  const subscribeToConversations = () => {
    if (!matterId.value) return
    
    conversationsChannel = supabase
      .channel(`conversations-${matterId.value}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'conversations',
        filter: `matter_id=eq.${matterId.value}`
      }, handleConversationChange)
      .subscribe((status) => {
        console.log('📡 Conversations subscription status:', status)
      })
  }

  // Subscribe to messages changes
  const subscribeToMessages = () => {
    if (!matterId.value) return
    
    messagesChannel = supabase
      .channel(`messages-${matterId.value}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages'
      }, handleMessageChange)
      .subscribe((status) => {
        console.log('💬 Messages subscription status:', status)
      })
  }

  // Subscribe to call recordings changes
  const subscribeToCallRecordings = () => {
    if (!matterId.value) return
    
    callRecordingsChannel = supabase
      .channel(`call-recordings-${matterId.value}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'call_recordings'
      }, handleCallRecordingChange)
      .subscribe((status) => {
        console.log('📞 Call recordings subscription status:', status)
      })
  }

  // Subscribe to conversation read status changes
  const subscribeToConversationReadStatus = () => {
    if (!matterId.value) return
    
    conversationReadStatusChannel = supabase
      .channel(`conversation-read-status-${matterId.value}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'conversation_read_status',
        filter: `matter_id=eq.${matterId.value}`
      }, handleConversationReadStatusChange)
      .subscribe((status) => {
        console.log('👁️ Conversation read status subscription status:', status)
      })
  }

  // Unsubscribe from all channels
  const unsubscribe = () => {
    if (conversationsChannel) {
      supabase.removeChannel(conversationsChannel)
      conversationsChannel = null
    }
    
    if (messagesChannel) {
      supabase.removeChannel(messagesChannel)
      messagesChannel = null
    }
    
    if (callRecordingsChannel) {
      supabase.removeChannel(callRecordingsChannel)
      callRecordingsChannel = null
    }

    if (conversationReadStatusChannel) {
      supabase.removeChannel(conversationReadStatusChannel)
      conversationReadStatusChannel = null
    }
  }

  // Initialize subscriptions when matterId changes
  const initializeSubscriptions = () => {
    if (!matterId.value) return
    
    console.log('🚀 Initializing real-time subscriptions for matter:', matterId.value)
    
    // Unsubscribe from previous subscriptions
    unsubscribe()
    
    // Load initial data
    loadConversations()
    
    // Subscribe to real-time updates
    subscribeToConversations()
    subscribeToMessages()
    subscribeToCallRecordings()
    subscribeToConversationReadStatus()
  }

  // Watch for matterId changes
  watch(() => matterId.value, (newMatterId) => {
    if (newMatterId) {
      initializeSubscriptions()
    } else {
      unsubscribe()
      conversations.value = []
    }
  }, { immediate: true })

  // Cleanup on unmount
  onUnmounted(() => {
    unsubscribe()
  })

  return {
    // State
    conversations: sortedConversations,
    groupConversations, // Expose group conversations for UI
    
    // Methods
    loadConversations,
    loadMessagesForConversation,
    loadCallRecordingsForConversation,
    markConversationAsRead,
    initializeSubscriptions,
    unsubscribe
  }
} 