<template>
  <div class="tasks-container">
    <div class="content">
      <div class="tasks-header">
        <div class="header-buttons">
          <el-button 
            @click="showFilters = !showFilters"
            type="info"
            plain>
            {{ showFilters ? `Hide Filters${activeFiltersCount ? ` (${activeFiltersCount})` : ''}` : `Show Filters${activeFiltersCount ? ` (${activeFiltersCount})` : ''}` }}
          </el-button>
          <el-dropdown @command="handleSavedFilter">
            <el-button type="info" plain>
              Saved Filters
              <el-icon class="el-icon--right"><arrow-down /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="save">Save Current Filters</el-dropdown-item>
                <el-dropdown-item divided command="manage">Manage Saved Filters</el-dropdown-item>
                <template v-if="savedFilters.length > 0">
                  <el-dropdown-item 
                    v-for="filter in savedFilters" 
                    :key="filter.id" 
                    :command="['load', filter.id]"
                    :class="{ 'active-filter': isFilterApplied(filter) }">
                    <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                      <span>{{ filter.filter_name }}</span>
                      <el-icon v-if="isFilterApplied(filter)" style="color: var(--el-color-primary)">
                        <Check />
                      </el-icon>
                    </div>
                  </el-dropdown-item>
                </template>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
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
                <el-option label="Awaiting internal factor" value="awaiting_internal" />
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
                filterable
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
                multiple
                collapse-tags
                collapse-tags-tooltip
                clearable
                filterable
                remote
                :remote-method="handleAssigneeSearch"
                :loading="loading"
                style="width: 200px">
                <el-option
                  v-for="user in filteredAssignees"
                  :key="user.id"
                  :label="user.email"
                  :value="user.id"
                />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-switch
                v-model="filters.starred"
                class="filter-item"
                active-text="Show Starred Tasks"
              />
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
                <el-option label="Awaiting internal factor" value="awaiting_internal" />
                <el-option label="Completed" value="completed" />
              </el-select>
            </el-form-item>
            <el-form-item label="Starred By">
              <el-select
                v-model="filters.starredBy"
                placeholder="Show tasks starred by..."
                multiple
                collapse-tags
                collapse-tags-tooltip
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
            <el-form-item label="View As">
              <el-select
                v-model="filters.viewType"
                style="width: 140px">
                <el-option label="List View" value="list" />
                <el-option label="Board View" value="board" />
              </el-select>
            </el-form-item>
            <el-form-item 
              label="Group By"
              v-if="filters.viewType === 'board'">
              <el-select
                v-model="boardGroupBy"
                style="width: 140px">
                <el-option label="Status" value="status" />
                <el-option label="Assignee" value="assignee" />
                <el-option label="Priority" value="priority" />
                <el-option 
                  v-if="filters.starredBy?.length"
                  label="Starred By" 
                  value="starred_by" 
                />
              </el-select>
            </el-form-item>
            <el-form-item label="Order By">
              <el-select
                v-model="filters.orderBy"
                style="width: 180px">
                <el-option label="Priority (Low to High)" value="priority_desc" />
                <el-option label="Priority (High to Low)" value="priority_asc" />
                <el-option label="Activity (Recent first)" value="activity_desc" />
                <el-option label="Activity (Oldest first)" value="activity_asc" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button @click="clearFilters">Clear</el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-collapse-transition>

      <!-- Tasks Table -->
      <TasksList
        v-if="filters.viewType === 'list'"
        :tasks="tasks"
        :loading="loading"
        :shared-users="assignees"
        v-model:filters="filters"
        @update-task="updateTask"
        @star-toggled="handleStarToggled"
      />

      <TaskBoardCt
        v-else
        :tasks="tasks"
        :loading="loading"
        :group-by="boardGroupBy"
        :is-all-tasks-context="true"
        :matters="matters"
        :current-matter="selectedMatter"
        :shared-users="assignees"
        v-model:filters="filters"
        @update-task="updateTask"
        @filter-by-status="handleFilterByStatus"
        @filter-by-priority="handleFilterByPriority"
      />
    </div>
  </div>

  <!-- Manage Saved Filters Dialog -->
  <el-dialog
    v-model="savedFiltersDialogVisible"
    title="Manage Saved Filters"
    width="500px">
    <div v-if="savedFilters.length === 0" class="no-filters">
      No saved filters found
    </div>
    <el-table
      v-else
      :data="savedFilters"
      style="width: 100%">
      <el-table-column
        prop="filter_name"
        label="Filter Name"
        min-width="200">
      </el-table-column>
      <el-table-column
        label="Actions"
        width="150"
        align="right">
        <template #default="scope">
          <el-button
            type="primary"
            link
            @click="loadSavedFilter(scope.row)">
            Load
          </el-button>
          <el-button
            type="danger"
            link
            @click="deleteSavedFilter(scope.row)">
            Delete
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-dialog>

  <QuickTaskViewCt
    v-if="selectedTask"
    v-model:visible="quickViewVisible"
    :task="selectedTask"
  />
