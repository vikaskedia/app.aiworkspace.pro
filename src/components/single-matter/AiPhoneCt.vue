<template>
  <div class="ai-phone-interface">

    <div class="phone-layout">
      <!-- Left Panel: Inbox/Navigation -->
      <div class="inbox-panel">
        <div class="panel-header">
          <h3>Phone Numbers</h3>
        </div>
        
        <div class="inbox-menu">
          <div 
            v-for="item in inboxItems"
            :key="item.id"
            :class="['inbox-item', { active: selectedInboxItem === item.id }, `inbox-item-${item.type}`]"
            @click="selectInboxItem(item.id)">
            <el-icon>
              <component :is="item.icon" />
            </el-icon>
            <div class="item-info">
              <span class="item-label">{{ item.label }}</span>
              <span v-if="item.number" class="phone-number">{{ item.number }}</span>
            </div>
            <span v-if="item.count !== undefined && item.count !== null" class="count-badge">{{ item.count }}</span>
          </div>
          
          <!-- Show message if no phone numbers are configured -->
          <div v-if="!currentMatter?.phone_numbers?.length" class="no-phone-numbers">
            <p>No phone numbers configured</p>
            <el-button size="small" @click="goToSettings">
              Add Phone Numbers
            </el-button>
          </div>
        </div>
      </div>

      <!-- Middle Panel: Chat Numbers/Conversations -->
      <div class="chats-panel">
        <div class="panel-header">
          <div class="panel-header-title">
            <h3>{{ conversationHeaderTitle }}</h3>
            <el-button 
              v-if="selectedInboxItem && selectedInboxItem.startsWith('phone_')"
              size="small" 
              circle 
              type="primary" 
              @click="composeMessage"
              class="new-message-btn">
              <el-icon><Plus /></el-icon>
            </el-button>
          </div>
          <el-input
            v-model="searchQuery"
            placeholder="Search conversations..."
            size="small"
            class="search-input">
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
        </div>

        <div class="conversations-list">
          <div 
            v-for="conversation in filteredConversations"
            :key="conversation.id"
            :class="['conversation-item', { active: selectedConversation === conversation.id }]"
            @click="selectConversation(conversation)">
            
            <div class="conversation-avatar">
              <div class="avatar-circle">
                <el-icon><User /></el-icon>
              </div>
              <!-- <div v-if="conversation.unread" class="unread-indicator"></div> -->
            </div>
            
            <div class="conversation-info">
              <div class="conversation-header">
                <span class="contact-name">{{ conversation.contact }}</span>
                <span class="time">{{ formatTime(conversation.lastMessageTime) }}</span>
              </div>
              <div class="conversation-preview">
                <span class="last-message">{{ conversation.lastMessage }}</span>
                <span v-if="conversation.unread" class="unread-count">{{ conversation.unread }}</span>
              </div>
              <!-- <div class="phone-number">{{ conversation.phoneNumber }}</div> -->
            </div>
          </div>
        </div>
      </div>

      <!-- Right Panel: Individual Chat -->
      <div class="chat-panel">
        <div v-if="!selectedConversation" class="no-chat-selected">
          <el-icon class="large-icon"><ChatDotRound /></el-icon>
          <h3>Select a conversation</h3>
          <p>Choose a conversation from the left to start messaging</p>
        </div>

        <div v-else class="active-chat">
          <!-- Chat Header -->
          <div class="chat-header">
            <div class="chat-contact-info">
              <div class="contact-avatar">
                <el-icon><User /></el-icon>
              </div>
              <div>
                <h4>{{ currentChat.contact }}</h4>
                <!-- <p>{{ currentChat.phoneNumber }}</p> -->
              </div>
            </div>
            
            <!-- <div class="chat-actions">
              <el-button size="small" circle>
                <el-icon><Phone /></el-icon>
              </el-button>
              <el-button size="small" circle>
                <el-icon><More /></el-icon>
              </el-button>
            </div> -->
          </div>

          <!-- Messages Area -->
          <div class="messages-area" ref="messagesContainer">
            <div 
              v-for="message in (currentChat?.messages || [])"
              :key="message.id"
              :class="['message', message.direction]">
              <div class="message-content">
                <p>{{ message.text }}</p>
                <span class="message-time">{{ formatTime(message.timestamp) }}</span>
              </div>
            </div>
            
            <!-- Show loading state when no messages -->
            <div v-if="!currentChat?.messages?.length" class="no-messages">
              <p>No messages yet</p>
            </div>
          </div>

          <!-- Message Input -->
          <div class="message-input-area">
            <div class="input-container">
              <el-input
                v-model="newMessage"
                type="textarea"
                :rows="2"
                placeholder="Type a message..."
                @keydown.enter.prevent="sendMessage"
                resize="none">
              </el-input>
              <div class="input-actions">
                <el-button 
                  type="primary" 
                  @click="sendMessage"
                  :disabled="!newMessage.trim()">
                  <el-icon><Promotion /></el-icon>
                  Send
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- New Message Dialog -->
    <el-dialog
      v-model="showNewMessageDialog"
      title="Compose New Message"
      width="400px"
      :before-close="closeNewMessageDialog">
      
      <el-form
        :model="newMessageForm"
        label-position="top"
        @submit.prevent="sendNewMessage">
        
        <el-form-item label="From">
          <el-input
            :value="getSelectedPhoneNumber()?.number || 'No phone selected'"
            readonly
            class="from-phone-input">
            <template #prefix>
              <span class="country-code-prefix">📞</span>
            </template>
          </el-input>
        </el-form-item>
        
        <el-form-item label="To" required>
          <div class="phone-input-container">
            <span class="country-code">+1</span>
            <el-input
              v-model="newMessageForm.to"
              placeholder="(555) 123-4567"
              @input="onPhoneNumberInput"
              @keydown="onPhoneKeyDown"
              maxlength="14"
              class="phone-input">
              <template #suffix>
                <el-icon v-if="isValidPhoneNumber()" style="color: #67C23A">
                  <Check />
                </el-icon>
              </template>
            </el-input>
          </div>
          <small class="help-text">Enter 10-digit US phone number</small>
        </el-form-item>
        
        <el-form-item label="Message" required>
          <el-input
            v-model="newMessageForm.message"
            type="textarea"
            :rows="4"
            placeholder="Type your message..."
            maxlength="1600"
            show-word-limit>
          </el-input>
        </el-form-item>
      </el-form>
      
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="closeNewMessageDialog">Cancel</el-button>
          <el-button 
            type="primary" 
            @click="sendNewMessage" 
            :loading="sendingMessage"
            :disabled="!isValidPhoneNumber() || !newMessageForm.message.trim()">
            Send Message
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { 
  Plus, 
  Search, 
  ChatDotRound, 
  Phone, 
  More, 
  Promotion,
  Message,
  UserFilled,
  Bell,
  Check,
  User
} from '@element-plus/icons-vue';
import { computed } from 'vue';
import { useMatterStore } from '../../store/matter';
import { storeToRefs } from 'pinia';
import { useRealtimeMessages } from '../../composables/useRealtimeMessages';

