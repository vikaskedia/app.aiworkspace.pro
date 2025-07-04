<template>
  <div class="external-task-view">
    <!-- Development Notice -->
    <div v-if="isDevelopment" class="development-notice">
      <el-alert
        title="Development Mode"
        type="warning"
        :closable="false"
        show-icon>
        <template #default>
          Authentication is bypassed for local development. In production, users must sign in with Gmail.
        </template>
      </el-alert>
    </div>

    <!-- Header -->
    <div class="external-header">
      <div class="logo-section">
        <img src="/associate-ai-attorney-logo.svg" alt="AI Attorney" class="logo" />
        <h1>AI Workspace - Shared Task</h1>
      </div>
      
      <div class="auth-section">
        <div v-if="!user && !isDevelopment" class="login-prompt">
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
          <el-tag v-if="isDevelopment" type="warning" size="small" style="margin-left: 8px;">
            Development Mode
          </el-tag>
          <el-button v-if="!isDevelopment" type="primary" @click="signOut" size="small">Sign Out</el-button>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-container">
      <el-icon class="loading-spinner"><Loading /></el-icon>
      <span>Loading task details...</span>
      <div v-if="loadingAttempts > 1" class="loading-actions">
        <el-button @click="refreshTaskData" size="small" type="primary">
          Refresh
        </el-button>
        <p class="loading-hint">Taking longer than usual? Try refreshing.</p>
      </div>
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
    <div v-else-if="task && (user || isDevelopment)" class="external-task-content">
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
        <div class="description-content" v-html="formatCommentContent(task.description)"></div>
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
            
            <!-- File Upload Section -->
            <el-form-item>
              <div class="file-upload-section">
                <el-upload
                  ref="fileUpload"
                  :file-list="fileList"
                  :auto-upload="false"
                  :on-change="handleFileChange"
                  :on-remove="handleFileRemove"
                  :before-upload="beforeFileUpload"
                  multiple
                  :show-file-list="true"
                  action="#"
                  :limit="5">
                  <el-button size="small" type="primary">
                    <el-icon><Paperclip /></el-icon>
                    Attach Files
                  </el-button>
                </el-upload>
              </div>
            </el-form-item>
            
            <el-form-item>
              <el-button 
                type="primary" 
                @click="addComment"
                :loading="addingComment"
                :disabled="!newComment.trim() && fileList.length === 0">
                Add Comment
              </el-button>
              <el-button 
                v-if="fileList.length > 0"
                @click="clearFiles"
                size="small"
                type="primary">
                Clear Files
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
                <el-tag v-if="comment.external_user_email" type="info" size="small">
                  External
                </el-tag>
                <el-tag v-else-if="comment.user_id" type="success" size="small">
                  Internal
                </el-tag>
                <el-tag v-else type="warning" size="small">
                  System
                </el-tag>
              </div>
              <span class="comment-time">{{ formatCommentTime(comment.created_at) }}</span>
            </div>
            <div class="comment-content" v-html="formatCommentContent(comment.content)"></div>
          </div>
          
          <div v-if="!filteredComments.length" class="no-comments">
            <el-empty description="No comments yet. Be the first to add one!" />
          </div>
        </div>
      </div>
    </div>

    <!-- Auth Required State -->
    <div v-else-if="!user && !isDevelopment" class="auth-required">
      <el-empty description="Please sign in with Gmail to access this shared task" />
    </div>
  </div>
</template>

<script>
import { User, Loading, Paperclip } from '@element-plus/icons-vue';
import { supabase } from '../supabase';
import { ElMessage, ElNotification } from 'element-plus';
import { useExternalTaskShare } from '../composables/useExternalTaskShare';

