<template>
  <div class="single-task-view">
    <div class="task-header">
      <div class="back-button">
        <el-button 
          type="primary" 
          link 
          @click="$router.push(`/matter/${currentMatter?.id}/tasks`)">
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
      </div>
    </div>

    <div class="task-content" v-loading="loading">
      <div class="task-main-info">
        <h2>{{ task?.title }}</h2>
        <div class="task-metadata">
          <el-tag :type="getStatusType(task)">
            {{ formatStatus(task?.status) }}
          </el-tag>
          <el-tag :type="
            task?.priority === 'high' ? 'danger' :
            task?.priority === 'medium' ? 'warning' : 'info'
          ">
            {{ task?.priority }}
          </el-tag>
          <span class="due-date">
            Due: {{ task?.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date' }}
          </span>
          <span class="assignee">
            Assigned to: {{ assigneeEmail || 'Unassigned' }}
          </span>
        </div>
        <p class="description">{{ task?.description || 'No description provided' }}</p>
      </div>

      <div class="task-comments">
        <h3>Comments</h3>
        <div class="comments-list">
          <div v-for="comment in comments" :key="comment.id" class="comment-item">
            <div :class="['comment-content', comment.type === 'activity' ? 'activity' : '']">
              <div class="comment-header">
                <span class="comment-author">{{ userEmails[comment.user_id] }}</span>
                <span class="comment-date">
                  {{ new Date(comment.created_at).toLocaleString() }}
                </span>
              </div>
              <div class="comment-text" v-html="formatCommentContent(comment.content)"></div>
            </div>
          </div>
        </div>

        <div class="comment-input">
          <el-input
            v-model="newComment"
            type="textarea"
            :rows="3"
            placeholder="Write a comment... (Type @files to mention a file)"
            @keyup.ctrl.enter="addComment"
            @input="handleInput" />
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
          <el-input 
            v-model="editingTask.description"
            type="textarea"
            :rows="3" />
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
      <el-input
        v-model="fileSearchQuery"
        placeholder="Search files..."
        clearable
        style="margin-bottom: 1rem;" />
      
      <el-scrollbar height="300px">
        <div class="file-list">
          <div
            v-for="file in filteredFiles"
            :key="file.id"
            class="file-item"
            @click="selectFile(file)">
            {{ file.name }}
          </div>
        </div>
      </el-scrollbar>
    </el-dialog>
  </div>
</template>

<script>
import { ArrowLeft, DocumentCopy } from '@element-plus/icons-vue';
import { supabase } from '../../supabase';
import { useMatterStore } from '../../store/matter';
import { storeToRefs } from 'pinia';
import { ElMessage } from 'element-plus';

export default {
  components: {
    ArrowLeft,
    DocumentCopy
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
      fileSearchQuery: ''
    };
  },
  async created() {
    const taskId = this.$route.params.taskId;
    await this.loadTask(taskId);
    await this.loadSharedUsers();
    this.setupRealtimeSubscription();
  },
  unmounted() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  },
  methods: {
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

        const { error } = await supabase
          .from('task_comments')
          .insert({
            task_id: this.task.id,
            user_id: user.id,
            content: this.newComment.trim()
          });

        if (error) throw error;

        this.newComment = '';
        await this.loadComments();
        ElMessage.success('Comment added successfully');
      } catch (error) {
        ElMessage.error('Error adding comment: ' + error.message);
      } finally {
        this.loading = false;
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
      // Reference TasksCt.vue for implementation
      // Lines 260-271
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
      this.shareLink = `${baseUrl}/matter/${this.currentMatter.id}/tasks/${this.task.id}`;
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
    formatCommentContent(content) {
      if (!content) return '';
      return content.replace(
        /\[([^\]]+)\]\(([^)]+)\)/g, 
        (match, text, url) => {
          // Only allow gitea links
          if (url.includes('/gitea/')) {
            return `<a href="${url}" target="_blank" class="file-link">${text}</a>`;
          }
          return match;
        }
      );
    },
    async loadFiles() {
      try {
        const giteaToken = import.meta.env.VITE_GITEA_TOKEN;
        
        // First get the matter's git repo
        const { data: matter, error: matterError } = await supabase
          .from('matters')
          .select('git_repo')
          .eq('id', this.currentMatter.id)
          .single();

        if (matterError) {
          throw new Error('Failed to fetch matter details');
        }

        if (!matter?.git_repo) {
          throw new Error('No git repository found for this matter');
        }

        const response = await fetch(
          `/gitea/api/v1/repos/vikas/${matter.git_repo}/contents/`,
          {
            headers: {
              'Authorization': `token ${giteaToken}`,
              'Accept': 'application/json'
            }
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch files');
        }

        const contents = await response.json();
        
        this.files = contents
          .filter(item => item.type === 'file' && item.name !== '.gitkeep')
          .map(file => ({
            id: file.sha,
            name: file.name,
            path: file.path,
            download_url: file.download_url.replace(import.meta.env.VITE_GITEA_HOST, '/gitea')
          }));

      } catch (error) {
        ElMessage.error('Error loading files: ' + error.message);
        this.files = [];
      }
    },

    handleInput(event) {
      const text = typeof event === 'string' ? event : event?.target?.value || '';
      
      const textarea = document.querySelector('.comment-input textarea');
      const selectionStart = textarea?.selectionStart || 0;
      
      const lastWord = text.slice(0, selectionStart).split(' ').pop();
      
      if (lastWord === '@files') {
        this.showFileSelector = true;
        this.mentionIndex = selectionStart;
        this.loadFiles();
      }
    },

    selectFile(file) {
      const beforeMention = this.newComment.slice(0, this.mentionIndex - 6); // Remove '@files'
      const afterMention = this.newComment.slice(this.mentionIndex);
      
      this.newComment = `${beforeMention}[${file.name}](${file.download_url})${afterMention}`;
      this.showFileSelector = false;
      this.fileSearchQuery = '';
    }
  },
  watch: {
    shareDialogVisible(newVal) {
      if (newVal) {
        this.generateShareLink();
      }
    }
  },
  computed: {
    filteredFiles() {
      if (!this.fileSearchQuery) return this.files;
      const query = this.fileSearchQuery.toLowerCase();
      return this.files.filter(file => 
        file.name.toLowerCase().includes(query)
      );
    }
  }
};
</script>

<style scoped>
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
  white-space: pre-wrap;
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

/* Reuse comment styles from TaskCommentDialog.vue */
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
  white-space: pre-wrap;
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
</style> 