export default {
  name: 'AiPhoneCt',
  components: {
    Plus,
    Search,
    ChatDotRound,
    Phone,
    More,
    Promotion,
    Message,
    UserFilled,
    Bell,
    Check,
    User
  },
  setup() {
    const matterStore = useMatterStore();
    const { currentMatter } = storeToRefs(matterStore);
    
    // Real-time messaging setup
    const {
      conversations: realtimeConversations,
      loadMessagesForConversation,
      markConversationAsRead: realtimeMarkAsRead
    } = useRealtimeMessages(computed(() => currentMatter.value?.id));
    
    return { 
      currentMatter,
      realtimeConversations,
      loadMessagesForConversation,
      realtimeMarkAsRead
    };
  },
  data() {
    return {
      selectedInboxItem: null,
      selectedConversation: null,
      searchQuery: '',
      newMessage: '',
      
      // New Message Dialog
      showNewMessageDialog: false,
      newMessageForm: {
        to: '',
        message: ''
      },
      sendingMessage: false,
      
      conversations: [
        {
          id: 1,
          contact: 'Mario Leon',
          phoneNumber: '+1 (555) 123-4567',
          lastMessage: 'I just want to know if I\'m in child support or was it taken off already because the mother has been trying to...',
          lastMessageTime: new Date('2024-01-15T10:30:00'),
          unread: 2,
          messages: [
            {
              id: 1,
              text: 'Hi Mario, I understand your concern about the child support case.',
              direction: 'outbound',
              timestamp: new Date('2024-01-15T09:00:00')
            },
            {
              id: 2,
              text: 'I just want to know if I\'m in child support or was it taken off already because the mother has been trying to her case worker doesn\'t respond',
              direction: 'inbound',
              timestamp: new Date('2024-01-15T10:30:00')
            }
          ]
        },
        {
          id: 2,
          contact: 'Pat Labonte',
          phoneNumber: '+1 (555) 123-4567',
          lastMessage: 'Thank you for the update on my case.',
          lastMessageTime: new Date('2024-01-15T08:45:00'),
          unread: 0,
          messages: [
            {
              id: 1,
              text: 'Your case has been updated. Please review the documents.',
              direction: 'outbound',
              timestamp: new Date('2024-01-15T08:00:00')
            },
            {
              id: 2,
              text: 'Thank you for the update on my case.',
              direction: 'inbound',
              timestamp: new Date('2024-01-15T08:45:00')
            }
          ]
        },
        {
          id: 3,
          contact: 'Jack Olvera',
          phoneNumber: '+1 (555) 987-6543',
          lastMessage: 'When is our next court date?',
          lastMessageTime: new Date('2024-01-14T16:20:00'),
          unread: 1,
          messages: [
            {
              id: 1,
              text: 'When is our next court date?',
              direction: 'inbound',
              timestamp: new Date('2024-01-14T16:20:00')
            }
          ]
        },
        {
          id: 4,
          contact: 'Sarah Wilson',
          phoneNumber: '+1 (555) 987-6543',
          lastMessage: 'I received the court documents. Thank you.',
          lastMessageTime: new Date('2024-01-13T14:15:00'),
          unread: 0,
          messages: [
            {
              id: 1,
              text: 'I received the court documents. Thank you.',
              direction: 'inbound',
              timestamp: new Date('2024-01-13T14:15:00')
            },
            {
              id: 2,
              text: 'You\'re welcome! Please review them carefully.',
              direction: 'outbound',
              timestamp: new Date('2024-01-13T14:20:00')
            }
          ]
        },
        {
          id: 5,
          contact: 'David Martinez',
          phoneNumber: '+1 (555) 111-2222',
          lastMessage: 'Can we schedule a consultation?',
          lastMessageTime: new Date('2024-01-12T11:30:00'),
          unread: 3,
          messages: [
            {
              id: 1,
              text: 'Can we schedule a consultation?',
              direction: 'inbound',
              timestamp: new Date('2024-01-12T11:30:00')
            }
          ]
        }
      ]
    };
  },
  computed: {
    inboxItems() {
      const phoneNumbers = this.currentMatter?.phone_numbers || [];
      const phoneItems = phoneNumbers.map(phone => {
        // Calculate unread count for this phone number
        const unreadCount = this.realtimeConversations.filter(conv => 
          conv.fromPhoneNumber === phone.number && conv.unread > 0
        ).reduce((sum, conv) => sum + conv.unread, 0);
        
        return {
          id: `phone_${phone.id}`,
          label: phone.label,
          number: phone.number,
          icon: 'Phone',
          type: 'phone',
          count: unreadCount > 0 ? unreadCount : null
        };
      });

      return phoneItems;
    },

    filteredConversations() {
      // Use real-time conversations instead of static data
      let filtered = this.realtimeConversations || [];
      
      if (this.selectedInboxItem && this.selectedInboxItem.startsWith('phone_')) {
        // Filter conversations by selected phone number
        const selectedPhone = this.getSelectedPhoneNumber();
        if (selectedPhone) {
          filtered = filtered.filter(conv => 
            conv.fromPhoneNumber === selectedPhone.number
          );
        }
      }
      
      if (this.searchQuery) {
        filtered = filtered.filter(conv => 
          conv.contact.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
          conv.phoneNumber.includes(this.searchQuery) ||
          conv.lastMessage.toLowerCase().includes(this.searchQuery.toLowerCase())
        );
      }
      
      return filtered;
    },
    
    currentChat() {
      return this.realtimeConversations.find(conv => conv.id === this.selectedConversation);
    },
    
    conversationHeaderTitle() {
      if (this.selectedInboxItem && this.selectedInboxItem.startsWith('phone_')) {
        const selectedPhone = this.getSelectedPhoneNumber();
        return selectedPhone ? `Conversations for ${selectedPhone.number}` : 'Conversations';
      }
      return 'Conversations';   
    }
  },
  async mounted() {
    // Auto-select first phone number if available
    if (this.currentMatter?.phone_numbers?.length > 0) {
      this.selectedInboxItem = `phone_${this.currentMatter.phone_numbers[0].id}`;
    }
  },
  methods: {
    selectInboxItem(itemId) {
      this.selectedInboxItem = itemId;
      // Clear selected conversation when switching inbox items
      this.selectedConversation = null;
    },

    getSelectedPhoneNumber() {
      if (this.selectedInboxItem && this.selectedInboxItem.startsWith('phone_')) {
        const phoneId = parseInt(this.selectedInboxItem.replace('phone_', ''));
        return this.currentMatter?.phone_numbers?.find(p => p.id === phoneId);
      }
      return null;
    },
    
    async selectConversation(conversation) {
      this.selectedConversation = conversation.id;
      
      // Load messages for this conversation using real-time composable
      const messages = await this.loadMessagesForConversation(conversation.id);
      
      // Mark conversation as read using real-time composable
      await this.realtimeMarkAsRead(conversation.id);
      
      // Auto-scroll to bottom after loading messages
      this.$nextTick(() => {
        const container = this.$refs.messagesContainer;
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      });
    },
    
    getInitials(name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase();
    },
    
    formatTime(date) {
      // Handle null, undefined, or invalid dates
      if (!date) {
        return 'Just now';
      }
      
      // Convert to Date object if it's a string
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      
      // Check if the date is valid
      if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
        return 'Just now';
      }
      
      const now = new Date();
      const diffTime = Math.abs(now - dateObj);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) {
        return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (diffDays === 1) {
        return 'Yesterday';
      } else if (diffDays < 7) {
        return dateObj.toLocaleDateString([], { weekday: 'short' });
      } else {
        return dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
      }
    },
    
    async sendMessage() {
      if (!this.newMessage.trim() || !this.currentChat) return;
      
      const messageText = this.newMessage;
      this.newMessage = ''; // Clear input immediately for better UX
      
      try {
        // Get the selected phone number for this conversation
        const fromPhone = this.currentChat.fromPhoneNumber;
        const toPhone = this.currentChat.phoneNumber;
        
        if (!fromPhone || !toPhone) {
          throw new Error('Missing phone number information');
        }
        
        // Add message to UI immediately (optimistic update)
        const tempMsg = {
          id: `temp-${Date.now()}`,
          text: messageText,
          direction: 'outbound',
          timestamp: new Date(),
          status: 'sending'
        };
        
        this.currentChat.messages.push(tempMsg);
        this.currentChat.lastMessage = messageText;
        this.currentChat.lastMessageTime = new Date();
        
        // Scroll to bottom
        this.$nextTick(() => {
          const container = this.$refs.messagesContainer;
          if (container) {
            container.scrollTop = container.scrollHeight;
          }
        });
        
        // Send via API
        const response = await fetch('/api/sms/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromPhone,
            to: toPhone,
            message: messageText,
            matter_id: this.currentMatter.id
          })
        });

        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || 'Failed to send message');
        }
        
        // Update the temporary message with real data
        const msgIndex = this.currentChat.messages.findIndex(m => m.id === tempMsg.id);
        if (msgIndex !== -1) {
          this.currentChat.messages[msgIndex] = {
            id: result.message_id,
            text: messageText,
            direction: 'outbound',
            timestamp: new Date(),
            status: 'sent',
            telnyxId: result.telnyx_message_id
          };
        }
        
        //console.log('Message sent successfully from conversation:', result);
        
        // Mark conversation as read when sending a message
        await this.realtimeMarkAsRead(this.currentChat.id);
        
      } catch (error) {
        console.error('Error sending message:', error);
        this.$message.error(error.message || 'Failed to send message');
        
        // Remove the failed message from UI
        const msgIndex = this.currentChat.messages.findIndex(m => m.id?.startsWith('temp-'));
        if (msgIndex !== -1) {
          this.currentChat.messages.splice(msgIndex, 1);
        }
        
        // Restore the message text
        this.newMessage = messageText;
      }
    },
    
    composeMessage() {
      // Open new message dialog
      this.showNewMessageDialog = true;
      this.resetNewMessageForm();
    },
    
    resetNewMessageForm() {
      this.newMessageForm = {
        to: '',
        message: ''
      };
      this.sendingMessage = false;
    },
    
    closeNewMessageDialog() {
      this.showNewMessageDialog = false;
      this.resetNewMessageForm();
    },
    
    onPhoneKeyDown(event) {
      // Allow backspace to work normally on formatting characters
      if (event.key === 'Backspace') {
        const input = event.target;
        const cursorPos = input.selectionStart;
        const value = input.value;
        
        // If cursor is at a formatting character, move it past it
        if (cursorPos > 0) {
          const charAtCursor = value[cursorPos - 1];
          if (charAtCursor === '(' || charAtCursor === ')' || charAtCursor === ' ' || charAtCursor === '-') {
            // Prevent default and manually handle
            event.preventDefault();
            // Remove the digit before the formatting character
            const beforeFormat = value.substring(0, cursorPos - 2);
            const afterCursor = value.substring(cursorPos);
            const newValue = beforeFormat + afterCursor;
            this.newMessageForm.to = this.formatPhoneNumber(newValue);
            return;
          }
        }
      }
    },
    
    formatPhoneNumber(value) {
      // Extract only digits
      const digits = value.replace(/\D/g, '');
      const limited = digits.substring(0, 10);
      
      if (limited.length === 0) return '';
      if (limited.length <= 3) return `(${limited}`;
      if (limited.length <= 6) return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
      return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
    },
    
    onPhoneNumberInput(value) {
      this.newMessageForm.to = this.formatPhoneNumber(value);
    },
    
    getCleanPhoneNumber() {
      // Return just the digits for API calls
      return this.newMessageForm.to.replace(/\D/g, '');
    },
    
    isValidPhoneNumber() {
      const cleaned = this.getCleanPhoneNumber();
      return cleaned.length === 10;
    },
    
    async sendNewMessage() {
      if (!this.isValidPhoneNumber() || !this.newMessageForm.message.trim()) {
        return;
      }
      
      this.sendingMessage = true;
      
      try {
        const selectedPhone = this.getSelectedPhoneNumber();
        if (!selectedPhone) {
          throw new Error('No phone number selected');
        }

        // Convert form phone number to +1XXXXXXXXXX format
        const cleanTo = this.getCleanPhoneNumber();
        const fullToNumber = `+1${cleanTo}`;
        
        const response = await fetch('/api/sms/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: selectedPhone.number,
            to: fullToNumber,
            message: this.newMessageForm.message,
            matter_id: this.currentMatter.id
          })
        });

        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || 'Failed to send message');
        }

        this.closeNewMessageDialog();
        this.$message.success('Message sent successfully!');
        
        // The real-time system will automatically update conversations
        // If we have a conversation ID, auto-select it after a brief delay
        if (result.conversation_id) {
          setTimeout(() => {
            const conversation = this.realtimeConversations.find(c => c.id === result.conversation_id);
            if (conversation) {
              this.selectConversation(conversation);
            }
          }, 1000);
        }
        
      } catch (error) {
        console.error('Error sending message:', error);
        this.$message.error(error.message || 'Failed to send message');
      } finally {
        this.sendingMessage = false;
      }
    },
    


    goToSettings() {
      // Navigate to matter settings page
      this.$router.push(`/single-matter/${this.currentMatter.id}/settings`);
    }
  }
};
</script>

