<!-- src/components/TasksList.vue -->
<script>
import { ArrowUp, ArrowDown, InfoFilled } from '@element-plus/icons-vue'
import { supabase } from '../../supabase'

export default {
  components: {
    ArrowUp,
    ArrowDown,
    InfoFilled
  },
  props: {
    tasks: {
      type: Array,
      required: true
    },
    loading: {
      type: Boolean,
      default: false
    },
    sharedUsers: {
      type: Array,
      required: true
    },
    showFilters: {
      type: Boolean,
      required: true
    }
  },
  emits: ['edit', 'view-comments', 'update:show-filters', 'delete', 'restore', 'show-deleted-changed', 'update:active-filters-count'],
  data() {
    return {
      filters: {
        search: '',
        status: null,
        priority: null,
        assignee: null,
        dueDate: null,
        showDeleted: false
      },
      userEmails: {},
      deletedTooltips: {}
    }
  },
  computed: {
    filteredTasks() {
      let result = [...this.tasks]
      
      const filterTasksRecursively = (tasks, filterFn) => {
        return tasks.filter(task => {
          const matchesFilter = filterFn(task)
          if (task.children?.length) {
            task.children = filterTasksRecursively(task.children, filterFn)
            return matchesFilter || task.children.length > 0
          }
          return matchesFilter
        })
      }

      // Search filter
      if (this.filters.search) {
        const query = this.filters.search.toLowerCase()
        result = filterTasksRecursively(result, task => 
          task.title.toLowerCase().includes(query) ||
          task.description?.toLowerCase().includes(query)
        )
      }

      // Status filter
      if (this.filters.status) {
        result = filterTasksRecursively(result, task => 
          task.status === this.filters.status
        )
      }

      // Priority filter
      if (this.filters.priority) {
        result = filterTasksRecursively(result, task => 
          task.priority === this.filters.priority
        )
      }

      // Assignee filter
      if (this.filters.assignee) {
        result = filterTasksRecursively(result, task => 
          task.assignee === this.filters.assignee
        )
      }

      // Due date filter
      if (this.filters.dueDate) {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        result = filterTasksRecursively(result, task => {
          switch (this.filters.dueDate) {
            case 'overdue':
              return task.due_date && new Date(task.due_date) < today && task.status !== 'completed'
            case 'today':
              const dueDate = new Date(task.due_date)
              dueDate.setHours(0, 0, 0, 0)
              return dueDate.getTime() === today.getTime()
            case 'week':
              const nextWeek = new Date(today)
              nextWeek.setDate(today.getDate() + 7)
              return task.due_date && new Date(task.due_date) <= nextWeek
            default:
              return false
          }
        })
      }

      return result
    },
    hasActiveFilters() {
      return this.filters.search ||
        this.filters.status ||
        this.filters.priority ||
        this.filters.assignee ||
        this.filters.dueDate
    },
    activeFiltersCount() {
      let count = 0;
      if (this.filters.search) count++;
      if (this.filters.status) count++;
      if (this.filters.priority) count++;
      if (this.filters.assignee) count++;
      if (this.filters.dueDate) count++;
      return count;
    }
  },
  methods: {
    clearFilters() {
      this.filters = {
        search: '',
        status: null,
        priority: null,
        assignee: null,
        dueDate: null,
        showDeleted: false
      }
    },
    async loadUserEmail(userId) {
      if (!userId) return 'Unknown User';
      
      if (this.userEmails[userId]) {
        return this.userEmails[userId];
      }
      
      try {
        const { data: userData, error } = await supabase
          .rpc('get_user_info_by_id', {
            user_id: userId
          });
          
        if (error) throw error;
        
        if (userData?.[0]) {
          this.userEmails[userId] = userData[0].email;
          return userData[0].email;
        }
        
        return 'Unknown User';
      } catch (error) {
        console.error('Error loading user email:', error);
        return 'Unknown User';
      }
    },
    getStatusType(task) {
      switch (task.status) {
        case 'completed': return 'success';
        case 'in_progress': return 'warning';
        default: return 'info';
      }
    },
    async loadDeletedTooltip(task) {
      if (!this.deletedTooltips[task.id]) {
        const deletedByEmail = await this.loadUserEmail(task.deleted_by);
        const date = new Date(task.deleted_at).toLocaleDateString();
        this.deletedTooltips[task.id] = `Deleted by ${deletedByEmail} on ${date}`;
      }
      return this.deletedTooltips[task.id];
    },
    saveFilters() {
      localStorage.setItem('taskListFilters', JSON.stringify(this.filters));
    },

    loadSavedFilters() {
      const savedFilters = localStorage.getItem('taskListFilters');
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
  watch: {
    filters: {
      deep: true,
      handler() {
        this.$emit('update:active-filters-count', this.activeFiltersCount);
        this.saveFilters();
      }
    }
  },
  mounted() {
    this.loadSavedFilters();
  }
}
</script>

<template>
  <div class="tasks-list">
    <el-collapse-transition>
      <div v-show="showFilters" class="filters-section">
        <el-input
          v-model="filters.search"
          placeholder="Search tasks..."
          prefix-icon="Search"
          clearable
          class="filter-item"
        />
        
        <div class="filters-row">
          <el-select 
            v-model="filters.status" 
            placeholder="Status" 
            clearable
            class="filter-item">
            <el-option label="Not started" value="not_started" />
            <el-option label="In progress" value="in_progress" />
            <el-option label="Awaiting external factor" value="awaiting_external" />
            <el-option label="Completed" value="completed" />
          </el-select>

          <el-select 
            v-model="filters.priority" 
            placeholder="Priority" 
            clearable
            class="filter-item">
            <el-option label="High" value="high" />
            <el-option label="Medium" value="medium" />
            <el-option label="Low" value="low" />
          </el-select>

          <el-select 
            v-model="filters.assignee" 
            placeholder="Assignee" 
            clearable
            class="filter-item">
            <el-option
              v-for="user in sharedUsers"
              :key="user.id"
              :label="user.email"
              :value="user.id"
            />
          </el-select>

          <el-select 
            v-model="filters.dueDate" 
            placeholder="Due Date" 
            clearable
            class="filter-item">
            <el-option label="Overdue" value="overdue" />
            <el-option label="Due Today" value="today" />
            <el-option label="Due This Week" value="week" />
          </el-select>

          <el-switch
            v-model="filters.showDeleted"
            class="filter-item"
            active-text="Show Deleted Tasks"
            @change="$emit('show-deleted-changed', $event)"
          />
        </div>
      </div>
    </el-collapse-transition>

    <!-- Tasks Table -->
    <el-table
      v-loading="loading"
      :data="filteredTasks"
      row-key="id"
      :tree-props="{ children: 'children', hasChildren: 'hasChildren' }"
      style="width: 100%">
      <el-table-column 
        prop="title" 
        label="Title"
        min-width="200">
        <template #default="scope">
          <span 
            class="clickable-title"
            @click="$emit('view-comments', scope.row)">
            {{ scope.row.title }}
          </span>
        </template>
      </el-table-column>
      
      <el-table-column 
        label="Status"
        width="120">
        <template #default="scope">
          <div class="status-container">
            <el-tag :type="getStatusType(scope.row)">
              {{ formatStatus(scope.row.status) }}
            </el-tag>
            <el-tooltip 
              v-if="scope.row.deleted"
              effect="dark"
              :content="deletedTooltips[scope.row.id] || 'Loading...'"
              placement="top">
              <el-icon class="deleted-icon" @mouseenter="loadDeletedTooltip(scope.row)">
                <InfoFilled />
              </el-icon>
            </el-tooltip>
          </div>
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
        label="Assignee"
        width="200">
        <template #default="scope">
          <span>{{ sharedUsers.find(u => u.id === scope.row.assignee)?.email || '-' }}</span>
        </template>
      </el-table-column>
      
      <el-table-column 
        label="Actions"
        width="200"
        align="center">
        <template #default="scope">
          <el-button
            type="primary"
            link
            @click="$emit('edit', scope.row)">
            Edit
          </el-button>
          <el-button
            :type="scope.row.deleted ? 'success' : 'danger'"
            link
            @click="$emit(scope.row.deleted ? 'restore' : 'delete', scope.row)">
            {{ scope.row.deleted ? 'Restore' : 'Delete' }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style scoped>
.tasks-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.filters-header {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.filters-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background-color: white;
  padding: 1rem;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
}

.filters-row {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.filter-item {
  min-width: 200px;
}

@media (max-width: 768px) {
  .filter-item {
    width: 100%;
  }
}

.clickable-title {
  cursor: pointer;
  color: #409EFF;
}

.clickable-title:hover {
  text-decoration: underline;
}

.status-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.deleted-icon {
  color: #909399;
  cursor: help;
}
</style>