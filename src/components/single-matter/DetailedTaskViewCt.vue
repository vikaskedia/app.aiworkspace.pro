<template>
  <div class="single-task-view" v-if="task">
    <div class="task-header">
      <div class="back-button">
        <el-button 
          type="primary" 
          link 
          @click="$router.push(`/single-matter/${currentMatter?.id}/tasks`)">
          <el-icon><ArrowLeft /></el-icon>
          Back to Tasks
        </el-button>
      </div>
      <div class="header-actions">
        <el-button 
          type="info"
          @click="shareDialogVisible = true"
          class="share-task-btn">
          <el-icon><Share /></el-icon>
          <span class="share-task-text">Share Task</span>
        </el-button>
        <el-button 
          type="warning"
          @click="logHoursDialogVisible = true"
          class="log-hours-btn">
          <el-icon><Clock /></el-icon>
          <span class="log-hours-text">Log Hours</span>
        </el-button>
      </div>
    </div>

    <div class="task-content-wrapper" v-loading="loading">
      <!-- Main Content -->
      <div class="task-main-content">
        <div class="task-main-info">
          
          <div class="task-title-header">
            <div class="title-main-section">
              <div class="title-wrapper">
                <div class="star-container">
                  <el-icon 
                    class="star-icon"
                    :class="{ 'starred': isTaskStarred }"
                    @click.stop="toggleTaskStar"
                  >
                    <Star v-if="!isTaskStarred" />
                    <StarFilled v-else />
                  </el-icon>
                </div>
                
                <h2 
                  v-if="!isEditingTitle" 
                  @click="startTitleEdit"
                  class="editable-title"
                >
                  {{ task?.title }}
                  <el-icon class="edit-icon"><Edit /></el-icon>
                </h2>
                
                <div v-else class="title-edit-wrapper">
                  <el-input
                    v-model="editingTitle"
                    ref="titleInput"
                    size="large"
                    @keyup.enter="saveTitleEdit"
                    @keyup.esc="cancelTitleEdit"
                  />
                  <div class="title-edit-actions">
                    <el-button @click="cancelTitleEdit" size="small">Cancel</el-button>
                    <el-button 
                      type="primary" 
                      @click="saveTitleEdit" 
                      size="small"
                      :disabled="!editingTitle.trim() || editingTitle === task?.title"
                    >
                      Save
                    </el-button>
                  </div>
                </div>
              </div>
            </div>

            <div class="edit-metadata">
              <span 
                v-if="task?.edit_history?.length" 
                class="edited-marker"
                @click="toggleTaskHistory"
              >
                (edited {{ task.edit_history.length }} times)
              </span>
            </div>
          </div>

          <!-- Add this after the task title section -->
          <div class="task-parent">
            <h4>Parent Task</h4>
            <el-select
              v-model="task.parent_task_id"
              style="width: 100%"
              placeholder="Select parent task"
              @change="updateParentTask"
            >
              <el-option
                v-for="parentTask in flattenedTasks"
                :key="parentTask.id ?? 'no-parent'"
                :label="parentTask.title"
                :value="parentTask.id ?? ''"
              />
            </el-select>
          </div>

          <div v-if="showTaskHistory" class="edit-history">
            <div 
              v-for="(historyEntry, index) in task?.edit_history?.slice().reverse()" 
              :key="index" 
              class="edit-history-entry"
            >
              <div class="edit-history-header">Changed {{ historyEntry.field_name }}:</div>
              <div class="previous-content">
                {{ historyEntry.previous_value || 'No previous content' }}
              </div>
              <div class="edit-metadata">
                Edited by {{ userEmails[historyEntry.edited_by] }}
                on {{ new Date(historyEntry.edited_at).toLocaleString(undefined, {
                  year: 'numeric',
                  month: 'numeric',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                }) }}
              </div>
            </div>
          </div>

          <div class="task-metadata">
            <div class="metadata-grid">
              <!-- Status Column -->
              <div class="metadata-item status-item">
                <div class="metadata-label">
                  <div class="label-header">
                    <el-icon><CircleCheck /></el-icon>
                    <span class="status-label">Status</span>
                  </div>
                  <div class="status-content">
                    <el-popover
                      ref="statusPopover"
                      placement="bottom-start"
                      trigger="click"
                      :width="200"
                      popper-class="metadata-popover"
                    >
                      <template #reference>
                        <div class="status-display">
                          <span class="status-text">{{ formatStatus(task?.status) }}</span>
                          <el-icon class="edit-icon"><Edit /></el-icon>
                        </div>
                      </template>
                      <div class="metadata-options">
                        <div 
                          v-for="option in statusOptions" 
                          :key="option.value"
                          class="metadata-option"
                          :class="{ 'selected': task?.status === option.value }"
                          @click="handleStatusChange(option.value)"
                        >
                          <el-tag :type="getStatusType({ status: option.value })" size="small">
                            {{ option.label }}
                          </el-tag>
                        </div>
                      </div>
                    </el-popover>
                  </div>
                </div>
              </div>

              <!-- Priority Column -->
              <div class="metadata-item priority-item">
                <div class="metadata-label">
                  <div class="label-header">
                    <el-icon><Warning /></el-icon>
                    <span class="status-label">Priority</span>
                  </div>
                  <div class="status-content">
                    <el-popover
                      ref="priorityPopover"
                      placement="bottom-start"
                      trigger="click"
                      :width="200"
                      popper-class="metadata-popover"
                    >
                      <template #reference>
                        <div class="status-display">
                          <span class="status-text">{{ formatPriority(task?.priority) }}</span>
                          <el-icon class="edit-icon"><Edit /></el-icon>
                        </div>
                      </template>
                      <div class="metadata-options">
                        <div 
                          v-for="option in priorityOptions" 
                          :key="option.value"
                          class="metadata-option"
                          :class="{ 'selected': task?.priority === option.value }"
                          @click="handlePriorityChange(option.value)"
                        >
                          <el-tag :type="getPriorityType({ priority: option.value })" size="small">
                            {{ option.label }}
                          </el-tag>
                        </div>
                      </div>
                    </el-popover>
                  </div>
                </div>
              </div>

              <!-- Due Date Column -->
              <div class="metadata-item due-date-item">
                <div class="metadata-label">
                  <div class="label-header">
                    <el-icon><Calendar /></el-icon>
                    <span class="status-label">Due Date</span>
                  </div>
                  <div class="status-content">
                    <el-popover
                      placement="bottom"
                      trigger="click"
                      :width="240"
                      popper-class="due-date-popover"
                      @show="initializeTempDueDate">
                      <template #reference>
                        <div class="status-display">
                          <span class="status-text">
                            {{ task?.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date' }}
                          </span>
                          <el-icon class="edit-icon"><Edit /></el-icon>
                        </div>
                      </template>
                      <template #default>
                        <div class="due-date-editor">
                          <el-date-picker
                            v-model="tempDueDate"
                            type="date"
                            placeholder="Select due date"
                            style="width: 100%"
                            size="small"
                            @change="handleDueDateChange"
                          />
                          <div class="due-date-actions">
                            <el-button @click="clearDueDate" link size="small">Clear</el-button>
                          </div>
                        </div>
                      </template>
                    </el-popover>
                  </div>
                </div>
              </div>

              
              <!-- Assigned To Column -->
              <div class="metadata-item assigned-to-item">
                <div class="metadata-label">
                  <div class="label-header">
                    <el-icon><User /></el-icon>
                    <span class="status-label">Assigned To</span>
                  </div>
                  <div class="status-content">
                    <el-popover
                      ref="assigneePopover"
                      placement="bottom-start"
                      trigger="click"
                      :width="200"
                      popper-class="metadata-popover"
                    >
                      <template #reference>
                        <div class="status-display">
                          <div class="assignee-info">
                            <el-avatar v-if="assigneeEmail" :size="20">
                              {{ getInitials(assigneeEmail) }}
                            </el-avatar>
                            <span class="status-text">{{ assigneeEmail || 'Unassigned' }}</span>
                          </div>
                          <el-icon class="edit-icon"><Edit /></el-icon>
                        </div>
                      </template>
                      <div class="metadata-options">
                        <div 
                          v-for="user in sharedUsers" 
                          :key="user.id"
                          class="metadata-option"
                          :class="{ 'selected': task?.assignee === user.id }"
                          @click="handleAssigneeChange(user.id)"
                        >
                          <div class="user-option">
                            <el-avatar :size="24">{{ getInitials(user.email) }}</el-avatar>
                            <span>{{ user.email }}</span>
                          </div>
                        </div>
                      </div>
                    </el-popover>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="description-wrapper">
            <div class="description-header">
              <h3>Description</h3>
              <el-button 
                v-if="!isEditingDescription" 
                link 
                @click="startDescriptionEdit"
              >
                <el-icon><Edit /></el-icon>
                Edit
              </el-button>
            </div>

            <div v-if="isEditingDescription" class="description-edit">
              <TiptapEditor
                v-model="editingDescription"
                placeholder="Add a description..."
                :autofocus="true" 
                :isTaskComment="false"
                :sharedUsers="sharedUsers"
                :taskId="String(task.id)"
                :taskTitle="task.title"
                :enable-typeahead="false"
              />
              <div class="description-edit-actions">
                <el-button @click="cancelDescriptionEdit" size="small">Cancel</el-button>
                <el-button 
                  type="primary" 
                  @click="saveDescriptionEdit" 
                  size="small"
                  :disabled="!editingDescription.trim() || editingDescription === task?.description"
                >
                  Save
                </el-button>
              </div>
            </div>

            <p 
              v-else 
              class="description" 
              v-html="formatCommentContent(task?.description || 'No description provided')"
              @click="startDescriptionEdit"
            ></p>
          </div>
        </div>

        <div class="hours-logs" v-if="hoursLogs.length">
          <div class="hours-header">
            <h3>Hours Logged</h3>
            <div class="total-hours">
              <el-tag type="success" size="large" effect="plain">
                <el-icon><Clock /></el-icon>
                <span class="total-time">Total Hours: {{ formatTotalTime }}</span>
              </el-tag>
            </div>
          </div>
          
          <el-table 
            :data="displayedHoursLogs" 
            style="width: 100%"
            :stripe="true"
            :border="true"
            class="hours-table"
            row-class-name="hours-table-row"
          >
            <el-table-column 
              prop="time_taken" 
              label="Time Logged" 
              width="140"
              align="center"
              fixed
            >
              <template #default="scope">
                <div class="time-wrapper">
                  <el-icon><Timer /></el-icon>
                  <span class="time-cell">{{ formatTime(scope.row.time_taken) }}</span>
                </div>
              </template>
            </el-table-column>

            <el-table-column 
              prop="comment" 
              label="Work Description"
              min-width="300"
              show-overflow-tooltip
            >
              <template #default="scope">
                <div class="comment-cell">
                  <span v-if="scope.row.comment">{{ scope.row.comment }}</span>
                  <span v-else class="no-comment">No description provided</span>
                </div>
              </template>
            </el-table-column>

            <el-table-column 
              label="Logged By" 
              width="200"
              align="center"
            >
              <template #default="scope">
                <el-tooltip 
                  :content="userEmails[scope.row.user_id]"
                  placement="top"
                  effect="light"
                >
                  <div class="user-wrapper">
                    <el-avatar 
                      :size="24" 
                      class="user-avatar"
                    >
                      {{ getInitials(userEmails[scope.row.user_id]) }}
                    </el-avatar>
                    <span class="user-cell">{{ formatEmail(userEmails[scope.row.user_id]) }}</span>
                  </div>
                </el-tooltip>
              </template>
            </el-table-column>

            <el-table-column 
              label="Date & Time" 
              width="200"
              align="center"
            >
              <template #default="scope">
                <el-tooltip 
                  :content="formatDateTime(scope.row.created_at)"
                  placement="top"
                  effect="light"
                >
                  <div class="date-wrapper">
                    <span class="date-cell">{{ formatDate(scope.row.created_at) }}</span>
                    <span class="time-stamp">{{ formatTimeOnly(scope.row.created_at) }}</span>
                  </div>
                </el-tooltip>
              </template>
            </el-table-column>
          </el-table>

          <div v-if="hoursLogs.length > 3" class="show-more-container">
            <el-button 
              link 
              type="primary" 
              @click="toggleShowMore"
              class="show-more-button"
            >
              {{ showAllLogs ? 'Show Less' : `Show More` }}
            </el-button>
          </div>
        </div>
      </div>

      <!-- Comments Section -->
      <div class="task-comments-section">
        <div class="task-comments">
          <div class="comments-header">
            <h3 class="comments-title">Comments</h3>
            <el-dropdown trigger="click">
              <el-button link>
                <el-icon><Setting /></el-icon>
                <!-- el-icon><VerticalDotsIcon /></el-icon -->
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item>
                    <div class="dropdown-item-content">
                      <el-switch
                        v-model="showSystemComments"
                        size="small"
                        active-text="Show system comments"
                      />
                    </div>
                  </el-dropdown-item>
                  <el-dropdown-item>
                    <div class="dropdown-item-content">
                      <el-switch
                        v-model="showArchivedComments"
                        size="small"
                        active-text="Show archived"
                        @change="loadComments"
                      />
                    </div>
                  </el-dropdown-item>
                  <!-- el-dropdown-item>
                    <div class="dropdown-item-content" @click="showSystemComments = !showSystemComments">
                      <el-switch size="small" v-model="showSystemComments" />
                      <span class="system-comments-label">Show system comments</span>
                    </div>
                  </el-dropdown-item>
                  <el-dropdown-item>
                    <div class="dropdown-item-content" @click="toggleArchived">
                      <el-switch size="small" v-model="showArchivedComments" @change="loadComments" />
                      <span class="archived-comments-label">Show archived</span>
                    </div>
                  </el-dropdown-item -->
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
          <div class="comments-list">
            <div 
              v-for="comment in filteredComments" 
              :key="comment.id"
              :class="[
                'comment-item',
                {
                  'ai-response': comment.type === 'ai_response',
                  'archived': comment.archived,
                  'system-comment': comment.type === 'activity'
                }
              ]"
            >
              <div :class="['comment-content', comment.type === 'activity' ? 'activity' : '']">
                <div class="comment-header">
                  <span class="comment-author">
                    {{ comment.type === 'ai_response' ? comment.metadata?.ai_name || 'AI Attorney' : userEmails[comment.user_id] }}
                  </span>
                  <div class="comment-actions">
                    <span class="comment-date">
                      {{ comment.updated_at 
                        ? new Date(comment.updated_at).toLocaleString(undefined, { 
                            year: 'numeric', 
                            month: 'numeric', 
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        : new Date(comment.created_at).toLocaleString(undefined, {
                            year: 'numeric',
                            month: 'numeric',
                            day: 'numeric', 
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                      }}
                    </span>
                    <el-dropdown v-if="comment.type !== 'activity'" trigger="click">
                      <el-button link>
                        <el-icon><VerticalDotsIcon /></el-icon>
                      </el-button>
                      <template #dropdown>
                        <el-dropdown-menu>
                          <el-dropdown-item @click="startEditing(comment)">Edit</el-dropdown-item>
                          <el-dropdown-item @click="toggleCommentHistory(comment)" v-if="comment.comment_edit_history?.length">
                            {{ expandedCommentHistories.has(comment.id) ? 'Close History' : `Show History (${comment.comment_edit_history.length})` }}
                          </el-dropdown-item>
                          <el-dropdown-item @click="toggleArchiveComment(comment)">
                            {{ comment.archived ? 'Unarchive' : 'Archive' }}
                          </el-dropdown-item>
                        </el-dropdown-menu>
                      </template>
                    </el-dropdown>
                  </div>
                </div>
                <div class="comment-text">
                  <div v-if="editingCommentId === comment.id">
                    <TiptapEditor
                      v-model="editingCommentText"
                      placeholder="Edit your comment..."
                      :taskId="String(task.id)"
                      :taskTitle="task.title"
                      :sharedUsers="sharedUsers"
                      :isTaskComment="true"
                      :autofocus="true"
                      :enable-typeahead="false"
                    />
                    <div class="comment-edit-actions">
                      <el-button @click="cancelEditing" size="small">Cancel</el-button>
                      <el-button 
                        type="primary" 
                        @click="saveCommentEdit(comment)" 
                        size="small"
                        :disabled="!editingCommentText.trim() || editingCommentText === comment.content"
                      >
                        Save
                      </el-button>
                    </div>
                  </div>
                  <span v-else v-html="formatCommentContent(comment.content)"></span>
                  
                  <!-- Add this new history section -->
                  <div v-if="expandedCommentHistories.has(comment.id) && comment.comment_edit_history?.length" class="comment-history">
                    <div class="history-header">Edit History</div>
                    <div v-for="(historyEntry, index) in comment.comment_edit_history.slice().reverse()" 
                         :key="index" 
                         class="history-entry">
                      <div class="previous-content">{{ historyEntry.previous_content }}</div>
                      <div class="edit-metadata">
                        Edited by {{ userEmails[historyEntry.edited_by] }}
                        on {{ new Date(historyEntry.edited_at).toLocaleString(undefined, {
                          year: 'numeric',
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="comment-input">
            <TiptapEditor
              v-model="newComment"
              placeholder="Write a comment..."
              :taskId="String(task.id)"
              :taskTitle="task.title"
              :sharedUsers="sharedUsers"
              :isTaskComment="true"
              :enable-typeahead="false"
            />
            <el-button
              type="primary"
              :disabled="!newComment.trim()"
              @click="addComment"
              style="margin-top: 10px">
              Add Comment
            </el-button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Add this new Share Task Dialog after the Edit Task Dialog -->
    <el-dialog
      v-model="shareDialogVisible"
      title="Share Task"
      width="500px">
      <div class="share-options">
        <div class="share-link-section">
          <h4>Share via Link</h4>
          <div class="link-input">
            <el-input
              v-model="shareLink"
              readonly>
              <template #append>
                <el-button @click="copyLink">
                  <el-icon><DocumentCopy /></el-icon>
                  Copy
                </el-button>
              </template>
            </el-input>
          </div>
        </div>

        <div class="share-email-section">
          <h4>Share via Email</h4>
          <el-form :model="emailShare">
            <el-form-item>
              <el-select
                v-model="emailShare.recipients"
                multiple
                filterable
                placeholder="Select recipients"
                style="width: 100%">
                <el-option
                  v-for="user in sharedUsers"
                  :key="user.id"
                  :label="user.email"
                  :value="user.email" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-input
                v-model="emailShare.message"
                type="textarea"
                :rows="3"
                placeholder="Add a message (optional)" />
            </el-form-item>
          </el-form>
          <el-button
            type="primary"
            :disabled="!emailShare.recipients.length"
            :loading="sending"
            @click="shareViaEmail">
            Send Email
          </el-button>
        </div>
      </div>
    </el-dialog>

    <!-- File Selector Dialog -->
    <el-dialog
      v-model="showFileSelector"
      title="Select File"
      width="500px">
      <div class="file-selector-header">
        <el-breadcrumb separator="/">
          <el-breadcrumb-item 
            @click="navigateSelectorFolder(null)"
            :class="{ clickable: currentSelectorFolder }">
            Root
          </el-breadcrumb-item>
          <el-breadcrumb-item 
            v-for="folder in selectorBreadcrumbs" 
            :key="folder.id"
            @click="navigateSelectorFolder(folder)"
            :class="{ clickable: folder.id !== currentSelectorFolder?.id }">
            {{ folder.name }}
          </el-breadcrumb-item>
        </el-breadcrumb>
      </div>

      <el-input
        v-model="fileSearchQuery"
        placeholder="Search files..."
        clearable
        style="margin-bottom: 1rem;" />
      
      <el-scrollbar height="300px">
        <div class="file-list">
          <div
            v-for="item in filteredFiles"
            :key="item.id"
            class="file-item"
            @click="item.type === 'dir' ? navigateSelectorFolder(item) : selectFile(item)">
            <el-icon v-if="item.type === 'dir'" class="folder-icon">
              <Folder />
            </el-icon>
            {{ item.name }}
          </div>
        </div>
      </el-scrollbar>
    </el-dialog>

    <!-- Log Hours Dialog -->
    <el-dialog
      v-model="logHoursDialogVisible"
      title="Log Hours"
      width="500px"
      class="log-hours-dialog"
    >
      <el-form :model="newHoursLog" label-position="top">
        <el-form-item label="Time" required>
          <div class="time-input-container">
            <div class="time-input-group-container">
              <div class="time-input-group">
                <el-input
                  ref="hoursInput"
                  v-model="hours"
                  placeholder="HH"
                  @input="validateHours"
                  @blur="formatHours"
                  @keyup="handleHoursKeyup"
                  size="small"
                  style="width: 50px"
                  maxlength="2"
                />
                <span class="time-separator">:</span>
                <el-input
                  ref="minutesInput"
                  v-model="minutes"
                  placeholder="MM"
                  @input="validateMinutes"
                  @blur="formatMinutes"
                  @keydown="handleMinutesKeydown"
                  size="small"
                  style="width: 50px"
                  maxlength="2"
                />
              </div>
              <span class="time-unit">hours</span>
            </div>
            <small class="time-input-help" :class="{ 'error-text': timeError }">
              {{ timeError || 'Hours (0-12), Minutes (0-59)' }}
            </small>
          </div>
        </el-form-item>
        <el-form-item label="Comment">
          <el-input
            v-model="newHoursLog.comment"
            type="textarea"
            :rows="3"
            placeholder="Add a comment about the work done..."
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="logHoursDialogVisible = false">Cancel</el-button>
          <el-button
            type="primary"
            @click="submitHoursLog"
            :disabled="!newHoursLog.time_taken">
            Submit
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
  <div v-else class="loading-state">
    <el-skeleton :rows="3" animated />
  </div>
</template>

<script>
import { ArrowLeft, DocumentCopy, Folder, Close, Document, Star, StarFilled, ArrowDown, Clock, Timer, User, Calendar, Edit, CircleCheck, Warning, Delete, More, Setting, Share } from '@element-plus/icons-vue';
import VerticalDotsIcon from '../icons/VerticalDotsIcon.vue';
import { supabase } from '../../supabase';
import { useMatterStore } from '../../store/matter';
import { useCacheStore } from '../../store/cache';
import { storeToRefs } from 'pinia';
import { ElMessage } from 'element-plus';
import TiptapEditor from '../common/TiptapEditor.vue';

export default {
  components: {
    ArrowLeft,
    DocumentCopy,
    Folder,
    Close,
    Document,
    TiptapEditor,
    ArrowDown,
    Star,
    StarFilled,
    Clock,
    Timer,
    User,
    Calendar,
    Edit,
    CircleCheck,
    Warning,
    Delete,
    More,
    VerticalDotsIcon,
    Setting,
    Share
  },
  setup() {
    const matterStore = useMatterStore();
    const cacheStore = useCacheStore();
    const { currentMatter } = storeToRefs(matterStore);
    return { currentMatter, cacheStore };
  },
  data() {
    return {
      task: null,
      loading: false,
      comments: [],
      newComment: '',
      userEmails: {},
      editDialogVisible: false,
      editingTask: null,
      sharedUsers: [],
      assigneeEmail: null,
      subscription: null,
      shareDialogVisible: false,
      shareLink: '',
      emailShare: {
        recipients: [],
        message: ''
      },
      sending: false,
      files: [],
      showFileSelector: false,
      mentionIndex: -1,
      fileSearchQuery: '',
      editingCommentId: null,
      editingCommentText: '',
      currentUser: null,
      expandedCommentHistories: new Set(),
      showEditHistory: false,
      showTaskHistory: false,
      currentSelectorFolder: null,
      selectorBreadcrumbs: [],
      folders: [],
      showTypeahead: false,
      typeaheadSuggestions: [],
      typeaheadSelectedIndex: -1,
      typeaheadTimer: null,
      pythonApiBaseUrl: import.meta.env.VITE_PYTHON_API_URL  || 'http://localhost:3001',
      logHoursDialogVisible: false,
      newHoursLog: {
        time_taken: null,
        comment: ''
      },
      hours: '',
      minutes: '',
      timeError: '',
      hoursLogs: [],
      showAllLogs: false,
      //displayedHoursLogs: [],
      showAllLogs: false,
      tempDueDate: null,
      isEditingTitle: false,
      editingTitle: '',
      isEditingDescription: false,
      editingDescription: '',
      showArchivedComments: false,
      filteredComments: [],
      showSystemComments: false,
      isEditingStatus: false,
      statusText: '',
      isEditingPriority: false,
      isEditingAssignee: false,
      dueDatePopoverVisible: false,
      statusOptions: [
        { value: 'not_started', label: 'Not started' },
        { value: 'in_progress', label: 'In Progress' },
        { value: 'awaiting_external', label: 'Awaiting external factor' },
        { value: 'completed', label: 'Completed' }
      ],
      priorityOptions: [
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' }
      ]
    };
  },
  async created() {
    const taskId = this.$route.params.taskId;
    const { data: { user } } = await supabase.auth.getUser();
    this.currentUser = user;
    await this.loadTask(taskId);
    await this.loadSharedUsers();
    this.setupRealtimeSubscription();
    await this.loadHoursLogs();
  },
  unmounted() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  },
  methods: { 
    async handleDueDateChange(date) {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ 
          due_date: date ? date.toISOString() : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', this.task.id);

      if (error) throw error;
      this.tempDueDate = date;
      this.task.due_date = date;
      ElMessage.success('Due date updated successfully');
    } catch (error) {
      console.error('Error updating due date:', error);
      ElMessage.error('Failed to update due date');
      this.tempDueDate = this.task?.due_date ? new Date(this.task.due_date) : null;
    }
  },

  async clearDueDate() {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ 
          due_date: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', this.task.id);

      if (error) throw error;
      this.task.due_date = null;
      this.tempDueDate = null;
      ElMessage.success('Due date cleared successfully');
    } catch (error) {
      console.error('Error clearing due date:', error);
      ElMessage.error('Failed to clear due date');
    }
  },
    startDescriptionEdit() {
    this.editingDescription = this.task?.description || '';
    this.isEditingDescription = true;
  },

  async saveDescriptionEdit() {
    if (!this.editingDescription.trim() || this.editingDescription === this.task?.description) {
      this.cancelDescriptionEdit();
      return;
    }

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ 
          description: this.editingDescription,
          updated_at: new Date().toISOString()
        })
        .eq('id', this.task.id);

      if (error) throw error;
      console.log(this.editingDescription);
      this.task.description = this.editingDescription;

      ElMessage.success('Task description updated successfully');
      this.isEditingDescription = false;
    } catch (error) {
      console.error('Error updating task description:', error);
      ElMessage.error('Failed to update task description');
    }
  },

  cancelDescriptionEdit() {
    this.isEditingDescription = false;
    this.editingDescription = '';
  },
    startTitleEdit() {
    this.editingTitle = this.task?.title || '';
    this.isEditingTitle = true;
    this.$nextTick(() => {
      this.$refs.titleInput?.focus();
    });
  },

  async saveTitleEdit() {
    if (!this.editingTitle.trim() || this.editingTitle === this.task?.title) {
      this.cancelTitleEdit();
      return;
    }

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ 
          title: this.editingTitle,
          updated_at: new Date().toISOString()
        })
        .eq('id', this.task.id);

      if (error) throw error;

      this.task.title = this.editingTitle;
      ElMessage.success('Task title updated successfully');
      this.isEditingTitle = false;
    } catch (error) {
      console.error('Error updating task title:', error);
      ElMessage.error('Failed to update task title');
    }
  },

  cancelTitleEdit() {
    this.isEditingTitle = false;
    this.editingTitle = '';
  },
    async updateDueDate() {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ due_date: this.tempDueDate })
        .eq('id', this.task.id);

      if (error) throw error;

      ElMessage.success('Due date updated successfully');
      this.closeDueDatePopover();
    } catch (error) {
      console.error('Error updating due date:', error);
      ElMessage.error('Failed to update due date');
    }
  },


  closeDueDatePopover() {
    // Reset temp date and close popover
    this.tempDueDate = this.task?.due_date || null;
    const popover = document.querySelector('.due-date-popover');
    if (popover) {
      popover._instance.hide();
    }
  },
    async handleAssigneeChange(userId) {
    try {
      this.loading = true;
      const { error } = await supabase
        .from('tasks')
        .update({ assignee: userId || null })
        .eq('id', this.task.id);

      if (error) throw error;

      this.task.assignee = userId;
      this.assigneeEmail = this.sharedUsers.find(u => u.id === userId)?.email;
      
      // Use nextTick to ensure DOM updates before closing popover
      await this.$nextTick();
      if (this.$refs.assigneePopover) {
        this.$refs.assigneePopover.hide();
      }
      
      ElMessage.success('Assignee updated successfully');
    } catch (error) {
      ElMessage.error('Error updating assignee: ' + error.message);
    } finally {
      this.loading = false;
    }
  },
    toggleShowMore() {
    this.showAllLogs = !this.showAllLogs;
  },
    formatTime(time) {
      if (!time) return '0:00';
      const [hours, minutes] = time.split(':');
      return `${parseInt(hours)}h ${minutes}m`;
    },

    formatEmail(email) {
      if (!email) return 'Unknown';
      const [name] = email.split('@');
      return name.length > 15 ? name.substring(0, 12) + '...' : name;
    },

    formatDate(dateString) {
      return new Date(dateString).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    },

    formatTimeOnly(dateString) {
      return new Date(dateString).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit'
      });
    },

    formatDateTime(dateString) {
      return new Date(dateString).toLocaleString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    },

    getInitials(email) {
      if (!email) return '?';
      const [name] = email.split('@');
      return name.substring(0, 2).toUpperCase();
    },
    async handleStatusChange(status) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        const { error } = await supabase
          .from('tasks')
          .update({ 
            status: status,
            updated_at: new Date().toISOString()
          })
          .eq('id', this.task.id);

        if (error) throw error;

        // Update local state
        this.task.status = status;
        
        // Create activity log
        await supabase
          .from('task_comments')
          .insert({
            task_id: this.task.id,
            user_id: user.id,
            content: `Updated status from "${this.task.status}" to "${status}"`,
            type: 'activity',
            metadata: {
              action: 'update',
              changes: {
                status: {
                  from: this.task.status,
                  to: status
                }
              }
            }
          });

        ElMessage.success('Task status updated successfully');
        
        // Close the popover using the ref
        if (this.$refs.statusPopover) {
          this.$refs.statusPopover.hide();
        }
      } catch (error) {
        console.error('Error updating task status:', error);
        ElMessage.error('Failed to update task status');
      }
    },
    async handlePriorityChange(priority) {
      try {
        const { error } = await supabase
          .from('tasks')
          .update({ priority })
          .eq('id', this.task.id);

        if (error) throw error;

        // Update local task priority
        this.task.priority = priority;
        ElMessage.success('Task priority updated successfully');
        
        // Close the popover using the ref
        if (this.$refs.priorityPopover) {
          this.$refs.priorityPopover.hide();
        }

      } catch (error) {
        ElMessage.error('Error updating task priority: ' + error.message);
      }
    },
    async toggleTaskStar() {
    try {
      const isStarred = this.isTaskStarred;

      if (isStarred) {
        // Remove star
        const { error } = await supabase
          .from('task_stars')
          .delete()
          .eq('task_id', this.task.id)
          .eq('user_id', this.currentUser.id);

        if (error) throw error;
        this.task.task_stars = this.task.task_stars.filter(star => star.user_id !== this.currentUser.id);
      } else {
        // Add star
        const { data, error } = await supabase
          .from('task_stars')
          .insert({
            task_id: this.task.id,
            user_id: this.currentUser.id
          })
          .select();

        if (error) throw error;
        this.task.task_stars = [...(this.task.task_stars || []), data[0]];
      }

      ElMessage.success(`Task ${isStarred ? 'unstarred' : 'starred'} successfully`);
    } catch (error) {
      ElMessage.error('Error toggling star: ' + error.message);
    }
  },
    async loadTask(taskId) {
      try {
        this.loading = true;
        const { data: task, error } = await supabase
          .from('tasks')
          .select('*')
          .eq('id', taskId)
          .single();

        if (error) throw error;
        this.task = task;
        this.editingTask = { ...task };
        
        if (task.assignee) {
          const { data: userData } = await supabase
            .rpc('get_user_info_by_id', { user_id: task.assignee });
          this.assigneeEmail = userData?.[0]?.email;
        }

        await this.loadComments();
      } catch (error) {
        ElMessage.error('Error loading task: ' + error.message);
      } finally {
        this.loading = false;
      }
    },
    async loadComments() {
      try {
        this.loading = true;
        const { data: comments, error } = await supabase
          .from('task_comments')
          .select('*')
          .eq('task_id', this.task.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Load user emails for each comment
        for (const comment of comments) {
          if (!this.userEmails[comment.user_id]) {
            const { data: userData } = await supabase
              .rpc('get_user_info_by_id', {
                user_id: comment.user_id
              });
            if (userData?.[0]) {
              this.userEmails[comment.user_id] = userData[0].email;
            }
          }
        }

        // Filter comments based on archived status
        this.comments = comments.filter(comment => 
          this.showArchivedComments ? true : !comment.archived
        );
      } catch (error) {
        ElMessage.error('Error loading comments: ' + error.message);
      } finally {
        this.loading = false;
      }
    },
    async addComment() {
      if (!this.newComment.trim()) return;

      try {
        this.loading = true;
        const { data: { user } } = await supabase.auth.getUser();

        // First post the user's comment
        const { data, error } = await supabase
          .from('task_comments')
          .insert({
            task_id: this.task.id,
            user_id: user.id,
            content: this.newComment.trim()
          })
          .select();

        if (error) throw error;

        // Handle AI Attorney mentions
        const aiMentionRegex = /<span data-mention[^>]*data-id="([^"]+)"[^>]*>@([^<]+)<\/span>/g;
        const mentions = [...this.newComment.matchAll(aiMentionRegex)];

        for (const mention of mentions) {
          const mentionId = mention[1];
          const mentionName = mention[2];
          
          if (mentionId === 'aiAttorney') {
            // Handle default AI Attorney
            const prompt = this.newComment.replace(mention[0], '').trim();
            const aiResponse = await this.getAIResponse(prompt);
            await this.postAIResponse(aiResponse);
          } else if (!mentionId.includes('-')) { // Check if it's a UUID (user) or number (AI attorney)
            // Handle specific AI Attorney
            try {
              const { data: attorney } = await supabase
                .from('attorneys')
                .select('system_prompt')
                .eq('id', mentionId)
                .single();

              if (attorney) {
                const prompt = this.newComment.replace(mention[0], '').trim();
                const aiResponse = await this.getAIResponse(prompt, attorney.system_prompt);
                console.log('mentionName:', mentionName);
                await this.postAIResponse(aiResponse, mentionName);
              }
            } catch (error) {
              console.error('Error getting attorney:', error);
            }
          } else {
            // Handle user mentions (existing functionality)
            await this.createNotification(mentionId, 'mention', {
              task_id: this.task.id,
              task_title: this.task.title,
              comment_by: user.email
            });
          }
        }

        this.newComment = '';
        await this.loadComments();
        ElMessage.success('Comment added successfully');
      } catch (error) {
        ElMessage.error('Error adding comment: ' + error.message);
      } finally {
        this.loading = false;
      }
    },
    async getAIResponse(prompt, customSystemPrompt = null) {
      try {
        // Extract hyperlinks to image files using regex
        const imageLinkRegex = /\[([^\]]+\.(jpg|jpeg|png|gif|webp|pdf|txt))\]\(([^)]+\.(jpg|jpeg|png|gif|webp|pdf|txt))\)/gi;
        const imageLinks = [...prompt.matchAll(imageLinkRegex)];
        
        // Clean the prompt by removing markdown image links
        const cleanPrompt = prompt.replace(imageLinkRegex, '').trim();

        // Get the first image URL if available
        let imageUrl = null;
        if (imageLinks.length > 0) {
          imageUrl = imageLinks[0][3]; // Get URL from first match
        }

        const commentsHistory = this.comments.map(comment => {
          const timestamp = comment.updated_at || comment.created_at;
          const formattedDate = new Date(timestamp).toLocaleString();
          return `[${formattedDate}] ${this.userEmails[comment.user_id]}: ${comment.content}`;
        }).join('\n\n');

        const taskContext = `Task Title: "${this.task.title}"
        ${this.task.description ? `\nTask Description: ${this.task.description}` : ''}`;

        const systemPrompt = customSystemPrompt || `You are an AI legal assistant helping with the following task:`;

        const response = await fetch(`${this.pythonApiBaseUrl}/gpt/get_ai_response_v2`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: imageUrl? {
              text: cleanPrompt,
              image_url: imageUrl
            } : cleanPrompt,
            systemPrompt: systemPrompt + `\n\n${taskContext}` + `\n\nComment History:\n${commentsHistory}`,
            taskId: this.task.id,
            matterId: this.task.matter_id
          })
        });

        if (!response.ok) throw new Error('Failed to get AI response');

        const data = await response.json();
        return data;
      } catch (error) {
        console.error('Error getting AI response:', error);
        return 'Sorry, I encountered an error while processing your request.';
      }
    },
    async postAIResponse(response, attorneyName = null) {
      console.log('attorneyName:', attorneyName);
      try {
        const { error } = await supabase
          .from('task_comments')
          .insert({
            task_id: this.task.id,
            user_id: null,
            content: response.template_content,
            type: 'ai_response',
            metadata: {
              is_ai: true,
              ai_name: attorneyName || 'AI Attorney'
            }
          });

        if (error) throw error;
      } catch (error) {
        console.error('Error posting AI response:', error);
        ElMessage.error('Error posting AI response');
      }
    },
    async createNotification(userId, type, data) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        const { error } = await supabase
          .from('notifications')
          .insert([{
            user_id: userId,
            actor_id: user.id,
            type,
            data,
            read: false
          }]);

        if (error) throw error;
      } catch (error) {
        console.error('Error creating notification:', error);
      }
    },
    setupRealtimeSubscription() {
      if (this.subscription) {
        this.subscription.unsubscribe();
      }
      
      this.subscription = supabase
        .channel('task-comments-changes')
        .on('postgres_changes', 
          { 
            event: '*',
            schema: 'public',
            table: 'task_comments',
            filter: `task_id=eq.${this.task.id}`
          },
          async (payload) => {
            switch (payload.eventType) {
              case 'INSERT':
                // Load user email for new comment if not already cached
                if (!this.userEmails[payload.new.user_id]) {
                  const { data: userData } = await supabase
                    .rpc('get_user_info_by_id', {
                      user_id: payload.new.user_id
                    });
                  if (userData?.[0]) {
                    this.userEmails[payload.new.user_id] = userData[0].email;
                  }
                }
                // Add new comment to the beginning of the list
                this.comments.unshift(payload.new);
                break;
              
              case 'UPDATE':
                const updateIndex = this.comments.findIndex(comment => comment.id === payload.new.id);
                if (updateIndex !== -1) {
                  this.comments[updateIndex] = payload.new;
                }
                break;
              
              case 'DELETE':
                const deleteIndex = this.comments.findIndex(comment => comment.id === payload.old.id);
                if (deleteIndex !== -1) {
                  this.comments.splice(deleteIndex, 1);
                }
                break;
            }
          }
        )
        .subscribe();
    },
    async loadSharedUsers() {
      try {
        const { data: shares, error } = await supabase
          .from('matter_access')
          .select('shared_with_user_id')
          .eq('matter_id', this.currentMatter.id);

        if (error) throw error;

        // Get user details for each share using the RPC function
        const sharesWithUserInfo = await Promise.all(
          shares.map(async (share) => {
            const { data: userData } = await supabase
              .rpc('get_user_info_by_id', {
                user_id: share.shared_with_user_id
              });

            return {
              id: share.shared_with_user_id,
              email: userData?.[0]?.email
            };
          })
        );

        this.sharedUsers = sharesWithUserInfo;
      } catch (error) {
        ElMessage.error('Error loading users: ' + error.message);
      }
    },
    async updateTask() {
      try {
        this.loading = true;
        const originalTask = { ...this.task };
        const { data: { user } } = await supabase.auth.getUser();

        // Prepare edit history entries
        const historyEntries = [];
        
        if (originalTask.title !== this.editingTask.title) {
          historyEntries.push({
            field_name: 'title',
            previous_value: originalTask.title,
            edited_at: new Date().toISOString(),
            edited_by: user.id
          });
        }

        if (originalTask.description !== this.editingTask.description) {
          historyEntries.push({
            field_name: 'description',
            previous_value: originalTask.description,
            edited_at: new Date().toISOString(),
            edited_by: user.id
          });
        }

        if (originalTask.log_hours !== this.editingTask.log_hours) {
          historyEntries.push({
            field_name: 'log_hours',
            previous_value: originalTask.log_hours || 0,
            edited_at: new Date().toISOString(),
            edited_by: user.id
          });
        }

        const updateData = {
          title: this.editingTask.title,
          description: this.editingTask.description,
          status: this.editingTask.status,
          priority: this.editingTask.priority,
          due_date: this.editingTask.due_date,
          assignee: this.editingTask.assignee,
          log_hours: parseInt(this.editingTask.log_hours || 0)
        };

        // If there are history entries, add them to the update
        if (historyEntries.length > 0) {
          updateData.edit_history = this.task.edit_history 
            ? [...this.task.edit_history, ...historyEntries]
            : historyEntries;
        }

        const { data, error } = await supabase
          .from('tasks')
          .update(updateData)
          .eq('id', this.task.id)
          .select();

        if (error) throw error;

        // Update local task data
        this.task = data[0];
        
        // Create notifications for changes
        if (originalTask.assignee !== this.editingTask.assignee && this.editingTask.assignee) {
          await this.createNotification(
            this.editingTask.assignee,
            'task_assigned',
            { task_id: this.task.id, task_title: this.task.title }
          );
        }

        // Log changes as activity
        const changes = [];
        if (originalTask.title !== this.editingTask.title) {
          changes.push(`title from "${originalTask.title}" to "${this.editingTask.title}"`);
        }
        if (originalTask.status !== this.editingTask.status) {
          changes.push(`status from "${originalTask.status}" to "${this.editingTask.status}"`);
        }
        if (originalTask.priority !== this.editingTask.priority) {
          changes.push(`priority from "${originalTask.priority}" to "${this.editingTask.priority}"`);
        }
        if (originalTask.assignee !== this.editingTask.assignee) {
          const oldAssignee = this.sharedUsers.find(u => u.id === originalTask.assignee)?.email || 'unassigned';
          const newAssignee = this.sharedUsers.find(u => u.id === this.editingTask.assignee)?.email || 'unassigned';
          changes.push(`assignee from ${oldAssignee} to ${newAssignee}`);
        }
        if (originalTask.due_date !== this.editingTask.due_date) {
          const oldDate = originalTask.due_date ? new Date(originalTask.due_date).toLocaleDateString() : 'none';
          const newDate = this.editingTask.due_date ? new Date(this.editingTask.due_date).toLocaleDateString() : 'none';
          changes.push(`due date from ${oldDate} to ${newDate}`);
        }
        if (originalTask.log_hours !== this.editingTask.log_hours) {
          changes.push(`logged hours from ${originalTask.log_hours || 0} to ${this.editingTask.log_hours || 0}`);
        }

        if (changes.length > 0) {
          await supabase
            .from('task_comments')
            .insert({
              task_id: this.task.id,
              user_id: user.id,
              content: `Updated ${changes.join(' and ')}`,
              type: 'activity',
              metadata: {
                action: 'update',
                changes: {
                  title: this.editingTask.title !== originalTask.title ? {
                    from: originalTask.title,
                    to: this.editingTask.title
                  } : null,
                  status: this.editingTask.status !== originalTask.status ? {
                    from: originalTask.status,
                    to: this.editingTask.status
                  } : null,
                  priority: this.editingTask.priority !== originalTask.priority ? {
                    from: originalTask.priority,
                    to: this.editingTask.priority
                  } : null,
                  assignee: this.editingTask.assignee !== originalTask.assignee ? {
                    from: originalTask.assignee,
                    to: this.editingTask.assignee
                  } : null,
                  due_date: this.editingTask.due_date !== originalTask.due_date ? {
                    from: originalTask.due_date,
                    to: this.editingTask.due_date
                  } : null,
                  log_hours: this.editingTask.log_hours !== originalTask.log_hours ? {
                    from: parseInt(originalTask.log_hours || 0),
                    to: parseInt(this.editingTask.log_hours || 0)
                  } : null
                }
              }
            });
        }

        this.editDialogVisible = false;
        ElMessage.success('Task updated successfully');
        
        // Reload task to get fresh data
        await this.loadTask(this.task.id);
      } catch (error) {
        ElMessage.error('Error updating task: ' + error.message);
      } finally {
        this.loading = false;
      }
    },
    getStatusType(task) {
      if (!task) return 'info';
      switch (task.status) {
        case 'completed': return 'success';
        case 'in_progress': return 'warning';
        default: return 'info';
      }
    },
    formatStatus(status) {
      const statusMap = {
        'in_progress': 'In progress',
        'not_started': 'Not started',
        'completed': 'Completed',
        'awaiting_external': 'Awaiting external factor'
      };
      return statusMap[status] || status;
    },
    generateShareLink() {
      const baseUrl = window.location.origin;
      this.shareLink = `${baseUrl}/single-matter/${this.currentMatter.id}/tasks/${this.task.id}`;
    },
    async copyLink() {
      try {
        await navigator.clipboard.writeText(this.shareLink);
        ElMessage.success('Link copied to clipboard');
      } catch (error) {
        ElMessage.error('Failed to copy link');
      }
    },
    async shareViaEmail() {
      if (!this.emailShare.recipients.length) return;

      try {
        this.sending = true;
        const { data: { user } } = await supabase.auth.getUser();
        
        // Send email through your backend service
        const response = await fetch('/api/share-task', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            taskId: this.task.id,
            recipients: this.emailShare.recipients,
            message: this.emailShare.message,
            sender: user.email,
            taskTitle: this.task.title,
            taskLink: this.shareLink
          })
        });

        if (!response.ok) throw new Error('Failed to send email');

        ElMessage.success('Task shared successfully');
        this.shareDialogVisible = false;
        this.emailShare.recipients = [];
        this.emailShare.message = '';
      } catch (error) {
        ElMessage.error('Error sharing task: ' + error.message);
      } finally {
        this.sending = false;
      }
    },
    formatCommentContent(text) {
      if (!text) return '';
      
      // Replace markdown file links with custom file links
      return text.split('\n').map(line => line.trim()).join('<br>').replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, fileName, fileUrl) => {
        return `<a class="file-link" href="${fileUrl}" target="_blank" title="Click to view file">
          ${fileName}
        </a>`;
      });
    },
    async loadFiles() {
      try {
        const giteaToken = import.meta.env.VITE_GITEA_TOKEN;
        const giteaHost = import.meta.env.VITE_GITEA_HOST;
        
        const { data: matter, error: matterError } = await supabase
          .from('matters')
          .select('git_repo')
          .eq('id', this.currentMatter.id)
          .single();

        if (matterError) throw new Error('Failed to fetch matter details');
        if (!matter?.git_repo) throw new Error('No git repository found for this matter');

        const path = this.currentSelectorFolder?.path || '';
        const response = await fetch(
          `${giteaHost}/api/v1/repos/associateattorney/${matter.git_repo}/contents/${path}`,
          {
            headers: {
              'Authorization': `token ${giteaToken}`,
              'Accept': 'application/json',
              'Authorization': `token ${giteaToken}`,
              'Accept': 'application/json',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache'
            }
          }
        );

        if (!response.ok) throw new Error('Failed to fetch files');

        const contents = await response.json();
        
        // Separate files and folders
        this.folders = contents
          .filter(item => item.type === 'dir')
          .map(folder => ({
            id: folder.sha,
            name: folder.name,
            path: folder.path,
            type: 'dir'
          }));

        this.files = contents
          .filter(item => item.type === 'file' && item.name !== '.gitkeep')
          .map(file => ({
            id: file.sha,
            name: file.name,
            path: file.path,
            type: 'file',
            download_url: file.download_url
          }));

      } catch (error) {
        ElMessage.error('Error loading files: ' + error.message);
        this.files = [];
        this.folders = [];
      }
    },

    handleInput(event) {
      const text = typeof event === 'string' ? event : event?.target?.value || '';
      
      // Get the current cursor position from the active textarea
      const textarea = document.activeElement;
      const selectionStart = textarea?.selectionStart || 0;
      
      const lastWord = text.slice(0, selectionStart).split(/\s+/).pop();
      
      if (lastWord === '@files') {
        this.showFileSelector = true;
        this.mentionIndex = selectionStart;
        this.loadFiles();
      }
    },

    selectFile(file) {
      // Determine which field we're editing
      const isEditingDescription = this.editDialogVisible;
      const text = isEditingDescription ? this.editingTask.description : this.newComment;
      
      const beforeMention = text.slice(0, this.mentionIndex - 6); // Remove '@files'
      const afterMention = text.slice(this.mentionIndex);
      const newText = `${beforeMention}[${file.name}](${file.download_url})${afterMention}`;
      
      // Update the appropriate field
      if (isEditingDescription) {
        this.editingTask.description = newText;
      } else {
        this.newComment = newText;
      }
      
      this.showFileSelector = false;
      this.fileSearchQuery = '';
    },

    startEditing(comment) {
      this.editingCommentId = comment.id;
      this.editingCommentText = comment.content;
    },

    cancelEditing() {
      this.editingCommentId = null;
      this.editingCommentText = '';
    },

    async saveCommentEdit(comment) {
      try {
        const { error } = await supabase
          .from('task_comments')
          .update({ 
            content: this.editingCommentText,
            updated_at: new Date().toISOString(),
            comment_edit_history: [
              ...(comment.comment_edit_history || []),
              {
                previous_content: comment.content,
                edited_at: new Date().toISOString(),
                edited_by: this.currentUser.id
              }
            ]
          })
          .eq('id', comment.id);

        if (error) throw error;

        // Update local comment
        const commentIndex = this.comments.findIndex(c => c.id === comment.id);
        if (commentIndex !== -1) {
          this.comments[commentIndex] = {
            ...comment,
            content: this.editingCommentText,
            updated_at: new Date().toISOString()
          };
        }

        this.cancelEditing();
        ElMessage.success('Comment updated successfully');
      } catch (error) {
        console.error('Error updating comment:', error);
        ElMessage.error('Failed to update comment');
      }
    },

    toggleHistory(commentId) {
      if (this.expandedCommentHistories.has(commentId)) {
        this.expandedCommentHistories.delete(commentId);
      } else {
        this.expandedCommentHistories.add(commentId);
      }
    },

    toggleTaskHistory() {
      this.showTaskHistory = !this.showTaskHistory;
    },

    async navigateSelectorFolder(folder) {
      try {
        if (!folder) {
          // Reset to root
          this.currentSelectorFolder = null;
          this.selectorBreadcrumbs = [];
        } else {
          // Find if folder exists in current breadcrumbs
          const existingIndex = this.selectorBreadcrumbs.findIndex(f => f.id === folder.id);
          
          if (existingIndex >= 0) {
            // Clicking a folder in breadcrumbs - truncate to that point
            this.selectorBreadcrumbs = this.selectorBreadcrumbs.slice(0, existingIndex + 1);
          } else {
            // New folder - add to breadcrumbs
            this.selectorBreadcrumbs.push(folder);
          }
          this.currentSelectorFolder = folder;
        }

        await this.loadFiles();
      } catch (error) {
        ElMessage.error('Error navigating to folder: ' + error.message);
        this.currentSelectorFolder = null;
        this.selectorBreadcrumbs = [];
      }
    },

    async getTypeaheadSuggestions(text, cursorPosition) {
      try {
        const response = await fetch(`${this.pythonApiBaseUrl}/gpt/get_typeahead_suggestions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text,
            cursorPosition,
            systemPrompt: `Task context: ${this.task.title}. ${this.task.description || ''}`
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to get suggestions: ${errorText}`);
        }
        
        const data = await response.json();
        
        if (data.suggestions?.length) {
          this.typeaheadSuggestions = data.suggestions;
          this.showTypeahead = true;
          this.typeaheadSelectedIndex = -1;
        } else {
          this.showTypeahead = false;
        }
      } catch (error) {
        console.error('Error getting suggestions:', error);
        this.showTypeahead = false;
      }
    },

    handleDescriptionInput(event) {
      const text = typeof event === 'string' ? event : event?.target?.value || '';
      const cursorPos = typeof event === 'string' ? event.length : event?.target?.selectionStart || 0;

      if (this.typeaheadTimer) {
        clearTimeout(this.typeaheadTimer);
      }
      
      this.typeaheadTimer = setTimeout(() => {
        this.getTypeaheadSuggestions(text, cursorPos);
      }, 300);
    },

    applySuggestion(suggestion) {
      const textarea = document.querySelector('.description-input textarea');
      const cursorPos = textarea.selectionStart;
      const text = this.editingTask.description;
      
      const words = text.slice(0, cursorPos).split(' ');
      const lastWord = words[words.length - 1];
      
      words[words.length - 1] = suggestion;
      this.editingTask.description = words.join(' ') + text.slice(cursorPos);
      
      this.showTypeahead = false;
      this.typeaheadSuggestions = [];
      
      this.$nextTick(() => {
        const newPos = cursorPos - lastWord.length + suggestion.length;
        textarea.setSelectionRange(newPos, newPos);
        textarea.focus();
      });
    },

    handleTypeaheadNavigation(event) {
      if (!this.showTypeahead || !this.typeaheadSuggestions.length) return;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          this.typeaheadSelectedIndex = Math.min(
            this.typeaheadSelectedIndex + 1,
            this.typeaheadSuggestions.length - 1
          );
          break;
        case 'ArrowUp':
          event.preventDefault();
          this.typeaheadSelectedIndex = Math.max(this.typeaheadSelectedIndex - 1, -1);
          break;
        case 'Tab':
        case 'Enter':
          event.preventDefault();
          if (this.typeaheadSelectedIndex >= 0) {
            this.applySuggestion(this.typeaheadSuggestions[this.typeaheadSelectedIndex]);
          }
          break;
        case 'Escape':
          this.showTypeahead = false;
          break;
      }
    },

    async loadHoursLogs() {
      try {
        const { data: logs, error } = await supabase
          .from('task_hours_logs')
          .select('*')
          .eq('task_id', this.task.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

         // Trim time_taken to HH:MM format
         this.hoursLogs = logs.map(log => ({
          ...log,
          time_taken: log.time_taken ? log.time_taken.substring(0, 5) : null
        }));

        // Load user emails for each log
        for (const log of logs) {
          if (!this.userEmails[log.user_id]) {
            const { data: userData } = await supabase
              .rpc('get_user_info_by_id', { user_id: log.user_id });
            if (userData?.[0]) {
              this.userEmails[log.user_id] = userData[0].email;
            }
          }
        }
      } catch (error) {
        ElMessage.error('Error loading hours logs: ' + error.message);
      }
    },

    
    validateHours(value) {
      // Remove non-numeric characters
      let cleanValue = value.replace(/[^\d]/g, '');
      
      // Convert to number for validation
      let numValue = parseInt(cleanValue);
      
      // Validate range
      if (numValue > 12) {
        cleanValue = '12';
      }
      
      this.hours = cleanValue;
      this.updateTimeTaken();
    },

    validateMinutes(value) {
      // Remove non-numeric characters
      let cleanValue = value.replace(/[^\d]/g, '');
      
      // Convert to number for validation
      let numValue = parseInt(cleanValue);
      
      // Validate range
      if (numValue > 59) {
        cleanValue = '59';
      }
      
      this.minutes = cleanValue;
      this.updateTimeTaken();
    },

    formatHours() {
      if (this.hours) {
        // Pad with leading zero if needed
        this.hours = String(parseInt(this.hours)).padStart(2, '0');
      }
      this.validateTimeInput();
    },

    formatMinutes() {
      if (this.minutes) {
        // Pad with leading zero if needed
        this.minutes = String(parseInt(this.minutes)).padStart(2, '0');
      }
      this.validateTimeInput();
    },

    validateTimeInput() {
      const hours = parseInt(this.hours || '0');
      const minutes = parseInt(this.minutes || '0');

      if (hours === 0 && minutes === 0) {
        this.timeError = 'Time must be greater than 0';
        this.newHoursLog.time_taken = null;
        return false;
      }

      if (hours < 0 || hours > 12) {
        this.timeError = 'Hours must be between 0 and 12';
        this.newHoursLog.time_taken = null;
        return false;
      }

      if (minutes < 0 || minutes > 59) {
        this.timeError = 'Minutes must be between 0 and 59';
        this.newHoursLog.time_taken = null;
        return false;
      }

      this.timeError = '';
      return true;
    },
    handleMinutesKeydown(event) {
      // If backspace is pressed and minutes is empty, move to hours input
      if (event.key === 'Backspace' && !this.minutes) {
        this.$refs.hoursInput.$el.querySelector('input').focus();
      }
    },

    updateTimeTaken() {
      if (this.validateTimeInput()) {
        const formattedHours = String(parseInt(this.hours || '0')).padStart(2, '0');
        const formattedMinutes = String(parseInt(this.minutes || '0')).padStart(2, '0');
        this.newHoursLog.time_taken = `${formattedHours}:${formattedMinutes}:00`;
      }
    },

    resetTimeInputs() {
      this.hours = '';
      this.minutes = '';
      this.timeError = '';
      this.newHoursLog.time_taken = null;
    },

    async submitHoursLog() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        const { error } = await supabase
          .from('task_hours_logs')
          .insert({
            task_id: this.task.id,
            user_id: user.id,
            time_taken: this.newHoursLog.time_taken,
            comment: this.newHoursLog.comment
          });

        if (error) throw error;

        this.logHoursDialogVisible = false;
        this.newHoursLog = { time_taken: null, comment: '' };
        await this.loadHoursLogs();
        ElMessage.success('Hours logged successfully');
      } catch (error) {
        ElMessage.error('Error logging hours: ' + error.message);
      }
    },
    
    handleHoursKeyup(event) {
      // If 2 digits entered in hours, move to minutes
      if (this.hours.length === 2 && parseInt(this.hours) <= 12) {
        this.$refs.minutesInput.$el.querySelector('input').focus();
      }
    },

    toggleShowMore() {
      this.showAllLogs = !this.showAllLogs;
      this.displayedHoursLogs = this.showAllLogs ? this.hoursLogs : this.hoursLogs.slice(0, 3);
    },

    async handleAssigneeChange(userId) {
      try {
        this.loading = true;
        const { error } = await supabase
          .from('tasks')
          .update({ assignee: userId || null })
          .eq('id', this.task.id);

        if (error) throw error;

        this.task.assignee = userId;
        this.assigneeEmail = this.sharedUsers.find(u => u.id === userId)?.email;
        
        // Use nextTick to ensure DOM updates before closing popover
        await this.$nextTick();
        if (this.$refs.assigneePopover) {
          this.$refs.assigneePopover.hide();
        }
        
        ElMessage.success('Assignee updated successfully');
      } catch (error) {
        ElMessage.error('Error updating assignee: ' + error.message);
      } finally {
        this.loading = false;
      }
    },
    updateDueDate() {
      this.task.due_date = this.tempDueDate;
      this.closeDueDatePopover();
    },
    closeDueDatePopover() {
      this.$refs.dueDatePopover.close();
    },
    startTitleEdit() {
      this.isEditingTitle = true;
      this.editingTitle = this.task?.title || '';
    },
    cancelTitleEdit() {
      this.isEditingTitle = false;
      this.editingTitle = '';
    },
    startDescriptionEdit() {
      this.isEditingDescription = true;
      this.editingDescription = this.task?.description || '';
    },
    cancelDescriptionEdit() {
      this.isEditingDescription = false;
      this.editingDescription = '';
    },
    async updateParentTask(parentTaskId) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        // Convert empty string to null for database
        const newParentTaskId = parentTaskId === '' ? null : parentTaskId;
        
        const { error } = await supabase
          .from('tasks')
          .update({ 
            parent_task_id: newParentTaskId,
            updated_at: new Date().toISOString()
          })
          .eq('id', this.task.id);

        if (error) throw error;

        // Update local task data
        this.task.parent_task_id = newParentTaskId;
        
        // Create activity log
        const newParentTask = this.flattenedTasks.find(t => t.id === parentTaskId);
        const activityMessage = parentTaskId 
          ? `Set parent task to "${newParentTask.title}"`
          : 'Removed parent task';

        await supabase
          .from('task_comments')
          .insert({
            task_id: this.task.id,
            user_id: user.id,
            content: activityMessage,
            type: 'activity',
            metadata: {
              action: 'update',
              changes: {
                parent_task_id: {
                  from: this.task.parent_task_id,
                  to: newParentTaskId
                }
              }
            }
          });

        ElMessage.success(activityMessage);
      } catch (error) {
        console.error('Error updating parent task:', error);
        ElMessage.error('Failed to update parent task');
      }
    },
    organizeTasksHierarchy(tasks) {
      // Create a map of all tasks
      const taskMap = new Map(tasks.map(task => [task.id, { ...task, children: [] }]));
      const rootTasks = [];

      // Organize tasks into hierarchy
      for (const task of taskMap.values()) {
        if (task.parent_task_id && taskMap.has(task.parent_task_id)) {
          taskMap.get(task.parent_task_id).children.push(task);
        } else {
          rootTasks.push(task);
        }
      }

      return rootTasks;
    },
    async toggleArchiveComment(comment) {
      try {
        const newArchivedState = !comment.archived;
        const { error } = await supabase
          .from('task_comments')
          .update({ 
            archived: newArchivedState,
            updated_at: new Date().toISOString()
          })
          .eq('id', comment.id);

        if (error) throw error;

        // Update local comment
        comment.archived = newArchivedState;
        ElMessage.success(`Comment ${newArchivedState ? 'archived' : 'unarchived'} successfully`);
        
        await this.loadComments();
      } catch (error) {
        console.error('Error toggling comment archive:', error);
        ElMessage.error('Failed to update comment archive status');
      }
    },
    toggleCommentHistory(comment) {
      if (this.expandedCommentHistories.has(comment.id)) {
        this.expandedCommentHistories.delete(comment.id);
      } else {
        this.expandedCommentHistories.add(comment.id);
      }
    },
    toggleArchived() {
      this.showArchivedComments = !this.showArchivedComments;
      this.loadComments();
    },
    startStatusEdit() {
      this.isEditingStatus = true;
    },
    formatPriority(priority) {
      if (!priority) return 'Not set';
      return priority.charAt(0).toUpperCase() + priority.slice(1);
    },
    getPriorityType(task) {
      if (!task?.priority) return '';
      switch (task.priority) {
        case 'high': return 'danger';
        case 'medium': return 'warning';
        case 'low': return 'info';
        default: return '';
      }
    },
    startPriorityEdit() {
      this.isEditingPriority = true;
    },
    startAssigneeEdit() {
      this.isEditingAssignee = true;
    },
    showDueDatePopover() {
      this.tempDueDate = this.task?.due_date;
      this.dueDatePopoverVisible = true;
    },
    saveDueDate() {
      this.task.due_date = this.tempDueDate;
      this.closeDueDatePopover();
      ElMessage.success('Due date updated successfully');
    },
    initializeTempDueDate() {
      this.tempDueDate = this.task?.due_date ? new Date(this.task.due_date) : null;
    },
  },
  watch: {
    shareDialogVisible(newVal) {
      if (newVal) {
        this.generateShareLink();
      }
    }
  },
  computed: { 
    displayedHoursLogs() {
    return this.showAllLogs ? this.hoursLogs : this.hoursLogs.slice(0, 3);
  },
    isTaskStarred() {
    return this.task?.task_stars?.some(star => star.user_id === this.currentUser?.id) || false;
  },
  starredByText() {
    if (!this.task?.task_stars?.length) return '';
    
    const starredUsers = this.task.task_stars.map(star => {
      return this.userEmails[star.user_id] || 'Unknown user';
    });

    if (starredUsers.length === 1) {
      return `Starred by ${starredUsers[0]}`;
    } else if (starredUsers.length === 2) {
      return `Starred by ${starredUsers.join(' and ')}`;
    } else {
      const othersCount = starredUsers.length - 2;
      return `Starred by ${starredUsers[0]}, ${starredUsers[1]} and ${othersCount} other${othersCount > 1 ? 's' : ''}`;
    }
  },
    filteredFiles() {
      const items = [...this.folders, ...this.files];
      if (!this.fileSearchQuery) return items;
      const query = this.fileSearchQuery.toLowerCase();
      return items.filter(item => 
        item.name.toLowerCase().includes(query)
      );
    },
    totalHours() {
      return this.hoursLogs.reduce((sum, log) => sum + (log.hours || 0), 0).toFixed(2);
    },
    formatTotalTime() {
      const totalMinutes = this.hoursLogs.reduce((sum, log) => {
        if (!log.time_taken) return sum;
        const [hours, minutes] = log.time_taken.split(':').map(Number);
        return sum + (hours * 60) + minutes;
      }, 0);

      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  },
    canEditTask() {
      if (!this.currentMatter || !this.currentUser) return false;
      const userAccess = this.sharedUsers.find(u => u.id === this.currentUser.id);
      return userAccess?.access_type === 'edit';
    },
    
    flattenedTasks() {
      const flattened = [{
        id: '',
        title: '- no parent -'
      }];
      
      // Helper function to get all predecessor task IDs
      const getPredecessorIds = (taskId, taskMap, visited = new Set()) => {
        if (visited.has(taskId)) return [];
        visited.add(taskId);
        
        const task = taskMap.get(taskId);
        if (!task) return [];
        
        const predecessors = [taskId];
        if (task.parent_task_id) {
          predecessors.push(...getPredecessorIds(task.parent_task_id, taskMap, visited));
        }
        return predecessors;
      };

      // Helper function to get all descendant task IDs
      const getDescendantIds = (taskId, taskMap) => {
        const descendants = [];
        const task = taskMap.get(taskId);
        if (!task) return descendants;

        for (const [id, t] of taskMap.entries()) {
          if (t.parent_task_id === taskId) {
            descendants.push(id);
            descendants.push(...getDescendantIds(id, taskMap));
          }
        }
        return descendants;
      };

      const flatten = (tasks, depth = 0) => {
        const taskMap = new Map(tasks.map(task => [task.id, task]));
        
        // Get all invalid task IDs (current task, predecessors, and descendants)
        const invalidTaskIds = new Set([
          this.task?.id,
          ...getPredecessorIds(this.task?.id, taskMap),
          ...getDescendantIds(this.task?.id, taskMap)
        ]);

        for (const task of tasks) {
          // Only include tasks that aren't in the invalid set
          if (!invalidTaskIds.has(task.id)) {
            flattened.push({
              id: task.id || '',
              title: '  '.repeat(depth) + task.title
            });
            if (task.children?.length) {
              flatten(task.children, depth + 1);
            }
          }
        }
      };
      
      const cachedTasks = this.cacheStore.getCachedData('tasks', this.currentMatter?.id) || [];
      const organizedTasks = this.organizeTasksHierarchy(cachedTasks);
      flatten(organizedTasks);
      
      return flattened;
  },
    filteredComments() {
      return this.comments.filter(comment => {
        // Handle archived comments
        if (!this.showArchivedComments && comment.archived) {
          return false;
        }
        
        // Handle system comments
        if (!this.showSystemComments && comment.type === 'activity') {
          return false;
        }
        
        return true;
      });
    }
  }
};
</script>

