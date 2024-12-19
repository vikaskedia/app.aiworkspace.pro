import { defineStore } from 'pinia';

export const useCacheStore = defineStore('cache', {
  state: () => ({
    goals: {},
    tasks: {},
    events: {},
    files: {},
    cacheVersion: '1.0'
  }),
  
  persist: {
    storage: localStorage,
    paths: ['goals', 'tasks', 'events', 'files', 'cacheVersion']
  },

  actions: {
    setCachedData(type, matterId, data) {
      this[type][matterId] = {
        data,
        timestamp: Date.now()
      };
    },
    
    getCachedData(type, matterId) {
      const cached = this[type][matterId];
      if (!cached) return null;
      
      const isStale = Date.now() - cached.timestamp > 24 * 60 * 60 * 1000;
      const hasRealtimeConnection = supabase.channel('system').state === 'joined';
      
      if (!hasRealtimeConnection && isStale) {
        delete this[type][matterId];
        return null;
      }
      
      return cached.data;
    },
    
    updateCachedItem(type, matterId, itemId, newData) {
      const cached = this[type][matterId];
      if (!cached) return;
      
      const index = cached.data.findIndex(item => item.id === itemId);
      if (index !== -1) {
        cached.data[index] = newData;
        this.setCachedData(type, matterId, cached.data);
      }
    },
    
    removeCachedItem(type, matterId, itemId) {
      const cached = this[type][matterId];
      if (!cached) return;
      
      cached.data = cached.data.filter(item => item.id !== itemId);
      this.setCachedData(type, matterId, cached.data);
    },
    
    clearCache() {
      this.goals = {};
      this.tasks = {};
      this.events = {};
      this.files = {};
    },

    checkVersion() {
      const currentVersion = '1.0';
      if (this.cacheVersion !== currentVersion) {
        this.clearCache();
        this.cacheVersion = currentVersion;
      }
    }
  }
}); 