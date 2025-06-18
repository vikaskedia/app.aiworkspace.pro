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
                <span class="contact-name">
                  {{ getContactName(conversation.fromPhoneNumber) || conversation.contact || 'Unknown Contact' }}
                </span>
                <span class="time">{{ formatTime(conversation.lastMessageTime) }}</span>
              </div>
              
              <!-- Contact Tags -->
              <div class="contact-tags" v-if="getContactTags(conversation.fromPhoneNumber).length">
                <el-tag 
                  v-for="tag in getContactTags(conversation.fromPhoneNumber)" 
                  :key="tag" 
                  size="small" 
                  type="info"
                  class="tag"
                >
                  {{ tag }}
                </el-tag>
              </div>
              
              <div class="conversation-preview">
                <span class="last-message">{{ conversation.lastMessage }}</span>
                <span v-if="conversation.unread" class="unread-count">{{ conversation.unread }}</span>
              </div>
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
                <h4>{{ getContactName(currentChat.fromPhoneNumber) || currentChat.contact || 'Unknown Contact' }}</h4>
                
                <!-- Contact Details -->
                <div class="contact-details" v-if="getCurrentContact()">
                  <span class="contact-phone">{{ getCurrentContact().phone_number }}</span>
                  <div class="contact-tags">
                    <el-tag 
                      v-for="tag in getCurrentContact().tags" 
                      :key="tag" 
                      size="small"
                      type="info"
                    >
                      {{ tag }}
                    </el-tag>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Quick Actions -->
            <!-- <div class="chat-actions" v-if="getCurrentContact()">
              <el-button size="small" @click="editContact(getCurrentContact())">
                Edit Contact
              </el-button>
              <el-button size="small" @click="viewContactHistory(getCurrentContact())">
                View History
              </el-button>
            </div> -->
          </div>

          <!-- Search Bar for Chat Messages -->
          <div class="chat-search-bar" style="padding: 0.5rem 1rem; border-bottom: 1px solid #e0e0e0; background: #fafafa;">
            <el-input
              v-model="chatSearchQuery"
              placeholder="Search messages..."
              size="small"
              clearable
              prefix-icon="Search"
              style="width: 100%;"
            />
          </div>

          <!-- Messages Area -->
          <div class="messages-area" ref="messagesContainer">
            <template v-for="group in groupedChatMessages" :key="group.date">
              <div class="date-header">{{ group.date }}</div>
              <div v-for="message in group.messages" :key="message.id" :class="['message', message.direction]">
                <div class="message-content">
                  <!-- Settings Icon -->
                  <!-- <el-icon class="message-settings-icon" @click="openMessageDetailsDialog(message)"><More /></el-icon> -->
                  <el-icon class="message-settings-icon" @click="openMessageDetailsDialog(message)"><Setting /></el-icon>
                  <!-- Media attachments -->
                  <div v-if="message.mediaFiles && message.mediaFiles.length > 0" class="message-media">
                    <div 
                      v-for="media in message.mediaFiles" 
                      :key="media.id"
                      class="media-item">
                      
                      <!-- Debug: Log media object -->
                      <!-- {{ console.log('🖼️ Media object:', media) }} -->
                      
                      <!-- Image -->
                      <img 
                        v-if="media.mimetype && media.mimetype.startsWith('image/')"
                        :src="media.public_url"
                        :alt="media.filename"
                        class="media-image"
                        @click="openMediaViewer(media)"
                        loading="lazy" />
                      
                      <!-- Video -->
                      <video 
                        v-else-if="media.mimetype && media.mimetype.startsWith('video/')"
                        :src="media.public_url"
                        controls
                        class="media-video"
                        preload="metadata">
                        Your browser does not support video playback.
                      </video>
                      
                      <!-- Other file types -->
                      <div v-else class="media-file">
                        <el-icon class="file-icon"><Document /></el-icon>
                        <div class="file-info">
                          <span class="file-name">{{ media.filename }}</span>
                          <span class="file-size">{{ formatFileSize(media.size) }}</span>
                        </div>
                        <el-button 
                          size="small" 
                          type="primary" 
                          @click="downloadFile(media)">
                          Download
                        </el-button>
                      </div>
                    </div>
                  </div>
                  
                  <!-- Message text -->
                  <p v-if="message.text" class="message-text" v-html="highlightSearch(message.text)"></p>
                  
                  <!-- Message timestamp -->
                  <span class="message-time">{{ formatFullTimeWithZone(message.timestamp) }}</span>
                </div>
              </div>
            </template>
            
            <!-- Show loading state when no messages -->
            <div v-if="!filteredChatMessages.length" class="no-messages">
              <p>No messages found</p>
            </div>
          </div>

          <!-- Message Input -->
          <div class="message-input-area">
            <!-- File Preview Area -->
            <div v-if="selectedFiles.length > 0" class="file-preview-area">
              <div class="file-preview-header">
                <span>{{ selectedFiles.length }} file(s) selected</span>
                <el-button size="small" @click="clearSelectedFiles" type="danger" plain>
                  Clear All
                </el-button>
              </div>
              <div class="file-preview-list">
                <div 
                  v-for="(file, index) in selectedFiles" 
                  :key="index"
                  class="simple-file-item">
                  
                  <el-icon class="file-icon"><Document /></el-icon>
                  
                  <div class="file-info">
                    <span class="file-name">{{ file.name }}</span>
                    <span class="file-size">{{ formatFileSize(file.size) }}</span>
                  </div>
                  
                  <el-button 
                    size="small" 
                    @click="removeFile(index)"
                    type="danger" 
                    circle>
                    <el-icon><Close /></el-icon>
                  </el-button>
                </div>
              </div>
            </div>

            <div class="input-container">
              <div class="input-row">
                <el-input
                  v-model="newMessage"
                  type="textarea"
                  :rows="2"
                  placeholder="Type a message..."
                  @keydown.enter.prevent="sendMessage"
                  resize="none">
                </el-input>
                <div class="input-actions">
                  <!-- File Upload Button -->
                  <el-upload
                    ref="fileUpload"
                    :show-file-list="false"
                    :before-upload="handleFileSelect"
                    :multiple="false"
                    :accept="acceptedFileTypes"
                    action="#">
                    <el-button circle>
                      <el-icon><Paperclip /></el-icon>
                    </el-button>
                  </el-upload>
                  
                  <!-- Send Button -->
                  <el-button 
                    type="primary" 
                    @click="sendMessage"
                    :disabled="!canSendMessage"
                    :loading="sendingMessage">
                    <el-icon><Promotion /></el-icon>
                    Send
                  </el-button>
                </div>
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
          <div class="recipient-selection">
            <el-select
              v-model="selectedRecipient"
              placeholder="Select contact or enter phone number"
              filterable
              allow-create
              @change="onRecipientSelect"
              style="width: 100%"
            >
              <!-- Contact Options -->
              <el-option-group label="📋 Contacts">
                <el-option
                  v-for="contact in workspaceContacts"
                  :key="contact.id"
                  :label="`${contact.name} (${contact.phone_number})`"
                  :value="contact.phone_number"
                >
                  <div class="contact-option">
                    <div class="contact-info">
                      <span class="contact-name">{{ contact.name }}</span>
                      <span class="contact-phone">{{ contact.phone_number }}</span>
                    </div>
                    <div class="contact-tags" v-if="contact.tags && contact.tags.length">
                      <el-tag 
                        v-for="tag in contact.tags" 
                        :key="tag" 
                        size="small" 
                        type="info"
                      >
                        {{ tag }}
                      </el-tag>
                    </div>
                  </div>
                </el-option>
              </el-option-group>
              
              <!-- Recent Conversations -->
              <el-option-group label="💬 Recent Conversations">
                <el-option
                  v-for="conv in recentConversations"
                  :key="conv.id"
                  :label="`${conv.contact} (${conv.fromPhoneNumber})`"
                  :value="conv.fromPhoneNumber"
                >
                  <div class="conversation-option">
                    <span class="contact-name">{{ conv.contact }}</span>
                    <span class="contact-phone">{{ conv.fromPhoneNumber }}</span>
                  </div>
                </el-option>
              </el-option-group>
            </el-select>
          </div>
          <small class="help-text">Select a contact or enter a phone number manually</small>
        </el-form-item>
        
        <el-form-item label="Message">
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
            :disabled="!isValidPhoneNumber() || (!newMessageForm.message.trim() && newMessageForm.files.length === 0)">
            Send Message
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- Message Details Dialog -->
    <el-dialog
      v-model="showMessageDetailsDialog"
      title="Message Details"
      width="500px"
      :before-close="closeMessageDetailsDialog">
      <div v-if="selectedMessageDetails">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="From">{{ selectedMessageDetails.fromPhoneNumber || currentChat?.fromPhoneNumber || '-' }}</el-descriptions-item>
          <el-descriptions-item label="To">{{ selectedMessageDetails.toPhoneNumber || currentChat?.phoneNumber || '-' }}</el-descriptions-item>
          <el-descriptions-item label="Date">{{ formatDate(selectedMessageDetails.timestamp) }}</el-descriptions-item>
          <el-descriptions-item label="Time">{{ formatFullTimeWithZone(selectedMessageDetails.timestamp) }}</el-descriptions-item>
          <el-descriptions-item label="Direction">{{ selectedMessageDetails.direction || '-' }}</el-descriptions-item>
          <el-descriptions-item label="Delivery Status">{{ selectedMessageDetails.status || '-' }}</el-descriptions-item>
          <el-descriptions-item label="Webhook Data">
            <pre style="white-space: pre-wrap; word-break: break-all;">{{ selectedMessageDetails.webhookData ? JSON.stringify(selectedMessageDetails.webhookData, null, 2) : '-' }}</pre>
          </el-descriptions-item>
        </el-descriptions>
      </div>
      <template #footer>
        <el-button @click="closeMessageDetailsDialog">Close</el-button>
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
  Setting,
  Promotion,
  Message,
  UserFilled,
  Bell,
  Check,
  User,
  Document,
  Paperclip,
  Close
} from '@element-plus/icons-vue';
import { computed } from 'vue';
import { useMatterStore } from '../../store/matter';
import { storeToRefs } from 'pinia';
import { useRealtimeMessages } from '../../composables/useRealtimeMessages';
import { supabase } from '../../supabase';

