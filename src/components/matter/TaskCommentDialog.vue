<script>
import { supabase } from '../../supabase';
import { ElMessage } from 'element-plus';
import { FullScreen, Close } from '@element-plus/icons-vue';
import { ref } from 'vue';

export default {
  components: {
    FullScreen,
    Close
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
      showFileSelector: false,
      mentionIndex: -1,
      fileSearchQuery: ''
    };
  },
  computed: {
    filteredFiles() {
      if (!this.fileSearchQuery) return this.files;
      const query = this.fileSearchQuery.toLowerCase();
      return this.files.filter(file => 
        file.name.toLowerCase().includes(query)
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
        const response = await fetch(
          `/gitea/api/v1/repos/vikas/${this.task.git_repo}/contents/`,
          {
            headers: {
              'Authorization': `token ${giteaToken}`,
              'Accept': 'application/json'
            }
          }
        );

        if (!response.ok) throw new Error('Failed to fetch files');
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
      }
    },

    handleInput(event) {
      const text = event.target.value;
      const lastWord = text.slice(0, event.target.selectionStart).split(' ').pop();
      
      if (lastWord === '@files') {
        this.showFileSelector = true;
        this.mentionIndex = event.target.selectionStart;
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

    formatCommentText(text) {
      // Convert markdown-style links to HTML links
      return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="file-link">$1</a>');
    }
  },
  beforeUnmount() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
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
            @click="$router.push(`/matter/${task.matter_id}/tasks/${task.id}`)"
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
              <span class="comment-date">
                {{ new Date(comment.created_at).toLocaleString() }}
              </span>
            </div>
            <div class="comment-text" v-html="formatCommentText(comment.content)"></div>
          </div>
        </div>
      </div>

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
}

.comment-text {
  color: #606266;
  white-space: pre-wrap;
}

.comment-input {
  margin-top: auto;
  padding-top: 20px;
  border-top: 1px solid #eee;
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

:deep(.file-link) {
  color: #409EFF;
  text-decoration: none;
}

:deep(.file-link:hover) {
  text-decoration: underline;
}
</style>