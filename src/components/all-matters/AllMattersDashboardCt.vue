<template>
  <div>
    <div class="matters-header">
      <div class="header-actions">
        <el-switch
          v-model="showArchived"
          active-text="Show Archived"
          inactive-text="Show Active"
        />
        <el-button id="idOfButtonToCreateNewMatter" type="primary" @click="createMatterDialog = true">
          <el-icon><Plus /></el-icon>
          New Workspace
        </el-button>
      </div>
    </div>

    <div class="matters-grid" v-loading="loading">
      <el-card v-for="matter in matters" :key="matter.id" class="matter-card">
        <template #header>
          <div class="matter-header">
            <h3 class="clickable-title" @click="handleCommand('view', matter)">{{ matter.title }}</h3>
            <el-dropdown trigger="click" @command="(cmd) => handleCommand(cmd, matter)">
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

        <div class="matter-stats">
          <div class="stat-item clickable-stat" @click="navigateToGoals(matter)">
            <h4>Goals</h4>
            <div class="stat-numbers">
              <span>{{ matter.stats?.goals_total || 0 }} Total</span>
              <span>{{ matter.stats?.goals_completed || 0 }} Completed</span>
            </div>
          </div>
          <div class="stat-item clickable-stat" @click="navigateToTasks(matter)">
            <h4>Tasks</h4>
            <div class="stat-numbers">
              <span>{{ matter.stats?.tasks_total || 0 }} Total</span>
              <span>{{ matter.stats?.tasks_completed || 0 }} Completed</span>
            </div>
          </div>
          <div class="stat-item clickable-stat" @click="navigateToEvents(matter)">
            <h4>Upcoming Events</h4>
            <span>{{ matter.stats?.upcoming_events || 0 }}</span>
          </div>
        </div>

        <div class="matter-description" v-if="matter.description">
          <p>{{ matter.description }}</p>
        </div>
      </el-card>
    </div>

    <!-- Create Workspace Dialog -->
    <el-dialog
      v-model="createMatterDialog"
      title="Create New Workspace"
      id="idOfDialogToCreateNewMatter"
      width="500px">
      <el-form :model="newMatter" label-position="top">
        <el-form-item label="Title" required>
          <el-input id="idOfInputMatterTitle" v-model="newMatter.title" placeholder="Enter matter title" />
        </el-form-item>
        
        <el-form-item label="Description">
          <el-input
            v-model="newMatter.description"
            type="textarea"
            rows="3"
            id="idOfInputMatterDescription"
            placeholder="Enter matter description" />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="createMatterDialog = false">Cancel</el-button>
          <el-button
            type="primary"
            :disabled="!newMatter.title"
            :loading="loading"
            @click="createMatter">
            Create Workspace
          </el-button>
        </span>
      </template>
    </el-dialog>

    <!-- Edit Workspace Dialog -->
    <el-dialog
      v-model="editMatterDialog"
      title="Edit Workspace"
      width="500px">
      <el-form :model="editingMatter" label-position="top">
        <el-form-item label="Title" required>
          <el-input v-model="editingMatter.title" placeholder="Enter matter title" />
        </el-form-item>
        
        <el-form-item label="Description">
          <el-input
            v-model="editingMatter.description"
            type="textarea"
            rows="3"
            placeholder="Enter matter description" />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="editMatterDialog = false">Cancel</el-button>
          <el-button
            type="primary"
            :disabled="!editingMatter.title"
            :loading="loading"
            @click="updateMatter">
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
import { useMatterStore } from '../../store/matter';