export default {
  name: 'AiPhoneCt',
  components: {
    Plus,
    Search,
    ChatDotRound,
    Phone,
    More,
    Setting,
    Promotion,
    Message,
    UserFilled,
    Bell,
    Check,
    User,
    Document,
    Paperclip,
    Close
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
      
      // File handling
      selectedFiles: [],
      uploadingFiles: false,
      
      // New Message Dialog
      showNewMessageDialog: false,
      newMessageForm: {
        to: '',
        message: '',
        files: []
      },
      sendingMessage: false,
      
      // Contact integration
      workspaceContacts: [],
      selectedRecipient: null,
      
      chatSearchQuery: '',
      
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
      ],
      showMessageDetailsDialog: false,
      selectedMessageDetails: null,
      messageDetails: null,
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

    recentConversations() {
      // Get recent conversations for the contact picker
      return this.realtimeConversations
        .slice(0, 10) // Limit to 10 most recent
        .map(conv => ({
          id: conv.id,
          contact: this.getContactName(conv.fromPhoneNumber) || conv.contact || 'Unknown',
          fromPhoneNumber: conv.fromPhoneNumber
        }));
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
    },

    canSendMessage() {
      return (this.newMessage.trim() || this.selectedFiles.length > 0) && !this.sendingMessage;
    },

    acceptedFileTypes() {
      return 'image/jpeg,image/png,image/gif,video/mp4,video/3gpp,text/plain,text/vcard,application/pdf';
    },

    filteredChatMessages() {
      if (!this.currentChat || !this.currentChat.messages) return [];
      if (!this.chatSearchQuery.trim()) return this.currentChat.messages;
      const query = this.chatSearchQuery.trim().toLowerCase();
      return this.currentChat.messages.filter(msg =>
        msg.text && msg.text.toLowerCase().includes(query)
      );
    },

    // Group filtered messages by date
    groupedChatMessages() {
      const groups = {};
      this.filteredChatMessages.forEach(msg => {
        const dateObj = new Date(msg.timestamp);
        const dateStr = dateObj.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
        if (!groups[dateStr]) groups[dateStr] = [];
        groups[dateStr].push(msg);
      });
      // Return as array of { date, messages }
      return Object.entries(groups).map(([date, messages]) => ({ date, messages }));
    },
  },
  async mounted() {
    // Auto-select first phone number if available
    if (this.currentMatter?.phone_numbers?.length > 0) {
      this.selectedInboxItem = `phone_${this.currentMatter.phone_numbers[0].id}`;
    }

    // Load workspace contacts when component mounts
    await this.loadWorkspaceContacts();
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
      await this.loadMessagesForConversation(conversation.id);
      
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
      if ((!this.newMessage.trim() && this.selectedFiles.length === 0) || !this.currentChat) return;

      const messageText = this.newMessage;
      const fileToSend = this.selectedFiles[0];

      // Clear input immediately for better UX
      this.newMessage = '';
      this.clearSelectedFiles();
      this.sendingMessage = true;

      try {
        // Get the selected phone number for this conversation
        const fromPhone = this.currentChat.fromPhoneNumber;
        const toPhone = this.currentChat.phoneNumber;

        if (!fromPhone || !toPhone) {
          throw new Error('Missing phone number information');
        }

        let uploadedFile = null;

        // Upload file if selected
        if (fileToSend) {
          const giteaToken = import.meta.env.VITE_GITEA_TOKEN;
          const giteaHost = import.meta.env.VITE_GITEA_HOST;

          // Reintroduce the unique naming logic
          const timestamp = Date.now();
          const fileExtension = fileToSend.name.split('.').pop();
          const baseName = fileToSend.name.replace(`.${fileExtension}`, '');
          const uniqueName = `${baseName}_${timestamp}.${fileExtension}`;

          // Use uniqueName for the upload path
          const uploadPath = `messages/${uniqueName}`;

          // Use fileToSend.raw if it exists, otherwise use fileToSend directly
          const fileData = fileToSend.raw || fileToSend;

          // Convert file to base64
          const base64Content = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64 = reader.result.split(',')[1];
              resolve(base64);
            };
            reader.readAsDataURL(fileData);
          });

          // Upload to Gitea with the correct path
          const response = await fetch(
            `${giteaHost}/api/v1/repos/associateattorney/${this.currentMatter.git_repo}/contents/${uploadPath}`,
            {
              method: 'POST',
              headers: {
                'Authorization': `token ${giteaToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
              },
              body: JSON.stringify({
                message: `Upload ${fileToSend.name}`,
                content: base64Content,
                branch: 'main'
              })
            }
          );

          if (!response.ok) {
            throw new Error('Failed to upload file to Gitea');
          }
          const giteaData = await response.json();

          uploadedFile = {
            id: giteaData.content.sha,
            name: fileToSend.name,
            type: this.getFileType(fileToSend.name),
            size: fileToSend.size,
            storage_path: giteaData.content.path,
            matter_id: this.currentMatter.id,
            git_repo: this.currentMatter.git_repo,
            created_at: new Date().toISOString(),
            tags: [],
            public_url: this.getAuthenticatedDownloadUrl(giteaData.content.download_url)
          };
        }

        // Add message to UI immediately (optimistic update)
        const tempMsg = {
          id: `temp-${Date.now()}`,
          text: messageText,
          direction: 'outbound',
          timestamp: new Date(),
          status: 'sending',
          mediaFiles: uploadedFile ? [uploadedFile] : []
        };

        this.currentChat.messages.push(tempMsg);
        this.currentChat.lastMessage = uploadedFile && !messageText ? 
          `📎 1 attachment` : messageText;
        this.currentChat.lastMessageTime = new Date();

        // Scroll to bottom
        this.$nextTick(() => {
          const container = this.$refs.messagesContainer;
          if (container) {
            container.scrollTop = container.scrollHeight;
          }
        });

        // Send via API
        const smsResponse = await fetch('/api/sms/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromPhone,
            to: toPhone,
            message: messageText,
            matter_id: this.currentMatter.id,
            media_files: uploadedFile ? [uploadedFile] : [],
            subject: null // Can be added later if needed
          })
        });

        const smsResult = await smsResponse.json();

        if (!smsResponse.ok) {
          throw new Error(smsResult.error || 'Failed to send message');
        }

        // Update the temporary message with real data
        const msgIndex = this.currentChat.messages.findIndex(m => m.id === tempMsg.id);
        if (msgIndex !== -1) {
          this.currentChat.messages[msgIndex] = {
            id: smsResult.message_id,
            text: messageText,
            direction: 'outbound',
            timestamp: new Date(),
            status: 'sent',
            telnyxId: smsResult.telnyx_message_id,
            mediaFiles: uploadedFile ? [uploadedFile] : []
          };
        }

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

        // Restore the message text and file
        this.newMessage = messageText;
        this.selectedFiles = fileToSend ? [fileToSend] : [];
      } finally {
        this.sendingMessage = false;
      }
    },
    
    // Helper function to get authenticated download URL
    getAuthenticatedDownloadUrl(downloadUrl) {
      if (!downloadUrl) return '';
      try {
        const url = new URL(downloadUrl);
        url.searchParams.set('token', import.meta.env.VITE_GITEA_TOKEN);
        return url.toString();
      } catch (error) {
        console.error('Error creating authenticated URL:', error);
        return downloadUrl;
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
        message: '',
        files: []
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
      if (!this.isValidPhoneNumber() || (!this.newMessageForm.message.trim() && this.newMessageForm.files.length === 0)) {
        return;
      }
      
      this.sendingMessage = true;
      
      try {
        const selectedPhone = this.getSelectedPhoneNumber();
        if (!selectedPhone) {
          throw new Error('No phone number selected');
        }

        // Auto-create contact if sending to a new number
        await this.autoCreateContact(this.newMessageForm.to);

        let uploadedFiles = null;

        // Upload files if any are selected
        if (this.newMessageForm.files.length > 0) {
          // Convert files to base64 (like FilesCt.vue does)
          const filePromises = this.newMessageForm.files.map(file => {
            return new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                const base64 = reader.result.split(',')[1];
                resolve({
                  name: file.name,
                  content: base64,
                  size: file.size
                });
              };
              reader.readAsDataURL(file);
            });
          });

          const base64Files = await Promise.all(filePromises);

          const uploadResponse = await fetch('/api/upload-media-gitea-direct', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              files: base64Files,
              matter_id: this.currentMatter.id,
              git_repo: this.currentMatter.git_repo
            })
          });

          const uploadResult = await uploadResponse.json();
          
          console.log('📤 New message upload response:', uploadResult);
          
          if (!uploadResponse.ok) {
            throw new Error(uploadResult.error || 'Failed to upload files');
          }

          uploadedFiles = uploadResult.files;
          console.log('📁 New message uploaded files:', uploadedFiles);
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
            matter_id: this.currentMatter.id,
            media_files: uploadedFiles,
            subject: null
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
      this.$router.push(`/single-workspace/${this.currentMatter.id}/settings`);
    },

    // File handling methods
    handleFileSelect(file) {
      console.log('🔍 File selected:', {
        name: file.name,
        type: file.type,
        size: file.size
      });

      // Validate file type
      const supportedTypes = [
        'image/jpeg', 'image/png', 'image/gif',
        'video/mp4', 'video/3gpp',
        'text/plain', 'text/vcard',
        'application/pdf'
      ];

      if (!supportedTypes.includes(file.type)) {
        this.$message.error(`Unsupported file type: ${file.type}`);
        return false;
      }

      // File size restrictions
      if (file.type.startsWith('image/')) {
        if (file.size > 4 * 1024 * 1024) { // 4MB
          this.$message.error('Image file is too large. Maximum allowed size is 4MB.');
          return false;
        }
      } else if (file.type.startsWith('video/')) {
        if (file.size > 900 * 1024) { // 900KB
          this.$message.error('Video file is too large. Maximum allowed size is 900KB.');
          return false;
        }
      } else if (file.type === 'application/pdf') {
        if (file.size > 400 * 1024) { // 400KB
          this.$message.error('PDF file is too large. Maximum allowed size is 400KB.');
          return false;
        }
      }

      // Allow only one file at a time
      this.selectedFiles = [file];
      return false; // Prevent automatic upload
    },

    removeFile(index) {
      this.selectedFiles.splice(index, 1);
    },

    clearSelectedFiles() {
      this.selectedFiles = [];
    },

    formatFileSize(bytes) {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    openMediaViewer(media) {
      // Open media in a new tab or modal
      window.open(media.public_url, '_blank');
    },

    downloadFile(media) {
      // Open the file in a new tab for downloading
      window.open(media.public_url, '_blank');
    },

    removeNewMessageFile(index) {
      this.newMessageForm.files.splice(index, 1);
    },

    // Add the getFileType function to determine the file type based on the file extension
    getFileType(filename) {
      const ext = filename.split('.').pop()?.toLowerCase();
      const mimeTypes = {
        pdf: 'application/pdf',
        doc: 'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        txt: 'text/plain',
        png: 'image/png',  
        jpg: 'image/jpeg', 
        jpeg: 'image/jpeg',
        gif: 'image/gif',  
        md: 'text/markdown'
      };
      return mimeTypes[ext] || 'application/octet-stream';
    },

    highlightSearch(text) {
      if (!this.chatSearchQuery) return this.escapeHtml(text);
      const query = this.chatSearchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${query})`, 'gi');
      return this.escapeHtml(text).replace(regex, '<span class="highlight">$1</span>');
    },
    escapeHtml(text) {
      if (!text) return '';
      return text.replace(/[&<>"]/g, function(c) {
        return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];
      });
    },
    // Format full time with zone
    formatFullTimeWithZone(date) {
      if (!date) return '';
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) return '';
      // Get the time string (hour:minute AM/PM)
      const timeStr = dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      // Get the offset in minutes
      const offsetMin = -dateObj.getTimezoneOffset();
      // IST: +5:30 (330 minutes)
      if (offsetMin === 330) return `${timeStr} IST`;
      // PDT: -7:00 (-420 minutes), PST: -8:00 (-480 minutes)
      if (offsetMin === -420) return `${timeStr} PDT`;
      if (offsetMin === -480) return `${timeStr} PST`;
      // Fallback: show PST for US, IST for India
      // If offset is close to US Pacific, show PST/PDT
      if (offsetMin <= -420 && offsetMin >= -480) return `${timeStr} PST`;
      // Otherwise, default to IST
      return `${timeStr} IST`;
    },
    openMessageDetailsDialog(message) {
      this.selectedMessageDetails = message;
      this.showMessageDetailsDialog = true;
    },
    closeMessageDetailsDialog() {
      this.showMessageDetailsDialog = false;
      this.selectedMessageDetails = null;
    },
    formatDate(date) {
      if (!date) return '-';
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) return '-';
      return dateObj.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    },
    async loadWorkspaceContacts() {
      if (!this.currentMatter) return;
      
      try {
        const { data: contacts, error } = await supabase
          .from('contacts')
          .select('*')
          .eq('matter_id', this.currentMatter.id)
          .eq('archived', false)
          .order('name');

        if (error) throw error;
        this.workspaceContacts = contacts;
      } catch (error) {
        console.error('Error loading workspace contacts:', error);
      }
    },

    // Contact helper methods
    getContactName(phoneNumber) {
      const contact = this.workspaceContacts.find(c => c.phone_number === phoneNumber);
      return contact ? contact.name : null;
    },

    getContactTags(phoneNumber) {
      const contact = this.workspaceContacts.find(c => c.phone_number === phoneNumber);
      return contact ? contact.tags : [];
    },

    getCurrentContact() {
      if (!this.currentChat) return null;
      return this.workspaceContacts.find(c => c.phone_number === this.currentChat.fromPhoneNumber);
    },

    async autoCreateContact(phoneNumber) {
      // Check if contact already exists
      const existingContact = this.workspaceContacts.find(
        c => c.phone_number === phoneNumber
      );
      
      if (!existingContact) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          
          const contactData = {
            name: `Contact (${phoneNumber})`, // Temporary name
            phone_number: phoneNumber,
            tags: ['auto-created'],
            matter_id: this.currentMatter.id,
            created_by: user.id
          };
          
          const { error } = await supabase.from('contacts').insert([contactData]);
          if (!error) {
            await this.loadWorkspaceContacts(); // Refresh contacts
          }
        } catch (error) {
          console.error('Error auto-creating contact:', error);
        }
      }
    },

    onRecipientSelect(value) {
      this.newMessageForm.to = value;
    },

    editContact(contact) {
      // TODO: Implement contact editing - could open a dialog or navigate to contacts page
      console.log('Editing contact:', contact);
      // For now, just show a message
      this.$message.info('Contact editing will be implemented in Phase 2');
    },

    viewContactHistory(contact) {
      // TODO: Implement contact history view - could show all communications
      console.log('Viewing history for contact:', contact);
      // For now, just show a message
      this.$message.info('Contact history will be implemented in Phase 2');
    },
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

