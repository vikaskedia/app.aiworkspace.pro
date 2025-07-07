<template>
  <div class="external-task-view">
    <!-- Development Notice -->
    <!--div v-if="isDevelopment" class="development-notice">
      <el-alert
        title="Development Mode"
        type="warning"
        :closable="false"
        show-icon>
        <template #default>
          Authentication is bypassed for local development. In production, users must sign in with Gmail.
        </template>
      </el-alert>
    </div-->

    <!-- Header -->
    <div class="external-header">
      <div class="header-content">
        <div class="logo-section">
          <img src="/associate-ai-attorney-logo.svg" alt="AI Attorney" class="logo" />
          <div class="header-text">
            <h1>AI Workspace</h1>
            <p class="subtitle">Shared Task</p>
          </div>
        </div>
        
        <div class="auth-section">
          <div v-if="!user && !isDevelopment" class="login-prompt">
            <el-button type="primary" @click="signInWithGoogle" :loading="signingIn" size="large">
              <el-icon><User /></el-icon>
              <span class="auth-button-text">Sign in with Gmail</span>
            </el-button>
            <p class="auth-info">Please sign in to view and comment</p>
          </div>
          
          <div v-else class="user-info">
            <div class="user-profile">
              <el-avatar :src="user.user_metadata?.avatar_url" size="default">
                {{ user.email?.charAt(0).toUpperCase() }}
              </el-avatar>
              <div class="user-details">
                <span class="user-email">{{ user.email }}</span>
                <div class="user-tags">
                  <el-tag v-if="isDevelopment" type="warning" size="small">
                    Development Mode
                  </el-tag>
                </div>
              </div>
            </div>
            <el-button v-if="!isDevelopment" @click="signOut" size="default" class="sign-out-btn">
              Sign Out
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading && showLoadingSpinner" class="loading-container">
      <div class="loading-content">
        <el-icon class="loading-spinner"><Loading /></el-icon>
        <h3>Loading task details...</h3>
        <div v-if="loadingAttempts > 1" class="loading-actions">
          <el-button @click="refreshTaskData" size="large" type="primary">
            Try Again
          </el-button>
          <p class="loading-hint">
            <span v-if="loadingAttempts === 2">Taking longer than usual? </span>
            <span v-else>Still having trouble? </span>
            Check your connection and try refreshing.
          </p>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-container">
      <div class="error-content">
        <el-alert
          :title="error"
          type="error"
          :closable="false"
          show-icon>
          <template #default>
            <div class="error-actions">
              <el-button @click="refreshTaskData" type="primary" size="large">
                Retry
              </el-button>
              <el-button @click="$router.go(-1)" size="large">
                Go Back
              </el-button>
            </div>
          </template>
        </el-alert>
      </div>
    </div>

    <!-- Task Content -->
    <div v-else-if="task && (user || isDevelopment)" class="external-task-content">
      <div class="container">
        <!-- Task Header Section -->
        <div class="task-header-section">
          <h2 class="task-title">{{ task.title }}</h2>
          <div class="task-metadata">
            <div class="metadata-row">
              <el-tag :type="getStatusType(task.status)" size="default" class="status-tag">
                {{ formatStatus(task.status) }}
              </el-tag>
              <el-tag :type="getPriorityType(task.priority)" size="default" class="priority-tag">
                Priority: {{ task.priority }}
              </el-tag>
            </div>
            <div v-if="task.due_date" class="due-date-row">
              <el-icon class="date-icon"><Calendar /></el-icon>
              <span class="due-date">Due: {{ formatDueDate(task.due_date) }}</span>
            </div>
          </div>
        </div>

        <!-- Task Description -->
        <div class="task-description" v-if="task.description">
          <h3>Description</h3>
          <div class="description-content" v-html="formatCommentContent(task.description)"></div>
        </div>

        <!-- Comments Section -->
        <div class="external-comments-section">
          <h3>Comments</h3>
          
          <!-- Add Comment Form -->
          <div class="add-comment-form">
            <div class="form-header">
              <h4>Add a Comment</h4>
            </div>
            <el-form @submit.prevent="addComment">
              <el-form-item>
                                 <el-input
                   v-model="newComment"
                   type="textarea"
                   :rows="3"
                   placeholder="Write your comment here..."
                   maxlength="2000"
                   show-word-limit
                   class="comment-textarea"
                 />
              </el-form-item>
              
                                            <!-- File Upload Section -->
               <el-form-item>
                 <div class="file-upload-section">
                   <div class="upload-container">
                     <div class="upload-area">
                       <el-upload
                         ref="fileUpload"
                         :file-list="fileList"
                         :auto-upload="false"
                         :on-change="handleFileChange"
                         :on-remove="handleFileRemove"
                         :before-upload="beforeFileUpload"
                         multiple
                         :show-file-list="false"
                         action="#"
                         :limit="5"
                         class="custom-upload">
                         <el-button size="default" type="primary" plain class="upload-btn">
                           <el-icon><Paperclip /></el-icon>
                           <span>Attach Files</span>
                         </el-button>
                       </el-upload>
                       <div class="upload-info">
                         <span class="file-count" v-if="fileList.length > 0">
                           {{ fileList.length }} file{{ fileList.length > 1 ? 's' : '' }} selected
                         </span>
                         <span v-else class="upload-hint">Max 5 files, 50MB each</span>
                       </div>
                     </div>
                     
                     <!-- File List Display -->
                     <div v-if="fileList.length > 0" class="selected-files">
                       <div 
                         v-for="(file, index) in fileList" 
                         :key="index" 
                         class="file-item">
                         <div class="file-info">
                           <el-icon class="file-icon"><Document /></el-icon>
                           <span class="file-name">{{ file.name }}</span>
                           <span class="file-size">({{ formatFileSize(file.size) }})</span>
                         </div>
                         <el-button 
                           @click="removeFile(index)"
                           size="small" 
                           type="danger" 
                           text
                           class="remove-file-btn">
                           <el-icon><Close /></el-icon>
                         </el-button>
                       </div>
                     </div>
                   </div>
                 </div>
               </el-form-item>
              
                             <el-form-item class="form-actions">
                 <el-button 
                   type="primary" 
                   @click="addComment"
                   :loading="addingComment"
                   :disabled="!newComment.trim() && fileList.length === 0"
                   size="large"
                   class="submit-btn">
                   <el-icon><ChatDotRound /></el-icon>
                   Add Comment
                 </el-button>
               </el-form-item>
            </el-form>
          </div>

          <!-- Comments List -->
          <div class="comments-list">
            <div class="comments-header">
              <h4>
                {{ filteredComments.length }} 
                {{ filteredComments.length === 1 ? 'Comment' : 'Comments' }}
              </h4>
            </div>
            
            <div
              v-for="comment in filteredComments"
              :key="comment.id"
              class="comment-item">
              <div class="comment-header">
                <div class="comment-author">
                  <el-avatar size="default" class="author-avatar">
                    {{ getInitials(getCommentAuthor(comment)) }}
                  </el-avatar>
                  <div class="author-info">
                    <span class="author-name">
                      {{ getCommentAuthor(comment) }}
                    </span>
                    <div class="author-tags">
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
                  </div>
                </div>
                <span class="comment-time">{{ formatCommentTime(comment.created_at) }}</span>
              </div>
              <div class="comment-content" v-html="formatCommentContent(comment.content)"></div>
            </div>
            
            <div v-if="!filteredComments.length" class="no-comments">
              <el-empty description="No comments yet" />
              <p class="empty-hint">Be the first to add a comment!</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Auth Required State -->
    <div v-else-if="!user && !isDevelopment" class="auth-required">
      <div class="auth-content">
        <el-empty description="Authentication Required" />
        <p class="auth-message">Please sign in with Gmail to access this shared task</p>
        <el-button type="primary" @click="signInWithGoogle" :loading="signingIn" size="large">
          <el-icon><User /></el-icon>
          Sign in with Gmail
        </el-button>
      </div>
    </div>
  </div>
