import { defineStore } from 'pinia';
import { supabase } from '../supabase';

export const useMatterStore = defineStore('workspace', {
  state: () => ({
    currentMatter: null,
    workspaces: []
  }),

  actions: {
    setCurrentMatter(workspace) {
      this.currentMatter = workspace;
    },

    async loadMatters(includeArchived = false) {
      try {
        // First get all workspaces
        const query = supabase
          .from('workspaces')
          .select('*');

        if (!includeArchived) {
          query.eq('archived', false);
        }

        const { data: workspaces, error } = await query;
        if (error) throw error;

        // Get the latest activity for each workspace
        const workspacesWithActivity = await Promise.all(
          workspaces.map(async (workspace) => {
            const { data: activities, error: activityError } = await supabase
              .from('workspace_activities')
              .select('updated_at')
              .eq('matter_id', workspace.id)
              .order('updated_at', { ascending: false })
              .limit(1);

            const latestActivity = activities?.[0]?.updated_at || workspace.created_at;
            
            return {
              ...workspace,
              latest_activity: latestActivity
            };
          })
        );

        // Sort by latest activity
        workspacesWithActivity.sort((a, b) => {
          const dateA = new Date(a.latest_activity);
          const dateB = new Date(b.latest_activity);
          return dateB - dateA; // Most recent first
        });

        this.workspaces = workspacesWithActivity;
        return this.workspaces;
      } catch (error) {
        console.error('Error loading workspaces:', error);
        throw error;
      }
    }
  },

  getters: {
    getCurrentMatter: (state) => state.currentMatter
  }
}); 