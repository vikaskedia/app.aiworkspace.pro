<template>
    <div class="task-board">
      <!-- Board Controls -->
      <div class="board-controls">
        <div class="controls-left">
          <!-- <el-button type="primary" @click="showColumnDialog = true" size="small">
            <el-icon><Plus /></el-icon>Add Column
          </el-button> -->
        </div>
        <div v-if="showScrollButtons" class="scroll-controls">
          <div class="scroll-button left" @click="scrollBoard('left')">
            <el-icon><ArrowLeft /></el-icon>
          </div>
          <div class="scroll-button right" @click="scrollBoard('right')">
            <el-icon><ArrowRight /></el-icon>
          </div>
        </div>
      </div>
  
      <!-- Draggable Board -->
      <div class="board-container">
        <draggable
          class="board-columns"
          v-model="columns"
          item-key="id"
          :group="{ name: 'columns' }"
          handle=".column-header">
          <template #item="{ element: column }">
            <div v-if="column.tasks.length > 0" class="board-column">
              <div class="column-header" :style="{ backgroundColor: getHeaderBackgroundColor(column) }">
                <div class="column-title">
                  <el-avatar 
                    v-if="groupBy === 'assignee' && column.assignee" 
                    :size="18"
                    :src="column.avatarUrl">
                    {{ getInitials(column.title) }}
                  </el-avatar>
                  <h3>{{ column.title }}</h3>
                  <span class="task-count">({{ column.tasks.length }})</span>
                  <el-icon class="header-add-task-button" @click="handleAddTask(column)" title="Add Task">
                    <Plus />
                  </el-icon>
                </div>
              </div>
              
              <draggable
                class="task-list"
                v-model="column.tasks"
                :group="{ name: 'tasks' }"
                item-key="id"
                :draggable="false"
                @change="(e) => onTaskMove(e, column)">
                <template #item="{ element: task }">
                  <div class="task-card" :class="{ 'is-new': task.isNew }">
                    <div v-if="task.isNew" class="new-task-wrapper">
                      <div class="new-task-header">
                        <template v-if="isAllTasksContext">
                          <el-dropdown trigger="click" @command="(matter) => { selectedMatter = matter; updateTaskMatter(task); }">
                            <span class="matter-selector">
                              {{ selectedMatter?.title || 'Select Matter' }}
                              <el-icon class="el-icon--right"><CaretBottom /></el-icon>
                            </span>
                            <template #dropdown>
                              <el-dropdown-menu>
                                <el-dropdown-item 
                                  v-for="matter in matters" 
                                  :key="matter.id"
                                  :command="matter">
                                  {{ matter.title }}
                                </el-dropdown-item>
                              </el-dropdown-menu>
                            </template>
                          </el-dropdown>
                        </template>
                        <span v-else>{{ currentMatter?.title || 'Single Matter' }}</span>
                      </div>
                      <div class="new-task-content">
                        <el-icon class="cancel-icon" @click="cancelNewTask(task, column)" title="Cancel new task">
                          <Close />
                        </el-icon>
                        <el-input
                          v-model="task.title"
                          placeholder="Enter task title..."
                          size="small"
                          @keyup.enter="handleSubmit(task)"
                          @keyup.esc="cancelNewTask(task, column)"
                        />
                        <el-button 
                          type="primary" 
                          size="small" 
                          @click="handleSubmit(task)"
                          :disabled="!task.title.trim()">
                          Save
                        </el-button>
                      </div>
                    </div>
                    <div v-else>
                      <div class="info-icon-wrapper">
                        <el-icon 
                          class="info-icon" 
                          @click.stop="navigateToDetailedView(task)">
                          <InfoFilled />
                        </el-icon>
                      </div>
                      <div class="task-header">
                        <span class="task-title">{{ task.title }}</span>
                      </div>
                      <div class="task-meta">
                        <el-tag 
                          v-if="groupBy !== 'status'"
                          :type="getStatusType(task)" 
                          size="small"
                          class="clickable"
                          @click="handleStatusClick(task.status, $event)">
                          {{ formatStatus(task.status) }}
                        </el-tag>
                        <div class="priority-wrapper">
                          <el-tag 
                            v-if="groupBy !== 'priority'"
                            :type="getPriorityType(task.priority)" 
                            size="small"
                            class="clickable"
                            @click="handlePriorityClick(task.priority, $event)">
                            {{ task.priority }}
                          </el-tag>
                        </div>
                        <div 
                          v-if="groupBy !== 'assignee' && task.assignee"
                          class="assignee-wrapper">
                          <el-avatar :size="20">
                            {{ getInitials(getAssigneeName(task)) }}
                          </el-avatar>
                        </div>
                        <el-tag 
                          v-if="task.due_date"
                          :type="getDueDateType(task)"
                          size="small"
                          class="clickable">
                          <el-icon><Calendar /></el-icon>
                          {{ formatDueDate(task.due_date) }}
                        </el-tag>
                        <el-tooltip 
                          :content="new Date(task.updated_at).toLocaleString()"
                          placement="top">
                          <span class="updated-time">
                            Updated at {{ getRelativeTime(task.updated_at) }}
                          </span>
                        </el-tooltip>
                      </div>
                    </div>
                  </div>
                </template>
              </draggable>
            </div>
          </template>
        </draggable>
      </div>
  
      <!-- Add/Edit Column Dialog -->
      <el-dialog
        v-model="showColumnDialog"
        :title="editingColumn ? 'Edit Column' : 'Add Column'"
        width="400px">
        <el-form :model="columnForm" label-width="100px">
          <el-form-item label="Title">
            <el-input v-model="columnForm.title" />
          </el-form-item>
          <el-form-item label="Type">
            <el-select v-model="columnForm.type" style="width: 100%">
              <el-option label="Assignee" value="assignee" />
              <el-option label="Custom" value="custom" />
            </el-select>
          </el-form-item>
          <el-form-item v-if="columnForm.type === 'assignee'" label="Assignee">
            <el-select v-model="columnForm.assignee" style="width: 100%">
              <el-option
                v-for="user in sharedUsers"
                :key="user.id"
                :label="user.email"
                :value="user.id"
              />
            </el-select>
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="showColumnDialog = false">Cancel</el-button>
          <el-button type="primary" @click="saveColumn">Save</el-button>
        </template>
      </el-dialog>
    </div>
  </template>
  
  <script>
  import { defineComponent } from 'vue'
  import draggable from 'vuedraggable'
  import { Plus, More, ArrowLeft, ArrowRight, InfoFilled, Close, CaretBottom, Calendar } from '@element-plus/icons-vue'
  import { ElMessage } from 'element-plus'
  import { useMatterStore } from '../../store/matter'
  import { storeToRefs } from 'pinia'
  import { supabase } from '../../supabase'
  
  export default defineComponent({
    components: {
      draggable,
      Plus,
      More,
      ArrowLeft,
      ArrowRight,
      InfoFilled,
      Close,
      CaretBottom,
      Calendar
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
      groupBy: {
        type: String,
        default: 'status',
        validator: (value) => ['status', 'assignee', 'priority', 'starred_by'].includes(value)
      },
      sharedUsers: {
        type: Array,
        required: true
      },
      filters: {
        type: Object,
        required: true
      },
      isAllTasksContext: {
        type: Boolean,
        default: false
      },
      matters: {
        type: Array,
        default: () => []
      },
      currentMatter: {
        type: Object,
        required: false,
        default: null
      }
    },
  
    setup() {
      const matterStore = useMatterStore()
      const { currentMatter } = storeToRefs(matterStore)
      
      return {
        currentMatter
      }
    },
  
    data() {
      return {
        columns: [],
        showColumnDialog: false,
        editingColumn: null,
        columnForm: {
          title: '',
          type: 'custom',
          assignee: null
        },
        selectedMatter: null
      }
    },
  
    methods: {
      initializeColumns() {
        let columns = [];
        
        switch (this.groupBy) {
          case 'status':
            // If status filter is active, only show filtered statuses
            if (this.filters.status?.length) {
              columns = this.filters.status.map(status => ({
                id: status,
                title: this.formatStatus(status),
                tasks: []
              }));
            } else {
              columns = [
                { id: 'not_started', title: 'Not Started', tasks: [] },
                { id: 'in_progress', title: 'In Progress', tasks: [] },
                { id: 'awaiting_external', title: 'Awaiting External', tasks: [] },
                { id: 'awaiting_internal', title: 'Awaiting Internal', tasks: [] },
                { id: 'completed', title: 'Completed', tasks: [] }
              ];
            }
            break;
            
          case 'priority':
            // If priority filter is active, only show that priority
            if (this.filters.priority) {
              columns = [
                { id: this.filters.priority, title: `${this.filters.priority.charAt(0).toUpperCase()}${this.filters.priority.slice(1)} Priority`, tasks: [] }
              ];
            } else {
              columns = [
                { id: 'high', title: 'High Priority', tasks: [] },
                { id: 'medium', title: 'Medium Priority', tasks: [] },
                { id: 'low', title: 'Low Priority', tasks: [] }
              ];
            }
            break;
            
          case 'assignee':
            // Get the most up-to-date filters
            const savedFilters = localStorage.getItem('taskListFilters');
            const parsedFilters = savedFilters ? JSON.parse(savedFilters) : null;
            const effectiveFilters = parsedFilters?.assignee || this.filters.assignee;
            
            // Always include unassigned column if no assignee filter is active
            // or if the filter includes tasks without assignees
            if (!effectiveFilters?.length || effectiveFilters.includes(null)) {
              columns = [{ id: 'unassigned', title: 'Unassigned', tasks: [] }];
            } else {
              columns = [];
            }
            
            // Get filtered users based on assignee filter
            const filteredUsers = effectiveFilters?.length
              ? this.sharedUsers.filter(user => effectiveFilters.includes(user.id))
              : this.sharedUsers;
              
            columns.push(...filteredUsers.map(user => ({
              id: user.id,
              title: user.email,
              assignee: user.id,
              avatarUrl: user.avatar_url,
              tasks: []
            })));
            break;
            
          case 'starred_by':
            if (this.filters.starredBy?.length) {
              // Create a column for each selected user
              columns = this.filters.starredBy.map(userId => {
                const user = this.sharedUsers.find(u => u.id === userId);
                return {
                  id: userId,
                  title: user?.email || 'Unknown User',
                  tasks: []
                };
              });
            }
            break;
        }
        
        // Distribute tasks to columns
        this.filteredTasks.forEach(task => {
          if (this.groupBy === 'starred_by') {
            // Get all users who starred this task
            const starredByUsers = task.task_stars?.map(star => star.user_id) || [];
            
            // Add task to each user's column who starred it
            starredByUsers.forEach(userId => {
              const column = columns.find(col => col.id === userId);
              if (column) {
                column.tasks.push(task);
              }
            });
          } else {
            const columnId = this.getColumnIdForTask(task);
            const column = columns.find(col => col.id === columnId);
            if (column) {
              column.tasks.push(task);
            }
          }
        });
        
        this.columns = columns;
      },
  
      getColumnIdForTask(task) {
        switch (this.groupBy) {
          case 'status':
            return task.status || 'not_started';
          case 'priority':
            return task.priority || 'medium';
          case 'assignee':
            return task.assignee || 'unassigned';
          case 'starred_by':
            return task.task_stars?.length ? task.task_stars[0].user_id : 'not_starred';
          default:
            return null;
        }
      },
  
      onTaskMove(event, targetColumn) {
        // if (!event.added && !event.moved) return;
        
        // const task = event.added ? event.added.element : event.moved.element;
        // const updates = {};
        
        // switch (this.groupBy) {
        //   case 'status':
        //     updates.status = targetColumn.id;
        //     break;
        //   case 'priority':
        //     updates.priority = targetColumn.id;
        //     break;
        //   case 'assignee':
        //     updates.assignee = targetColumn.id === 'unassigned' ? null : targetColumn.id;
        //     break;
        // }
        
        // this.$emit('update-task', { ...task, ...updates });
      },
  
      handleColumnAction(command, column) {
        if (command === 'edit') {
          this.editingColumn = column
          this.columnForm = {
            title: column.title,
            type: column.type,
            assignee: column.assignee
          }
          this.showColumnDialog = true
        } else if (command === 'delete') {
          this.deleteColumn(column)
        }
      },
  
      saveColumn() {
        if (!this.columnForm.title) {
          ElMessage.warning('Please enter a column title')
          return
        }
  
        if (this.editingColumn) {
          const index = this.columns.findIndex(col => col.id === this.editingColumn.id)
          if (index !== -1) {
            this.columns[index] = {
              ...this.editingColumn,
              ...this.columnForm
            }
          }
        } else {
          this.columns.push({
            id: `custom-${Date.now()}`,
            ...this.columnForm,
            tasks: []
          })
        }
  
        this.showColumnDialog = false
        this.editingColumn = null
        this.resetColumnForm()
      },
  
      deleteColumn(column) {
        // Don't allow deleting assignee columns
        if (column.type === 'assignee') {
          ElMessage.warning('Cannot delete assignee columns')
          return
        }
  
        const index = this.columns.findIndex(col => col.id === column.id)
        if (index !== -1) {
          // Move tasks to unassigned column
          const unassignedColumn = this.columns.find(col => col.id === 'unassigned')
          if (unassignedColumn) {
            unassignedColumn.tasks.push(...column.tasks)
          }
          this.columns.splice(index, 1)
        }
      },
  
      resetColumnForm() {
        this.columnForm = {
          title: '',
          type: 'custom',
          assignee: null
        }
      },
  
      getInitials(name) {
        return name.split(' ').map(n => n[0]).join('').toUpperCase();
      },
  
      getAssigneeName(task) {
        const assignee = this.sharedUsers.find(user => user.id === task.assignee);
        return assignee ? assignee.email : 'Unassigned';
      },
  
      getStatusType(task) {
        switch (task.status) {
          case 'completed':
            return 'success';
          case 'in_progress':
            return 'warning';
          case 'not_started':
            return 'info';
          case 'awaiting_external':
            return 'danger';
          case 'awaiting_internal':
            return 'primary';
          default:
            return 'info';
        }
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
  
      formatStatus(status) {
        const statusMap = {
          'in_progress': 'In Progress',
          'not_started': 'Not Started',
          'completed': 'Completed',
          'awaiting_external': 'Awaiting External',
          'awaiting_internal': 'Awaiting Internal'
        };
        return statusMap[status] || status;
      },
  
      scrollBoard(direction) {
        const container = this.$el.querySelector('.board-container');
        const scrollAmount = container.clientWidth * 0.8; // Scroll 80% of the visible width
        
        if (direction === 'left') {
          container.scrollLeft -= scrollAmount;
        } else {
          container.scrollLeft += scrollAmount;
        }
      },
  
      getHeaderBackgroundColor(column) {
        switch (this.groupBy) {
          case 'status':
            switch (column.id) {
              case 'completed':
                return 'var(--el-color-success)';
              case 'in_progress':
                return 'var(--el-color-warning)';
              case 'not_started':
                return 'var(--el-color-info)';
              case 'awaiting_external':
                return 'var(--el-color-danger)';
              case 'awaiting_internal':
                return 'var(--el-color-primary)';
              default:
                return 'var(--el-color-info)';
            }
          case 'priority':
            switch (column.id) {
              case 'high':
                return 'var(--el-color-danger)';
              case 'medium':
                return 'var(--el-color-warning)';
              case 'low':
                return 'var(--el-color-success)';
              default:
                return 'var(--el-color-info)';
            }
          default:
            return 'var(--el-color-primary)';
        }
      },
  
      navigateToDetailedView(task) {
        this.$router.push(`/single-matter/${task.matter_id}/tasks/${task.id}`);
      },
  
      handleAddTask(column) {
        const newTask = {
          id: `temp-${Date.now()}`,
          title: '',
          status: this.groupBy === 'status' ? column.id : 'not_started',
          priority: this.groupBy === 'priority' ? column.id : 'medium',
          assignee: this.groupBy === 'assignee' ? column.id : null,
          matter_id: this.currentMatter?.id,
          isNew: true,
          isEditing: true
        };

        column.tasks.unshift(newTask);
      },
  
      cancelNewTask(task, column) {
        const taskIndex = column.tasks.findIndex(t => t.id === task.id);
        if (taskIndex !== -1) {
          column.tasks.splice(taskIndex, 1);
        }
      },
  
      async handleSubmit(task) {
        if (!task.title.trim()) return;
        
        try {
          const { data: { user } } = await supabase.auth.getUser();
          
          const taskData = {
            title: task.title.trim(),
            status: this.groupBy === 'status' ? task.status : 'not_started',
            priority: this.groupBy === 'priority' ? task.priority : 'medium',
            assignee: this.groupBy === 'assignee' ? task.assignee : null,
            matter_id: this.isAllTasksContext ? this.selectedMatter?.id : this.currentMatter?.id,
            created_by: user.id
          };

          const { data, error } = await supabase
            .from('tasks')
            .insert([taskData])
            .select();

          if (error) throw error;

          // Emit event to parent to handle the new task
          this.$emit('update-task', data[0]);

          // Remove the temporary task from column
          const column = this.columns.find(col => col.tasks.includes(task));
          if (column) {
            const taskIndex = column.tasks.findIndex(t => t.id === task.id);
            if (taskIndex !== -1) {
              column.tasks.splice(taskIndex, 1);
            }
            // Add the new task to the column
            column.tasks.unshift(data[0]);
          }

          ElMessage.success('Task created successfully');
        } catch (error) {
          ElMessage.error('Error creating task: ' + error.message);
        }
      },
  
      updateTaskMatter(task) {
        if (this.selectedMatter) {
          task.matter_id = this.selectedMatter.id;
        }
      },
  
      getRelativeTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);
        
        if (diffInSeconds < 60) return 'just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
        return date.toLocaleDateString();
      },
  
      handleStatusClick(status, event) {
        event.stopPropagation(); // Prevent card click event
        this.$emit('filter-by-status', status);
      },
  
      handlePriorityClick(priority, event) {
        event.stopPropagation(); // Prevent card click event
        this.$emit('filter-by-priority', priority);
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
      }
    },
  
    watch: {
      tasks: {
        handler() {
          this.initializeColumns();
        },
        deep: true
      },
      groupBy() {
        // Get saved filters from localStorage first
        const savedFilters = localStorage.getItem('taskListFilters');
        const parsedFilters = savedFilters ? JSON.parse(savedFilters) : null;
        
        // Create a merged filter state, prioritizing localStorage
        const mergedFilters = { 
          ...this.filters,
          assignee: parsedFilters?.assignee || this.filters.assignee 
        };

        // Initialize columns with the merged filters
        this.initializeColumns();
      },
      filters: {
        handler(newFilters) {
          // Don't save to localStorage here since TasksList component handles that
          this.initializeColumns();
        },
        deep: true
      },
      matters: {
        immediate: true,
        handler(matters) {
          if (this.isAllTasksContext && matters.length > 0 && !this.selectedMatter) {
            this.selectedMatter = matters[0];
          }
        }
      },
      currentMatter: {
        immediate: true,
        handler(val) {
          if (!this.isAllTasksContext) {
            this.selectedMatter = val;
          }
        }
      }
    },
  
    created() {
      this.initializeColumns();
    },
  
    computed: {
      showScrollButtons() {
        const visibleColumnsCount = this.columns.filter(col => col.tasks.length > 0).length;
        return visibleColumnsCount > 4 && window.innerWidth > 768;
      },
      filteredTasks() {
        let tasks = this.tasks.slice();
        
        if (this.filters.starredBy?.length) {
          tasks = tasks.filter(task => 
            task.task_stars?.some(star => 
              this.filters.starredBy.includes(star.user_id)
            )
          );
        }
        
        return tasks;
      },
      isAllMatters() {
        return this.isAllTasksContext;
      }
    },
  
    emits: ['update-task', 'update:filters', 'filter-by-status', 'filter-by-priority']
  })
  </script>
  
  <style scoped>
  .task-board {
    height: 100%;
    overflow: hidden;
    background: var(--el-fill-color-blank);
  }
  
  .board-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .controls-left {
    display: flex;
    gap: 8px;
  }
  
  .scroll-controls {
    display: flex;
    gap: 8px;
    transition: opacity 0.3s ease;
  }
  
  .scroll-button {
    width: 30px;
    height: 30px;
    background: white;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
    transition: all 0.3s ease;
    border: 1px solid var(--el-border-color-lighter);
  }
  
  .scroll-button:hover {
    background: var(--el-color-primary-light-9);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  }
  
  .board-container {
    width: 100%;
    height: 100%;
    overflow-x: auto;
    position: relative;
    scroll-behavior: smooth;
    -webkit-overflow-scrolling: touch;
  }
  
  .board-container::-webkit-scrollbar {
    height: 8px;
    background: var(--el-fill-color-light);
  }
  
  .board-container::-webkit-scrollbar-thumb {
    background: var(--el-border-color);
    border-radius: 4px;
  }
  
  .board-container::-webkit-scrollbar-thumb:hover {
    background: var(--el-border-color-darker);
  }
  
  /* Create a wrapper for top scrollbar */
  .board-container::before {
    content: '';
    display: block;
    height: 8px;
    background: var(--el-fill-color-light);
    margin-bottom: 4px;
  }
  
  .board-columns {
    display: flex;
    gap: 0.5rem;
    min-height: 100%;
    padding: 0.5rem;
    min-width: fit-content;
  }
  
  .board-column {
    flex: 0 0 300px;
    background: var(--el-fill-color-light);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    max-height: 100%;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
    border: 1px solid var(--el-border-color-lighter);
  }
  
  .column-header {
    padding: 11px 14px;
    border-radius: 12px 12px 0 0;
    transition: background-color 0.3s ease;
  }
  
  .column-title {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
  }
  
  .column-title h3 {
    margin: 0;
    font-size: 1rem;
    color: #ffffff;
    font-weight: 600;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    flex: 1;
  }
  
  .task-count {
    color: #ffffff;
    font-size: 0.85rem;
    background: rgba(255, 255, 255, 0.2);
    padding: 2px 8px;
    border-radius: 12px;
  }

  .task-list {
    flex: 1;
    overflow-y: auto;
    padding: 0.375rem;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }
  
  .task-card {
    position: relative;
    background: white;
    border-radius: 8px;
    padding: 1rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    border: 1px solid var(--el-border-color-lighter);
    transition: all 0.2s ease;
  }
  
  .info-icon-wrapper {
    position: absolute;
    top: 8px;
    right: 8px;
    opacity: 0;
    transition: opacity 0.2s ease;
  }
  
  .task-card:hover .info-icon-wrapper {
    opacity: 1;
  }
  
  .info-icon {
    color: var(--el-color-primary);
    font-size: 16px;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: all 0.2s ease;
  }
  
  .info-icon:hover {
    background: var(--el-color-primary-light-9);
    transform: translateY(-1px);
  }
  
  .task-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 12px;
  }
  
  .task-title {
    font-weight: 500;
    font-size: 0.95rem;
    color: var(--el-text-color-primary);
    flex: 1;
    min-width: 0;
    word-break: break-word;
    line-height: 1.4;
  }
  
  .task-meta {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    margin-top: 0.75rem;
    flex-wrap: wrap;
  }
  
  /* .task-meta .el-tag {
    border-radius: 6px;
    padding: 0 8px;
    height: 24px;
    line-height: 24px;
  } */
  
  .assignee {
    margin-left: auto;
  }
  
  .assignee .el-avatar {
    border: 2px solid white;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  .more-icon {
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
  }
  
  .more-icon:hover {
    background: var(--el-fill-color-darker);
  }
  
  .priority-wrapper {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  
  .details-icon {
    cursor: pointer;
    padding: 4px;
    color: var(--el-color-primary);
    transition: all 0.2s ease;
    border-radius: 4px;
    font-size: 14px;
  }
  
  .details-icon:hover {
    background: var(--el-color-primary-light-9);
    transform: translateY(-1px);
  }
  
  @media (max-width: 768px) {
    .task-board {
      padding: 8px;
    }
    
    .board-column {
      flex: 0 0 280px;
    }
    
    .task-card {
      padding: 12px;
    }
    
    .task-meta {
      gap: 0.5rem;
    }
    
    .task-meta .el-tag {
      font-size: 0.85rem;
    }
  }

  .add-task-button {
    width: 100%;
    padding: 8px;
    background: var(--el-color-primary-light-9);
    border: 1px dashed var(--el-color-primary);
    color: var(--el-color-primary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: all 0.2s ease;
    margin: 0;
  }

  .add-task-button:hover {
    background: var(--el-color-primary-light-8);
    border-color: var(--el-color-primary-dark-2);
  }

  .add-task-button .el-icon {
    font-size: 16px;
  }

  .task-card.is-new {
    background: white;
    border-radius: 8px;
    padding: 1rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    border: 1px solid var(--el-border-color-lighter);
    transition: all 0.2s ease;
  }

  .new-task-wrapper {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .new-task-header {
    font-size: 0.9rem;
    color: var(--el-text-color-regular);
    font-weight: 500;
  }

  .matter-selector {
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 4px;
    border-radius: 4px;
    transition: background-color 0.2s;
  }

  .matter-selector:hover {
    background-color: var(--el-fill-color-light);
  }

  .new-task-content {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .new-task-content .el-input {
    flex: 1;
  }

  .cancel-icon {
    cursor: pointer;
    color: var(--el-color-danger);
    font-size: 16px;
    padding: 4px;
    border-radius: 4px;
    transition: all 0.2s ease;
  }

  .cancel-icon:hover {
    background: var(--el-color-danger-light-9);
    transform: translateY(-1px);
  }

.header-add-task-button {
  cursor: pointer;
  color: #ffffff;
  font-size: 16px;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s ease;
  margin-left: auto;
}

.header-add-task-button:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: scale(1.1);
}

.updated-time {
  font-size: 0.8rem;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.task-meta {
  justify-content: space-between;
}

.clickable {
  cursor: pointer;
  transition: opacity 0.2s;
}

.clickable:hover {
  opacity: 0.8;
}
  </style> 