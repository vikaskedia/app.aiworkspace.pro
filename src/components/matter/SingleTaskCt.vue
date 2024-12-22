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
              <div class="comment-text">{{ comment.content }}</div>
            </div>
          </div>
        </div>

        <div class="comment-input">
          <el-input
            v-model="newComment"
            type="textarea"
            :rows="3"
            placeholder="Write a comment..."
            @keyup.ctrl.enter="addComment" />
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
      sending: false
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
    // Reuse existing methods from TaskCommentDialog.vue
    async loadComments() {
      // Reference TaskCommentDialog.vue for implementation
      // Lines 51-60
    },
    async addComment() {
      // Reference TaskCommentDialog.vue for implementation
    },
    setupRealtimeSubscription() {
      // Reference TaskCommentDialog.vue for implementation
    },
    async loadSharedUsers() {
      try {
        const { data: users, error } = await supabase
          .from('matter_access')
          .select('shared_with_user_id, users:shared_with_user_id (id, email)')
          .eq('matter_id', this.currentMatter.id);

        if (error) throw error;
        this.sharedUsers = users.map(u => ({
          id: u.users.id,
          email: u.users.email
        }));
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
    }
  },
  watch: {
    shareDialogVisible(newVal) {
      if (newVal) {
        this.generateShareLink();
      }
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
</style> 