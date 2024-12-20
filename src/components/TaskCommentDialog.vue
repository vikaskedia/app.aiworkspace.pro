<script>
import { supabase } from '../supabase';
import { ElMessage } from 'element-plus';

export default {
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
      userEmails: {}
    };
  },
  watch: {
    visible: {
      handler(newVal) {
        if (newVal && this.task) {
          this.loadComments();
        }
      },
      immediate: true
    },
    task: {
      handler(newTask) {
        if (newTask && this.visible) {
          this.loadComments();
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
    <div class="comments-container">
      <div class="comments-list" v-loading="loading">
        <div v-for="comment in comments" :key="comment.id" class="comment">
          <div class="comment-header">
            <span class="comment-author">{{ userEmails[comment.user_id] }}</span>
            <span class="comment-date">{{ new Date(comment.created_at).toLocaleString() }}</span>
          </div>
          <div class="comment-content">{{ comment.content }}</div>
        </div>
        <div v-if="comments.length === 0" class="no-comments">
          No comments yet
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

.comments-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.comment {
  padding: 12px;
  background-color: #f5f7fa;
  border-radius: 8px;
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

.comment-content {
  white-space: pre-wrap;
}

.comment-input {
  margin-top: auto;
  padding-top: 20px;
  border-top: 1px solid #eee;
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
</style>