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
            <el-form-item label="Workspace">
              <el-select
                v-model="filters.workspace"
                placeholder="All workspaces"
                multiple
                collapse-tags
                collapse-tags-tooltip
                clearable
                filterable
                style="width: 200px">
                <el-option 
                  v-for="workspace in workspaces"
                  :key="workspace.id"
                  :label="workspace.title"
                  :value="workspace.id"
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
            <el-form-item label="Created By">
              <el-select
                v-model="filters.createdBy"
                placeholder="All creators"
                multiple
                collapse-tags
                collapse-tags-tooltip
                clearable
                filterable
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
                style="width: 160px">
                <el-option label="List View - Tree" value="tree" />
                <el-option label="List View - Flat" value="flat" />
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
                <el-option label="Priority (High to Low)" value="priority_desc" />
                <el-option label="Priority (Low to High)" value="priority_asc" />
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
        v-if="filters.viewType === 'tree' || filters.viewType === 'flat'"
        :tasks="filters.viewType === 'tree' ? tasks : flattenTasks(tasks)"
        :loading="loading"
        :shared-users="assignees"
        :isFlatView="filters.viewType === 'flat'"
        v-model:filters="filters"
        @update-task="updateTask"
        @star-toggled="handleStarToggled"
        @view-comments="navigateToTask"
      />

      <TaskBoardCt
        v-else-if="filters.viewType === 'board'"
        :tasks="tasks"
        :loading="loading"
        :group-by="boardGroupBy"
        :is-all-tasks-context="true"
        :workspaces="workspaces"
        :current-workspace="selectedWorkspace"
        :shared-users="assignees"
        v-model:filters="filters"
        @update-task="updateTask"
        @filter-by-status="handleFilterByStatus"
        @filter-by-priority="handleFilterByPriority"
        @filter-by-workspace="handleFilterByWorkspace"
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
        width="250"
        align="right">
        <template #default="scope">
          <el-button
            type="primary"
            link
            @click="loadSavedFilter(scope.row)">
            Load
          </el-button>
          <el-button
            type="success"
            link
            :disabled="scope.row.is_default"
            @click="setAsDefault(scope.row)">
            {{ scope.row.is_default ? 'Default' : 'Set as Default' }}
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
    @task-updated="handleTaskUpdated"
  />
</template>

