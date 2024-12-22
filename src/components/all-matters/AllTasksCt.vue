<template>
  <div class="tasks-container">
    <div class="content">
      <div class="tasks-header">
        <h2>All Tasks</h2>
        <div class="header-buttons">
          <el-button 
            @click="showFilters = !showFilters"
            :icon="showFilters ? 'ArrowUp' : 'ArrowDown'"
            type="info"
            plain>
            {{ showFilters ? `Hide Filters${activeFiltersCount ? ` (${activeFiltersCount})` : ''}` : `Show Filters${activeFiltersCount ? ` (${activeFiltersCount})` : ''}` }}
          </el-button>
        </div>
      </div>

      <!-- Filters -->
      <el-collapse-transition>
        <div v-show="showFilters" class="filters-container">
          <el-form :inline="true" class="filter-form">
            <el-form-item label="Search">
              <el-input
                v-model="filters.search"
                placeholder="Search tasks..."
                clearable
              />
            </el-form-item>
            <el-form-item label="Status">
              <el-select
                v-model="filters.status"
                placeholder="All statuses"
                clearable
                style="width: 140px">
                <el-option label="Not started" value="not_started" />
                <el-option label="In progress" value="in_progress" />
                <el-option label="Awaiting external factor" value="awaiting_external" />
                <el-option label="Completed" value="completed" />
              </el-select>
            </el-form-item>
            <el-form-item label="Priority">
              <el-select
                v-model="filters.priority"
                placeholder="All priorities"
                clearable
                style="width: 140px">
                <el-option label="High" value="high" />
                <el-option label="Medium" value="medium" />
                <el-option label="Low" value="low" />
              </el-select>
            </el-form-item>
            <el-form-item label="Due Date">
              <el-date-picker
                v-model="filters.dueDate"
                type="date"
                placeholder="Select date"
                clearable
                style="width: 160px"
              />
            </el-form-item>
            <el-form-item label="Matter">
              <el-select
                v-model="filters.matter"
                placeholder="All matters"
                clearable
                style="width: 200px">
                <el-option 
                  v-for="matter in matters"
                  :key="matter.id"
                  :label="matter.title"
                  :value="matter.id"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="Assignee">
              <el-select
                v-model="filters.assignee"
                placeholder="All assignees"
                clearable
                style="width: 200px">
                <el-option
                  v-for="user in assignees"
                  :key="user.id"
                  :label="user.email"
                  :value="user.id"
                />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button @click="clearFilters">Clear</el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-collapse-transition>

      <!-- Tasks Table -->
      <el-table
        v-loading="loading"
        :data="tasks"
        style="width: 100%"
        @row-click="navigateToTask">
        <el-table-column 
          prop="matter_title" 
          label="Matter"
          min-width="150">
          <template #default="scope">
            <el-link 
              type="primary" 
              @click.stop="navigateToMatter(scope.row.matter_id)">
              {{ scope.row.matter_title }}
            </el-link>
          </template>
        </el-table-column>
        <el-table-column 
          prop="title" 
          label="Title"
          min-width="200">
          <template #default="scope">
            <span class="clickable-title">
              {{ scope.row.title }}
            </span>
          </template>
        </el-table-column>
        <el-table-column 
          label="Status"
          width="120">
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row)">
              {{ formatStatus(scope.row.status) }}
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
        <el-table-column 
          prop="assignee_email" 
          label="Assignee"
          min-width="180">
          <template #default="scope">
            {{ scope.row.assignee_email || '-' }}
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script>
import { supabase } from '../../supabase';
import { ElMessage } from 'element-plus';
import { useRouter } from 'vue-router';
import { ArrowUp, ArrowDown } from '@element-plus/icons-vue';

