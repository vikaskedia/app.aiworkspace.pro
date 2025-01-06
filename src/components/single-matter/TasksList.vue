<!-- src/components/TasksList.vue -->
<script>
import { ArrowUp, ArrowDown, InfoFilled, Link, Edit, More, Calendar, User, Timer, Delete, Plus } from '@element-plus/icons-vue'
import { supabase } from '../../supabase'
import { ElMessage } from 'element-plus'
import { ref, onMounted } from 'vue'

export default {
  components: {
    ArrowUp,
    ArrowDown,
    InfoFilled,
    Link,
    Edit,
    More,
    Calendar,
    User,
    Timer,
    Delete,
    Plus
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
  emits: ['edit', 'update-title', 'view-comments', 'update:show-filters', 'delete', 'restore', 'show-deleted-changed', 'update:active-filters-count', 'update-task'],
  data() {
    return {
      filters: {
        search: '',
        status: null,
        excludeStatus: ['completed'],
        priority: null,
        assignee: null,
        dueDate: null,
        showDeleted: false
      },
      userEmails: {},
      deletedTooltips: {},
      sortBy: null,
      sortOrder: 'ascending',
      editingAssignee: null,
      editingDueDate: null,
      hoveredTaskId: null,
    }
  },
  computed: {
    filteredTasks() {
      let result = JSON.parse(JSON.stringify(this.tasks)) // Deep clone to avoid mutations
      
      const filterTasksRecursively = (tasks, filterFn) => {
        return tasks.filter(task => {
          const matchesFilter = filterFn(task)
          if (task.children?.length) {
            const filteredChildren = filterTasksRecursively(task.children, filterFn)
            // Create new object instead of mutating
            return matchesFilter || filteredChildren.length > 0 ? {
              ...task,
              children: filteredChildren
            } : null
          }
          return matchesFilter
        }).filter(Boolean) // Remove null values
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

      //console.log('Filtered and sorted tasks:', result);
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
        case 'completed':
          return 'success';
        case 'in_progress':
          return 'primary';
        case 'not_started':
          return 'info';
        case 'awaiting_external':
          return 'warning';
        default:
          return 'info';
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
    },
    async updateStatus(task, checked) {
      this.$emit('update-status', {
        ...task,
        status: checked ? 'completed' : 'not_started'
      });
    },
    handleAction(command, task) {
      switch (command) {
        case 'edit':
          this.$emit('edit', task);
          break;
        case 'comments':
          this.$emit('view-comments', task);
          break;
        case 'delete':
          this.$emit('delete', task);
          break;
        case 'restore':
          this.$emit('restore', task);
          break;
      }
    },
    formatDueDate(date) {
      if (!date) return 'No due date';
      const dueDate = new Date(date);
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      if (dueDate.toDateString() === today.toDateString()) return 'Today';
      if (dueDate.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
      return dueDate.toLocaleDateString();
    },
    
    getDueDateType(task) {
      if (!task.due_date) return 'info';
      const dueDate = new Date(task.due_date);
      const today = new Date();
      
      if (dueDate < today && task.status !== 'completed') return 'danger';
      if (dueDate.toDateString() === today.toDateString()) return 'warning';
      return 'info';
    },
    
    updateTaskField(task, field, value) {
      this.$emit('update-task', { ...task, [field]: value });
      if (field === 'assignee') this.editingAssignee = null;
      if (field === 'due_date') this.editingDueDate = null;
    },
    
    openComments(task) {
      this.$emit('view-comments', task);
    },

    getPriorityType(priority) {
      switch (priority?.toLowerCase()) {
        case 'high':
          return 'danger';
        case 'medium':
          return 'warning';
        case 'low':
          return 'success';
        default:
          return 'info';
      }
    },

    getAssigneeColor(userId) {
      // Generate consistent color based on user ID
      let hash = 0;
      const email = this.sharedUsers.find(u => u.id === userId)?.email || userId;
      for (let i = 0; i < email.length; i++) {
        hash = email.charCodeAt(i) + ((hash << 5) - hash);
      }
      const hue = hash % 360;
      return `hsl(${hue}, 70%, 80%)`; // Light pastel colors
    },

    getTaskIndent(task) {
      let indent = 0;
      let currentTask = task;
      while (currentTask.parent_task_id) {
        indent += 24;
        currentTask = this.tasks.find(t => t.id === currentTask.parent_task_id);
        if (!currentTask) break;
      }
      return indent;
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
  setup(props, { emit }) {
    const editingTaskId = ref(null)
    const editingField = ref(null)
    const editingValue = ref('')
    
    const startEditing = (task, field) => {
      editingTaskId.value = task.id
      editingField.value = field
      editingValue.value = task[field]
    }

    const handleSubmit = (task) => {
      if (editingValue.value !== task[editingField.value]) {
        emit('update-task', { 
          ...task, 
          [editingField.value]: editingValue.value 
        })
      }
      editingTaskId.value = null
      editingField.value = null
      editingValue.value = ''
    }

    const cancelEditing = () => {
      editingTaskId.value = null
      editingField.value = null
      editingValue.value = ''
    }

    const toggleStar = (task) => {
      emit('update-task', {
        ...task,
        starred: !task.starred
      })
    }

    return {
      editingTaskId,
      editingField,
      editingValue,
      startEditing,
      handleSubmit,
      cancelEditing,
      toggleStar
    }
  },
  directives: {
    focus: {
      mounted(el) {
        el.querySelector('input').focus()
      }
    }
  }
}
</script>

<template>
  <div class="tasks-list">
    <!-- Column Headers -->
    <div class="task-headers">
      <div class="header-title">
        <span>Title</span>
      </div>
      <div class="header-metadata">
        <span>Status</span>
        <span>Assignee</span>
        <span>Priority</span>
        <span>Due Date</span>
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
              multiple
              collapse-tags
              collapse-tags-tooltip
              clearable
              style="width: 200px">
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
              style="width: 200px">
              <el-option label="High" value="high" />
              <el-option label="Medium" value="medium" />
              <el-option label="Low" value="low" />
            </el-select>
          </el-form-item>
          <el-form-item label="Due Date">
            <el-select
              v-model="filters.dueDate"
              placeholder="All dates"
              clearable
              style="width: 200px">
              <el-option label="Overdue" value="overdue" />
              <el-option label="Today" value="today" />
              <el-option label="This week" value="week" />
            </el-select>
          </el-form-item>
          <el-form-item label="Exclude Status">
            <el-select
              v-model="filters.excludeStatus"
              placeholder="Exclude statuses"
              multiple
              clearable
              style="width: 200px">
              <el-option label="Not started" value="not_started" />
              <el-option label="In progress" value="in_progress" />
              <el-option label="Awaiting external factor" value="awaiting_external" />
              <el-option label="Completed" value="completed" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button @click="clearFilters">Clear</el-button>
          </el-form-item>
        </el-form>
      </div>
    </el-collapse-transition>

    <!-- Tasks with Hierarchy -->
    <div class="tasks-hierarchy">
      <template v-for="task in filteredTasks" :key="task.id">
        <!-- Parent task -->
        <div 
          :class="['task-card', {'child-task': task.parent_task_id}]"
          :style="{ marginLeft: task.parent_task_id ? '24px' : '0' }"
          @click="openComments(task)">
          
          <div class="task-main">
            <!-- Show connecting line for child tasks -->
            <div v-if="task.parent_task_id" class="child-task-line"></div>
            
            <div class="task-title-container">
              <template v-if="editingTaskId === task.id && editingField === 'title'">
                <el-input
                  v-model="editingValue"
                  size="small"
                  @keyup.enter="handleSubmit(task)"
                  @keyup.esc="cancelEditing"
                  v-focus
                />
              </template>
              <div v-else class="title-hours-wrapper">
                <div class="title-container">
                  <span class="task-title" @dblclick="startEditing(task, 'title')">
                    {{ task.title }}
                  </span>
                </div>
                <span class="logged-hours" v-if="task.total_hours">
                  <el-tag size="small" class="logged-hours-tag">
                    <el-icon><Timer /></el-icon>
                    {{ task.total_hours.toFixed(1) }}h
                  </el-tag>
                </span>
              </div>
              <div class="hover-actions" v-if="editingTaskId !== task.id">
                <el-icon class="action-icon" @click.stop="startEditing(task, 'title')"><Edit /></el-icon>
                <el-icon class="action-icon delete" @click.stop="handleAction('delete', task)"><Delete /></el-icon>
              </div>
            </div>

            <div class="task-metadata">
              <el-tag
                :type="getStatusType(task)"
                size="small"
                class="status-tag clickable"
                @click.stop="startEditing(task, 'status')">
                <span>{{ formatStatus(task.status) }}</span>
              </el-tag>

              <div class="assignee-wrapper">
                <template v-if="task.assignee">
                  <el-tooltip
                    :content="sharedUsers.find(u => u.id === task.assignee)?.email"
                    placement="top">
                    <div 
                      class="assignee-badge clickable"
                      :style="{ backgroundColor: getAssigneeColor(task.assignee) }"
                      @click.stop="startEditing(task, 'assignee')">
                      {{ sharedUsers.find(u => u.id === task.assignee)?.email.charAt(0).toUpperCase() }}
                    </div>
                  </el-tooltip>
                </template>
                <template v-else>
                  <el-tooltip content="Assign task" placement="top">
                    <div 
                      class="assignee-badge unassigned clickable"
                      @click.stop="startEditing(task, 'assignee')">
                      <el-icon><Plus /></el-icon>
                    </div>
                  </el-tooltip>
                </template>
              </div>

              <el-tag
                :type="getPriorityType(task.priority)"
                size="small"
                class="priority-tag clickable"
                @click.stop="startEditing(task, 'priority')">
                <span>{{ task.priority || 'No priority' }}</span>
              </el-tag>

              <template v-if="task.due_date">
                <el-tag
                  :type="getDueDateType(task)"
                  size="small"
                  class="due-date-tag clickable"
                  @click.stop="startEditing(task, 'due_date')">
                  <el-icon><Calendar /></el-icon>
                  {{ formatDueDate(task.due_date) }}
                </el-tag>
              </template>
              <template v-else>
                <div 
                  class="due-date-empty clickable"
                  @click.stop="startEditing(task, 'due_date')">
                  <el-icon><Calendar /></el-icon>
                  <span>No due date</span>
                </div>
              </template>
            </div>
          </div>
        </div>

        <!-- Recursively render children -->
        <template v-if="task.children && task.children.length">
          <div 
            v-for="childTask in task.children" 
            :key="childTask.id"
            :class="['task-card', 'child-task']"
            :style="{ marginLeft: '48px' }"
            @click="openComments(childTask)">
            
            <div class="task-main">
              <div class="child-task-line"></div>
              <!-- Same task content structure as parent -->
              <div class="task-title-container">
                <template v-if="editingTaskId === childTask.id && editingField === 'title'">
                  <el-input
                    v-model="editingValue"
                    size="small"
                    @keyup.enter="handleSubmit(childTask)"
                    @keyup.esc="cancelEditing"
                    v-focus
                  />
                </template>
                <div v-else class="title-hours-wrapper">
                  <div class="title-container">
                    <span class="task-title" @dblclick="startEditing(childTask, 'title')">
                      {{ childTask.title }}
                    </span>
                  </div>
                  <span class="logged-hours" v-if="childTask.total_hours">
                    <el-tag size="small" class="logged-hours-tag">
                      <el-icon><Timer /></el-icon>
                      {{ childTask.total_hours.toFixed(1) }}h
                    </el-tag>
                  </span>
                </div>
                <div class="hover-actions" v-if="editingTaskId !== childTask.id">
                  <el-icon class="action-icon" @click.stop="startEditing(childTask, 'title')"><Edit /></el-icon>
                  <el-icon class="action-icon delete" @click.stop="handleAction('delete', childTask)"><Delete /></el-icon>
                </div>
              </div>

              <div class="task-metadata">
                <el-tag
                  :type="getStatusType(childTask)"
                  size="small"
                  class="status-tag clickable"
                  @click.stop="startEditing(childTask, 'status')">
                  <span>{{ formatStatus(childTask.status) }}</span>
                </el-tag>

                <div class="assignee-wrapper">
                  <template v-if="childTask.assignee">
                    <el-tooltip
                      :content="sharedUsers.find(u => u.id === childTask.assignee)?.email"
                      placement="top">
                      <div 
                        class="assignee-badge clickable"
                        :style="{ backgroundColor: getAssigneeColor(childTask.assignee) }"
                        @click.stop="startEditing(childTask, 'assignee')">
                        {{ sharedUsers.find(u => u.id === childTask.assignee)?.email.charAt(0).toUpperCase() }}
                      </div>
                    </el-tooltip>
                  </template>
                  <template v-else>
                    <el-tooltip content="Assign task" placement="top">
                      <div 
                        class="assignee-badge unassigned clickable"
                        @click.stop="startEditing(childTask, 'assignee')">
                        <el-icon><Plus /></el-icon>
                      </div>
                    </el-tooltip>
                  </template>
                </div>

                <el-tag
                  :type="getPriorityType(childTask.priority)"
                  size="small"
                  class="priority-tag clickable"
                  @click.stop="startEditing(childTask, 'priority')">
                  <span>{{ childTask.priority || 'No priority' }}</span>
                </el-tag>

                <template v-if="childTask.due_date">
                  <el-tag
                    :type="getDueDateType(childTask)"
                    size="small"
                    class="due-date-tag clickable"
                    @click.stop="startEditing(childTask, 'due_date')">
                    <el-icon><Calendar /></el-icon>
                    {{ formatDueDate(childTask.due_date) }}
                  </el-tag>
                </template>
                <template v-else>
                  <div 
                    class="due-date-empty clickable"
                    @click.stop="startEditing(childTask, 'due_date')">
                    <el-icon><Calendar /></el-icon>
                    <span>No due date</span>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </template>
      </template>
    </div>
  </div>
</template>

<style scoped>
.tasks-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 1200px;
  margin: 0 auto;
}

.task-card {
  display: flex;
  padding: 8px 16px;
  background: white;
  border-radius: 8px;
  transition: background-color 0.2s ease;
  cursor: pointer;
  border: 1px solid var(--el-border-color-lighter);
}

.task-card:hover {
  background-color: var(--el-fill-color-light);
}

.task-main {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
  min-width: 0;
}

.task-title-container {
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  border-radius: 4px;
  gap: 8px;
}

.star-wrapper {
  display: flex;
  align-items: center;
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

.task-title {
  font-size: 14px;
  color: var(--el-text-color-primary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

.task-metadata {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.task-metadata > * {
  min-width: 80px;
  text-align: center;
}

.task-metadata .status-tag {
  width: 100px;
}

.task-metadata .priority-tag {
  width: 80px;
}

.task-metadata .due-date-tag,
.task-metadata .due-date-empty {
  width: 100px;
}

.task-metadata .logged-hours {
  width: 60px;
  text-align: center;
}

.assignee-wrapper {
  width: 40px;
  display: flex;
  justify-content: center;
  margin-left: 0;
}

.hover-actions {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  display: none;
  gap: 4px;
  background-color: var(--el-fill-color-light);
  padding: 2px;
  border-radius: 4px;
}

.task-title-container:hover .hover-actions {
  display: flex;
}

.action-icon {
  padding: 4px;
  font-size: 14px;
  color: var(--el-color-primary);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.action-icon.delete {
  color: var(--el-color-danger);
}


.action-icon:hover {
  background-color: var(--el-fill-color);
  color: var(--el-color-primary);
}

.action-icon.delete:hover {
  color: var(--el-color-danger);
}

.assignee-badge.unassigned {
  background-color: var(--el-fill-color);
  color: var(--el-text-color-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.assignee-badge.unassigned:hover {
  background-color: var(--el-fill-color-dark);
  color: var(--el-text-color-primary);
}

.assignee-badge.clickable {
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 50%;
  height: 16px;
  width: 16px;
  text-align: center;
  padding: 4px;
}
span.logged-hours {
    font-size: 14px;
}

span.logged-hours i {
    vertical-align: text-top;
}

.assignee-badge.clickable:hover {
  opacity: 0.8;
}

.due-date-empty {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  height: 22px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  background-color: var(--el-fill-color-light);
  transition: all 0.2s ease;
}

.due-date-empty:hover {
  background-color: var(--el-fill-color);
  color: var(--el-text-color-primary);
}

.due-date-empty .el-icon {
  font-size: 14px;
}

.child-task {
  position: relative;
  border-left: 2px solid var(--el-border-color-lighter);
}

.child-task-line {
  position: absolute;
  left: -24px;
  top: 50%;
  width: 24px;
  height: 2px;
  background-color: var(--el-border-color-lighter);
}

.child-task::before {
  content: '';
  position: absolute;
  left: -2px;
  top: 0;
  bottom: 0;
  width: 2px;
  background-color: var(--el-border-color-lighter);
  opacity: 0;
  transition: opacity 0.2s;
}

.child-task:hover::before {
  opacity: 1;
  background-color: var(--el-color-primary);
}

.tasks-hierarchy {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.child-task {
  position: relative;
}

.child-task::before {
  content: '';
  position: absolute;
  left: -24px;
  top: 0;
  height: 100%;
  width: 2px;
  background-color: var(--el-border-color-lighter);
}

.child-task-line {
  position: absolute;
  left: -24px;
  top: 50%;
  width: 24px;
  height: 2px;
  background-color: var(--el-border-color-lighter);
}

.child-task:hover::before,
.child-task:hover .child-task-line {
  background-color: var(--el-color-primary);
}
</style>

<style>
.el-table.tasks-table .cell {
  display: flex;
  align-items: center;
}

.el-table.tasks-table [class*=el-table__row--level] .el-table__expand-icon {
  font-size: 17px;
  font-weight: 600;
}

/* Preserve indentation for tree structure */
.el-table__indent {
  height: 100%;
  float: left;
  padding-left: 20px !important;
}

/* Ensure input field doesn't break indentation */
.title-with-link .el-input {
  flex: 1;
  min-width: 0;
}

/* Maintain proper alignment for title content */
.title-content {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
}

.title-with-star {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>

<style>
@media (max-width: 768px) {

  .task-card {
    padding: 12px;
  }
  
  .task-card.is-child {
    margin-left: 16px;
  }
  
  .task-metadata {
    gap: 6px;
  }
}
</style>

<style>
.clickable {
  cursor: pointer;
  transition: background-color 0.2s;
}

.clickable:hover {
  background-color: var(--el-fill-color);
}

.el-input.el-input--small {
  width: 100%;
}

.el-select.el-select--small {
  width: 120px;
}

.el-date-picker.el-date-picker--small {
  width: 130px;
}

.status-tag, .priority-tag, .due-date-tag {
  position: relative;
}

.status-tag :deep(.el-select),
.priority-tag :deep(.el-select),
.due-date-tag :deep(.el-date-picker) {
  position: absolute;
  top: 50%;
  left: 0;
  transform: translateY(-50%);
  z-index: 1;
}
</style>

<style scoped>
.task-headers {
  display: flex;
  align-items: center;
  padding: 0 16px;
  margin-bottom: 8px;
  font-size: 14px;
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

.header-title {
  flex: 1;
  min-width: 0;
  padding-left: 8px;
}

.header-metadata {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-metadata span {
  min-width: 80px;
  text-align: center;
}

.header-metadata span:nth-child(1) { /* Status */
  width: 100px;
}

.header-metadata span:nth-child(2) { /* Priority */
  width: 80px;
}

.header-metadata span:nth-child(3) { /* Due Date */
  width: 85px;
}

.header-metadata span:last-child { /* Assignee */
  width: 115px;
  text-align: center;
}
</style>

<style>
.filters-container {
  padding: 16px;
  background-color: var(--el-fill-color-light);
  border-radius: 4px;
  margin-bottom: 16px;
}

.filter-form {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.filter-form :deep(.el-form-item) {
  margin-bottom: 0;
}

.title-hours-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.title-container {
  display: flex;
  min-width: 0;
}
</style>