<style scoped>

.status-item, .priority-item, .due-date-item{
  width: 100px;
}

.description-wrapper {
  margin-top: 24px;
  background: var(--el-bg-color);
  border-radius: 8px;
  padding: 16px;
  border: 1px solid var(--el-border-color-light);
}

.description-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.description-header h3 {
  margin: 0;
  color: #303133;
  font-size: 18px;
  text-decoration: underline;
}

.description-wrapper > p.description {
  position: relative;
  padding-left: 16px;
  border-left: 3px solid var(--el-color-primary-light-5);
  padding: 12px 16px;
  border-radius: 4px;
  margin: 0;
  font-size: 15px;
  white-space: pre-wrap;
  word-wrap: break-word;
  word-break: break-word;
  overflow-wrap: break-word;
  max-width: 100%;
}

/* Add mobile-specific adjustments */
@media (max-width: 768px) {
  .description {
    padding: 8px 4px;         /* Reduce padding on mobile */
    font-size: 14px;          /* Slightly smaller font on mobile */
  }
}

.description:hover {
  background-color: var(--el-bg-color);
}

.description-edit {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.description-edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.title-wrapper {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.star-container {
  display: inline-flex;
  align-items: center;
  padding-top: 4px; /* Align with title text */
}

.title-edit-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px;
  min-width: 0;
}

.editable-title {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  margin: 0;
}

.editable-title:hover {
  background-color: var(--el-bg-color);
}

.editable-title .edit-icon {
  opacity: 0;
  transition: opacity 0.3s;
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.editable-title:hover .edit-icon {
  opacity: 1;
}

.title-edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.task-metadata {
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  padding: 1rem;
  width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}

.metadata-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  width: 100%;
  margin: 1rem 0;
}

.metadata-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
}

