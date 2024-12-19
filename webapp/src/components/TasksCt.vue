<script>
import HeaderCt from './HeaderCt.vue';
import { supabase } from '../supabase';
import { ElMessage } from 'element-plus';
import { useMatterStore } from '../store/matter';
import { storeToRefs } from 'pinia';

export default {
  components: { 
    HeaderCt
  },
  setup() {
    const matterStore = useMatterStore();
    const { currentMatter } = storeToRefs(matterStore);
    return { currentMatter };
  },
  data() {
    return {
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
      }
    };
  },
  watch: {
    currentMatter: {
      handler(newMatter) {
        if (newMatter) {
          this.loadTasks();
        } else {
          this.tasks = [];
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
        const { data: tasks, error } = await supabase
          .from('tasks')
          .select('*')
          .eq('matter_id', this.currentMatter.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        this.tasks = tasks;
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
        
        this.tasks.unshift(data[0]);
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
    }
  }
};
</script>

<template>
  <div class="tasks-container">
    <HeaderCt />
    <div class="content">
      <div class="tasks-header">
        <h2>Tasks</h2>
        <el-button 
          type="primary" 
          @click="dialogVisible = true"
          :disabled="!currentMatter">
          <el-icon><Plus /></el-icon>
          New Task
        </el-button>
      </div>

      <el-table
        v-loading="loading"
        :data="tasks"
        style="width: 100%">
        <el-table-column 
          prop="title" 
          label="Title"
          min-width="200" />
        <el-table-column 
          prop="status" 
          label="Status"
          width="120">
          <template #default="scope">
            <el-tag :type="
              scope.row.status === 'completed' ? 'success' :
              scope.row.status === 'in_progress' ? 'warning' : 'info'
            ">
              {{ scope.row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column 
          prop="priority" 
          label="Priority"
          width="120">
          <template #default="scope">
            <el-tag :type="
              scope.row.priority === 'high' ? 'danger' :
              scope.row.priority === 'medium' ? 'warning' : 'info'
            ">
              {{ scope.row.priority }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column 
          prop="due_date" 
          label="Due Date"
          width="150">
          <template #default="scope">
            {{ scope.row.due_date ? new Date(scope.row.due_date).toLocaleDateString() : '-' }}
          </template>
        </el-table-column>
      </el-table>

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
</style> 