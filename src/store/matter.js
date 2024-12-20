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

    async loadMatters() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: ownedMatters, error: ownedError } = await supabase
          .from('matters')
          .select('*')
          .eq('created_by', user.id)
          .order('created_at', { ascending: false });

        if (ownedError) throw ownedError;

        // Get matters shared with the user
        const { data: sharedMatters, error: sharedError } = await supabase
          .from('matters')
          .select('*')
          .in('id', (
            await supabase
              .from('matter_shares')
              .select('matter_id')
              .eq('shared_with_user_id', user.id)
          ).data?.map(share => share.matter_id) || [])
          .order('created_at', { ascending: false });

        if (sharedError) throw sharedError;

        this.matters = [...ownedMatters, ...sharedMatters];
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