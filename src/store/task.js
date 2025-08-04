import { defineStore } from 'pinia';
import { supabase } from '../supabase';

export const useTaskStore = defineStore('task', {
  state: () => ({
    tasks: {},
    taskDetails: {},
    cacheVersion: '1.0'
  }),

  persist: {
    storage: localStorage,
    paths: ['tasks', 'taskDetails', 'cacheVersion']
  },

  actions: {
    setCachedTasks(matterId, tasks) {
      this.tasks[matterId] = {
        data: tasks,
        timestamp: Date.now()
      };
    },

    getCachedTasks(matterId) {
      const cached = this.tasks[matterId];
      if (!cached) return null;

      const isStale = Date.now() - cached.timestamp > 24 * 60 * 60 * 1000;
      if (isStale) {
        delete this.tasks[matterId];
        return null;
      }

      return cached.data;
    },

    setCachedTaskDetail(taskId, taskDetail) {
      this.taskDetails[taskId] = {
        data: taskDetail,
        timestamp: Date.now()
      };
    },

    getCachedTaskDetail(taskId) {
      const cached = this.taskDetails[taskId];
      if (!cached) return null;

      const isStale = Date.now() - cached.timestamp > 60 * 60 * 1000;
      if (isStale) {
        delete this.taskDetails[taskId];
        return null;
      }

      return cached.data;
    },

    updateCachedTaskDetail(taskId, updates) {
      const cached = this.taskDetails[taskId];
      if (!cached) return;

      this.taskDetails[taskId] = {
        data: { ...cached.data, ...updates },
        timestamp: Date.now()
      };
    },

    clearTaskDetailCache(taskId) {
      if (taskId) {
        delete this.taskDetails[taskId];
      } else {
        this.taskDetails = {};
      }
    },

    async fetchAndCacheTaskDetail(taskId) {
      try {
        const { data: task, error: taskError } = await supabase
          .from('tasks')
          .select('*, task_stars(*)')
          .eq('id', taskId)
          .single();

        if (taskError) throw taskError;

        const { data: comments, error: commentsError } = await supabase
          .from('task_comments')
          .select('*')
          .eq('task_id', taskId)
          .order('created_at', { ascending: false });

        if (commentsError) throw commentsError;

        const { data: hoursLogs, error: hoursError } = await supabase
          .from('task_hours_logs')
          .select('*')
          .eq('task_id', taskId)
          .order('created_at', { ascending: false });

        if (hoursError) throw hoursError;

        const taskDetail = {
          task,
          comments: comments || [],
          hoursLogs: hoursLogs?.map(log => ({
            ...log,
            time_taken: log.time_taken ? log.time_taken.substring(0, 5) : null
          })) || []
        };

        this.setCachedTaskDetail(taskId, taskDetail);

        return taskDetail;
      } catch (error) {
        console.error('Error fetching task detail:', error);
        throw error;
      }
    },

    updateCachedTask(matterId, taskId, updates) {
      const cached = this.tasks[matterId];
      if (!cached) return;

      const updatedTasks = cached.data.map(task => 
        task.id === taskId ? { ...task, ...updates } : task
      );
      this.setCachedTasks(matterId, updatedTasks);

      this.updateCachedTaskDetail(taskId, updates);
    },

    removeCachedTask(matterId, taskId) {
      const cached = this.tasks[matterId];
      if (!cached) return;

      const filteredTasks = cached.data.filter(task => task.id !== taskId);
      this.setCachedTasks(matterId, filteredTasks);

      this.clearTaskDetailCache(taskId);
    },

    clearTaskCache(matterId) {
      console.log('clearing task cache');
      if (matterId) {
        delete this.tasks[matterId];
      } else {
        this.tasks = {};
      }
    },

    async fetchChildWorkspaceTasks(matterId, showDeleted = false) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        // First, get all child workspaces where current_workspace_id = matterId
        const { data: childWorkspaces, error: childWorkspacesError } = await supabase
          .from('workspaces')
          .select('id, title')
          .eq('parent_workspace_id', matterId)
          .eq('archived', false);

        if (childWorkspacesError) throw childWorkspacesError;

        if (!childWorkspaces || childWorkspaces.length === 0) {
          return [];
        }

        const childWorkspaceIds = childWorkspaces.map(workspace => workspace.id);

        // Get tasks from all child workspaces
        let query = supabase
          .from('tasks')
          .select(`
            *,
            task_stars (
              user_id
            ),
            task_hours_logs (
              time_taken
            )
          `)
          .in('matter_id', childWorkspaceIds);

        if (!showDeleted) {
          query = query.eq('deleted', false);
        }

        const { data: tasks, error } = await query;
        if (error) throw error;

        const transformedTasks = tasks.map(task => ({
          ...task,
          starred: Boolean(task.task_stars?.length),
          total_hours: task.task_hours_logs?.reduce((sum, log) => {
            if (!log.time_taken) return sum;
            const [hours, minutes, seconds] = log.time_taken.split(':').map(Number);
            const totalHours = hours + minutes/60 + seconds/3600;
            return sum + totalHours;
          }, 0) || 0,
          // Add workspace information to identify which workspace the task belongs to
          workspace_title: childWorkspaces.find(w => w.id === task.matter_id)?.title || 'Unknown Workspace'
        }));

        return transformedTasks;
      } catch (error) {
        console.error('Error fetching child workspace tasks:', error);
        throw error;
      }
    },

    async fetchAndCacheTasks(matterId, showDeleted = false) {
      try {
        const { data: { user } } = await supabase.auth.getUser();


        // get current workspace id
        const { data: currentWorkspace, error: currentWorkspaceError } = await supabase
          .from('workspaces')
          .select('id, title')
          .eq('id', matterId)
          .single();

        if (currentWorkspaceError) throw currentWorkspaceError;

          
        
        let query = supabase
          .from('tasks')
          .select(`
            *,
            task_stars (
              user_id
            ),
            task_hours_logs (
              time_taken
            )
          `)
          .eq('matter_id', matterId);

        if (!showDeleted) {
          query = query.eq('deleted', false);
        }

        const { data: tasks, error } = await query;
        if (error) throw error;

        const transformedTasks = tasks.map(task => ({
          ...task,
          starred: Boolean(task.task_stars?.length),
          total_hours: task.task_hours_logs?.reduce((sum, log) => {
            if (!log.time_taken) return sum;
            const [hours, minutes, seconds] = log.time_taken.split(':').map(Number);
            const totalHours = hours + minutes/60 + seconds/3600;
            return sum + totalHours;
          }, 0) || 0,
          workspace_title: currentWorkspace.title || 'Unknown Workspace'
        }));

        // Fetch child workspace tasks
        const childWorkspaceTasks = await this.fetchChildWorkspaceTasks(matterId, showDeleted);

        // Combine parent workspace tasks with child workspace tasks
        const allTasks = [...transformedTasks, ...childWorkspaceTasks];

        if (!showDeleted) {
          this.setCachedTasks(matterId, allTasks);
        }

        return allTasks;
      } catch (error) {
        console.error('Error fetching tasks:', error);
        throw error;
      }
    },

    getAllCachedTasks() {
      const allTasks = [];
      for (const matterId in this.tasks) {
        const matterTasks = this.getCachedTasks(matterId);
        if (matterTasks) {
          allTasks.push(...matterTasks);
        }
      }
      return allTasks.length > 0 ? allTasks : null;
    },

    clearAllTasksCache() {
      console.log('clearing all tasks cache');
      this.tasks = {};
      this.taskDetails = {};
    },

    async getTaskById(taskId) {
      try {
        const { data: task, error } = await supabase
          .from('tasks')
          .select(`
            *,
            task_stars(*),
            task_hours_logs(*)
          `)
          .eq('id', taskId)
          .single();

        if (error) throw error;
        return task;
      } catch (error) {
        console.error('Error fetching task:', error);
        throw error;
      }
    },

    async updateTask(task) {
      try {
        const { data, error } = await supabase
          .from('tasks')
          .update({
            title: task.title,
            status: task.status,
            assignee: task.assignee,
            priority: task.priority,
            due_date: task.due_date,
            parent_task_id: task.parent_task_id,
            updated_at: new Date().toISOString()
          })
          .eq('id', task.id)
          .select();

        if (error) throw error;
        
        this.clearAllTasksCache();
        
        return data[0];
      } catch (error) {
        console.error('Error updating task:', error);
        throw error;
      }
    }
  }
}); 