import { defineStore } from 'pinia';
import { supabase } from '../supabase';

export const useUserStore = defineStore('user', {
  state: () => ({
    users: {},
    cacheVersion: '1.0'
  }),

  persist: {
    storage: localStorage,
    paths: ['users', 'cacheVersion']
  },

  actions: {
    setCachedUser(userId, userData) {
      this.users[userId] = {
        data: userData,
        timestamp: Date.now()
      };
    },

    getCachedUser(userId) {
      const cached = this.users[userId];
      if (!cached) return null;

      const isStale = Date.now() - cached.timestamp > 24 * 60 * 60 * 1000; // 24 hours
      if (isStale) {
        delete this.users[userId];
        return null;
      }

      return cached.data;
    },

    async fetchAndCacheUser(userId) {
      try {
        const { data: userData, error } = await supabase
          .rpc('get_user_full_info_by_id', {
            user_id: userId
          });

        if (error) throw error;

        if (userData?.[0]) {
          const user = {
            id: userId,
            email: userData[0].email,
            fullName: userData[0].full_name,
            username: userData[0].username || userData[0].email.split('@')[0],
            avatarUrl: userData[0].avatar_url
          };

          this.setCachedUser(userId, user);
          return user;
        }

        return null;
      } catch (error) {
        console.error('Error fetching user:', error);
        throw error;
      }
    },

    async getUserInfo(userId) {
      if (!userId) return null;

      try {
        // Try to get from cache first
        const cachedUser = this.getCachedUser(userId);
        if (cachedUser) {
          return cachedUser;
        }

        // If not in cache, fetch from API
        return await this.fetchAndCacheUser(userId);
      } catch (error) {
        console.error('Error getting user info:', error);
        return null;
      }
    },

    clearUserCache(userId) {
      if (userId) {
        delete this.users[userId];
      } else {
        this.users = {};
      }
    }
  }
}); 