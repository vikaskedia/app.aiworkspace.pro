<script>
import { supabase } from '../supabase';
import { ElDropdown, ElDropdownMenu, ElDropdownItem, ElAvatar, ElDialog, ElMessage, ElAlert, ElButton } from 'element-plus';
import { CaretBottom } from '@element-plus/icons-vue';
import WorkspaceSelector from './WorkspaceSelector.vue';
import { useWorkspaceStore } from '../store/workspace';
import { useCacheStore } from '../store/cache';
import { ref } from 'vue';
import { MP } from '../mixpanel';

export default {
  components: {
    ElDropdown,
    ElDropdownMenu,
    ElDropdownItem,
    ElAvatar,
    CaretBottom,
    WorkspaceSelector,
    ElDialog,
    ElAlert,
    ElButton
  },
  data: function () {
    return {
      user: null,
      notifications: [],
      unreadCount: 0,
      subscription: null,
      showNotificationsDialog: false,
      userEmails: {},
      loading: false,
      commitHash: __SHORT_COMMIT_HASH__,
      fullCommitHash: __COMMIT_HASH__,
      showUpdateAlert: false,
      latestCommitHash: null,
      versionCheckInterval: null,
      checkingVersion: false
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
      if (path.includes('/outlines')) return 'Outlines';
      if (path.includes('/contacts')) return 'Contacts';
      if (path.includes('/communications')) return 'Communications';
      if (path.includes('/canvas')) return 'Canvas';
      if (path.includes('/ai_phone')) return 'AI Phone';
      if (path.includes('/ai_intake')) return 'AI Intake';
      if (path.includes('/ai_fax')) return 'AI Fax';
      if (path.includes('/ai_portfolio')) return 'AI Portfolios';
      if (path.includes('/ai_fund_analyst')) return 'AI Fund Analyst';
      if (path.includes('/settings')) return 'Settings';
      if (path.includes('/dashboard')) return 'Dashboard';
      if (path.includes('/all-workspace')) {
        if (path.endsWith('/tasks')) return 'All Tasks';
        if (path.endsWith('/goals')) return 'All Goals';
        if (path.endsWith('/events')) return 'All Events';
        if (path.endsWith('/files')) return 'All Files';
        if (path.endsWith('/contacts')) return 'All Contacts';
        if (path.includes('/settings')) return 'All Workspace Settings';
        return 'All Workspaces';
      }
      return 'Dashboard';
    },
    currentWorkspace() {
      const workspaceStore = useWorkspaceStore();
      return workspaceStore.currentWorkspace;
    },
    hasQuickActions() {
      const path = this.$route.path;
      return path.includes('/tasks') || 
            path.includes('/files') || 
            path.includes('/goals') ||
            path.includes('/events');
    },
    isTalkToDevRoute() {
      return this.$route.path.includes('/talk-to-dev')
    },
    isInitialConsultationRoute() {
      return this.$route.path.includes('/initial-consultation')
    },
    isActivityLogRoute() {
      return this.$route.path.includes('/all-workspace/activity-log')
    },
    isAIAttorneyRoute() {
      return this.$route.path.includes('/ai-attorney')
    },
    isAICasesRoute() {
      return this.$route.path.includes('/cases')
    },
    isReferralSystemRoute() {
      return this.$route.path.includes('/referral-system')
    },
    isBillingRoute() {
      return this.$route.path.includes('/billing')
    },
    isProfileRoute() {
      return this.$route.path.includes('/profile')
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
    this.checkForUpdates();
    this.startVersionChecking();
  },
  beforeUnmount() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    if (this.versionCheckInterval) {
      clearInterval(this.versionCheckInterval);
    }
  },
  methods: {
    async handleLogout() {
      try {
        const { error } = await supabase.auth.signOut();
        if (error) {
          MP.track('Logout Failed', {
            error: error.message
          });
          console.error('Error logging out:', error.message);
        } else {
          MP.track('User Logout');
          this.$router.push('/login');
        }
      } catch (err) {
        MP.track('Logout Failed', {
          error: err.message
        });
        console.error('Unexpected error during logout:', err);
      }
    },
    async handleCommand(command) {
      switch(command) {
        case 'feedback':
          // TODO: Implement feedback route
          break;
        case 'activity_log':
          this.$router.push('/all-workspace/activity-log');
          break;
        case 'logout':
          await this.handleLogout();
          break;
        case 'notifications':
          // Show notifications dialog
          this.showNotificationsDialog = true;
          break;
        case 'email_notifications':
          // Navigate to email notifications settings
          this.$router.push('/settings/email-notifications');
          break;
        case 'billing':
          this.$router.push('/billing');
          break;
        case 'profile':
          this.$router.push('/profile');
          break;
        case 'talktodev':
          // TODO: Implement talk to dev route
          this.$router.push('/talk-to-dev');
          break;
        case 'ai_attorney':
          this.$router.push('/ai-attorney');
          break;
        case 'initial_consultation':
          this.$router.push('/initial-consultation')
          break
        case 'all_workspace':
          this.$router.push('/all-workspace');
          break;
        case 'cases':
          this.$router.push('/cases');
          break;
        case 'referral_system':
          this.$router.push('/referral-system');
          break
      }
    },
    handleWorkspaceSelect(workspace) {
      const workspaceStore = useWorkspaceStore();
      workspaceStore.setCurrentWorkspace(workspace);
      
      // Get the current route path segments
      const currentPath = this.$route.path;
      const segments = currentPath.split('/');

      // If we're in a sub-route (goals, tasks, etc.), preserve it
      if (segments.length > 3) {
        const subRoute = segments[3]; // 'goals', 'tasks', etc.
        //this.$router.push(`/single-workspace/${workspace.id}/${subRoute}`);
      } else {
        this.$router.push(`/single-workspace/${workspace.id}`);
      }
    },
    handleWorkspaceCommand(command) {
      const workspaceStore = useWorkspaceStore();
      
      if (this.currentWorkspace?.id) {
        switch(command) {
          case 'dashboard':
            this.$router.push(`/single-workspace/${this.currentWorkspace.id}/dashboard`);
            break;
          case 'goals':
            this.$router.push(`/single-workspace/${this.currentWorkspace.id}/goals`);
            break;
          case 'tasks':
            this.$router.push(`/single-workspace/${this.currentWorkspace.id}/tasks`);
            break;
          case 'events':
            this.$router.push(`/single-workspace/${this.currentWorkspace.id}/events`);
            break;
          case 'files':
            this.$router.push(`/single-workspace/${this.currentWorkspace.id}/files`);
            break;
          case 'outlines':
            this.$router.push(`/single-workspace/${this.currentWorkspace.id}/outlines`);
            break;
          case 'contacts':
            this.$router.push(`/single-workspace/${this.currentWorkspace.id}/contacts`);
            break;
          case 'communications':
            this.$router.push(`/single-workspace/${this.currentWorkspace.id}/communications`);
            break;
          case 'ai_phone':
            this.$router.push(`/single-workspace/${this.currentWorkspace.id}/ai_phone`);
            break;
          case 'ai_intake':
            this.$router.push(`/single-workspace/${this.currentWorkspace.id}/ai_intake`);
            break;
          case 'ai_fax':
            this.$router.push(`/single-workspace/${this.currentWorkspace.id}/ai_fax`);
            break;
          case 'ai_portfolio':
            this.$router.push(`/single-workspace/${this.currentWorkspace.id}/ai_portfolio`);
            break;
          case 'ai_fund_analyst':
            this.$router.push(`/single-workspace/${this.currentWorkspace.id}/ai_fund_analyst`);
            break;
          case 'settings':
            this.$router.push(`/single-workspace/${this.currentWorkspace.id}/settings`);
            break;
        }
      } else {
        // Clear current workspace when navigating to "All" views
        workspaceStore.setCurrentWorkspace(null);
        
        switch(command) {
          case 'all_dashboard':
            this.$router.push('/all-workspace/dashboard');
            break;
          case 'all_tasks':
            this.$router.push('/all-workspace/tasks');
            break;
          case 'all_goals':
            this.$router.push('/all-workspace/goals');
            break;
          case 'all_events':
            this.$router.push('/all-workspace/events');
            break;
          case 'all_files':
            this.$router.push('/all-workspace/files');
            break;
          case 'all_contacts':
            this.$router.push('/all-workspace/contacts');
            break;
          case 'all_settings':
            this.$router.push('/all-workspace/settings');
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
        case 'workspace_shared':
          return `${actorEmail} shared a workspace with you: ${notification.data.workspace_title}`;
        case 'mention':
          return `${notification.data.comment_by} mentioned you in task: ${notification.data.task_title}`;
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
    },
    async copyCommitHash() {
      try {
        await navigator.clipboard.writeText(this.fullCommitHash);
        ElMessage.success('Commit hash copied to clipboard!');
      } catch (error) {
        console.error('Failed to copy commit hash:', error);
        ElMessage.error('Failed to copy commit hash');
      }
    },
    async checkForUpdates() {
      if (this.checkingVersion) return;
      
      this.checkingVersion = true;
      try {
        // Add cache busting parameter to ensure we get the latest version
        const cacheBuster = Date.now();
        const response = await fetch(`/version.json?t=${cacheBuster}`);
        if (!response.ok) {
          throw new Error('Failed to fetch version info');
        }
        
        const versionData = await response.json();
        this.latestCommitHash = versionData.fullCommitHash;
        
        // Compare current hash with latest hash
        if (this.fullCommitHash !== this.latestCommitHash) {
          this.showUpdateAlert = true;
          MP.track('Version Mismatch Detected', {
            currentVersion: this.fullCommitHash,
            latestVersion: this.latestCommitHash,
            serverBuildTime: versionData.buildTime
          });
        }
      } catch (error) {
        console.error('Error checking for updates:', error);
        // Silently fail version checks to not disturb user experience
      } finally {
        this.checkingVersion = false;
      }
    },
    startVersionChecking() {
      // Check for updates every 30 seconds
      this.versionCheckInterval = setInterval(() => {
        this.checkForUpdates();
      }, 30 * 1000); // 30 seconds
    },
    reloadPage() {
      MP.track('User Reloaded for Update', {
        currentVersion: this.fullCommitHash,
        latestVersion: this.latestCommitHash
      });
      window.location.reload();
    },
    dismissUpdateAlert() {
      this.showUpdateAlert = false;
      MP.track('Update Alert Dismissed', {
        currentVersion: this.fullCommitHash,
        latestVersion: this.latestCommitHash
      });
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
        :class="['logo-image', { clickable: hasQuickActions }]"
        @click="hasQuickActions && $emit('logo-click')" 
      />
      <h1>AI Workspace</h1>
    </div>
    
    <div class="header-center">
      <template v-if="isTalkToDevRoute">
        <h2 class="section-title">Talk to Dev</h2>
      </template>
      <template v-else-if="isInitialConsultationRoute">
        <h2 class="section-title">Initial Consultation</h2>
      </template>
      <template v-else-if="isActivityLogRoute">
        <h2 class="section-title">Activity Log</h2>
      </template>
      <template v-else-if="isAIAttorneyRoute">
        <h2 class="section-title">AI Attorney</h2>
      </template>
      <template v-else-if="isAICasesRoute">
        <h2 class="section-title">Cases</h2>
      </template>
      <template v-else-if="isReferralSystemRoute">
        <h2 class="section-title">Referral System</h2>
      </template>
      <template v-else-if="isBillingRoute">
        <h2 class="section-title">Billing</h2>
      </template>
      <template v-else-if="isProfileRoute">
        <h2 class="section-title">Edit Profile</h2>
      </template>
      <template v-else>
        <WorkspaceSelector @workspace-selected="handleWorkspaceSelect" />
        <span class="section-divider">/</span>
        <el-dropdown trigger="click" @command="handleWorkspaceCommand">
          <span class="current-section clickable">
            {{ currentSection }}
            <el-icon class="dropdown-icon"><caret-bottom /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <!-- Show these options when a specific workspace is selected -->
              <template v-if="currentWorkspace">
                <el-dropdown-item><a :href="`/single-workspace/${currentWorkspace.id}/dashboard`">Dashboard</a></el-dropdown-item>
                <el-dropdown-item><a :href="`/single-workspace/${currentWorkspace.id}/goals`">Goals</a></el-dropdown-item>
                <el-dropdown-item><a :href="`/single-workspace/${currentWorkspace.id}/tasks`">Tasks</a></el-dropdown-item>
                <el-dropdown-item><a :href="`/single-workspace/${currentWorkspace.id}/events`">Events</a></el-dropdown-item>
                <el-dropdown-item><a :href="`/single-workspace/${currentWorkspace.id}/files`">Files</a></el-dropdown-item>
                <el-dropdown-item :class="{ 'is-active': $route.path.includes('/outlines') }">
                  <a :href="`/single-workspace/${currentWorkspace.id}/outlines`">Outlines</a>
                </el-dropdown-item>
                <el-dropdown-item><a :href="`/single-workspace/${currentWorkspace.id}/communications`">Communications</a></el-dropdown-item>
                <el-dropdown-item :class="{ 'is-active': $route.path.includes('/canvas') }"><a :href="`/single-workspace/${currentWorkspace.id}/canvas`">Canvas</a></el-dropdown-item>
                <el-dropdown-item><a :href="`/single-workspace/${currentWorkspace.id}/ai_phone`">AI Phone</a></el-dropdown-item>
                <el-dropdown-item><a :href="`/single-workspace/${currentWorkspace.id}/ai_intake`">AI Intake</a></el-dropdown-item>
                <el-dropdown-item><a :href="`/single-workspace/${currentWorkspace.id}/ai_fax`">AI Fax</a></el-dropdown-item>
                <el-dropdown-item><a :href="`/single-workspace/${currentWorkspace.id}/ai_portfolio`">AI Portfolios</a></el-dropdown-item>
                <el-dropdown-item><a :href="`/single-workspace/${currentWorkspace.id}/ai_fund_analyst`">AI Fund Analyst</a></el-dropdown-item>
                <el-dropdown-item><a :href="`/single-workspace/${currentWorkspace.id}/contacts`">Contacts</a></el-dropdown-item>
                <el-dropdown-item><a :href="`/single-workspace/${currentWorkspace.id}/settings`">Settings</a></el-dropdown-item>
              </template>
              <!-- Show these options when "All Workspaces" is selected -->
              <template v-else>
                <el-dropdown-item><a href="/all-workspace/dashboard">Dashboard</a></el-dropdown-item>
                <el-dropdown-item><a href="/all-workspace/tasks">Tasks</a></el-dropdown-item>
                <el-dropdown-item><a href="/all-workspace/goals">Goals</a></el-dropdown-item>
                <el-dropdown-item><a href="/all-workspace/events">Events</a></el-dropdown-item>
                <el-dropdown-item><a href="/all-workspace/files">Files</a></el-dropdown-item>
                <el-dropdown-item><a href="/all-workspace/contacts">Contacts</a></el-dropdown-item>
                <el-dropdown-item><a href="/all-workspace/settings">Settings</a></el-dropdown-item>
              </template>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </template>
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
            <el-dropdown-item command="profile">
              Edit Profile
            </el-dropdown-item>
            <el-dropdown-item command="email_notifications">
              Email Notifications
            </el-dropdown-item>
            <el-dropdown-item command="billing">
              Billing
            </el-dropdown-item>
            <el-dropdown-item command="all_workspace" divided>All Workspaces</el-dropdown-item>
            <el-dropdown-item command="talktodev">Talk to Dev</el-dropdown-item>
            <el-dropdown-item command="activity_log">Activity Log</el-dropdown-item>
            <el-dropdown-item divided command="referral_system">Referral System</el-dropdown-item>
            <el-dropdown-item command="ai_attorney">AI Attorney</el-dropdown-item>
            <el-dropdown-item command="initial_consultation">
              Initial Consultation
            </el-dropdown-item>
            <el-dropdown-item divided @click="copyCommitHash" class="version-item">
              <div class="version-info">
                <span class="version-label">Version:</span>
                <span class="version-hash">{{ commitHash }}</span>
              </div>
            </el-dropdown-item>
            <el-dropdown-item command="logout">Logout</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </header>

  <!-- Update Alert -->
  <el-alert
    v-if="showUpdateAlert"
    title="New Version Available!"
    type="warning"
    :closable="true"
    @close="dismissUpdateAlert"
    show-icon
    class="update-alert"
  >
    <template #default>
      <div class="update-content">
        <p>A new version of the application is available. Please reload to get the latest updates and features.</p>
        <div class="update-actions">
          <el-button type="primary" size="small" @click="reloadPage">
            Reload Now
          </el-button>
          <el-button size="small" @click="dismissUpdateAlert">
            Dismiss
          </el-button>
        </div>
      </div>
    </template>
  </el-alert>

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
  cursor: default;
}

.logo-image.clickable {
  cursor: pointer;
  transition: opacity 0.2s;
}

.logo-image.clickable:hover {
  opacity: 0.8;
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

/* Add styles for dropdown anchor tags */
:deep(.el-dropdown-menu__item a) {
  text-decoration: none;
  color: inherit;
  display: block;
  width: 100%;
  height: 100%;
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
  min-width: 200px; /* Ensures consistent width */
  justify-content: center;
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

.section-title {
  font-size: 1.2rem;
  font-weight: 500;
  color: #1a1a1a;
  margin: 0;
}

/* Version info styles */
.version-item {
  cursor: pointer !important;
}

.version-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  font-size: 0.85rem;
}

.version-label {
  color: #606266;
  font-weight: 500;
}

.version-hash {
  color: #409EFF;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.8rem;
  background: rgba(64, 158, 255, 0.1);
  padding: 2px 6px;
  border-radius: 3px;
  cursor: pointer;
}

.version-hash:hover {
  background: rgba(64, 158, 255, 0.2);
}

/* Update Alert Styles */
.update-alert {
  position: sticky;
  top: 0;
  z-index: 99;
  margin: 0;
  border-radius: 0;
  border-left: none;
  border-right: none;
  border-top: none;
}

.update-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.update-content p {
  margin: 0;
  flex: 1;
  font-size: 0.9rem;
}

.update-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

/* Active dropdown item styling */
:deep(.el-dropdown-menu__item.is-active) {
  background-color: #409eff !important;
  color: white !important;
}

:deep(.el-dropdown-menu__item.is-active a) {
  color: white !important;
}

@media (max-width: 768px) {
  .update-content {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  
  .update-actions {
    justify-content: center;
  }
}
</style>
