<script>
import { supabase } from '../supabase';
import { ElDropdown, ElDropdownMenu, ElDropdownItem, ElAvatar, ElDialog } from 'element-plus';
import { CaretBottom } from '@element-plus/icons-vue';
import MatterSelector from './MatterSelector.vue';
import { useMatterStore } from '../store/matter';
import { useCacheStore } from '../store/cache';
import { ref } from 'vue';

export default {
  components: {
    ElDropdown,
    ElDropdownMenu,
    ElDropdownItem,
    ElAvatar,
    CaretBottom,
    MatterSelector,
    ElDialog
  },
  data: function () {
    return {
      user: null,
      notifications: [],
      unreadCount: 0,
      subscription: null,
      showNotificationsDialog: false,
      userEmails: {},
      loading: false
    };
  },
  computed: {
    displayName() {
      if (!this.user) return '';
      return this.user.user_metadata?.name || 
             this.user.user_metadata?.user_name || 
             this.user.user_metadata?.full_name ||
             this.user.email;
    },
    currentSection() {
      const path = this.$route.path;
      if (path.includes('/goals')) return 'Goals';
      if (path.includes('/tasks')) return 'Tasks';
      if (path.includes('/events')) return 'Events';
      if (path.includes('/files')) return 'Files';
      if (path.includes('/settings')) return 'Settings';
      if (path.includes('/dashboard')) return 'Dashboard';
      if (path.includes('/all-matters')) {
        if (path.endsWith('/tasks')) return 'All Tasks';
        if (path.endsWith('/goals')) return 'All Goals';
        if (path.endsWith('/events')) return 'All Events';
        if (path.endsWith('/files')) return 'All Files';
        if (path.includes('/settings')) return 'All Matter Settings';
        return 'All Matters';
      }
      return 'Dashboard';
    },
    currentMatter() {
      const matterStore = useMatterStore();
      return matterStore.currentMatter;
    }
  },
  async mounted() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (session) {
      this.user = session.user;
    } else if (error) {
      console.error('Error fetching session:', error.message);
    }
    this.loadNotifications();
    this.setupRealtimeSubscription();
  },
  beforeUnmount() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  },
  methods: {
    async handleLogout() {
      try {
        const { error } = await supabase.auth.signOut();
        if (error) {
          console.error('Error logging out:', error.message);
        } else {
          this.$router.push('/login');
        }
      } catch (err) {
        console.error('Unexpected error during logout:', err);
      }
    },
    async handleCommand(command) {
      switch(command) {
        case 'feedback':
          // TODO: Implement feedback route
          break;
        case 'logout':
          await this.handleLogout();
          break;
        case 'notifications':
          // Show notifications dialog
          this.showNotificationsDialog = true;
          break;
      }
    },
    handleMatterSelect(matter) {
      const matterStore = useMatterStore();
      matterStore.setCurrentMatter(matter);
      
      // Get the current route path segments
      const currentPath = this.$route.path;
      const segments = currentPath.split('/');
      
      // If we're in a sub-route (goals, tasks, etc.), preserve it
      if (segments.length > 3) {
        const subRoute = segments[3]; // 'goals', 'tasks', etc.
        this.$router.push(`/single-matter/${matter.id}/${subRoute}`);
      } else {
        this.$router.push(`/single-matter/${matter.id}`);
      }
    },
    handleMatterCommand(command) {
      const matterStore = useMatterStore();
      
      if (this.currentMatter?.id) {
        switch(command) {
          case 'dashboard':
            this.$router.push(`/single-matter/${this.currentMatter.id}/dashboard`);
            break;
          case 'goals':
            this.$router.push(`/single-matter/${this.currentMatter.id}/goals`);
            break;
          case 'tasks':
            this.$router.push(`/single-matter/${this.currentMatter.id}/tasks`);
            break;
          case 'events':
            this.$router.push(`/single-matter/${this.currentMatter.id}/events`);
            break;
          case 'files':
            this.$router.push(`/single-matter/${this.currentMatter.id}/files`);
            break;
          case 'settings':
            this.$router.push(`/single-matter/${this.currentMatter.id}/settings`);
            break;
        }
      } else {
        // Clear current matter when navigating to "All" views
        matterStore.setCurrentMatter(null);
        
        switch(command) {
          case 'all_dashboard':
            this.$router.push('/all-matters/dashboard');
            break;
          case 'all_tasks':
            this.$router.push('/all-matters/tasks');
            break;
          case 'all_goals':
            this.$router.push('/all-matters/goals');
            break;
          case 'all_events':
            this.$router.push('/all-matters/events');
            break;
          case 'all_files':
            this.$router.push('/all-matters/files');
            break;
          case 'all_settings':
            this.$router.push('/all-matters/settings');
            break;

        }
      }
    },
    async loadNotifications() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        const { data: notifications, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) throw error;

        this.notifications = notifications;
        this.unreadCount = notifications.filter(n => !n.read).length;
      } catch (error) {
        ElMessage.error('Error loading notifications: ' + error.message);
      }
    },
    setupRealtimeSubscription() {
      // Copy the subscription setup from NotificationsCt.vue
      // Lines 61-90 from NotificationsCt.vue
    },
    getNotificationText(notification) {
      const actorEmail = this.userEmails[notification.actor_id] || 'Someone';
      switch (notification.type) {
        case 'task_assigned':
          return `${actorEmail} assigned you a task: ${notification.data.task_title}`;
        case 'task_created':
          return `${actorEmail} created a new task: ${notification.data.task_title}`;
        case 'task_updated':
          return `${actorEmail} updated task: ${notification.data.task_title}`;
        case 'matter_shared':
          return `${actorEmail} shared a matter with you: ${notification.data.matter_title}`;
        case 'mention':
          return `${notification.metadata.comment_by} mentioned you in task: ${notification.metadata.task_title}`;
        default:
          return 'New notification';
      }
    },
    async markAsRead(notification) {
      try {
        const { error } = await supabase
          .from('notifications')
          .update({ read: true })
          .eq('id', notification.id);

        if (error) throw error;

        const index = this.notifications.findIndex(n => n.id === notification.id);
        if (index !== -1) {
          this.notifications[index].read = true;
          this.unreadCount = Math.max(0, this.unreadCount - 1);
        }
      } catch (error) {
        ElMessage.error('Error marking notification as read: ' + error.message);
      }
    }
  },
  emits: ['logo-click']
};
</script>