.message-content .message-text {
  margin: 0 0 0.25rem 0;
  line-height: 1.4;
}

.message-media {
  margin-bottom: 0.5rem;
}

.media-item {
  margin-bottom: 0.5rem;
}

.media-item:last-child {
  margin-bottom: 0;
}

.media-image {
  max-width: 200px;
  max-height: 200px;
  border-radius: 8px;
  cursor: pointer;
  transition: transform 0.2s;
}

.media-image:hover {
  transform: scale(1.05);
}

.media-video {
  max-width: 250px;
  max-height: 200px;
  border-radius: 8px;
}

.media-file {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  max-width: 250px;
}

.file-icon {
  font-size: 1.5rem;
  color: #666;
}

.file-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.file-name {
  font-weight: 500;
  font-size: 0.9rem;
}

.file-size {
  font-size: 0.75rem;
  opacity: 0.7;
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
  flex-direction: column;
  gap: 0.5rem;
}

.input-row {
  display: flex;
  gap: 0.75rem;
  align-items: flex-end;
}

.input-row .el-textarea {
  flex: 1;
}

.input-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

/* File Preview Styles */
.file-preview-area {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1rem;
  background: #f9f9f9;
  margin-bottom: 0.5rem;
}

.file-preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  font-size: 0.9rem;
  color: #666;
}

