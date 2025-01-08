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
          type="primary"
          @click="editDialogVisible = true">
          Edit Task
        </el-button>
        <el-button 
          type="info"
          @click="shareDialogVisible = true">
          Share Task
        </el-button>
        <el-button 
          type="warning"
          @click="logHoursDialogVisible = true"
          style="margin-right: 10px">
          Log Hours
        </el-button>
      </div>
    </div>

    <div class="task-content" v-loading="loading">
      <div class="task-main-info">
        
        <div class="task-title-header">
          <div class="star-container">
            <el-icon 
              class="star-icon"
              :class="{ 'starred': isTaskStarred }"
              @click="toggleTaskStar"
            >
              <Star v-if="!isTaskStarred" />
              <StarFilled v-else />
            </el-icon>
          </div>
          
          <div class="title-wrapper">
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
            <div class="metadata-item">
              <div class="metadata-label">
                <el-icon><CircleCheck /></el-icon>
                <span>Status</span>
              </div>
              <el-dropdown @command="handleStatusChange" trigger="click">
                <el-tag :type="getStatusType(task)" class="status-tag">
                  {{ formatStatus(task?.status) }}
                  <el-icon class="el-icon--right"><ArrowDown /></el-icon>
                </el-tag>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="not_started">Not started</el-dropdown-item>
                    <el-dropdown-item command="in_progress">In Progress</el-dropdown-item>
                    <el-dropdown-item command="awaiting_external">Awaiting external factor</el-dropdown-item>
                    <el-dropdown-item command="completed">Completed</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>

            <!-- Priority Column -->
            <div class="metadata-item">
              <div class="metadata-label">
                <el-icon><Warning /></el-icon>
                <span>Priority</span>
              </div>
              <el-dropdown @command="handlePriorityChange" trigger="click">
                <el-tag :type="
                  task?.priority === 'high' ? 'danger' :
                  task?.priority === 'medium' ? 'warning' : 'info'
                " class="priority-tag">
                  {{ task?.priority }}
                  <el-icon class="el-icon--right"><ArrowDown /></el-icon>
                </el-tag>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="high">High</el-dropdown-item>
                    <el-dropdown-item command="medium">Medium</el-dropdown-item>
                    <el-dropdown-item command="low">Low</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>

            <!-- Due Date Column -->
            <div class="metadata-item">
              <div class="metadata-label">
                <el-icon><Calendar /></el-icon>
                <span>Due Date</span>
              </div>
              <el-popover
                placement="bottom"
                trigger="click"
                :width="300"
                popper-class="due-date-popover"
              >
                <template #reference>
                  <div class="due-date-display">
                    <span>{{ task?.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date' }}</span>
                    <el-icon><Edit /></el-icon>
                  </div>
                </template>
                <template #default>
                  <div class="due-date-editor">
                    <el-date-picker
                      v-model="tempDueDate"
                      type="date"
                      placeholder="Select due date"
                      style="width: 100%"
                      @change="handleDueDateChange"
                    />
                    <div class="due-date-actions">
                      <el-button @click="clearDueDate" link size="small">Clear</el-button>
                    </div>
                  </div>
                </template>
              </el-popover>
            </div>

            <!-- Assigned To Column -->
            <div class="metadata-item">
              <div class="metadata-label">
                <el-icon><User /></el-icon>
                <span>Assigned To</span>
              </div>
              <el-dropdown @command="handleAssigneeChange" trigger="click">
                <div class="assignee-display">
                  <div class="assignee-info">
                    <el-avatar v-if="assigneeEmail" :size="24">
                      {{ getInitials(assigneeEmail) }}
                    </el-avatar>
                    <span>{{ assigneeEmail || 'Unassigned' }}</span>
                  </div>
                  <el-icon class="el-icon--right"><ArrowDown /></el-icon>
                </div>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="">
                      <el-icon><Close /></el-icon>
                      Unassign
                    </el-dropdown-item>
                    <el-dropdown-item 
                      v-for="user in sharedUsers" 
                      :key="user.id"
                      :command="user.id"
                    >
                      <div class="user-option">
                        <el-avatar :size="24">{{ getInitials(user.email) }}</el-avatar>
                        <span>{{ user.email }}</span>
                      </div>
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>
        </div>
        <div class="description-wrapper">
          <div class="description-header">
            <div class="metadata-label">
              <el-icon><Document /></el-icon>
              <span>Description</span>
            </div>
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

      <div class="task-comments">
        <h3>Comments</h3>
        <div class="comments-list">
          <div v-for="comment in comments" :key="comment.id" :class="['comment-item', { 'ai-response': comment.type === 'ai_response' }]">
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
                    <span 
                      v-if="comment.comment_edit_history?.length" 
                      class="edited-marker"
                      :data-comment-id="comment.id"
                      @click="toggleHistory(comment.id)"
                    >(edited {{ comment.comment_edit_history.length }} times)</span>
                  </span>
                  <el-button 
                    v-if="comment.user_id === currentUser?.id && comment.type !== 'activity'"
                    link
                    @click="startEditing(comment)"
                  >
                    Edit
                  </el-button>
                </div>
              </div>
              <div v-if="editingCommentId === comment.id">
                <el-input
                  v-model="editingCommentText"
                  type="textarea"
                  :rows="3"
                />
                <div class="edit-actions">
                  <el-button @click="cancelEdit">Cancel</el-button>
                  <el-button 
                    type="primary"
                    @click="saveEdit(comment)"
                    :disabled="!editingCommentText.trim()"
                  >
                    Save
                  </el-button>
                </div>
              </div>
              <div v-else class="comment-text">
                <span v-html="formatCommentContent(comment.content)"></span>
                <div v-if="expandedCommentHistories.has(comment.id)" class="edit-history">
                  <div v-for="(historyEntry, index) in comment.comment_edit_history" :key="index" class="edit-history-entry">
                    <div class="edit-history-header">Version {{ index + 1 }}:</div>
                    <div class="previous-content" v-html="formatCommentContent(historyEntry.previous_content)"></div>
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

    <!-- Edit Task Dialog -->
    <el-dialog
      v-model="editDialogVisible"
      title="Edit Task"
      width="500px">
      <el-form v-if="editingTask" :model="editingTask" label-position="top">
        <el-form-item label="Title" required>
          <el-input v-model="editingTask.title" />
        </el-form-item>
        <el-form-item label="Description">
          <TiptapEditor
            v-model="editingTask.description"
            placeholder="Write a description..."
            :taskId="String(task.id)"
            :taskTitle="task.title"
            :sharedUsers="sharedUsers"
            :isTaskComment="false"
          />
        </el-form-item>
        <el-form-item label="Status">
          <el-select v-model="editingTask.status" style="width: 100%">
            <el-option label="Not started" value="not_started" />
            <el-option label="In Progress" value="in_progress" />
            <el-option label="Awaiting external factor" value="awaiting_external" />
            <el-option label="Completed" value="completed" />
          </el-select>
        </el-form-item>
        <el-form-item label="Priority">
          <el-select v-model="editingTask.priority" style="width: 100%">
            <el-option label="High" value="high" />
            <el-option label="Medium" value="medium" />
            <el-option label="Low" value="low" />
          </el-select>
        </el-form-item>
        <el-form-item label="Due Date">
          <el-date-picker
            v-model="editingTask.due_date"
            type="date"
            style="width: 100%" />
        </el-form-item>
        <el-form-item label="Assignee">
          <el-select 
            v-model="editingTask.assignee" 
            style="width: 100%"
            clearable>
            <el-option
              v-for="user in sharedUsers"
              :key="user.id"
              :label="user.email"
              :value="user.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="editDialogVisible = false">Cancel</el-button>
          <el-button
            type="primary"
            @click="updateTask"
            :disabled="!editingTask?.title">
            Update
          </el-button>
        </span>
      </template>
    </el-dialog>

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
      width="500px">
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
            placeholder="Add a comment about the work done..." />
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
import { ArrowLeft, DocumentCopy, Folder, Close, Document, Star, StarFilled, ArrowDown, Clock, Timer, User, Calendar, Edit, CircleCheck, Warning } from '@element-plus/icons-vue';
import { supabase } from '../../supabase';
import { useMatterStore } from '../../store/matter';
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
    Warning
  },
  setup() {
    const matterStore = useMatterStore();
    const { currentMatter } = storeToRefs(matterStore);
    return { currentMatter };
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

  clearDueDate() {
    this.tempDueDate = null;
    this.updateDueDate();
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
      const { error } = await supabase
        .from('tasks')
        .update({ assignee: userId || null })
        .eq('id', this.task.id);

      if (error) throw error;

      ElMessage.success(userId ? 'Task assigned successfully' : 'Task unassigned successfully');
    } catch (error) {
      console.error('Error updating assignee:', error);
      ElMessage.error('Failed to update assignee');
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

    } catch (error) {
      ElMessage.error('Error updating task priority: ' + error.message);
    }
  },
    async handleStatusChange(status) {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status })
        .eq('id', this.task.id);

      if (error) throw error;

      // Update local task status
      this.task.status = status;
      ElMessage.success('Task status updated successfully');

    } catch (error) {
      ElMessage.error('Error updating task status: ' + error.message);
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

        this.comments = comments;
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
        const commentsHistory = this.comments.map(comment => {
          const timestamp = comment.updated_at || comment.created_at;
          const formattedDate = new Date(timestamp).toLocaleString();
          return `[${formattedDate}] ${this.userEmails[comment.user_id]}: ${comment.content}`;
        }).join('\n\n');

        const taskContext = `Task Title: "${this.task.title}"
        ${this.task.description ? `\nTask Description: ${this.task.description}` : ''}`;

        const systemPrompt = customSystemPrompt || `You are an AI legal assistant helping with the following task:`;

        const response = await fetch(`${this.pythonApiBaseUrl}/gpt/get_ai_response`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt,
            systemPrompt: systemPrompt + `\n\n${taskContext}` + `\n\nComment History:\n${commentsHistory}`,
            taskId: this.task.id,
            matterId: this.task.matter_id
          })
        });

        if (!response.ok) throw new Error('Failed to get AI response');

        const data = await response.json();
        return data.response;
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
            content: response,
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
      return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, fileName, fileUrl) => {
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
      // Don't allow editing of activity type comments
      if (comment.type === 'activity') {
        ElMessage.warning('System-generated activity comments cannot be edited');
        return;
      }

      // Only allow editing of own comments
      if (comment.user_id !== this.currentUser?.id) {
        ElMessage.warning('You can only edit your own comments');
        return;
      }
      
      this.editingCommentId = comment.id;
      this.editingCommentText = comment.content;
    },

    async saveEdit(comment) {
      try {
        this.loading = true;
        const { data: { user } } = await supabase.auth.getUser();

        // Prepare edit history entry
        const historyEntry = {
          previous_content: comment.content,
          edited_at: new Date().toISOString(),
          edited_by: user.id
        };

        // Update comment with new content and history
        const { error } = await supabase
          .from('task_comments')
          .update({
            content: this.editingCommentText.trim(),
            comment_edit_history: comment.comment_edit_history 
              ? [...comment.comment_edit_history, historyEntry]
              : [historyEntry],
            updated_at: new Date().toISOString()
          })
          .eq('id', comment.id);

        if (error) throw error;

        this.editingCommentId = null;
        this.editingCommentText = '';
        await this.loadComments();
        ElMessage.success('Comment updated successfully');
      } catch (error) {
        ElMessage.error('Error updating comment: ' + error.message);
      } finally {
        this.loading = false;
      }
    },

    cancelEdit() {
      this.editingCommentId = null;
      this.editingCommentText = '';
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
        const { data: { user } } = await supabase.auth.getUser();

        const { error } = await supabase
          .from('tasks')
          .update({ assignee: userId })
          .eq('id', this.task.id);

        if (error) throw error;

        this.task.assignee = userId;
        this.assigneeEmail = this.sharedUsers.find(u => u.id === userId)?.email;
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
    clearDueDate() {
      this.tempDueDate = null;
      this.closeDueDatePopover();
    },
    closeDueDatePopover() {
      this.$refs.dueDatePopover.close();
    },
    startTitleEdit() {
      this.isEditingTitle = true;
      this.editingTitle = this.task?.title || '';
    },
    saveTitleEdit() {
      this.isEditingTitle = false;
      this.task.title = this.editingTitle;
      this.editingTitle = '';
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
    handleDueDateChange(date) {
      this.tempDueDate = date;
      this.updateDueDate();
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
  }
  }
};
</script>

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
}

