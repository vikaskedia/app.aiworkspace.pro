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
          this.tasks = this.organizeTasksHierarchy(cachedTasks);
          this.loading = false;
          return;
        }

        const { data: tasks, error } = await supabase
          .from('tasks')
          .select('*')
          .eq('matter_id', this.currentMatter.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        this.tasks = this.organizeTasksHierarchy(tasks);
        // Store in cache
        this.cacheStore.setCachedData('tasks', this.currentMatter.id, tasks);
      } catch (error) {
        ElMessage.error('Error loading tasks: ' + error.message);
      } finally {
        this.loading = false;
      }
    },

    organizeTasksHierarchy(tasks) {
      // Create a map of all tasks
      const taskMap = new Map(tasks.map(task => [task.id, { ...task, children: [] }]));
      const rootTasks = [];

      // Organize tasks into hierarchy
      for (const task of taskMap.values()) {
        if (task.parent_task_id && taskMap.has(task.parent_task_id)) {
          taskMap.get(task.parent_task_id).children.push(task);
        } else {
          rootTasks.push(task);
        }
      }

      return rootTasks;
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

        // Create notification if task is assigned to someone
        if (taskData.assignee && taskData.assignee !== user.id) {
          await this.createNotification(
            taskData.assignee,
            'task_assigned',
            { task_id: data[0].id, task_title: data[0].title }
          );
        }

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
          .from('matter_access')
          .select('shared_with_user_id, access_type')
          .eq('matter_id', this.currentMatter.id);

        if (error) throw error;

        const sharesWithUserInfo = await Promise.all(
          shares.map(async (share) => {
            const { data: userData } = await supabase
              .rpc('get_user_info_by_id', {
                user_id: share.shared_with_user_id
              });

            return {
              id: share.shared_with_user_id,
              email: userData[0].email,
              access_type: share.access_type
            };
          })
        );

        this.sharedUsers = sharesWithUserInfo;
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
            title: task.title,
            assignee: task.assignee,
            status: task.status,
            due_date: task.due_date
          })
          .eq('id', task.id)
          .select();

        if (error) throw error;

        // Create notifications for changes
        if (originalTask.assignee !== task.assignee && task.assignee) {
          await this.createNotification(
            task.assignee,
            'task_assigned',
            { task_id: task.id, task_title: task.title }
          );
        }

        if (originalTask.status !== task.status) {
          // Notify task creator and assignee (if different from updater)
          const notifyUsers = new Set([data[0].created_by, data[0].assignee]);
          notifyUsers.delete(user.id); // Don't notify the user making the change
          
          for (const userId of notifyUsers) {
            if (userId) {
              await this.createNotification(
                userId,
                'task_updated',
                { 
                  task_id: task.id, 
                  task_title: task.title,
                  status: task.status 
                }
              );
            }
          }
        }

        // Log changes as activities
        const changes = [];
        if (originalTask.title !== task.title) {
          changes.push(`title from "${originalTask.title}" to "${task.title}"`);
        }
        if (originalTask.status !== task.status) {
          changes.push(`status from "${originalTask.status}" to "${task.status}"`);
        }
        if (originalTask.assignee !== task.assignee) {
          const oldAssignee = this.sharedUsers.find(u => u.id === originalTask.assignee)?.email || 'unassigned';
          const newAssignee = this.sharedUsers.find(u => u.id === task.assignee)?.email || 'unassigned';
          changes.push(`assignee from ${oldAssignee} to ${newAssignee}`);
        }
        if (originalTask.due_date !== task.due_date) {
          const oldDate = originalTask.due_date ? new Date(originalTask.due_date).toLocaleDateString() : 'none';
          const newDate = task.due_date ? new Date(task.due_date).toLocaleDateString() : 'none';
          changes.push(`due date from ${oldDate} to ${newDate}`);
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
                  title: task.title !== originalTask.title ? {
                    from: originalTask.title,
                    to: task.title
                  } : null,
                  status: task.status !== originalTask.status ? {
                    from: originalTask.status,
                    to: task.status
                  } : null,
                  assignee: task.assignee !== originalTask.assignee ? {
                    from: originalTask.assignee,
                    to: task.assignee
                  } : null,
                  due_date: task.due_date !== originalTask.due_date ? {
                    from: originalTask.due_date,
                    to: task.due_date
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
          async (payload) => {
            // Reload all tasks to maintain proper hierarchy
            await this.loadTasks();
          }
        )
        .subscribe();
    },

    async createNotification(userId, type, data) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        const { error } = await supabase
          .from('notifications')
          .insert([{
            user_id: userId,
            actor_id: user.id,
            type,
            data,
            read: false
          }]);

        if (error) throw error;
      } catch (error) {
        console.error('Error creating notification:', error);
      }
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
        title="Edit Task"
        width="500px">
        <el-form v-if="editingTask" :model="editingTask" label-position="top">
          <el-form-item label="Title" required>
            <el-input v-model="editingTask.title" />
          </el-form-item>
          <el-form-item label="Status">
            <el-select v-model="editingTask.status" style="width: 100%">
              <el-option label="Pending" value="pending" />
              <el-option label="In Progress" value="in_progress" />
              <el-option label="Completed" value="completed" />
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
              :loading="loading"
              :disabled="!editingTask?.title">
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