export default {
  name: 'AllMattersDashboardCt',
  components: {
    Plus,
    More
  },
  setup() {
    const router = useRouter();
    const matterStore = useMatterStore();
    return { router, matterStore };
  },
  data() {
    return {
      matters: [],
      loading: false,
      createMatterDialog: false,
      editMatterDialog: false,
      newMatter: {
        title: '',
        description: ''
      },
      editingMatter: {
        id: null,
        title: '',
        description: ''
      },
      showArchived: false,
    };
  },
  watch: {
    showArchived() {
      this.loadMattersWithCache();
    }
  },
  mounted() {
    this.loadMattersWithCache();
  },
  methods: {
    getCacheKey() {
      return `matters_${this.showArchived ? 'archived' : 'active'}`;
    },

    async loadMattersWithCache() {
      try {
        // Try to get data from cache first
        const cacheKey = this.getCacheKey();
        const cachedData = localStorage.getItem(cacheKey);
        
        if (cachedData) {
          // Display cached data immediately
          this.matters = JSON.parse(cachedData);
        }
        
        // Always fetch fresh data
        await this.loadMatters();
      } catch (error) {
        ElMessage.error('Error loading matters: ' + error.message);
      }
    },

    async loadMatters() {
      try {
        this.loading = false;
        const { data: { user } } = await supabase.auth.getUser();

        // Get all matters with their activity in a single query
        const query = supabase
          .from('matters')
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

        const { data: matters, error } = await query;
        if (error) throw error;

        // Process matters and add latest activity
        const mattersWithActivity = (matters || []).map(matter => ({
          ...matter,
          latest_activity: matter.workspace_activities?.[0]?.updated_at || matter.created_at
        }));

        // Sort by latest activity (most recent first)
        mattersWithActivity.sort((a, b) => {
          const dateA = new Date(a.latest_activity);
          const dateB = new Date(b.latest_activity);
          return dateB - dateA;
        });

        // Load statistics for each matter
        const mattersWithStats = await Promise.all(mattersWithActivity.map(async (matter) => {
          const stats = await this.loadMatterStats(matter.id);
          return { ...matter, stats };
        }));

        // Update cache with new data
        const cacheKey = this.getCacheKey();
        localStorage.setItem(cacheKey, JSON.stringify(mattersWithStats));

        this.matters = mattersWithStats;
      } catch (error) {
        ElMessage.error('Error loading matters: ' + error.message);
      } finally {
        this.loading = false;
      }
    },

    async loadMatterStats(matterId) {
      try {
        const [goals, tasks, events] = await Promise.all([
          supabase
            .from('goals')
            .select('status')
            .eq('matter_id', matterId),
          supabase
            .from('tasks')
            .select('status')
            .eq('matter_id', matterId),
          supabase
            .from('events')
            .select('start_time')
            .eq('matter_id', matterId)
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
        console.error('Error loading matter stats:', error);
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

    async createMatter() {
      try {
        await this.ensureValidSession();
        this.loading = true;
        const { data: { user } } = await supabase.auth.getUser();
        
        // Generate repository name - lowercase, no spaces, with timestamp
        const repoName = `${this.newMatter.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`;
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
              description: this.newMatter.description,
              private: true,
              auto_init: true
            })
          }
        );

        if (!createRepoResponse.ok) {
          throw new Error('Failed to create Gitea repository');
        }

        // Create matter in database with repository info
        const matterData = {
          title: this.newMatter.title,
          description: this.newMatter.description,
          created_by: user.id,
          git_repo: repoName,
          email_storage: emailStorage
        };

        const { data, error } = await supabase
          .from('matters')
          .insert([matterData])
          .select()
          .single();

        if (error) throw error;

        this.matters.unshift({ 
          ...data, 
          stats: { 
            goals_total: 0, 
            goals_completed: 0, 
            tasks_total: 0, 
            tasks_completed: 0, 
            upcoming_events: 0 
          } 
        });
        
        // Clear cache when creating new matter
        this.clearMattersCache();
        
        this.createMatterDialog = false;
        this.newMatter = { title: '', description: '' };
        ElMessage.success('Workspace created successfully');
      } catch (error) {
        if (error.message.includes('JWT')) {
          ElMessage.error('Your session has expired. Please log in again.');
        } else {
          ElMessage.error('Error creating matter: ' + error.message);
        }
      } finally {
        this.loading = false;
      }
    },

    async updateMatter() {
      try {
        this.loading = true;
        const { data, error } = await supabase
          .from('matters')
          .update({
            title: this.editingMatter.title,
            description: this.editingMatter.description
          })
          .eq('id', this.editingMatter.id)
          .select()
          .single();

        if (error) throw error;

        const index = this.matters.findIndex(m => m.id === this.editingMatter.id);
        if (index !== -1) {
          this.matters[index] = { ...this.matters[index], ...data };
        }

        // Clear cache when updating matter
        this.clearMattersCache();

        this.editMatterDialog = false;
        ElMessage.success('Workspace updated successfully');
      } catch (error) {
        ElMessage.error('Error updating matter: ' + error.message);
      } finally {
        this.loading = false;
      }
    },

    async archiveMatter(matter) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        const { error } = await supabase
          .from('matters')
          .update({ 
            archived: true,
            archived_at: new Date().toISOString(),
            archived_by: user.id
          })
          .eq('id', matter.id);

        if (error) throw error;

        this.matters = this.matters.filter(m => m.id !== matter.id);
        
        // Clear cache when archiving matter
        this.clearMattersCache();
        
        ElMessage.success('Workspace archived successfully');
      } catch (error) {
        ElMessage.error('Error archiving matter: ' + error.message);
      }
    },

    async restoreMatter(matter) {
      try {
        const { error } = await supabase
          .from('matters')
          .update({ 
            archived: false,
            archived_at: null,
            archived_by: null
          })
          .eq('id', matter.id);

        if (error) throw error;

        this.matters = this.matters.filter(m => m.id !== matter.id);
        
        // Clear cache when restoring matter
        this.clearMattersCache();
        
        ElMessage.success('Workspace restored successfully');
      } catch (error) {
        ElMessage.error('Error restoring matter: ' + error.message);
      }
    },

    handleCommand(command, matter) {
      switch(command) {
        case 'view':
          this.matterStore.setCurrentMatter(matter);
          this.router.push(`/single-matter/${matter.id}`);
          break;
        case 'edit':
          this.editingMatter = {
            id: matter.id,
            title: matter.title,
            description: matter.description || ''
          };
          this.editMatterDialog = true;
          break;
        case 'archive':
          ElMessageBox.confirm(
            'Are you sure you want to archive this matter? You can restore it later from the archived matters section.',
            'Warning',
            {
              confirmButtonText: 'Archive',
              cancelButtonText: 'Cancel',
              type: 'warning'
            }
          ).then(() => {
            this.archiveMatter(matter);
          }).catch(() => {});
          break;
        case 'restore':
          ElMessageBox.confirm(
            'Are you sure you want to restore this matter?',
            'Confirm',
            {
              confirmButtonText: 'Restore',
              cancelButtonText: 'Cancel',
              type: 'info'
            }
          ).then(() => {
            this.restoreMatter(matter);
          }).catch(() => {});
          break;
      }
    },

    clearMattersCache() {
      localStorage.removeItem('matters_active');
      localStorage.removeItem('matters_archived');
    },

    navigateToGoals(matter) {
      this.matterStore.setCurrentMatter(matter);
      this.router.push(`/single-matter/${matter.id}/goals`);
    },

    navigateToTasks(matter) {
      this.matterStore.setCurrentMatter(matter);
      this.router.push(`/single-matter/${matter.id}/tasks`);
    },

    navigateToEvents(matter) {
      this.matterStore.setCurrentMatter(matter);
      this.router.push(`/single-matter/${matter.id}/events`);
    },
  }
};
</script>

<style scoped>
.matters-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.matters-header h2 {
  margin: 0;
  color: #303133;
  font-size: 1.8rem;
}

.matters-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.matter-card {
  height: 100%;
}

.matter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.matter-header h3 {
  margin: 0;
  font-size: 1.2rem;
  color: #303133;
}

.matter-stats {
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

.matter-description {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #ebeef5;
}

.matter-description p {
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

.matters-header :deep(.el-switch) {
  margin-right: 1rem;
}

@media (max-width: 640px) {
  .matters-header h2 {
    font-size: 1.5rem;
  }

  .matters-grid {
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
</style> 