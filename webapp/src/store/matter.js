import { defineStore } from 'pinia';
import { supabase } from '../supabase';

export const useMatterStore = defineStore('matter', {
  state: () => ({
    currentMatter: null,
    matters: [],
    loading: false
  }),

  actions: {
    async loadMatters() {
      try {
        this.loading = true;
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
          .from('matters')
          .select('*')
          .eq('created_by', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        this.matters = data;
        
        // Set first matter as current if none selected
        if (!this.currentMatter && data.length > 0) {
          this.setCurrentMatter(data[0]);
        }
      } catch (error) {
        console.error('Error loading matters:', error);
        throw error;
      } finally {
        this.loading = false;
      }
    },

    setCurrentMatter(matter) {
      this.currentMatter = matter;
    }
  },

  getters: {
    getCurrentMatter: (state) => state.currentMatter,
    getMatters: (state) => state.matters
  }
}); 