<template>
  <header class="site-header">
    <div class="header-left">
      <img 
        src="/associate-ai-attorney-logo.svg" 
        alt="Logo" 
        class="logo-image clickable"
        @click="$emit('logo-click')" 
      />
      <h1>Legal Studio</h1>
    </div>
    
    <div class="header-center">
      <MatterSelector @matter-selected="handleMatterSelect" />
      <span class="section-divider">/</span>
      <el-dropdown trigger="click" @command="handleMatterCommand">
        <span class="current-section clickable">
          {{ currentSection }}
          <el-icon class="dropdown-icon"><caret-bottom /></el-icon>
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <!-- Show these options when a specific matter is selected -->
            <template v-if="currentMatter">
              <el-dropdown-item command="dashboard">Dashboard</el-dropdown-item>
              <el-dropdown-item command="goals">Goals</el-dropdown-item>
              <el-dropdown-item command="tasks">Tasks</el-dropdown-item>
              <el-dropdown-item command="events">Events</el-dropdown-item>
              <el-dropdown-item command="files">Files</el-dropdown-item>
              <el-dropdown-item command="settings">Settings</el-dropdown-item>
            </template>
            <!-- Show these options when "All Matters" is selected -->
            <template v-else>
              <el-dropdown-item command="all_dashboard">Dashboard</el-dropdown-item>
              <el-dropdown-item command="all_tasks">Tasks</el-dropdown-item>
              <el-dropdown-item command="all_goals">Goals</el-dropdown-item>
              <el-dropdown-item command="all_events">Events</el-dropdown-item>
              <el-dropdown-item command="all_files">Files</el-dropdown-item>
              <el-dropdown-item command="all_settings">Settings</el-dropdown-item>
            </template>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
    
    <div class="header-right" v-if="user">
      <el-dropdown @command="handleCommand" trigger="hover">
        <div class="user-profile">
          <span class="user-name">{{ displayName }}</span>
          <el-badge :value="unreadCount" :hidden="unreadCount === 0">
            <el-avatar 
              :size="40"
              :src="user.user_metadata?.avatar_url"
              :icon="!user.user_metadata?.avatar_url ? 'UserFilled' : undefined"
            />
          </el-badge>
          <el-icon class="dropdown-icon"><caret-bottom /></el-icon>
        </div>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="notifications">
              Notifications
              <el-badge 
                :value="unreadCount" 
                :hidden="unreadCount === 0" 
                class="notification-badge" />
            </el-dropdown-item>
            <el-dropdown-item command="feedback">Feedback</el-dropdown-item>
            <el-dropdown-item divided command="logout">Logout</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </header>
  <el-dialog
    v-model="showNotificationsDialog"
    title="Notifications"
    width="500px"
    :close-on-click-modal="true"
    :close-on-press-escape="true"
  >
    <div class="notifications-container">
      <div v-if="loading" class="loading-state">
        <el-skeleton :rows="3" animated />
      </div>
      <template v-else>
        <div v-if="notifications.length === 0" class="empty-state">
          No notifications
        </div>
        <div
          v-else
          v-for="notification in notifications"
          :key="notification.id"
          :class="['notification-item', { unread: !notification.read }]"
          @click="markAsRead(notification)"
        >
          <div class="notification-content">
            <p>{{ getNotificationText(notification) }}</p>
            <span class="notification-time">
              {{ new Date(notification.created_at).toLocaleString() }}
            </span>
          </div>
        </div>
      </template>
    </div>
  </el-dialog>