</template>

<script>
import { supabase } from '../../supabase';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useRouter } from 'vue-router';
import { ArrowUp, ArrowDown, Star, StarFilled, Check } from '@element-plus/icons-vue';
import QuickTaskViewCt from '../single-matter/QuickTaskViewCt.vue';
import TasksList from '../single-matter/TasksList.vue';
import TaskBoardCt from '../single-matter/TaskBoardCt.vue';

export default {
  name: 'AllTasksCt',
  components: {
    ArrowUp,
    ArrowDown,
    Star,
    StarFilled,
    Check,
    QuickTaskViewCt,
    TasksList,
    TaskBoardCt
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
        status: [],
        excludeStatus: ['completed'],
        priority: null,
        dueDate: null,
        matter: null,
        assignee: [],
        starred: false,
        starredBy: [],
        viewType: 'list',
        orderBy: 'priority_desc'
      },
      savedFilters: [],
      savedFiltersDialogVisible: false,
      filteredAssignees: [],
      assigneeSearchQuery: '',
      selectedTask: null,
      quickViewVisible: false,
      boardGroupBy: 'status',
      selectedMatter: null,
    };
  },
  computed: {
    activeFiltersCount() {
      let count = 0;
      if (this.filters.search) count++;
      if (this.filters.status?.length) count++;
      if (this.filters.excludeStatus?.length) count++;
      if (this.filters.priority) count++;
      if (this.filters.dueDate) count++;
      if (this.filters.matter) count++;
      if (this.filters.assignee?.length) count++;
      if (this.filters.starred) count++;
      if (this.filters.starredBy?.length) count++;
      return count;
    }
  },
  methods: {
    async loadTasks() {
      try {
        this.loading = true;
        const { data: { user } } = await supabase.auth.getUser();
        
        let query = supabase
          .from('tasks')
          .select(`
            *,
            matter:matters!inner(
              title,
              matter_access!inner(shared_with_user_id)
            ),
            task_stars!left(
              user_id
            ),
            task_hours_logs(
              time_taken,
              created_at
            )
          `)
          .eq('deleted', false)
          .eq('matter.matter_access.shared_with_user_id', user.id);

        // Apply filters
        if (this.filters.search) {
          query = query.ilike('title', `%${this.filters.search}%`);
        }
        if (this.filters.status?.length) {
          query = query.in('status', this.filters.status);
        }
        if (this.filters.excludeStatus?.length) {
          query = query.not('status', 'in', `(${this.filters.excludeStatus.join(',')})`);
        }
        if (this.filters.priority) {
          query = query.eq('priority', this.filters.priority);
        }
        if (this.filters.matter) {
          query = query.eq('matter_id', this.filters.matter);
        }
        if (this.filters.assignee?.length) {
          query = query.in('assignee', this.filters.assignee);
        }
        if (this.filters.starred) {
          query = query.not('task_stars.user_id', 'is', null)
            .eq('task_stars.user_id', user.id);
        }
        if (this.filters.starredBy?.length) {
          query = query.not('task_stars.user_id', 'is', null)
            .in('task_stars.user_id', this.filters.starredBy);
        }

        // Apply ordering
        if (this.filters.orderBy) {
          switch (this.filters.orderBy) {
            case 'priority_desc':
              query = query
                .order('priority', {
                  ascending: false,
                  nullsLast: true,
                  mapping: {
                    'high': 3,
                    'medium': 2,
                    'low': 1,
                    null: 0
                  }
                })
                .order('updated_at', { ascending: false });
              break;
            case 'priority_asc':
              query = query
                .order('priority', {
                  ascending: true,
                  nullsLast: true,
                  mapping: {
                    'high': 3,
                    'medium': 2,
                    'low': 1,
                    null: 0
                  }
                })
                .order('updated_at', { ascending: false });
              break;
            case 'activity_desc':
              query = query.order('updated_at', { ascending: false });
              break;
            case 'activity_asc':
              query = query.order('updated_at', { ascending: true });
              break;
          }
        }

        const { data: tasks, error } = await query;

        if (error) throw error;

        // Transform the data
        const transformedTasks = await Promise.all(tasks.map(async task => {
          const assigneeEmail = task.assignee ? 
            await this.loadUserEmail(task.assignee) : 
            null;

          const timePeriods = this.calculateTimeLogPeriods(task.task_hours_logs || []);

          return {
            ...task,
            matter_title: task.matter?.title || 'Unknown Matter',
            assignee_email: assigneeEmail,
            starred: task.task_stars?.some(star => star.user_id === user.id) || false,
            total_hours: task.task_hours_logs?.reduce((sum, log) => {
              if (!log.time_taken) return sum;
              const [hours, minutes] = log.time_taken.split(':').map(Number);
              const totalHours = hours + minutes/60;
              return sum + totalHours;
            }, 0) || 0,
            time_periods: {
              daily: Math.round(timePeriods.daily / 60 * 10) / 10,
              weekly: Math.round(timePeriods.weekly / 60 * 10) / 10,
              monthly: Math.round(timePeriods.monthly / 60 * 10) / 10
            }
          };
        }));

        // Organize into hierarchy
        this.tasks = this.organizeTasksHierarchy(transformedTasks);

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
        status: [],
        excludeStatus: ['completed'],
        priority: null,
        dueDate: null,
        matter: null,
        assignee: [],
        starred: false,
        starredBy: [],
        viewType: 'list',
        orderBy: 'priority_desc'
      };
      this.boardGroupBy = 'status';
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
      this.selectedTask = task;
      this.quickViewVisible = true;
    },

    navigateToMatter(matterId) {
      this.router.push(`/single-matter/${matterId}`);
    },

    async loadMatters() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: matters, error } = await supabase
          .from('matters')
          .select(`
            *,
            matter_access!inner (
              access_type,
              shared_with_user_id
            )
          `)
          .eq('archived', false)
          .eq('matter_access.shared_with_user_id', user.id)
          .order('title');
        
        if (error) throw error;
        this.matters = matters;
      } catch (error) {
        console.error('Error loading matters:', error);
      }
    },

    async loadAssignees() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: users, error } = await supabase
          .rpc('get_assignees_for_accessible_matters', {
            user_uuid: user.id
          });
          
        if (error) throw error;
        this.assignees = users;
      } catch (error) {
        console.error('Error loading assignees:', error);
      }
    },

    async loadSavedFilters() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('saved_filters')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        this.savedFilters = data || [];

      } catch (error) {
        console.error('Error loading saved filters:', error);
        ElMessage.error('Error loading saved filters: ' + error.message);
        this.savedFilters = [];
      }
    },

    formatStatus(status) {
      const statusMap = {
        'in_progress': 'In progress',
        'not_started': 'Not started',
        'completed': 'Completed',
        'awaiting_external': 'Awaiting external factor',
        'awaiting_internal': 'Awaiting internal factor'
      };
      return statusMap[status] || status;
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

        // Update the task in the local state
        this.tasks = this.tasks.map(t => 
          t.id === task.id ? { ...t, starred: !t.starred } : t
        );
      } catch (error) {
        ElMessage.error('Error updating task star: ' + error.message);
      }
    },

    async handleSavedFilter(command) {
      if (command === 'save') {
        const filterName = await this.$prompt('Enter a name for this filter set', 'Save Filters', {
          confirmButtonText: 'Save',
          cancelButtonText: 'Cancel',
        }).catch(() => null);

        if (filterName?.value) {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No authenticated user');

            const filterData = {
              ...this.filters,
              boardGroupBy: this.boardGroupBy
            };

            const { data, error } = await supabase
              .from('saved_filters')
              .insert([{
                user_id: user.id,
                filter_name: filterName.value,
                filters: filterData
              }])
              .select();

            if (error) throw error;

            await this.loadSavedFilters();
            ElMessage.success('Filters saved successfully');
          } catch (error) {
            console.error('Error saving filters:', error);
            ElMessage.error('Error saving filters: ' + error.message);
          }
        }
      } else if (command === 'manage') {
        this.savedFiltersDialogVisible = true;
      } else if (Array.isArray(command) && command[0] === 'load') {
        const filterId = command[1];
        const filter = this.savedFilters.find(f => f.id === filterId);
        if (filter) {
          // Set boardGroupBy first
          if (filter.filters.boardGroupBy) {
            this.boardGroupBy = filter.filters.boardGroupBy;
          }
          this.filters = { ...filter.filters };
          // Update page title with filter name
          document.title = `${filter.filter_name} | TaskManager`;
          this.loadTasks();
          this.router.push(`/all-matters/tasks/saved-filters/${filterId}`);
          ElMessage.success('Filters loaded successfully');
        }
      }
    },

    async loadSavedFilter(filter) {
      // Set boardGroupBy first
      if (filter.filters.boardGroupBy) {
        this.boardGroupBy = filter.filters.boardGroupBy;
      }
      this.filters = { ...filter.filters };
      // Update page title with filter name
      document.title = `${filter.filter_name} | TaskManager`;
      this.savedFiltersDialogVisible = false;
      this.router.push(`/all-matters/tasks/saved-filters/${filter.id}`);
      ElMessage.success('Filters loaded successfully');
    },

    async deleteSavedFilter(filter) {
      try {
        await ElMessageBox.confirm(
          'Are you sure you want to delete this filter?',
          'Warning',
          {
            confirmButtonText: 'Delete',
            cancelButtonText: 'Cancel',
            type: 'warning'
          }
        );

        const { error } = await supabase
          .from('saved_filters')
          .delete()
          .eq('id', filter.id);

        if (error) throw error;

        await this.loadSavedFilters();
        ElMessage.success('Filter deleted successfully');
      } catch (error) {
        if (error !== 'cancel') {
          console.error('Error deleting filter:', error);
          ElMessage.error('Error deleting filter: ' + error.message);
        }
      }
    },

    async initializeComponent() {
      await this.loadSavedFilters();
      await this.loadMatters();
      await this.loadAssignees();
      await this.loadTasks();
    },

    handleAssigneeSearch(query) {
      this.assigneeSearchQuery = query;
      if (!query) {
        this.filteredAssignees = this.assignees;
        return;
      }
      const normalizedQuery = query.toLowerCase();
      this.filteredAssignees = this.assignees.filter(user =>
        user.email.toLowerCase().includes(normalizedQuery)
      );
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

    async loadFilterFromUrl() {
      const path = this.router.currentRoute.value.path;
      const match = path.match(/\/saved-filters\/([^\/]+)/);
      if (match) {
        const filterId = match[1];
        await this.loadSavedFilters(); // Make sure we have the filters loaded
        const filter = this.savedFilters.find(f => f.id === filterId);
        if (filter) {
          // Set boardGroupBy first
          if (filter.filters.boardGroupBy) {
            this.boardGroupBy = filter.filters.boardGroupBy;
          }
          this.filters = { ...filter.filters };
          // Set page title with filter name
          document.title = `${filter.filter_name} | TaskManager`;
          this.loadTasks();
        }
      }
    },

    isFilterApplied(filter) {
      if (!filter.filters) return false;
      
      // Deep compare the current filters with the saved filter
      const currentFilters = this.filters;
      return Object.keys(filter.filters).every(key => {
        // Handle arrays
        if (Array.isArray(filter.filters[key])) {
          if (!Array.isArray(currentFilters[key])) return false;
          if (filter.filters[key].length !== currentFilters[key].length) return false;
          return filter.filters[key].every(item => currentFilters[key].includes(item));
        }
        // Handle other types
        return filter.filters[key] === currentFilters[key];
      });
    },

    handleContextMenu(row, column, event) {
      event.preventDefault();
      this.navigateToDetailedView(row);
    },

    navigateToDetailedView(row) {
      if (!row || !row.matter_id) return;
      this.router.push(`/single-matter/${row.matter_id}/tasks/${row.id}`);
    },

    async updateTask(task) {
      try {
        const { error } = await supabase
          .from('tasks')
          .update({
            status: task.status,
            assignee: task.assignee,
            priority: task.priority,
            due_date: task.due_date,
            parent_task_id: task.parent_task_id
          })
          .eq('id', task.id);

        if (error) throw error;

        // Update the task in the local state
        await this.loadTasks();
        ElMessage.success('Task updated successfully');
      } catch (error) {
        ElMessage.error('Error updating task: ' + error.message);
      }
    },

    async handleStarToggled(taskId, isStarred) {
      // Find and update the task in the local state
      const task = this.tasks.find(t => t.id === taskId);
      if (task) {
        task.starred = isStarred;
      }
      // Reload tasks to ensure consistency
      await this.loadTasks();
    },

    handleFilterByStatus(status) {
      this.filters.status = [status];
      //this.showFilters = true;
      this.loadTasks();
    },

    handleFilterByPriority(priority) {
      this.filters.priority = priority;
      //this.showFilters = true;
      this.loadTasks();
    },

    calculateTimeLogPeriods(hoursLogs) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      return hoursLogs.reduce((acc, log) => {
        if (!log.time_taken) return acc;
        const logDate = new Date(log.created_at);
        const [hours, minutes] = log.time_taken.split(':').map(Number);
        const timeInMinutes = (hours * 60) + minutes;

        if (logDate >= today) {
          acc.daily += timeInMinutes;
        }
        if (logDate >= weekStart) {
          acc.weekly += timeInMinutes;
        }
        if (logDate >= monthStart) {
          acc.monthly += timeInMinutes;
        }

        return acc;
      }, { daily: 0, weekly: 0, monthly: 0 });
    }
  },
  mounted() {
    // Clear localStorage on page reload
    if (performance.navigation.type === 1) { // 1 indicates page reload
      localStorage.removeItem('taskListFilters');
    }
    
    this.loadSavedFilters();
    this.loadAssignees().then(() => {
      this.filteredAssignees = this.assignees;
    });
    this.loadMatters();
    this.loadTasks();
    this.loadFilterFromUrl();
  },
  watch: {
    '$route'(to, from) {
      // Handle navigation between tasks and saved filters views
      if (to.path.includes('/saved-filters/')) {
        // Going to saved filters view
        const filterId = to.path.split('/saved-filters/')[1];
        const filter = this.savedFilters.find(f => f.id === filterId);
        if (filter) {
          // Set boardGroupBy first
          if (filter.filters.boardGroupBy) {
            this.boardGroupBy = filter.filters.boardGroupBy;
          }
          // Then set other filters
          this.filters = { ...filter.filters };
          this.loadTasks();
        }
      } else if (to.path === '/all-matters/tasks' && from.path.includes('/saved-filters/')) {
        // Going back to main tasks view
        this.clearFilters();
        this.loadTasks();
      }
    },
    filters: {
      deep: true,
      handler() {
        this.loadTasks();
      }
    },
    matters: {
      immediate: true,
      handler(matters) {
        if (matters.length > 0 && !this.selectedMatter) {
          this.selectedMatter = matters[0];
        }
      }
    },
    '$route'(to) {
      // Reset title when leaving filtered view
      if (!to.path.includes('/saved-filters/')) {
        document.title = 'TaskManager';
      }
    }
  },
  unmounted() {
    document.title = 'TaskManager';
  }
};
</script>

