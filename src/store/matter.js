import { defineStore } from 'pinia';
import { supabase } from '../supabase';

export const useMatterStore = defineStore('matter', {
  state: () => ({
    currentMatter: null,
    matters: []
  }),

  actions: {
    setCurrentMatter(matter) {
      this.currentMatter = matter;
    },

    async loadMatters(includeArchived = false) {
      try {
        // First get all matters
        const query = supabase
          .from('matters')
          .select('*');

        if (!includeArchived) {
          query.eq('archived', false);
        }

        const { data: matters, error } = await query;
        if (error) throw error;

        // Get the latest activity for each matter
        const mattersWithActivity = await Promise.all(
          matters.map(async (matter) => {
            const { data: activities, error: activityError } = await supabase
              .from('workspace_activities')
              .select('updated_at')
              .eq('matter_id', matter.id)
              .order('updated_at', { ascending: false })
              .limit(1);

            const latestActivity = activities?.[0]?.updated_at || matter.created_at;
            
            return {
              ...matter,
              latest_activity: latestActivity
            };
          })
        );

        // Sort by latest activity
        mattersWithActivity.sort((a, b) => {
          const dateA = new Date(a.latest_activity);
          const dateB = new Date(b.latest_activity);
          return dateB - dateA; // Most recent first
        });

        this.matters = mattersWithActivity;
        return this.matters;
      } catch (error) {
        console.error('Error loading matters:', error);
        throw error;
      }
    }
  },

  getters: {
    getCurrentMatter: (state) => state.currentMatter
  }
}); 