</template>

<style scoped>
.site-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.8rem 2rem;
  background: white;
  color: #1a1a1a;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  position: sticky;
  top: 0;
  z-index: 100;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.logo-image {
  height: 40px;
  width: auto;
  background-color: white;
  padding: 6px;
  border-radius: 8px;
}

.header-left h1 {
  font-weight: 500;
  font-size: 1.4rem;
  letter-spacing: -0.02em;
  margin: 0;
  color: #1a1a1a;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-profile {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 8px;
  transition: background-color 0.2s;
}

.user-profile:hover {
  background-color: rgba(0, 0, 0, 0.03);
}

.user-name {
  color: #1a1a1a;
  font-size: 0.9rem;
  font-weight: 450;
}

.dropdown-icon {
  color: #666;
  font-size: 12px;
}

/* Responsive styles */
@media (max-width: 640px) {
  .site-header {
    padding: 0.8rem 1rem;
  }

  .header-left h1 {
    display: none;
  }

  .user-name {
    display: none;
  }
}

/* Add styles for the avatar */
:deep(.el-avatar) {
  border: 2px solid rgba(255, 255, 255, 0.6);
  box-sizing: border-box;
}

/* Override Element Plus dropdown styles */
:deep(.el-dropdown) {
  border: none !important;
  outline: none !important;
}

:deep(.el-dropdown:hover),
:deep(.el-dropdown:focus),
:deep(.el-dropdown:active) {
  outline: none !important;
  border: none !important;
}

:deep(.el-dropdown-menu) {
  font-family: 'Open Sans', sans-serif !important;
}

:deep(.el-dropdown-menu__item) {
  font-family: 'Open Sans', sans-serif !important;
  font-size: 0.9rem;
}

/* Add to existing styles */
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

@media (max-width: 640px) {
  :deep(.el-dialog) {
    width: 90% !important;
  }
  
  .dialog-footer {
    flex-direction: column;
    gap: 8px;
  }
  
  .dialog-footer .el-button {
    width: 100%;
  }
}

/* Add these styles */
.header-center {
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-divider {
  color: #909399;
  font-size: 16px;
}

.current-section {
  color: #606266;
  font-size: 14px;
  font-weight: 500;
}

@media (max-width: 640px) {
  .current-section {
    display: none;
  }
}

.current-section.clickable {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.current-section.clickable:hover {
  background-color: rgba(0, 0, 0, 0.03);
}

.current-section .dropdown-icon {
  font-size: 12px;
  color: #909399;
}

.notification-badge {
  margin-left: 8px;
}

:deep(.el-badge__content) {
  z-index: 1;
}

:deep(.el-badge) {
  line-height: 1;
}

.notifications-container {
  max-height: 400px;
  overflow-y: auto;
}

.notification-item {
  padding: 12px;
  margin: 8px 0;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
  border-bottom: 1px solid #ebeef5;
}

.notification-item.unread {
  background-color: #ecf5ff;
  border-left: 3px solid #409EFF;
}

.notification-item:hover {
  background-color: #f5f7fa;
}

.notification-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.notification-content p {
  margin: 0;
  color: #303133;
  font-size: 0.9em;
  line-height: 1.4;
}

.notification-time {
  font-size: 0.8em;
  color: #909399;
}

.empty-state {
  text-align: center;
  color: #909399;
  padding: 16px;
}
</style>
