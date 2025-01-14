<!-- src/components/TasksList.vue -->
<script>
import { ArrowUp, ArrowDown, InfoFilled, Link, Edit, More, Calendar, User, Timer, Delete, Plus, ArrowRight, Check, ArrowLeft } from '@element-plus/icons-vue'
import { supabase } from '../../supabase'
import { ElMessage } from 'element-plus'
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'

export default {
  name: 'TasksList',
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
    Plus,
    ArrowRight,
    Check,
    ArrowLeft
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
      default: false
    },
    'active-filters-count': {
      type: Number,
      default: 0
    }
  },
  emits: [
    'update:active-filters-count',
    'update-status',
    'update-task',
    'edit',
    'view-comments',
    'delete',
    'restore',
    'star-toggled',
    'loadTasks',
    'updateTitle',
    'show-deleted-changed'
  ],
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
      expandedTasks: new Set(),
    }
  },
  computed: {
    filteredTasks() {
      let result = JSON.parse(JSON.stringify(this.tasks)) // Deep clone to avoid mutations
      
      // Helper function to filter tasks recursively
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

      // Apply filters
      if (this.filters.search) {
        const searchTerm = this.filters.search.toLowerCase()
        result = filterTasksRecursively(result, task => 
          task.title.toLowerCase().includes(searchTerm)
        )
      }

      if (this.filters.status?.length) {
        result = filterTasksRecursively(result, task =>
          this.filters.status.includes(task.status)
        )
      }

      if (this.filters.excludeStatus?.length) {
        result = filterTasksRecursively(result, task =>
          !this.filters.excludeStatus.includes(task.status)
        )
      }

      if (this.filters.priority) {
        result = filterTasksRecursively(result, task =>
          task.priority === this.filters.priority
        )
      }

      if (this.filters.assignee?.length) {
        result = filterTasksRecursively(result, task =>
          this.filters.assignee.includes(task.assignee)
        )
      }

      if (this.filters.dueDate) {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)
        const nextWeek = new Date(today)
        nextWeek.setDate(nextWeek.getDate() + 7)

        result = filterTasksRecursively(result, task => {
          if (!task.due_date) return false
          const dueDate = new Date(task.due_date)
          switch (this.filters.dueDate) {
            case 'overdue':
              return dueDate < today && task.status !== 'completed'
            case 'today':
              return dueDate >= today && dueDate < tomorrow
            case 'week':
              return dueDate >= today && dueDate < nextWeek
            default:
              return true
          }
        })
      }

      if (this.filters.starred) {
        result = filterTasksRecursively(result, task => task.starred)
      }

      // Sort tasks if needed
      if (this.sortBy) {
        const sortTasks = (tasks) => {
          return tasks.sort((a, b) => {
            let comparison = 0
            switch (this.sortBy) {
              case 'title':
                comparison = a.title.localeCompare(b.title)
                break
              case 'due_date':
                comparison = new Date(a.due_date || 0) - new Date(b.due_date || 0)
                break
              case 'priority':
                const priorityOrder = { high: 3, medium: 2, low: 1 }
                comparison = (priorityOrder[a.priority] || 0) - (priorityOrder[b.priority] || 0)
                break
              default:
                comparison = 0
            }
            return this.sortOrder === 'ascending' ? comparison : -comparison
          })
        }

        // Sort root tasks and their children recursively
        const sortRecursively = (tasks) => {
          const sorted = sortTasks(tasks)
          return sorted.map(task => {
            if (task.children?.length) {
              task.children = sortRecursively(task.children)
            }
            return task
          })
        }

        result = sortRecursively(result)
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
      // Create a complete task update object with all required fields
      const updatedTask = {
        ...task,
        status: checked ? 'completed' : 'not_started',
        assignee: task.assignee || null,
        priority: task.priority || null,
        due_date: task.due_date || null,
        parent_task_id: task.parent_task_id || null
      };
      
      this.$emit('update-task', updatedTask);
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
    },

    toggleExpand(taskId) {
      if (this.expandedTasks.has(taskId)) {
        this.expandedTasks.delete(taskId)
      } else {
        this.expandedTasks.add(taskId)
      }
    },

    isExpanded(taskId) {
      return this.expandedTasks.has(taskId)
    },

    hasChildren(task) {
      return task.children?.length > 0
    },

    expandAllParentTasks() {
      const expandParentTasks = (tasks) => {
        tasks.forEach(task => {
          if (this.hasChildren(task)) {
            this.expandedTasks.add(task.id);
            if (task.children?.length) {
              expandParentTasks(task.children);
            }
          }
        });
      };
      
      expandParentTasks(this.tasks);
    },

    scrollMetadata(direction) {
      const container = event.target.closest('.metadata-scroll-container');
      const scrollAmount = 100; // Adjust this value as needed
      
      if (direction === 'left') {
        container.scrollLeft -= scrollAmount;
      } else {
        container.scrollLeft += scrollAmount;
      }
    },

    navigateToDetailedView(task) {
      // Implement the navigation method here
      console.log('Navigating to detailed view for task:', task);
    }
  },
  watch: {
    filters: {
      deep: true,
      handler() {
        let count = 0;
        if (this.filters.search) count++;
        if (this.filters.status?.length) count++;
        if (this.filters.excludeStatus?.length) count++;
        if (this.filters.priority) count++;
        if (this.filters.assignee?.length) count++;
        if (this.filters.dueDate) count++;
        if (this.filters.starred) count++;
        
        this.$emit('update:active-filters-count', count);
        this.saveFilters();
      }
    },
    tasks: {
      immediate: true,
      handler(newTasks) {
        if (newTasks?.length) {
          this.$nextTick(() => {
            this.expandAllParentTasks();
          });
        }
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
    const router = useRouter();
    const editingTaskId = ref(null)
    const editingField = ref(null)
    const editingValue = ref('')
    const popupPosition = ref({ top: '0px', left: '0px' })

    const statusOptions = [
      { label: 'Not started', value: 'not_started' },
      { label: 'In progress', value: 'in_progress' },
      { label: 'Awaiting external factor', value: 'awaiting_external' },
      { label: 'Completed', value: 'completed' }
    ]

    const priorityOptions = [
      { label: 'High', value: 'high' },
      { label: 'Medium', value: 'medium' },
      { label: 'Low', value: 'low' },
      { label: 'No priority', value: '' }
    ]

    const shortcuts = [
      {
        text: 'Today',
        value: new Date(),
      },
      {
        text: 'Tomorrow',
        value: () => {
          const date = new Date()
          date.setTime(date.getTime() + 3600 * 1000 * 24)
          return date
        },
      },
      {
        text: 'Next week',
        value: () => {
          const date = new Date()
          date.setTime(date.getTime() + 3600 * 1000 * 24 * 7)
          return date
        },
      }
    ]

    // Add handleSubmit function
    const handleSubmit = (task) => {
      if (!task) return
      emit('update-task', { 
        ...task, 
        [editingField.value]: editingValue.value 
      })
      cancelEditing()
    }

    const handlePopupSelect = async (value) => {
      console.log('handlePopupSelect called with value:', value)
      // Find task in both main tasks and child tasks
      let task = props.tasks.find(t => t.id === editingTaskId.value)
      
      if (!task) {
        // Search in child tasks if not found in main tasks
        for (const parentTask of props.tasks) {
          if (parentTask.children) {
            task = parentTask.children.find(t => t.id === editingTaskId.value)
            if (task) break
          }
        }
      }
      
      if (task) {
        let formattedValue = null
        
        if (editingField.value === 'due_date') {
          if (value != null && value !== '') {
            try {
              const date = new Date(value)
              if (!isNaN(date.getTime())) {
                formattedValue = date.toISOString().split('T')[0]
              }
            } catch (error) {
              console.error('Error formatting date:', error)
            }
          }
        } else {
          formattedValue = value
        }
        
        const updatedTask = {
          ...task,
          [editingField.value]: formattedValue
        }
        
        console.log('Updated task:', updatedTask)
        emit('update-task', updatedTask)
        editingValue.value = formattedValue
      }
      
      cancelEditing()
    }

    // Add event listener for ESC key when component is mounted
    onMounted(() => {
      document.addEventListener('keydown', handleEscKey)
      document.addEventListener('click', handleClickOutside)
    })

    // Remove event listener when component is unmounted
    onUnmounted(() => {
      document.removeEventListener('keydown', handleEscKey)
      document.removeEventListener('click', handleClickOutside)
    })

    const handleEscKey = (event) => {
      if (event.key === 'Escape' && editingTaskId.value) {
        cancelEditing()
      }
    }

    const handleClickOutside = (event) => {
      if (editingTaskId.value && !event.target.closest('.popup-menu')) {
        cancelEditing()
      }
    }

    const startEditing = (task, field, event) => {
      if (editingTaskId.value === task.id && editingField.value === field) {
        cancelEditing()
        return
      }

      if (event) {
        // Get the clicked element and its position
        const clickedElement = event.target.closest('.clickable')
        if (clickedElement) {
          const rect = clickedElement.getBoundingClientRect()
          
          // Calculate scroll position
          const scrollTop = window.pageYOffset || document.documentElement.scrollTop
          const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft
          
          // Calculate position based on the clicked element
          popupPosition.value = {
            top: `${rect.bottom + scrollTop}px`,
            left: `${rect.left + scrollLeft}px`,
            transform: 'none',
            maxHeight: '300px'
          }
        }
      }
      
      editingTaskId.value = task.id
      editingField.value = field
      editingValue.value = task[field]
    }

    const cancelEditing = () => {
      editingTaskId.value = null
      editingField.value = null
      editingValue.value = ''
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
    }

    const focusDatePicker = () => {
      nextTick(() => {
        const input = document.querySelector('.due-date-popup .el-input__inner')
        if (input) {
          input.click()
        }
      })
    }

    const navigateToDetailedView = (task) => {
      router.push(`/single-matter/${task.matter_id}/tasks/${task.id}`);
    };

    return {
      editingTaskId,
      editingField,
      editingValue,
      popupPosition,
      statusOptions,
      priorityOptions,
      startEditing,
      handlePopupSelect,
      handleSubmit,
      cancelEditing,
      focusDatePicker,
      shortcuts,
      navigateToDetailedView,
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
          <el-form-item label="Assignee">
            <el-select 
              v-model="filters.assignee" 
              placeholder="Assignee" 
              multiple
              collapse-tags
              collapse-tags-tooltip
              clearable
              class="filter-item"
              style="width: 200px">
              <el-option
                v-for="user in sharedUsers"
                :key="user.id"
                :label="user.email"
                :value="user.id"
              />
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
            <el-switch
              v-model="filters.showDeleted"
              class="filter-item"
            active-text="Show Deleted Tasks"
              @change="$emit('show-deleted-changed', $event)"
              />
          </el-form-item>
          <el-form-item>
          <el-switch
            v-model="filters.starred"
            class="filter-item"
            active-text="Show Starred Tasks"
            @change="saveFilters"
            />
          </el-form-item>
          <el-form-item>
            <el-button @click="clearFilters">Clear</el-button>
          </el-form-item>
        </el-form>
      </div>
    </el-collapse-transition>

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
    
    <!-- Tasks with Hierarchy -->
    <div class="tasks-hierarchy">
      <template v-for="task in filteredTasks" :key="task.id">
        <!-- Parent task -->
        <div class="task-group">
          <div 
            class="task-card"
            :class="{ 'parent-task': hasChildren(task) }"
            @click="openComments(task)"
            @contextmenu.prevent="navigateToDetailedView(task)">
            <div class="task-main">
              <div 
                v-if="hasChildren(task)"
                class="expand-button"
                @click.stop="toggleExpand(task.id)">
                <el-icon :class="['expand-icon', { 'is-expanded': isExpanded(task.id) }]">
                  <ArrowRight />
                </el-icon>
              </div>
              
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

              <div class="metadata-scroll-container">
                <div class="scroll-arrow" @click.stop="scrollMetadata('right')">
                  <div class="scroll-arrow-icon">
                    <el-icon><ArrowRight /></el-icon>
                  </div>
                </div>
                <div class="task-metadata">
                  <!-- Status -->
                  <el-tag
                    :type="getStatusType(task)"
                    size="small"
                    class="status-tag clickable"
                    @click.stop="startEditing(task, 'status', $event)">
                    <span>{{ formatStatus(task.status) }}</span>
                  </el-tag>

                  <!-- Assignee -->
                  <div class="assignee-wrapper">
                    <template v-if="task.assignee">
                      <el-tooltip
                        :content="sharedUsers.find(u => u.id === task.assignee)?.email"
                        placement="top">
                        <div 
                          class="assignee-badge clickable"
                          :style="{ backgroundColor: getAssigneeColor(task.assignee) }"
                          @click.stop="startEditing(task, 'assignee', $event)">
                          {{ sharedUsers.find(u => u.id === task.assignee)?.email.charAt(0).toUpperCase() }}
                        </div>
                      </el-tooltip>
                    </template>
                    <template v-else>
                      <el-tooltip content="Assign task" placement="top">
                        <div 
                          class="assignee-badge unassigned clickable"
                          @click.stop="startEditing(task, 'assignee', $event)">
                          <el-icon><Plus /></el-icon>
                        </div>
                      </el-tooltip>
                    </template>
                  </div>

                  <!-- Priority -->
                  <el-tag
                    :type="getPriorityType(task.priority)"
                    size="small"
                    class="priority-tag clickable"
                    @click.stop="startEditing(task, 'priority', $event)">
                    <span>{{ task.priority || 'No priority' }}</span>
                  </el-tag>

                  <template v-if="task.due_date">
                    <el-tag
                      :type="getDueDateType(task)"
                      size="small"
                      class="due-date-tag clickable"
                      @click.stop="startEditing(task, 'due_date', $event)">
                      <el-icon><Calendar /></el-icon>
                      {{ formatDueDate(task.due_date) }}
                    </el-tag>
                  </template>
                  <template v-else>
                    <div 
                      class="due-date-empty clickable"
                      @click.stop="startEditing(task, 'due_date', $event)">
                      <el-icon><Calendar /></el-icon>
                      <span>No due date</span>
                    </div>
                  </template>
                </div>
              </div>
            </div>
          </div>

          <!-- Modified child tasks section -->
          <el-collapse-transition>
            <div 
              v-if="hasChildren(task) && isExpanded(task.id)" 
              class="child-tasks">
              <div 
                v-for="childTask in task.children" 
                :key="childTask.id"
                class="task-card child-task"
                @click="openComments(childTask)"
                @contextmenu.prevent="navigateToDetailedView(childTask)">
                <div class="task-main">
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

                  <div class="metadata-scroll-container">
                    <div class="task-metadata">
                      <el-tag
                        :type="getStatusType(childTask)"
                        size="small"
                        class="status-tag clickable"
                        @click.stop="startEditing(childTask, 'status', $event)">
                        <span>{{ formatStatus(childTask.status) }}</span>
                      </el-tag>

                      <div class="assignee-wrapper">
                        <template v-if="editingTaskId === childTask.id && editingField === 'assignee'">
                          <el-select
                            v-model="editingValue"
                            size="small"
                            @change="handleSubmit(childTask)"
                            @blur="cancelEditing"
                            @click.stop
                            @keyup.esc="cancelEditing"
                            style="width: 120px">
                            <el-option
                              v-for="user in sharedUsers"
                              :key="user.id"
                              :label="user.email"
                              :value="user.id"
                            />
                          </el-select>
                        </template>
                        <template v-else>
                          <template v-if="childTask.assignee">
                            <el-tooltip
                              :content="sharedUsers.find(u => u.id === childTask.assignee)?.email"
                              placement="top">
                              <div 
                                class="assignee-badge clickable"
                                :style="{ backgroundColor: getAssigneeColor(childTask.assignee) }"
                                @click.stop="startEditing(childTask, 'assignee', $event)">
                                {{ sharedUsers.find(u => u.id === childTask.assignee)?.email.charAt(0).toUpperCase() }}
                              </div>
                            </el-tooltip>
                          </template>
                          <template v-else>
                            <el-tooltip content="Assign task" placement="top">
                              <div 
                                class="assignee-badge unassigned clickable"
                                @click.stop="startEditing(childTask, 'assignee', $event)">
                                <el-icon><Plus /></el-icon>
                              </div>
                            </el-tooltip>
                          </template>
                        </template>
                      </div>

                      <template v-if="editingTaskId === childTask.id && editingField === 'priority'">
                        <el-select
                          v-model="editingValue"
                          size="small"
                          @change="handleSubmit(childTask)"
                          @blur="cancelEditing"
                          @click.stop
                          @keyup.esc="cancelEditing"
                          ref="prioritySelect"
                          style="width: 120px">
                          <el-option label="High" value="high" />
                          <el-option label="Medium" value="medium" />
                          <el-option label="Low" value="low" />
                          <el-option label="No priority" value="" />
                        </el-select>
                      </template>
                      <template v-else>
                        <el-tag
                          :type="getPriorityType(childTask.priority)"
                          size="small"
                          class="priority-tag clickable"
                          @click.stop="startEditing(childTask, 'priority', $event)">
                          <span>{{ childTask.priority || 'No priority' }}</span>
                        </el-tag>
                      </template>

                      <template v-if="childTask.due_date">
                        <el-tag
                          :type="getDueDateType(childTask)"
                          size="small"
                          class="due-date-tag clickable"
                          @click.stop="startEditing(childTask, 'due_date', $event)">
                          <el-icon><Calendar /></el-icon>
                          {{ formatDueDate(childTask.due_date) }}
                        </el-tag>
                      </template>
                      <template v-else>
                        <div 
                          class="due-date-empty clickable"
                          @click.stop="startEditing(childTask, 'due_date', $event)">
                          <el-icon><Calendar /></el-icon>
                          <span>No due date</span>
                        </div>
                      </template>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </el-collapse-transition>
        </div>
      </template>
    </div>
  </div>

  <!-- Add this right after your main template root element -->
  <div 
    v-if="editingTaskId && editingField"
    class="popup-menu"
    :style="popupPosition"
    @click.stop>
    <div class="popup-menu-content">
      <!-- Status options -->
      <template v-if="editingField === 'status'">
        <div 
          v-for="status in statusOptions" 
          :key="status.value"
          class="popup-item"
          :class="{ 'selected': editingValue === status.value }"
          @click="handlePopupSelect(status.value)">
          <div class="popup-option">
            <div class="status-option">
              <el-tag 
                :type="getStatusType({ status: status.value })" 
                size="small"
                class="status-tag">
                {{ status.label }}
              </el-tag>
            </div>
            <el-icon v-if="editingValue === status.value"><Check /></el-icon>
          </div>
        </div>
      </template>

      <!-- Priority options -->
      <template v-if="editingField === 'priority'">
        <div 
          v-for="priority in priorityOptions" 
          :key="priority.value"
          class="popup-item"
          :class="{ 'selected': editingValue === priority.value }"
          @click="handlePopupSelect(priority.value)">
          <div class="popup-option">
            <el-tag :type="getPriorityType(priority.value)" size="small">
              {{ priority.label }}
            </el-tag>
            <el-icon v-if="editingValue === priority.value"><Check /></el-icon>
          </div>
        </div>
      </template>

      <!-- Assignee options -->
      <template v-if="editingField === 'assignee'">
        <div 
          v-for="user in sharedUsers" 
          :key="user.id"
          class="popup-item"
          :class="{ 'selected': editingValue === user.id }"
          @click="handlePopupSelect(user.id)">
          <div class="popup-option">
            <div class="assignee-option">
              <div 
                class="assignee-badge"
                :style="{ backgroundColor: getAssigneeColor(user.id) }">
                {{ user.email.charAt(0).toUpperCase() }}
              </div>
              <span>{{ user.email }}</span>
            </div>
            <el-icon v-if="editingValue === user.id"><Check /></el-icon>
          </div>
        </div>
      </template>

      <!-- Due Date picker -->
      <template v-if="editingField === 'due_date'">
        <div class="popup-item">
          <div class="date-picker-wrapper">
            <el-date-picker
              ref="datePicker"
              v-model="editingValue"
              type="date"
              size="default"
              value-format="YYYY-MM-DD"
              @change="handlePopupSelect"
              @input="handlePopupSelect"
              :clearable="false"
              :placeholder="'Select due date'"
              :shortcuts="shortcuts"
              :visible="true"
              :placement="'bottom'"
            />
          </div>
          <div 
            v-if="editingValue"
            class="clear-date"
            @click="handlePopupSelect(null)">
            Clear date
          </div>
        </div>
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
  transition: background-color 0.2s ease;
  cursor: pointer;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.task-card:hover {
  background-color: #FBFBFB;
}

.parent-task {
  padding-left: 0px !important;
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
  position: relative;
  width: 40px;
  display: flex;
  justify-content: center;
  margin-left: 0;
}

.assignee-badge {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--el-color-white);
  cursor: pointer;
  transition: all 0.2s;
}

.assignee-badge.unassigned {
  background-color: var(--el-fill-color);
  color: var(--el-text-color-secondary);
}

.assignee-badge.unassigned:hover {
  background-color: var(--el-fill-color-dark);
  color: var(--el-text-color-primary);
}

.assignee-badge.clickable:hover {
  opacity: 0.8;
  transform: scale(1.1);
}

/* Position the select dropdown */
.assignee-wrapper :deep(.el-select) {
  position: absolute;
  z-index: 1;
}

.hover-actions {
  position: absolute;
  right: 2px;
  top: 50%;
  transform: translateY(-50%);
  display: none;
  gap: 4px;
  background-color: #FBFBFB;
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
  background-color: #FBFBFB;
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
  padding-left: 45px;
}

.child-task::before,
.child-task-line,
.child-task:hover::before,
.child-task:hover .child-task-line {
  display: none;
}

.child-tasks {
  display: flex;
  flex-direction: column;
  margin-left: 24px;
}

.expand-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.expand-button:hover {
  background-color: var(--el-fill-color);
}

.expand-icon {
  font-size: 16px;
  transition: transform 0.2s;
  color: var(--el-text-color-secondary);
}

.expand-icon.is-expanded {
  transform: rotate(90deg);
}

/* Modify task-main to accommodate expand button */
.task-main {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

/* Add transition for child tasks */
.child-tasks {
  transition: all 0.3s ease-in-out;
}

.task-group {
  display: flex;
  flex-direction: column;
  padding: 0px 8px;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
  background-color: var(--el-fill-color-blank);
  transition: border-color 0.2s;
}

.task-group:hover {
  border-color: var(--el-border-color);
}

/* Update task-card styles to work within group */
.task-card {
  border-bottom: 1px solid var(--el-border-color-lighter);
  margin: 0;  /* Remove any existing margins */
}

/* Adjust child tasks container */
.child-tasks {
  margin: 0px;
  padding: 0px;
}

/* Update mobile styles */
@media (max-width: 768px) {
  .task-group {
    padding: 4px;
  }
  
  .child-tasks {
    margin: 0px;
    padding: 0px;
  }
}

.popup-header {
  padding: 8px 16px;
  color: var(--el-text-color-primary);
  font-weight: 500;
  cursor: default;
}

.popup-header:hover {
  background-color: transparent;
}

.popup-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  gap: 8px;
}

.popup-item.selected {
  background-color: var(--el-fill-color-light);
}

.popup-option .el-icon {
  color: var(--el-color-primary);
}

.assignee-option {
  display: flex;
  align-items: center;
  gap: 8px;
}
.assignee-option span {
  font-size: 14px;
}

.date-picker-wrapper {
  padding: 8px;
}

.date-picker-wrapper :deep(.el-date-picker) {
  border: none;
  box-shadow: none;
  width: 100% !important;
}

.clear-date {
  color: var(--el-color-danger);
  cursor: pointer;
  text-align: center;
  padding: 8px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.clear-date:hover {
  background-color: var(--el-fill-color-light);
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
  background-color: #FBFBFB;
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

<style scoped>
.popup-menu {
  position: fixed;
  background: white;
  border-radius: 4px;
  box-shadow: 0 2px 12px 0 rgba(0,0,0,.1);
  z-index: 2000;
  min-width: 200px;
  max-height: 300px;
  overflow-y: auto;
}

.popup-menu-content {
  display: flex;
  flex-direction: column;
}

.popup-item {
  padding: 8px 0;
  cursor: pointer;
}

.popup-item:hover {
  background-color: var(--el-fill-color-light);
}
.popup-header {
  padding: 8px 16px;
  color: var(--el-text-color-primary);
  font-weight: 500;
  cursor: default;
}

.popup-header:hover {
  background-color: transparent;
}

.popup-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  gap: 8px;
}

.popup-item.selected {
  background-color: var(--el-fill-color-light);
}

.popup-option .el-icon {
  color: var(--el-color-primary);
}

.date-picker-wrapper {
  padding: 8px;
}

.date-picker-wrapper :deep(.el-date-picker) {
  border: none;
  box-shadow: none;
  width: 100% !important;
}

.clear-date {
  color: var(--el-color-danger);
  cursor: pointer;
  text-align: center;
  padding: 8px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.clear-date:hover {
  background-color: var(--el-fill-color-light);
}
</style>

<style scoped>
.status-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-tag {
  min-width: 120px;
  justify-content: center;
  text-align: center;
}

/* Override element-plus tag colors for each status */
:deep(.el-tag--success) {
  --el-tag-bg-color: var(--el-color-success-light-9);
  --el-tag-border-color: var(--el-color-success-light-5);
  --el-tag-text-color: var(--el-color-success);
}

:deep(.el-tag--primary) {
  --el-tag-bg-color: var(--el-color-primary-light-9);
  --el-tag-border-color: var(--el-color-primary-light-5);
  --el-tag-text-color: var(--el-color-primary);
}

:deep(.el-tag--info) {
  --el-tag-bg-color: var(--el-color-info-light-9);
  --el-tag-border-color: var(--el-color-info-light-5);
  --el-tag-text-color: var(--el-color-info);
}

:deep(.el-tag--warning) {
  --el-tag-bg-color: var(--el-color-warning-light-9);
  --el-tag-border-color: var(--el-color-warning-light-5);
  --el-tag-text-color: var(--el-color-warning);
}
</style>

<style>
  .scroll-arrow {
    width: 20px;
    float: right;
    position: absolute;
    top: -24px;
    right: 0;
    z-index: 2;
    display: none;
  }
@media (max-width: 768px) {
  .tasks-hierarchy {
    width: 100%;
    overflow-x: hidden;
  }

  .task-headers {
    width: 100%;
    padding: 0;
    display: flex;
  }

  .header-title {
    width: 70%;
    flex: none;
    position: sticky;
    left: 0;
    background: var(--el-fill-color-light);
    z-index: 1;
    padding: 0 8px;
  }

  .header-metadata {
    width: 30%;
    flex: none;
    display: flex;
    gap: 8px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    -ms-overflow-style: none;
    padding-right: 8px;
  }

  .header-metadata::-webkit-scrollbar {
    display: none;
  }

  /* Add a container for synchronized scrolling */
  .metadata-scroll-container {
    width: 30%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .metadata-scroll-container::-webkit-scrollbar {
    display: none;
  }

  .scroll-arrow {
    width: 20px;
    float: right;
    position: absolute;
    top: -24px;
    right: 0;
    z-index: 2;
    display: none;
  }

  .task-metadata {
    min-width: max-content;
    display: flex;
    gap: 6px;
    padding-right: 8px;
  }

  /* Ensure all metadata items have consistent widths */
  .task-metadata > * {
    flex-shrink: 0;
  }

  .task-metadata .status-tag {
    width: 100px;
  }

  .task-metadata .priority-tag {
    width: 80px;
  }

  .task-metadata .due-date-tag,
  .task-metadata .due-date-empty {
    width: 85px;
  }

  .task-metadata .assignee-wrapper {
    width: 115px;
  }

  .task-card {
    display: flex;
    width: 100%;
    overflow-x: hidden;
  }

  .task-main {
    width: 100%;
    display: flex;
    align-items: center;
  }

  .task-title-container {
    width: 70%;
    flex: none;
    position: sticky;
    left: 0;
    background: white;
    z-index: 1;
    padding: 0 8px;
  }

  /* Create a scrollable container for all task metadata */
  .tasks-metadata-container {
    width: 30%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .tasks-metadata-container::-webkit-scrollbar {
    display: none;
  }

  .task-metadata {
    min-width: max-content;
    display: flex;
    gap: 6px;
  }

  /* Ensure all metadata items have consistent widths */
  .task-metadata > * {
    flex-shrink: 0;
  }

  .task-metadata .status-tag {
    width: 100px;
  }

  .task-metadata .priority-tag {
    width: 80px;
  }

  .task-metadata .due-date-tag,
  .task-metadata .due-date-empty {
    width: 85px;
  }

  .task-metadata .assignee-wrapper {
    width: 115px;
  }
}
</style>

<style>

.metadata-scroll-container::-webkit-scrollbar {
  display: none;
}

.task-metadata {
  min-width: max-content;
  display: flex;
  gap: 6px;
  padding-right: 8px;
}
</style>