.file-preview-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.simple-file-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: white;
}

.file-icon {
  font-size: 1.5rem;
  color: #666;
  flex-shrink: 0;
}

.file-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.file-info .file-name {
  font-weight: 500;
  font-size: 0.9rem;
  color: #333;
}

.file-info .file-size {
  font-size: 0.8rem;
  color: #666;
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

/* Dialog File Preview Styles */
.dialog-file-preview {
  margin-top: 0.75rem;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 0.75rem;
  background: #f9f9f9;
}

.dialog-file-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid #eee;
}

.dialog-file-item:last-child {
  border-bottom: none;
}

.dialog-file-item .file-name {
  font-weight: 500;
  flex: 1;
}

.dialog-file-item .file-size {
  color: #666;
  font-size: 0.8rem;
}

.highlight {
  background: #ffe066;
  color: #333;
  padding: 0 2px;
  border-radius: 2px;
}

.date-header {
  text-align: center;
  margin: 1.5rem 0 0.5rem 0;
  font-weight: 600;
  color: #1976d2;
  background: #f0f4fa;
  border-radius: 8px;
  padding: 0.25rem 0.75rem;
  font-size: 1rem;
  letter-spacing: 0.02em;
}

.message-settings-icon {
  position: absolute;
  bottom: 8px;
  right: 8px;
  cursor: pointer;
  color: #888;
  font-size: 1.1rem;
  z-index: 2;
  transition: color 0.2s;
}
.message-settings-icon:hover {
  color: #1976d2;
}

/* Contact Integration Styles */
.contact-option {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  width: 100%;
}

.contact-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.contact-name {
  font-weight: 500;
  color: #2c3e50;
}

.contact-phone {
  font-size: 0.85rem;
  color: #666;
}

.contact-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.contact-tags .tag {
  font-size: 0.7rem;
  padding: 0.1rem 0.3rem;
}

.conversation-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.recipient-selection {
  width: 100%;
}

/* Enhanced Chat Header Styles */
.chat-contact-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
}

.contact-details {
  margin-top: 0.25rem;
}

.contact-details .contact-phone {
  font-size: 0.85rem;
  color: #666;
  margin-right: 0.5rem;
}

.chat-actions {
  display: flex;
  gap: 0.5rem;
}

/* Responsive adjustments for contact features */
@media (max-width: 768px) {
  .contact-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }
  
  .chat-actions {
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .contact-tags {
    margin-top: 0.25rem;
  }
}
</style>
