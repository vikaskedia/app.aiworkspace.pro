<script>
import { supabase } from '../supabase';
import { ElDropdown, ElDropdownMenu, ElDropdownItem, ElAvatar } from 'element-plus';
import { CaretBottom } from '@element-plus/icons-vue';
import MatterSelector from './MatterSelector.vue';
import { useMatterStore } from '../store/matter';
import { ElMessage } from 'element-plus';
import NotificationsCt from './NotificationsCt.vue';
import { ref } from 'vue';

export default {
  components: {
    ElDropdown,
    ElDropdownMenu,
    ElDropdownItem,
    ElAvatar,
    CaretBottom,
    MatterSelector,
    NotificationsCt
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
    },
    currentSection() {
      const path = this.$route.path;
      if (path.includes('/goals')) return 'Goals';
      if (path.includes('/tasks')) return 'Tasks';
      if (path.includes('/events')) return 'Events';
      if (path.includes('/files')) return 'Files';
      if (path.includes('/manage')) return 'Manage Matter';
      if (path.includes('/matter/') && !path.includes('/all-matters')) return 'Dashboard';
      if (path.includes('/all-matters')) return 'All Matters';
      return 'Dashboard';
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
    async handleCommand(command) {
      if (command === 'logout') {
        await this.handleLogout();
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
      <span class="section-divider">/</span>
      <span class="current-section">{{ currentSection }}</span>
    </div>
    
    <div class="header-right" v-if="user">
      <NotificationsCt />
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
            <el-dropdown-item command="logout">Logout</el-dropdown-item>
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
  .section-divider,
  .current-section {
    display: none;
  }
}
</style>