<style scoped>
.ai-phone-interface {
  height: 80vh;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
}

.header {
  background: white;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header h2 {
  margin: 0;
  color: #333;
}

.phone-layout {
  flex: 1;
  height: calc(100vh - 80px);
  display: flex;
}

/* Left Panel - Inbox (20% width) */
.inbox-panel {
  width: 20%;
  height: 100%;
  background: white;
  border-right: 1px solid #e0e0e0;
}

/* Middle Panel - Conversations (35% width) */
.chats-panel {
  width: 35%;
  height: 100%;
  background: white;
  border-right: 1px solid #e0e0e0;
}

/* Right Panel - Chat (45% width) */
.chat-panel {
  width: 45%;
  height: 100%;
  background: white;
  display: flex;
  flex-direction: column;
}

.panel-header {
  padding: 1rem;
  border-bottom: 1px solid #e0e0e0;
  background: #fafafa;
}

.panel-header h3 {
  margin: 0;
  color: #333;
  font-size: 1.1rem;
}

.panel-header-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.new-message-btn {
  flex-shrink: 0;
  margin-left: 0.5rem;
}

.inbox-menu {
  padding: 0.5rem 0;
}

.inbox-item {
  display: flex;
  align-items: center;
  padding: 0.75rem 1rem;
  cursor: pointer;
  transition: background-color 0.2s;
  gap: 0.75rem;
}

.inbox-item:hover {
  background: #f5f5f5;
}

.inbox-item.active {
  background: #e3f2fd;
  border-right: 3px solid #1976d2;
}

.inbox-item-phone {
  border-left: 3px solid #4caf50;
}

.item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.item-label {
  font-weight: 500;
  color: #333;
}

.phone-number {
  font-size: 0.8rem;
  color: #666;
  font-family: monospace;
}

.count-badge {
  margin-left: auto;
  background: #1976d2;
  color: white;
  border-radius: 12px;
  padding: 2px 8px;
  font-size: 0.75rem;
  min-width: 20px;
  text-align: center;
}

.no-phone-numbers {
  padding: 1rem;
  text-align: center;
  color: #666;
  border-top: 1px solid #f0f0f0;
  margin-top: 0.5rem;
}

.no-phone-numbers p {
  margin: 0 0 0.75rem 0;
  font-size: 0.9rem;
}

.search-input {
  margin-top: 0.5rem;
}

.conversations-list {
  height: calc(100% - 120px);
  overflow-y: auto;
}

.conversation-item {
  display: flex;
  padding: 1rem;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  transition: background-color 0.2s;
  gap: 0.75rem;
}

.conversation-item:hover {
  background: #f9f9f9;
}

.conversation-item.active {
  background: #e3f2fd;
}

.conversation-avatar {
  position: relative;
  flex-shrink: 0;
}

.avatar-circle {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #1976d2;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 1.1rem;
}

.avatar-circle .el-icon {
  font-size: 24px;
}

.unread-indicator {
  position: absolute;
  top: 0;
  right: 0;
  width: 12px;
  height: 12px;
  background: #4caf50;
  border-radius: 50%;
  border: 2px solid white;
}

.conversation-info {
  flex: 1;
  min-width: 0;
}

.conversation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.25rem;
}

