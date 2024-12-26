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
      showAIDialog: false,
      aiPrompt: '',
      aiLoading: false,
      pythonApiBaseUrl: import.meta.env.VITE_PYTHON_API_URL,
      showTypeahead: false,
      typeaheadSuggestions: [],
      typeaheadSelectedIndex: -1,
      typeaheadTimer: null,
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
      } else if (lastWord === '@ai-attorney') {
        this.showAIDialog = true;
        this.aiPrompt = '';
      } else {
        // Handle typeahead suggestions
        if (this.typeaheadTimer) {
          clearTimeout(this.typeaheadTimer);
        }
        
        this.typeaheadTimer = setTimeout(() => {
          this.getTypeaheadSuggestions(text, selectionStart);
        }, 300);
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
    },

    async submitAIPrompt() {
      try {
        this.aiLoading = true;
        
        // Get file contents from comments
        const fileContents = [];
        
        // Format comments history
        const commentsHistory = this.comments.map(comment => {
          const timestamp = comment.updated_at || comment.created_at;
          const formattedDate = new Date(timestamp).toLocaleString();
          return `[${formattedDate}] ${this.userEmails[comment.user_id]}: ${comment.content}`;
        }).join('\n\n');
        
        // Create a system prompt that includes task context, comments history, and files
        const systemPrompt = `You are an AI legal assistant helping with a task titled "${this.task.title}". ${
          this.task.description 
            ? `The task description is: ${this.task.description}\n\n`
            : ''
        }

Comment History:
${commentsHistory}

Please provide assistance based on this context, the comment history, the available files, and the user's prompt.`;

        const response = await fetch(`${this.pythonApiBaseUrl}/gpt/get_ai_response`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: this.aiPrompt,
            systemPrompt: systemPrompt,
            taskId: this.task.id,
            matterId: this.task.matter_id,
            files: fileContents
          })
        });

        if (!response.ok) {
          throw new Error('Failed to get AI response');
        }

        const data = await response.json();

        // Set the AI response in the comment box
        this.newComment = `${data.response}`;

        this.showAIDialog = false;
        this.aiPrompt = '';
        ElMessage.success('AI response received successfully');
      } catch (error) {
        ElMessage.error('Error getting AI response: ' + error.message);
      } finally {
        this.aiLoading = false;
      }
    },

    async getFileContentsFromComments() {
      const fileUrls = new Set();
      const fileContents = [];

      // Extract all file URLs from comments
      for (const comment of this.comments) {
        const matches = comment.content.match(/\[([^\]]+)\]\(([^)]+)\)/g);
        if (matches) {
          matches.forEach(match => {
            const url = match.match(/\(([^)]+)\)/)[1];
            const fileName = match.match(/\[([^\]]+)\]/)[1];
            fileUrls.add({ url, fileName });
          });
        }
      }

      // Fetch content for each unique file
      for (const { url, fileName } of fileUrls) {
        try {
          const fileType = this.getFileType(fileName);
          let content;

          if (fileType === 'text/plain') {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to fetch ${url}`);
            content = await response.text();
          } else if (fileType.startsWith('image/') || fileType === 'application/pdf') {
            // Call our new endpoint for image and PDF processing
            const response = await fetch(`${this.pythonApiBaseUrl}/gpt/extract_file_content`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                url,
                fileType: fileType
              })
            });

            if (!response.ok) throw new Error(`Failed to process ${fileName}`);
            const data = await response.json();
            content = data.content;
          } else {
            content = `[File: ${fileName} (${fileType})]`;
          }

          fileContents.push({
            url,
            fileName,
            type: fileType,
            content
          });
        } catch (error) {
          console.error(`Error fetching file content: ${error}`);
          fileContents.push({
            url,
            fileName,
            type: this.getFileType(fileName),
            content: `[Error processing file: ${error.message}]`
          });
        }
      }

      return fileContents;
    },

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
        gif: 'image/gif'
      };
      return mimeTypes[ext] || 'application/octet-stream';
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

        if (!response.ok) throw new Error('Failed to get suggestions');
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

    handleTypeaheadNavigation(event) {
      if (!this.showTypeahead) return;
      
      switch (event.key) {
        case 'Tab':
          if (this.typeaheadSuggestions.length > 0) {
            event.preventDefault();
            // If nothing is selected, use the first suggestion
            const suggestionIndex = this.typeaheadSelectedIndex >= 0 
              ? this.typeaheadSelectedIndex 
              : 0;
            this.applySuggestion(this.typeaheadSuggestions[suggestionIndex]);
          }
          break;
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
        case 'Enter':
          if (this.typeaheadSelectedIndex >= 0) {
            event.preventDefault();
            this.applySuggestion(this.typeaheadSuggestions[this.typeaheadSelectedIndex]);
          }
          break;
        case 'Escape':
          this.showTypeahead = false;
          break;
      }
    },

    applySuggestion(suggestion) {
      const textarea = document.querySelector('.comment-input textarea');
      const cursorPos = textarea.selectionStart;
      const textBeforeCursor = this.newComment.slice(0, cursorPos);
      const textAfterCursor = this.newComment.slice(cursorPos);
      
      // Find the last word before cursor
      const words = textBeforeCursor.split(' ');
      const lastWord = words[words.length - 1];
      
      // Replace the incomplete word with the suggestion
      words[words.length - 1] = suggestion;
      this.newComment = words.join(' ') + textAfterCursor;
      
      // Reset typeahead
      this.showTypeahead = false;
      this.typeaheadSuggestions = [];
      
      // Set cursor position after the inserted suggestion
      this.$nextTick(() => {
        const newPos = cursorPos - lastWord.length + suggestion.length;
        textarea.setSelectionRange(newPos, newPos);
        textarea.focus();
      });
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
        <div v-if="showTypeahead" class="typeahead-suggestions">
          <div
            v-for="(suggestion, index) in typeaheadSuggestions"
            :key="index"
            :class="['typeahead-item', { selected: index === typeaheadSelectedIndex }]"
            @click="applySuggestion(suggestion)"
            @mouseover="typeaheadSelectedIndex = index"
          >
            {{ suggestion }}
          </div>
        </div>
        
        <el-input
          v-model="newComment"
          type="textarea"
          :rows="3"
          placeholder="Write a comment... (Type @files to mention a file)"
          @keyup.ctrl.enter="addComment"
          @keydown.tab.prevent="handleTypeaheadNavigation"
          @keydown="handleTypeaheadNavigation"
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

    <el-dialog
      v-model="showAIDialog"
      title="Ask AI Attorney"
      width="500px">
      <el-input
        v-model="aiPrompt"
        type="textarea"
        :rows="4"
        placeholder="What would you like to ask the AI attorney about this task?"
        :disabled="aiLoading"
      />
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showAIDialog = false" :disabled="aiLoading">Cancel</el-button>
          <el-button
            type="primary"
            @click="submitAIPrompt"
            :loading="aiLoading"
            :disabled="!aiPrompt.trim()">
            Submit
          </el-button>
        </span>
      </template>
    </el-dialog>
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
  position: relative;
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

.comment-content[data-type="ai_response"] {
  background-color: #f0f9eb;
  border-left: 4px solid #67c23a;
}

.ai-prompt {
  font-style: italic;
  color: #909399;
  margin-bottom: 8px;
  font-size: 0.9em;
}

.typeahead-suggestions {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 20px;
  right: 20px;
  background: white;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  max-height: 200px;
  overflow-y: auto;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  animation: slideIn 0.2s ease-out;
  padding: 4px 0;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.typeahead-item {
  padding: 10px 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  border-left: 3px solid transparent;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.typeahead-item::before {
  content: '→';
  color: transparent;
  transition: color 0.2s ease;
}

.typeahead-item:hover,
.typeahead-item.selected {
  background-color: #f5f7fa;
  border-left-color: #409EFF;
}

.typeahead-item:hover::before,
.typeahead-item.selected::before {
  color: #409EFF;
}

.typeahead-item.selected {
  background-color: #ecf5ff;
  color: #409EFF;
  font-weight: 500;
}

/* Custom scrollbar for the suggestions box */
.typeahead-suggestions::-webkit-scrollbar {
  width: 6px;
}

.typeahead-suggestions::-webkit-scrollbar-track {
  background: #f5f7fa;
  border-radius: 3px;
}

.typeahead-suggestions::-webkit-scrollbar-thumb {
  background: #dcdfe6;
  border-radius: 3px;
}

.typeahead-suggestions::-webkit-scrollbar-thumb:hover {
  background: #c0c4cc;
}
</style>