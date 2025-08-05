import { defineStore } from 'pinia';
import { supabase } from '../supabase';

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
    setCachedData(type, workspaceId, data) {
      this[type][workspaceId] = {
        data,
        timestamp: Date.now()
      };
    },
    
    getCachedData(type, workspaceId) {
      const cached = this[type][workspaceId];
      if (!cached) return null;
      
      const isStale = Date.now() - cached.timestamp > 24 * 60 * 60 * 1000;
      
      const channel = supabase.channel('system');
      const hasRealtimeConnection = channel.state === 'joined';
      
      if (!hasRealtimeConnection && isStale) {
        delete this[type][workspaceId];
        return null;
      }
      
      return cached.data;
    },
    
    updateCachedItem(type, workspaceId, itemId, newData) {
      const cached = this[type][workspaceId];
      if (!cached) return;
      
      const index = cached.data.findIndex(item => item.id === itemId);
      if (index !== -1) {
        cached.data[index] = newData;
        this.setCachedData(type, workspaceId, cached.data);
      }
    },
    
    removeCachedItem(type, workspaceId, itemId) {
      const cached = this[type][workspaceId];
      if (!cached) return;
      
      cached.data = cached.data.filter(item => item.id !== itemId);
      this.setCachedData(type, workspaceId, cached.data);
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