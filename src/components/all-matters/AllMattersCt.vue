<template>
  <div class="all-matters">
    <HeaderCt />
    <div class="content">
      <div class="matters-header">
        <h2>All Matters</h2>
        <div class="header-actions">
          <el-switch
            v-model="showDeleted"
            active-text="Show Deleted"
            inactive-text="Show Active"
          />
          <el-button type="primary" @click="createMatterDialog = true">
            <el-icon><Plus /></el-icon>
            New Matter
          </el-button>
        </div>
      </div>

      <div class="matters-grid" v-loading="loading">
        <el-card v-for="matter in matters" :key="matter.id" class="matter-card">
          <template #header>
            <div class="matter-header">
              <h3>{{ matter.title }}</h3>
              <el-dropdown trigger="click" @command="(cmd) => handleCommand(cmd, matter)">
                <el-button type="primary" link>
                  <el-icon><More /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <template v-if="!showDeleted">
                      <el-dropdown-item command="view">View Dashboard</el-dropdown-item>
                      <el-dropdown-item command="edit">Edit Matter</el-dropdown-item>
                      <el-dropdown-item command="delete" divided>Delete</el-dropdown-item>
                    </template>
                    <template v-else>
                      <el-dropdown-item command="restore">Restore Matter</el-dropdown-item>
                    </template>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </template>

          <div class="matter-stats">
            <div class="stat-item">
              <h4>Goals</h4>
              <div class="stat-numbers">
                <span>{{ matter.stats?.goals_total || 0 }} Total</span>
                <span>{{ matter.stats?.goals_completed || 0 }} Completed</span>
              </div>
            </div>
            <div class="stat-item">
              <h4>Tasks</h4>
              <div class="stat-numbers">
                <span>{{ matter.stats?.tasks_total || 0 }} Total</span>
                <span>{{ matter.stats?.tasks_completed || 0 }} Completed</span>
              </div>
            </div>
            <div class="stat-item">
              <h4>Upcoming Events</h4>
              <span>{{ matter.stats?.upcoming_events || 0 }}</span>
            </div>
          </div>

          <div class="matter-description" v-if="matter.description">
            <p>{{ matter.description }}</p>
          </div>
        </el-card>
      </div>
    </div>

    <!-- Create Matter Dialog -->
    <el-dialog
      v-model="createMatterDialog"
      title="Create New Matter"
      width="500px">
      <el-form :model="newMatter" label-position="top">
        <el-form-item label="Title" required>
          <el-input v-model="newMatter.title" placeholder="Enter matter title" />
        </el-form-item>
        
        <el-form-item label="Description">
          <el-input
            v-model="newMatter.description"
            type="textarea"
            rows="3"
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
            Create Matter
          </el-button>
        </span>
      </template>
    </el-dialog>

    <!-- Edit Matter Dialog -->
    <el-dialog
      v-model="editMatterDialog"
      title="Edit Matter"
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
import HeaderCt from '../HeaderCt.vue';
import { Plus, More } from '@element-plus/icons-vue';
import { supabase } from '../../supabase';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useRouter } from 'vue-router';
import { useMatterStore } from '../../store/matter';

export default {
  name: 'AllMattersCt',
  components: {
    HeaderCt,
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
      showDeleted: false,
    };
  },
  watch: {
    showDeleted() {
      this.loadMatters();
    }
  },
  mounted() {
    this.loadMatters();
  },
  methods: {
    async loadMatters() {
      try {
        this.loading = true;
        const { data: { user } } = await supabase.auth.getUser();

        const query = supabase
          .from('matters')
          .select('*')
          .eq('deleted', this.showDeleted)
          .order('created_at', { ascending: false });

        const { data: matters, error } = await query;
        if (error) throw error;

        // Load statistics for each matter
        const mattersWithStats = await Promise.all((matters || []).map(async (matter) => {
          const stats = await this.loadMatterStats(matter.id);
          return { ...matter, stats };
        }));

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
        
        console.log('user', user);
        const matterData = {
          title: this.newMatter.title,
          description: this.newMatter.description,
          created_by: user.id
        };
        console.log('Attempting to create matter with:', matterData);

        const { data, error } = await supabase
          .from('matters')
          .insert([{
            title: this.newMatter.title,
            description: this.newMatter.description,
            created_by: user.id
          }])
          .select()
          .single();

          console.log('Matter creation result:', data);
          if (error) console.error('Matter creation error:', error);

        this.matters.unshift({ ...data, stats: { goals_total: 0, goals_completed: 0, tasks_total: 0, tasks_completed: 0, upcoming_events: 0 } });
        this.createMatterDialog = false;
        this.newMatter = { title: '', description: '' };
        ElMessage.success('Matter created successfully');
      } catch (error) {
        if (error.message.includes('JWT')) {
          ElMessage.error('Your session has expired. Please log in again.');
          // Redirect to login page or handle re-authentication
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

        this.editMatterDialog = false;
        ElMessage.success('Matter updated successfully');
      } catch (error) {
        ElMessage.error('Error updating matter: ' + error.message);
      } finally {
        this.loading = false;
      }
    },

    async deleteMatter(matter) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        const { error } = await supabase
          .from('matters')
          .update({ 
            deleted: true,
            deleted_at: new Date().toISOString(),
            deleted_by: user.id
          })
          .eq('id', matter.id);

        if (error) throw error;

        this.matters = this.matters.filter(m => m.id !== matter.id);
        ElMessage.success('Matter deleted successfully');
      } catch (error) {
        ElMessage.error('Error deleting matter: ' + error.message);
      }
    },

    async restoreMatter(matter) {
      try {
        const { error } = await supabase
          .from('matters')
          .update({ 
            deleted: false,
            deleted_at: null,
            deleted_by: null
          })
          .eq('id', matter.id);

        if (error) throw error;

        this.matters = this.matters.filter(m => m.id !== matter.id);
        ElMessage.success('Matter restored successfully');
      } catch (error) {
        ElMessage.error('Error restoring matter: ' + error.message);
      }
    },

    handleCommand(command, matter) {
      switch(command) {
        case 'view':
          this.matterStore.setCurrentMatter(matter);
          this.router.push(`/matter/${matter.id}`);
          break;
        case 'edit':
          this.editingMatter = {
            id: matter.id,
            title: matter.title,
            description: matter.description || ''
          };
          this.editMatterDialog = true;
          break;
        case 'delete':
          ElMessageBox.confirm(
            'Are you sure you want to delete this matter? You can restore it later from the deleted matters section.',
            'Warning',
            {
              confirmButtonText: 'Delete',
              cancelButtonText: 'Cancel',
              type: 'warning'
            }
          ).then(() => {
            this.deleteMatter(matter);
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
    }
  }
};
</script>

<style scoped>
.all-matters {
  min-height: 100vh;
  background-color: #f5f7fa;
}

.content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

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
  .content {
    padding: 1rem;
  }

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
</style> 