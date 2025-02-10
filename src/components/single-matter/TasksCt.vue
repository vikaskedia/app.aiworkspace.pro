<script>
import { supabase } from '../../supabase';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useMatterStore } from '../../store/matter';
import { storeToRefs } from 'pinia';
import QuickTaskViewCt from './QuickTaskViewCt.vue';
import { useCacheStore } from '../../store/cache';
import TasksList from './TasksList.vue'
import { ArrowDown, Close, Folder, Loading, Check } from '@element-plus/icons-vue'
import QuickActionDrawer from '../common/QuickActionDrawer.vue'
import TiptapEditor from '../common/TiptapEditor.vue'
import TaskBoardCt from './TaskBoardCt.vue'

export default {
  setup() {
    const matterStore = useMatterStore();
    const cacheStore = useCacheStore();
    const { currentMatter } = storeToRefs(matterStore);
    return { currentMatter, cacheStore };
  },
  components: {
    QuickTaskViewCt,
    TasksList,
    ArrowDown,
    Close,
    QuickActionDrawer,
    Folder,
    Loading,
    TiptapEditor,
    Check,
    TaskBoardCt
  },
  data() {
    return {
      subscription: null,
      tasks: [],
      loading: false,
      dialogVisible: false,
      showFilters: false,
      newTask: {
        title: '',
        description: '',
        status: 'not_started',
        priority: 'medium',
        due_date: null,
        assignee: null,
        parent_task_id: null
      },
      sharedUsers: [],
      editingTask: null,
      editDialogVisible: false,
      commentDialogVisible: false,
      selectedTask: null,
      activeFiltersCount: 0,
      showSubtaskSelectionDialog: false,
      suggestedSubtasks: [],
      selectedSubtasks: [],
      aiLoading: false,
      pythonApiBaseUrl: import.meta.env.VITE_PYTHON_API_URL  || 'http://localhost:3001',
      parentTaskId: null,
      showMoreFields: false,
      savedFilters: [],
      savedFiltersDialogVisible: false,
      filters: {
        search: '',
        status: [],
        excludeStatus: ['completed'],
        priority: null,
        assignee: [],
        dueDate: null,
        showDeleted: false,
        starredBy: [],
        viewType: 'list'
      },
      showTypeahead: false,
      typeaheadSuggestions: [],
      typeaheadSelectedIndex: -1,
      typeaheadTimer: null,
      showQuickActions: false,
      showFileSelector: false,
      mentionIndex: 0,
      files: [],
      folders: [],
      currentSelectorFolder: null,
      fileSearchQuery: '',
      selectorBreadcrumbs: [],
      folderNavigationLoading: false,
      boardGroupBy: 'status',
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
    },
    dialogVisible(newValue) {
      if (newValue) {
        this.resetNewTask();
      }
    },
    boardGroupBy(newValue) {
      this.saveFilters();
    },
    filters: {
      deep: true,
      handler() {
        this.loadTasks();
        this.saveFilters();
      }
    }
  },
  methods: {
    async loadSharedUsers() {
      try {
        const { data: shares, error } = await supabase
          .from('matter_access')
          .select('shared_with_user_id, access_type')
          .eq('matter_id', this.currentMatter.id);

        if (error) throw error;

        const sharesWithUserInfo = await Promise.all(
          shares.map(async (share) => {
            // Skip if shared_with_user_id is null
            if (!share.shared_with_user_id) {
              return null;
            }
            
            const { data: userData } = await supabase
              .rpc('get_user_info_by_id', {
                user_id: share.shared_with_user_id
              });

            // Add console.log to debug user data
            //console.log('User data from RPC:', userData);

            if (!userData || !userData[0]) {
              console.error('No user data found for ID:', share.shared_with_user_id);
              return null;
            }

            return {
              id: share.shared_with_user_id,
              email: userData[0].email,
              username: userData[0].username || userData[0].email.split('@')[0], // Fallback to email username
              fullName: userData[0].full_name,
              access_type: share.access_type
            };
          })
        );

        // Filter out any null values from failed user lookups
        this.sharedUsers = sharesWithUserInfo.filter(user => user !== null);
        //console.log('Processed shared users:', this.sharedUsers);
      } catch (error) {
        ElMessage.error('Error loading shared users: ' + error.message);
      }
    },

    async loadTasks(showDeleted = false) {
      if (!this.currentMatter) return;
      
      try {
        this.loading = true;
        const { data: { user } } = await supabase.auth.getUser();
        
        let query = supabase
          .from('tasks')
          .select(`
            *,
            task_stars (
              user_id
            )
          `)
          .eq('matter_id', this.currentMatter.id)
          .order('created_at', { ascending: false });

        if (!showDeleted) {
          query = query.eq('deleted', false);
        }

        const { data: tasks, error } = await query;

        if (error) throw error;

        // Transform the data to include starred status
        const transformedTasks = tasks.map(task => ({
          ...task,
          starred: Boolean(task.task_stars?.length),
          total_hours: task.task_hours_logs?.reduce((sum, log) => {
            if (!log.time_taken) return sum;
            // Convert time_taken (PostgreSQL time type) to hours
            const [hours, minutes, seconds] = log.time_taken.split(':').map(Number);
            const totalHours = hours + minutes/60 + seconds/3600;
            return sum + totalHours;
          }, 0) || 0
        }));

        this.tasks = this.organizeTasksHierarchy(transformedTasks);
        
        // Update cache
        if (!showDeleted) {
          this.cacheStore.setCachedData('tasks', this.currentMatter.id, transformedTasks);
        }
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

        // Parse description for mentions and create notifications
        if (taskData.description) {
          const mentionRegex = /<span data-mention[^>]*data-id="([^"]+)"[^>]*>@([^<]+)<\/span>/g;
          const mentions = [...taskData.description.matchAll(mentionRegex)];
          
          for (const mention of mentions) {
            const userId = mention[1];
            if (userId && userId !== user.id) {
              await this.createNotification(
                userId,
                'mention',
                { 
                  task_id: data[0].id, 
                  task_title: data[0].title,
                  comment_by: user.email
                }
              );
            }
          }
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
        
        // Update cache
        const cachedTasks = this.cacheStore.getCachedData('tasks', this.currentMatter.id) || [];
        const updatedTasks = [data[0], ...cachedTasks];
        this.cacheStore.setCachedData('tasks', this.currentMatter.id, updatedTasks);
        
        // Update UI
        this.tasks = this.organizeTasksHierarchy(updatedTasks);
        
        this.dialogVisible = false;
        this.resetForm();
        ElMessage.success('Task created successfully');

        // Generate AI subtasks
        await this.generateAISubtasks(data[0]);
      } catch (error) {
        ElMessage.error('Error creating task: ' + error.message);
      } finally {
        this.loading = false;
      }
    },

    resetForm() {
      this.filters = {
        search: '',
        status: [],
        excludeStatus: ['completed'],
        priority: null,
        assignee: [],
        dueDate: null,
        showDeleted: false,
        starredBy: [],
        viewType: 'list'
      };
      this.loadSharedUsers();
    },

    async updateTask(task) {
      try {
        this.loading = true;
        
        // Helper function to find task in hierarchical structure
        const findTaskInHierarchy = (tasks, taskId) => {
          for (const t of tasks) {
            if (t.id === taskId) return t;
            if (t.children?.length) {
              const found = findTaskInHierarchy(t.children, taskId);
              if (found) return found;
            }
          }
          return null;
        };

        const originalTask = findTaskInHierarchy(this.tasks, task.id);
        if (!originalTask) {
          throw new Error('Task not found');
        }

        const { data: { user } } = await supabase.auth.getUser();
        
        // Convert undefined to null for parent_task_id
        const parent_task_id = task.parent_task_id === undefined ? null : task.parent_task_id;
        
        const { data, error } = await supabase
          .from('tasks')
          .update({
            title: task.title,
            assignee: task.assignee,
            status: task.status,
            priority: task.priority,
            due_date: task.due_date,
            parent_task_id: parent_task_id
          })
          .eq('id', task.id)
          .select();

        if (error) {
          console.error('Supabase update error:', error);
          throw error;
        }

        // Get all cached tasks and update the modified task
        const cachedTasks = this.cacheStore.getCachedData('tasks', this.currentMatter.id) || [];
        const updatedCachedTasks = cachedTasks.map(t => 
          t.id === task.id ? data[0] : t
        );
        
        // Update cache with flat array
        this.cacheStore.setCachedData('tasks', this.currentMatter.id, updatedCachedTasks);
        
        // Update UI with hierarchical structure
        this.tasks = this.organizeTasksHierarchy(updatedCachedTasks);

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
        if (originalTask.parent_task_id !== task.parent_task_id) {
          const oldParent = this.flattenedTasks.find(t => t.id === originalTask.parent_task_id)?.title || 'no parent';
          const newParent = this.flattenedTasks.find(t => t.id === task.parent_task_id)?.title || 'no parent';
          changes.push(`parent task from "${oldParent}" to "${newParent}"`);
        }
        if (originalTask.priority !== task.priority) {
          changes.push(`priority from "${originalTask.priority || 'no priority'}" to "${task.priority || 'no priority'}"`);
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
                  } : null,
                  parent_task_id: task.parent_task_id !== originalTask.parent_task_id ? {
                    from: originalTask.parent_task_id,
                    to: task.parent_task_id
                  } : null,
                  priority: task.priority !== originalTask.priority ? {
                    from: originalTask.priority,
                    to: task.priority
                  } : null
                }
              }
            });
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

    async deleteTask(task) {
      try {
        this.loading = true;
        const { data: { user } } = await supabase.auth.getUser();
        
        const { error } = await supabase
          .from('tasks')
          .update({
            deleted: true,
            deleted_by: user.id,
            deleted_at: new Date().toISOString()
          })
          .eq('id', task.id);

        if (error) throw error;

        // Remove the deleted task from the local state
        const removeTaskRecursively = (tasks, taskId) => {
          return tasks.filter(t => {
            if (t.children?.length) {
              t.children = removeTaskRecursively(t.children, taskId);
            }
            return t.id !== taskId;
          });
        };

        this.tasks = removeTaskRecursively(this.tasks, task.id);
        
        // Update cache
        const cachedTasks = this.cacheStore.getCachedData('tasks', this.currentMatter.id) || [];
        const updatedCachedTasks = cachedTasks.filter(t => t.id !== task.id);
        this.cacheStore.setCachedData('tasks', this.currentMatter.id, updatedCachedTasks);

        ElMessage.success('Task deleted successfully');
      } catch (error) {
        ElMessage.error('Error deleting task: ' + error.message);
      } finally {
        this.loading = false;
      }
    },

    async restoreTask(task) {
      try {
        this.loading = true;
        
        const { error } = await supabase
          .from('tasks')
          .update({
            deleted: false,
            deleted_by: null,
            deleted_at: null
          })
          .eq('id', task.id);

        if (error) throw error;

        // Update cache
        const cachedTasks = this.cacheStore.getCachedData('tasks', this.currentMatter.id) || [];
        const updatedCachedTasks = [...cachedTasks, task].map(t => 
          t.id === task.id ? { ...t, deleted: false, deleted_by: null, deleted_at: null } : t
        );
        this.cacheStore.setCachedData('tasks', this.currentMatter.id, updatedCachedTasks);
        
        // Update UI
        this.tasks = this.organizeTasksHierarchy(updatedCachedTasks);
        
        ElMessage.success('Task restored successfully');
      } catch (error) {
        ElMessage.error('Error restoring task: ' + error.message);
      } finally {
        this.loading = false;
      }
    },

    async generateAISubtasks(parentTask) {
      try {
        this.aiLoading = true;
        
        // Store the parent task ID
        this.parentTaskId = parentTask.id;
        
        // Create system prompt for subtask generation
        const systemPrompt = `You are an AI legal assistant. A new task has been created with the following details:
        Title: ${parentTask.title}
        Description: ${parentTask.description || 'No description provided'}
        Priority: ${parentTask.priority}
        Due Date: ${parentTask.due_date ? new Date(parentTask.due_date).toLocaleDateString() : 'No due date'}
        
        Please suggest a list of subtasks that would help complete this task. Each subtask should include:
        - title
        - description
        - priority (high/medium/low)
        - timeline
        
        Return only a JSON array of tasks without any markdown formatting or code block syntax.`;

        const response = await fetch(`${this.pythonApiBaseUrl}/gpt/get_ai_response`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            systemPrompt,
            prompt: "Generate a list of subtasks to complete this task",
            taskId: parentTask.id,
            matterId: parentTask.matter_id
          })
        });

        if (!response.ok) throw new Error('Failed to get AI response');
        
        const data = await response.json();
        
        // Clean up the response by removing any markdown code block syntax
        const cleanResponse = data.response.replace(/```json\s*|\s*```/g, '').trim();
        const suggestedSubtasks = JSON.parse(cleanResponse);
        
        // Show subtask selection dialog
        this.suggestedSubtasks = suggestedSubtasks;
        this.showSubtaskSelectionDialog = true;
      } catch (error) {
        ElMessage.error('Error generating subtasks: ' + error.message);
      } finally {
        this.aiLoading = false;
      }
    },

    async createSelectedSubtasks(parentTaskId) {
      try {
        this.loading = true;
        const { data: { user } } = await supabase.auth.getUser();
        const createdSubtasks = [];

        for (const subtask of this.selectedSubtasks) {
          const taskData = {
            title: subtask.title,
            description: subtask.description,
            status: 'not_started',
            priority: subtask.priority,
            matter_id: this.currentMatter.id,
            created_by: user.id,
            due_date: subtask.due_date,
            parent_task_id: parentTaskId
          };

          const { data, error } = await supabase
            .from('tasks')
            .insert([taskData])
            .select();

          if (error) throw error;
          createdSubtasks.push(data[0]);
        }

        // Update cache
        const cachedTasks = this.cacheStore.getCachedData('tasks', this.currentMatter.id) || [];
        const updatedCachedTasks = [...cachedTasks, ...createdSubtasks];
        this.cacheStore.setCachedData('tasks', this.currentMatter.id, updatedCachedTasks);

        // Update UI
        this.tasks = this.organizeTasksHierarchy(updatedCachedTasks);

        this.showSubtaskSelectionDialog = false;
        this.selectedSubtasks = [];
        this.parentTaskId = null;
        ElMessage.success('Subtasks created successfully');
      } catch (error) {
        ElMessage.error('Error creating subtasks: ' + error.message);
      } finally {
        this.loading = false;
      }
    },

    async handleStarToggled(taskId, starred) {
      // Update the task in the local state
      const updateTaskRecursively = (tasks, taskId) => {
        return tasks.map(t => {
          if (t.id === taskId) {
            return { ...t, starred };
          }
          if (t.children?.length) {
            t.children = updateTaskRecursively(t.children, taskId);
          }
          return t;
        });
      };

      // Update cache
      const cachedTasks = this.cacheStore.getCachedData('tasks', this.currentMatter.id) || [];
      const updatedCachedTasks = cachedTasks.map(t => 
        t.id === taskId ? { ...t, starred } : t
      );
      this.cacheStore.setCachedData('tasks', this.currentMatter.id, updatedCachedTasks);
      
      // Update UI
      this.tasks = updateTaskRecursively(this.tasks, taskId);
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

            const tasksList = this.$refs.tasksList;
            if (!tasksList) {
              ElMessage.error('Unable to access task list component');
              return;
            }

            const { data, error } = await supabase
              .from('saved_filters')
              .insert([{
                user_id: user.id,
                filter_name: filterName.value,
                filters: tasksList.filters
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
        const tasksList = this.$refs.tasksList;
        if (filter && tasksList) {
          tasksList.filters = { ...filter.filters };
          ElMessage.success('Filters loaded successfully');
        } else {
          ElMessage.error('Unable to load filters');
        }
      }
    },

    async loadSavedFilters() {
      const savedFilters = localStorage.getItem('taskListFilters');
      if (savedFilters) {
        const parsedFilters = JSON.parse(savedFilters);
        // Extract boardGroupBy from saved filters
        const { boardGroupBy, ...filters } = parsedFilters;
        
        // Ensure excludeStatus is an array with 'completed' as default if not set
        if (!filters.excludeStatus?.length) {
          filters.excludeStatus = ['completed'];
        }
        
        // Set the filters
        this.filters = filters;
        
        // Set the boardGroupBy if it exists
        if (boardGroupBy) {
          this.boardGroupBy = boardGroupBy;
        }
      }
    },

    async loadSavedFilter(filter) {
      const tasksList = this.$refs.tasksList;
      if (tasksList) {
        tasksList.filters = { ...filter.filters };
        this.savedFiltersDialogVisible = false;
        ElMessage.success('Filters loaded successfully');
      } else {
        ElMessage.error('Unable to load filters');
      }
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

    async getTypeaheadSuggestions(text, cursorPosition) {
      try {
        const response = await fetch(`${this.pythonApiBaseUrl}/gpt/get_typeahead_suggestions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text,
            cursor_position: cursorPosition,
            context: {
              task_title: this.newTask.title,
              matter_id: this.currentMatter.id
            }
          })
        });

        if (!response.ok) throw new Error('Failed to get suggestions');
        
        const data = await response.json();
        
        if (data.suggestions?.length) {
          this.typeaheadSuggestions = data.suggestions;
          this.showTypeahead = true;
          this.typeaheadSelectedIndex = -1;
        } else {
          this.showTypeahead = false;
        }
      } catch (error) {
        console.error('Error getting suggestions:', error);
        this.showTypeahead = false;
      }
    },

    handleDescriptionInput(event) {
      const text = typeof event === 'string' ? event : event?.target?.value || '';
      const cursorPos = text.length;

      const textBeforeCursor = text.slice(0, cursorPos);
      const lastWord = textBeforeCursor.split(/\s+/).pop();
      
      if (lastWord === '@files') {
        this.showFileSelector = true;
        this.mentionIndex = cursorPos;
        this.loadFiles();
      }
    },

    selectFile(file) {
      const textarea = document.querySelector('.description-input textarea');
      const text = this.newTask.description;
      const beforeMention = text.slice(0, this.mentionIndex - 6); // Remove '@files'
      const afterMention = text.slice(this.mentionIndex);
      
      this.newTask.description = `${beforeMention}[${file.name}](${file.download_url})${afterMention}`;
      this.showFileSelector = false;
      this.fileSearchQuery = '';
    },

    handleTypeaheadNavigation(event) {
      if (!this.showTypeahead || !this.typeaheadSuggestions.length) return;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          this.typeaheadSelectedIndex = Math.min(
            this.typeaheadSelectedIndex + 1,
            this.typeaheadSuggestions.length - 1
          );
          break;
        case 'ArrowUp':
          event.preventDefault();
          this.typeaheadSelectedIndex = Math.max(this.typeaheadSelectedIndex - 1, -1);
          break;
        case 'Tab':
        case 'Enter':
          event.preventDefault();
          if (this.typeaheadSelectedIndex >= 0) {
            this.applySuggestion(this.typeaheadSuggestions[this.typeaheadSelectedIndex]);
          }
          break;
        case 'Escape':
          this.showTypeahead = false;
          break;
      }
    },

    handleQuickAction(actionId) {
      switch (actionId) {
        case 'new_task':
          this.dialogVisible = true
          break
        case 'toggle_filters':
          this.showFilters = !this.showFilters
          break
        case 'manage_filters':
          this.savedFiltersDialogVisible = true
          break
      }
    },

    async loadFiles() {
      if (!this.currentMatter) return;
      
      try {
        const giteaToken = import.meta.env.VITE_GITEA_TOKEN;
        const giteaHost = import.meta.env.VITE_GITEA_HOST;
        const path = this.currentSelectorFolder?.path || '';
        
        const response = await fetch(
          `${giteaHost}/api/v1/repos/associateattorney/${this.currentMatter.git_repo}/contents/${path}`,
          {
            headers: {
              'Authorization': `token ${giteaToken}`,
              'Accept': 'application/json',
              'Cache-Control': 'no-cache'
            }
          }
        );

        if (!response.ok) throw new Error('Failed to fetch files');
        
        const contents = await response.json();
        
        this.folders = contents
          .filter(item => item.type === 'dir')
          .map(folder => ({
            id: folder.sha,
            name: folder.name,
            path: folder.path,
            type: 'dir'
          }));

        this.files = contents
          .filter(item => item.type === 'file' && item.name !== '.gitkeep')
          .map(file => ({
            id: file.sha,
            name: file.name,
            path: file.path,
            type: 'file',
            download_url: file.download_url
          }));

      } catch (error) {
        ElMessage.error('Error loading files: ' + error.message);
        this.files = [];
        this.folders = [];
      }
    },

    async navigateSelectorFolder(folder) {
      try {
        this.folderNavigationLoading = true;
        if (!folder) {
          // Reset to root
          this.currentSelectorFolder = null;
          this.selectorBreadcrumbs = [];
        } else {
          // Find if folder exists in current breadcrumbs
          const existingIndex = this.selectorBreadcrumbs.findIndex(f => f.id === folder.id);
          
          if (existingIndex >= 0) {
            // Clicking a folder in breadcrumbs - truncate to that point
            this.selectorBreadcrumbs = this.selectorBreadcrumbs.slice(0, existingIndex + 1);
          } else {
            // New folder - add to breadcrumbs
            this.selectorBreadcrumbs.push(folder);
          }
          this.currentSelectorFolder = folder;
        }

        await this.loadFiles();
      } catch (error) {
        ElMessage.error('Error navigating to folder: ' + error.message);
        this.currentSelectorFolder = null;
        this.selectorBreadcrumbs = [];
      } finally {
        this.folderNavigationLoading = false;
      }
    },

    handleEditTask(task) {
      this.editingTask = task;
      this.editDialogVisible = true;
    },

    async updateTaskTitle(task) {
      try {
        this.loading = true;
        
        // Flatten the tasks array to find subtasks
        const flattenTasks = (tasks) => {
          let flat = [];
          tasks.forEach(t => {
            flat.push(t);
            if (t.children?.length) {
              flat = flat.concat(flattenTasks(t.children));
            }
          });
          return flat;
        };
        
        const allTasks = flattenTasks(this.tasks);
        const originalTask = allTasks.find(t => t.id === task.id);
        
        const { data: { user } } = await supabase.auth.getUser();
        
        const { error } = await supabase
          .from('tasks')
          .update({ title: task.title })
          .eq('id', task.id);

        if (error) throw error;

        // Update cache and UI
        const cachedTasks = this.cacheStore.getCachedData('tasks', this.currentMatter.id) || [];
        const updatedCachedTasks = cachedTasks.map(t => 
          t.id === task.id ? { ...t, title: task.title } : t
        );
        
        this.cacheStore.setCachedData('tasks', this.currentMatter.id, updatedCachedTasks);
        this.tasks = this.organizeTasksHierarchy(updatedCachedTasks);

        // Log the title change as activity
        if (originalTask.title !== task.title) {
          await supabase
            .from('task_comments')
            .insert({
              task_id: task.id,
              user_id: user.id,
              content: `Updated title from "${originalTask.title}" to "${task.title}"`,
              type: 'activity',
              metadata: {
                action: 'update',
                changes: {
                  title: {
                    from: originalTask.title,
                    to: task.title
                  }
                }
              }
            });
        }

        ElMessage.success('Task title updated successfully');
      } catch (error) {
        ElMessage.error('Error updating task title: ' + error.message);
      } finally {
        this.loading = false;
      }
    },

    resetNewTask() {
      this.newTask = {
        title: '',
        description: '',
        status: 'not_started',
        priority: 'medium',
        matter_id: this.currentMatter?.id,
        parent_task_id: null,
        due_date: null,
        assignee: null
      };
    },

    isFilterApplied(filter) {
      const tasksList = this.$refs.tasksList;
      if (!tasksList || !filter.filters) return false;
      
      // Deep compare the current filters with the saved filter
      const currentFilters = tasksList.filters;
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

    clearFilters() {
      this.filters = {
        search: '',
        status: [],
        excludeStatus: ['completed'],
        priority: null,
        assignee: [],
        dueDate: null,
        showDeleted: false,
        starredBy: [],
        viewType: 'list'
      };
      this.boardGroupBy = 'status';
      this.saveFilters(); // Save the cleared state
    },

    handleShowDeletedChange(value) {
      this.loadTasks(value);
    },

    saveFilters() {
      localStorage.setItem('taskListFilters', JSON.stringify({
        ...this.filters,
        boardGroupBy: this.boardGroupBy
      }));
    },

    loadSavedFilters() {
      const savedFilters = localStorage.getItem('taskListFilters');
      if (savedFilters) {
        const parsedFilters = JSON.parse(savedFilters);
        // Extract boardGroupBy from saved filters
        const { boardGroupBy, ...filters } = parsedFilters;
        
        // Ensure excludeStatus is an array with 'completed' as default if not set
        if (!filters.excludeStatus?.length) {
          filters.excludeStatus = ['completed'];
        }
        
        // Set the filters
        this.filters = filters;
        
        // Set the boardGroupBy if it exists
        if (boardGroupBy) {
          this.boardGroupBy = boardGroupBy;
        }
      }
    },
  },

  mounted() {
    this.loadSavedFilters();
    if (this.currentMatter) {
      this.setupRealtimeSubscription();
      this.loadSharedUsers();
    }
  },

  beforeUnmount() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  },

  computed: {
    flattenedTasks() {
      const flattened = [];
      const flatten = (tasks, depth = 0) => {
        for (const task of tasks) {
          flattened.push({
            id: task.id,
            title: '  '.repeat(depth) + task.title // Add indentation to show hierarchy
          });
          if (task.children?.length) {
            flatten(task.children, depth + 1);
          }
        }
      };
      flatten(this.tasks);
      return flattened;
    },
    filteredTasks() {
      let result = [...this.tasks];

      const filterTasksRecursively = (tasks, filterFn) => {
        return tasks.filter(task => {
          const matchesFilter = filterFn(task);
          if (task.children?.length) {
            task.children = filterTasksRecursively(task.children, filterFn);
            return matchesFilter || task.children.length > 0;
          }
          return matchesFilter;
        });
      };

      // Apply exclude status filter
      if (this.filters.excludeStatus?.length) {
        result = filterTasksRecursively(result, task => 
          !this.filters.excludeStatus.includes(task.status)
        );
      }

      // Apply other filters...
      // ... rest of the filtering logic ...

      return result;
    }
  }
};
</script>

<template>
  <div class="tasks-container">
    <QuickActionDrawer
      v-model="showQuickActions"
      context="tasks"
      @action="handleQuickAction"
    />
    <div class="content">
      <div class="tasks-header">
        <div class="header-buttons">
          <el-button 
            @click="dialogVisible = true"
            type="primary" 
            size="small"
            :disabled="!currentMatter">
            New Task
          </el-button>
          <el-button 
            @click="showFilters = !showFilters"
            type="info" 
            size="small"
            plain>
            {{ showFilters ? `Hide Filters${activeFiltersCount ? ` (${activeFiltersCount})` : ''}` : `Show Filters${activeFiltersCount ? ` (${activeFiltersCount})` : ''}` }}
          </el-button>
          <el-dropdown @command="handleSavedFilter">
            <el-button type="info" plain size="small">
              Saved Filters
              <el-icon class="el-icon--right"><arrow-down /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="save">Save Current Filters</el-dropdown-item>
                <el-dropdown-item divided command="manage">Manage Saved Filters</el-dropdown-item>
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
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
        <!-- <div class="view-controls">
          <el-radio-group v-model="filters.viewType" size="small">
            <el-radio-button label="list">List View</el-radio-button>
            <el-radio-button label="board">Board View</el-radio-button>
          </el-radio-group>
          
          <el-select 
            v-if="filters.viewType === 'board'"
            v-model="boardGroupBy"
            placeholder="Group by"
            size="small">
            <el-option label="Status" value="status" />
            <el-option label="Assignee" value="assignee" />
            <el-option label="Priority" value="priority" />
          </el-select>
        </div> -->
      </div>

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
                style="width: 140px">
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
                style="width: 160px">
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
                @change="handleShowDeletedChange"
              />
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
                  v-for="user in sharedUsers"
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
            <el-form-item>
              <el-button @click="clearFilters">Clear</el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-collapse-transition>

      <TasksList
        v-if="filters.viewType === 'list'"
        ref="tasksList"
        :tasks="tasks"
        :loading="loading"
        :shared-users="sharedUsers"
        v-model:filters="filters"
        @update-task="updateTask"
        @delete="deleteTask"
        @restore="restoreTask"
        @star-toggled="handleStarToggled"
        @view-comments="(task) => {
          selectedTask = task;
          commentDialogVisible = true;
        }"
        @update:active-filters-count="activeFiltersCount = $event"
        @update-status="updateTask"
        @loadTasks="loadTasks"
        @updateTitle="updateTaskTitle"
      />
      
      <TaskBoardCt
        v-else
        :tasks="tasks"
        :loading="loading"
        :group-by="boardGroupBy"
        :shared-users="sharedUsers"
        v-model:filters="filters"
        @update-task="updateTask"
      />

      <!-- Create Task Dialog -->
      <el-dialog
        v-model="dialogVisible"
        title="Create New Task" 
        class="create-task-dialog"
        width="500px">
        <el-form :model="newTask" label-position="top">
          <!-- Essential fields always shown -->
          <el-form-item label="Title" required>
            <el-input v-model="newTask.title" />
          </el-form-item>
          <el-form-item label="Description">
            <!--<div class="description-input-container">
              <el-input 
                v-model="newTask.description"
                type="textarea"
                :rows="3"
                class="description-input"
                @input="handleDescriptionInput" 
                @keydown="handleTypeaheadNavigation" />
              
              <div v-if="showTypeahead && typeaheadSuggestions.length" class="typeahead-suggestions">
                <div class="typeahead-header">
                  <span>Suggestions</span>
                  <el-button
                    type="text"
                    class="close-button"
                    @click="showTypeahead = false">
                    <el-icon><Close /></el-icon>
                  </el-button>
                </div>
                <div
                  v-for="(suggestion, index) in typeaheadSuggestions"
                  :key="index"
                  class="suggestion-item"
                  :class="{ 'selected': index === typeaheadSelectedIndex }"
                  @click="applySuggestion(suggestion)">
                  {{ suggestion }}
                </div>
              </div>
            </div>-->
            <TiptapEditor
              v-model="newTask.description"
              placeholder="Write a description..."
              @input="handleDescriptionInput"
              :task-title="newTask.title || 'New Task'"
              :shared-users="sharedUsers"
              :enable-typeahead="false"
            />
          </el-form-item>

          <!-- Show more/less button -->
          <div class="show-more-container">
            <el-button 
              link 
              type="primary" 
              @click="showMoreFields = !showMoreFields">
              {{ showMoreFields ? 'Show Less' : 'Show More Options' }}
              <el-icon class="el-icon--right">
                <component :is="showMoreFields ? 'ArrowUp' : 'ArrowDown'" />
              </el-icon>
            </el-button>
          </div>

          <!-- Additional fields in collapse transition -->
          <el-collapse-transition>
            <div v-show="showMoreFields">
              <el-form-item label="Parent Task">
                <el-select 
                  v-model="newTask.parent_task_id" 
                  style="width: 100%"
                  clearable
                  placeholder="Select parent task (optional)">
                  <el-option
                    v-for="task in flattenedTasks"
                    :key="task.id"
                    :label="task.title"
                    :value="task.id"
                    :disabled="task.id === editingTask?.id" />
                </el-select>
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
            </div>
          </el-collapse-transition>
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
          <el-form-item label="Parent Task">
            <el-select 
              v-model="editingTask.parent_task_id" 
              style="width: 100%"
              clearable
              placeholder="Select parent task (optional)">
              <el-option
                v-for="task in flattenedTasks"
                :key="task.id"
                :label="task.title"
                :value="task.id"
                :disabled="task.id === editingTask.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="Status">
            <el-select v-model="editingTask.status" style="width: 100%">
              <el-option label="Not started" value="not_started" />
              <el-option label="In Progress" value="in_progress" />
              <el-option label="Awaiting external factor" value="awaiting_external" />
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

      <QuickTaskViewCt
        v-if="selectedTask"
        :task="selectedTask"
        v-model:visible="commentDialogVisible"
      />

      <!-- AI Subtask Selection Dialog -->
      <el-dialog
        v-model="showSubtaskSelectionDialog"
        title="Select Subtasks to Create"
        width="600px">
        <p>The AI has suggested the following subtasks:</p>
        
        <el-checkbox-group v-model="selectedSubtasks">
          <div v-for="task in suggestedSubtasks" :key="task.title" class="task-suggestion">
            <el-checkbox :label="task" class="task-checkbox">
              <div class="task-details">
                <h4>{{ task.title }}</h4>
                <p>{{ task.description }}</p>
                <div class="task-meta">
                  <el-tag size="small" :type="task.priority === 'high' ? 'danger' : task.priority === 'medium' ? 'warning' : 'info'">
                    {{ task.priority }}
                  </el-tag>
                  <span>Timeline: {{ task.timeline }}</span>
                </div>
              </div>
            </el-checkbox>
          </div>
        </el-checkbox-group>

        <template #footer>
          <span class="dialog-footer">
            <el-button @click="showSubtaskSelectionDialog = false">Cancel</el-button>
            <el-button
              type="primary"
              @click="createSelectedSubtasks(parentTaskId)"
              :loading="loading"
              :disabled="!selectedSubtasks.length">
              Create Selected Subtasks
            </el-button>
          </span>
        </template>
      </el-dialog>

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

      <!-- File Selector Dialog -->
      <el-dialog
        v-model="showFileSelector"
        title="Select File"
        width="500px">
        <div class="file-selector">
          <div class="file-selector-header">
            <el-breadcrumb separator="/">
              <el-breadcrumb-item 
                @click="navigateSelectorFolder(null)"
                :class="{ clickable: currentSelectorFolder }">
                Root
              </el-breadcrumb-item>
              <el-breadcrumb-item 
                v-for="folder in selectorBreadcrumbs" 
                :key="folder.id"
                @click="navigateSelectorFolder(folder)"
                :class="{ clickable: folder.id !== currentSelectorFolder?.id }">
                {{ folder.name }}
              </el-breadcrumb-item>
            </el-breadcrumb>
          </div>

          <el-input
            v-model="fileSearchQuery"
            placeholder="Search files..."
            clearable />
          
          <div class="files-list">
            <div v-if="folderNavigationLoading" class="loading-container">
              <el-icon class="is-loading"><Loading /></el-icon>
              <span>Loading folder contents...</span>
            </div>
            <template v-else>
              <div
                v-for="folder in folders"
                :key="folder.id"
                class="file-item"
                @click="navigateSelectorFolder(folder)">
                <el-icon><Folder /></el-icon>
                {{ folder.name }}
              </div>
              <div
                v-for="file in files"
                :key="file.id"
                class="file-item"
                @click="selectFile(file)">
                {{ file.name }}
              </div>
            </template>
          </div>
        </div>
      </el-dialog>
    </div>
  </div>
</template>

<style scoped>
.tasks-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
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

.header-buttons {
  display: flex;
  gap: 12px;
}

.task-suggestion {
  margin-bottom: 1rem;
  padding: 0.5rem;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
}
label.el-checkbox.task-checkbox {
    display: inline-block;
}
.task-suggestion:hover {
  background-color: #f5f7fa;
}

.task-details {
  margin-left: 0.5rem;
}

.task-details h4 {
  margin: 0 0 0.5rem 0;
}

.task-details p {
  margin: 0 0 0.5rem 0;
  color: #666;
  white-space: pre-line;
  word-break: break-word;
}

.task-meta {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.show-more-container {
  display: flex;
  justify-content: center;
  margin: 8px 0;
}

.no-filters {
  text-align: center;
  color: #909399;
  padding: 20px;
}

.description-input-container {
  position: relative;
  width: 100%;
}

.description-input {
  width: 100%;
}

:deep(.el-textarea__inner) {
  width: 100%;
  resize: vertical;
}

.typeahead-suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  max-height: 200px;
  overflow-y: auto;
  z-index: 1000;
  box-shadow: 0 2px 12px 0 rgba(0,0,0,.1);
}

.typeahead-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid #dcdfe6;
  background-color: #f5f7fa;
}

.typeahead-header span {
  color: #909399;
  font-size: 0.9em;
}

.close-button {
  padding: 2px;
}

.close-button:hover {
  color: #409EFF;
}

.suggestion-item {
  padding: 8px 12px;
  cursor: pointer;
}

.suggestion-item:hover,
.suggestion-item.selected {
  background-color: #f5f7fa;
}

.file-selector {
  .file-selector-header {
    margin-bottom: 1rem;
  }
  
  .files-list {
    margin-top: 1rem;
    max-height: 300px;
    overflow-y: auto;
  }
  
  .file-item {
    padding: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    
    &:hover {
      background-color: #f5f7fa;
    }
  }
  
  .clickable {
    color: #409EFF;
    cursor: pointer;
    
    &:hover {
      text-decoration: underline;
    }
  }

  .loading-container {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 20px;
    color: #909399;
    
    .el-icon {
      font-size: 20px;
    }
  }
}

.applied-filter {
  background-color: var(--el-color-success-light-9);
  border-radius: 4px;
}

/* Override element-plus dropdown item hover effect for applied filters */
.el-dropdown-menu__item.is-disabled .applied-filter {
  background-color: var(--el-color-success-light-9);
  opacity: 1;
  cursor: default;
}

.el-dropdown-menu__item.highlighted-filter {
  background-color: var(--el-color-warning-light-9);
  
  &:hover {
    background-color: var(--el-color-warning-light-8);
  }
}

/* Remove default hover background for highlighted items */
.el-dropdown-menu__item.highlighted-filter:not(.is-disabled):hover {
  background-color: var(--el-color-warning-light-8);
}

/* Override element-plus dropdown item styles */
.el-dropdown-menu__item {
  padding: 8px 16px !important;
}

.el-dropdown-menu__item.active-filter {
  background-color: var(--el-color-primary-light-3);
  color: white;
  
  &:hover {
    background-color: var(--el-color-primary-light-4);
    color: white;
  }
}

/* Override hover effect for non-active filters */
.el-dropdown-menu__item:not(.active-filter):hover {
  background-color: var(--el-fill-color-light);
}

.view-controls {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.filters-container {
  background-color: #f5f7fa;
  padding: 1rem;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
}

.filter-form {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: flex-start;
}

.filter-item {
  margin-right: 1rem;
}

.filter-form .el-form-item {
  margin-bottom: 0;
}
</style> 