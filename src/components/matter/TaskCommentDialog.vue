<script>
import { supabase } from '../../supabase';
import { ElMessage } from 'element-plus';
import { FullScreen, Close, Folder } from '@element-plus/icons-vue';
import { ref } from 'vue';

export default {
  components: {
    FullScreen,
    Close,
    Folder
  },
  props: {
    task: {
      type: Object,
      required: true
    },
    visible: {
      type: Boolean,
      required: true
    }
  },
  emits: ['update:visible'],
  data() {
    return {
      comments: [],
      newComment: '',
      loading: false,
      userEmails: {},
      subscription: null,
      files: [],
      folders: [],
      showFileSelector: false,
      mentionIndex: -1,
      fileSearchQuery: '',
      editingCommentId: null,
      editingCommentText: '',
      currentUser: null,
      expandedCommentHistories: new Set(),
      currentSelectorFolder: null,
      selectorBreadcrumbs: [],
    };
  },
  computed: {
    filteredFiles() {
      const items = [...this.folders, ...this.files];
      if (!this.fileSearchQuery) return items;
      const query = this.fileSearchQuery.toLowerCase();
      return items.filter(item => 
        item.name.toLowerCase().includes(query)
      );
    }
  },
  watch: {
    visible: {
      handler(newVal) {
        if (newVal && this.task) {
          this.loadComments();
          this.setupRealtimeSubscription();
        } else {
          if (this.subscription) {
            this.subscription.unsubscribe();
          }
        }
      },
      immediate: true
    },
    task: {
      handler(newTask) {
        if (newTask && this.visible) {
          this.loadComments();
          this.setupRealtimeSubscription();
        }
      },
      immediate: true
    }
  },
  methods: {
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

    async loadFiles() {
      try {
        const giteaToken = import.meta.env.VITE_GITEA_TOKEN;
        
        // First get the matter's git repo
        const { data: matter, error: matterError } = await supabase
          .from('matters')
          .select('git_repo')
          .eq('id', this.task.matter_id)
          .single();

        if (matterError) {
          throw new Error('Failed to fetch matter details');
        }

        if (!matter?.git_repo) {
          throw new Error('No git repository found for this matter');
        }

        const path = this.currentSelectorFolder?.path || '';
        const response = await fetch(
          `/gitea/api/v1/repos/vikas/${matter.git_repo}/contents/${path}`,
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
            download_url: file.download_url.replace(import.meta.env.VITE_GITEA_HOST, '/gitea')
          }));

      } catch (error) {
        ElMessage.error('Error loading files: ' + error.message);
        this.files = [];
        this.folders = [];
      }
    },

    handleInput(event) {
      // For Element Plus input events, the value is passed directly
      const text = typeof event === 'string' ? event : event?.target?.value || '';
      
      // Get the current cursor position from the textarea element
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
    },

    formatMarkdownLinks(text) {
      return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="file-link">$1</a>');
    },

    startEditing(comment) {
      // Only allow editing if this is the latest comment
      const isLatestComment = this.comments[0].id === comment.id;
      if (!isLatestComment) {
        ElMessage.warning('Only the most recent comment can be edited');
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
    }
  },
  beforeUnmount() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    document.removeEventListener('click', this.handleClickOutside);
  },
  async created() {
    const { data: { user } } = await supabase.auth.getUser();
    this.currentUser = user;
  },
  mounted() {
    this.handleClickOutside = (event) => {
      if (event.target.classList.contains('edited-marker')) {
        const commentId = event.target.dataset.commentId;
        if (this.expandedCommentHistories.has(commentId)) {
          this.expandedCommentHistories.delete(commentId);
        } else {
          this.expandedCommentHistories.add(commentId);
        }
        // Force update
        this.$forceUpdate();
      }
    };
    document.addEventListener('click', this.handleClickOutside);
  }
};
</script>

<template>
  <el-drawer
    :model-value="visible"
    @update:model-value="$emit('update:visible', $event)"
    :title="`Comments - ${task.title}`"
    direction="rtl"
    size="35%">
    <template #header>
      <div style="display: flex; align-items: center; gap: 8px;">
        <span>Comments - {{ task.title }}</span>
        <div style="margin-left: auto; display: flex; gap: 8px;">
          <el-button
            type="primary"
            link
            @click="$router.push({
              name: 'SingleTaskPage',
              params: {
                matterId: task.matter_id,
                taskId: task.id
              }
            })"
            style="padding: 0">
            <el-icon><FullScreen /></el-icon>
          </el-button>

        </div>
      </div>
    </template>
    <div class="comments-container">
      <div class="comment-list">
        <div v-for="comment in comments" :key="comment.id" class="comment-item">
          <div :class="['comment-content', comment.type === 'activity' ? 'activity' : '']">
            <div class="comment-header">
              <span class="comment-author">{{ userEmails[comment.user_id] }}</span>
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
                  v-if="comment.user_id === currentUser?.id && comments[0].id === comment.id"
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
              <span v-html="formatMarkdownLinks(comment.content)"></span>
              <div v-if="expandedCommentHistories.has(comment.id)" class="edit-history">
                <div v-for="(historyEntry, index) in comment.comment_edit_history" :key="index" class="edit-history-entry">
                  <div class="edit-history-header">Version {{ index + 1 }}:</div>
                  <div class="previous-content" v-html="formatMarkdownLinks(historyEntry.previous_content)"></div>
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
          :type="'string'"
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
  </el-drawer>
</template>

<style scoped>
.comments-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
  height: 100%;
  padding: 20px;
}

.comment-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 15px;
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
  display: flex;
  align-items: center;
  gap: 4px;
}

.comment-text {
  color: #606266;
  white-space: pre-wrap;
}

.comment-input {
  margin-top: auto;
  padding: 20px;
  border-top: 1px solid #eee;
}

:deep(.el-dialog) {
  margin-top: 15vh !important;
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

:deep(.file-link) {
  color: #409EFF;
  text-decoration: none;
}

:deep(.file-link:hover) {
  text-decoration: underline;
}

@media (max-width: 1024px) {
  :deep(.el-drawer) {
    width: 50% !important;
  }
}

@media (max-width: 768px) {
  :deep(.el-drawer) {
    width: 90% !important;
  }
}

.edit-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 8px;
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

.file-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.folder-icon {
  color: #909399;
}

.file-selector-header {
  margin-bottom: 1rem;
}

.clickable {
  cursor: pointer;
  color: #409EFF;
}

.clickable:hover {
  text-decoration: underline;
}
</style>