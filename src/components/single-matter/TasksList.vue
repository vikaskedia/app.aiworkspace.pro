<!-- src/components/TasksList.vue -->
<script>
import { ArrowUp, ArrowDown, InfoFilled, Star, StarFilled, Link } from '@element-plus/icons-vue'
import { supabase } from '../../supabase'
import { ElMessage } from 'element-plus'
import { ref, onMounted } from 'vue'

export default {
  components: {
    ArrowUp,
    ArrowDown,
    InfoFilled,
    Star,
    StarFilled,
    Link
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
  emits: ['edit', 'view-comments', 'update:show-filters', 'delete', 'restore', 'show-deleted-changed', 'update:active-filters-count', 'star-toggled'],
  data() {
    return {
      filters: {
        search: '',
        status: null,
        excludeStatus: ['completed'],
        priority: null,
        assignee: null,
        dueDate: null,
        showDeleted: false,
        starred: false
      },
      userEmails: {},
      deletedTooltips: {},
      sortBy: null,
      sortOrder: 'ascending'
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
      if (this.filters.status?.length) {
        result = filterTasksRecursively(result, task => 
          this.filters.status.includes(task.status)
        )
      }

      // Priority filter
      if (this.filters.priority) {
        result = filterTasksRecursively(result, task => 
          task.priority === this.filters.priority
        )
      }

      // Assignee filter
      if (this.filters.assignee?.length) {
        result = filterTasksRecursively(result, task => 
          this.filters.assignee.includes(task.assignee)
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

      // Star filter
      if (this.filters.starred) {
        result = filterTasksRecursively(result, task => 
          task.starred === true
        )
      }

      // Exclude status filter
      if (this.filters.excludeStatus?.length) {
        result = filterTasksRecursively(result, task => 
          !this.filters.excludeStatus.includes(task.status)
        )
      }

      // Apply sorting if set
      if (this.sortBy) {
        const sortTasks = (tasks) => {
          return tasks.sort((a, b) => {
            let aVal = a[this.sortBy];
            let bVal = b[this.sortBy];

            // Handle special cases
            if (this.sortBy === 'assignee') {
              aVal = this.sharedUsers.find(u => u.id === a.assignee)?.email || '';
              bVal = this.sharedUsers.find(u => u.id === b.assignee)?.email || '';
            }

            // Handle null values
            if (aVal === null) return this.sortOrder === 'ascending' ? 1 : -1;
            if (bVal === null) return this.sortOrder === 'ascending' ? -1 : 1;

            // Compare values
            if (aVal < bVal) return this.sortOrder === 'ascending' ? -1 : 1;
            if (aVal > bVal) return this.sortOrder === 'ascending' ? 1 : -1;
            return 0;
          });
        };

        // Sort root tasks and their children recursively
        const sortRecursively = (tasks) => {
          const sorted = sortTasks(tasks);
          return sorted.map(task => {
            if (task.children?.length) {
              task.children = sortRecursively(task.children);
            }
            return task;
          });
        };

        result = sortRecursively(result);
      }

      return result
    },
    hasActiveFilters() {
      return this.filters.search ||
        this.filters.status ||
        this.filters.excludeStatus?.length ||
        this.filters.priority ||
        this.filters.assignee ||
        this.filters.dueDate
    },
    activeFiltersCount() {
      let count = 0;
      if (this.filters.search) count++;
      if (this.filters.status) count++;
      if (this.filters.excludeStatus?.length) count++;
      if (this.filters.priority) count++;
      if (this.filters.assignee) count++;
      if (this.filters.dueDate) count++;
      if (this.filters.starred) count++;
      return count;
    }
  },
  methods: {
    clearFilters() {
      this.filters = {
        search: '',
        status: [],
        excludeStatus: ['completed'],
        priority: null,
        assignee: [],
        dueDate: null,
        showDeleted: false,
        starred: false
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
        const parsedFilters = JSON.parse(savedFilters);
        // Ensure excludeStatus is an array with 'completed' as default if not set
        if (!parsedFilters.excludeStatus?.length) {
          parsedFilters.excludeStatus = ['completed'];
        }
        this.filters = parsedFilters;
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
    },
    handleSort({ prop, order }) {
      this.sortBy = prop;
      this.sortOrder = order === 'ascending' ? 'ascending' : 'descending';
    },
    async toggleStar(task) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (task.starred) {
          // Remove star
          const { error } = await supabase
            .from('task_stars')
            .delete()
            .eq('task_id', task.id)
            .eq('user_id', user.id);

          if (error) throw error;
        } else {
          // Add star
          const { error } = await supabase
            .from('task_stars')
            .insert({
              task_id: task.id,
              user_id: user.id
            });

          if (error) throw error;
        }
        
        // Emit an event to notify the parent component
        this.$emit('star-toggled', task.id, !task.starred);
      } catch (error) {
        ElMessage.error('Error updating task star: ' + error.message);
      }
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
    // Ensure completed status is excluded by default if no saved filters exist
    if (!this.filters.excludeStatus?.length) {
      this.filters.excludeStatus = ['completed'];
      this.saveFilters();
    }
  },
  setup() {
    const titleRef = ref(null)
    
    const checkTruncation = (element) => {
      if (element) {
        return element.offsetWidth < element.scrollWidth
      }
      return false
    }
    
    return {
      titleRef,
      checkTruncation
    }
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
            multiple
            collapse-tags
            collapse-tags-tooltip
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
            multiple
            collapse-tags
            collapse-tags-tooltip
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

          <el-select 
            v-model="filters.excludeStatus"
            placeholder="Exclude statuses"
            multiple
            clearable
            class="filter-item">
            <el-option label="Not started" value="not_started" />
            <el-option label="In progress" value="in_progress" />
            <el-option label="Awaiting external factor" value="awaiting_external" />
            <el-option label="Completed" value="completed" />
          </el-select>

          <el-switch
            v-model="filters.showDeleted"
            class="filter-item"
            active-text="Show Deleted Tasks"
            @change="$emit('show-deleted-changed', $event)"
          />

          <el-switch
            v-model="filters.starred"
            class="filter-item"
            active-text="Show Starred Tasks"
            @change="saveFilters"
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
      class="tasks-table"
      @sort-change="handleSort"
      default-expand-all
      style="width: 100%">
      <el-table-column 
        prop="title" 
        label="Title"
        sortable
        min-width="200">
        <template #default="scope">
          <div class="title-with-star">
            <el-icon
              :class="['star-icon', { 'starred': scope.row.starred }]"
              @click.stop="toggleStar(scope.row)">
              <component :is="scope.row.starred ? 'StarFilled' : 'Star'" />
            </el-icon>
            <div class="title-content">
              <div class="title-row">
                <div class="title-with-link">
                  <el-tooltip
                    effect="dark"
                    content="Open Quick Task View"
                    placement="top">
                    <el-icon
                      class="link-icon"
                      @click.stop="$emit('view-comments', scope.row)">
                      <Link />
                    </el-icon>
                  </el-tooltip>
                  <el-tooltip
                    v-if="checkTruncation($refs[`titleRef-${scope.row.id}`])"
                    effect="dark"
                    :content="scope.row.title"
                    placement="top">
                    <span 
                      :ref="el => { if (el) $refs[`titleRef-${scope.row.id}`] = el }"
                      class="task-title">
                      {{ scope.row.title }}
                    </span>
                  </el-tooltip>
                  <span 
                    v-else 
                    :ref="el => { if (el) $refs[`titleRef-${scope.row.id}`] = el }"
                    class="task-title">
                    {{ scope.row.title }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </template>
      </el-table-column>
      
      <el-table-column 
        prop="total_hours" 
        label="Hours"
        sortable
        width="90">
        <template #default="scope">
          <span class="logged-hours">
            {{ (scope.row.total_hours || 0).toFixed(2) }}
          </span>
        </template>
      </el-table-column>
      
      <el-table-column 
        prop="status" 
        label="Status"
        sortable
        width="100">
        <template #default="scope">
          <div class="status-container">
            <el-tag :type="getStatusType(scope.row)">
              {{ scope.row.status === 'not_started' ? 'Not started' : 
                 scope.row.status === 'in_progress' ? 'In progress' : 
                 scope.row.status === 'awaiting_external' ? 'Awaiting external factor' :
                 scope.row.status }}
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
        sortable
        width="100">
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
        sortable
        width="150">
        <template #default="scope">
          {{ scope.row.due_date ? new Date(scope.row.due_date).toLocaleDateString() : '-' }}
        </template>
      </el-table-column>
      
      <el-table-column 
        prop="assignee" 
        label="Assignee"
        sortable
        width="200">
        <template #default="scope">
          <span>{{ sharedUsers.find(u => u.id === scope.row.assignee)?.email || '-' }}</span>
          <!-- <span class="logged-hours">
            Hours Logged: {{ scope.row.log_hours || 0 }}
          </span> -->
        </template>
      </el-table-column>
      
      <el-table-column 
        label="Actions"
        width="120"
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

.logged-hours {
  background-color: var(--el-color-info-light-9);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.9em;
}

.star-icon {
  cursor: pointer;
  font-size: 18px;
  color: #909399;
  transition: color 0.3s;
}

.star-icon:hover {
  color: #f0c541;
}

.star-icon.starred {
  color: #f0c541;
  font-size: 28px;
}

.title-with-star {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: calc(100% - 40px);
}

.star-icon {
  cursor: pointer;
  font-size: 18px;
  color: #909399;
  transition: color 0.3s;
  flex-shrink: 0;
}

.star-icon:hover {
  color: #f0c541;
}

.star-icon.starred {
  color: #f0c541;
}

.clickable-title {
  cursor: pointer;
  color: #409EFF;
}

.clickable-title:hover {
  text-decoration: underline;
}

.title-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex-grow: 1;
  min-width: 0;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
}

.title-with-link {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.task-title {
  color: #606266;
  font-weight: normal;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  flex: 1;
}

.logged-hours {
  background-color: var(--el-color-info-light-9);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.85em;
  white-space: nowrap;
  flex-shrink: 0;
}

.link-icon {
  color: #409EFF;
  font-size: 16px;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.3s;
  flex-shrink: 0;
}

.link-icon:hover {
  background-color: rgba(64, 158, 255, 0.1);
  transform: scale(1.1);
}
</style>

<style>
.el-table.tasks-table .cell {
    display: flex;
    align-items: center;
}
.el-table.tasks-table [class*=el-table__row--level] .el-table__expand-icon i {
    font-size: 17px;
    font-weight: 600;
}
span.el-table__indent {
    padding-left: 20px !important;
}
tr.el-table__row.el-table__row--level-1 {
    background-color: #faf9f9;
}
 </style>