</template>

<script>
import { User, Loading, Paperclip, Calendar, ChatDotRound, Document, Close } from '@element-plus/icons-vue';
import { supabase } from '../supabase';
import { ElMessage, ElNotification } from 'element-plus';
import { useExternalTaskShare } from '../composables/useExternalTaskShare';

export default {
  name: 'ExternalTaskView',
  components: {
    User,
    Loading,
    Paperclip,
    Calendar,
    ChatDotRound,
    Document,
    Close
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
      loadingAttempts: 0,
      lastVisibilityChange: 0,
      isInitialLoad: true,
      loadingController: null,
      hasInitialLoadCompleted: false,
      isLoadingInProgress: false,
      showLoadingSpinner: false,
      loadingSpinnerTimeout: null
    };
  },
  async created() {
    // Get share ID and token from route params
    this.shareId = this.$route.params.shareId;
    this.token = this.$route.query.token;

    if (!this.shareId || !this.token) {
      this.error = 'Invalid share link';
      this.loading = false;
      this.isInitialLoad = false;
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
      this.isInitialLoad = false;
      this.hasInitialLoadCompleted = true;
    }

    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, 'User:', session?.user?.email);
      
      const previousUser = this.user;
      this.user = session?.user || null;
      
      // Only reload if this is a genuine new sign-in (not just session refresh)
      // and we don't already have task data loaded
      if (event === 'SIGNED_IN' && this.user && !previousUser && !this.task) {
        console.log('New user signed in, loading task data...');
        // Reset loading state for new authentication
        this.isInitialLoad = true;
        this.hasInitialLoadCompleted = false;
        await this.loadTaskData();
      }
    });

    // Visibility change listener disabled to prevent automatic reloading on tab switch
    // this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    // document.addEventListener('visibilitychange', this.handleVisibilityChange);
  },
  beforeUnmount() {
    // Clean up event listeners (currently disabled)
    // document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    
    // Cancel any pending loading operations
    if (this.loadingController) {
      this.loadingController.abort();
      this.loadingController = null;
    }
    
    // Reset loading state
    this.isLoadingInProgress = false;
    this.loading = false;
    
    // Clean up timeouts
    if (this.loadingSpinnerTimeout) {
      clearTimeout(this.loadingSpinnerTimeout);
      this.loadingSpinnerTimeout = null;
    }
  },
  computed: {
    filteredComments() {
      return this.comments.filter(comment => !comment.archived);
    }
  },
  methods: {
    handleVisibilityChange() {
      // Disabled automatic reloading on tab switch
      // Only log for debugging purposes
      if (!document.hidden) {
        console.log('Page became visible', { 
          hasTask: !!this.task, 
          isLoading: this.loading, 
          hasError: !!this.error,
          isAuthenticated: !!(this.user || this.isDevelopment)
        });
      }
      
      // No automatic reloading - let users manually refresh if needed
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
      // Prevent multiple concurrent loads
      if (this.isLoadingInProgress) {
        console.log('Load already in progress, skipping duplicate request');
        return;
      }

      // Cancel any existing loading operation
      if (this.loadingController) {
        this.loadingController.abort();
      }

      // Create new AbortController for this request
      this.loadingController = new AbortController();

      try {
        this.isLoadingInProgress = true;
        this.loadingAttempts++;
        
        this.loading = true;
        this.error = null;
        
        // Show loading spinner with a small delay to prevent UI flashing
        this.loadingSpinnerTimeout = setTimeout(() => {
          this.showLoadingSpinner = true;
        }, 300);

        // Shorter timeout for better UX (15 seconds instead of 30)
        const timeoutPromise = new Promise((_, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error('Request timed out. Please try again.'));
          }, 15000);
          
          // Clear timeout if request is aborted
          this.loadingController.signal.addEventListener('abort', () => {
            clearTimeout(timeoutId);
          });
        });

        // Add abort signal to prevent race conditions
        const loadPromise = (async () => {
          if (this.loadingController?.signal.aborted) {
            throw new Error('Request was cancelled');
          }

          // Check if user is offline
          if (!navigator.onLine) {
            throw new Error('No internet connection. Please check your connection and try again.');
          }

          let shareData;
          try {
            shareData = await this.getExternalTaskAccess(this.shareId, this.token);
          } catch (error) {
            // Handle network errors more gracefully
            if (error.message.includes('fetch') || error.message.includes('network') || 
                error.message.includes('Failed to fetch')) {
              throw new Error('Network connection error. Please check your internet connection and try again.');
            }
            throw error;
          }
          
          if (this.loadingController?.signal.aborted) {
            throw new Error('Request was cancelled');
          }

          this.task = shareData.tasks;
          this.matter = shareData.tasks.matters;
          
          // Load comments for the task
          let commentsData;
          try {
            commentsData = await this.getTaskComments(shareData.task_id);
          } catch (error) {
            // If comments fail to load, don't fail the whole operation
            console.warn('Failed to load comments:', error);
            commentsData = [];
          }
          
          if (this.loadingController?.signal.aborted) {
            throw new Error('Request was cancelled');
          }

          this.comments = commentsData;
          
          console.log('Task data loaded successfully', { 
            taskId: this.task?.id, 
            commentsCount: this.comments?.length || 0 
          });
        })();

        await Promise.race([loadPromise, timeoutPromise]);

        // Mark initial load as complete
        this.isInitialLoad = false;
        this.hasInitialLoadCompleted = true;

      } catch (error) {
        // Always mark initial load as attempted, even if it failed
        this.hasInitialLoadCompleted = true;
        
        // Don't show error if request was cancelled (user switched tabs quickly)
        if (error.message !== 'Request was cancelled') {
          console.error('Error loading task data:', error);
          this.error = error.message;
          // On error, reset initial load flag so visibility change can retry
          this.isInitialLoad = false;
        }
      } finally {
        this.loading = false;
        this.isLoadingInProgress = false;
        this.showLoadingSpinner = false;
        
        // Clean up timeouts
        if (this.loadingSpinnerTimeout) {
          clearTimeout(this.loadingSpinnerTimeout);
          this.loadingSpinnerTimeout = null;
        }
        
        // Clean up the controller reference
        if (this.loadingController) {
          this.loadingController = null;
        }
        console.log('Loading finished', { 
          loading: this.loading, 
          hasTask: !!this.task,
          hasError: !!this.error,
          isLoadingInProgress: this.isLoadingInProgress
        });
      }
    },

    async refreshTaskData() {
      console.log('Manually refreshing task data...');
      // Reset loading attempts counter for manual refresh
      this.loadingAttempts = 0;
      // Clear any previous error
      this.error = null;
      // Reset loading flags to allow fresh load
      this.isLoadingInProgress = false;
      this.hasInitialLoadCompleted = false;
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

    removeFile(index) {
      this.fileList.splice(index, 1);
      // Update the upload component's file list
      this.$refs.fileUpload.clearFiles();
      this.fileList.forEach(file => {
        this.$refs.fileUpload.handleStart(file.raw);
      });
    },

    formatFileSize(bytes) {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  font-family: 'Inter', 'Helvetica Neue', sans-serif;
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
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  position: sticky;
  top: 0;
  z-index: 1000;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
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

.header-text {
  display: flex;
  flex-direction: column;
}

.header-text h1 {
  font-size: 1.5rem;
  margin: 0;
  color: #2c3e50;
}

.header-text .subtitle {
  font-size: 0.8rem;
  color: #666;
  margin-top: 0.25rem;
}

.auth-section {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.auth-section .login-prompt {
  text-align: center;
}

.auth-info {
  margin-top: 0.5rem;
  color: #666;
  font-size: 0.9rem;
  text-align: center;
}

.auth-button-text {
  margin-left: 0.5rem;
}

.auth-message {
  font-size: 1rem;
  color: #666;
  margin: 1rem 0;
  text-align: center;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.user-profile {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.user-details {
  display: flex;
  flex-direction: column;
}

.user-email {
  font-weight: 500;
}

.user-tags {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.sign-out-btn {
  margin-left: 1rem;
}

.loading-container, .error-container, .auth-required {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  min-height: 50vh;
  gap: 1rem;
}

.loading-content, .error-content, .auth-content {
  text-align: center;
  padding: 2rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.loading-spinner {
  font-size: 2rem;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.loading-actions, .error-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 1rem;
  align-items: center;
}

.loading-hint, .empty-hint {
  margin-top: 0.5rem;
  font-size: 0.9rem;
  color: #666;
}

.external-task-content {
  max-width: 1000px;
  margin: 1rem auto;
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
  backdrop-filter: blur(10px);
  min-height: calc(100vh - 200px);
}

.container {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.task-header-section {
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #e0e0e0;
}

.task-title {
  font-size: clamp(1.5rem, 4vw, 2rem);
  margin-bottom: 1rem;
  color: #2c3e50;
  line-height: 1.3;
  word-break: break-word;
}

.task-metadata {
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
}

.metadata-row {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.status-tag, .priority-tag {
  flex-shrink: 0;
}

.due-date-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.date-icon {
  font-size: 1.1rem;
  color: #666;
}

.due-date {
  color: #666;
  font-size: 0.9rem;
}

.task-description {
  margin-bottom: 1rem;
}

.task-description h3 {
  color: #2c3e50;
  margin-bottom: 1rem;
  margin-top: 0;
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
  margin-top: 0;
}

.add-comment-form {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
}

.form-header {
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px dashed #e0e0e0;
}

.form-header h4 {
  font-size: 1.2rem;
  margin: 0;
  color: #2c3e50;
}

.file-upload-section {
  margin: 0.5rem 0 0 0;
}

.upload-container {
  border: 1px dashed #d9d9d9;
  border-radius: 8px;
  padding: 1rem;
  background: #fafafa;
  transition: all 0.3s ease;
}

.upload-container:hover {
  border-color: #409eff;
  background: #f0f9ff;
}

.upload-area {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.upload-btn {
  flex-shrink: 0;
}

.upload-btn span {
  margin-left: 0.5rem;
}

.upload-info {
  display: flex;
  align-items: center;
  flex: 1;
  justify-content: flex-end;
}

.file-count {
  font-weight: 500;
  color: #409eff;
  font-size: 0.9rem;
}

.upload-hint {
  font-size: 0.8rem;
  color: #999;
}

.selected-files {
  margin-top: 1rem;
  border-top: 1px solid #e8eaed;
  padding-top: 0.75rem;
}

.file-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  background: white;
  border: 1px solid #e8eaed;
  border-radius: 6px;
  margin-bottom: 0.5rem;
  transition: all 0.2s ease;
}

.file-item:hover {
  background: #f8f9fa;
  border-color: #d0d7de;
}

.file-item:last-child {
  margin-bottom: 0;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
}

.file-icon {
  color: #606266;
  font-size: 1.1rem;
  flex-shrink: 0;
}

.file-name {
  font-weight: 500;
  color: #303133;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

.file-size {
  color: #909399;
  font-size: 0.8rem;
  flex-shrink: 0;
}

.remove-file-btn {
  padding: 0.25rem;
  min-height: auto;
  width: auto;
  height: auto;
  flex-shrink: 0;
}

.custom-upload :deep(.el-upload) {
  width: auto;
}

.file-upload-section :deep(.el-upload) {
  width: auto;
}

.file-upload-section :deep(.el-upload-list) {
  display: none;
}

.form-actions {
  margin-top: 1rem;
}

.submit-btn {
  width: 100%;
  min-height: 40px;
  font-weight: 500;
}

.comment-textarea :deep(.el-textarea__inner) {
  min-height: 80px !important;
  font-size: 16px !important;
  line-height: 1.4 !important;
  border-radius: 8px !important;
  resize: vertical !important;
}

.comment-textarea :deep(.el-input__count) {
  font-size: 0.8rem;
  color: #999;
}

.comments-list {
  max-height: 70vh;
  overflow-y: auto;
  padding-right: 4px;
}

.comments-list::-webkit-scrollbar {
  width: 6px;
}

.comments-list::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.comments-list::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.comments-list::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

.comments-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.comments-header h4 {
  font-size: 1.1rem;
  color: #2c3e50;
  margin: 0;
}

.comment-item {
  padding: 1.25rem;
  border: 1px solid #e8eaed;
  border-radius: 12px;
  margin-bottom: 1rem;
  background: #fafbfc;
  transition: all 0.2s ease;
  position: relative;
}

.comment-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  border-color: #dadce0;
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

.author-avatar {
  flex-shrink: 0;
}

.author-info {
  display: flex;
  flex-direction: column;
}

.author-name {
  font-weight: 500;
}

.author-tags {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.25rem;
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
  color: #1976d2;
  text-decoration: none;
  border-radius: 8px;
  transition: all 0.2s ease;
  font-weight: 500;
}

.comment-content :deep(.file-link:hover) {
  text-decoration: none;
  transform: translateY(-1px);
}

.no-comments {
  text-align: center;
  padding: 2rem;
}

@media (max-width: 768px) {
  .external-header {
    padding: 1rem;
  }

  .header-content {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    width: 100%;
  }

  .logo-section {
    flex-direction: row;
    align-items: center;
    flex: 1;
  }

  .logo {
    height: 32px;
  }

  .header-text h1 {
    font-size: 1.1rem;
  }

  .header-text .subtitle {
    font-size: 0.8rem;
  }

  .auth-section {
    flex-shrink: 0;
  }

  .login-prompt {
    width: 100%;
    text-align: center;
  }

  .user-info {
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .user-profile {
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
    min-width: 0;
  }

  .user-details {
    align-items: flex-start;
    min-width: 0;
    flex: 1;
  }

  .user-email {
    font-size: 0.8rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .user-tags {
    flex-wrap: wrap;
    justify-content: flex-start;
  }

  .sign-out-btn {
    margin-left: 0;
    font-size: 0.8rem;
    padding: 0.5rem 0.75rem;
    flex-shrink: 0;
  }

  .external-task-content {
    margin: 0.5rem;
    padding: 1rem;
    border-radius: 8px;
  }

  .container {
    gap: 0.5rem;
  }
  
  .task-title {
    font-size: 1.3rem;
    text-align: center;
  }
  
  .task-metadata {
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .metadata-row {
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    width: 100%;
    flex-wrap: wrap;
  }

  .status-tag, .priority-tag {
    width: auto;
    min-width: 100px;
    justify-content: center;
    flex-shrink: 0;
  }

  .due-date-row {
    justify-content: center;
    width: 100%;
  }

  .date-icon {
    font-size: 1rem;
  }

  .task-description h3,
  .external-comments-section h3 {
    font-size: 1.2rem;
    text-align: center;
  }

  .add-comment-form {
    padding: 0.75rem;
    border-radius: 8px;
  }

  .form-header h4 {
    font-size: 1.1rem;
    text-align: center;
  }

  .upload-container {
    padding: 0.75rem;
  }

  .upload-area {
    flex-direction: row;
    align-items: stretch;
    gap: 0.75rem;
  }

  .upload-info {
    justify-content: center;
  }

  .file-name {
    max-width: 150px;
  }

  .submit-btn {
    font-size: 1rem;
  }

  .comments-header {
    text-align: center;
  }

  .comments-header h4 {
    font-size: 1rem;
  }

  .comment-item {
    padding: 1rem;
    margin-bottom: 1rem;
  }

  .comment-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .comment-author {
    flex-direction: row;
    align-items: center;
    gap: 0.75rem;
  }

  .author-info {
    flex: 1;
  }

  .comment-time {
    font-size: 0.8rem;
    align-self: flex-end;
  }

  .comment-content {
    margin-top: 0.75rem;
    font-size: 0.95rem;
    line-height: 1.6;
  }

  .no-comments {
    padding: 1.5rem;
  }

  .empty-hint {
    font-size: 0.9rem;
  }

  .loading-content, .error-content, .auth-content {
    margin: 1rem;
    padding: 1.5rem;
  }
}

@media (max-width: 480px) {
  .external-header {
    padding: 0.75rem;
  }

  .header-content {
    gap: 0.5rem;
  }

  .logo {
    height: 28px;
  }

  .header-text h1 {
    font-size: 0.9rem;
  }

  .header-text .subtitle {
    font-size: 0.7rem;
  }

  .user-profile {
    gap: 0.25rem;
  }

  .user-email {
    font-size: 0.7rem;
    max-width: 120px;
  }

  .sign-out-btn {
    font-size: 0.7rem;
    padding: 0.25rem 0.5rem;
  }

  .auth-button-text {
    display: none;
  }

  .external-task-content {
    margin: 0.25rem;
    padding: 0.75rem;
  }

  .container {
    gap: 0.5rem;
  }

  .task-title {
    font-size: 1.2rem;
  }

  .add-comment-form {
    padding: 0.5rem;
  }

  .comment-textarea :deep(.el-textarea__inner) {
    font-size: 16px !important;
    min-height: 70px !important;
  }

  .comment-item {
    padding: 0.75rem;
  }

  .upload-container {
    padding: 0.5rem;
  }

  .file-name {
    max-width: 120px;
  }

  .submit-btn {
    min-height: 42px;
    font-size: 0.9rem;
  }
}
</style> 