<template>
  <div class="ai-phone-interface">

    <div class="phone-layout" :class="{ 'with-contact-panel': showContactDetailsPane }">
      <!-- Left Panel: Inbox/Navigation -->
      <div class="inbox-panel">
        <div class="panel-header">
          <el-tooltip placement="bottom">
            <template #content>
              <div>
                <div style="font-weight: bold; margin-bottom: 4px;">Messages Sent by Team (All Numbers)</div>
                <div>This week: {{ messageCountsThisWeek }} sent</div>
                <div>This month: {{ messageCountsThisMonth }} sent</div>
                <div>This year: {{ messageCountsThisYear }} sent</div>
              </div>
            </template>
            <h3 style="cursor: pointer;">Phone Numbers</h3>
          </el-tooltip>
        </div>
        
        <div class="inbox-menu">
          <div 
            v-for="item in inboxItems"
            :key="item.id"
            :class="['inbox-item', { active: selectedInboxItem === item.id }]"
            >
            <div class="item-info">
              <el-icon><component :is="item.icon" /></el-icon>&nbsp;
                             <el-tooltip placement="right">
                 <template #content>
                   <div>
                     <div style="font-weight: bold; margin-bottom: 4px;">Messages Sent by Team ({{ item.number }})</div>
                     <div>This week: {{ getPhoneNumberMessageCounts(item.number).week }} sent</div>
                     <div>This month: {{ getPhoneNumberMessageCounts(item.number).month }} sent</div>
                     <div>This year: {{ getPhoneNumberMessageCounts(item.number).year }} sent</div>
                   </div>
                 </template>
                 <span class="item-label" style="cursor: pointer;" :class="{ 'untagged-filter-active': showUntaggedOnly && selectedInboxItem === item.id }" @click="selectInboxItem(item.id)" @click.stop="togglePhoneTagsExpand(item.id)">
                   {{ item.label }}
                   <el-tooltip v-if="showUntaggedOnly && selectedInboxItem === item.id && getUnreadCountsForUntagged(item.number) > 0" content="Unread untagged messages" placement="top">
                     <span class="unread-badge" style="margin-left: 6px; background: #909399; color: white; font-size: 0.7rem; padding: 1px 4px; border-radius: 8px; min-width: 12px; text-align: center;">
                       {{ getUnreadCountsForUntagged(item.number) }}
                     </span>
                   </el-tooltip>
                 </span>
               </el-tooltip><br>
              <span class="phone-number">{{ item.number }}</span>
              <div class="phone-tags-tree" style="margin-top: 4px;">
                <div 
                  v-if="expandedPhoneForTags === item.id"
                  class="tags-list"
                  style="margin-left: 16px; margin-top: 4px;"
                >
                  <div
                    v-for="tagGroup in hierarchicalTagsForPhone(item.number)"
                    :key="tagGroup.name"
                    class="tag-group"
                  >
                    <!-- Parent tag -->
                    <div
                      v-if="tagGroup.children.length === 0"
                      class="tag-item"
                      :class="{ active: selectedTagByPhone[item.id] === tagGroup.name }"
                      @click.stop="togglePhoneTagFilter(item.id, tagGroup.name)"
                      style="padding: 2px 6px; margin: 1px 0; cursor: pointer; border-radius: 4px; font-size: 0.95rem;border-bottom: 1px solid #3276d2; display: flex; align-items: center; justify-content: space-between;"
                    >
                      <div style="display: flex; align-items: center;">
                        <img src="/label_icon.png" style="margin-right: 4px; width: 12px; height: 12px;" />
                        {{ tagGroup.name }}
                        <el-tooltip v-if="getUnreadCountsForTag(item.number, tagGroup.name) > 0" content="Unread messages" placement="top">
                          <span class="unread-badge" style="margin-left: 6px; background: #f56c6c; color: white; font-size: 0.7rem; padding: 1px 4px; border-radius: 8px; min-width: 12px; text-align: center;">
                            {{ getUnreadCountsForTag(item.number, tagGroup.name) }}
                          </span>
                        </el-tooltip>
                      </div>
                      <el-icon 
                        v-if="selectedTagByPhone[item.id] === tagGroup.name"
                        @click.stop="togglePhoneTagFilter(item.id, null)"
                        style="margin-left: 4px; font-size: 0.8rem; color: #67c23a; cursor: pointer;"
                      >
                        <Close />
                      </el-icon>
                    </div>
                    
                    <!-- Parent with children -->
                    <div v-else class="parent-tag-container">
                      <div 
                        class="parent-tag-header" 
                        :class="{ active: selectedTagByPhone[item.id] === tagGroup.name }"
                        @click.stop="togglePhoneTagFilter(item.id, tagGroup.name)"
                        style="color: #333; margin: 2px 0; padding: 2px 0; cursor: pointer; border-radius: 4px; display: flex; align-items: center; justify-content: space-between;"
                      >
                        <div style="display: flex; align-items: center;">
                          <img src="/label_icon.png" style="margin-right: 4px; width: 12px; height: 12px;" /> 
                          {{ tagGroup.name }}
                          <el-tooltip v-if="getUnreadCountsForTag(item.number, tagGroup.name) > 0" content="Unread messages" placement="top">
                            <span class="unread-badge" style="margin-left: 6px; background: #f56c6c; color: white; font-size: 0.7rem; padding: 1px 4px; border-radius: 8px; min-width: 12px; text-align: center;">
                              {{ getUnreadCountsForTag(item.number, tagGroup.name) }}
                            </span>
                          </el-tooltip>
                        </div>
                        <el-icon 
                          v-if="selectedTagByPhone[item.id] === tagGroup.name"
                          @click.stop="togglePhoneTagFilter(item.id, null)"
                          style="margin-left: 4px; font-size: 0.8rem; color: #67c23a; cursor: pointer;"
                        >
                          <Close />
                        </el-icon>
                      </div>
                      <div class="child-tags" style="margin-left: 12px;">
                        <div
                          v-for="childTag in tagGroup.children"
                          :key="childTag.fullName"
                          class="tag-item child-tag"
                          :class="{ active: selectedTagByPhone[item.id] === childTag.fullName }"
                          @click.stop="togglePhoneTagFilter(item.id, childTag.fullName)"
                          style="padding: 2px 6px; margin: 1px 0; cursor: pointer; border-radius: 4px; font-size: 0.9rem; border-bottom: 1px solid #3276d2; display: flex; align-items: center; justify-content: space-between;"
                        >
                          <div style="display: flex; align-items: center;">
                            <span style="margin-right: 4px;">├─</span>
                            <img src="/label_icon.png" style="margin-right: 4px; width: 10px; height: 10px;" />
                            {{ childTag.name }}
                            <el-tooltip v-if="getUnreadCountsForTag(item.number, childTag.fullName) > 0" content="Unread messages" placement="top">
                              <span class="unread-badge" style="margin-left: 6px; background: #f56c6c; color: white; font-size: 0.65rem; padding: 1px 3px; border-radius: 6px; min-width: 10px; text-align: center;">
                                {{ getUnreadCountsForTag(item.number, childTag.fullName) }}
                              </span>
                            </el-tooltip>
                          </div>
                          <el-icon 
                            v-if="selectedTagByPhone[item.id] === childTag.fullName"
                            @click.stop="togglePhoneTagFilter(item.id, null)"
                            style="margin-left: 4px; font-size: 0.7rem; color: #67c23a; cursor: pointer;"
                          >
                            <Close />
                          </el-icon>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="item-right">
              <el-tooltip content="Messages unread by you" placement="top">
                <span v-if="item.count" class="count-badge">{{ item.count }}</span>
              </el-tooltip>
              <div 
                v-if="hierarchicalTagsForPhone(item.number).length > 0"
                class="tags-toggle"
                style="font-size: 0.8rem; color: #666; margin-top: 2px;"
                >
                <el-icon style="margin-right: 4px;">
                  <component :is="expandedPhoneForTags === item.id ? 'ArrowDown' : 'ArrowRight'" />
                </el-icon>
                <!-- Tags ({{ hierarchicalTagsForPhone(item.number).length }}) -->
              </div>
              <div v-else style="margin-top: 2px;" class="tags-toggle">
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
              </div>
            </div>
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
            <el-tooltip 
              v-if="conversationHeaderTitle.tooltip" 
              :content="conversationHeaderTitle.tooltip" 
              placement="top">
              <h3>{{ conversationHeaderTitle.title }}</h3>
            </el-tooltip>
            <h3 v-else>{{ conversationHeaderTitle.title }}</h3>
            <el-button 
              v-if="showNewMessageButton"
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
          <el-select
            v-model="selectedTags"
            multiple
            collapse-tags
            collapse-tags-tooltip
            placeholder="Filter by tags..."
            size="small"
            class="tag-filter-input"
            clearable>
            <el-option
              v-for="tag in availableTags"
              :key="tag"
              :label="tag"
              :value="tag">
              <div class="tag-option">
                <img src="/label_icon.png" style="margin-right: 4px; width: 12px; height: 12px;" />
                <span>{{ tag }}</span>
              </div>
            </el-option>
          </el-select>
        </div>

        <div class="conversations-list">
          <div 
            v-for="conversation in filteredConversations"
            :key="conversation.id"
            :class="['conversation-item', { active: selectedConversation === conversation.id }]"
            @click="selectConversation(conversation), openContactDetailsPane(conversation.phoneNumber, conversation.contact)">
            
            <div class="conversation-avatar">
              <div class="avatar-circle">
                <img 
                  v-if="getContactForConversation(conversation)?.profile_picture_url" 
                  :src="getContactForConversation(conversation).profile_picture_url" 
                  :alt="getContactForConversation(conversation)?.name"
                  class="avatar-image"
                />
                <span v-else-if="getContactName(conversation.phoneNumber, conversation.contact) || conversation.contact" class="avatar-text">
                  <span v-if="getInitials(getContactName(conversation.phoneNumber, conversation.contact) || conversation.contact || 'Unknown Contact') != '+'">
                    {{ getInitials(getContactName(conversation.phoneNumber, conversation.contact) || conversation.contact || 'Unknown Contact') }}
                  </span>
                  <el-icon v-else><User /></el-icon>
                </span>
              </div>
              <!-- <div v-if="conversation.unread" class="unread-indicator"></div> -->
            </div>
            
            <div class="conversation-info">
              <div class="conversation-header">
                <span class="contact-name">
                  {{ getContactName(conversation.phoneNumber, conversation.contact) || conversation.contact || 'Unknown Contact' }}
                </span>
                <div class="conversation-actions">
                  <span class="time">{{ formatTime(conversation.lastMessageTime) }}</span>
                  <el-popover
                    placement="bottom-end"
                    :width="300"
                    trigger="click"
                    @show="loadLastSeenUsers(conversation.id)"
                  >
                    <template #reference>
                      <el-icon class="conversation-menu-icon" @click.stop>
                        <More />
                      </el-icon>
                    </template>
                    <div class="last-seen-popover">
                      <div v-if="loadingLastSeen[conversation.id]" class="loading-last-seen">
                        <el-icon class="is-loading"><Loading /></el-icon>
                        Loading...
                      </div>
                      <div v-else-if="lastSeenUsers[conversation.id]?.length > 0" class="last-seen-list">
                        <div 
                          v-for="user in lastSeenUsers[conversation.id]" 
                          :key="user.user_id"
                          class="last-seen-item"
                        >
                          <span class="user-name">{{ user.display_name }}</span>
                          <span class="last-seen-time">
                            <el-icon><Check /></el-icon>{{ formatLastSeenTime(user.last_read_at) }}
                          </span>
                        </div>
                      </div>
                      <div v-else class="no-last-seen">
                        No one has seen this conversation yet
                      </div>
                    </div>
                  </el-popover>
                </div>
              </div>
              
              <div class="conversation-preview">
                <span class="last-message">{{ conversation.lastMessage }}</span>
                <el-tooltip content="Messages unread by you " placement="top">
                  <span v-if="conversation.unread" class="unread-count">{{ conversation.unread }}</span>
                </el-tooltip>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Panel - Chat (45% width) -->
      <div class="chat-panel">
        <div v-if="!selectedConversation" class="no-chat-selected">
          <el-icon class="large-icon"><ChatDotRound /></el-icon>
          <h3 class="no-chat-selected-title">Select a conversation</h3>
          <p class="no-chat-selected-title">Choose a conversation from the left to start messaging</p>
        </div>

        <div v-else class="active-chat">
          <!-- Chat Header -->
          <div class="chat-header">
            <div class="chat-contact-info">
              <div class="contact-avatar">
                <img 
                  v-if="getCurrentContact()?.profile_picture_url" 
                  :src="getCurrentContact().profile_picture_url" 
                  :alt="getCurrentContact()?.name"
                  class="avatar-image"
                />
                <span v-else-if="getInitials(getCurrentContact()?.name) != '+' && getCurrentContact()?.name">
                  {{ getInitials(getCurrentContact()?.name) }}
                </span>
                <el-icon v-else><User /></el-icon>
              </div>
              <div>
                <h4 style="display: flex; align-items: center;">
                  <span 
                    class="">
                    {{ getContactName(currentChat.phoneNumber, currentChat.contact) || currentChat.contact || 'Unknown Contact' }}
                  </span>
                  <!-- <template v-if="currentChat">
                    <el-tooltip v-if="!getCurrentContact()" content="Add to Contacts">
                      <el-icon @click="openContactModal('add')" style="margin-left: 8px;cursor: pointer;"><Plus /></el-icon>
                    </el-tooltip>
                    <el-tooltip v-else content="Edit Contact">
                      <el-icon @click="openContactModal('edit')" style="margin-left: 8px;cursor: pointer;"><EditPen /></el-icon>
                    </el-tooltip>
                  </template> -->
                </h4>
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
              <div v-for="item in group.items" :key="item.type === 'message' ? item.item.id : item.item.id" :class="['message', item.type === 'message' ? item.item.direction : (item.associatedMessageDirection || 'inbound')]">
                
                <!-- Message Display -->
                <div v-if="item.type === 'message'" class="message-content" @mouseenter="setHoveredMessage(item.item.id)" @mouseleave="setHoveredMessage(null)">
                  <!-- Settings Dropdown Menu -->
                  <el-dropdown @command="handleMessageMenuCommand($event, item.item)" style="float: right;bottom: 10px;left: 10px;">
                    <el-icon class="message-settings-icon" style="vertical-align: middle;"><More /></el-icon>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item command="upload-before">Upload phone call recording</el-dropdown-item>
                        <el-dropdown-item command="comment-internal">Comment in internal thread</el-dropdown-item>
                        <el-dropdown-item command="details">See message details</el-dropdown-item>
                        <el-dropdown-item v-if="phoneTextActions.length" disabled divided>Text Message Actions</el-dropdown-item>
                        <el-dropdown-item
                          v-for="action in phoneTextActions"
                          :key="'action-' + action.id"
                          :command="'action-' + action.id"
                          :loading="loadingPhoneTextActions"
                        >
                          {{ action.action_name }}
                        </el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                  
                  <!-- Internal Comments Indicator -->
                  <!-- <div v-if="getInternalCommentsCount(item.item.id) > 0" class="internal-comments-indicator" @click="toggleInlineInternalComments(item.item)">
                    <el-icon><ChatDotRound /></el-icon>
                    <span class="comments-count">{{ getInternalCommentsCount(item.item.id) }}</span>
                  </div> -->
                  <!-- Media attachments -->
                  <div v-if="item.item.mediaFiles && item.item.mediaFiles.length > 0" class="message-media">
                    <div 
                      v-for="media in item.item.mediaFiles" 
                      :key="media.id"
                      class="media-item">
                      
                      <!-- Debug: Log media object -->
                      <!-- {{ console.log('🖼️ Media object:', media) }} -->
                      
                      <!-- Image -->
                      <img 
                        v-if="(media.mimetype && media.mimetype.startsWith('image/')) || (media.type && media.type.startsWith('image/'))"
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
                  <p v-if="item.item.text" class="message-text" v-html="highlightSearch(item.item.text)"></p>
                  
                  <!-- Message timestamp -->
                  <span class="message-time">{{ formatFullTimeWithZone(item.item.timestamp) }}</span>
                  <el-tooltip
                    v-if="usersWhoHaveSeenMessage(item.item).length"
                    :content="usersWhoHaveSeenMessage(item.item).map(u => u.display_name).join(', ')"
                    placement="top"
                  >
                    <el-icon style="margin-left: 6px; color: #67c23a;"><Check /></el-icon>
                  </el-tooltip>

                  <!-- Inline Internal Comments Thread (moved inside message-content) -->
                  <div v-if="showingInternalCommentsFor.includes(item.item.id)" class="inline-internal-comments">
                    <!-- Internal Comments List -->
                    <div v-if="(internalCommentsMap[item.item.id] || []).length === 0" class="no-comments">
                      <el-icon class="no-comments-icon"><ChatDotRound /></el-icon>
                      <p>No internal comments yet. Start the conversation!</p>
                    </div>
                    <div
                      v-for="comment in internalCommentsMap[item.item.id] || []"
                      :key="comment.id"
                      class="internal-comment-item compact-comment"
                    >
                      <el-tooltip :content="formatFullTimeWithZone(comment.created_at)" placement="right">
                        <div class="comment-bubble">
                          <span class="comment-author">{{ comment.author_name }}</span>
                          <span class="comment-content">{{ comment.content }}</span>
                        </div>
                      </el-tooltip>
                    </div>
                    <!-- Add New Comment -->
                    <div class="comment-input-bar">
                      <el-input
                        v-model="newInternalComment[item.item.id]"
                        type="text"
                        placeholder="Reply internally…"
                        class="internal-reply-input"
                        @keyup.enter="addInternalComment(item.item.id)"
                        clearable
                      />
                    </div>
                    <div class="comment-actions">
                      <el-button @click="showingInternalCommentsFor = showingInternalCommentsFor.filter(id => id !== item.item.id)">Cancel</el-button>
                      <el-button 
                        type="primary" 
                        @click="addInternalComment(item.item.id)"
                        :disabled="!newInternalComment[item.item.id]?.trim()"
                        :loading="addingComment[item.item.id]"
                      >
                        Add Comment
                      </el-button>
                    </div>
                  </div>
                </div>
                <!-- Inline Internal Comments Thread -->
                <div v-else-if="item.type === 'recording'" class="call-recording-content">
                  <div class="call-recording-header">
                    <el-icon class="call-icon"><Phone /></el-icon>
                    <span class="call-title">
                      Call Recording
                    </span>
                  </div>
                  
                  <div class="call-recording-player">
                    <audio 
                      :src="item.item.public_url" 
                      controls 
                      class="audio-player"
                      preload="metadata">
                      Your browser does not support audio playback.
                    </audio>
                  </div>
                  
                  <div class="call-recording-info">
                    <span class="call-size">{{ formatFileSize(item.item.file_size) }}</span>&nbsp;&nbsp;
                    <span class="call-date">{{ formatDate(item.item.recorded_at) }}</span>
                  </div>
                  
                  <!-- Collapsible Summary Section -->
                  <el-collapse v-model="summaryCollapse[item.item.id]" class="call-summary-collapse">
                    <el-collapse-item name="summary">
                      <template #title>
                        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                          <span>Summary</span>
                        </div>
                      </template>
                      <div v-html="renderMarkdown(item.item.recording_summary)"></div>
                      <p class="transcript-link" style="float: right;margin-right: 10px;" @click.stop="openTranscriptDialog(item.item.recording_transcript)">Show transcript</p>
                    </el-collapse-item>
                  </el-collapse>
                </div>
              </div>
            </template>
            
            <!-- Show loading state when no messages -->
            <div v-if="!groupedChatMessages.length" class="no-messages">
              <p>No messages or recordings found</p>
            </div>
          </div>

          <!-- Message Input -->
          <div 
            class="message-input-area"
            @dragover.prevent="handleDragOver"
            @dragleave.prevent="handleDragLeave"
            @drop.prevent="handleFileDrop"
            @paste="handlePaste"
            :class="{ 'drag-over': isDragOver }"
            tabindex="0">
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
                  :autosize="{ minRows: 4, maxRows: 100 }"
                  placeholder="Type a message... (Paste images with Cmd/Ctrl+V)"
                  @keydown="handleMessageInputKeydown"
                  @paste="handlePaste"
                  class="new-message-input-textarea"
                >
                </el-input>
                <div class="input-actions">
                  <!-- File Upload Button -->
                   <el-tooltip content="Upload a file" placement="top">
                    <el-upload
                      ref="fileUpload"
                      :show-file-list="false"
                      :before-upload="handleFileSelect"
                      :multiple="false"
                      :accept="acceptedFileTypes"
                      action="#">
                        <el-icon class="cursor-pointer action-icon-btn" :size="25" color="#888"><Paperclip /></el-icon>
                    </el-upload>
                  </el-tooltip>
                  
                  <!-- AI Draft Message Button -->
                  <el-tooltip 
                    v-if="currentChat && currentChat.messages && currentChat.messages.length > 0"
                    content="AI-DM: Let AI suggest a reply based on conversation" 
                    placement="top">
                    <el-icon class="cursor-pointer action-icon-btn" :size="25" @click="draftMessageWithAI" :loading="draftingMessageWithAI" color="#67c23a"><ChatLineRound /></el-icon>
                  </el-tooltip>

                  <!-- AI Check Button -->
                  <el-tooltip 
                    v-if="newMessage.trim()"
                    content="Check message with AI for grammar and clarity" 
                    placement="top">
                    <el-icon class="cursor-pointer action-icon-btn" :size="25" @click="checkMessageWithAI" :loading="checkingMessageWithAI" color="#e6a23c"><MagicStick /></el-icon>
                  </el-tooltip>
                  
                  <!-- Send Button -->
                  <el-tooltip 
                    content="Send message (Enter) • New line (Shift+Enter)" 
                    placement="top">
                    <el-icon 
                      color="#409efc" 
                      :size="25"
                      class="cursor-pointer action-icon-btn"
                      @click="sendMessage"
                      :disabled="!canSendMessage"
                      :loading="sendingMessage">
                      <Promotion />
                    </el-icon>
                  </el-tooltip>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Fourth Panel: Contact Details (always visible) -->
      <div class="contact-details-panel">
        <div class="panel-header">
          <div class="panel-header-title">
            <h3>Contact Details</h3>
            <!-- <el-button 
              size="small" 
              circle 
              @click="closeContactDetailsPane"
              class="close-btn">
              <el-icon><Close /></el-icon>
            </el-button> -->
          </div>
        </div>
        
        <div class="contact-details-content">
          <div v-if="selectedContactDetails" class="contact-full-details redesigned-contact-details">
            <!-- Edit/Save/Cancel Buttons -->
            <!-- <div class="contact-details-actions" style="text-align: right; margin-bottom: 1rem;">
              <el-tooltip v-if="!editingContact" content="Edit Contact">
                <el-icon @click="startEditContact" style="margin-left: 8px;cursor: pointer;"><EditPen /></el-icon>
              </el-tooltip>
              <template v-else>
                <el-button size="small" type="primary" @click="saveEditContact">
                  <el-icon><Check /></el-icon>
                  &nbsp;Save
                </el-button>
                <el-button size="small" @click="cancelEditContact" style="margin-left: 8px;">
                  <el-icon><Close /></el-icon>
                  Cancel
                </el-button>
              </template>
            </div> -->
            <!-- Avatar with initials or profile picture -->
            <div class="contact-avatar-large redesigned-avatar">
              <template v-if="editingContact">
                <el-upload
                  class="avatar-uploader"
                  :show-file-list="false"
                  :before-upload="handleAvatarUpload"
                  accept="image/*">
                  <img v-if="editableContact.profile_picture_url" :src="editableContact.profile_picture_url" class="avatar-upload-image" />
                  <div
                    v-else
                    class="avatar-upload-placeholder"
                    style="width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; cursor: pointer; background: #f5f5f5; border-radius: 50%; border: 1.5px dashed #bdbdbd; transition: border-color 0.2s;"
                  >
                    <el-icon style="font-size: 2rem; color: #bdbdbd;"><Upload /></el-icon>
                  </div>
                </el-upload>
              </template>
              <template v-else>
                <img v-if="selectedContactDetails.profile_picture_url" :src="selectedContactDetails.profile_picture_url" class="avatar" />
                <div v-else class="avatar-initials">{{ getInitials(selectedContactDetails.name) }}</div>
              </template>
            </div>
            <!-- Contact Name -->
            <template v-if="editingField === 'name'">
              <el-input ref="nameInput" v-model="editableContact.name" size="small" @blur="saveEditContact('name')" @keydown="handleContactFieldKeydown($event, 'name')" />
            </template>
            <h2 v-else class="contact-name-large redesigned-name" @click="startEditContact('name')">{{ selectedContactDetails.name }}</h2>
            <!-- Details List -->
            <div class="contact-details-list">
              <div class="detail-row">
                <el-icon size="15" color="#69696b"><Briefcase /></el-icon><span class="contact-detail-label">Company</span>
                <div class="detail-value cursor-pointer">
                  <template v-if="editingField === 'company'">
                    <el-input ref="companyInput" v-model="editableContact.company" size="small" @blur="saveEditContact('company')" @keydown="handleContactFieldKeydown($event, 'company')" />
                  </template>
                  <template v-else>
                    <span @click="startEditContact('company')">{{ selectedContactDetails.company || 'Set a company...' }}</span>
                  </template>
                </div>
              </div>
              <div class="detail-row">
                <el-icon size="15" color="#69696b"><User /></el-icon><span class="contact-detail-label">Role</span>
                <div class="detail-value cursor-pointer">
                  <template v-if="editingField === 'role'">
                    <el-input ref="roleInput" v-model="editableContact.role" size="small" @blur="saveEditContact('role')" @keydown="handleContactFieldKeydown($event, 'role')" />
                  </template>
                  <template v-else>
                    <span @click="startEditContact('role')">{{ selectedContactDetails.role || 'Set a role...' }}</span>
                  </template>
                </div>
              </div>
              <div class="detail-row">
                <el-icon size="15" color="#69696b"><Phone /></el-icon><span class="contact-detail-label">Phone</span>
                <div class="detail-value cursor-pointer">
                  <template v-if="editingField === 'phone_number'">
                    <el-input ref="phone_numberInput" v-model="editableContact.phone_number" size="small" @blur="saveEditContact('phone_number')" @keydown="handleContactFieldKeydown($event, 'phone_number')" />
                  </template>
                  <template v-else>
                    <span @click="startEditContact('phone_number')">{{ formatPhone(selectedContactDetails.phone_number) || 'Set a phone...' }}</span>
                  </template>
                </div>
              </div>
              <div class="detail-row">
                <el-icon size="15" color="#69696b"><Message /></el-icon><span class="contact-detail-label">Email</span>
                <div class="detail-value cursor-pointer">
                  <template v-if="editingField === 'email'">
                    <el-input ref="emailInput" v-model="editableContact.email" size="small" @blur="saveEditContact('email')" @keydown="handleContactFieldKeydown($event, 'email')" />
                  </template>
                  <template v-else>
                    <span @click="startEditContact('email')">{{ selectedContactDetails.email || 'Set an email...' }}</span>
                  </template>
                </div>
              </div>
              <div class="detail-row">
                <el-icon size="15" color="#69696b"><Document /></el-icon><span class="contact-detail-label">Matter</span>
                <div class="detail-value cursor-pointer">
                  <template v-if="editingField === 'matter_text'">
                    <el-input ref="matter_textInput" v-model="editableContact.matter_text" size="small" @blur="saveEditContact('matter_text')" @keydown="handleContactFieldKeydown($event, 'matter_text')" />
                  </template>
                  <template v-else>
                    <span @click="startEditContact('matter_text')">{{ selectedContactDetails.matter_text || 'Set a matter...' }}</span>
                  </template>
                </div>
              </div>
              <div class="detail-row">
                <el-icon size="15" color="#69696b"><List /></el-icon><span class="contact-detail-label">Tags</span>
                <div class="detail-value cursor-pointer">
                  <template v-if="editingField === 'tags'">
                    <el-select ref="tagsInput" v-model="editableContact.tags" multiple filterable allow-create default-first-option size="small" style="width: 100%" @blur="saveEditContact('tags')">
                      <el-option v-for="tag in availableTags" :key="tag" :label="tag" :value="tag" />
                    </el-select>
                  </template>
                  <template v-else>
                    <template v-if="selectedContactDetails.tags && selectedContactDetails.tags.length">
                      <el-tag @click="startEditContact('tags')" v-for="tag in selectedContactDetails.tags" :key="tag" size="small" type="info" class="pill-tag">{{ tag }}</el-tag>
                    </template>
                    <template v-else>
                      <span class="placeholder" @click="startEditContact('tags')">Set tags...</span>
                    </template>
                  </template>
                </div>
              </div>
              <div class="detail-row">
                <el-icon size="15" color="#69696b"><Location /></el-icon><span class="contact-detail-label">Address</span>
                <div class="detail-value cursor-pointer">
                  <template v-if="editingField === 'address'">
                    <el-input ref="addressInput" v-model="editableContact.address" size="small" @blur="saveEditContact('address')" @keydown="handleContactFieldKeydown($event, 'address')" />
                  </template>
                  <template v-else>
                    <span @click="startEditContact('address')">{{ selectedContactDetails.address || 'Set an address...' }}</span>
                  </template>
                </div>
              </div>
              <div class="detail-row">
                <el-icon size="15" color="#69696b"><UserFilled /></el-icon><span class="contact-detail-label">Creator</span>
                <div class="detail-value"><span>{{ selectedContactDetails.creator_name || 'Unknown' }}</span></div>
              </div>
            </div>
            <hr>
            <!-- Contact Notes -->
            <div class="contact-notes-section">
              <div class="notes-header">
                <h4>Notes</h4>
              </div>
              <div class="notes-content">
                <div class="notes-list" v-if="contactNotes.length > 0">
                  <div v-for="note in contactNotes" :key="note.id" class="note-item">
                    <div class="note-header">
                      <span class="note-timestamp">{{ formatDate(note.created_at) }}</span>
                    </div>
                    <div class="note-text">{{ note.note }}</div>
                  </div>
                </div>
                <div v-else class="no-notes">
                  No notes added yet
                </div>
              </div>
              <div class="notes-input-section">
                <el-input
                  v-model="newNote"
                  type="textarea"
                  :rows="2"
                  placeholder="Add a note..."
                  class="note-input"
                />
                <el-button 
                  type="primary"
                  :icon="Check"
                  circle
                  class="save-note-btn"
                  @click="saveContactNote"
                  :disabled="!newNote.trim()"
                />
              </div>
            </div>
          </div>
          <!-- Placeholder if no contact is selected -->
          <div v-else class="no-contact-found">
            <el-icon class="large-icon"><User /></el-icon>
            <h3 class="no-contact-selected-title">No contact selected</h3>
            <p>Select a contact to view details.</p>
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
              placeholder="Select contact or enter 10 digit phone number"
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
              <!-- <el-option-group label="💬 Recent Conversations">
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
              </el-option-group> -->
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
          
          <!-- AI Check Button for New Message -->
          <div v-if="newMessageForm.message.trim()" class="ai-check-button-container">
            <el-button 
              size="small"
              type="warning"
              @click="checkNewMessageWithAI"
              :loading="checkingMessageWithAI">
              <el-icon><MagicStick /></el-icon>
              Check with AI
            </el-button>
          </div>
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

    <!-- Contact Modal -->
    <el-dialog
      v-model="showContactModal"
      :title="contactModalMode === 'add' ? 'Add Contact' : 'Edit Contact'"
      width="500px"
    >
      <el-form
        :model="contactModalForm"
        :rules="contactModalRules"
        ref="contactModalFormRef"
        label-width="116px"
      >
        <el-form-item label="Name" prop="name">
          <el-input
            v-model="contactModalForm.name"
            placeholder="Enter contact name"
            maxlength="100"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="Phone Number" prop="phone_number">
          <el-input
            v-model="contactModalForm.phone_number"
            maxlength="14"
            placeholder="(555) 123-4567"
          >
            <template #prepend>
              <el-button disabled style="width: 48px;">+1</el-button>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item label="Tags">
          <el-select
            v-model="contactModalForm.tags"
            multiple
            filterable
            allow-create
            default-first-option
            placeholder="Add tags"
            style="width: 100%"
          >
            <el-option
              v-for="tag in availableTags"
              :key="tag"
              :label="tag"
              :value="tag"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showContactModal = false">Cancel</el-button>
          <el-button
            type="primary"
            @click="saveContactModal"
            :loading="contactModalSaving"
          >
            Save
          </el-button>
        </span>
      </template>
    </el-dialog>

    <!-- Call Recording Upload Dialog -->
    <el-dialog
      v-model="showCallRecordingDialog"
      :title="`Upload Call Recording ${callRecordingForm.position === 'before' ? 'Before' : 'After'} Message`"
      width="500px"
    >
      <el-form
        :model="callRecordingForm"
        :rules="callRecordingRules"
        ref="callRecordingFormRef"
        label-width="120px"
      >
        <el-form-item label="Position" prop="position">
          <el-radio-group v-model="callRecordingForm.position">
            <el-radio label="before">Before this message</el-radio>
            <el-radio label="after">After this message</el-radio>
          </el-radio-group>
        </el-form-item>
        
        <el-form-item label="Recording File" prop="file">
          <el-upload
            ref="callRecordingUpload"
            :show-file-list="false"
            :before-upload="handleCallRecordingSelect"
            :multiple="false"
            accept="audio/*"
            action="#"
          >
            <el-button type="primary" plain>
              <el-icon><Upload /></el-icon>
              Select Audio File
            </el-button>
          </el-upload>
          <div v-if="callRecordingForm.file" class="file-info">
            <el-icon><Document /></el-icon>
            <span>{{ callRecordingForm.file.name }}</span>
            <span class="file-size">({{ formatFileSize(callRecordingForm.file.size) }})</span>
          </div>
        </el-form-item>
        
        <el-form-item label="Recorded Date" prop="recordedAt">
          <el-date-picker
            v-model="callRecordingForm.recordedAt"
            type="datetime"
            placeholder="When was this call recorded?"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="closeCallRecordingDialog">Cancel</el-button>
          <el-button
            type="primary"
            @click="uploadCallRecording"
            :loading="uploadingCallRecording"
            :disabled="!callRecordingForm.file"
          >
            Upload Recording
          </el-button>
        </span>
      </template>
    </el-dialog>

    <!-- Transcript Dialog -->
    <el-dialog
      v-model="showTranscriptDialog"
      title="Call Transcript"
      width="600px"
      :before-close="closeTranscriptDialog"
    >
      <div class="transcript-modal-content">
        <div
          v-for="(line, idx) in formattedTranscriptLines"
          :key="idx"
          class="transcript-line"
        >
          <span class="transcript-timestamp">{{ line.time }}</span>
          <span class="transcript-speaker">{{ line.speaker }}:</span>
          <span class="transcript-text">{{ line.text }}</span>
        </div>
      </div>
      <template #footer>
        <el-button @click="closeTranscriptDialog">Close</el-button>
      </template>
    </el-dialog>

    <!-- Internal Comments Dialog -->
    <el-dialog
      v-model="showInternalCommentsDialog"
      :title="`Internal Thread for Message`"
      width="500px"
      :before-close="closeInternalCommentsDialog"
    >
      <div class="internal-comments-content">
        <!-- Original Message Context -->
        <div class="original-message-context">
          <div class="context-header">
            <h4>Original Message</h4>
            <span class="message-timestamp">{{ formatDate(selectedMessageForComments?.timestamp) }}</span>
          </div>
          <div class="context-message">
            <div class="message-direction">
              <el-tag :type="selectedMessageForComments?.direction === 'outbound' ? 'primary' : 'success'" size="small">
                {{ selectedMessageForComments?.direction === 'outbound' ? 'Sent' : 'Received' }}
              </el-tag>
            </div>
            <p class="message-text">{{ selectedMessageForComments?.text || 'Media message' }}</p>
          </div>
        </div>

        <!-- Internal Comments List -->
        <div class="internal-comments-list">
          <div v-if="(internalCommentsMap[selectedMessageForComments?.id] || []).length === 0" class="no-comments">
            <el-icon class="no-comments-icon"><ChatDotRound /></el-icon>
            <p>No internal comments yet. Start the conversation!</p>
          </div>
          
          <div v-for="comment in internalCommentsMap[selectedMessageForComments?.id] || []" :key="comment.id" class="internal-comment-item compact-comment">
            <el-tooltip :content="formatFullTimeWithZone(comment.created_at)" placement="right">
              <div class="comment-bubble">
                <span class="comment-author">{{ comment.author_name }}</span>
                <span class="comment-content">{{ comment.content }}</span>
              </div>
            </el-tooltip>
          </div>
        </div>

        <!-- Add New Comment -->
        <div class="add-comment-section">
          <el-input
            v-model="newInternalComment[selectedMessageForComments?.id]"
            type="textarea"
            :rows="3"
            placeholder="Add an internal comment... (Only visible to your team)"
            maxlength="500"
            show-word-limit
            class="comment-input"
          />
          <div class="comment-actions">
            <el-button @click="showingInternalCommentsFor = showingInternalCommentsFor.filter(id => id !== selectedMessageForComments?.id)">Cancel</el-button>
            <el-button 
              type="primary" 
              @click="addInternalComment(selectedMessageForComments?.id)"
              :disabled="!newInternalComment[selectedMessageForComments?.id]?.trim()"
              :loading="addingComment[selectedMessageForComments?.id]"
            >
              Add Comment
            </el-button>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- AI Check Message Dialog -->
    <el-dialog
      v-model="showAICheckDialog"
      width="600px"
      :before-close="closeAICheckDialog"
    >
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
          <span style="font-size: 1.1rem; font-weight: 600;">AI Message Check</span>
          <el-tooltip 
            v-if="aiCheckDebugData"
            content="Show Debug Information" 
            placement="top">
            <el-button 
              circle
              size="small"
              @click="showAICheckDebug = !showAICheckDebug"
              :type="showAICheckDebug ? 'primary' : 'default'">
              <el-icon><Setting /></el-icon>
            </el-button>
          </el-tooltip>
        </div>
      </template>
      <div class="ai-check-content">
        <!-- Conversation Context Preview -->
        <div class="conversation-context-section-compact">
          <div class="conversation-header-compact" @click="toggleConversationView">
            <h4>Recent Conversation</h4>
            <el-icon class="collapse-icon" :class="{ 'expanded': showConversationPreview }">
              <ArrowDown />
            </el-icon>
          </div>
          <div v-show="showConversationPreview" class="conversation-preview-compact">
            <div 
              v-for="(msg, index) in recentConversationMessages.slice(0, 3)" 
              :key="index"
              :class="['context-message-compact', msg.direction]">
              <div class="message-row">
                <span class="sender-compact">{{ msg.direction === 'outbound' ? 'You' : (getCurrentContactName() || 'Contact') }}</span>
                <span class="message-text-compact">{{ msg.text || '[Media message]' }}</span>
                <span class="time-compact" v-if="msg.timestamp">{{ formatCompactTime(msg.timestamp) }}</span>
              </div>
            </div>
            <div v-if="!recentConversationMessages || recentConversationMessages.length === 0" class="no-messages-compact">
              No recent messages
            </div>
          </div>
        </div>

        <!-- Original Message -->
        <div class="original-message-section">
          <h4>Original Message</h4>
          <div class="original-message-box">
            {{ aiCheckOriginalMessage }}
          </div>
        </div>

        <!-- AI Analysis -->
        <div v-if="aiCheckResult" class="ai-analysis-section">
          <!-- Issues Found -->
          <div v-if="aiCheckResult.hasIssues && aiCheckResult.suggestions.length > 0" class="issues-section">
            <h4>Issues Found</h4>
            <div class="suggestions-list">
              <div 
                v-for="(suggestion, index) in aiCheckResult.suggestions" 
                :key="index"
                class="suggestion-item">
                <el-tag 
                  :type="getSuggestionTagType(suggestion.type)" 
                  size="small"
                  class="suggestion-type">
                  {{ suggestion.type }}
                </el-tag>
                <div class="suggestion-content">
                  <p class="issue-description">{{ suggestion.issue }}</p>
                  <p class="suggestion-text">{{ suggestion.suggestion }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Improved Message -->
          <div class="improved-message-section">
            <h4>Improved Message</h4>
            <el-input
              v-model="editableImprovedMessage"
              type="textarea"
              :rows="3"
              class="improved-message-input"
            />
            <div v-if="aiCheckResult.explanation" class="explanation">
              <strong>Explanation:</strong> {{ aiCheckResult.explanation }}
            </div>
          </div>

          <!-- No Issues Found -->
          <div v-if="!aiCheckResult.hasIssues" class="no-issues-section">
            <el-icon class="check-icon"><Check /></el-icon>
            <p>Your message looks good! No grammatical errors or clarity issues found.</p>
            <p v-if="aiCheckResult.explanation" class="explanation">{{ aiCheckResult.explanation }}</p>
          </div>
        </div>

        <!-- Loading State -->
        <div v-else-if="checkingMessageWithAI" class="loading-section">
          <el-icon class="loading-icon"><MagicStick /></el-icon>
          <p>AI is checking your message...</p>
        </div>

        <!-- Debug Information -->
        <div v-if="showAICheckDebug && aiCheckDebugData" class="debug-section">
          <h4>Debug Information</h4>
          <el-collapse>
            <el-collapse-item v-if="aiCheckDebugData.response && aiCheckDebugData.response.body.debug" title="System Prompt" name="system-prompt">
              <div class="debug-content">
                <pre><code>{{ aiCheckDebugData.response.body.debug.systemPrompt }}</code></pre>
              </div>
            </el-collapse-item>
            
            <el-collapse-item v-if="aiCheckDebugData.response && aiCheckDebugData.response.body.debug" title="User Prompt" name="user-prompt">
              <div class="debug-content">
                <pre><code>{{ aiCheckDebugData.response.body.debug.userPrompt }}</code></pre>
              </div>
            </el-collapse-item>
            
            <el-collapse-item v-if="aiCheckDebugData.response && aiCheckDebugData.response.body.debug" title="AI Model Settings" name="model-settings">
              <div class="debug-content">
                <pre><code>Model: {{ aiCheckDebugData.response.body.debug.model }}
Temperature: {{ aiCheckDebugData.response.body.debug.temperature }}
Max Tokens: {{ aiCheckDebugData.response.body.debug.maxTokens }}</code></pre>
              </div>
            </el-collapse-item>
            
            <el-collapse-item v-if="aiCheckDebugData.response && aiCheckDebugData.response.body.debug" title="Raw AI Response" name="ai-response">
              <div class="debug-content">
                <pre><code>{{ aiCheckDebugData.response.body.debug.rawAIResponse }}</code></pre>
              </div>
            </el-collapse-item>
            
            <el-collapse-item v-if="aiCheckDebugData.error" title="Error Information" name="error">
              <div class="debug-content">
                <h5>Error Message:</h5>
                <code class="error-text">{{ aiCheckDebugData.error.message }}</code>
                
                <h5>Stack Trace:</h5>
                <pre><code class="error-text">{{ aiCheckDebugData.error.stack }}</code></pre>
              </div>
            </el-collapse-item>
          </el-collapse>
        </div>
      </div>

      <template #footer>
        <div class="ai-check-footer">
          <el-button @click="closeAICheckDialog">Cancel</el-button>
          <el-button 
            v-if="aiCheckResult"
            @click="useImprovedMessage"
            type="primary">
            Use Improved Message
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- AI Draft Message Dialog -->
    <el-dialog
      v-model="showAIDraftDialog"
      width="600px"
      :before-close="closeAIDraftDialog"
    >
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
          <span style="font-size: 1.1rem; font-weight: 600;">AI-DM: Draft Message</span>
          <el-tooltip 
            v-if="aiDraftDebugData"
            content="Show Debug Information" 
            placement="top">
            <el-button 
              circle
              size="small"
              @click="showAIDraftDebug = !showAIDraftDebug"
              :type="showAIDraftDebug ? 'primary' : 'default'">
              <el-icon><Setting /></el-icon>
            </el-button>
          </el-tooltip>
        </div>
      </template>
      <div class="ai-draft-content">
        <!-- Conversation Context Preview -->
        <div class="conversation-context-section-compact">
          <div class="conversation-header-compact" @click="toggleConversationView">
            <h4>Recent Conversation</h4>
            <el-icon class="collapse-icon" :class="{ 'expanded': showConversationPreview }">
              <ArrowDown />
            </el-icon>
          </div>
          <div v-show="showConversationPreview" class="conversation-preview-compact">
            <div 
              v-for="(msg, index) in recentConversationMessages.slice(0, 3)" 
              :key="index"
              :class="['context-message-compact', msg.direction]">
              <div class="message-row">
                <span class="sender-compact">{{ msg.direction === 'outbound' ? 'You' : (getCurrentContactName() || 'Contact') }}</span>
                <span class="message-text-compact">{{ msg.text || '[Media message]' }}</span>
                <span class="time-compact" v-if="msg.timestamp">{{ formatCompactTime(msg.timestamp) }}</span>
              </div>
            </div>
            <div v-if="!recentConversationMessages || recentConversationMessages.length === 0" class="no-messages-compact">
              No recent messages
            </div>
          </div>
        </div>

        <!-- AI Suggested Message -->
        <div v-if="aiDraftResult" class="ai-draft-section">
          <!-- Suggested Message -->
          <div class="suggested-message-section">
            <h4>Suggested Reply</h4>
            <el-input
              v-model="editableDraftMessage"
              type="textarea"
              :rows="3"
              class="draft-message-input"
            />
            
            <!-- AI Reasoning -->
            <div v-if="aiDraftResult.reasoning" class="ai-reasoning">
              <el-icon><ChatLineRound /></el-icon>
              <span><strong>AI Reasoning:</strong> {{ aiDraftResult.reasoning }}</span>
            </div>
            
            <!-- Tone Badge -->
            <div v-if="aiDraftResult.tone" class="tone-badge">
              <el-tag :type="getToneTagType(aiDraftResult.tone)" size="small">
                {{ aiDraftResult.tone }} tone
              </el-tag>
            </div>
          </div>

          <!-- Alternative Suggestions -->
          <div v-if="aiDraftResult.alternatives && aiDraftResult.alternatives.length > 0" class="alternatives-section">
            <h4>Alternative Suggestions</h4>
            <div class="alternatives-list">
              <div 
                v-for="(alternative, index) in aiDraftResult.alternatives" 
                :key="index"
                class="alternative-item"
                @click="selectAlternative(alternative)">
                <el-icon><Message /></el-icon>
                <span>{{ alternative }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Loading State -->
        <div v-else-if="draftingMessageWithAI" class="loading-section">
          <el-icon class="loading-icon"><ChatLineRound /></el-icon>
          <p>AI is analyzing the conversation and drafting a reply...</p>
        </div>

        <!-- Debug Information -->
        <div v-if="showAIDraftDebug && aiDraftDebugData" class="debug-section">
          <h4>Debug Information</h4>
          <el-collapse>
            <el-collapse-item v-if="aiDraftDebugData.response && aiDraftDebugData.response.body.debug" title="System Prompt" name="system-prompt">
              <div class="debug-content">
                <pre><code>{{ aiDraftDebugData.response.body.debug.systemPrompt }}</code></pre>
              </div>
            </el-collapse-item>
            
            <el-collapse-item v-if="aiDraftDebugData.response && aiDraftDebugData.response.body.debug" title="User Prompt" name="user-prompt">
              <div class="debug-content">
                <pre><code>{{ aiDraftDebugData.response.body.debug.userPrompt }}</code></pre>
              </div>
            </el-collapse-item>
            
            <el-collapse-item v-if="aiDraftDebugData.response && aiDraftDebugData.response.body.debug" title="AI Model Settings" name="model-settings">
              <div class="debug-content">
                <pre><code>Model: {{ aiDraftDebugData.response.body.debug.model }}
Temperature: {{ aiDraftDebugData.response.body.debug.temperature }}
Max Tokens: {{ aiDraftDebugData.response.body.debug.maxTokens }}</code></pre>
              </div>
            </el-collapse-item>
            
            <el-collapse-item v-if="aiDraftDebugData.response && aiDraftDebugData.response.body.debug" title="Raw AI Response" name="ai-response">
              <div class="debug-content">
                <pre><code>{{ aiDraftDebugData.response.body.debug.rawAIResponse }}</code></pre>
              </div>
            </el-collapse-item>
          
            <el-collapse-item v-if="aiDraftDebugData.error" title="Error Information" name="error">
              <div class="debug-content">
                <h5>Error Message:</h5>
                <code class="error-text">{{ aiDraftDebugData.error.message }}</code>
                
                <h5>Stack Trace:</h5>
                <pre><code class="error-text">{{ aiDraftDebugData.error.stack }}</code></pre>
              </div>
            </el-collapse-item>
          </el-collapse>
        </div>
      </div>

      <template #footer>
        <div class="ai-draft-footer">
          <el-button @click="closeAIDraftDialog">Cancel</el-button>
          <el-button 
            v-if="aiDraftResult"
            @click="useDraftMessage"
            type="primary">
            Use This Message
          </el-button>
          <el-button 
            v-if="aiDraftResult"
            @click="useDraftAndSend"
            type="success">
            Use & Send Now
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
  EditPen,
  Setting,
  Promotion,
  Message,
  UserFilled,
  Bell,
  Check,
  User,
  Document,
  Paperclip,
  Close,
  Upload,
  ArrowDown,
  ArrowRight,
  Briefcase,
  List,
  Location,
  View,
  MagicStick,
  ChatLineRound,
  Loading
} from '@element-plus/icons-vue';
import { computed, markRaw } from 'vue';
import { useMatterStore } from '../../store/matter';
import { storeToRefs } from 'pinia';
import { useRealtimeMessages } from '../../composables/useRealtimeMessages';
import { supabase } from '../../supabase';
import { marked } from 'marked';
import { updateMatterActivity } from '../../utils/matterActivity';

export default {
  name: 'AiPhoneCt',
  components: {
    Plus,
    Search,
    ChatDotRound,
    Phone,
    More,
    EditPen,
    Setting,
    Promotion,
    Message,
    UserFilled,
    Bell,
    Check,
    User,
    Document,
    Paperclip,
    Close,
    Upload,
    ArrowDown,
    ArrowRight,
    Briefcase,
    List,
    Location,
    View,
    MagicStick,
    ChatLineRound,
    Loading
  },
  setup() {
    const matterStore = useMatterStore();
    const { currentMatter } = storeToRefs(matterStore);
    
    // Real-time messaging setup
    const {
      conversations: realtimeConversations,
      loadMessagesForConversation,
      loadCallRecordingsForConversation,
      markConversationAsRead: realtimeMarkAsRead
    } = useRealtimeMessages(computed(() => currentMatter.value?.id));
    
    return { 
      currentMatter,
      realtimeConversations,
      loadMessagesForConversation,
      loadCallRecordingsForConversation,
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
      isDragOver: false,
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
      
      // Tag filtering
      selectedTags: [],
      
      // Message counts
      messageCounts: {
        week: 0,
        month: 0,
        year: 0
      },
      
      // Per-tag message counts - format: { phoneNumber: { tagName: { year, month, week } } }
      tagMessageCounts: {},
      
      // Per-contact message counts - format: { fromPhoneNumber: { contactPhoneNumber: { year, month, week } } }
      contactMessageCounts: {},
      
      // Icons
      Check: markRaw(Check),
      
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
      showContactModal: false,
      contactModalMode: 'add', // 'add' or 'edit'
      contactModalForm: {
        name: '',
        phone_number: '',
        tags: []
      },
      contactModalSaving: false,
      contactModalRules: {
        name: [
          { required: true, message: 'Name is required', trigger: 'blur' },
          { min: 1, max: 100, message: 'Name must be between 1 and 100 characters', trigger: 'blur' }
        ],
        phone_number: [
          { required: true, message: 'Phone number is required', trigger: 'blur' }
        ]
      },
      showCallRecordingDialog: false,
      selectedMessageForRecording: null,
      callRecordingForm: {
        position: 'before',
        file: null,
        recordedAt: null
      },
      callRecordingRules: {
        position: [
          { required: true, message: 'Please select a position', trigger: 'change' }
        ],
        file: [
          { required: true, message: 'Please upload a recording file', trigger: 'change' }
        ],
      },
      uploadingCallRecording: false,
      // Phone text message actions
      phoneTextActions: [],
      loadingPhoneTextActions: false,
      showTranscriptDialog: false,
      currentTranscript: '',
      summaryCollapse: {},
      selectedContactDetails: null,
      contactNotes: [],
      newNote: '',
      
      // Internal Comments
      hoveredMessage: null,
      showingInternalCommentsFor: [], // array of open messageIds
      selectedMessageForComments: null,
      internalCommentsMap: {}, // { [messageId]: comments[] }
      newInternalComment: {}, // { [messageId]: string }
      addingComment: {},      // { [messageId]: boolean }
      messageInternalComments: {}, // Cache for message comments count
      labelEditInput: '',
      labelPopoverVisible: false,
      selectedTagByPhone: {},
      expandedPhoneForTags: null,
      showUntaggedOnly: false, // New flag to show only untagged conversations
      editingContact: false,
      editableContact: {},
      savingContact: false,
      saveTimeout: null,
      
      // AI Check Message
      showAICheckDialog: false,
      checkingMessageWithAI: false,
      aiCheckOriginalMessage: '',
      aiCheckResult: null,
      editableImprovedMessage: '',
      showAICheckDebug: false,
      aiCheckDebugData: null,
      
      // AI Draft Message
      showAIDraftDialog: false,
      draftingMessageWithAI: false,
      aiDraftResult: null,
      editableDraftMessage: '',
      recentConversationMessages: [],
      showAIDraftDebug: false,
      aiDraftDebugData: null,
      
      // Conversation Preview
      showConversationPreview: true,
      
      // Last Seen Users
      lastSeenUsers: {}, // { [conversationId]: users[] }
      loadingLastSeen: {}, // { [conversationId]: boolean }
      conversationReadStatus: [], // Array of { user_id, last_read_at, display_name }
      editingField: null, // Track which field is being edited
    };
  },
  computed: {
    inboxItems() {
      const phoneNumbers = this.currentMatter?.phone_numbers || [];
      return phoneNumbers.map(phone => {
        // Calculate unread counts for this phone number
        const unreadCount = this.realtimeConversations.filter(conv => 
          conv.fromPhoneNumber === phone.number && 
          conv.unread > 0
        ).reduce((sum, conv) => sum + conv.unread, 0);

        return {
          id: `phone_${phone.id}`,
          label: phone.label,
          number: phone.number,
          icon: 'Phone',
          type: 'phone',
          count: unreadCount > 0 ? unreadCount : null
        };
      }).sort((a, b) => a.label.localeCompare(b.label)); // Sort alphabetically by label
    },

    recentConversations() {
      // Get recent conversations for the contact picker
      return this.realtimeConversations
        .slice(0, 10) // Limit to 10 most recent
        .map(conv => ({
          id: conv.id,
          contact: this.getContactName(conv.phoneNumber, conv.contact) || conv.contact || 'Unknown',
          fromPhoneNumber: conv.fromPhoneNumber
        }));
    },

    filteredConversations() {
      if (!this.selectedInboxItem) {
        return [];
      }
      let filtered = this.realtimeConversations || [];
      const phoneId = this.selectedInboxItem.replace('phone_', '');
      const phone = this.currentMatter?.phone_numbers?.find(p => p.id.toString() === phoneId);
      
      if (phone) {
        filtered = filtered.filter(conv => conv.fromPhoneNumber === phone.number);
        
        // Apply tag filtering for the selected phone
        const selectedTag = this.selectedTagByPhone[`phone_${phone.id}`];
        if (selectedTag) {
          filtered = filtered.filter(conv => {
            const contact = this.workspaceContacts.find(c => {
              const convPhone = conv.phoneNumber || conv.contact || '';
              const contactPhone = c.phone_number || '';
              const normalizedConvPhone = convPhone.replace(/\D/g, '').slice(-10);
              const normalizedContactPhone = contactPhone.replace(/\D/g, '').slice(-10);
              const fullConvPhone = convPhone.replace(/\D/g, '');
              const fullContactPhone = contactPhone.replace(/\D/g, '');
              return normalizedConvPhone === normalizedContactPhone || fullConvPhone === fullContactPhone;
            });
            
            return contact && contact.tags && contact.tags.includes(selectedTag);
          });
        }
        
        // Apply untagged filter - show only conversations without tags
        if (this.showUntaggedOnly) {
          filtered = filtered.filter(conv => {
            const contact = this.workspaceContacts.find(c => {
              const convPhone = conv.phoneNumber || conv.contact || '';
              const contactPhone = c.phone_number || '';
              const normalizedConvPhone = convPhone.replace(/\D/g, '').slice(-10);
              const normalizedContactPhone = contactPhone.replace(/\D/g, '').slice(-10);
              const fullConvPhone = convPhone.replace(/\D/g, '');
              const fullContactPhone = contactPhone.replace(/\D/g, '');
              return normalizedConvPhone === normalizedContactPhone || fullConvPhone === fullContactPhone;
            });
            
            // Show conversation if contact doesn't exist or has no tags
            return !contact || !contact.tags || contact.tags.length === 0;
          });
        }
      }
      
      // Apply search
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        filtered = filtered.filter(conv => {
          const contactName = this.getContactName(conv.phoneNumber, conv.contact) || '';
          return (
            contactName.toLowerCase().includes(query) ||
            conv.fromPhoneNumber.includes(query) ||
            (conv.contact && conv.contact.toLowerCase().includes(query)) ||
            conv.lastMessage.toLowerCase().includes(query)
          );
        });
      }
      
      // Apply global tag filtering (existing functionality)
      if (this.selectedTags.length > 0) {
        if (!this.workspaceContacts || this.workspaceContacts.length === 0) {
          return filtered;
        }
        
        filtered = filtered.filter(conv => {
          const contact = this.workspaceContacts.find(c => {
            const convPhone = conv.phoneNumber || conv.contact || '';
            const contactPhone = c.phone_number || '';
            const normalizedConvPhone = convPhone.replace(/\D/g, '').slice(-10);
            const normalizedContactPhone = contactPhone.replace(/\D/g, '').slice(-10);
            const fullConvPhone = convPhone.replace(/\D/g, '');
            const fullContactPhone = contactPhone.replace(/\D/g, '');
            return normalizedConvPhone === normalizedContactPhone || fullConvPhone === fullContactPhone;
          });
          
          if (!contact || !contact.tags || contact.tags.length === 0) {
            return false;
          }
          
          const hasMatchingTag = this.selectedTags.some(selectedTag => 
            contact.tags.includes(selectedTag)
          );
          
          return hasMatchingTag;
        });
      }

      return filtered;
    },
    
    currentChat() {
      return this.realtimeConversations.find(conv => conv.id === this.selectedConversation);
    },
    
    conversationHeaderTitle() {
      if (!this.selectedInboxItem) {
        return { title: 'Conversations', tooltip: null };
      }

      // Extract phone ID from selectedInboxItem (format: phone_123)
      const phoneId = this.selectedInboxItem.replace('phone_', '');
      const phone = this.currentMatter?.phone_numbers?.find(p => p.id.toString() === phoneId);
      
      if (phone) {        
        if (this.showUntaggedOnly) {
          return { 
            title: `Untagged Conversations for ${phone.label}`, 
            tooltip: phone.number 
          };
        }
        return { 
          title: `Conversations for ${phone.label}`, 
          tooltip: phone.number 
        };
      }
      return { title: 'Conversations', tooltip: null };
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
      
      // Create a combined array of messages and call recordings
      const timelineItems = [];
      
      // Add messages
      this.filteredChatMessages.forEach(msg => {
        timelineItems.push({
          type: 'message',
          item: msg,
          timestamp: new Date(msg.timestamp)
        });
      });
      
      // Add call recordings with their position logic
      // Use full message list (not filtered) to find associated messages
      const allMessages = this.currentChat?.messages || [];
      this.callRecordings.forEach(recording => {
        const associatedMessage = allMessages.find(msg => msg.id === recording.message_id);
        
        if (associatedMessage) {
          const messageTime = new Date(associatedMessage.timestamp);
          let recordingTime;
          
          if (recording.position === 'before') {
            // Place recording slightly before the message
            recordingTime = new Date(messageTime.getTime() - 1000);
          } else {
            // Place recording slightly after the message
            recordingTime = new Date(messageTime.getTime() + 1000);
          }
          
          timelineItems.push({
            type: 'recording',
            item: recording,
            timestamp: recordingTime,
            associatedMessageId: recording.message_id,
            associatedMessageDirection: associatedMessage.direction
          });
        }
      });
      
      // Sort all items by timestamp
      timelineItems.sort((a, b) => a.timestamp - b.timestamp);
      
      // Group by date
      timelineItems.forEach(item => {
        const dateStr = item.timestamp.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
        if (!groups[dateStr]) groups[dateStr] = [];
        groups[dateStr].push(item);
      });
      
      // Return as array of { date, items }
      console.log('groupedChatMessages:', groups);
      return Object.entries(groups).map(([date, items]) => ({ date, items }));
    },

    availableTags() {
      // Collect all unique tags from workspaceContacts
      const allTags = new Set();
      
      this.workspaceContacts.forEach(contact => {
        if (contact.tags) {
          contact.tags.forEach(tag => allTags.add(tag));
        }
      });
      
      const tags = Array.from(allTags).sort();
      return tags;
    },

    callRecordings() {
      if (!this.currentChat) return [];
      // This will be populated when we load call recordings
      return this.currentChat.callRecordings || [];
    },

    showNewMessageButton() {
      return !!this.selectedInboxItem;
    },
    formattedTranscriptLines() {
      if (!this.currentTranscript) return [];
      // Each line: "0:01 Speaker 0: Hello?"
      return this.currentTranscript.split('\n').map(line => {
        const match = line.match(/^(\d+:\d+)\s+([^:]+):\s*(.*)$/);
        if (match) {
          return {
            time: match[1],
            speaker: match[2],
            text: match[3]
          };
        }
        return { time: '', speaker: '', text: line };
      });
    },
    availableTagsForPhone() {
      // Returns all available tags from workspace contacts
      const allTags = new Set();
      this.workspaceContacts.forEach(contact => {
        if (contact.tags) {
          contact.tags.forEach(tag => allTags.add(tag));
        }
      });
      return Array.from(allTags).sort();
    },

    // Message count statistics
    messageCountsThisWeek() {
      return this.messageCounts.week || 0;
    },

    messageCountsThisMonth() {
      return this.messageCounts.month || 0;
    },

    messageCountsThisYear() {
      return this.messageCounts.year || 0;
    },

    // Get message counts for a specific tag and phone number
    getMessageCountsForTag() {
      return (phoneNumber, tagName) => {
        if (!phoneNumber || !tagName || !this.tagMessageCounts[phoneNumber]) {
          return { year: 0, month: 0, week: 0 };
        }

        return this.tagMessageCounts[phoneNumber][tagName] || { year: 0, month: 0, week: 0 };
      };
    },

    // Get message counts for a specific contact/phone number
    getContactMessageCounts() {
      return (contactPhoneNumber) => {
        if (!contactPhoneNumber || !this.contactMessageCounts) {
          return { year: 0, month: 0, week: 0 };
        }

        // Normalize phone number for lookup
        const normalizedPhone = contactPhoneNumber.replace(/\D/g, '').slice(-10);
        
        // Find counts for this contact's phone number across all from_phone_numbers
        let totalCounts = { year: 0, month: 0, week: 0 };
        
        Object.keys(this.contactMessageCounts).forEach(fromPhone => {
          if (this.contactMessageCounts[fromPhone][normalizedPhone]) {
            const counts = this.contactMessageCounts[fromPhone][normalizedPhone];
            totalCounts.year += counts.year;
            totalCounts.month += counts.month;
            totalCounts.week += counts.week;
          }
        });

        return totalCounts;
      };
    },

    // Calculate unread message counts for each tag
    getUnreadCountsForTag() {
      return (phoneNumber, tagName) => {
        if (!phoneNumber || !tagName) return 0;
        
        // Get conversations for this phone number
        const phoneConversations = this.realtimeConversations.filter(conv => 
          conv.fromPhoneNumber === phoneNumber
        );
        
        // Filter conversations that have contacts with this tag
        const taggedConversations = phoneConversations.filter(conv => {
          const contact = this.workspaceContacts.find(c => {
            const convPhone = conv.phoneNumber || conv.contact || '';
            const contactPhone = c.phone_number || '';
            const normalizedConvPhone = convPhone.replace(/\D/g, '').slice(-10);
            const normalizedContactPhone = contactPhone.replace(/\D/g, '').slice(-10);
            const fullConvPhone = convPhone.replace(/\D/g, '');
            const fullContactPhone = contactPhone.replace(/\D/g, '');
            return normalizedConvPhone === normalizedContactPhone || fullConvPhone === fullContactPhone;
          });
          
          return contact && contact.tags && contact.tags.includes(tagName);
        });
        
        // Sum up unread counts for these conversations
        return taggedConversations.reduce((sum, conv) => sum + (conv.unread || 0), 0);
      };
    },

    // Calculate unread counts for untagged conversations
    getUnreadCountsForUntagged() {
      return (phoneNumber) => {
        if (!phoneNumber) return 0;
        
        // Get conversations for this phone number
        const phoneConversations = this.realtimeConversations.filter(conv => 
          conv.fromPhoneNumber === phoneNumber
        );
        
        // Filter conversations that have no tags or contacts without tags
        const untaggedConversations = phoneConversations.filter(conv => {
          const contact = this.workspaceContacts.find(c => {
            const convPhone = conv.phoneNumber || conv.contact || '';
            const contactPhone = c.phone_number || '';
            const normalizedConvPhone = convPhone.replace(/\D/g, '').slice(-10);
            const normalizedContactPhone = contactPhone.replace(/\D/g, '').slice(-10);
            const fullConvPhone = convPhone.replace(/\D/g, '');
            const fullContactPhone = contactPhone.replace(/\D/g, '');
            return normalizedConvPhone === normalizedContactPhone || fullConvPhone === fullContactPhone;
          });
          
          // Show conversation if contact doesn't exist or has no tags
          return !contact || !contact.tags || contact.tags.length === 0;
        });
        
        // Sum up unread counts for these conversations
        return untaggedConversations.reduce((sum, conv) => sum + (conv.unread || 0), 0);
      };
    },

    hierarchicalTagsForPhone() {
      // Returns a function that takes a phone number and returns hierarchical tags
      return (phoneNumber) => {
        const tagSet = new Set();
        
        // Get tags only from contacts that have conversations with this phone number
        (this.realtimeConversations || []).forEach(conv => {
          if (conv.fromPhoneNumber === phoneNumber) {
            // Find the contact for this conversation
            const contact = this.workspaceContacts.find(c => {
              const convPhone = conv.phoneNumber || conv.contact || '';
              const contactPhone = c.phone_number || '';
              const normalizedConvPhone = convPhone.replace(/\D/g, '').slice(-10);
              const normalizedContactPhone = contactPhone.replace(/\D/g, '').slice(-10);
              const fullConvPhone = convPhone.replace(/\D/g, '');
              const fullContactPhone = contactPhone.replace(/\D/g, '');
              return normalizedConvPhone === normalizedContactPhone || fullConvPhone === fullContactPhone;
            });
            
            if (contact && contact.tags) {
              contact.tags.forEach(tag => tagSet.add(tag));
            }
          }
        });
        
        const allTags = Array.from(tagSet).sort();
        const tagGroups = {};
        
        // Group tags by parent
        allTags.forEach(tag => {
          if (tag.includes('.')) {
            const [parent, child] = tag.split('.');
            if (!tagGroups[parent]) {
              tagGroups[parent] = [];
            }
            tagGroups[parent].push(child);
          } else {
            // Tags without dots are standalone
            if (!tagGroups[tag]) {
              tagGroups[tag] = [];
            }
          }
        });
        
        // Convert to hierarchical structure
        const hierarchical = [];
        Object.keys(tagGroups).sort().forEach(parent => {
          if (tagGroups[parent].length === 0) {
            // Standalone tag
            hierarchical.push({
              name: parent,
              type: 'parent',
              children: []
            });
          } else {
            // Parent with children
            hierarchical.push({
              name: parent,
              type: 'parent',
              children: tagGroups[parent].sort().map(child => ({
                name: child,
                type: 'child',
                fullName: `${parent}.${child}`
              }))
            });
          }
        });
        
        return hierarchical;
      };
    },
  },
  async mounted() {
    // Auto-select first phone number if available
    if (this.currentMatter?.phone_numbers?.length > 0) {
      const firstPhone = this.currentMatter.phone_numbers[0];
      this.selectedInboxItem = `phone_${firstPhone.id}`;
    }

    // Load workspace contacts when component mounts
    await this.loadWorkspaceContacts();
    // Load phone text message actions
    await this.loadPhoneTextActions();
    // Load message counts
    await this.loadMessageCounts();

    this.$watch(
      () => this.currentChat?.messages,
      (val) => {
        console.log('currentChat.messages changed:', val);
      },
      { deep: true }
    );
  },
  watch: {
    currentMatter: {
      handler(newMatter) {
        if (newMatter && newMatter.id) {
          this.loadWorkspaceContacts().then(() => {
            this.loadPhoneTextActions();
            this.loadMessageCounts();
          });
        }
      },
      immediate: false
    }
  },
  methods: {
    // Get total message counts for a specific from_phone_number (for left panel tooltips)
    getPhoneNumberMessageCounts(fromPhoneNumber) {
      if (!fromPhoneNumber || !this.contactMessageCounts || !this.contactMessageCounts[fromPhoneNumber]) {
        return { year: 0, month: 0, week: 0 };
      }

      // Sum up all counts for this from_phone_number across all contacts
      let totalCounts = { year: 0, month: 0, week: 0 };
      
      Object.keys(this.contactMessageCounts[fromPhoneNumber]).forEach(contactPhone => {
        const counts = this.contactMessageCounts[fromPhoneNumber][contactPhone];
        totalCounts.year += counts.year;
        totalCounts.month += counts.month;
        totalCounts.week += counts.week;
      });

      return totalCounts;
    },
    
    // Load message counts from database
    async loadMessageCounts() {
      if (!this.currentMatter?.id) return;
      
      try {
        const now = new Date();
        
        // Calculate start dates for each period
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const yearStart = new Date(now.getFullYear(), 0, 1);
        
        // Query the database for conversations with messages and from_phone_number
        const { data: conversations, error } = await supabase
          .from('conversations')
          .select(`
            id,
            from_phone_number,
            to_phone_number,
            messages(
              id,
              direction,
              created_at
            )
          `)
          .eq('matter_id', this.currentMatter.id);
        
        if (error) throw error;
        
        // Count overall outbound messages for each period
        let weekCount = 0;
        let monthCount = 0;
        let yearCount = 0;
        
        // Initialize per-tag and per-contact counts structure
        const tagCounts = {};
        const contactCounts = {};
        
        conversations.forEach(conv => {
          if (conv.messages) {
            conv.messages.forEach(msg => {
              if (msg.direction === 'outbound') {
                const msgDate = new Date(msg.created_at);
                
                // Overall counts
                if (msgDate >= weekStart) weekCount++;
                if (msgDate >= monthStart) monthCount++;
                if (msgDate >= yearStart) yearCount++;
                
                const fromPhone = conv.from_phone_number;
                const toPhone = conv.to_phone_number;
                
                if (fromPhone && toPhone) {
                  // Normalize contact phone number
                  const normalizedContactPhone = toPhone.replace(/\D/g, '').slice(-10);
                  
                  // Initialize contact counts structure
                  if (!contactCounts[fromPhone]) {
                    contactCounts[fromPhone] = {};
                  }
                  if (!contactCounts[fromPhone][normalizedContactPhone]) {
                    contactCounts[fromPhone][normalizedContactPhone] = { year: 0, month: 0, week: 0 };
                  }
                  
                  // Count messages for this contact
                  if (msgDate >= weekStart) contactCounts[fromPhone][normalizedContactPhone].week++;
                  if (msgDate >= monthStart) contactCounts[fromPhone][normalizedContactPhone].month++;
                  if (msgDate >= yearStart) contactCounts[fromPhone][normalizedContactPhone].year++;
                  
                  // Per-tag counts (existing logic)
                  // Find contacts for this conversation
                  const contact = this.workspaceContacts.find(c => {
                    const contactPhone = c.phone_number || '';
                    const normalizedConvPhone = toPhone.replace(/\D/g, '').slice(-10);
                    const normalizedContactPhoneForMatch = contactPhone.replace(/\D/g, '').slice(-10);
                    const fullConvPhone = toPhone.replace(/\D/g, '');
                    const fullContactPhone = contactPhone.replace(/\D/g, '');
                    return normalizedConvPhone === normalizedContactPhoneForMatch || fullConvPhone === fullContactPhone;
                  });
                  
                  if (contact && contact.tags) {
                    contact.tags.forEach(tag => {
                      // Initialize phone structure if needed
                      if (!tagCounts[fromPhone]) {
                        tagCounts[fromPhone] = {};
                      }
                      
                      // Initialize tag structure if needed
                      if (!tagCounts[fromPhone][tag]) {
                        tagCounts[fromPhone][tag] = { year: 0, month: 0, week: 0 };
                      }
                      
                      // Count messages for this tag
                      if (msgDate >= weekStart) tagCounts[fromPhone][tag].week++;
                      if (msgDate >= monthStart) tagCounts[fromPhone][tag].month++;
                      if (msgDate >= yearStart) tagCounts[fromPhone][tag].year++;
                    });
                  }
                }
              }
            });
          }
        });
        
        // Update the overall counts
        this.messageCounts = {
          week: weekCount,
          month: monthCount,
          year: yearCount
        };
        
        // Update the per-tag counts
        this.tagMessageCounts = tagCounts;
        
        // Update the per-contact counts
        this.contactMessageCounts = contactCounts;
        
        console.log('Loaded message counts:', this.messageCounts);
        console.log('Loaded tag message counts:', this.tagMessageCounts);
        
      } catch (error) {
        console.error('Error loading message counts:', error);
      }
    },

    togglePhoneExpand(phoneId) {
      this.expandedPhoneNumber = this.expandedPhoneNumber === phoneId ? null : phoneId;
      this.selectedInboxItem = null;
      this.selectedConversation = null;
    },

    selectInboxItem(itemId) {
      // Check if this is a phone number item (not a tag filter)
      if (itemId.startsWith('phone_')) {
        // If we're already showing untagged conversations for this phone, toggle it off
        if (this.showUntaggedOnly && this.selectedInboxItem === itemId) {
          this.showUntaggedOnly = false;
          // Clear any tag filters for this phone
          const phoneId = itemId.replace('phone_', '');
          this.selectedTagByPhone = { ...this.selectedTagByPhone, [itemId]: null };
        } else {
          // Set the phone as selected and enable untagged filter
          this.selectedInboxItem = itemId;
          this.showUntaggedOnly = true;
          // Clear any existing tag filters for this phone
          const phoneId = itemId.replace('phone_', '');
          this.selectedTagByPhone = { ...this.selectedTagByPhone, [itemId]: null };
        }
        
        // Load last seen users for all conversations in this phone number
        this.loadLastSeenUsersForPhone(itemId);
      } else {
        // Handle other inbox items (if any)
        this.selectedInboxItem = itemId;
        this.showUntaggedOnly = false;
      }
      this.selectedConversation = null;
    },

    getSelectedPhoneNumber() {
      if (!this.selectedInboxItem) {
        return null;
      }
      
      // Extract phone ID from selectedInboxItem (format: phone_123)
      const phoneId = parseInt(this.selectedInboxItem.replace('phone_', ''));
      return this.currentMatter?.phone_numbers?.find(p => p.id === phoneId);
    },
    
    async selectConversation(conversation) {
      this.selectedConversation = conversation.id;
      
      // Load messages for this conversation using real-time composable
      await this.loadMessagesForConversation(conversation.id);
      
      // Load internal comments count for messages
      await this.loadInternalCommentsCount();
      
      // Mark conversation as read using real-time composable
      await this.realtimeMarkAsRead(conversation.id);
      
      // Auto-scroll to bottom after loading messages
      this.$nextTick(() => {
        const container = this.$refs.messagesContainer;
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      });
      // Open all internal comment threads by default for messages with comments
      this.showingInternalCommentsFor = [];
      if (this.currentChat && this.currentChat.messages) {
        for (const msg of this.currentChat.messages) {
          if (this.getInternalCommentsCount(msg.id) > 0) {
            this.showingInternalCommentsFor.push(msg.id);
            // Load comments for this message
            this.loadInternalComments(msg.id);
          }
        }
      }
      // Load conversation read status for per-message read info
      await this.loadConversationReadStatus(conversation.id);
    },

    async loadCallRecordings(conversationId) {
      try {
        const { data: recordings, error } = await supabase
          .from('call_recordings')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('recorded_at', { ascending: true });

        if (error) throw error;

        // Add call recordings to the current chat
        if (this.currentChat) {
          this.currentChat.callRecordings = recordings || [];
        }
      } catch (error) {
        console.error('Error loading call recordings:', error);
      }
    },
    
    getInitials(name) {
      if (!name) return '';
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2);
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

    formatMessageTime(date) {
      // Handle null, undefined, or invalid dates
      if (!date) {
        return '';
      }
      
      // Convert to Date object if it's a string
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      
      // Check if the date is valid
      if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
        return '';
      }
      
      const now = new Date();
      const diffTime = Math.abs(now - dateObj);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) {
        // Show time for today
        return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (diffDays === 1) {
        // Show "Yesterday" + time for yesterday
        const time = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `Yesterday ${time}`;
      } else if (diffDays < 7) {
        // Show day name + time for this week
        const dayName = dateObj.toLocaleDateString([], { weekday: 'short' });
        const time = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `${dayName} ${time}`;
      } else {
        // Show date + time for older messages
        const date = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
        const time = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `${date} ${time}`;
      }
    },

    formatCompactTime(date) {
      // Handle null, undefined, or invalid dates
      if (!date) {
        return '';
      }
      
      // Convert to Date object if it's a string
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      
      // Check if the date is valid
      if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
        return '';
      }
      
      const now = new Date();
      const diffTime = Math.abs(now - dateObj);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) {
        // Show only time for today
        return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (diffDays === 1) {
        // Show "Yest" for yesterday
        return 'Yest';
      } else if (diffDays < 7) {
        // Show day name for this week
        return dateObj.toLocaleDateString([], { weekday: 'short' });
      } else {
        // Show short date for older messages
        return dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
      }
    },

    toggleConversationView() {
      this.showConversationPreview = !this.showConversationPreview;
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
        const smsResponse = await fetch('https://app.aiworkspace.pro/api/sms/send', {
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
        
        // Refresh message counts after sending
        await this.loadMessageCounts();

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
        
        const response = await fetch('https://app.aiworkspace.pro/api/sms/send', {
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
        
        // Refresh message counts after sending
        await this.loadMessageCounts();
        
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

    // Drag and drop handlers
    handleDragOver(event) {
      event.preventDefault();
      this.isDragOver = true;
    },

    handleDragLeave(event) {
      event.preventDefault();
      // Only set isDragOver to false if we're leaving the entire drop zone
      if (!event.currentTarget.contains(event.relatedTarget)) {
        this.isDragOver = false;
      }
    },

    handleFileDrop(event) {
      event.preventDefault();
      this.isDragOver = false;
      
      const files = event.dataTransfer.files;
      if (files.length === 0) return;
      
      // Handle only the first file (matching existing behavior)
      const file = files[0];
      console.log('🔍 File dropped:', {
        name: file.name,
        type: file.type,
        size: file.size
      });
      
      // Use existing file validation logic
      this.handleFileSelect(file);
    },

    async handlePaste(event) {
      const clipboardData = event.clipboardData || window.clipboardData;
      if (!clipboardData) return;

      const items = clipboardData.items;
      if (!items) return;

      // Look for image items in clipboard
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        if (item.type.indexOf('image') !== -1) {
          event.preventDefault();
          
          const blob = item.getAsFile();
          if (blob) {
            // Create a meaningful filename with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const extension = blob.type.split('/')[1] || 'png';
            const filename = `pasted-image-${timestamp}.${extension}`;
            
            // Create a File object from the blob with a proper name
            const file = new File([blob], filename, {
              type: blob.type,
              lastModified: Date.now()
            });
            
            console.log('📋 Image pasted from clipboard:', {
              name: file.name,
              type: file.type,
              size: file.size
            });
            
            // Use existing file validation logic
            this.handleFileSelect(file);
          }
          break; // Only handle the first image found
        }
      }
    },

    handleMessageInputKeydown(event) {
      // Check if Enter is pressed
      if (event.key === 'Enter') {
        // If Shift is held down, allow default behavior (new line)
        if (event.shiftKey) {
          return; // Allow default textarea behavior for Shift+Enter
        }
        // If just Enter (no Shift), prevent default and send message
        event.preventDefault();
        this.sendMessage();
      }
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
      if (!text) return '';
      
      // First escape HTML, then convert newlines to <br>, then apply search highlighting
      let escapedText = this.escapeHtml(text);
      
      // Convert newlines to <br> tags
      escapedText = escapedText.replace(/\n/g, '<br>');
      
      // Apply search highlighting if there's a search query
      if (this.chatSearchQuery) {
        const query = this.chatSearchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${query})`, 'gi');
        escapedText = escapedText.replace(regex, '<span class="highlight">$1</span>');
      }
      
      return escapedText;
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
    formatDuration(seconds) {
      if (!seconds) return '0:00';
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
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
    getContactName(phoneNumber, searchContactNumber) {
      const contact = this.workspaceContacts.find(c => c.phone_number === phoneNumber || c.phone_number === searchContactNumber.slice(-10));
      return contact ? contact.name : null;
    },

    getContactTags(phoneNumber) {
      const contact = this.workspaceContacts.find(c => c.phone_number === phoneNumber);
      return contact ? contact.tags : [];
    },

    getCurrentContact() {
      if (!this.currentChat) return null;
      return this.workspaceContacts.find(c => c.phone_number === this.currentChat.phoneNumber.slice(-10));
    },

    getContactForConversation(conversation) {
      if (!conversation) return null;
      return this.workspaceContacts.find(c => {
        const convPhone = conversation.phoneNumber || conversation.fromPhoneNumber || conversation.contact || '';
        const contactPhone = c.phone_number || '';
        const normalizedConvPhone = convPhone.replace(/\D/g, '').slice(-10);
        const normalizedContactPhone = contactPhone.replace(/\D/g, '').slice(-10);
        const fullConvPhone = convPhone.replace(/\D/g, '');
        const fullContactPhone = contactPhone.replace(/\D/g, '');
        return normalizedConvPhone === normalizedContactPhone || fullConvPhone === fullContactPhone;
      });
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

    openContactModal(mode) {
      this.contactModalMode = mode;
      if (mode === 'add') {
        // Pre-fill phone number with current chat's number
        const phone = this.currentChat?.contact || '';
        this.contactModalForm = {
          name: '',
          phone_number: phone.replace(/\D/g, '').slice(-10),
          tags: []
        };
      } else if (mode === 'edit') {
        const contact = this.getCurrentContact();
        this.contactModalForm = {
          name: contact.name,
          phone_number: contact.phone_number,
          tags: contact.tags ? [...contact.tags] : []
        };
      }
      this.showContactModal = true;
    },
    async saveContactModal() {
      this.contactModalSaving = true;
      try {
        // Validate name
        if (!this.contactModalForm.name.trim()) {
          this.$message.error('Name is required');
          return;
        }
        // Validate phone number (must be 10 digits)
        const digits = this.contactModalForm.phone_number.replace(/\D/g, '');
        if (digits.length !== 10) {
          this.$message.error('Phone number must be 10 digits');
          return;
        }
        const { data: { user } } = await supabase.auth.getUser();
        if (this.contactModalMode === 'add') {
          // Insert new contact
          const { error } = await supabase.from('contacts').insert([
            {
              name: this.contactModalForm.name.trim(),
              phone_number: digits,
              tags: this.contactModalForm.tags,
              matter_id: this.currentMatter.id,
              created_by: user.id
            }
          ]);
          if (error) throw error;
          this.$message.success('Contact added successfully');
        } else {
          // Edit existing contact
          const contact = this.getCurrentContact();
          const { error } = await supabase.from('contacts').update({
            name: this.contactModalForm.name.trim(),
            phone_number: digits,
            tags: this.contactModalForm.tags
          }).eq('id', contact.id);
          if (error) throw error;
          this.$message.success('Contact updated successfully');
        }
        await this.loadWorkspaceContacts();
        this.showContactModal = false;
      } catch (error) {
        this.$message.error(error.message || 'Failed to save contact');
      } finally {
        this.contactModalSaving = false;
      }
    },
    handleMessageMenuCommand(command, message) {
      if (command === 'details') {
        this.openMessageDetailsDialog(message);
      } else if (command === 'comment-internal') {
        this.toggleInlineInternalComments(message);
      } else if (command === 'upload-before') {
        this.selectedMessageForRecording = message;
        this.callRecordingForm.position = 'before';
        this.showCallRecordingDialog = true;
      } else if (command === 'upload-after') {
        this.selectedMessageForRecording = message;
        this.callRecordingForm.position = 'after';
        this.showCallRecordingDialog = true;
      } else if (command.startsWith('action-')) {
        // Find the action
        const actionId = command.replace('action-', '');
        const action = this.phoneTextActions.find(a => a.id == actionId);
        if (!action) return;
        // POST to the action's post_url with message data
        this.executePhoneTextAction(action, message);
      }
    },
    async executePhoneTextAction(action, message) {
      try {
        // You can customize the payload as needed
        const payload = {
          message_id: message.id,
          text: message.text,
          direction: message.direction,
          timestamp: message.timestamp,
          fromPhoneNumber: message.fromPhoneNumber,
          toPhoneNumber: message.toPhoneNumber,
          status: message.status,
          mediaFiles: message.mediaFiles || [],
          webhookData: message.webhookData || null,
        };
        const response = await fetch(action.post_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || 'Failed to execute action');
        }
        this.$message.success('Action sent successfully!');
      } catch (error) {
        this.$message.error('Failed to execute action: ' + (error.message || error));
      }
    },
    handleCallRecordingSelect(file) {
      this.callRecordingForm.file = file;
      return true;
    },
    closeCallRecordingDialog() {
      this.showCallRecordingDialog = false;
      this.callRecordingForm = {
        position: 'before',
        file: null,
        recordedAt: null
      };
    },
    async uploadCallRecording() {
      if (!this.callRecordingForm.file || !this.selectedMessageForRecording) {
        this.$message.error('Please select a file and ensure a message is selected');
        return;
      }
      this.uploadingCallRecording = true;

      try {
        const fileToUpload = this.callRecordingForm.file;
        const giteaToken = import.meta.env.VITE_GITEA_TOKEN;
        const giteaHost = import.meta.env.VITE_GITEA_HOST;

        // Create unique filename
        const timestamp = Date.now();
        const fileExtension = fileToUpload.name.split('.').pop();
        const baseName = fileToUpload.name.replace(`.${fileExtension}`, '');
        const uniqueName = `call_${timestamp}_${this.callRecordingForm.position}_msg${this.selectedMessageForRecording.id}.${fileExtension}`;
        const uploadPath = `messages/call_recordings/${uniqueName}`;

        // Convert file to base64
        const base64Content = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
          };
          reader.readAsDataURL(fileToUpload);
        });

        // Upload to Gitea
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
              message: `Upload call recording: ${fileToUpload.name}`,
              content: base64Content,
              branch: 'main'
            })
          }
        );

        if (!response.ok) {
          throw new Error('Failed to upload file to Gitea');
        }

        const giteaData = await response.json();
        const publicUrl = this.getAuthenticatedDownloadUrl(giteaData.content.download_url);

        // Get current user
        const { data: { user } } = await supabase.auth.getUser();

        // Store in call_recordings table
        const { data: recording, error } = await supabase
          .from('call_recordings')
          .insert({
            matter_id: this.currentMatter.id,
            conversation_id: this.currentChat.id,
            message_id: this.selectedMessageForRecording.id,
            position: this.callRecordingForm.position,
            filename: fileToUpload.name,
            file_size: fileToUpload.size,
            mime_type: fileToUpload.type,
            gitea_path: giteaData.content.path,
            public_url: publicUrl,
            git_sha: giteaData.content.sha,
            recorded_at: this.callRecordingForm.recordedAt,
            uploaded_by: user.id
          })
          .select()
          .single();

        if (error) throw error;

        // Call backend endpoint for transcript and summary
        this.$message.info('⏳ Generating transcript and summary...');
        let transcript = null;
        let summary = null;
        try {
          const apiRes = await fetch('https://app.aiworkspace.pro/api/transcribe-summary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audioUrl: publicUrl })
          });
          const apiData = await apiRes.json();
          if (!apiRes.ok) throw new Error(apiData.error || 'Failed to generate transcript/summary');
          transcript = apiData.transcript;
          summary = apiData.summary;
        } catch (apiError) {
          this.$message.error('Failed to generate transcript/summary: ' + (apiError.message || apiError));
        }
        // Update the recording with transcript and summary
        if (transcript || summary) {
          const updateData = {};
          if (transcript) updateData.recording_transcript = transcript;
          if (summary) updateData.recording_summary = summary;
          await supabase
            .from('call_recordings')
            .update(updateData)
            .eq('id', recording.id);
        }

        this.closeCallRecordingDialog();
        this.$message.success('Call recording uploaded successfully!');

        // Refresh the conversation to show the new recording
        await this.loadMessagesForConversation(this.currentChat.id);

      } catch (error) {
        console.error('Error uploading call recording:', error);
        this.$message.error(error.message || 'Failed to upload call recording');
      } finally {
        this.uploadingCallRecording = false;
      }
    },
    async loadPhoneTextActions() {
      this.loadingPhoneTextActions = true;
      try {
        if (!this.currentMatter || !this.currentMatter.id) {
          this.phoneTextActions = [];
          return;
        }
        const { data, error } = await supabase
          .from('phone_text_message_actions')
          .select('*')
          .eq('matter_id', this.currentMatter.id)
          .order('created_at', { ascending: true });
        if (error) throw error;
        this.phoneTextActions = data || [];
      } catch (error) {
        this.$message.error('Error loading phone text actions: ' + (error.message || error));
        this.phoneTextActions = [];
      } finally {
        this.loadingPhoneTextActions = false;
      }
    },
    renderMarkdown(text) {
      return marked.parse(text || '');
    },
    openTranscriptDialog(transcript) {
      this.currentTranscript = transcript;
      this.showTranscriptDialog = true;
    },
    closeTranscriptDialog() {
      this.showTranscriptDialog = false;
      this.currentTranscript = '';
    },
    async openContactDetailsPane(phoneNumber, contactName) {
      // Find the contact in workspace contacts
      const contact = this.workspaceContacts.find(c => 
        c.phone_number === contactName || 
        c.phone_number === contactName.slice(-10) ||
        c.phone_number === contactName.replace(/\D/g, '').slice(-10)
      );
      let creatorName = 'Unknown';
      if (contact && contact.created_by) {
        try {
          const { data: userInfo, error } = await supabase
            .rpc('get_user_info_for_matter', {
              user_ids: [contact.created_by],
              matter_id_param: this.currentMatter.id
            });
          if (userInfo && userInfo.length > 0) {
            creatorName = userInfo[0].display_name || userInfo[0].email || 'Unknown';
          }
        } catch (e) {
          // fallback to Unknown
        }
      }
      if (contact) {
        this.selectedContactDetails = { ...contact, creator_name: creatorName };
      } else {
        this.selectedContactDetails = {
          name: contactName || 'Unknown Contact',
          phone_number: phoneNumber.replace(/\D/g, '').slice(-10),
          tags: [],
          creator_name: creatorName
        };
      }
      // Load notes after the pane is shown
      await this.loadContactNotes();
    },
    
    closeContactDetailsPane() {
      this.selectedContactDetails = null;
      this.contactNotes = [];
      this.newNote = '';
    },
    
    editContactFromPane() {
      this.contactModalMode = 'edit';
      this.contactModalForm = {
        name: this.selectedContactDetails.name,
        phone_number: this.selectedContactDetails.phone_number,
        tags: this.selectedContactDetails.tags ? [...this.selectedContactDetails.tags] : []
      };
      this.showContactModal = true;
      this.closeContactDetailsPane();
    },
    
    addContactFromPane() {
      this.contactModalMode = 'add';
      this.contactModalForm = {
        name: this.selectedContactDetails.name,
        phone_number: this.selectedContactDetails.phone_number,
        tags: []
      };
      this.showContactModal = true;
      this.closeContactDetailsPane();
    },
    
    getContactMessageCount() {
      if (!this.selectedContactDetails) return 0;
      
      // Count messages for this contact across all conversations
      const phoneNumber = this.selectedContactDetails.phone_number;
      let count = 0;
      
      this.realtimeConversations.forEach(conv => {
        if (conv.fromPhoneNumber === phoneNumber || 
            conv.fromPhoneNumber === `+1${phoneNumber}` ||
            conv.fromPhoneNumber.slice(-10) === phoneNumber) {
          count += conv.messages ? conv.messages.length : 0;
        }
      });
      
      return count;
    },
    
    getContactLastContact() {
      if (!this.selectedContactDetails) return 'Never';
      
      const phoneNumber = this.selectedContactDetails.phone_number;
      let lastContact = null;
      
      this.realtimeConversations.forEach(conv => {
        if (conv.fromPhoneNumber === phoneNumber || 
            conv.fromPhoneNumber === `+1${phoneNumber}` ||
            conv.fromPhoneNumber.slice(-10) === phoneNumber) {
          if (conv.lastMessageTime) {
            const convTime = new Date(conv.lastMessageTime);
            if (!lastContact || convTime > lastContact) {
              lastContact = convTime;
            }
          }
        }
      });
      
      if (!lastContact) return 'Never';
      
      const now = new Date();
      const diffTime = Math.abs(now - lastContact);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) {
        return 'Today';
      } else if (diffDays === 1) {
        return 'Yesterday';
      } else if (diffDays < 7) {
        return `${diffDays} days ago`;
      } else {
        return lastContact.toLocaleDateString();
      }
    },
    
    composeMessageToContact() {
      this.showNewMessageDialog = true;
      this.resetNewMessageForm();
      this.selectedRecipient = this.selectedContactDetails.phone_number;
      this.closeContactDetailsPane();
    },
    async loadContactNotes() {
      if (!this.currentChat?.id) return;
      
      try {
        const { data: notes, error } = await supabase
          .from('conversation_notes')
          .select('*')
          .eq('conversation_id', this.currentChat.id)
          .eq('archived', false)
          .order('created_at', { ascending: false });

        if (error) throw error;
        this.contactNotes = notes || [];
      } catch (error) {
        console.error('Error loading conversation notes:', error);
        this.$message.error('Error loading notes: ' + error.message);
      }
    },
    
    async saveContactNote() {
      try {
        if (!this.currentChat?.id) {
          this.$message.info('No conversation selected');
          return;
        }

        if (!this.newNote.trim()) return;

        const { data: { user } } = await supabase.auth.getUser();
        
        const { error } = await supabase
          .from('conversation_notes')
          .insert({
            conversation_id: this.currentChat.id,
            note: this.newNote.trim(),
            created_by: user.id
          });

        if (error) throw error;
        
        // Update matter activity
        await updateMatterActivity(this.currentMatter.id);
        
        // Clear input and reload notes
        this.newNote = '';
        await this.loadContactNotes();
        
        this.$message.success('Note added successfully');
      } catch (error) {
        console.error('Error saving note:', error);
        this.$message.error('Error saving note: ' + error.message);
      }
    },

    // Internal Comments Methods
    setHoveredMessage(messageId) {
      this.hoveredMessage = messageId;
    },

    async toggleInlineInternalComments(message) {
      const idx = this.showingInternalCommentsFor.indexOf(message.id);
      if (idx !== -1) {
        // Close this thread
        this.showingInternalCommentsFor.splice(idx, 1);
        delete this.internalCommentsMap[message.id];
      } else {
        // Open this thread
        this.showingInternalCommentsFor.push(message.id);
        await this.loadInternalComments(message.id);
      }
      this.newInternalComment = {};
    },

    closeInternalCommentsDialog() {
      this.showingInternalCommentsFor = [];
      this.selectedMessageForComments = null;
      this.internalCommentsMap = {};
      this.newInternalComment = {};
    },

    async loadInternalComments(messageId) {
      try {
        const { data: comments, error } = await supabase
          .from('message_internal_comments')
          .select(`*`)
          .eq('message_id', messageId)
          .eq('archived', false)
          .order('created_at', { ascending: true });

        if (error) throw error;
        if (!comments || comments.length === 0) {
          this.internalCommentsMap[messageId] = [];
          return;
        }
        // Get unique user IDs from comments
        const userIds = [...new Set(comments.map(c => c.created_by))];
        const { data: userInfo, error: userError } = await supabase
          .rpc('get_user_info_for_matter', {
            user_ids: userIds,
            matter_id_param: this.currentMatter.id
          });
        if (userError) {
          console.error('Error getting user info:', userError);
        }
        const userInfoMap = {};
        (userInfo || []).forEach(user => {
          userInfoMap[user.user_id] = user.display_name;
        });
        const mappedComments = comments.map(comment => {
          const authorName = userInfoMap[comment.created_by] || 'Unknown User';
          return {
            ...comment,
            author_name: authorName
          };
        });
        this.internalCommentsMap[messageId] = mappedComments;
      } catch (error) {
        console.error('Error loading internal comments:', error);
        this.$message.error('Error loading comments: ' + error.message);
      }
    },

    async addInternalComment(messageId) {
      if (!this.newInternalComment[messageId]?.trim()) return;
      this.addingComment[messageId] = true;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: comment, error } = await supabase
          .from('message_internal_comments')
          .insert({
            message_id: messageId,
            content: this.newInternalComment[messageId].trim(),
            matter_id: this.currentMatter.id,
            conversation_id: this.currentChat.id,
            created_by: user.id
          })
          .select('*')
          .single();
        if (error) throw error;
        const userDisplayName = user.email?.split('@')[0] || 'You';
        const newComment = {
          ...comment,
          author_name: userDisplayName
        };
        if (!this.internalCommentsMap[messageId]) {
          this.internalCommentsMap[messageId] = [];
        }
        this.internalCommentsMap[messageId].push(newComment);
        this.messageInternalComments[messageId] = (this.messageInternalComments[messageId] || 0) + 1;
        this.$forceUpdate();
        this.newInternalComment[messageId] = '';
        await updateMatterActivity(this.currentMatter.id);
        this.$message.success('Internal comment added successfully');
        await this.loadInternalComments(messageId);
      } catch (error) {
        console.error('Error adding internal comment:', error);
        this.$message.error('Error adding comment: ' + error.message);
      } finally {
        this.addingComment[messageId] = false;
      }
    },

    getInternalCommentsCount(messageId) {
      return this.messageInternalComments[messageId] || 0;
    },

    async loadInternalCommentsCount() {
      if (!this.currentChat?.messages) return;

      try {
        // Get all message IDs for the current conversation
        const messageIds = this.currentChat.messages.map(m => m.id);
        
        if (messageIds.length === 0) return;

        const { data: counts, error } = await supabase
          .from('message_internal_comments')
          .select('message_id')
          .in('message_id', messageIds)
          .eq('archived', false);

        if (error) throw error;

        // Count comments per message
        const commentsCount = {};
        counts.forEach(comment => {
          commentsCount[comment.message_id] = (commentsCount[comment.message_id] || 0) + 1;
        });

        this.messageInternalComments = commentsCount;

      } catch (error) {
        console.error('Error loading internal comments count:', error);
      }
    },
    togglePhoneTagsExpand(phoneId) {
      this.expandedPhoneForTags = this.expandedPhoneForTags === phoneId ? null : phoneId;
    },
    
    async togglePhoneTagFilter(phoneId, tag) {
      console.log('togglePhoneTagFilter called with:', phoneId, tag);
      console.log('Current selectedTagByPhone:', this.selectedTagByPhone);
      
      try {
        if (this.selectedTagByPhone[phoneId] === tag) {
          // Clicking the same tag again clears the filter
          console.log('Clearing filter for phone:', phoneId);
          this.selectedTagByPhone = { ...this.selectedTagByPhone, [phoneId]: null };
        } else {
          // Setting new filter
          console.log('Setting filter for phone:', phoneId, 'to tag:', tag);
          this.selectedTagByPhone = { ...this.selectedTagByPhone, [phoneId]: tag };
          // Clear untagged filter when a tag is selected
          this.showUntaggedOnly = false;
        }
        
        // Force reactivity update
        await this.$nextTick();
        console.log('Updated selectedTagByPhone:', this.selectedTagByPhone);
      } catch (error) {
        console.error('Error in togglePhoneTagFilter:', error);
      }
    },
    formatPhone(phone) {
      if (!phone) return '';
      const digits = phone.replace(/\D/g, '');
      if (digits.length === 10) {
        return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
      }
      return phone;
    },
    startEditContact(field = null) {
      this.editingField = field;
      if (field) {
        this.editableContact = { ...this.selectedContactDetails };
        this.$nextTick(() => {
          const refName = field + 'Input';
          if (this.$refs[refName] && this.$refs[refName].focus) {
            this.$refs[refName].focus();
          }
        });
      }
    },
    cancelEditContact() {
      this.editingField = null;
      this.editableContact = {};
    },
    async saveEditContact(field = null) {
      if (!field) return;
      if (!this.selectedContactDetails) return;

      // If no id, insert instead of update
      if (!this.selectedContactDetails.id) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          // Remove creator_name if present
          const contactToInsert = { ...this.editableContact };
          delete contactToInsert.creator_name;
          const { data, error } = await supabase
            .from('contacts')
            .insert({
              ...contactToInsert,
              matter_id: this.currentMatter.id,
              created_by: user.id
            })
            .select()
            .single();
          if (error) throw error;
          this.$message.success('Contact created successfully');
          await this.loadWorkspaceContacts();
          this.selectedContactDetails = data;
          this.editingField = null;
        } catch (error) {
          this.$message.error(error.message || 'Failed to create contact');
        }
        return;
      }

      // Only update the specific field
      const updateFields = {};
      updateFields[field] = this.editableContact[field];
      try {
        const { error } = await supabase
          .from('contacts')
          .update(updateFields)
          .eq('id', this.selectedContactDetails.id);
        if (error) throw error;
        this.$message.success('Contact updated successfully');
        await this.loadWorkspaceContacts();
        // Update selectedContactDetails to reflect the latest data
        if (this.selectedContactDetails && this.selectedContactDetails.id) {
          const updated = this.workspaceContacts.find(c => c.id === this.selectedContactDetails.id);
          if (updated) this.selectedContactDetails = { ...updated, creator_name: this.selectedContactDetails.creator_name };
        }
        this.editingField = null;
      } catch (error) {
        this.$message.error(error.message || 'Failed to save contact');
      }
    },
    handleAvatarUpload(file) {
      // Implement avatar upload logic or use a placeholder for now
      // For now, just convert to base64 and preview
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => {
          this.editableContact.profile_picture_url = e.target.result;
          resolve(false); // Prevent auto upload
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    },

    // AI Check Message Methods
    async checkMessageWithAI() {
      if (!this.newMessage.trim()) {
        this.$message.warning('Please enter a message to check');
        return;
      }

      this.aiCheckOriginalMessage = this.newMessage;
      this.checkingMessageWithAI = true;
      this.aiCheckResult = null;
      this.editableImprovedMessage = '';
      
      // Load recent conversation messages for context
      if (this.currentChat && this.currentChat.messages && this.currentChat.messages.length > 0) {
        this.recentConversationMessages = this.currentChat.messages.slice(-3); // Show last 5 messages
      } else {
        this.recentConversationMessages = [];
      }
      
      this.showAICheckDialog = true;
      this.aiCheckDebugData = null;
      this.showAICheckDebug = false;

      try {
        const apiUrl = window.location.hostname === 'localhost' 
          ? 'https://app-aiworkspace-pro-2025-06-25.vercel.app/api/ai-check-message'
          : '/api/ai-check-message';

        const requestData = {
          message: this.newMessage
        };

        // Store debug data - request
        this.aiCheckDebugData = {
          apiUrl,
          requestData,
          timestamp: new Date().toISOString(),
          response: null,
          error: null
        };

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestData)
        });

        const result = await response.json();

        // Store debug data - response
        this.aiCheckDebugData.response = {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: result
        };

        if (!response.ok) {
          throw new Error(result.error || 'Failed to check message with AI');
        }

        this.aiCheckResult = result;
        this.editableImprovedMessage = result.improvedMessage || this.newMessage;

      } catch (error) {
        console.error('Error checking message with AI:', error);
        this.aiCheckDebugData.error = {
          message: error.message,
          stack: error.stack
        };
        this.$message.error(error.message || 'Failed to check message with AI');
        this.closeAICheckDialog();
      } finally {
        this.checkingMessageWithAI = false;
      }
    },

    async checkNewMessageWithAI() {
      if (!this.newMessageForm.message.trim()) {
        this.$message.warning('Please enter a message to check');
        return;
      }

      this.aiCheckOriginalMessage = this.newMessageForm.message;
      this.checkingMessageWithAI = true;
      this.aiCheckResult = null;
      this.editableImprovedMessage = '';
      
      // Load recent conversation messages for context
      // Note: For new message dialog, we may not have currentChat, so we try to get recent conversations
      if (this.currentChat && this.currentChat.messages && this.currentChat.messages.length > 0) {
        this.recentConversationMessages = this.currentChat.messages.slice(-3); // Show last 5 messages
      } else if (this.realtimeConversations && this.realtimeConversations.length > 0) {
        // If no specific chat is selected, try to get messages from the most recent conversation
        const recentConv = this.realtimeConversations[0];
        if (recentConv && recentConv.messages && recentConv.messages.length > 0) {
          this.recentConversationMessages = recentConv.messages.slice(-3);
        } else {
          this.recentConversationMessages = [];
        }
      } else {
        this.recentConversationMessages = [];
      }
      
      this.showAICheckDialog = true;
      this.aiCheckDebugData = null;
      this.showAICheckDebug = false;

      try {
        const apiUrl = window.location.hostname === 'localhost' 
          ? 'https://app-aiworkspace-pro-2025-06-25.vercel.app/api/ai-check-message'
          : '/api/ai-check-message';

        const requestData = {
          message: this.newMessageForm.message
        };

        // Store debug data - request
        this.aiCheckDebugData = {
          apiUrl,
          requestData,
          timestamp: new Date().toISOString(),
          response: null,
          error: null
        };
          
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestData)
        });

        const result = await response.json();

        // Store debug data - response
        this.aiCheckDebugData.response = {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: result
        };

        if (!response.ok) {
          throw new Error(result.error || 'Failed to check message with AI');
        }

        this.aiCheckResult = result;
        this.editableImprovedMessage = result.improvedMessage || this.newMessageForm.message;

      } catch (error) {
        console.error('Error checking message with AI:', error);
        this.aiCheckDebugData.error = {
          message: error.message,
          stack: error.stack
        };
        this.$message.error(error.message || 'Failed to check message with AI');
        this.closeAICheckDialog();
      } finally {
        this.checkingMessageWithAI = false;
      }
    },

    closeAICheckDialog() {
      this.showAICheckDialog = false;
      this.checkingMessageWithAI = false;
      this.aiCheckOriginalMessage = '';
      this.aiCheckResult = null;
      this.editableImprovedMessage = '';
      this.recentConversationMessages = [];
      this.showAICheckDebug = false;
      this.aiCheckDebugData = null;
    },

    useImprovedMessage() {
      if (this.editableImprovedMessage.trim()) {
        // Check if we're updating the main message or new message dialog
        if (this.aiCheckOriginalMessage === this.newMessage) {
          // Main message input
          this.newMessage = this.editableImprovedMessage.trim();
          this.closeAICheckDialog();
          this.$message.success('Message updated with AI suggestions');
          
          // Focus back on the textarea
          this.$nextTick(() => {
            const textarea = this.$el.querySelector('.message-input-area textarea');
            if (textarea) {
              textarea.focus();
            }
          });
        } else if (this.aiCheckOriginalMessage === this.newMessageForm.message) {
          // New message dialog
          this.newMessageForm.message = this.editableImprovedMessage.trim();
          this.closeAICheckDialog();
          this.$message.success('Message updated with AI suggestions');
          
          // Focus back on the new message textarea
          this.$nextTick(() => {
            const textarea = this.$el.querySelector('.el-dialog textarea');
            if (textarea) {
              textarea.focus();
            }
          });
        }
      } else {
        this.$message.warning('Please enter a valid message');
      }
    },

    getSuggestionTagType(type) {
      const typeMap = {
        'grammar': 'danger',
        'spelling': 'warning',
        'clarity': 'info',
        'tone': 'success'
      };
      return typeMap[type] || 'info';
    },

    // AI Draft Message Methods
    async draftMessageWithAI() {
      if (!this.currentChat || !this.currentChat.messages || this.currentChat.messages.length === 0) {
        this.$message.warning('No conversation found to analyze');
        return;
      }

      this.draftingMessageWithAI = true;
      this.aiDraftResult = null;
      this.editableDraftMessage = '';
      this.recentConversationMessages = this.currentChat.messages.slice(-3); // Show last 5 messages
      this.showAIDraftDialog = true;
      this.aiDraftDebugData = null;
      this.showAIDraftDebug = false;

      try {
        const apiUrl = window.location.hostname === 'localhost' 
          ? 'https://app-aiworkspace-pro-2025-06-25.vercel.app/api/ai-draft-message'
          : '/api/ai-draft-message';

        const requestData = {
          conversation: this.currentChat.messages,
          contactName: this.getCurrentContactName() || this.currentChat.contact || 'Contact',
          context: 'This is a professional legal/business communication.'
        };

        // Store debug data - request
        this.aiDraftDebugData = {
          apiUrl,
          requestData,
          timestamp: new Date().toISOString(),
          response: null,
          error: null
        };

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestData)
        });

        const result = await response.json();

        // Store debug data - response
        this.aiDraftDebugData.response = {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: result
        };

        if (!response.ok) {
          throw new Error(result.error || 'Failed to draft message with AI');
        }

        this.aiDraftResult = result;
        this.editableDraftMessage = result.suggestedMessage || '';

      } catch (error) {
        console.error('Error drafting message with AI:', error);
        this.aiDraftDebugData.error = {
          message: error.message,
          stack: error.stack
        };
        this.$message.error(error.message || 'Failed to draft message with AI');
        this.closeAIDraftDialog();
      } finally {
        this.draftingMessageWithAI = false;
      }
    },

    closeAIDraftDialog() {
      this.showAIDraftDialog = false;
      this.draftingMessageWithAI = false;
      this.aiDraftResult = null;
      this.editableDraftMessage = '';
      this.recentConversationMessages = [];
      this.showAIDraftDebug = false;
      this.aiDraftDebugData = null;
    },

    useDraftMessage() {
      if (this.editableDraftMessage.trim()) {
        this.newMessage = this.editableDraftMessage.trim();
        this.closeAIDraftDialog();
        this.$message.success('AI-drafted message added to input');
        
        // Focus back on the textarea
        this.$nextTick(() => {
          const textarea = this.$el.querySelector('.message-input-area textarea');
          if (textarea) {
            textarea.focus();
          }
        });
      } else {
        this.$message.warning('Please enter a valid message');
      }
    },

    async useDraftAndSend() {
      if (this.editableDraftMessage.trim()) {
        this.newMessage = this.editableDraftMessage.trim();
        this.closeAIDraftDialog();
        
        // Send the message immediately
        await this.$nextTick();
        await this.sendMessage();
      } else {
        this.$message.warning('Please enter a valid message');
      }
    },

    selectAlternative(alternative) {
      this.editableDraftMessage = alternative;
      this.$message.info('Alternative selected');
    },

    getCurrentContactName() {
      if (!this.currentChat) return null;
      const contact = this.getContactForConversation(this.currentChat);
      return contact ? contact.name : null;
    },

    getToneTagType(tone) {
      const toneMap = {
        'professional': 'info',
        'friendly': 'success',
        'formal': 'warning',
        'casual': 'primary'
      };
      return toneMap[tone] || 'info';
    },
    
    handleContactFieldKeydown(event, field) {
      if (event.key === 'Enter') {
        this.saveEditContact(field);
      } else if (event.key === 'Escape') {
        this.cancelEditContact();
      }
    },
    
    // Siple and reliable focus method
    focusInputField(fieldName) {
      // Add a small delay to ensure DOM is fully rendered
      setTimeout(() => {
        console.log('Attempting to focus field:', fieldName);
        
        // Method 1: Try using refs
        const refName = `${fieldName}Input`;
        const inputRef = this.$refs[refName];
        
        if (inputRef) {
          const element = Array.isArray(inputRef) ? inputRef[0] : inputRef;
          if (element) {
            // Try Element Plus component's focus method
            if (element.focus && typeof element.focus === 'function') {
              element.focus();
              console.log('Successfully focused using component method:', fieldName);
              return;
            }
            
            // Try to find the inner input element
            const inputElement = element.$el ? element.$el.querySelector('input') : element;
            if (inputElement) {
              inputElement.focus();
              console.log('Successfully focused using inner input:', fieldName);
              return;
            }
          }
        }
        
        // Method 2: Try using querySelector with ref attribute
        const selector = `[ref="${refName}"] input`;
        const inputElement = document.querySelector(selector);
        if (inputElement) {
          inputElement.focus();
          console.log('Successfully focused using querySelector:', fieldName);
          return;
        }
        
        // Method 3: Try using a more generic selector
        const genericSelector = `input[placeholder*="${fieldName}"], input[aria-label*="${fieldName}"]`;
        const genericElement = document.querySelector(genericSelector);
        if (genericElement) {
          genericElement.focus();
          console.log('Successfully focused using generic selector:', fieldName);
          return;
        }
        
        console.log('Could not focus field:', fieldName);
      }, 50); // 50ms delay
    },
    loadLastSeenUsers(conversationId) {
      this.loadingLastSeen[conversationId] = true;
      
      // First get the conversation read status
      supabase
        .from('conversation_read_status')
        .select('user_id, last_read_at')
        .eq('conversation_id', conversationId)
        .order('last_read_at', { ascending: false })
        .then(async ({ data: readStatus, error }) => {
          if (error) throw error;
          
          if (readStatus && readStatus.length > 0) {
            // Get user IDs from read status
            const userIds = readStatus.map(status => status.user_id);
            
            // Get user information using the function
            const { data: userInfo, error: userError } = await supabase
              .rpc('get_user_info_for_matter', {
                user_ids: userIds,
                matter_id_param: this.currentMatter.id
              });
            
            if (userError) throw userError;
            
            // Combine user info with read status
            const lastSeenData = readStatus.map(status => {
              const user = userInfo.find(u => u.user_id === status.user_id);
              return {
                user_id: status.user_id,
                display_name: user ? user.display_name : 'Unknown User',
                last_read_at: status.last_read_at
              };
            });
            
            this.lastSeenUsers[conversationId] = lastSeenData;
          } else {
            this.lastSeenUsers[conversationId] = [];
          }
          
          this.loadingLastSeen[conversationId] = false;
        })
        .catch(error => {
          console.error('Error loading last seen users:', error);
          this.loadingLastSeen[conversationId] = false;
        });
    },
    
    loadLastSeenUsersForPhone(phoneItemId) {
      // Get the phone number from the item ID
      const phoneId = phoneItemId.replace('phone_', '');
      const phone = this.currentMatter?.phone_numbers?.find(p => p.id.toString() === phoneId);
      
      if (!phone) return;
      
      // Get all conversations for this phone number
      const phoneConversations = this.realtimeConversations.filter(conv => conv.fromPhoneNumber === phone.number);
      
      // Load last seen users for each conversation
      phoneConversations.forEach(conversation => {
        this.loadLastSeenUsers(conversation.id);
      });
    },
    formatLastSeenTime(lastReadAt) {
      if (!lastReadAt) return 'Never';
      
      // Convert to Date object if it's a string
      const dateObj = typeof lastReadAt === 'string' ? new Date(lastReadAt) : lastReadAt;
      
      // Check if the date is valid
      if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
        return 'Never';
      }
      
      // Get the time string (hour:minute AM/PM)
      const timeStr = dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      
      // Get the offset in minutes
      const offsetMin = -dateObj.getTimezoneOffset();
      
      // Determine timezone abbreviation
      let timezoneAbbr = 'IST'; // Default
      if (offsetMin === 330) {
        timezoneAbbr = 'IST';
      } else if (offsetMin === -420) {
        timezoneAbbr = 'PDT';
      } else if (offsetMin === -480) {
        timezoneAbbr = 'PST';
      } else if (offsetMin <= -420 && offsetMin >= -480) {
        timezoneAbbr = 'PST';
      }
      
      // Format date with ordinal suffix
      const day = dateObj.getDate();
      const suffix = this.getOrdinalSuffix(day);
      const dayWithSuffix = day + suffix;
      
      // Format the full date string
      const month = dateObj.toLocaleDateString(undefined, { month: 'long' });
      const year = dateObj.getFullYear();
      
      return `${month} ${dayWithSuffix}, ${year} at ${timeStr} ${timezoneAbbr}`;
    },
    
    getOrdinalSuffix(day) {
      if (day > 3 && day < 21) return 'th';
      switch (day % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
      }
    },
    async loadConversationReadStatus(conversationId) {
      // Load conversation_read_status and user display names
      const { data: readStatus, error } = await supabase
        .from('conversation_read_status')
        .select('user_id, last_read_at')
        .eq('conversation_id', conversationId);
      if (error) {
        console.error('Error loading read status:', error);
        this.conversationReadStatus = [];
        return;
      }
      if (!readStatus.length) {
        this.conversationReadStatus = [];
        return;
      }
      // Get user info for display names
      const userIds = readStatus.map(r => r.user_id);
      const { data: userInfo, error: userError } = await supabase
        .rpc('get_user_info_for_matter', {
          user_ids: userIds,
          matter_id_param: this.currentMatter.id
        });
      const userInfoMap = {};
      (userInfo || []).forEach(user => {
        userInfoMap[user.user_id] = user.display_name;
      });
      this.conversationReadStatus = readStatus.map(r => ({
        ...r,
        display_name: userInfoMap[r.user_id] || 'Unknown User'
      }));
    },
    usersWhoHaveSeenMessage(message) {
      // Returns array of { user_id, display_name }
      return this.conversationReadStatus.filter(status => {
        return new Date(status.last_read_at) >= new Date(message.timestamp);
      });
    },
  }
};
</script>

<style scoped>
.ai-phone-interface {
  height: 85vh;
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
  width: 15%;
  height: 100%;
  background: white;
  border-right: 1px solid #e0e0e0;
}

/* Middle Panel - Conversations (35% width) */
.chats-panel {
  width: 25%;
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

/* Fourth Panel: Contact Details */
.contact-details-panel {
  width: 15%;
  height: 100%;
  background: white;
  border-left: 1px solid #e0e0e0;
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
  font-size: 1.2rem;
  font-weight: 400;
  color: #555557;
}

.item-label {
  color: #555557;
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

.phone-item {
  margin-bottom: 2px;
}

.inbox-item {
  position: relative;
  padding: 0.75rem 1rem;
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  transition: all 0.3s;
}

.inbox-item:hover {
  background: #f5f5f5;
}

.inbox-item.expanded {
  background: #e3f2fd;
}

.inbox-item.active {
  background: #e3f2fd;
}

.item-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

.expand-icon {
  transition: transform 0.3s;
}

.expanded .expand-icon {
  transform: rotate(180deg);
}

.folders-collapse {
  background: #f8f9fa;
  border-left: 3px solid #1976d2;
}

.folder-item {
  padding: 0.6rem 1rem 0.6rem 2rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  transition: all 0.3s;
}

.folder-item:hover {
  background: #f0f0f0;
}

.folder-item.active {
  background: #e3f2fd;
}

.folder-label {
  flex: 1;
  font-size: 0.9rem;
}

.count-badge {
  background: #1976d2;
  color: white;
  border-radius: 12px;
  padding: 2px 8px;
  font-size: 0.75rem;
  min-width: 20px;
  text-align: center;
}

.folder-item .count-badge {
  background: #909399;
}

.folder-item.active .count-badge {
  background: #1976d2;
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

.tag-filter-input {
  margin-top: 0.5rem;
  width: 100%;
}

.tag-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.tag-option .el-icon {
  color: #1976d2;
  font-size: 14px;
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
  overflow: hidden;
}

.avatar-circle .avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

.avatar-circle .el-icon {
  font-size: 24px;
}

.unread-indicator {
  position: absolute;
  height: 100%;
  border-left: 1px solid #e0e0e0;
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
  gap: -1rem;
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
  overflow: hidden;
}

.contact-avatar .avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
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
  max-height: calc(80vh - 150px);
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
  position: relative; /* Ensure relative positioning for absolute children */
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

.message-input-area {
  padding: 1rem;
  border-top: 1px solid #e0e0e0;
  background: white;
  transition: all 0.2s ease;
  position: relative; /* Remove focus outline since this is primarily for paste events */
}

.message-input-area.drag-over {
  background: #f0f9ff;
  border-color: #409efc;
}

.message-input-area.drag-over::before {
  content: '📎 Drop image here to attach';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(64, 158, 252, 0.1);
  border: 2px dashed #409efc;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  font-weight: 500;
  color: #409efc;
  z-index: 10;
  pointer-events: none;
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
  gap: 0.1rem;
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
  top: 2px;
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
  color: #555557db;
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

/* Add to existing styles */
.conversation-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  opacity: 0; /* Start hidden */
  transition: opacity 0.2s ease;
}

.conversation-item:hover .conversation-actions {
  opacity: 1; /* Show on hover */
}

.action-icon {
  cursor: pointer;
  color: #606266;
  font-size: 16px;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-icon:hover {
  color: #409EFF;
  background: rgba(64, 158, 255, 0.1);
}

/* Make sure icons are visible in active state */
.conversation-item.active .conversation-actions {
  opacity: 1;
}

/* Ensure the time is always visible */
.conversation-actions .time {
  opacity: 1;
  margin-left: 4px;
}

.inbox-item.folder {
  border-left: 3px solid #409EFF;
}

.inbox-item.folder .count-badge {
  background: #909399;
}

.inbox-item.folder.active .count-badge {
  background: #409EFF;
}

/* Call Recording Styles */
.call-recording-item {
  margin-bottom: 1rem;
  display: flex;
  justify-content: center;
}

.message.recording {
  margin-bottom: 1rem;
  display: flex;
}

.message.recording.outbound {
  justify-content: flex-end;
}

.message.recording.inbound {
  justify-content: flex-start;
}

.call-recording-content {
  width: 70%;
  padding: 1rem;
  border-radius: 1rem;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  position: relative;
}

.message.outbound .call-recording-content {
  background: #1976d2;
  color: white;
  border-bottom-right-radius: 0.25rem;
}

.message.inbound .call-recording-content {
  background: white;
  color: #333;
  border: 1px solid #e0e0e0;
  border-bottom-left-radius: 0.25rem;
}

.call-recording-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.call-icon {
  color: #1976d2;
  font-size: 1.2rem;
}

.message.outbound .call-icon {
  color: white;
}

.call-title {
  font-weight: 600;
  color: #333;
  flex: 1;
}

.message.outbound .call-title {
  color: white;
}

.call-recording-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
  color: #666;
  margin-bottom: 0.5rem;
}

.message.outbound .call-recording-info {
  color: rgba(255, 255, 255, 0.8);
}

.call-size {
  color: #666;
}

.message.outbound .call-size {
  color: rgba(255, 255, 255, 0.8);
}

.call-date {
  color: #666;
}

.message.outbound .call-date {
  color: rgba(255, 255, 255, 0.8);
}

.call-duration {
  background: #1976d2;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 500;
}

.call-recording-player {
  margin-bottom: 0.75rem;
}

.audio-player {
  width: 100%;
  height: 40px;
  border-radius: 8px;
}

.call-transcript,
.call-summary {
  margin-top: 0.75rem;
  padding: 0.75rem;
  background: white;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}

.call-summary {
  color: black;
  font-size: 12px;
}
.call-transcript h4,
.call-summary h4 {
  margin: 0 0 0.5rem 0;
  color: #333;
  font-size: 0.9rem;
  font-weight: 600;
}

.call-transcript p,
.call-summary p {
  margin: 0;
  color: #666;
  font-size: 0.85rem;
  line-height: 1.4;
}

/* File info styles for upload dialog */
.file-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: #f5f5f5;
  border-radius: 4px;
}

.file-info .el-icon {
  color: #666;
}

.file-info .file-size {
  color: #666;
  font-size: 0.8rem;
}

.transcript-link {
  font-size: 12px;
  color: #888;
  cursor: pointer;
  margin-left: 8px;
}

.call-summary-collapse {
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
  padding: 5px;
}

.transcript-modal-content {
  max-height: 400px;
  overflow-y: auto;
  font-family: 'Menlo', 'Monaco', 'Consolas', monospace;
  font-size: 15px;
  background: #fafbfc;
  padding: 8px 0;
}
.transcript-line {
  display: flex;
  align-items: flex-start;
  margin-bottom: 6px;
  line-height: 1.5;
}
.transcript-timestamp {
  color: #888;
  min-width: 48px;
  margin-right: 8px;
  font-size: 13px;
  flex-shrink: 0;
}
.transcript-speaker {
  font-weight: bold;
  color: #333;
  margin-right: 6px;
  min-width: 110px;
  flex-shrink: 0;
}
.transcript-text {
  color: #222;
  word-break: break-word;
  flex: 1;
}

@keyframes slideInRight {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

/* Internal Comments Styles */
.internal-comment-icon {
  position: absolute;
  top: 8px;
  right: 40px;
  cursor: pointer;
  color: #888;
  font-size: 1rem;
  z-index: 3;
  transition: all 0.2s ease;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  padding: 4px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.internal-comment-icon:hover {
  color: #1976d2;
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transform: scale(1.1);
}

.internal-comments-indicator {
  position: absolute;
  top: -8px;
  right: -8px;
  background: #1976d2;
  color: white;
  border-radius: 12px;
  padding: 2px 6px;
  font-size: 0.7rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 20px;
  z-index: 4;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: all 0.2s ease;
}

.internal-comments-indicator:hover {
  background: #1565c0;
  transform: scale(1.05);
}

.comments-count {
  font-weight: 600;
  line-height: 1;
}

.internal-comments-content {
  max-height: 70vh;
  display: flex;
  flex-direction: column;
}

.original-message-context {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
  border-left: 4px solid #1976d2;
}

.context-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.context-header h4 {
  margin: 0;
  color: #333;
  font-size: 0.9rem;
  font-weight: 600;
}

.message-timestamp {
  color: #666;
  font-size: 0.75rem;
}

.context-message {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.message-direction {
  display: flex;
  align-items: center;
}

.context-message .message-text {
  margin: 0;
  color: #333;
  background: white;
  padding: 0.75rem;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
  font-size: 0.9rem;
  line-height: 1.4;
}

.internal-comments-list {
  flex: 1;
  max-height: 300px;
  overflow-y: auto;
  margin-bottom: 1rem;
  padding-right: 8px;
}

.no-comments {
  text-align: center;
  color: #666;
  padding: 2rem 1rem;
}

.no-comments-icon {
  font-size: 2rem;
  color: #ccc;
  margin-bottom: 0.5rem;
}

.no-comments p {
  margin: 0;
  font-style: italic;
}

.internal-comment-item {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 0.75rem;
  margin-bottom: 0.75rem;
  transition: all 0.2s ease;
}

.internal-comment-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-color: #1976d2;
}

.comment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.comment-author {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #1976d2;
  font-weight: 500;
  font-size: 0.85rem;
}

.comment-author .el-icon {
  font-size: 0.9rem;
}

.author-name {
  color: #333;
}

.comment-time {
  color: #666;
  font-size: 0.75rem;
}

.comment-content {
  color: #333;
  line-height: 1.4;
}

.comment-content p {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.add-comment-section {
  border-top: 1px solid #e0e0e0;
  padding-top: 1rem;
}

.comment-input {
  margin-bottom: 0.75rem;
}

.comment-input :deep(.el-textarea__inner) {
  border-radius: 8px;
  border: 1px solid #e0e0e0;
  padding: 0.75rem;
  resize: none;
  font-family: inherit;
}

.comment-input :deep(.el-textarea__inner:focus) {
  border-color: #1976d2;
  box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.1);
}

.comment-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

/* Custom scrollbar for comments list */
.internal-comments-list::-webkit-scrollbar {
  width: 6px;
}

.internal-comments-list::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.internal-comments-list::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.internal-comments-list::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* Message statistics styling */
.message-stats {
  padding: 6px 0;
  border-top: 1px solid #f0f0f0;
}

.stat-line {
  margin: 2px 0;
  color: #999;
  font-size: 0.75rem;
  line-height: 1.2;
}

/* Responsive adjustments for internal comments */
@media (max-width: 768px) {
  .internal-comments-content {
    max-height: 60vh;
  }
  
  .internal-comments-list {
    max-height: 200px;
  }
  
  .comment-actions {
    flex-direction: column;
  }
  
  .comment-actions .el-button {
    width: 100%;
  }
}

.contact-details-content {
  flex: 1;
  padding: 1rem;
  overflow-y: auto;
}

.contact-full-details {
  text-align: center;
  padding: 1rem 0;
}

.contact-avatar-large {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: #1976d2;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1.5rem auto;
  font-size: 2rem;
}

.contact-name-large {
  font-size: 1.5rem;
  font-weight: 600;
  color: #333;
  margin-bottom: 0.5rem;
}

.contact-phone-large {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-size: 1rem;
  color: #666;
  margin-bottom: 1.5rem;
}

.contact-phone-large .el-icon {
  color: #1976d2;
}

.contact-tags-section,
.contact-actions-section,
.contact-stats-section {
  margin-bottom: 2rem;
  text-align: left;
}

.contact-tags-section h4,
.contact-actions-section h4,
.contact-stats-section h4 {
  font-size: 0.9rem;
  font-weight: 600;
  color: #666;
  margin-bottom: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.contact-tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.contact-tags-list .el-tag {
  margin: 0;
}

.contact-actions-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.contact-actions-list .el-button {
  width: 100%;
  justify-content: flex-start;
}

.contact-stats {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.stat-label {
  font-weight: 500;
  color: #666;
  font-size: 0.9rem;
}

.stat-value {
  font-weight: 600;
  color: #333;
  font-size: 1rem;
}

.no-contact-found {
  text-align: center;
  padding: 2rem 1rem;
  color: #666;
}

.no-contact-found .large-icon {
  font-size: 3rem;
  color: #ccc;
  margin-bottom: 1rem;
}

.no-contact-found h3 {
  margin: 0 0 0.5rem 0;
  color: #333;
}

.no-contact-found p {
  margin: 0 0 1.5rem 0;
  font-size: 0.9rem;
}

.close-btn {
  background: transparent;
  border: none;
  color: #666;
  transition: color 0.2s ease;
}

.close-btn:hover {
  color: #333;
  background: #f5f5f5;
}

/* Responsive adjustments for contact details panel */
@media (max-width: 768px) {
  .contact-details-panel {
    width: 100%;
    height: 100%;
  }
  
  .contact-actions-list {
    flex-direction: row;
    flex-wrap: wrap;
  }
  
  .contact-actions-list .el-button {
    width: auto;
    flex: 1;
    min-width: 120px;
  }
}

/* Clickable Contact Name Styles */
.clickable-contact-name {
  cursor: pointer;
  color: #1976d2;
  text-decoration: underline;
  transition: color 0.2s ease;
}

.clickable-contact-name:hover {
  color: #1565c0;
  text-decoration: none;
}

.contact-notes-section {
  margin-bottom: 2rem;
  text-align: left;
  padding: 0 1rem;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.notes-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.notes-header h4 {
  font-size: 0.9rem;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0;
}

.notes-content {
  flex: 1;
  background: #f8f9fa;
  border-radius: 8px 8px 0 0;
  border: 1px solid #e9ecef;
  border-bottom: none;
  overflow-y: auto;
  padding: 1rem;
}

.notes-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.note-item {
  background: white;
  border-radius: 8px;
  padding: 0.75rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.note-header {
  margin-bottom: 0.5rem;
  color: #666;
  font-size: 0.8rem;
}

.note-text {
  color: #333;
  white-space: pre-wrap;
  word-break: break-word;
}

.no-notes {
  color: #666;
  text-align: center;
  padding: 2rem;
}

.notes-input-section {
  display: flex;
  gap: 0.5rem;
  padding: 1rem;
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 0 0 8px 8px;
}

.note-input {
  flex: 1;
}

.note-input :deep(.el-textarea__inner) {
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 0.75rem;
  resize: none;
}

.note-input :deep(.el-textarea__inner:focus) {
  box-shadow: none;
  border-color: #409eff;
}

.save-note-btn {
  align-self: flex-end;
}

.conversation-labels-row {
  display: inline-block;
  margin-left: 12px;
}

.el-tag {
  margin-right: 4px;
}

.el-dropdown {
  display: inline-block;
}

.el-dropdown-menu {
  min-width: 200px;
}

.el-dropdown-item {
  padding: 0.25rem 0.5rem;
}

.el-button {
  margin-left: 4px;
}

.phone-tags-tree {
  margin-top: 4px;
}

.tags-toggle {
  font-size: 0.8rem;
  color: #666;
  margin-top: 2px;
  display: flex;
  align-items: center;
}

.tags-toggle:hover {
  color: #1976d2;
}

.tags-list {
  margin-left: 16px;
  margin-top: 4px;
}

.tag-item {
  padding: 2px 6px;
  margin: 1px 0;
  cursor: pointer;
  border-radius: 4px;
  font-size: 0.95rem;
  display: flex;
  align-items: center;
  transition: all 0.2s ease;
}

.tag-item:hover {
  background: #f5f5f5;
}

.tag-item.active {
  background: #e3f2fd;
  color: #1976d2;
}

.tag-item.clear-filter {
  color: #67c23a;
}

.tag-item.clear-filter:hover {
  background: #f0f9ff;
}

.parent-tag-container {
  margin-left: 12px;
}

.parent-tag-header {
  font-weight: 600;
  color: #333;
  margin: 2px 0;
  padding: 2px 0;
}

.child-tags {
  margin-left: 12px;
}

.child-tag {
  padding: 2px 6px;
  margin: 1px 0;
  cursor: pointer;
  border-radius: 4px;
  font-size: 0.9rem;
  border-bottom: 1px solid #3276d2;
  display: flex;
  align-items: center;
  transition: all 0.2s ease;
}

.child-tag:hover {
  background: #f5f5f5;
}

.child-tag.active {
  background: #e3f2fd;
  color: #1976d2;
}

.child-tag.clear-filter {
  color: #67c23a;
}

.child-tag.clear-filter:hover {
  background: #f0f9ff;
}

/* Hierarchical tag styles */
.tag-group {
  margin-bottom: 4px;
}

.parent-tag-container {
  margin-bottom: 4px;
}

/* Unread badge styles */
.unread-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  font-size: 0.7rem;
  font-weight: 600;
  line-height: 1;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.unread-badge:hover {
  transform: scale(1.1);
}

.parent-tag-header {
  font-weight: 600;
  color: #333;
  margin: 2px 0;
  padding: 2px 0;
  font-size: 0.9rem;
}

.child-tags {
  margin-left: 12px;
}

.child-tag {
  font-size: 0.85rem;
  padding: 1px 4px;
}

.child-tag .tag-icon {
  margin-right: 4px;
  width: 10px;
  height: 10px;
}

.inline-internal-comments {
  margin-top: 1rem;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  padding: 0.5rem 0.75rem 0.75rem 0.75rem;
  border: 1px solid #e0e0e0;
  width: 100%;
  box-sizing: border-box;
}

/* Add compact, pill-shaped, yellow comment styles */
.compact-comment {
  margin-bottom: 6px;
  display: flex;
  align-items: flex-start;
  background: none;
  border: none;
  box-shadow: none;
  padding: 0;
}
.comment-bubble {
  background: #fdf6ec;
  color: #8d5c1e;
  border-radius: 12px;
  padding: 0.35em 0.8em;
  display: inline-block;
  font-size: 0.92em;
  max-width: 90%;
  cursor: pointer;
  word-break: break-word;
  line-height: 1.3;
}
.comment-author {
  font-size: 0.95em;
}
.comment-content {
  font-size: 0.95em;
}
.comment-bubble:hover {
  box-shadow: none;
}
.comment-author {
  font-weight: 500;
  margin-right: 0.5em;
  color: #b26a00;
}
.comment-content {
  color: #8d5c1e;
}

/* Add chat-bar style for comment input */
.comment-input-bar {
  display: flex;
  align-items: center;
  background: #fafafa;
  border: 1px solid #e0e0e0;
  border-radius: 22px;
  padding: 0 12px;
  margin-bottom: 0.5em;
}
.internal-reply-input :deep(.el-input__wrapper) {
  background: transparent;
  border: none;
  box-shadow: none;
  padding: 0;
}
.internal-reply-input :deep(.el-input__inner) {
  background: transparent;
  border: none;
  box-shadow: none;
  font-size: 1em;
  padding: 10px 0;
  min-height: 36px;
}
.internal-reply-input :deep(.el-input__inner:focus) {
  box-shadow: none;
}

.redesigned-contact-details {
  text-align: center;
  padding: 1rem 0;
}

.redesigned-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: #1976d2;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 0.5rem auto;
  font-size: 2rem;
}

.redesigned-name {
  font-size: 1.3rem;
  font-weight: 400;
  color: #222224;
}

.contact-actions-row {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.contact-details-list {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.detail-row {
  display: flex;
  align-items: baseline;
  margin-bottom: 8px;
}

.contact-detail-label {
  display: flex;
  align-items: center;
  min-width: 110px;
  max-width: 140px;
  color: #69696b;
  font-size: 15px;
  font-weight: 425;
  margin-left: 6px;
}

.detail-value {
  flex: 1;
  text-align: left;
  font-size: 15px;
  color: #222;
  font-weight: 400;
  margin-left: 12px;
  display: flex;
  align-items: baseline;
}

.detail-value .placeholder {
  color: #bdbdbd;
}

.detail-row .el-icon {
  min-width: 20px;
  color: #69696b;
  font-size: 17px;
  margin-right: 2px;
}

.detail-row:last-child {
  margin-bottom: 0;
}

.placeholder {
  color: #909399;
  font-size: 0.8rem;
}

.pill-tag {
  background-color: #e9ecef;
  color: #606266;
  border-radius: 12px;
  padding: 0.25rem 0.5rem;
  font-size: 0.7rem;
  margin: 0 0.25rem;
}

.avatar-upload-image, .avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid #e0e0e0;
  display: block;
  margin: 0 auto;
  transition: box-shadow 0.2s, border-color 0.2s;
}
.avatar-uploader:hover .avatar-upload-placeholder,
.avatar-uploader:hover .avatar-upload-image {
  border-color: #1976d2;
  box-shadow: 0 0 0 2px #1976d233;
}

/* AI Check Message Dialog Styles */
.ai-check-content {
  max-height: 70vh;
  overflow-y: auto;
}

.original-message-section {
  margin-bottom: 1.5rem;
}

.original-message-section h4 {
  margin: 0 0 0.75rem 0;
  color: #333;
  font-size: 1rem;
  font-weight: 600;
}

.original-message-box {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 1rem;
  font-size: 0.9rem;
  line-height: 1.4;
  color: #333;
  white-space: pre-wrap;
  word-break: break-word;
}

.ai-analysis-section {
  margin-bottom: 1rem;
}

.issues-section {
  margin-bottom: 1.5rem;
}

.issues-section h4 {
  margin: 0 0 1rem 0;
  color: #e74c3c;
  font-size: 1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.suggestions-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.suggestion-item {
  background: #fff5f5;
  border: 1px solid #fed7d7;
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
}

.suggestion-type {
  flex-shrink: 0;
  margin-top: 0.25rem;
}

.suggestion-content {
  flex: 1;
}

.issue-description {
  margin: 0 0 0.5rem 0;
  font-weight: 500;
  color: #2d3748;
  font-size: 0.9rem;
}

.suggestion-text {
  margin: 0;
  color: #4a5568;
  font-size: 0.85rem;
  font-style: italic;
}

.improved-message-section {
  margin-bottom: 1rem;
}

.improved-message-section h4 {
  margin: 0 0 0.75rem 0;
  color: #27ae60;
  font-size: 1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.improved-message-input {
  margin-bottom: 0.75rem;
}

.improved-message-input :deep(.el-textarea__inner) {
  border: 2px solid #27ae60;
  border-radius: 8px;
  padding: 0.75rem;
  font-size: 0.9rem;
  line-height: 1.4;
  resize: none;
  transition: all 0.2s ease;
}

.improved-message-input :deep(.el-textarea__inner:focus) {
  border-color: #219a52;
  box-shadow: 0 0 0 3px rgba(39, 174, 96, 0.1);
}

.explanation {
  background: #f0f9f0;
  border: 1px solid #c3e6c3;
  border-radius: 6px;
  padding: 0.75rem;
  font-size: 0.85rem;
  color: #2d5016;
  line-height: 1.4;
}

.no-issues-section {
  text-align: center;
  background: #f0f9f0;
  border: 1px solid #c3e6c3;
  border-radius: 8px;
  padding: 2rem 1rem;
  color: #2d5016;
}

.no-issues-section .check-icon {
  font-size: 3rem;
  color: #27ae60;
  margin-bottom: 1rem;
}

.no-issues-section p {
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
}

.no-issues-section .explanation {
  margin-top: 1rem;
  background: transparent;
  border: none;
  padding: 0;
  font-style: italic;
}

.loading-section {
  text-align: center;
  padding: 3rem 1rem;
  color: #666;
}

.loading-section .loading-icon {
  font-size: 3rem;
  color: #f39c12;
  margin-bottom: 1rem;
  animation: pulse 2s infinite;
}

.loading-section p {
  margin: 0;
  font-size: 1rem;
}

.ai-check-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(1.05);
  }
}

/* AI Check Button in Forms */
.ai-check-button-container {
  margin-top: 0.75rem;
  text-align: right;
}

.ai-check-button-container .el-button {
  font-size: 0.85rem;
}

/* Responsive adjustments for AI check dialog */
@media (max-width: 768px) {
  .ai-check-content {
    max-height: 60vh;
  }

  .conversation-preview-improved {
    max-height: 200px;
    padding: 0.75rem;
  }

  .conversation-preview-compact {
    max-height: 100px;
    padding: 0.4rem;
  }

  .context-message-compact {
    padding: 0.3rem 0.4rem;
    font-size: 0.75rem;
  }

  .message-row {
    gap: 0.3rem;
  }

  .sender-compact {
    font-size: 0.7rem;
    min-width: 35px;
  }

  .message-text-compact {
    max-width: 150px;
    font-size: 0.75rem;
  }

  .time-compact {
    font-size: 0.65rem;
  }

  .context-message-improved.outbound {
    margin-left: 1rem;
    max-width: 90%;
  }

  .context-message-improved.inbound {
    margin-right: 1rem;
    max-width: 90%;
  }

  .context-message-improved {
    padding: 0.5rem 0.75rem;
  }

  .message-header {
    font-size: 0.75rem;
    margin-bottom: 0.4rem;
  }

  .message-time {
    font-size: 0.7rem;
  }
  
  .suggestion-item {
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .suggestion-type {
    align-self: flex-start;
  }
  
  .ai-check-footer {
    flex-direction: column;
  }
  
  .ai-check-footer .el-button {
    width: 100%;
  }

  .ai-check-button-container {
    text-align: center;
  }
}

/* AI Draft Message Dialog Styles */
.ai-draft-content {
  max-height: 70vh;
  overflow-y: auto;
}

.conversation-context-section {
  margin-bottom: 1.5rem;
}

.conversation-context-section h4 {
  margin: 0 0 0.75rem 0;
  color: #333;
  font-size: 1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* Compact Conversation Styles */
.conversation-context-section-compact {
  margin-bottom: 1rem;
}

.conversation-header-compact {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 6px;
  transition: background-color 0.2s ease;
  margin-bottom: 0.5rem;
}

.conversation-header-compact:hover {
  background-color: #f5f5f5;
}

.conversation-header-compact h4 {
  margin: 0;
  color: #333;
  font-size: 0.9rem;
  font-weight: 600;
}

.collapse-icon {
  font-size: 0.8rem;
  color: #666;
  transition: transform 0.2s ease;
}

.collapse-icon.expanded {
  transform: rotate(180deg);
}

.conversation-preview-compact {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 0.5rem;
  max-height: 100px;
  overflow-y: auto;
}

.context-message-compact {
  margin-bottom: 0.4rem;
  padding: 0.4rem 0.5rem;
  border-radius: 6px;
  font-size: 0.8rem;
  line-height: 1.2;
  transition: all 0.15s ease;
}

.context-message-compact:last-child {
  margin-bottom: 0;
}

.context-message-compact:hover {
  background-color: rgba(255, 255, 255, 0.5);
}

.context-message-compact.outbound {
  background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
  border-left: 2px solid #2196f3;
}

.context-message-compact.inbound {
  background: linear-gradient(135deg, #f1f8e9 0%, #c8e6c9 100%);
  border-left: 2px solid #4caf50;
}

.message-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.sender-compact {
  font-weight: 600;
  color: #333;
  font-size: 0.75rem;
  flex-shrink: 0;
  min-width: 40px;
}

.message-text-compact {
  flex: 1;
  color: #444;
  word-wrap: break-word;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

.time-compact {
  color: #666;
  font-size: 0.7rem;
  opacity: 0.8;
  flex-shrink: 0;
}

.no-messages-compact {
  text-align: center;
  color: #999;
  font-style: italic;
  padding: 1rem;
  font-size: 0.8rem;
}

.conversation-preview {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 1rem;
  max-height: 200px;
  overflow-y: auto;
}

.conversation-preview-improved {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 0.75rem;
  max-height: 150px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.context-message-improved {
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
  font-size: 0.85rem;
  line-height: 1.3;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
  transition: all 0.15s ease;
}

.context-message-improved:hover {
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.12);
}

.context-message-improved.outbound {
  background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
  border-left: 3px solid #2196f3;
  margin-left: 1.5rem;
  align-self: flex-end;
  max-width: 80%;
}

.context-message-improved.inbound {
  background: linear-gradient(135deg, #f1f8e9 0%, #c8e6c9 100%);
  border-left: 3px solid #4caf50;
  margin-right: 1.5rem;
  align-self: flex-start;
  max-width: 80%;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.3rem;
  font-size: 0.75rem;
}

.sender-name {
  font-weight: 600;
  color: #333;
}

.message-time {
  font-size: 0.7rem;
  opacity: 0.8;
}

.message-content {
  color: #444;
  word-wrap: break-word;
  white-space: pre-wrap;
  font-size: 0.85rem;
  line-height: 1.3;
}

.no-recent-messages {
  text-align: center;
  color: #666;
  font-style: italic;
  padding: 2rem;
  background: #f5f5f5;
  border-radius: 8px;
  border: 2px dashed #ddd;
}

.context-message {
  margin-bottom: 0.75rem;
  padding: 0.5rem;
  border-radius: 6px;
  font-size: 0.9rem;
  line-height: 1.4;
}

.context-message:last-child {
  margin-bottom: 0;
}

.context-message.outbound {
  background: #e3f2fd;
  text-align: right;
}

.context-message.inbound {
  background: #f1f8e9;
  text-align: left;
}

.context-message strong {
  color: #333;
  margin-right: 0.5rem;
}

.ai-draft-section {
  margin-bottom: 1rem;
}

.suggested-message-section {
  margin-bottom: 1.5rem;
}

.suggested-message-section h4 {
  margin: 0 0 0.75rem 0;
  color: #27ae60;
  font-size: 1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.draft-message-input {
  margin-bottom: 1rem;
}

.draft-message-input :deep(.el-textarea__inner) {
  border: 2px solid #27ae60;
  border-radius: 8px;
  padding: 0.75rem;
  font-size: 0.9rem;
  line-height: 1.4;
  resize: none;
  transition: all 0.2s ease;
}

.draft-message-input :deep(.el-textarea__inner:focus) {
  border-color: #219a52;
  box-shadow: 0 0 0 3px rgba(39, 174, 96, 0.1);
}

.ai-reasoning {
  background: #f0f9f0;
  border: 1px solid #c3e6c3;
  border-radius: 6px;
  padding: 0.75rem;
  margin-bottom: 0.75rem;
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: #2d5016;
  line-height: 1.4;
}

.ai-reasoning .el-icon {
  color: #27ae60;
  font-size: 1rem;
  margin-top: 0.1rem;
  flex-shrink: 0;
}

.tone-badge {
  text-align: right;
  margin-bottom: 1rem;
}

.alternatives-section {
  margin-bottom: 1rem;
}

.alternatives-section h4 {
  margin: 0 0 0.75rem 0;
  color: #2c5aa0;
  font-size: 1rem;
  font-weight: 600;
}

.alternatives-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.alternative-item {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.alternative-item:hover {
  background: #e9ecef;
  border-color: #2c5aa0;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.alternative-item .el-icon {
  color: #2c5aa0;
  font-size: 1rem;
  flex-shrink: 0;
}

.ai-draft-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

/* Responsive adjustments for AI draft dialog */
@media (max-width: 768px) {
  .ai-draft-content {
    max-height: 60vh;
  }
  
  .conversation-preview {
    max-height: 150px;
  }

  .conversation-preview-improved {
    max-height: 250px;
    padding: 0.75rem;
  }

  .conversation-preview-compact {
    max-height: 100px;
    padding: 0.4rem;
  }

  .context-message-compact {
    padding: 0.3rem 0.4rem;
    font-size: 0.75rem;
  }

  .message-row {
    gap: 0.3rem;
  }

  .sender-compact {
    font-size: 0.7rem;
    min-width: 35px;
  }

  .message-text-compact {
    max-width: 150px;
    font-size: 0.75rem;
  }

  .time-compact {
    font-size: 0.65rem;
  }

  .context-message-improved.outbound {
    margin-left: 1rem;
    max-width: 90%;
  }

  .context-message-improved.inbound {
    margin-right: 1rem;
    max-width: 90%;
  }

  .context-message-improved {
    padding: 0.5rem 0.75rem;
  }

  .message-header {
    font-size: 0.75rem;
    margin-bottom: 0.4rem;
  }
  
  .ai-draft-footer {
    flex-direction: column;
  }
  
  .ai-draft-footer .el-button {
    width: 100%;
  }
}
/* Debug Section Styles */
.debug-section {
  margin-top: 1.5rem;
  border-top: 1px solid #e0e0e0;
  padding-top: 1rem;
}

.debug-section h4 {
  margin: 0 0 0.75rem 0;
  color: #666;
  font-size: 1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.debug-content {
  padding: 0.5rem 0;
}

.debug-content h5 {
  margin: 0.75rem 0 0.25rem 0;
  color: #444;
  font-size: 0.9rem;
  font-weight: 600;
}

.debug-content code {
  background: #f5f5f5;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  font-family: 'Monaco', 'Consolas', 'Courier New', monospace;
  font-size: 0.85rem;
  color: #333;
  display: inline-block;
  max-width: 100%;
  word-break: break-all;
}

.debug-content pre {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 0.75rem;
  margin: 0.5rem 0;
  overflow-x: auto;
  max-height: 300px;
  overflow-y: auto;
}

.debug-content pre code {
  background: none;
  border: none;
  padding: 0;
  font-size: 0.8rem;
  line-height: 1.4;
  color: #333;
  white-space: pre;
  word-break: normal;
  display: block;
}

.debug-content .error-text {
  color: #e74c3c;
  background: #fdf2f2;
  border-color: #f5c6cb;
}

.debug-content pre .error-text {
  background: none;
  border: none;
}

/* Debug collapse item styles */
.debug-section :deep(.el-collapse-item__header) {
  font-size: 0.9rem;
  font-weight: 500;
  color: #555;
}

.debug-section :deep(.el-collapse-item__content) {
  padding-bottom: 0.5rem;
}



/* Contact Details Inline Editing Styles */
.contact-name-large {
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 4px;
  padding: 4px 8px;
  margin: -4px -8px;
}

.detail-value span[onclick] {
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 4px;
  padding: 2px 6px;
  margin: -2px -6px;
  display: inline-block;
}

.detail-value span[onclick]:hover {
  background-color: #f5f7fa;
  color: #409eff;
}

.detail-value .placeholder {
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 4px;
  padding: 2px 6px;
  margin: -2px -6px;
  display: inline-block;
  color: #909399;
}

.detail-value .placeholder:hover {
  background-color: #f5f7fa;
  color: #409eff;
}

/* Input focus styles for better UX */
.detail-value .el-input :deep(.el-input__inner) {
  border-radius: 6px;
  transition: all 0.2s ease;
}

.detail-value .el-input :deep(.el-input__inner:focus) {
  border-color: #409eff;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.1);
}

.detail-value .el-select :deep(.el-input__inner) {
  border-radius: 6px;
  transition: all 0.2s ease;
}

.detail-value .el-select :deep(.el-input__inner:focus) {
  border-color: #409eff;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.1);
}

.detail-value span {
  font-size: 13px;
  color: #69696b;
}

.cursor-pointer {
  cursor: pointer;
}

.conversation-menu-icon {
  cursor: pointer;
  color: #888;
  font-size: 1.1rem;
  z-index: 2;
  transition: color 0.2s;
}

.conversation-menu-icon:hover {
  color: #1976d2;
}

.last-seen-popover {
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  padding: 0.5rem 0.5rem 0.25rem 0.5rem;
  min-width: 220px;
  max-width: 300px;
  border: 1px solid #f0f0f0;
}
.last-seen-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.last-seen-item {
  padding: 0.5rem 0.25rem 0.35rem 0.25rem;
  border-radius: 6px;
  transition: background 0.18s;
  cursor: default;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.last-seen-item:hover {
  background: #f7faff;
}
.user-name {
  font-weight: 400;
  color: #222;
  font-size: 1.04rem;
  margin-bottom: 0.1rem;
}
.last-seen-time {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #888;
  font-size: 0.93rem;
  font-weight: 400;
  margin-left: 2px;
}
.last-seen-time .el-icon, .last-seen-time svg {
  font-size: 1em;
  color: #bdbdbd;
  margin-right: 2px;
}
.no-last-seen {
  color: #aaa;
  text-align: center;
  font-size: 0.97rem;
  padding: 0.75rem 0;
}
.loading-last-seen {
  color: #888;
  text-align: center;
  font-size: 0.97rem;
  padding: 0.75rem 0;
}
.new-message-input-textarea :deep(.el-textarea__inner:focus) {
  box-shadow: inset 0 0 0 1px #a0cfff, 0 0 0 4px rgba(64, 158, 255, 0.1);
}
.action-icon-btn {
  transition: background 0.2s, box-shadow 0.2s;
  border-radius: 5px;
}
.action-icon-btn:hover {
  background: #f0f7ff;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.08);
  border-radius: 5px;
}
.contact-detail-label {
  color: #69696b;
  font-size: 13px;
  font-weight: 425;
}
.no-chat-selected-title,.no-contact-selected-title {
  font-size: 1.1rem;
  font-weight: 500;
  color: #69696b;
  margin-bottom: 0;
}
</style>