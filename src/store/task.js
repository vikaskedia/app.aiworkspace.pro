import { defineStore } from 'pinia';
import { supabase } from '../supabase';

export const useTaskStore = defineStore('task', {
  state: () => ({
    tasks: {},
    cacheVersion: '1.0'
  }),

  persist: {
    storage: localStorage,
    paths: ['tasks', 'cacheVersion']
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

    updateCachedTask(matterId, taskId, updates) {
      const cached = this.tasks[matterId];
      if (!cached) return;

      const updatedTasks = cached.data.map(task => 
        task.id === taskId ? { ...task, ...updates } : task
      );
      this.setCachedTasks(matterId, updatedTasks);
    },

    removeCachedTask(matterId, taskId) {
      const cached = this.tasks[matterId];
      if (!cached) return;

      const filteredTasks = cached.data.filter(task => task.id !== taskId);
      this.setCachedTasks(matterId, filteredTasks);
    },

    clearTaskCache(matterId) {
      console.log('clearing task cache');
      if (matterId) {
        delete this.tasks[matterId];
      } else {
        this.tasks = {};
      }
    },

    async fetchAndCacheTasks(matterId, showDeleted = false) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
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
          }, 0) || 0
        }));

        if (!showDeleted) {
          this.setCachedTasks(matterId, transformedTasks);
        }

        return transformedTasks;
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
        const { error } = await supabase
          .from('tasks')
          .update({
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            assignee: task.assignee,
            due_date: task.due_date,
            parent_task_id: task.parent_task_id,
            updated_at: new Date().toISOString()
          })
          .eq('id', task.id);

        if (error) throw error;
        
        // Clear cache for this matter
        this.clearTaskCache(task.matter_id);
        
        return true;
      } catch (error) {
        console.error('Error updating task:', error);
        throw error;
      }
    }
  }
}); 