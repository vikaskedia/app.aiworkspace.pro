import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { supabase } from '../supabase'

export function useRealtimeMessages(matterId) {
  const conversations = ref([])
  
  // Channels for subscriptions
  let conversationsChannel = null
  let messagesChannel = null

  // Computed properties
  const sortedConversations = computed(() => {
    return [...conversations.value].sort((a, b) => {
      const timeA = new Date(a.lastMessageTime || new Date())
      const timeB = new Date(b.lastMessageTime || new Date())
      return timeB - timeA
    })
  })



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

  const handleMessageChange = (payload) => {
    console.log('💬 Message change:', payload.eventType, payload.new)
    
    switch (payload.eventType) {
      case 'INSERT':
        handleNewMessage(payload.new)
        break
      case 'UPDATE':
        handleMessageUpdate(payload.new)
        break
      case 'DELETE':
        handleMessageDelete(payload.old)
        break
    }
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

  // Transform functions to match frontend format
  const transformConversation = (conv) => ({
    id: conv.id,
    contact: conv.contact_name || conv.to_phone_number,
    phoneNumber: conv.to_phone_number,
    fromPhoneNumber: conv.from_phone_number,
    lastMessage: conv.last_message_preview || '',
    lastMessageTime: conv.last_message_at || conv.created_at || new Date().toISOString(),
    unread: conv.unread_count || 0,
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
      const response = await fetch(`https://app.aiworkspace.pro/api/conversations?matterId=${matterId.value}`)
      const result = await response.json()
      
      if (response.ok && result.success) {
        conversations.value = result.conversations || []
        console.log('📱 Loaded conversations:', conversations.value.length)
      } else {
        console.error('Failed to load conversations:', result.error)
      }
    } catch (error) {
      console.error('Error loading conversations:', error)
    }
  }

  // Load messages for a specific conversation
  const loadMessagesForConversation = async (conversationId) => {
    try {
      const response = await fetch(`https://app.aiworkspace.pro/api/messages/${conversationId}`)
      const result = await response.json()
      
      if (response.ok && result.success) {
        // The API already transforms messages, so we don't need to transform them again
        const messages = result.messages
        
        // Update conversation with loaded messages
        const conversation = conversations.value.find(c => c.id === conversationId)
        if (conversation) {
          conversation.messages = messages
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

  // Mark conversation as read
  const markConversationAsRead = async (conversationId) => {
    const conversation = conversations.value.find(c => c.id === conversationId)
    if (conversation) {
      // Optimistically update unread count
      conversation.unread = 0
    }
    
    try {
      const response = await fetch('https://app.aiworkspace.pro/api/conversations/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId })
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
    
    // Methods
    loadConversations,
    loadMessagesForConversation,
    markConversationAsRead,
    initializeSubscriptions,
    unsubscribe
  }
} 