<script>
import { supabase } from '../../supabase';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useRouter } from 'vue-router';
import { ArrowUp, ArrowDown, Star, StarFilled, Check } from '@element-plus/icons-vue';
import QuickTaskViewCt from '../single-workspace/QuickTaskViewCt.vue';
import TasksList from '../single-workspace/TasksList.vue';
import TaskBoardCt from '../single-workspace/TaskBoardCt.vue';
import { useTaskStore } from '../../store/task';
import { useUserStore } from '../../store/user';
import { updateWorkspaceActivity } from '../../utils/workspaceActivity';
import { setComponentTitle } from '../../utils/page-title';

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
    const taskStore = useTaskStore();
    const userStore = useUserStore();
    return { router, taskStore, userStore };
  },
  data() {
    return {
      tasks: [],
      loading: false,
      showFilters: false,
      workspaces: [],
      assignees: [],
      filters: {
        search: '',
        status: [],
        excludeStatus: ['completed'],
        priority: null,
        dueDate: null,
        workspace: [],
        assignee: [],
        createdBy: [],
        starred: false,
        starredBy: [],
        viewType: 'tree',
        orderBy: 'priority_desc'
      },
      savedFilters: [],
      savedFiltersDialogVisible: false,
      filteredAssignees: [],
      assigneeSearchQuery: '',
      selectedTask: null,
      quickViewVisible: false,
      boardGroupBy: 'status',
      selectedWorkspace: null,
      isUpdating: false
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
      if (this.filters.workspace?.length) count++;
      if (this.filters.assignee?.length) count++;
      if (this.filters.createdBy?.length) count++;
      if (this.filters.starred) count++;
      if (this.filters.starredBy?.length) count++;
      return count;
    }
  },
  methods: {
    updatePageTitle() {
      setComponentTitle('All Tasks');
    },

    async loadTasksWithCache() {
      try {
        this.loading = true;
        const { data: { user } } = await supabase.auth.getUser();

        // Get tasks from cache first
        const cachedTasks = this.taskStore.getAllCachedTasks();
        if (cachedTasks) {
          console.log('get cached Tasks');
          const filteredTasks = this.applyFilters(cachedTasks);
          this.tasks = this.organizeTasksHierarchy(filteredTasks);
        }

        // Fetch fresh data
        let query = supabase
          .from('tasks')
          .select(`
            *,
            workspace:workspaces(
              title,
             workspace_access(shared_with_user_id)
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
          .in('workspace.workspace_access.shared_with_user_id', [user.id]);

        const { data: tasks, error } = await query;
        if (error) throw error;

        // Transform and cache the data
        const transformedTasks = await Promise.all(tasks.map(async task => {
          const assigneeEmail = task.assignee ? 
            await this.loadUserEmail(task.assignee) : 
            null;

          const timePeriods = this.calculateTimeLogPeriods(task.task_hours_logs || []);

          return {
            ...task,
            matter_title: task.workspace?.title || 'Unknown Workspace',
            assignee_email: assigneeEmail,
            starred: task.task_stars?.some(star => star.user_id === user.id) || false,
            total_hours: task.task_hours_logs?.reduce((sum, log) => {
              if (!log.time_taken) return sum;
              const [hours, minutes] = log.time_taken.split(':').map(Number);
              const totalHours = hours + minutes/60;
              return sum + totalHours;
            }, 0) || 0,
            time_periods: timePeriods
          };
        }));

        console.log('get cached Tasks from db');
        // Store in cache
        this.taskStore.setCachedTasks('all', transformedTasks);

        // Apply filters and update UI
        const filteredTasks = this.applyFilters(transformedTasks);
        this.tasks = this.organizeTasksHierarchy(filteredTasks);

      } catch (error) {
        ElMessage.error('Error loading tasks: ' + error.message);
      } finally {
        this.loading = false;
      }
    },

    applyFilters(tasks) {
      let filteredTasks = tasks.filter(task => {
        if (this.filters.search && !task.title.toLowerCase().includes(this.filters.search.toLowerCase())) {
          return false;
        }
        if (this.filters.status?.length && !this.filters.status.includes(task.status)) {
          return false;
        }
        if (this.filters.excludeStatus?.length && this.filters.excludeStatus.includes(task.status)) {
          return false;
        }
        if (this.filters.priority && task.priority !== this.filters.priority) {
          return false;
        }
        if (this.filters.workspace?.length && !this.filters.workspace.includes(task.matter_id)) {
          return false;
        }
        if (this.filters.assignee?.length && !this.filters.assignee.includes(task.assignee)) {
          return false;
        }
        if (this.filters.createdBy?.length && !this.filters.createdBy.includes(task.created_by)) {
          return false;
        }
        // ... other filters ...
        return true;
      });

      // Apply ordering
      filteredTasks.sort((a, b) => {
        switch (this.filters.orderBy) {
          case 'priority_desc':
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
          
          case 'priority_asc':
            const priorityOrderAsc = { high: 1, medium: 2, low: 3 };
            return priorityOrderAsc[b.priority] - priorityOrderAsc[a.priority];
          
          case 'activity_desc':
            return new Date(b.updated_at) - new Date(a.updated_at);
          
          case 'activity_asc':
            return new Date(a.updated_at) - new Date(b.updated_at);
          
          default:
            return 0;
        }
      });

      return filteredTasks;
    },

    async loadUserEmail(userId) {
      try {
        const userInfo = await this.userStore.getUserInfo(userId);
        return userInfo?.email || 'Unknown User';
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
        workspace: [],
        assignee: [],
        createdBy: [],
        starred: false,
        starredBy: [],
        viewType: 'tree',
        orderBy: 'priority_desc'
      };
      this.boardGroupBy = 'status';
      this.loadTasksWithCache();
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

    navigateToWorkspace(workspaceId) {
      this.router.push(`/single-workspace/${workspaceId}`);
    },

    async loadWorkspaces() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: workspaces, error } = await supabase
          .from('workspaces')
          .select(`
            *,
           workspace_access!inner (
              access_type,
              shared_with_user_id
            )
          `)
          .eq('archived', false)
          .eq('workspace_access.shared_with_user_id', user.id)
          .order('title');
        
        if (error) throw error;
        this.workspaces = workspaces;
      } catch (error) {
        console.error('Error loading workspaces:', error);
      }
    },

    async loadAssignees() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: users, error } = await supabase
          .rpc('get_assignees_for_accessible_workspaces', {
            user_uuid: user.id
          });
          
        if (error) throw error;

        // Get full user info for each assignee using the user store
        const assigneesWithFullInfo = await Promise.all(
          users.map(async (user) => {
            const userInfo = await this.userStore.getUserInfo(user.id);
            return {
              ...user,
              displayName: userInfo?.fullName || userInfo?.email.split('@')[0],
              avatar_url: userInfo?.avatarUrl
            };
          })
        );

        this.assignees = assigneesWithFullInfo;
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

        // If we're on the main tasks page and not viewing a specific saved filter,
        // load the default filter if one exists
        if (
          this.$route.path === '/all-workspace/tasks' && 
          !this.$route.path.includes('/saved-filters/')
        ) {
          const defaultFilter = this.savedFilters.find(f => f.is_default);
          if (defaultFilter) {
            // Set boardGroupBy first
            if (defaultFilter.filters.boardGroupBy) {
              this.boardGroupBy = defaultFilter.filters.boardGroupBy;
            }
            // Then set other filters, but convert old 'list' viewType to 'tree'
            const filterData = { ...defaultFilter.filters };
            if (filterData.viewType === 'list') {
              filterData.viewType = 'tree';
            }
            this.filters = filterData;
            this.loadTasksWithCache();
          }
        }
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
              user_id: user.id,
              matter_id: task.matter_id
            });

          if (error) throw error;
        }

        // Update workspace activity
        await updateMatterActivity(task.matter_id);

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
          // Convert old 'list' viewType to 'tree'
          const filterData = { ...filter.filters };
          if (filterData.viewType === 'list') {
            filterData.viewType = 'tree';
          }
          this.filters = filterData;
          // Update page title with filter name
          document.title = `${filter.filter_name} | TaskManager`;
          this.loadTasksWithCache();
          this.router.push(`/all-workspace/tasks/saved-filters/${filterId}`);
          ElMessage.success('Filters loaded successfully');
        }
      }
    },

    async loadSavedFilter(filter) {
      // Set boardGroupBy first
      if (filter.filters.boardGroupBy) {
        this.boardGroupBy = filter.filters.boardGroupBy;
      }
      // Convert old 'list' viewType to 'tree'
      const filterData = { ...filter.filters };
      if (filterData.viewType === 'list') {
        filterData.viewType = 'tree';
      }
      this.filters = filterData;
      // Update page title with filter name
      document.title = `${filter.filter_name} | TaskManager`;
      this.savedFiltersDialogVisible = false;
      this.router.push(`/all-workspace/tasks/saved-filters/${filter.id}`);
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
      await this.loadWorkspaces();
      await this.loadAssignees();
      await this.loadTasksWithCache();
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

    flattenTasks(tasks) {
      // Return a flat array of all tasks without hierarchy
      const flatTasks = [];
      
      const addTasksRecursively = (taskList) => {
        taskList.forEach(task => {
          // Create a copy without children for flat view
          const flatTask = { ...task };
          delete flatTask.children;
          flatTasks.push(flatTask);
          
          // Add children recursively
          if (task.children && task.children.length > 0) {
            addTasksRecursively(task.children);
          }
        });
      };
      
      addTasksRecursively(tasks);
      
      // Apply flat-specific filtering and sorting
      let result = flatTasks;
      
      // Apply search filter
      if (this.filters.search) {
        const searchTerm = this.filters.search.toLowerCase();
        result = result.filter(task => 
          task.title.toLowerCase().includes(searchTerm) ||
          (task.description && task.description.toLowerCase().includes(searchTerm)) ||
          (task.matter_title && task.matter_title.toLowerCase().includes(searchTerm))
        );
      }
      
      // Apply status filter
      if (this.filters.status?.length) {
        result = result.filter(task => this.filters.status.includes(task.status));
      }
      
      // Apply priority filter
      if (this.filters.priority) {
        result = result.filter(task => task.priority === this.filters.priority);
      }
      
      // Apply workspace filter
      if (this.filters.workspace?.length) {
        result = result.filter(task => this.filters.workspace.includes(task.matter_id));
      }
      
      // Apply assignee filter
      if (this.filters.assignee?.length) {
        result = result.filter(task => 
          this.filters.assignee.includes(task.assignee)
        );
      }
      
      // Apply due date filter
      if (this.filters.dueDate) {
        const selectedDate = new Date(this.filters.dueDate);
        selectedDate.setHours(0, 0, 0, 0);
        
        result = result.filter(task => {
          if (!task.due_date) return false;
          
          const dueDate = new Date(task.due_date);
          dueDate.setHours(0, 0, 0, 0);
          
          return dueDate.getTime() === selectedDate.getTime();
        });
      }
      
      // Apply starred filter
      if (this.filters.starred) {
        result = result.filter(task => task.starred);
      }
      
      // Apply starred by filter
      if (this.filters.starredBy?.length) {
        result = result.filter(task => {
          if (!task.task_stars) return false;
          return this.filters.starredBy.some(userId => 
            task.task_stars.some(star => star.user_id === userId)
          );
        });
      }
      
      // Apply exclude status filter
      if (this.filters.excludeStatus?.length) {
        result = result.filter(task => 
          !this.filters.excludeStatus.includes(task.status)
        );
      }
      
      // Sort flat tasks
      if (this.filters.orderBy) {
        result = result.sort((a, b) => {
          let comparison = 0;
          
          switch (this.filters.orderBy) {
            case 'priority_desc': {
              const priorityOrder = { high: 3, medium: 2, low: 1 };
              comparison = (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
              break;
            }
            case 'priority_asc': {
              const priorityOrder = { high: 3, medium: 2, low: 1 };
              comparison = (priorityOrder[a.priority] || 0) - (priorityOrder[b.priority] || 0);
              break;
            }
            case 'activity_desc': {
              const dateA = new Date(a.updated_at || a.created_at || 0);
              const dateB = new Date(b.updated_at || b.created_at || 0);
              comparison = dateB - dateA;
              break;
            }
            case 'activity_asc': {
              const dateA = new Date(a.updated_at || a.created_at || 0);
              const dateB = new Date(b.updated_at || b.created_at || 0);
              comparison = dateA - dateB;
              break;
            }
          }
          return comparison;
        });
      }
      
      return result;
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
          this.loadTasksWithCache();
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
      this.router.push(`/single-workspace/${row.matter_id}/tasks/${row.id}`);
    },

    async updateTask(task) {
      // Prevent duplicate calls
      if (this.isUpdating) return;
      
      try {
        this.isUpdating = true;
        
        // Get the current task from the tasks array to ensure we have the latest data
        const currentTask = this.tasks.find(t => t.id === task.id);
        if (!currentTask) {
          throw new Error('Task not found');
        }

        // Merge the current task data with the updates
        const updatedTask = {
          ...currentTask,
          ...task,
          updated_at: new Date().toISOString()
        };

        await this.taskStore.updateTask(updatedTask);
        
        // Update workspace activity
        await updateWorkspaceActivity(updatedTask.matter_id);
        
        // Clear cache and reload tasks
        await this.loadTasksWithCache();
        
        ElMessage.success('Task updated successfully');
      } catch (error) {
        ElMessage.error('Error updating task: ' + error.message);
      } finally {
        this.isUpdating = false;
      }
    },

    async handleStarToggled(taskId, isStarred) {
      // Find and update the task in the local state
      const task = this.tasks.find(t => t.id === taskId);
      if (task) {
        task.starred = isStarred;
      }
      // Reload tasks to ensure consistency
      await this.loadTasksWithCache();
    },

    handleFilterByStatus(status) {
      this.filters.status = [status];
      //this.showFilters = true;
      this.loadTasksWithCache();
    },

    handleFilterByPriority(priority) {
      this.filters.priority = priority;
      //this.showFilters = true;
      this.loadTasksWithCache();
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
    },

    async setAsDefault(filter) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No authenticated user');

        // Begin transaction
        // First, remove default status from any existing default filter
        const { error: updateError } = await supabase
          .from('saved_filters')
          .update({ is_default: false })
          .eq('user_id', user.id)
          .eq('is_default', true);

        if (updateError) throw updateError;

        // Set the new default filter
        const { error } = await supabase
          .from('saved_filters')
          .update({ is_default: true })
          .eq('id', filter.id);

        if (error) throw error;

        // Update local state
        this.savedFilters = this.savedFilters.map(f => ({
          ...f,
          is_default: f.id === filter.id
        }));

        ElMessage.success('Default filter set successfully');
      } catch (error) {
        console.error('Error setting default filter:', error);
        ElMessage.error('Error setting default filter: ' + error.message);
      }
    },

    handleFilterByWorkspace(workspaceId) {
      this.filters.workspace = [workspaceId];
      //this.showFilters = true;
      this.loadTasksWithCache();
    },

    async handleTaskUpdated(update) {
      if (update.requiresReload) {
        await this.loadTasksWithCache();
      }
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
    this.loadWorkspaces();
    this.loadTasksWithCache();
    this.loadFilterFromUrl();
    
    // Set page title
    this.updatePageTitle();

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
          // Then set other filters, but convert old 'list' viewType to 'tree'
          const filterData = { ...filter.filters };
          if (filterData.viewType === 'list') {
            filterData.viewType = 'tree';
          }
          this.filters = filterData;
          this.loadTasksWithCache();
        }
      } else if (to.path === '/all-workspace/tasks' && from.path.includes('/saved-filters/')) {
        // Going back to main tasks view
        this.clearFilters();
        this.loadTasksWithCache();
      }
    },
    filters: {
      deep: true,
      handler() {
        // this.loadTasksWithCache();
        const cachedTasks = this.taskStore.getAllCachedTasks();
        if (cachedTasks) {
          const filteredTasks = this.applyFilters(cachedTasks);
          this.tasks = this.organizeTasksHierarchy(filteredTasks);
        }
      }
    },
    workspaces: {
      immediate: true,
      handler(workspaces) {
        if (workspaces.length > 0 && !this.selectedWorkspace) {
          this.selectedWorkspace = workspaces[0];
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