.contact-name {
  font-weight: 600;
  color: #333;
}

.time {
  font-size: 0.75rem;
  color: #666;
}

.conversation-preview {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.25rem;
}

.last-message {
  color: #666;
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.unread-count {
  background: #1976d2;
  color: white;
  border-radius: 12px;
  padding: 2px 6px;
  font-size: 0.75rem;
  min-width: 18px;
  text-align: center;
  margin-left: 0.5rem;
}

.phone-number {
  font-size: 0.8rem;
  color: #999;
}

.no-chat-selected {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #666;
  gap: 1rem;
}

.large-icon {
  font-size: 4rem;
  color: #ccc;
}

.active-chat {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.chat-header {
  padding: 1rem;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fafafa;
}

.chat-contact-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.contact-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #1976d2;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
}

.contact-avatar .el-icon {
  font-size: 20px;
}

.chat-contact-info h4 {
  margin: 0;
  color: #333;
}

.chat-contact-info p {
  margin: 0;
  color: #666;
  font-size: 0.9rem;
}

.chat-actions {
  display: flex;
  gap: 0.5rem;
}

.messages-area {
  flex: 1;
  padding: 1rem;
  overflow-y: auto;
  background: #f9f9f9;
  max-height: calc(80vh - 200px);
  min-height: 300px;
}

/* Custom scrollbar styling */
.messages-area::-webkit-scrollbar {
  width: 8px;
}

.messages-area::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.messages-area::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 4px;
}

