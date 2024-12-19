import { defineStore } from 'pinia';
import { supabase } from '../supabase';

export const useMatterStore = defineStore('matter', {
  state: () => ({
    currentMatter: null
  }),

  actions: {
    setCurrentMatter(matter) {
      this.currentMatter = matter;
    }
  },

  getters: {
    getCurrentMatter: (state) => state.currentMatter
  }
}); 