export default {
  name: 'ExternalTaskView',
  components: {
    User,
    Loading,
    Paperclip
  },
  setup() {
    const externalShare = useExternalTaskShare();
    return {
      ...externalShare
    };
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
      token: null,
      isDevelopment: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
      fileList: [],
      uploadingFiles: false,
      matter: null,
      loadingAttempts: 0
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

    // For local development, bypass authentication
    if (this.isDevelopment) {
      // Mock user for development
      this.user = {
        email: 'dev@localhost.com',
        user_metadata: {
          avatar_url: null
        }
      };
      await this.loadTaskData();
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

    // Add page visibility event listeners to handle tab switching
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  },
  beforeUnmount() {
    // Clean up event listeners
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  },
  computed: {
    filteredComments() {
      return this.comments.filter(comment => !comment.archived);
    }
  },
  methods: {
    handleVisibilityChange() {
      // When the page becomes visible again, check if we're in a loading state
      // with existing task data (indicating the loading got stuck)
      if (!document.hidden && this.loading && this.task) {
        console.log('Page became visible with stuck loading state, resetting...');
        this.loading = false;
      }
      
      // If page becomes visible and we don't have task data but should have it
      // (user is authenticated or in development mode), try to reload
      if (!document.hidden && !this.loading && !this.task && !this.error && (this.user || this.isDevelopment)) {
        console.log('Page became visible without task data, reloading...');
        this.loadTaskData();
      }
    },

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
        this.loadingAttempts++;
        console.log(`Loading task data - attempt ${this.loadingAttempts}`, { 
          shareId: this.shareId, 
          token: this.token ? 'present' : 'missing',
          userEmail: this.user?.email || 'no user'
        });
        
        this.loading = true;
        this.error = null;

        // Add timeout protection to prevent hanging
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Loading timed out')), 30000); // 30 second timeout
        });

        const loadPromise = (async () => {
          const shareData = await this.getExternalTaskAccess(this.shareId, this.token);
          this.task = shareData.tasks;
          this.matter = shareData.tasks.matters;
          
          // Load comments for the task
          const commentsData = await this.getTaskComments(shareData.task_id);
          this.comments = commentsData;
          
          console.log('Task data loaded successfully', { 
            taskId: this.task?.id, 
            commentsCount: this.comments?.length || 0 
          });
        })();

        await Promise.race([loadPromise, timeoutPromise]);

      } catch (error) {
        console.error('Error loading task data:', error);
        this.error = error.message;
      } finally {
        this.loading = false;
        console.log('Loading finished', { loading: this.loading, hasTask: !!this.task });
      }
    },

    async refreshTaskData() {
      console.log('Manually refreshing task data...');
      await this.loadTaskData();
    },

    // File upload methods
    handleFileChange(file, fileList) {
      this.fileList = fileList;
    },

    handleFileRemove(file, fileList) {
      this.fileList = fileList;
    },

    beforeFileUpload(file) {
      const isValidSize = file.size / 1024 / 1024 < 50; // 50MB limit
      if (!isValidSize) {
        ElMessage.error('File size must be less than 50MB');
      }
      return false; // Prevent auto upload
    },

    clearFiles() {
      this.fileList = [];
      this.$refs.fileUpload.clearFiles();
    },

    async uploadFiles() {
      if (!this.fileList.length) return [];

      try {
        this.uploadingFiles = true;
        const uploadedFiles = [];
        
        const giteaToken = import.meta.env.VITE_GITEA_TOKEN;
        const giteaHost = import.meta.env.VITE_GITEA_HOST;

        if (!giteaToken || !giteaHost) {
          throw new Error('File upload service is not properly configured');
        }

        if (!this.matter?.git_repo) {
          throw new Error('No git repository found for this matter');
        }

        for (const fileInfo of this.fileList) {
          const file = fileInfo.raw;
          const timestamp = Date.now();
          const fileExtension = file.name.split('.').pop();
          const baseName = file.name.replace(/\.[^/.]+$/, "");
          const uniqueName = `${baseName}_${timestamp}.${fileExtension}`;
          const filePath = `external_comments/${uniqueName}`;

          // Convert file to base64
          const base64Content = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64 = reader.result.split(',')[1];
              resolve(base64);
            };
            reader.readAsDataURL(file);
          });

          // Upload to Gitea
          const response = await fetch(
            `${giteaHost}/api/v1/repos/associateattorney/${this.matter.git_repo}/contents/${filePath}`,
            {
              method: 'POST',
              headers: {
                'Authorization': `token ${giteaToken}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                message: `Upload external comment attachment: ${file.name}`,
                content: base64Content,
                branch: 'main'
              })
            }
          );

          if (!response.ok) {
            throw new Error(`Failed to upload ${file.name}`);
          }

          const giteaData = await response.json();
          uploadedFiles.push({
            name: file.name,
            originalName: file.name,
            downloadUrl: giteaData.content.download_url,
            path: giteaData.content.path
          });
        }

        return uploadedFiles;
      } catch (error) {
        console.error('Error uploading files:', error);
        throw error;
      } finally {
        this.uploadingFiles = false;
      }
    },

    async addComment() {
      if (!this.newComment.trim() && this.fileList.length === 0) return;

      try {
        this.addingComment = true;

        // Upload files first if any
        let uploadedFiles = [];
        if (this.fileList.length > 0) {
          uploadedFiles = await this.uploadFiles();
        }

        // Prepare comment content with file links
        let commentContent = this.newComment.trim();
        
        if (uploadedFiles.length > 0) {
          const fileLinks = uploadedFiles.map(file => 
            `[${file.originalName}](${file.downloadUrl})`
          ).join('\n');
          
          if (commentContent) {
            commentContent = `${commentContent}\n\n${fileLinks}`;
          } else {
            commentContent = fileLinks;
          }
        }

        const newCommentData = await this.addExternalComment(
          this.task.id, 
          this.user.email, 
          commentContent
        );
        
        this.comments.unshift(newCommentData);
        this.newComment = '';
        this.clearFiles();

        ElNotification.success({
          title: 'Success',
          message: uploadedFiles.length > 0 
            ? `Comment with ${uploadedFiles.length} file(s) added successfully`
            : 'Comment added successfully'
        });

      } catch (error) {
        console.error('Error adding comment:', error);
        ElMessage.error('Failed to add comment: ' + error.message);
      } finally {
        this.addingComment = false;
      }
    },

    // Enhanced content formatting with file authentication
    formatCommentContent(text) {
      if (!text) return '';
      
      const giteaHost = import.meta.env.VITE_GITEA_HOST;
      const giteaToken = import.meta.env.VITE_GITEA_TOKEN;
      
      // Replace markdown file links with authenticated file links
      return text.split('\n').map(line => line.trim()).join('<br>').replace(
        /\[([^\]]+)\]\(([^)]+)\)/g, 
        (match, fileName, fileUrl) => {
          let authenticatedUrl = fileUrl;
          
          // Only modify URLs that match the Gitea host if both host and token are available
          if (giteaHost && giteaToken && fileUrl.startsWith(giteaHost)) {
            try {
              const url = new URL(fileUrl);
              
              // Remove any existing token parameter
              url.searchParams.delete('token');
              
              // Add token as query parameter
              url.searchParams.set('token', giteaToken);
              
              // Remove any duplicate question marks
              authenticatedUrl = url.toString().replace('??', '?');
            } catch (error) {
              console.error('Error creating authenticated URL:', error);
            }
          }

          return `<a class="file-link" href="${authenticatedUrl}" target="_blank" title="Click to view file">
            <el-icon><Paperclip /></el-icon>
            ${fileName}
          </a>`;
        }
      );
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

    getInitials(email) {
      if (!email) return '?';
      return email.charAt(0).toUpperCase();
    },

    getCommentAuthor(comment) {
      if (comment.external_user_email) {
        return comment.external_user_email;
      } else if (comment.user_id) {
        return 'Team Member';
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

.development-notice {
  padding: 1rem;
  background-color: #fff3cd;
  border-bottom: 1px solid #ffeaa7;
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

.loading-actions {
  margin-top: 1rem;
  text-align: center;
}

.loading-hint {
  margin-top: 0.5rem;
  font-size: 0.9rem;
  color: #666;
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

.description-content :deep(.file-link) {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: #007bff;
  text-decoration: none;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  margin: 0.25rem;
}

.description-content :deep(.file-link:hover) {
  text-decoration: none;
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

.file-upload-section {
  margin: 0.5rem 0;
}

.file-upload-section :deep(.el-upload) {
  width: 100%;
}

.file-upload-section :deep(.el-upload-list) {
  margin-top: 0.5rem;
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

.comment-content :deep(.file-link) {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: #007bff;
  text-decoration: none;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  margin: 0.25rem;
}

.comment-content :deep(.file-link:hover) {
  text-decoration: none;
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