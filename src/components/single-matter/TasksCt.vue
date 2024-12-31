<script>
import { supabase } from '../../supabase';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useMatterStore } from '../../store/matter';
import { storeToRefs } from 'pinia';
import QuickTaskViewCt from './QuickTaskViewCt.vue';
import { useCacheStore } from '../../store/cache';
import TasksList from './TasksList.vue'
import { ArrowDown } from '@element-plus/icons-vue'

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
    ArrowDown
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
        status: null,
        excludeStatus: ['completed'],
        priority: null,
        assignee: null,
        dueDate: null,
        showDeleted: false,
        starred: false
      },
      showTypeahead: false,
      typeaheadSuggestions: [],
      typeaheadSelectedIndex: -1,
      typeaheadTimer: null,
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
    }
  },
  methods: {
    async loadTasks(showDeleted = false) {
      if (!this.currentMatter) return;
      
      try {
        this.loading = true;
        const { data: { user } } = await supabase.auth.getUser();
        
        let query = supabase
          .from('tasks')
          .select(`
            *,
            task_stars!left(user_id)
          `)
          .eq('matter_id', this.currentMatter.id)
          .eq('task_stars.user_id', user.id)
          .order('created_at', { ascending: false });

        if (!showDeleted) {
          query = query.eq('deleted', false);
        }

        const { data: tasks, error } = await query;

        if (error) throw error;

        // Transform the data to include starred status
        const transformedTasks = tasks.map(task => ({
          ...task,
          starred: Boolean(task.task_stars?.length)
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
      this.newTask = {
        title: '',
        description: '',
        status: 'not_started',
        priority: 'medium',
        due_date: null,
        assignee: null,
        parent_task_id: null
      };
      this.loadSharedUsers();
    },

    async loadSharedUsers() {
      try {
        const { data: shares, error } = await supabase
          .from('matter_access')
          .select('shared_with_user_id, access_type')
          .eq('matter_id', this.currentMatter.id);

        if (error) throw error;

        const sharesWithUserInfo = await Promise.all(
          shares.map(async (share) => {
            const { data: userData } = await supabase
              .rpc('get_user_info_by_id', {
                user_id: share.shared_with_user_id
              });

            return {
              id: share.shared_with_user_id,
              email: userData[0].email,
              access_type: share.access_type
            };
          })
        );

        this.sharedUsers = sharesWithUserInfo;
      } catch (error) {
        ElMessage.error('Error loading shared users: ' + error.message);
      }
    },

    async updateTask(task) {
      try {
        this.loading = true;
        const originalTask = this.tasks.find(t => t.id === task.id);
        const { data: { user } } = await supabase.auth.getUser();
        
        // Convert undefined to null for parent_task_id
        const parent_task_id = task.parent_task_id === undefined ? null : task.parent_task_id;
        
        console.log('Updating task with parent_task_id:', parent_task_id);
        
        const { data, error } = await supabase
          .from('tasks')
          .update({
            title: task.title,
            assignee: task.assignee,
            status: task.status,
            due_date: task.due_date,
            parent_task_id: parent_task_id  // Use the converted value
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
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('saved_filters')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        this.savedFilters = data;
      } catch (error) {
        console.error('Error loading saved filters:', error);
        ElMessage.error('Error loading saved filters: ' + error.message);
        this.savedFilters = [];
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
      // For el-input, the event is directly the new value
      const text = event;
      const textarea = document.querySelector('.description-input textarea');
      const cursorPos = textarea?.selectionStart || 0;

      // Clear any existing timer
      if (this.typeaheadTimer) {
        clearTimeout(this.typeaheadTimer);
      }
      
      // Set a new timer to avoid too many API calls
      this.typeaheadTimer = setTimeout(() => {
        this.getTypeaheadSuggestions(text, cursorPos);
      }, 300);
    },

    applySuggestion(suggestion) {
      const textarea = document.querySelector('.description-input textarea');
      const cursorPos = textarea.selectionStart;
      const text = this.newTask.description;
      
      // Find the last word before cursor
      const words = text.slice(0, cursorPos).split(' ');
      const lastWord = words[words.length - 1];
      
      // Replace the incomplete word with the suggestion
      words[words.length - 1] = suggestion;
      this.newTask.description = words.join(' ') + text.slice(cursorPos);
      
      // Reset typeahead
      this.showTypeahead = false;
      this.typeaheadSuggestions = [];
      
      // Set cursor position after the inserted suggestion
      this.$nextTick(() => {
        const newPos = cursorPos - lastWord.length + suggestion.length;
        textarea.setSelectionRange(newPos, newPos);
        textarea.focus();
      });
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
    }
  },

  mounted() {
    if (this.currentMatter) {
      this.setupRealtimeSubscription();
      this.loadSharedUsers();
      this.loadSavedFilters();
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
    <div class="content">
      <div class="tasks-header">
        <div class="header-buttons">
          <el-button 
            @click="dialogVisible = true"
            type="primary"
            :disabled="!currentMatter">
            New Task
          </el-button>
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
                <el-dropdown-item 
                  v-for="filter in savedFilters" 
                  :key="filter.id" 
                  :command="['load', filter.id]">
                  {{ filter.filter_name }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>

      <TasksList
        ref="tasksList"
        :tasks="tasks"
        :loading="loading"
        :shared-users="sharedUsers"
        v-model:show-filters="showFilters"
        v-model:active-filters-count="activeFiltersCount"
        @load-tasks="loadTasks"
        @show-deleted-changed="loadTasks"
        @star-toggled="handleStarToggled"
        @edit="async (task) => {
          editingTask = {...task};
          await loadSharedUsers();
          editDialogVisible = true;
        }"
        @view-comments="(task) => {
          selectedTask = task;
          commentDialogVisible = true;
        }"
        @delete="deleteTask"
        @restore="restoreTask"
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
            <div class="description-input-container">
              <el-input 
                v-model="newTask.description"
                type="textarea"
                :rows="3"
                class="description-input"
                @input="handleDescriptionInput" 
                @keydown="handleTypeaheadNavigation" />
              
              <!-- Typeahead suggestions -->
              <div v-if="showTypeahead && typeaheadSuggestions.length" class="typeahead-suggestions">
                <div
                  v-for="(suggestion, index) in typeaheadSuggestions"
                  :key="index"
                  class="suggestion-item"
                  :class="{ 'selected': index === typeaheadSelectedIndex }"
                  @click="applySuggestion(suggestion)">
                  {{ suggestion }}
                </div>
              </div>
            </div>
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
    </div>
  </div>
</template>

<style scoped>
.tasks-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
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

.suggestion-item {
  padding: 8px 12px;
  cursor: pointer;
}

.suggestion-item:hover,
.suggestion-item.selected {
  background-color: #f5f7fa;
}
</style> 