.messages-area::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

.no-messages {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #999;
  font-style: italic;
}

.message {
  margin-bottom: 1rem;
  display: flex;
}

.message.outbound {
  justify-content: flex-end;
}

.message.inbound {
  justify-content: flex-start;
}

.message-content {
  max-width: 70%;
  padding: 0.75rem 1rem;
  border-radius: 1rem;
  position: relative;
}

.message.outbound .message-content {
  background: #1976d2;
  color: white;
  border-bottom-right-radius: 0.25rem;
}

.message.inbound .message-content {
  background: white;
  color: #333;
  border: 1px solid #e0e0e0;
  border-bottom-left-radius: 0.25rem;
}

.message-content p {
  margin: 0 0 0.25rem 0;
  line-height: 1.4;
}

.message-time {
  font-size: 0.75rem;
  opacity: 0.7;
}

.message-input-area {
  padding: 1rem;
  border-top: 1px solid #e0e0e0;
  background: white;
}

.input-container {
  display: flex;
  gap: 0.75rem;
  align-items: flex-end;
}

.input-container .el-textarea {
  flex: 1;
}

.input-actions {
  display: flex;
  gap: 0.5rem;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .phone-layout {
    height: calc(100vh - 60px);
  }
  
  .header {
    padding: 0.75rem 1rem;
  }
  
  .conversation-item {
    padding: 0.75rem;
  }
  
  .message-content {
    max-width: 85%;
  }
  
  /* Stack panels vertically on mobile */
  .phone-layout {
    flex-direction: column;
  }
  
  .inbox-panel,
  .chats-panel,
  .chat-panel {
    width: 100%;
    height: 33.33%;
  }
}

/* New Message Dialog Styles */
.phone-input-container {
  display: flex;
  align-items: center;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
}

.country-code {
  background: #f5f7fa;
  padding: 0 12px;
  line-height: 40px;
  color: #606266;
  font-weight: 500;
  border-right: 1px solid #dcdfe6;
}

.phone-input {
  flex: 1;
}

.phone-input :deep(.el-input__wrapper) {
  border: none;
  box-shadow: none;
}

.phone-input :deep(.el-input__wrapper:hover),
.phone-input :deep(.el-input__wrapper.is-focus) {
  box-shadow: none;
}

.help-text {
  color: #909399;
  font-size: 12px;
  margin-top: 4px;
  display: block;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

/* Dialog responsive */
@media (max-width: 768px) {
  :deep(.el-dialog) {
    width: 90% !important;
    margin: 5vh auto;
  }
}

.from-phone-input :deep(.el-input__wrapper) {
  background-color: #f5f7fa;
  cursor: not-allowed;
}

.from-phone-input :deep(.el-input__inner) {
  background-color: #f5f7fa;
  cursor: not-allowed;
  color: #606266;
}

.country-code-prefix {
  margin-right: 8px;
}
</style>
