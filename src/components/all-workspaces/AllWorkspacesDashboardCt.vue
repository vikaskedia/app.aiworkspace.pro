<template>
  <div>
    <!-- Page moved warning -->
    <el-alert
      title="Page Moved"
      type="warning"
      :closable="false"
      show-icon
      class="page-moved-alert">
      <template #default>
        This page has moved to 
        <a href="https://all-ws-dashboard.aiworkspace.pro/all-workspace/dashboard" target="_blank" class="moved-link">
          https://all-ws-dashboard.aiworkspace.pro/all-workspace/dashboard
        </a>
      </template>
    </el-alert>
    
    <div class="workspaces-header">
      <div class="header-actions">
        <el-switch
          v-model="showArchived"
          active-text="Show Archived"
          inactive-text="Show Active"
        />
        <el-button id="idOfButtonToCreateNewWorkspace" type="primary" @click="createWorkspaceDialog = true">
          <el-icon><Plus /></el-icon>
          New Workspace
        </el-button>
      </div>
    </div>

    <div class="workspaces-grid" v-loading="loading">
      <el-card v-for="workspace in workspaces" :key="workspace.id" class="workspace-card">
        <template #header>
          <div class="workspace-header">
            <a :href="`/single-workspace/${workspace.id}`" @click="handleCommand('view', workspace)" class="workspace-title-link">
              <h3 class="clickable-title">{{ workspace.title }}</h3>
            </a>
            <el-dropdown trigger="click" @command="(cmd) => handleCommand(cmd, workspace)">
              <el-button type="primary" link>
                <el-icon><More /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <template v-if="!showArchived">
                    <!--el-dropdown-item command="view">View Dashboard</el-dropdown-item-->
                    <el-dropdown-item command="edit">Edit Workspace</el-dropdown-item>
                    <el-dropdown-item command="archive" divided>Archive</el-dropdown-item>
                  </template>
                  <template v-else>
                    <el-dropdown-item command="restore">Restore Workspace</el-dropdown-item>
                  </template>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </template>

        <div class="workspace-stats">
          <a :href="`/single-workspace/${workspace.id}/goals`" @click="navigateToGoals(workspace)" class="stat-link">
            <div class="stat-item clickable-stat">
              <h4>Goals</h4>
              <div class="stat-numbers">
                <span>{{ workspace.stats?.goals_total || 0 }} Total</span>
                <span>{{ workspace.stats?.goals_completed || 0 }} Completed</span>
              </div>
            </div>
          </a>
          <a :href="`/single-workspace/${workspace.id}/tasks`" @click="navigateToTasks(workspace)" class="stat-link">
            <div class="stat-item clickable-stat">
              <h4>Tasks</h4>
              <div class="stat-numbers">
                <span>{{ workspace.stats?.tasks_total || 0 }} Total</span>
                <span>{{ workspace.stats?.tasks_completed || 0 }} Completed</span>
              </div>
            </div>
          </a>
          <a :href="`/single-workspace/${workspace.id}/events`" @click="navigateToEvents(workspace)" class="stat-link">
            <div class="stat-item clickable-stat">
              <h4>Upcoming Events</h4>
              <span>{{ workspace.stats?.upcoming_events || 0 }}</span>
            </div>
          </a>
        </div>

        <div class="workspace-description" v-if="workspace.description">
          <p>{{ workspace.description }}</p>
        </div>
      </el-card>
    </div>

    <!-- Create Workspace Dialog -->
    <el-dialog
      v-model="createWorkspaceDialog"
      title="Create New Workspace"
      id="idOfDialogToCreateNewWorkspace"
      width="500px">
      <el-form :model="newWorkspace" label-position="top">
        <el-form-item label="Title" required>
          <el-input id="idOfInputWorkspaceTitle" v-model="newWorkspace.title" placeholder="Enter workspace title" />
        </el-form-item>
        
        <el-form-item label="Description">
          <el-input
            v-model="newWorkspace.description"
            type="textarea"
            rows="3"
            id="idOfInputWorkspaceDescription"
            placeholder="Enter workspace description" />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="createWorkspaceDialog = false">Cancel</el-button>
          <el-button
            type="primary"
            :disabled="!newWorkspace.title"
            :loading="loading"
            @click="createWorkspace">
            Create Workspace
          </el-button>
        </span>
      </template>
    </el-dialog>

    <!-- Edit Workspace Dialog -->
    <el-dialog
      v-model="editWorkspaceDialog"
      title="Edit Workspace"
      width="500px">
      <el-form :model="editingWorkspace" label-position="top">
        <el-form-item label="Title" required>
          <el-input v-model="editingWorkspace.title" placeholder="Enter workspace title" />
        </el-form-item>
        
        <el-form-item label="Description">
          <el-input
            v-model="editingWorkspace.description"
            type="textarea"
            rows="3"
            placeholder="Enter workspace description" />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="editWorkspaceDialog = false">Cancel</el-button>
          <el-button
            type="primary"
            :disabled="!editingWorkspace.title"
            :loading="loading"
            @click="updateWorkspace">
            Save Changes
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { Plus, More } from '@element-plus/icons-vue';
import { supabase } from '../../supabase';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useRouter } from 'vue-router';
import { useWorkspaceStore } from '../../store/workspace';
import { setComponentTitle } from '../../utils/page-title';