.metadata-label {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.label-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-content {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 24px; /* To align with the icon */
}

.status-label {
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.status-display {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-text {
  font-size: 14px;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}

.spacer {
  width: 8px; /* Fixed space after "Status" */
  flex: none;
}

/* Mobile adjustments */
@media (max-width: 768px) {
  .status-content {
    justify-content: flex-start; /* Align content to start on mobile */
  }
}

.edit-icon {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s;
}

/* Show edit icon on mobile */
@media (max-width: 768px) {
  .edit-icon {
    opacity: 1;
  }
}

/* Show edit icon on hover for desktop */
.status-display:hover .edit-icon {
  opacity: 1;
}

.metadata-label .el-icon {
  font-size: 16px;
}

.status-tag,
.priority-tag,
.due-date-display,
.assignee-display {
  width: 100%;
  min-width: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  overflow: hidden; /* Add this to prevent overflow */
}

.due-date-display,
.assignee-display {
  padding: 5px 3px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  transition: all 0.3s;
}

.due-date-display:hover,
.assignee-display:hover {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}

.assignee-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

@media (max-width: 768px) {
  .metadata-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .metadata-item {
    display: flex;
    width: 100%;
    padding: 8px 0;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .metadata-label {
    display: flex;
    flex-direction: row;
    width: 100%;
  }

  .label-header {
    width: 100px; /* Fixed width for labels */
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .status-content {
    flex: 1;
    padding-left: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .status-display {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .status-text {
    flex: 1;
  }

  .edit-icon {
    opacity: 1;
    margin-left: 8px;
  }
}

/* Tablet and desktop styles */
@media (min-width: 769px) {
  .metadata-grid {
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  }
}

.due-date-display {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 3px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s;
  color: var(--el-text-color-secondary);
}

.due-date-display:hover {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}

.due-date-editor {
  padding: 8px;
}

.due-date-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
  gap: 8px;
}

:deep(.el-popover.due-date-popover) {
  padding: 16px;
}
.assignee-display {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 3px 6px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s;
}

.assignee-display:hover {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}

.assignee-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

:deep(.el-dropdown-menu__item) {
  display: flex;
  align-items: center;
  gap: 8px;
}

:deep(.el-avatar) {
  background-color: var(--el-color-primary);
  color: white;
  font-size: 12px;
}
.hours-logs {
  margin-top: 24px;
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
}

.hours-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.hours-header h3 {
  margin: 0;
  color: #303133;
  font-size: 18px;
  text-decoration: underline;
}

.total-hours .el-tag {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
}

.total-time {
  font-size: 15px;
  font-weight: 500;
}

.hours-table {
  border-radius: 8px;
  overflow: hidden;
}

.time-wrapper,
.user-wrapper,
.date-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.time-cell {
  font-family: 'Roboto Mono', monospace;
  font-size: 14px;
  /* color: #409EFF; */
  font-weight: 500;
}

.comment-cell {
  padding: 8px 0;
  color: #606266;
  line-height: 1.5;
}

.no-comment {
  color: #909399;
  font-style: italic;
}

.user-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-avatar {
  background: #409EFF;
  font-size: 12px;
}

.user-cell {
  color: #606266;
  font-weight: 500;
}

.date-wrapper {
  /* display: flex; */
  /* flex-direction: column; */
  align-items: center;
}

.date-cell {
  color: #606266;
  font-weight: 500;
}

.time-stamp {
  color: #909399;
  font-size: 12px;
  margin-top: 2px;
}

:deep(.el-table) {
  --el-table-border-color: #EBEEF5;
  --el-table-header-bg-color: #F5F7FA;
  --el-table-row-hover-bg-color: #F5F7FA;
}

:deep(.el-table th) {
  font-weight: 600;
  color: #303133;
  background: var(--el-table-header-bg-color);
  padding: 12px 0;
}

:deep(.el-table td) {
  padding: 1px 0;
}

:deep(.hours-table-row:hover) td {
  background-color: #F5F7FA !important;
}

:deep(.el-table--striped .el-table__body tr.el-table__row--striped td) {
  background: #FAFAFA;
}

.priority-tag {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  margin-right: 12px;
}

.priority-tag:hover {
  opacity: 0.8;
}

.star-icon {
  cursor: pointer;
  font-size: 18px;
  color: #909399;
  transition: color 0.3s;
}
.star-icon.starred {
  color: #f0c541;
  font-size: 18px;
}

.star-button {
  margin-right: 4px;
}

.star-button :deep(.el-icon) {
  font-size: 16px;
}

.star-count {
  font-size: 14px;
  color: #606266;
  cursor: default;
}
.single-task-view {
  padding: 20px;
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.task-content {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.task-main-info {
  background: white;
  padding: 24px;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
}

.task-metadata {
  display: flex;
  gap: 16px;
  align-items: center;
  margin: 16px 0;
}

.description {
  margin-top: 16px;
  color: #606266;
}

.task-comments {
  background: white;
  padding: 24px;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
}

.comments-list {
  margin: 20px 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Reuse comment styles from QuickTaskViewCt.vue */
/* Lines 209-256 */

.header-actions {
  display: flex;
  gap: 4px; /* Reduced from 8px to 4px */
}

.share-options {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.share-link-section,
.share-email-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

h4 {
  margin: 0;
  color: #606266;
}

.link-input {
  display: flex;
  gap: 12px;
}

.comment-item {
  margin-bottom: 1rem;
}

.comment-content {
  background-color: #f5f7fa;
  padding: 12px;
  border-radius: 8px;
}

.comment-content.activity {
  background-color: #f0f9ff;
  font-style: italic;
  font-size: 0.95em;
}

.comment-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 0.9em;
}

.comment-author {
  font-weight: 500;
  color: #409EFF;
}

.comment-date {
  color: #909399;
}

.comment-text {
  color: #606266;
  white-space: normal;
}

.comment-text :deep(a.file-link) {
  color: #409EFF;
  text-decoration: none;
}

.comment-text :deep(a.file-link:hover) {
  text-decoration: underline;
}

.comment-text:deep(a) {
  color: #409EFF;
  text-decoration: none;
}

.description:deep(a) {
  color: #409EFF;
  text-decoration: none;
}
.description-edit:deep(a) {
  color: #409EFF;
  text-decoration: none;
}


.comments-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

/* Add responsive styles for comments */
@media (max-width: 640px) {
  .task-comments {
    padding: 16px;
  }
  
  .comment-content {
    padding: 10px;
  }
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.file-item {
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.file-item:hover {
  background-color: #f5f7fa;
}

.edit-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 8px;
}

.typeahead-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid #dcdfe6;
  background-color: #f5f7fa;
}

.typeahead-header span {
  color: #909399;
  font-size: 0.9em;
}

.close-button {
  padding: 2px;
}

.close-button:hover {
  color: #409EFF;
}

.comment-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.comment-actions .el-dropdown {
  margin-left: 4px;
}

.comment-actions .el-button {
  padding: 4px;
  height: auto;
}

.comment-actions .el-icon {
  font-size: 16px;
  color: #909399;
}

.edited-marker {
  font-size: 0.9em;
  color: #909399;
  cursor: pointer;
}

.edited-marker:hover {
  text-decoration: underline;
}

.edit-history {
  margin-top: 8px;
  padding: 8px;
  background: #f9f9f9;
  border-radius: 4px;
}

.edit-history-entry {
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #eee;
}

.edit-history-entry:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.edit-history-header {
  font-weight: 500;
  margin-bottom: 8px;
  color: #606266;
}

.previous-content {
  background: #f5f7fa;
  padding: 8px;
  border-radius: 4px;
  margin-bottom: 8px;
  white-space: pre-wrap;
}

.edit-metadata {
  font-size: 0.8em;
  color: #909399;
}

.task-title-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
}

.title-main-section {
  flex: 1;
  min-width: 0;
}

.title-wrapper {
  flex: 1;
  min-width: 0;
}

.editable-title {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  margin: 0;
  min-width: 0;
}

.star-container {
  display: inline-flex;  /* Change from flex to inline-flex */
  align-items: center;
  margin-right: -4px;  /* Add negative margin to reduce space */
}

.star-icon {
  cursor: pointer;
  font-size: 16px;  /* Reduce from 18px to 16px */
  color: #909399;
  transition: color 0.3s;
  padding: 4px;  /* Add padding for better click target while maintaining visual compactness */
}

.star-icon.starred {
  color: #f0c541;
}

.edit-metadata {
  display: flex;
  align-items: center;
  white-space: nowrap;
  margin-left: auto;
}

.edited-marker {
  font-size: 0.9em;
  color: #909399;
  cursor: pointer;
}

.edited-marker:hover {
  text-decoration: underline;
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .task-title-header {
    flex-direction: column;
  }
  
  .edit-metadata {
    align-self: flex-end;
  }
}

.status-display {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-text {
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.edit-icon {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s;
}

/* Show edit icon on mobile */
@media (max-width: 768px) {
  .edit-icon {
    opacity: 1;
  }
}

/* Show edit icon on hover for desktop */
.status-display:hover .edit-icon {
  opacity: 1;
}

.log-hours-btn,
.share-task-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0; /* Explicitly remove any margins */
  padding: 8px 12px; /* Consistent padding */
}

@media (max-width: 768px) {
  .log-hours-btn .log-hours-text,
  .share-task-btn .share-task-text {
    display: none;
  }
  
  .log-hours-btn,
  .share-task-btn {
    padding: 8px;
    min-height: 32px;
    min-width: 32px;
    margin: 0;
  }
}

.share-task-btn {
  display: flex;
  align-items: center;
  gap: 6px;
}

@media (max-width: 768px) {
  .share-task-btn .share-task-text {
    display: none;
  }
  
  .share-task-btn {
    padding: 8px;
    min-height: 32px;
    min-width: 32px;
  }
}
</style> 

<style>
table.editor-table {
  border-collapse: collapse;
  margin: 1.5em 0;
  width: 100%;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
  border: 1px solid var(--el-border-color);

  th, td {
    padding: 12px 16px;
    text-align: left;
    border: 1px solid var(--el-border-color-lighter);
    line-height: 1.5;
    font-size: 14px;

    &:first-child {
      padding-left: 16px;
    }

    &:last-child {
      padding-right: 16px;
    }
  }

  th {
    background: var(--el-fill-color-light);
    font-weight: 600;
    color: var(--el-text-color-primary);
    white-space: nowrap;
  }

  tr {
    &:nth-child(even) {
      background-color: var(--el-fill-color-lighter);
    }

    &:hover {
      background-color: var(--el-fill-color-light);
    }
  }

  @media (max-width: 640px) {
    font-size: 13px;
    
    th, td {
      padding: 8px;
    }
  }
}
.ai-response {
  background-color: var(--el-color-success-light-9);
  border-left: 3px solid var(--el-color-success);
}

.ai-response .comment-author {
  color: var(--el-color-success);
  font-weight: 600;
}
</style>

<style scoped>
.loading-state {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}
</style>

<style scoped>
.description-wrapper {
  margin-top: 24px;
  background: var(--el-bg-color);
  border-radius: 8px;
  padding: 16px;
  border: 1px solid var(--el-border-color-light);
}

.description-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.description {
  cursor: pointer;
  padding: 8px;
  border-radius: 4px;
  transition: background-color 0.3s;
  margin: 0;
  font-size: 15px;
}

.description:hover {
  background-color: var(--el-bg-color);
}

.description-edit {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.description-edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>

<style scoped>
.task-content-wrapper {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem;
}

.task-main-content {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  padding: 2rem;
  width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}

.task-comments-section {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  padding: 2rem;
}

@media (max-width: 768px) {
  .task-content-wrapper {
    width: 100%;
    padding: 0;
    margin: 0;
  }

  .task-main-content {
    width: 100%;
    padding: 1rem;
    border-radius: 0;
    box-shadow: none;
  }

  .task-main-info {
    padding: 12px; /* Reduced from 24px to 12px */
  }

  .task-metadata {
    width: 100%;
    border-radius: 0;
    border-left: 0;
    border-right: 0;
    margin: 0; /* Remove top and bottom margin */
  }

  .metadata-grid {
    width: 100%;
    gap: 0.5rem;
    padding: 0;
    margin: 0.5rem 0; /* Reduced margin from 1rem to 0.5rem */
  }

  .metadata-item {
    width: 100%;
  }

  .task-comments-section {
    border-radius: 0;
    box-shadow: none;
    padding: 1rem;
  }

  /* Make dialog take up most of the screen width on mobile */
  :deep(.el-dialog) {
    width: 90% !important;
    margin: 5vh auto !important;
  }

  /* Adjust time input container for mobile */
  .time-input-container {
    .time-input-group-container {
      flex-direction: column;
      gap: 8px;
    }

    .time-input-group {
      width: 100%;
      justify-content: center;
    }

    .time-unit {
      align-self: center;
    }

    .time-input-help {
      text-align: center;
      margin-top: 8px;
    }
  }

  /* Make dialog footer buttons stack on mobile */
  :deep(.dialog-footer) {
    display: flex;
    flex-direction: column;
    gap: 8px;
    
    .el-button {
      width: 100%;
      margin-left: 0 !important;
    }
  }
}
</style>

<style scoped>
.task-parent {
  margin-top: 16px;
  background: var(--el-bg-color);
  border-radius: 8px;
  padding: 16px;
  border: 1px solid var(--el-border-color-light);
}

.task-parent h4 {
  margin: 0;
  color: #606266;
}

.task-parent .el-select {
  width: 100%;
}
</style>

<style scoped>
/* Add to your existing styles */
.task-parent {
  margin: 1rem 0;
  padding: 1rem;
  background-color: var(--el-bg-color);
  border-radius: 8px;
}

.task-parent h4 {
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
  color: var(--el-text-color-primary);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.task-parent :deep(.el-select) {
  width: 100%;
}

.task-parent :deep(.el-select.is-disabled .el-input) {
  opacity: 0.7;
}
</style>

<style scoped>
.comment-edit-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 8px;
}

.comment-text {
  margin-top: 8px;
}
</style>

<style scoped>
/* Add to existing styles */
.comments-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.comment-item.archived {
  opacity: 0.7;
  background-color: #f5f7fa;
}
</style>

<style scoped>
.comment-action-buttons {
  display: flex;
  gap: 8px;
}

.comment-action-buttons .el-button {
  font-size: 12px;
  color: #909399;
  padding: 4px 8px;
  height: auto;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.comment-action-buttons .el-button .el-icon {
  font-size: 14px;
  margin-right: 2px;
}

.comment-action-buttons .el-button:hover {
  color: var(--el-color-primary);
  background: transparent;
}

.comment-action-buttons .el-button + .el-button {
  margin-left: 0;
}
</style>

<style scoped>
/* Update these styles */
.el-dropdown-menu__item {
  font-size: 10px !important;
  color: #909399 !important;
  padding: 6px 12px !important;
  height: 28px !important;
  line-height: 16px !important;
}

.el-dropdown-menu__item:hover {
  color: #409EFF !important;
  background-color: #f5f7fa !important;
}

/* Make the icon inside dropdown items smaller */
.el-dropdown-menu__item .el-icon {
  font-size: 10px;
  margin-right: 4px;
}

/* Make the dropdown button more compact */
.comment-actions .el-button.el-button--default {
  padding: 4px !important;
  height: 24px !important;
  width: 24px !important;
}

.comment-actions .el-button .el-icon {
  font-size: 14px;
}
</style>

<style scoped>
.comment-history {
  margin-top: 12px;
  padding: 12px;
  background: var(--el-bg-color-page);
  border-radius: 4px;
  border: 1px solid var(--el-border-color-lighter);
}

.history-header {
  font-weight: 500;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
  font-size: 0.9em;
}

.history-entry {
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.history-entry:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.previous-content {
  background: var(--el-fill-color-lighter);
  padding: 8px;
  border-radius: 4px;
  margin-bottom: 4px;
  white-space: pre-wrap;
  font-size: 0.95em;
}

.edit-metadata {
  font-size: 0.8em;
  color: var(--el-text-color-secondary);
}
</style>

<style scoped>
.comments-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.control-label {
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.divider {
  color: var(--el-border-color);
  margin: 0 8px;
}
</style>

<style scoped>
.dropdown-item-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 8px;
}

:deep(.el-dropdown-menu__item:focus),
:deep(.el-dropdown-menu__item:not(.is-disabled):hover) {
  background-color: transparent;
}

:deep(.el-dropdown-menu__item) {
  padding: 8px 12px;
}
</style>

<style scoped>
.system-comments-label,
.archived-comments-label {
  font-size: 0.95em;
  cursor: pointer;
}

.dropdown-item-content {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>

<style>
.mobile-edit-dialog {
  margin: 20px;
}

@media (max-width: 768px) {
  .mobile-edit-dialog {
    width: 90% !important;
    margin: 10px auto;
  }
}
</style>

<style scoped>
.metadata-popover {
  padding: 12px !important;
}

.metadata-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.metadata-option {
  padding: 8px;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.2s;
  width: 100%;
}

.metadata-option:hover {
  background-color: var(--el-fill-color-light);
}

.metadata-option.selected {
  background-color: var(--el-fill-color);
}

.user-option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  overflow: hidden;
}

.user-option span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Ensure popovers appear in correct position and styling on mobile */
@media (max-width: 768px) {
  :deep(.el-popper.metadata-popover) {
    position: fixed !important;
    margin-top: 4px !important;
    width: calc(100% - 32px) !important;
    max-width: 300px;
  }
  
  .user-option {
    font-size: 14px;
  }
}
</style>

<style scoped>
.comments-title {
  text-decoration: underline;
  text-underline-offset: 4px; /* Optional: adds some space between text and underline */
}
</style>

<style scoped>
.description-wrapper > p.description {
  position: relative;
  padding-left: 16px;
}

.description-wrapper > p.description::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background-color: var(--el-color-primary-light-5);
  border-radius: 2px;
}
</style>