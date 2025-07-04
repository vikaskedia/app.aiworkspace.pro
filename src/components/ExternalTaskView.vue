<template>
  <div class="external-task-view">
    <!-- Header -->
    <div class="external-header">
      <div class="logo-section">
        <img src="/associate-ai-attorney-logo.svg" alt="AI Attorney" class="logo" />
        <h1>AI Attorney - Shared Task</h1>
      </div>
      
      <div class="auth-section">
        <div v-if="!user" class="login-prompt">
          <el-button type="primary" @click="signInWithGoogle" :loading="signingIn">
            <el-icon><User /></el-icon>
            Sign in with Gmail
          </el-button>
          <p class="auth-info">Please sign in with Gmail to view and comment on this task</p>
        </div>
        
        <div v-else class="user-info">
          <el-avatar :src="user.user_metadata?.avatar_url" size="small">
            {{ user.email?.charAt(0).toUpperCase() }}
          </el-avatar>
          <span class="user-email">{{ user.email }}</span>
          <el-button type="text" @click="signOut" size="small">Sign Out</el-button>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-container">
      <el-icon class="loading-spinner"><Loading /></el-icon>
      <span>Loading task details...</span>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-container">
      <el-alert
        :title="error"
        type="error"
        :closable="false"
        show-icon>
      </el-alert>
    </div>

    <!-- Task Content -->
    <div v-else-if="task && user" class="external-task-content">
      <div class="task-header-section">
        <h2 class="task-title">{{ task.title }}</h2>
        <div class="task-metadata">
          <el-tag :type="getStatusType(task.status)" size="small">
            {{ formatStatus(task.status) }}
          </el-tag>
          <el-tag :type="getPriorityType(task.priority)" size="small">
            Priority: {{ task.priority }}
          </el-tag>
          <span v-if="task.due_date" class="due-date">
            Due: {{ formatDueDate(task.due_date) }}
          </span>
        </div>
      </div>

      <div class="task-description" v-if="task.description">
        <h3>Description</h3>
        <div class="description-content" v-html="formatContent(task.description)"></div>
      </div>

      <!-- Comments Section -->
      <div class="external-comments-section">
        <h3>Comments</h3>
        
        <!-- Add Comment Form -->
        <div class="add-comment-form">
          <el-form @submit.prevent="addComment">
            <el-form-item>
              <el-input
                v-model="newComment"
                type="textarea"
                :rows="4"
                placeholder="Add a comment..."
                maxlength="2000"
                show-word-limit
              />
            </el-form-item>
            <el-form-item>
              <el-button 
                type="primary" 
                @click="addComment"
                :loading="addingComment"
                :disabled="!newComment.trim()">
                Add Comment
              </el-button>
            </el-form-item>
          </el-form>
        </div>

        <!-- Comments List -->
        <div class="comments-list">
          <div
            v-for="comment in filteredComments"
            :key="comment.id"
            class="comment-item">
            <div class="comment-header">
              <div class="comment-author">
                <el-avatar size="small">
                  {{ getInitials(getCommentAuthor(comment)) }}
                </el-avatar>
                <span class="author-name">
                  {{ getCommentAuthor(comment) }}
                </span>
                <el-tag v-if="comment.comment_type === 'external'" type="info" size="small">
                  External
                </el-tag>
                <el-tag v-else-if="comment.comment_type === 'system'" type="warning" size="small">
                  System
                </el-tag>
                <el-tag v-else-if="comment.comment_type === 'internal'" type="success" size="small">
                  Internal
                </el-tag>
              </div>
              <span class="comment-time">{{ formatCommentTime(comment.created_at) }}</span>
            </div>
            <div class="comment-content" v-html="formatContent(comment.text)"></div>
          </div>
          
          <div v-if="!filteredComments.length" class="no-comments">
            <el-empty description="No comments yet. Be the first to add one!" />
          </div>
        </div>
      </div>
    </div>

    <!-- Auth Required State -->
    <div v-else-if="!user" class="auth-required">
      <el-empty description="Please sign in with Gmail to access this shared task" />
    </div>
  </div>
</template>

<script>
import { User, Loading } from '@element-plus/icons-vue';
import { supabase } from '../supabase';
import { ElMessage, ElNotification } from 'element-plus';

