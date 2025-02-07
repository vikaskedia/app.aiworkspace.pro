<template>
    <el-drawer
      :model-value="modelValue"
      :title="goal?.title"
      direction="rtl"
      size="50%"
      @update:model-value="$emit('update:modelValue', $event)">
      
      <!-- Goal Details Section -->
      <div class="goal-details-container">
        <div class="goal-info-section">
          <div class="goal-metadata">
            <el-tag :type="goal?.status === 'completed' ? 'success' : 'warning'">
              {{ goal?.status }}
            </el-tag>
            <el-tag :type="getPriorityType(goal)">
              {{ formatPriority(goal?.priority) }}
            </el-tag>
            <span class="due-date">
              Due: {{ goal?.due_date ? new Date(goal?.due_date).toLocaleDateString() : 'Not set' }}
            </span>
          </div>
          
          <div class="goal-description">
            <h4 style="margin-bottom: 7px;">Description</h4>
            <p style="margin: 0;">{{ goal?.description || 'No description provided' }}</p>
          </div>
  
          <!-- <div class="goal-progress">
            <h4>Progress</h4>
            <el-progress 
              :percentage="goal?.completion_percentage"
              :status="goal?.completion_percentage === 100 ? 'success' : ''"
            />
          </div> -->
        </div>
  
        <!-- Comments Section -->
        <div class="comments-section">
          <div class="comments-header">
            <h4>Comments</h4>
            <span class="comment-count">{{ comments.length }} comments</span>
          </div>
          
          <div class="comments-list">
            <div v-for="comment in comments" 
                 :key="comment.id" 
                 class="comment">
              <div class="comment-header">
                <div class="author-info">
                  <el-avatar 
                    :size="28"
                    :src="comment.profiles?.avatar_url">
                    {{ getInitials(comment.profiles?.full_name || comment.profiles?.email) }}
                  </el-avatar>
                  <div class="author-details">
                    <span class="comment-author">
                      {{ comment.profiles?.full_name || comment.profiles?.email }}
                    </span>
                    <span class="comment-date">
                      {{ formatDate(comment.created_at) }}
                    </span>
                  </div>
                </div>
              </div>
              <div class="comment-content">{{ comment.content }}</div>
            </div>
          </div>
          
          <div class="comment-input">
            <el-input
              v-model="newComment"
              type="textarea"
              :rows="3"
              resize="none"
              placeholder="Write a comment..."
            />
            <div class="comment-actions">
              <el-button 
                type="primary" 
                @click="addComment" 
                :disabled="!newComment.trim()">
                Add Comment
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </el-drawer>
  </template>
  
  <script>
  import { supabase } from '../../supabase';
  import { ElMessage } from 'element-plus';
  
  export default {
    props: {
      modelValue: {
        type: Boolean,
        required: true
      },
      goal: {
        type: Object,
        default: () => ({})
      }
    },
    emits: ['update:modelValue'],
    data() {
      return {
        newComment: '',
        comments: []
      }
    },
    watch: {
      goal: {
        immediate: true,
        handler(newGoal) {
          if (newGoal?.id) {
            this.loadComments();
          }
        }
      }
    },
    methods: {
      getPriorityType(goal) {
        if (!goal?.priority) return '';
        switch (goal.priority) {
          case 'high': return 'danger';
          case 'medium': return 'warning';
          case 'low': return 'info';
          default: return '';
        }
      },
      formatPriority(priority) {
        if (!priority) return 'Not set';
        return priority.charAt(0).toUpperCase() + priority.slice(1);
      },
      async loadComments() {
        try {
          const { data: comments, error } = await supabase
            .from('goal_comments')
            .select('*')
            .eq('goal_id', this.goal.id)
            .order('created_at', { ascending: true });
  
          if (error) throw error;
  
          // Load user info for each comment
          for (const comment of comments) {
            if (comment.created_by) {
              const { data: userData } = await supabase
                .rpc('get_user_info_by_id', {
                  user_id: comment.created_by
                });
              if (userData?.[0]) {
                comment.profiles = {
                  full_name: userData[0].full_name,
                  email: userData[0].email,
                  avatar_url: userData[0].avatar_url
                };
              }
            }
          }
  
          this.comments = comments;
        } catch (error) {
          ElMessage.error('Error loading comments: ' + error.message);
        }
      },
      async addComment() {
        if (!this.newComment.trim()) return;
  
        try {
          const { data: { user } } = await supabase.auth.getUser();
          
          const { error } = await supabase
            .from('goal_comments')
            .insert({
              goal_id: this.goal.id,
              content: this.newComment,
              created_by: user.id
            });
  
          if (error) throw error;
  
          await this.loadComments();
          this.newComment = '';
          ElMessage.success('Comment added successfully');
        } catch (error) {
          ElMessage.error('Error adding comment: ' + error.message);
        }
      },
      getInitials(name) {
        if (!name) return '?';
        return name
          .split(' ')
          .map(word => word[0])
          .join('')
          .toUpperCase()
          .slice(0, 2);
      },
      
      formatDate(date) {
        const d = new Date(date);
        const now = new Date();
        const diff = now - d;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        
        if (days === 0) {
          return d.toLocaleTimeString(undefined, { 
            hour: '2-digit', 
            minute: '2-digit' 
          });
        } else if (days === 1) {
          return 'Yesterday';
        } else if (days < 7) {
          return `${days} days ago`;
        } else {
          return d.toLocaleDateString();
        }
      }
    }
  }
  </script>
  
  <style scoped>
  .goal-details-container {
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  
  .goal-info-section {
    padding-bottom: 20px;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }
  
  .goal-metadata {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 20px;
  }
  
  .comments-section {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 20px 0 0 0;
  }
  
  .comments-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }
  
  .comments-header h4 {
    margin: 0;
    font-size: 16px;
    color: var(--el-text-color-primary);
  }
  
  .comment-count {
    font-size: 14px;
    color: var(--el-text-color-secondary);
  }
  
  .comments-list {
    flex: 1;
    overflow-y: auto;
    margin-bottom: 20px;
  }
  
  .comment {
    padding: 16px;
    background: var(--el-fill-color-light);
    border-radius: 8px;
    margin-bottom: 16px;
  }
  
  .comment-header {
    margin-bottom: 12px;
  }
  
  .author-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .author-details {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  
  .comment-author {
    font-weight: 500;
    color: var(--el-color-primary);
    font-size: 14px;
  }
  
  .comment-date {
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }
  
  .comment-content {
    color: var(--el-text-color-regular);
    line-height: 1.5;
    font-size: 14px;
    white-space: pre-wrap;
    padding: 0;
  }
  
  .comment-input {
    position: sticky;
    bottom: 0;
    background: var(--el-bg-color);
    padding: 20px 0;
    border-top: 1px solid var(--el-border-color-lighter);
  }
  
  .comment-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 12px;
  }
  
  :deep(.el-avatar) {
    background: var(--el-color-primary);
    color: white;
    font-size: 12px;
    font-weight: 500;
  }
  </style> 