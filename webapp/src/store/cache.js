import { defineStore } from 'pinia';

export const useCacheStore = defineStore('cache', {
  state: () => ({
    goals: new Map(),
    tasks: new Map(),
    events: new Map(),
    files: new Map(),
    // Optional: persist cache version to detect app updates
    cacheVersion: '1.0'
  }),
  
  persist: {
    // Use localStorage to persist cache between page reloads
    storage: localStorage,
    paths: ['goals', 'tasks', 'events', 'files', 'cacheVersion']
  },

  actions: {
    setCachedData(type, matterId, data) {
      this[type].set(matterId, {
        data,
        timestamp: Date.now()
      });
    },
    
    getCachedData(type, matterId) {
      const cached = this[type].get(matterId);
      if (!cached) return null;
      
      // Only invalidate cache if:
      // 1. No real-time connection is available
      // 2. Cache is more than 24 hours old (as a fallback)
      const isStale = Date.now() - cached.timestamp > 24 * 60 * 60 * 1000;
      const hasRealtimeConnection = supabase.channel('system').state === 'joined';
      
      if (!hasRealtimeConnection && isStale) {
        this[type].delete(matterId);
        return null;
      }
      
      return cached.data;
    },
    
    updateCachedItem(type, matterId, itemId, newData) {
      const cached = this[type].get(matterId);
      if (!cached) return;
      
      const index = cached.data.findIndex(item => item.id === itemId);
      if (index !== -1) {
        cached.data[index] = newData;
        this.setCachedData(type, matterId, cached.data);
      }
    },
    
    removeCachedItem(type, matterId, itemId) {
      const cached = this[type].get(matterId);
      if (!cached) return;
      
      cached.data = cached.data.filter(item => item.id !== itemId);
      this.setCachedData(type, matterId, cached.data);
    },
    
    clearCache() {
      this.goals.clear();
      this.tasks.clear();
      this.events.clear();
      this.files.clear();
    },

    // Clear cache when app updates
    checkVersion() {
      const currentVersion = '1.0'; // Update this when making breaking changes
      if (this.cacheVersion !== currentVersion) {
        this.clearCache();
        this.cacheVersion = currentVersion;
      }
    }
  }
}); 