.description:hover {
  background-color: var(--el-fill-color-light);
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
  background-color: var(--el-fill-color-light);
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

.title-edit-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px;
}

.title-edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.task-metadata {
  background: var(--el-bg-color);
  border-radius: 8px;
  padding: 20px;
  margin: 16px 0;
  border: 1px solid var(--el-border-color-light);
}

.metadata-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
}

.metadata-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.metadata-label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.metadata-label .el-icon {
  font-size: 16px;
}

.status-tag,
.priority-tag,
.due-date-display,
.assignee-display {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
}

.due-date-display,
.assignee-display {
  padding: 5px 12px;
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
    grid-template-columns: 1fr;
    gap: 16px;
  }
}
.due-date-display {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s;
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
  padding: 6px 12px;
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

.star-container {
  display: flex;
  align-items: center;
  margin-right: 12px;
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
  gap: 12px;
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
  align-items: center;
  gap: 8px;
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
.file-link {
  color: #409EFF;
  text-decoration: none;
}

.file-link:hover {
  text-decoration: underline;
}

.description-input-container {
  position: relative;
  width: 100%;
}

.description-input {
  width: 100%;
}

:deep(.el-textarea__inner) {
  width: 100%;
  resize: vertical;
}

.typeahead-suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  max-height: 200px;
  overflow-y: auto;
  z-index: 1000;
  box-shadow: 0 2px 12px 0 rgba(0,0,0,.1);
}

.suggestion-item {
  padding: 8px 12px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.suggestion-item:hover,
.suggestion-item.selected {
  background-color: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.time-input-container {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.time-input-group {
  display: inline-flex;
  align-items: center;
  background-color: var(--el-fill-color-blank);
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  padding: 2px 8px;
  width: fit-content;
}

.time-separator {
  padding: 0 4px;
  color: var(--el-text-color-regular);
  font-weight: bold;
}

.time-unit {
  margin-left: 8px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  display: inline-flex;
  align-items: center;
}

.time-input-group-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

:deep(.el-input__wrapper) {
  box-shadow: none !important;
  padding: 0 4px;
}

:deep(.el-input__inner) {
  text-align: center;
}

.time-input-help {
  color: #909399;
  font-size: 12px;
}

.error-text {
  color: #f56c6c;
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
}

.description:hover {
  background-color: var(--el-fill-color-light);
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