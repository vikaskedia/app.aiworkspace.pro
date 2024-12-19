<script>
import { supabase } from '../supabase';
import { ElDropdown, ElDropdownMenu, ElDropdownItem, ElAvatar } from 'element-plus';
import { CaretBottom } from '@element-plus/icons-vue';
import MatterSelector from './MatterSelector.vue';
import { useMatterStore } from '../store/matter';
import { ElMessage } from 'element-plus';

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
      user: null,
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
          this.$router.push(`/matters/${matterId}`);
          break;
        case 'goals':
          this.$router.push(`/matters/${matterId}/goals`);
          break;
        case 'tasks':
          this.$router.push(`/matters/${matterId}/tasks`);
          break;
        case 'events':
          this.$router.push(`/matters/${matterId}/events`);
          break;
        case 'plan':
          this.$router.push(`/matters/${matterId}/plan`);
          break;
        case 'manage-files':
          this.$router.push(`/matters/${matterId}/files`);
          break;
        case 'logout':
          this.handleLogout();
          break;
      }
    },
    handleMatterSelect(matter) {
      const matterStore = useMatterStore();
      matterStore.setCurrentMatter(matter);
      this.$router.push(`/matters/${matter.id}`);
    }
  }
};
</script>

<template>
  <header class="site-header">
    <div class="header-left">
      <img src="/logo.png" alt="Legal AI Studio" class="logo-image" />
      <h1>Legal AI Studio</h1>
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
            <el-dropdown-item command="plan">Plan</el-dropdown-item>
            <el-dropdown-item command="manage-files">Manage Files</el-dropdown-item>
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
  background: linear-gradient(135deg, #0f172a 0%, #334155 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  font-family: Open Sans,sans-serif;
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
  font-weight: 400;
  font-size: 1.5rem;
  letter-spacing: -0.5px;
  margin: 0;
  color: white;
}

.header-right {
  display: flex;
  align-items: center;
}

.user-profile {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  transition: background-color 0.2s;
  outline: none !important;
}

.dropdown-icon {
  color: white;
  font-size: 14px;
  transition: transform 0.2s;
}

.user-name {
  color: white;
  font-size: 0.9rem;
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
</style>
