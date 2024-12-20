<script>
import { supabase } from '../supabase';
import { ElMessage } from 'element-plus';
import { useMatterStore } from '../store/matter';
import { storeToRefs } from 'pinia';
import TaskCommentDialog from './TaskCommentDialog.vue';
import { useCacheStore } from '../store/cache';
import TasksList from './TasksList.vue'

export default {
  setup() {
    const matterStore = useMatterStore();
    const cacheStore = useCacheStore();
    const { currentMatter } = storeToRefs(matterStore);
    return { currentMatter, cacheStore };
  },
  components: {
    TaskCommentDialog,
    TasksList
  },
  data() {
    return {
      subscription: null,
      tasks: [],
      loading: false,
      dialogVisible: false,
      newTask: {
        title: '',
        description: '',
        status: 'pending',
        priority: 'medium',
        due_date: null,
        assignee: null
      },
      sharedUsers: [],
      editingTask: null,
      editDialogVisible: false,
      commentDialogVisible: false,
      selectedTask: null
    };
  },
  watch: {
    currentMatter: {
      async handler(newMatter, oldMatter) {
        if (newMatter) {
          await Promise.all([
            this.loadTasks(),
            this.loadSharedUsers()
          ]);
          if (!oldMatter) {
            this.setupRealtimeSubscription();
          }
        } else {
          if (this.subscription) {
            this.subscription.unsubscribe();
          }
          this.tasks = [];
          this.sharedUsers = [];
        }
      },
      immediate: true
    }
  },
  methods: {
    async loadTasks() {
      if (!this.currentMatter) return;
      
      try {
        this.loading = true;
        
        // Check cache first
        const cachedTasks = this.cacheStore.getCachedData('tasks', this.currentMatter.id);
        if (cachedTasks) {
          this.tasks = cachedTasks;
          this.loading = false;
          return;
        }

        const { data: tasks, error } = await supabase
          .from('tasks')
          .select('*')
          .eq('matter_id', this.currentMatter.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        this.tasks = tasks;
        // Store in cache
        this.cacheStore.setCachedData('tasks', this.currentMatter.id, tasks);
      } catch (error) {
        ElMessage.error('Error loading tasks: ' + error.message);
      } finally {
        this.loading = false;
      }
    },

    async createTask() {
      if (!this.currentMatter) {
        ElMessage.warning('Please select a matter first');
        return;
      }

      try {
        this.loading = true;
        const { data: { user } } = await supabase.auth.getUser();
        
        const taskData = {
          ...this.newTask,
          matter_id: this.currentMatter.id,
          created_by: user.id
        };

        const { data, error } = await supabase
          .from('tasks')
          .insert([taskData])
          .select();

        if (error) throw error;

        // Log task creation activity
        await supabase
          .from('task_comments')
          .insert({
            task_id: data[0].id,
            user_id: user.id,
            content: 'Created this task',
            type: 'activity',
            metadata: {
              action: 'create',
              task_title: data[0].title
            }
          });
        
        this.dialogVisible = false;
        this.resetForm();
        ElMessage.success('Task created successfully');
      } catch (error) {
        ElMessage.error('Error creating task: ' + error.message);
      } finally {
        this.loading = false;
      }
    },

    resetForm() {
      this.newTask = {
        title: '',
        description: '',
        status: 'pending',
        priority: 'medium',
        due_date: null,
        assignee: null
      };
      this.loadSharedUsers();
    },

    async loadSharedUsers() {
      try {
        const { data: shares, error } = await supabase
          .from('matter_shares')
          .select('id, shared_with_user_id, access_type')
          .eq('matter_id', this.currentMatter.id);

        if (error) throw error;

        // Get user details for each share
        const sharesWithUserInfo = await Promise.all(
          shares.map(async (share) => {
            const { data: userData, error: userError } = await supabase
              .rpc('get_user_info_by_id', {
                user_id: share.shared_with_user_id
              });

            if (userError) throw userError;

            return {
              id: share.shared_with_user_id,
              email: userData[0].email
            };
          })
        );

        // Add the matter owner
        const { data: ownerData } = await supabase
          .rpc('get_user_info_by_id', {
            user_id: this.currentMatter.created_by
          });

        this.sharedUsers = [
          { id: this.currentMatter.created_by, email: ownerData[0].email },
          ...sharesWithUserInfo
        ];
      } catch (error) {
        ElMessage.error('Error loading shared users: ' + error.message);
      }
    },

    async updateTask(task) {
      try {
        this.loading = true;
        const originalTask = this.tasks.find(t => t.id === task.id);
        const { data: { user } } = await supabase.auth.getUser();
        
        const { data, error } = await supabase
          .from('tasks')
          .update({
            assignee: task.assignee,
            status: task.status
          })
          .eq('id', task.id)
          .select();

        if (error) throw error;

        // Log changes as activities
        const changes = [];
        if (originalTask.status !== task.status) {
          changes.push(`status from "${originalTask.status}" to "${task.status}"`);
        }
        if (originalTask.assignee !== task.assignee) {
          const oldAssignee = this.sharedUsers.find(u => u.id === originalTask.assignee)?.email || 'unassigned';
          const newAssignee = this.sharedUsers.find(u => u.id === task.assignee)?.email || 'unassigned';
          changes.push(`assignee from ${oldAssignee} to ${newAssignee}`);
        }

        if (changes.length > 0) {
          await supabase
            .from('task_comments')
            .insert({
              task_id: task.id,
              user_id: user.id,
              content: `Updated ${changes.join(' and ')}`,
              type: 'activity',
              metadata: {
                action: 'update',
                changes: {
                  status: task.status !== originalTask.status ? {
                    from: originalTask.status,
                    to: task.status
                  } : null,
                  assignee: task.assignee !== originalTask.assignee ? {
                    from: originalTask.assignee,
                    to: task.assignee
                  } : null
                }
              }
            });
        }
        
        const index = this.tasks.findIndex(t => t.id === task.id);
        if (index !== -1) {
          this.tasks[index] = data[0];
        }
        
        this.editDialogVisible = false;
        this.editingTask = null;
        ElMessage.success('Task updated successfully');
      } catch (error) {
        ElMessage.error('Error updating task: ' + error.message);
      } finally {
        this.loading = false;
      }
    },

    setupRealtimeSubscription() {
      if (this.subscription) {
        this.subscription.unsubscribe();
      }
      
      this.subscription = supabase
        .channel('tasks-changes')
        .on('postgres_changes', 
          { 
            event: '*',
            schema: 'public',
            table: 'tasks',
            filter: `matter_id=eq.${this.currentMatter.id}`
          },
          (payload) => {
            switch (payload.eventType) {
              case 'INSERT':
                // Add new task to the beginning of the list
                this.tasks.unshift(payload.new);
                break;
              
              case 'UPDATE':
                // Update existing task
                const updateIndex = this.tasks.findIndex(task => task.id === payload.new.id);
                if (updateIndex !== -1) {
                  this.tasks[updateIndex] = payload.new;
                }
                break;
              
              case 'DELETE':
                // Remove deleted task
                const deleteIndex = this.tasks.findIndex(task => task.id === payload.old.id);
                if (deleteIndex !== -1) {
                  this.tasks.splice(deleteIndex, 1);
                }
                break;
            }
          }
        )
        .subscribe();
    },
  },

  mounted() {
    if (this.currentMatter) {
      this.setupRealtimeSubscription();
      this.loadSharedUsers();
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
  <div class="tasks-container">
    <div class="content">
      <div class="tasks-header">
        <h2>Tasks</h2>
        <el-button 
          type="primary" 
          @click="dialogVisible = true"
          :disabled="!currentMatter">
          New Task
        </el-button>
      </div>

      <TasksList
        :tasks="tasks"
        :loading="loading"
        :shared-users="sharedUsers"
        @edit="async (task) => {
          editingTask = {...task};
          await loadSharedUsers();
          editDialogVisible = true;
        }"
        @view-comments="(task) => {
          selectedTask = task;
          commentDialogVisible = true;
        }"
      />

      <!-- Create Task Dialog -->
      <el-dialog
        v-model="dialogVisible"
        title="Create New Task"
        width="500px">
        <el-form :model="newTask" label-position="top">
          <el-form-item label="Title" required>
            <el-input v-model="newTask.title" />
          </el-form-item>
          <el-form-item label="Description">
            <el-input 
              v-model="newTask.description"
              type="textarea"
              :rows="3" />
          </el-form-item>
          <el-form-item label="Priority">
            <el-select v-model="newTask.priority" style="width: 100%">
              <el-option label="High" value="high" />
              <el-option label="Medium" value="medium" />
              <el-option label="Low" value="low" />
            </el-select>
          </el-form-item>
          <el-form-item label="Due Date">
            <el-date-picker
              v-model="newTask.due_date"
              type="date"
              style="width: 100%" />
          </el-form-item>
          <el-form-item label="Assignee">
            <el-select v-model="newTask.assignee" style="width: 100%">
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
            <el-button @click="dialogVisible = false">Cancel</el-button>
            <el-button
              type="primary"
              @click="createTask"
              :disabled="!newTask.title">
              Create
            </el-button>
          </span>
        </template>
      </el-dialog>

      <!-- Edit Task Dialog -->
      <el-dialog
        v-model="editDialogVisible"
        title="Edit Task Assignment"
        width="500px">
        <el-form v-if="editingTask" :model="editingTask" label-position="top">
          <el-form-item label="Title">
            <el-input v-model="editingTask.title" disabled />
          </el-form-item>
          <el-form-item label="Status">
            <el-select v-model="editingTask.status" style="width: 100%">
              <el-option label="Pending" value="pending" />
              <el-option label="In Progress" value="in_progress" />
              <el-option label="Completed" value="completed" />
            </el-select>
          </el-form-item>
          <el-form-item label="Assignee">
            <el-select 
              v-model="editingTask.assignee" 
              style="width: 100%"
              :loading="loading">
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
              @click="updateTask(editingTask)"
              :loading="loading">
              Update
            </el-button>
          </span>
        </template>
      </el-dialog>

      <TaskCommentDialog
        v-if="selectedTask"
        :task="selectedTask"
        v-model:visible="commentDialogVisible"
      />
    </div>
  </div>
</template>

<style scoped>
.tasks-container {
  min-height: 100vh;
  background-color: #f5f7fa;
}

.content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.tasks-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

h2 {
  color: #303133;
  margin: 0;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.clickable-title {
  cursor: pointer;
  color: #409EFF;
}

.clickable-title:hover {
  text-decoration: underline;
}
</style> 