export default {
  name: 'AllWorkspacesDashboardCt',
  components: {
    Plus,
    More
  },
  setup() {
    const router = useRouter();
    const workspaceStore = useWorkspaceStore();
    return { router, workspaceStore };
  },
  data() {
    return {
      workspaces: [],
      loading: false,
      createWorkspaceDialog: false,
      editWorkspaceDialog: false,
      newWorkspace: {
        title: '',
        description: ''
      },
      editingWorkspace: {
        id: null,
        title: '',
        description: ''
      },
      showArchived: false,
    };
  },
  watch: {
    showArchived() {
      this.loadWorkspacesWithCache();
    }
  },
  mounted() {
    this.loadWorkspacesWithCache();
    this.updatePageTitle();
  },
  methods: {
    updatePageTitle() {
      setComponentTitle('All Workspaces');
    },

    getCacheKey() {
      return `workspaces_${this.showArchived ? 'archived' : 'active'}`;
    },

    async loadWorkspacesWithCache() {
      try {
        // Try to get data from cache first
        const cacheKey = this.getCacheKey();
        const cachedData = localStorage.getItem(cacheKey);
        
        if (cachedData) {
          // Display cached data immediately
          this.workspaces = JSON.parse(cachedData);
        }
        
        // Always fetch fresh data
        await this.loadWorkspaces();
      } catch (error) {
        ElMessage.error('Error loading workspaces: ' + error.message);
      }
    },

    async loadWorkspaces() {
      try {
        this.loading = false;
        const { data: { user } } = await supabase.auth.getUser();

        // Get all workspaces with their activity in a single query
        const query = supabase
          .from('workspaces')
          .select(`
            *,
           workspace_access!inner (
              access_type,
              shared_with_user_id
            ),
            workspace_activities!left (
              updated_at
            )
          `)
          .eq('archived', this.showArchived)
          .eq('workspace_access.shared_with_user_id', user.id)
          .eq('workspace_activities.user_id', user.id);

        const { data: workspaces, error } = await query;
        if (error) throw error;

        // Process workspaces and add latest activity
        const workspacesWithActivity = (workspaces || []).map(workspace => ({
          ...workspace,
          latest_activity: workspace.workspace_activities?.[0]?.updated_at || workspace.created_at
        }));

        // Sort by latest activity (most recent first)
        workspacesWithActivity.sort((a, b) => {
          const dateA = new Date(a.latest_activity);
          const dateB = new Date(b.latest_activity);
          return dateB - dateA;
        });

        // Load statistics for each workspace
        const workspacesWithStats = await Promise.all(workspacesWithActivity.map(async (workspace) => {
          const stats = await this.loadWorkspaceStats(workspace.id);
          return { ...workspace, stats };
        }));

        // Update cache with new data
        const cacheKey = this.getCacheKey();
        localStorage.setItem(cacheKey, JSON.stringify(workspacesWithStats));

        this.workspaces = workspacesWithStats;
      } catch (error) {
        ElMessage.error('Error loading workspaces: ' + error.message);
      } finally {
        this.loading = false;
      }
    },

    async loadWorkspaceStats(workspaceId) {
      try {
        const [goals, tasks, events] = await Promise.all([
          supabase
            .from('goals')
            .select('status')
            .eq('workspace_id', workspaceId),
          supabase
            .from('tasks')
            .select('status')
            .eq('workspace_id', workspaceId),
          supabase
            .from('events')
            .select('start_time')
            .eq('workspace_id', workspaceId)
            .gte('start_time', new Date().toISOString())
        ]);

        return {
          goals_total: goals.data?.length || 0,
          goals_completed: goals.data?.filter(g => g.status === 'completed').length || 0,
          tasks_total: tasks.data?.length || 0,
          tasks_completed: tasks.data?.filter(t => t.status === 'completed').length || 0,
          upcoming_events: events.data?.length || 0
        };
      } catch (error) {
        console.error('Error loading workspace stats:', error);
        return {};
      }
    },

    async ensureValidSession() {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (!session) {
        // Redirect to login or handle re-authentication
        throw new Error('No valid session');
      }
      console.log('session', session);
      return session;
    },

    async createWorkspace() {
      try {
        await this.ensureValidSession();
        this.loading = true;
        const { data: { user } } = await supabase.auth.getUser();
        
        // Generate repository name - lowercase, no spaces, with timestamp
        const repoName = `${this.newWorkspace.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`;
        const emailStorage = `${repoName}@associateattorney.ai`;

        // Create repository in Gitea
        const giteaHost = import.meta.env.VITE_GITEA_HOST;
        const giteaToken = import.meta.env.VITE_GITEA_TOKEN;

        const createRepoResponse = await fetch(
          `${giteaHost}/api/v1/org/associateattorney/repos`,
          {
            method: 'POST',
            headers: {
              'Authorization': `token ${giteaToken}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Cache-Control': 'no-cache'
            },
            body: JSON.stringify({
              name: repoName,
              description: this.newWorkspace.description,
              private: true,
              auto_init: true
            })
          }
        );

        if (!createRepoResponse.ok) {
          throw new Error('Failed to create Gitea repository');
        }

        // Create workspace in database with repository info
        const workspaceData = {
          title: this.newWorkspace.title,
          description: this.newWorkspace.description,
          created_by: user.id,
          git_repo: repoName,
          email_storage: emailStorage
        };

        const { data, error } = await supabase
          .from('workspaces')
          .insert([workspaceData])
          .select()
          .single();

        if (error) throw error;

        this.workspaces.unshift({ 
          ...data, 
          stats: { 
            goals_total: 0, 
            goals_completed: 0, 
            tasks_total: 0, 
            tasks_completed: 0, 
            upcoming_events: 0 
          } 
        });
        
        // Clear cache when creating new workspace
        this.clearWorkspacesCache();
        
        this.createWorkspaceDialog = false;
        this.newWorkspace = { title: '', description: '' };
        ElMessage.success('Workspace created successfully');
      } catch (error) {
        if (error.message.includes('JWT')) {
          ElMessage.error('Your session has expired. Please log in again.');
        } else {
          ElMessage.error('Error creating workspace: ' + error.message);
        }
      } finally {
        this.loading = false;
      }
    },

    async updateWorkspace() {
      try {
        this.loading = true;
        const { data, error } = await supabase
          .from('workspaces')
          .update({
            title: this.editingWorkspace.title,
            description: this.editingWorkspace.description
          })
          .eq('id', this.editingWorkspace.id)
          .select()
          .single();

        if (error) throw error;

        const index = this.workspaces.findIndex(m => m.id === this.editingWorkspace.id);
        if (index !== -1) {
          this.workspaces[index] = { ...this.workspaces[index], ...data };
        }

        // Clear cache when updating workspace
        this.clearWorkspacesCache();

        this.editWorkspaceDialog = false;
        ElMessage.success('Workspace updated successfully');
      } catch (error) {
        ElMessage.error('Error updating workspace: ' + error.message);
      } finally {
        this.loading = false;
      }
    },

    async archiveWorkspace(workspace) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        const { error } = await supabase
          .from('workspaces')
          .update({ 
            archived: true,
            archived_at: new Date().toISOString(),
            archived_by: user.id
          })
          .eq('id', workspace.id);

        if (error) throw error;

        this.workspaces = this.workspaces.filter(m => m.id !== workspace.id);
        
        // Clear cache when archiving workspace
        this.clearWorkspacesCache();
        
        ElMessage.success('Workspace archived successfully');
      } catch (error) {
        ElMessage.error('Error archiving workspace: ' + error.message);
      }
    },

    async restoreWorkspace(workspace) {
      try {
        const { error } = await supabase
          .from('workspaces')
          .update({ 
            archived: false,
            archived_at: null,
            archived_by: null
          })
          .eq('id', workspace.id);

        if (error) throw error;

        this.workspaces = this.workspaces.filter(m => m.id !== workspace.id);
        
        // Clear cache when restoring workspace
        this.clearWorkspacesCache();
        
        ElMessage.success('Workspace restored successfully');
      } catch (error) {
        ElMessage.error('Error restoring workspace: ' + error.message);
      }
    },

    handleCommand(command, workspace) {
      switch(command) {
        case 'view':
          this.workspaceStore.setCurrentWorkspace(workspace);
          this.router.push(`/single-workspace/${workspace.id}`);
          break;
        case 'edit':
          this.editingWorkspace = {
            id: workspace.id,
            title: workspace.title,
            description: workspace.description || ''
          };
          this.editWorkspaceDialog = true;
          break;
        case 'archive':
          ElMessageBox.confirm(
            'Are you sure you want to archive this workspace? You can restore it later from the archived workspaces section.',
            'Warning',
            {
              confirmButtonText: 'Archive',
              cancelButtonText: 'Cancel',
              type: 'warning'
            }
          ).then(() => {
            this.archiveWorkspace(workspace);
          }).catch(() => {});
          break;
        case 'restore':
          ElMessageBox.confirm(
            'Are you sure you want to restore this workspace?',
            'Confirm',
            {
              confirmButtonText: 'Restore',
              cancelButtonText: 'Cancel',
              type: 'info'
            }
          ).then(() => {
            this.restoreWorkspace(workspace);
          }).catch(() => {});
          break;
      }
    },

    clearWorkspacesCache() {
      localStorage.removeItem('workspaces_active');
      localStorage.removeItem('workspaces_archived');
    },

    navigateToGoals(workspace) {
      this.workspaceStore.setCurrentWorkspace(workspace);
      this.router.push(`/single-workspace/${workspace.id}/goals`);
    },

    navigateToTasks(workspace) {
      this.workspaceStore.setCurrentWorkspace(workspace);
      this.router.push(`/single-workspace/${workspace.id}/tasks`);
    },

    navigateToEvents(workspace) {
      this.workspaceStore.setCurrentWorkspace(workspace);
      this.router.push(`/single-workspace/${workspace.id}/events`);
    },
  }
};
</script>

<style scoped>
.workspaces-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.workspaces-header h2 {
  margin: 0;
  color: #303133;
  font-size: 1.8rem;
}

.workspaces-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.workspace-card {
  height: 100%;
}

.workspace-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.workspace-header h3 {
  margin: 0;
  font-size: 1.2rem;
  color: #303133;
}

.workspace-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-bottom: 1rem;
}

.stat-item {
  text-align: center;
}

.stat-item h4 {
  margin: 0 0 0.5rem 0;
  color: #606266;
  font-size: 0.9rem;
}

.stat-numbers {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.9rem;
}

.workspace-description {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #ebeef5;
}

.workspace-description p {
  margin: 0;
  color: #606266;
  font-size: 0.9rem;
  line-height: 1.4;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.header-actions {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.workspaces-header :deep(.el-switch) {
  margin-right: 1rem;
}

@media (max-width: 640px) {
  .workspaces-header h2 {
    font-size: 1.5rem;
  }

  .workspaces-grid {
    grid-template-columns: 1fr;
  }

  :deep(.el-dialog) {
    width: 90% !important;
  }
}

.clickable-title {
  cursor: pointer;
  transition: color 0.2s ease;
}

.clickable-title:hover {
  color: var(--el-color-primary);
}

.clickable-stat {
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 0.25rem;
  border-radius: 4px;
}

.clickable-stat:hover {
  background-color: var(--el-color-primary-light-9);
  transform: translateY(-2px);
}

.stat-item h4 {
  margin: 0 0 0.5rem 0;
  color: #606266;
  font-size: 0.9rem;
  transition: color 0.2s ease;
}

.clickable-stat:hover h4 {
  color: var(--el-color-primary);
}

/* Anchor tag styling */
.workspace-title-link {
  text-decoration: none;
  color: inherit;
}

.workspace-title-link:hover {
  text-decoration: none;
}

.stat-link {
  text-decoration: none;
  color: inherit;
  display: block;
}

.stat-link:hover {
  text-decoration: none;
}

/* Page moved alert styling */
.page-moved-alert {
  margin-bottom: 2rem;
}

.moved-link {
  color: var(--el-color-primary);
  text-decoration: none;
  font-weight: 500;
}

.moved-link:hover {
  text-decoration: underline;
}
</style> 