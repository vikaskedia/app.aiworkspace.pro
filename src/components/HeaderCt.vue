<script>
import { supabase } from '../supabase';
import { ElDropdown, ElDropdownMenu, ElDropdownItem, ElAvatar } from 'element-plus';
import { CaretBottom } from '@element-plus/icons-vue';
import MatterSelector from './MatterSelector.vue';
import { useMatterStore } from '../store/matter';
import { ElMessage } from 'element-plus';
import { ref } from 'vue';

export default {
  components: {
    ElDropdown,
    ElDropdownMenu,
    ElDropdownItem,
    ElAvatar,
    CaretBottom,
    MatterSelector
  },
  data: function () {
    return {
      user: null
    };
  },
  computed: {
    displayName() {
      if (!this.user) return '';
      return this.user.user_metadata?.name || 
             this.user.user_metadata?.user_name || 
             this.user.user_metadata?.full_name ||
             this.user.email;
    }
  },
  async mounted() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (session) {
      this.user = session.user;
    } else if (error) {
      console.error('Error fetching session:', error.message);
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
    handleCommand(command) {
      const matterStore = useMatterStore();
      const currentMatter = matterStore.currentMatter;
      
      if (!currentMatter && command !== 'logout') {
        ElMessage.warning('Please select a matter first');
        return;
      }

      const matterId = currentMatter?.id;
      
      switch(command) {
        case 'dashboard':
          this.$router.push(`/matter/${matterId}`);
          break;
        case 'goals':
          this.$router.push(`/matter/${matterId}/goals`);
          break;
        case 'tasks':
          this.$router.push(`/matter/${matterId}/tasks`);
          break;
        case 'events':
          this.$router.push(`/matter/${matterId}/events`);
          break;
        case 'manage-files':
          this.$router.push(`/matter/${matterId}/files`);
          break;
        case 'manage-matter':
          this.$router.push(`/matter/${matterId}/manage`);
          break;
        case 'logout':
          this.handleLogout();
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
        this.$router.push(`/matter/${matter.id}/${subRoute}`);
      } else {
        this.$router.push(`/matter/${matter.id}`);
      }
    }
  }
};
</script>

<template>
  <header class="site-header">
    <div class="header-left">
      <img src="/associate-ai-attorney-logo.svg" alt="Legal Studio" class="logo-image" />
      <h1>Legal Studio</h1>
    </div>
    
    <div class="header-center">
      <MatterSelector @matter-selected="handleMatterSelect" />
    </div>
    
    <div class="header-right" v-if="user">
      <el-dropdown @command="handleCommand" trigger="hover">
        <div class="user-profile">
          <span class="user-name">{{ displayName }}</span>
          <el-avatar 
            :size="40"
            :src="user.user_metadata?.avatar_url"
            :icon="!user.user_metadata?.avatar_url ? 'UserFilled' : undefined"
          />
          <el-icon class="dropdown-icon"><caret-bottom /></el-icon>
        </div>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="dashboard">Dashboard</el-dropdown-item>
            <el-dropdown-item command="goals">Goals</el-dropdown-item>
            <el-dropdown-item command="tasks">Tasks</el-dropdown-item>
            <el-dropdown-item command="events">Events</el-dropdown-item>
            <el-dropdown-item command="manage-files">Manage Files</el-dropdown-item>
            <el-dropdown-item command="manage-matter">Manage Matter</el-dropdown-item>
            <el-dropdown-item divided command="logout">Logout</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </header>
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
</style>