export default {
  name: 'ExternalTaskView',
  components: {
    User,
    Loading
  },
  data() {
    return {
      task: null,
      comments: [],
      user: null,
      loading: true,
      error: null,
      signingIn: false,
      newComment: '',
      addingComment: false,
      shareId: null,
      token: null
    };
  },
  async created() {
    // Get share ID and token from route params
    this.shareId = this.$route.params.shareId;
    this.token = this.$route.query.token;

    if (!this.shareId || !this.token) {
      this.error = 'Invalid share link';
      this.loading = false;
      return;
    }

    // Check if user is already signed in
    const { data: { user } } = await supabase.auth.getUser();
    this.user = user;

    if (this.user) {
      await this.loadTaskData();
    } else {
      this.loading = false;
    }

    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (event, session) => {
      this.user = session?.user || null;
      if (event === 'SIGNED_IN' && this.user) {
        await this.loadTaskData();
      }
    });
  },
  computed: {
    filteredComments() {
      return this.comments.filter(comment => !comment.archived);
    }
  },
  methods: {
    async signInWithGoogle() {
      try {
        this.signingIn = true;
        
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            queryParams: {
              access_type: 'offline',
              prompt: 'consent',
            },
            redirectTo: window.location.href
          }
        });

        if (error) throw error;
      } catch (error) {
        console.error('Error signing in:', error);
        ElMessage.error('Failed to sign in with Google: ' + error.message);
      } finally {
        this.signingIn = false;
      }
    },

    async signOut() {
      try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        this.user = null;
        this.task = null;
        this.comments = [];
      } catch (error) {
        console.error('Error signing out:', error);
        ElMessage.error('Failed to sign out');
      }
    },

    async loadTaskData() {
      try {
        this.loading = true;
        this.error = null;

        const apiUrl = window.location.hostname === 'localhost' ? 'https://app.aiworkspace.pro/api/external-task-access' : '/api/external-task-access';
        const response = await fetch(`${apiUrl}?shareId=${this.shareId}&token=${this.token}`, {
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
          }
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to load task');
        }

        const data = await response.json();
        this.task = data.task;
        this.comments = data.comments || [];

      } catch (error) {
        console.error('Error loading task data:', error);
        this.error = error.message;
      } finally {
        this.loading = false;
      }
    },

    async addComment() {
      if (!this.newComment.trim()) return;

      try {
        this.addingComment = true;

        const apiUrl = window.location.hostname === 'localhost' ? 'https://app.aiworkspace.pro/api/external-task-comment' : '/api/external-task-comment';
        const response = await fetch(`${apiUrl}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
          },
          body: JSON.stringify({
            shareId: this.shareId,
            token: this.token,
            comment: this.newComment.trim(),
            userEmail: this.user.email
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to add comment');
        }

        const newCommentData = await response.json();
        this.comments.unshift(newCommentData.comment);
        this.newComment = '';

        ElNotification.success({
          title: 'Success',
          message: 'Comment added successfully'
        });

      } catch (error) {
        console.error('Error adding comment:', error);
        ElMessage.error('Failed to add comment: ' + error.message);
      } finally {
        this.addingComment = false;
      }
    },

    formatStatus(status) {
      const statusMap = {
        'in_progress': 'In Progress',
        'not_started': 'Not Started',
        'completed': 'Completed',
        'awaiting_external': 'Awaiting External',
        'awaiting_internal': 'Awaiting Internal'
      };
      return statusMap[status] || status;
    },

    getStatusType(status) {
      switch (status?.toLowerCase()) {
        case 'completed':
          return 'success';
        case 'in_progress':
          return 'warning';
        case 'not_started':
          return 'info';
        default:
          return 'info';
      }
    },

    getPriorityType(priority) {
      switch (priority?.toLowerCase()) {
        case 'high':
          return 'danger';
        case 'medium':
          return 'warning';
        case 'low':
          return 'success';
        default:
          return 'info';
      }
    },

    formatDueDate(date) {
      if (!date) return '';
      return new Date(date).toLocaleDateString();
    },

    formatCommentTime(dateString) {
      if (!dateString) return '';
      const date = new Date(dateString);
      const now = new Date();
      const diffInMinutes = Math.floor((now - date) / (1000 * 60));

      if (diffInMinutes < 60) {
        return diffInMinutes <= 1 ? 'just now' : `${diffInMinutes} minutes ago`;
      } else if (diffInMinutes < 1440) {
        const hours = Math.floor(diffInMinutes / 60);
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
      } else {
        return date.toLocaleDateString();
      }
    },

    formatContent(text) {
      if (!text) return '';
      return text.replace(/\n/g, '<br>');
    },

    getInitials(email) {
      if (!email) return '?';
      return email.charAt(0).toUpperCase();
    },

    getCommentAuthor(comment) {
      if (comment.created_by_email) {
        return comment.created_by_email;
      } else if (comment.external_user_email) {
        return comment.external_user_email;
      } else {
        return 'System';
      }
    }
  }
};
</script>

<style scoped>
.external-task-view {
  min-height: 100vh;
  background-color: #f5f5f5;
}

.external-header {
  background: white;
  padding: 1rem 2rem;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.logo-section {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.logo {
  height: 40px;
  width: auto;
}

.logo-section h1 {
  font-size: 1.5rem;
  margin: 0;
  color: #2c3e50;
}

.auth-section .login-prompt {
  text-align: center;
}

.auth-info {
  margin-top: 0.5rem;
  color: #666;
  font-size: 0.9rem;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.user-email {
  font-weight: 500;
}

.loading-container, .error-container, .auth-required {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  min-height: 50vh;
  gap: 1rem;
}

.loading-spinner {
  font-size: 2rem;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.external-task-content {
  max-width: 800px;
  margin: 2rem auto;
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.task-header-section {
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e0e0e0;
}

.task-title {
  font-size: 2rem;
  margin-bottom: 1rem;
  color: #2c3e50;
}

.task-metadata {
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
}

.due-date {
  color: #666;
  font-size: 0.9rem;
}

.task-description {
  margin-bottom: 2rem;
}

.task-description h3 {
  color: #2c3e50;
  margin-bottom: 1rem;
}

.description-content {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 4px;
  border-left: 4px solid #007bff;
}

.external-comments-section h3 {
  color: #2c3e50;
  margin-bottom: 1rem;
}

.add-comment-form {
  margin-bottom: 2rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
}

.comments-list {
  max-height: 600px;
  overflow-y: auto;
}

.comment-item {
  padding: 1rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  margin-bottom: 1rem;
  background: white;
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
}

.author-name {
  font-weight: 500;
}

.comment-time {
  color: #666;
  font-size: 0.85rem;
}

.comment-content {
  line-height: 1.5;
  color: #444;
}

.no-comments {
  text-align: center;
  padding: 2rem;
}

@media (max-width: 768px) {
  .external-header {
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
  }
  
  .external-task-content {
    margin: 1rem;
    padding: 1rem;
  }
  
  .task-title {
    font-size: 1.5rem;
  }
  
  .task-metadata {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style> 