export default {
  name: 'AllTasksCt',
  components: {
    ArrowUp,
    ArrowDown
  },
  setup() {
    const router = useRouter();
    return { router };
  },
  data() {
    return {
      tasks: [],
      loading: false,
      showFilters: false,
      matters: [],
      assignees: [],
      filters: {
        search: '',
        status: null,
        priority: null,
        dueDate: null,
        matter: null,
        assignee: null
      }
    };
  },
  computed: {
    activeFiltersCount() {
      let count = 0;
      if (this.filters.search) count++;
      if (this.filters.status) count++;
      if (this.filters.priority) count++;
      if (this.filters.dueDate) count++;
      if (this.filters.matter) count++;
      if (this.filters.assignee) count++;
      return count;
    }
  },
  methods: {
    async loadTasks() {
      try {
        this.loading = true;
        
        let query = supabase
          .from('tasks')
          .select(`
            *,
            matter:matter_id (
              id,
              title
            )
          `)
          .eq('deleted', false)
          .order('created_at', { ascending: false });

        // Apply filters
        if (this.filters.search) {
          query = query.ilike('title', `%${this.filters.search}%`);
        }
        if (this.filters.status) {
          query = query.eq('status', this.filters.status);
        }
        if (this.filters.priority) {
          query = query.eq('priority', this.filters.priority);
        }
        if (this.filters.dueDate) {
          const date = new Date(this.filters.dueDate);
          date.setHours(0, 0, 0, 0);
          query = query.gte('due_date', date.toISOString())
            .lt('due_date', new Date(date.getTime() + 24 * 60 * 60 * 1000).toISOString());
        }
        if (this.filters.matter) {
          query = query.eq('matter_id', this.filters.matter);
        }
        if (this.filters.assignee) {
          query = query.eq('assignee', this.filters.assignee);
        }

        const { data: tasks, error } = await query;

        if (error) throw error;

        // Transform data to include matter title
        this.tasks = await Promise.all(tasks.map(async task => {
          const assigneeEmail = task.assignee ? 
            await this.loadUserEmail(task.assignee) : 
            null;

          return {
            ...task,
            matter_title: task.matter?.title || 'Unknown Matter',
            assignee_email: assigneeEmail
          };
        }));

      } catch (error) {
        ElMessage.error('Error loading tasks: ' + error.message);
      } finally {
        this.loading = false;
      }
    },

    async loadUserEmail(userId) {
      try {
        const { data: userData, error } = await supabase
          .rpc('get_user_info_by_id', {
            user_id: userId
          });
          
        if (error) throw error;
        return userData?.[0]?.email || 'Unknown User';
      } catch (error) {
        console.error('Error loading user email:', error);
        return 'Unknown User';
      }
    },

    clearFilters() {
      this.filters = {
        search: '',
        status: null,
        priority: null,
        dueDate: null,
        matter: null,
        assignee: null
      };
      this.saveFilters();
      this.loadTasks();
    },

    getStatusType(task) {
      switch (task.status) {
        case 'completed': return 'success';
        case 'in_progress': return 'warning';
        default: return 'info';
      }
    },

    navigateToTask(task) {
      this.router.push(`/matter/${task.matter_id}/tasks`);
    },

    navigateToMatter(matterId) {
      this.router.push(`/matter/${matterId}`);
    },

    async loadMatters() {
      try {
        const { data: matters, error } = await supabase
          .from('matters')
          .select('id, title')
          .eq('deleted', false)
          .order('title');
        
        if (error) throw error;
        this.matters = matters;
      } catch (error) {
        console.error('Error loading matters:', error);
      }
    },

    async loadAssignees() {
      try {
        const { data: users, error } = await supabase
          .rpc('get_all_users');
          
        if (error) throw error;
        this.assignees = users;
      } catch (error) {
        console.error('Error loading assignees:', error);
      }
    },

    saveFilters() {
      localStorage.setItem('allTasksFilters', JSON.stringify(this.filters));
    },

    loadSavedFilters() {
      const savedFilters = localStorage.getItem('allTasksFilters');
      if (savedFilters) {
        this.filters = JSON.parse(savedFilters);
      }
    },

    formatStatus(status) {
      const statusMap = {
        'in_progress': 'In progress',
        'not_started': 'Not started',
        'completed': 'Completed',
        'awaiting_external': 'Awaiting external factor'
      };
      return statusMap[status] || status;
    }
  },
  mounted() {
    this.loadSavedFilters();
    this.loadMatters();
    this.loadAssignees();
    this.loadTasks();
  },
  watch: {
    filters: {
      deep: true,
      handler() {
        this.saveFilters();
        this.loadTasks();
      }
    }
  }
};
</script>

<style scoped>
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

.filters-container {
  background-color: #f5f7fa;
  padding: 1.5rem;
  border-radius: 4px;
  margin-bottom: 2rem;
}

.filter-form {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: flex-start;
}

.clickable-title {
  cursor: pointer;
  color: #409EFF;
}

.clickable-title:hover {
  text-decoration: underline;
}

.header-buttons {
  display: flex;
  gap: 12px;
}
</style> 