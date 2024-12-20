<script>
import { supabase } from '../supabase';
import { ElMessage } from 'element-plus';
import AIChatPanel from './AIChatPanel.vue';
import { useMatterStore } from '../store/matter';
import { storeToRefs } from 'pinia';
import { useCacheStore } from '../store/cache';

export default {
  components: { 
    AIChatPanel
  },
  setup() {
    const matterStore = useMatterStore();
    const cacheStore = useCacheStore();
    const { currentMatter } = storeToRefs(matterStore);
    
    return { currentMatter, cacheStore };
  },
  data() {
    return {
      goals: [],
      loading: false,
      dialogVisible: false,
      newGoal: {
        title: '',
        description: '',
        status: 'in_progress',
        priority: 'medium',
        due_date: '',
        matter_id: null
      },
      showAIChat: false,
      selectedGoal: null,
    };
  },
  watch: {
    currentMatter: {
      handler(newMatter, oldMatter) {
        if (newMatter) {
          this.loadGoals();
          if (!oldMatter) {
            this.setupRealtimeSubscription();
          }
        } else {
          if (this.subscription) {
            this.subscription.unsubscribe();
          }
          this.goals = [];
        }
      },
      immediate: true
    }
  },
  methods: {
    async loadGoals() {
      if (!this.currentMatter) return;
      
      try {
        this.loading = true;
        
        // Check cache first
        const cachedGoals = this.cacheStore.getCachedData('goals', this.currentMatter.id);
        if (cachedGoals) {
          this.goals = cachedGoals;
          this.loading = false;
          return;
        }

        const { data: goals, error } = await supabase
          .from('goals')
          .select('*')
          .eq('matter_id', this.currentMatter.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        this.goals = goals;
        // Store in cache
        this.cacheStore.setCachedData('goals', this.currentMatter.id, goals);
      } catch (error) {
        ElMessage.error('Error loading goals: ' + error.message);
      } finally {
        this.loading = false;
      }
    },
    async createGoal() {
      if (!this.currentMatter) {
        ElMessage.warning('Please select a matter first');
        return;
      }

      try {
        this.loading = true;
        const { data: { user } } = await supabase.auth.getUser();
        
        const goalData = {
          ...this.newGoal,
          matter_id: this.currentMatter.id,
          due_date: this.newGoal.due_date || null,
          created_by: user.id
        };

        const { data, error } = await supabase
          .from('goals')
          .insert([goalData])
          .select();

        if (error) throw error;
        
        ElMessage.success('Goal created successfully');
        this.goals.unshift(data[0]);
        this.dialogVisible = false;
        this.resetForm();
      } catch (error) {
        ElMessage.error('Error creating goal: ' + error.message);
      } finally {
        this.loading = false;
      }
    },

    resetForm() {
      this.newGoal = {
        title: '',
        description: '',
        status: 'in_progress',
        priority: 'medium',
        due_date: '',
        matter_id: null
      };
    },

    handleTitleClick(goal) {
      this.selectedGoal = goal;
      this.showAIChat = true;
    },

    setupRealtimeSubscription() {
      if (this.subscription) {
        this.subscription.unsubscribe();
      }
      
      this.subscription = supabase
        .channel('goals-changes')
        .on('postgres_changes', 
          { 
            event: '*',
            schema: 'public',
            table: 'goals',
            filter: `matter_id=eq.${this.currentMatter.id}`
          },
          (payload) => {
            switch (payload.eventType) {
              case 'INSERT':
                this.goals.unshift(payload.new);
                this.cacheStore.setCachedData('goals', this.currentMatter.id, this.goals);
                break;
              
              case 'UPDATE':
                const updateIndex = this.goals.findIndex(goal => goal.id === payload.new.id);
                if (updateIndex !== -1) {
                  this.goals[updateIndex] = payload.new;
                  this.cacheStore.setCachedData('goals', this.currentMatter.id, this.goals);
                }
                break;
              
              case 'DELETE':
                const deleteIndex = this.goals.findIndex(goal => goal.id === payload.old.id);
                if (deleteIndex !== -1) {
                  this.goals.splice(deleteIndex, 1);
                  this.cacheStore.setCachedData('goals', this.currentMatter.id, this.goals);
                }
                break;
            }
          }
        )
        .subscribe();
    }
  },
  mounted() {
    if (this.currentMatter) {
      this.setupRealtimeSubscription();
    }
  },
  beforeUnmount() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
};
</script>

<template>
  <div class="content">
    <div class="goals-header">
      <h2>Goals</h2>
      <el-button 
        type="primary" 
        @click="dialogVisible = true"
        :disabled="!currentMatter">
        New Goal
      </el-button>
    </div>

    <!-- Add Goal Dialog -->
    <el-dialog
      v-model="dialogVisible"
      title="Add New Goal"
      width="500px">
      <el-form :model="newGoal" label-position="top">
        <el-form-item label="Title" required>
          <el-input v-model="newGoal.title" placeholder="Enter goal title" />
        </el-form-item>
        
        <el-form-item label="Description">
          <el-input
            v-model="newGoal.description"
            type="textarea"
            rows="3"
            placeholder="Enter goal description" />
        </el-form-item>
        
        <el-form-item label="Status">
          <el-select v-model="newGoal.status" style="width: 100%">
            <el-option label="In Progress" value="in_progress" />
            <el-option label="Completed" value="completed" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="Priority">
          <el-select v-model="newGoal.priority" style="width: 100%">
            <el-option label="High" value="high" />
            <el-option label="Medium" value="medium" />
            <el-option label="Low" value="low" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="Due Date">
          <el-date-picker
            v-model="newGoal.due_date"
            type="datetime"
            style="width: 100%"
            placeholder="Select due date" />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">Cancel</el-button>
          <el-button
            type="primary"
            :loading="loading"
            :disabled="!newGoal.title"
            @click="createGoal">
            Create Goal
          </el-button>
        </span>
      </template>
    </el-dialog>

    <el-table
      v-loading="loading"
      :data="goals"
      style="width: 100%"
      :default-sort="{ prop: 'created_at', order: 'descending' }">
      
      <el-table-column 
        prop="title" 
        label="Title"
        min-width="200">
        <template #default="scope">
          <span 
            class="clickable-title"
            @click="handleTitleClick(scope.row)">
            {{ scope.row.title }}
          </span>
        </template>
      </el-table-column>
        
      <el-table-column 
        prop="description" 
        label="Description" 
        min-width="300"
        :show-overflow-tooltip="true" />
        
      <el-table-column 
        prop="status" 
        label="Status" 
        width="120">
        <template #default="scope">
          <el-tag :type="scope.row.status === 'completed' ? 'success' : 'warning'">
            {{ scope.row.status }}
          </el-tag>
        </template>
      </el-table-column>
      
      <el-table-column 
        prop="priority" 
        label="Priority" 
        width="100">
        <template #default="scope">
          <el-tag :type="
            scope.row.priority === 'high' ? 'danger' : 
            scope.row.priority === 'medium' ? 'warning' : 'info'
          ">
            {{ scope.row.priority }}
          </el-tag>
        </template>
      </el-table-column>
      
      <el-table-column 
        prop="due_date" 
        label="Due Date" 
        width="150">
        <template #default="scope">
          {{ scope.row.due_date ? new Date(scope.row.due_date).toLocaleDateString() : '-' }}
        </template>
      </el-table-column>
    </el-table>

    <!-- Add AI Chat Panel -->
    <AIChatPanel
      v-if="showAIChat"
      :goal="selectedGoal"
      @close="showAIChat = false"
    />
  </div>
</template>

<style scoped>
.content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.goals-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.goals-header h2 {
  margin: 0;
  color: #303133;
  font-size: 1.7rem;
  font-weight: 500;
}

/* Responsive styles */
@media (max-width: 640px) {
  .content {
    padding: 1rem;
  }
  
  .goals-header h2 {
    font-size: 1.4rem;
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* Add responsive styles for mobile */
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

.clickable-title {
  cursor: pointer;
  color: #409EFF;
}

.clickable-title:hover {
  text-decoration: underline;
}
</style> 