<style scoped>
.tasks-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.filters-container[data-v-6f63dc8b] {
    background-color: #f5f7fa;
    border-radius: 4px;
    border: 1px solid #ddd;
}

.filter-form .el-form-item {
    margin-bottom: 0;
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

.no-filters {
  text-align: center;
  color: #909399;
  padding: 20px;
}

.title-with-star {
  display: flex;
  align-items: center;
  gap: 8px;
  text-align: left;
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

.title-content {
  flex: 1;
  min-width: 0;
}

.title-hours-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.clickable-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.logged-hours {
  flex-shrink: 0;
  color: var(--el-text-color-secondary);
  font-size: 0.9em;
}

:deep(.el-table__expand-icon) {
  height: 20px;
  margin-right: 8px;
}

:deep(.el-table [class*=el-table__row--level] .el-table__expand-icon) {
  margin-right: 8px;
}

:deep(.el-table__indent) {
  padding-left: 15px !important;
}

.clickable {
  cursor: pointer;
  transition: opacity 0.2s;
}

.clickable:hover {
  opacity: 0.8;
}
</style>

<style lang="scss">
.el-dropdown-menu__item {
  padding: 8px 16px !important;
}

.el-dropdown-menu__item.active-filter {
  background-color: var(--el-color-primary-light-3);
  color: white;
  
  &:hover {
    background-color: var(--el-color-primary-light-3);
    color: white !important;
  }
}

/* Override hover effect for non-active filters */
.el-dropdown-menu__item:not(.active-filter):hover {
  background-color: var(--el-fill-color-light);
}
</style> 