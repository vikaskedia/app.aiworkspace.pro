import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { supabase } from '../supabase'

export function useRealtimeMessages(matterId) {
  const conversations = ref([])
  const isConnected = ref(false)
  const connectionStatus = ref('disconnected') // 'disconnected', 'connecting', 'connected'
  const lastUpdate = ref(null)
  
  // Channels for subscriptions
  let conversationsChannel = null
  let messagesChannel = null

  // Computed properties
  const sortedConversations = computed(() => {
    return [...conversations.value].sort((a, b) => {
      const timeA = new Date(a.last_message_at || a.created_at)
      const timeB = new Date(b.last_message_at || b.created_at)
      return timeB - timeA
    })
  })

  const totalUnreadCount = computed(() => {
    return conversations.value.reduce((sum, conv) => sum + (conv.unread_count || 0), 0)
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
    
    lastUpdate.value = new Date()
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
    
    lastUpdate.value = new Date()
  }

  const handleNewConversation = (newConversation) => {
    // Check if conversation already exists
    const existingIndex = conversations.value.findIndex(c => c.id === newConversation.id)
    
    if (existingIndex === -1) {
      // Add new conversation
      const transformedConversation = transformConversation(newConversation)
      conversations.value.unshift(transformedConversation)
      
      // Show notification for new conversation
      showNotification(`New conversation from ${transformedConversation.contact}`, 'info')
    }
  }

  const handleConversationUpdate = (updatedConversation) => {
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
      
      // Update conversation with latest message info
      conversation.lastMessage = newMessage.message_body
      conversation.lastMessageTime = newMessage.created_at
      
      // If it's an inbound message, increment unread count
      if (newMessage.direction === 'inbound') {
        conversation.unread = (conversation.unread || 0) + 1
        
        // Show notification for new inbound message
        showNotification(
          `New message from ${conversation.contact}: ${newMessage.message_body.substring(0, 50)}...`,
          'info'
        )
      }
      
      // Move conversation to top
      const updatedConversation = conversations.value.splice(conversationIndex, 1)[0]
      conversations.value.unshift(updatedConversation)
      
      // If conversation has messages loaded, add the new message
      if (conversation.messages && Array.isArray(conversation.messages)) {
        conversation.messages.push(transformMessage(newMessage))
      }
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
    lastMessageTime: conv.last_message_at || conv.created_at,
    unread: conv.unread_count || 0,
    matterId: conv.matter_id
  })

  const transformMessage = (msg) => ({
    id: msg.id,
    text: msg.message_body,
    direction: msg.direction,
    timestamp: msg.created_at,
    status: msg.status,
    telnyxId: msg.telnyx_message_id
  })

  // Notification helper
  const showNotification = (message, type = 'info') => {
    // Check if notifications are enabled and page is not visible
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('New SMS Message', {
        body: message,
        icon: '/favicon.ico',
        tag: 'sms-notification'
      })
    }
    
    // Also emit event for component to handle
    window.dispatchEvent(new CustomEvent('sms-notification', {
      detail: { message, type }
    }))
  }

  // Load conversations from database
  const loadConversations = async () => {
    if (!matterId.value) return
    
    try {
      const response = await fetch(`/api/conversations?matterId=${matterId.value}`)
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
      const response = await fetch(`/api/messages/${conversationId}`)
      const result = await response.json()
      
      if (response.ok && result.success) {
        const messages = result.messages.map(transformMessage)
        
        // Update conversation with loaded messages
        const conversation = conversations.value.find(c => c.id === conversationId)
        if (conversation) {
          conversation.messages = messages
        }
        
        return messages
      }
      return []
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
      const response = await fetch('/api/conversations/mark-read', {
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
    
    connectionStatus.value = 'connecting'
    
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
        connectionStatus.value = status === 'SUBSCRIBED' ? 'connected' : 'disconnected'
        isConnected.value = status === 'SUBSCRIBED'
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
    
    connectionStatus.value = 'disconnected'
    isConnected.value = false
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

  // Request notification permission
  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission()
      console.log('Notification permission:', permission)
      return permission === 'granted'
    }
    return Notification.permission === 'granted'
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
    isConnected,
    connectionStatus,
    totalUnreadCount,
    lastUpdate,
    
    // Methods
    loadConversations,
    loadMessagesForConversation,
    markConversationAsRead,
    requestNotificationPermission,
    initializeSubscriptions,
    unsubscribe
  }
} 