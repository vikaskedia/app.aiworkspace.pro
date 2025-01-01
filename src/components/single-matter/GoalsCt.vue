<script>
import { supabase } from '../../supabase';
import { ElMessage } from 'element-plus';
import AIChatPanel from './AIChatPanel.vue';
import { useMatterStore } from '../../store/matter';
import { storeToRefs } from 'pinia';
import { useCacheStore } from '../../store/cache';

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
      aiLoading: false,
      suggestedTasks: [],
      showTaskSelectionDialog: false,
      selectedTasks: [],
      pythonApiBaseUrl: import.meta.env.VITE_PYTHON_API_URL  || 'http://localhost:3001'
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
        
        // First verify matter_access exists and has edit rights
        const { data: accessCheck, error: accessError } = await supabase
          .from('matter_access')
          .select('access_type')
          .eq('matter_id', this.currentMatter.id)
          .eq('shared_with_user_id', user.id)
          .eq('access_type', 'edit')
          .single();

        if (accessError || !accessCheck) {
          throw new Error('You do not have edit access to this matter');
        }

        const goalData = {
          title: this.newGoal.title,
          description: this.newGoal.description,
          status: this.newGoal.status || 'in_progress',
          priority: this.newGoal.priority || 'medium',
          due_date: this.newGoal.due_date || null,
          matter_id: this.currentMatter.id,
          created_by: user.id,
          related_files: {}
        };

        const { data, error } = await supabase
          .from('goals')
          .insert([goalData])
          .select()
          .single();

        if (error) {
          console.error('Full error:', error);
          throw error;
        }

        // Get AI suggested tasks
        await this.generateAITasks(data);
        
        // Update local state and cache
        this.goals.unshift(data);
        const cachedGoals = this.cacheStore.getCachedData('goals', this.currentMatter.id) || [];
        this.cacheStore.setCachedData('goals', this.currentMatter.id, [data, ...cachedGoals]);
        
        this.dialogVisible = false;
        this.resetForm();
        ElMessage.success('Goal created successfully');
      } catch (error) {
        console.error('Full error:', error);
        ElMessage.error('Error creating goal: ' + error.message);
      } finally {
        this.loading = false;
      }
    },

    async generateAITasks(goal) {
      try {
        this.aiLoading = true;
        
        // Create system prompt for task generation
        const systemPrompt = `You are an AI legal assistant. A new goal has been created with the following details:
        Title: ${goal.title}
        Description: ${goal.description || 'No description provided'}
        Priority: ${goal.priority}
        Due Date: ${goal.due_date ? new Date(goal.due_date).toLocaleDateString() : 'No due date'}
        
        Please suggest a list of tasks that would help achieve this goal. Each task should include:
        - title
        - description
        - priority (high/medium/low)
        - timeline
        
        Return only a JSON array of tasks without any markdown formatting or code block syntax.`;

        const response = await fetch(`${this.pythonApiBaseUrl}/gpt/get_ai_response`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            systemPrompt,
            prompt: "Generate a list of tasks to achieve this goal",
            goalId: goal.id,
            matterId: goal.matter_id
          })
        });

        if (!response.ok) throw new Error('Failed to get AI response');
        
        const data = await response.json();
        
        // Clean up the response by removing any markdown code block syntax
        const cleanResponse = data.response.replace(/```json\s*|\s*```/g, '').trim();
        const suggestedTasks = JSON.parse(cleanResponse);
        
        // Show task selection dialog
        this.suggestedTasks = suggestedTasks;
        this.showTaskSelectionDialog = true;
      } catch (error) {
        ElMessage.error('Error generating tasks: ' + error.message);
      } finally {
        this.aiLoading = false;
      }
    },

    async createSelectedTasks() {
      try {
        this.loading = true;
        const { data: { user } } = await supabase.auth.getUser();

        for (const task of this.selectedTasks) {
          const taskData = {
            title: task.title,
            description: task.description,
            status: 'not_started',
            priority: task.priority,
            matter_id: this.currentMatter.id,
            created_by: user.id,
            due_date: task.due_date
          };

          await supabase
            .from('tasks')
            .insert([taskData])
            .select();
        }

        this.showTaskSelectionDialog = false;
        this.selectedTasks = [];
        ElMessage.success('Tasks created successfully');
      } catch (error) {
        ElMessage.error('Error creating tasks: ' + error.message);
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
                // Check if goal already exists before adding
                if (!this.goals.some(goal => goal.id === payload.new.id)) {
                  this.goals.unshift(payload.new);
                  this.cacheStore.setCachedData('goals', this.currentMatter.id, this.goals);
                }
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
  <div class="goals-container">
    <div class="goals-header">
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
            :rows="3"
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

    <!-- AI Task Selection Dialog -->
    <el-dialog
      v-model="showTaskSelectionDialog"
      title="Select Tasks to Create"
      width="600px">
      <p>The AI has suggested the following tasks to achieve your goal:</p>
      
      <el-checkbox-group v-model="selectedTasks">
        <div v-for="task in suggestedTasks" :key="task.title" class="task-suggestion">
          <el-checkbox :label="task" class="task-checkbox">
            <div class="task-details">
              <h4>{{ task.title }}</h4>
              <p>{{ task.description }}</p>
              <div class="task-meta">
                <el-tag size="small" :type="task.priority === 'high' ? 'danger' : task.priority === 'medium' ? 'warning' : 'info'">
                  {{ task.priority }}
                </el-tag>
                <span>Timeline: {{ task.timeline }}</span>
              </div>
            </div>
          </el-checkbox>
        </div>
      </el-checkbox-group>

      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showTaskSelectionDialog = false">Cancel</el-button>
          <el-button
            type="primary"
            @click="createSelectedTasks"
            :loading="loading"
            :disabled="!selectedTasks.length">
            Create Selected Tasks
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.goals-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.goals-header h2 {
  margin: 0;
  color: #303133;
  font-size: 1.7rem;
  font-weight: 500;
}

/* Responsive styles */
@media (max-width: 640px) {
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

.task-suggestion {
  margin-bottom: 16px;
  padding: 8px;
  border: 1px solid #eee;
  border-radius: 4px;
}

.task-suggestion:hover {
  background-color: #f9f9f9;
}

.task-checkbox {
  width: 100%;
  display: inline-block;
  align-items: flex-start;
}

.task-details {
  margin-left: 8px;
  flex: 1;
}

.task-details h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 500;
}

.task-details p {
  margin: 0 0 8px 0;
  color: #666;
  font-size: 13px;
  line-height: 1.4;
  white-space: pre-line;
  word-break: break-word;
}

.task-meta {
  display: flex;
  gap: 12px;
  align-items: center;
  font-size: 0.9em;
  color: #666;
}
</style> 