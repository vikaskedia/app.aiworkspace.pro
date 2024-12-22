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

        // The RLS policies in the database will automatically handle the access control, 
        // so there's no need to explicitly check for ownership or shared access in the application code. 
        //This will also prevent any potential duplicate matters from appearing in the lists.
        const query = supabase
          .from('matters')
          .select('*')
          .order('created_at', { ascending: false });

        if (!includeArchived) {
          query.eq('archived', false);
        }

        const { data: matters, error } = await query;
        if (error) throw error;

        this.matters = matters;
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