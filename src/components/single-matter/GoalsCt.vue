<script>
import { supabase } from '../../supabase';
import { ElMessage } from 'element-plus';
import AIChatPanel from './AIChatPanel.vue';
import { useMatterStore } from '../../store/matter';
import { storeToRefs } from 'pinia';
import { Edit, ChatLineRound } from '@element-plus/icons-vue';
import GoalDetailDrawer from './GoalDetailDrawer.vue';

export default {
  components: { 
    AIChatPanel,
    Edit,
    ChatLineRound,
    GoalDetailDrawer
  },
  setup() {
    const matterStore = useMatterStore();
    const { currentMatter } = storeToRefs(matterStore);
    
    return { currentMatter };
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
        matter_id: null,
        completion_percentage: 0,
      },
      showAIChat: false,
      selectedGoal: null,
      aiLoading: false,
      suggestedTasks: [],
      showTaskSelectionDialog: false,
      selectedTasks: [],
      pythonApiBaseUrl: import.meta.env.VITE_PYTHON_API_URL  || 'http://localhost:3001',
      statusOptions: [
        { value: 'not_started', label: 'Not Started' },
        { value: 'in_progress', label: 'In Progress' },
        { value: 'completed', label: 'Completed' }
      ],
      commentsDialogVisible: false,
      comments: [],
      newComment: '',
      priorityOptions: [
        { value: 'high', label: 'High' },
        { value: 'medium', label: 'Medium' },
        { value: 'low', label: 'Low' }
      ],
      selectedPriority: null,
      goalDetailDrawerVisible: false,
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
        const { data: goals, error } = await supabase
          .from('goals')
          .select('*')
          .eq('matter_id', this.currentMatter.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        this.goals = goals;
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
          related_files: {},
          completion_percentage: this.newGoal.completion_percentage,
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
        
        // Update local state
        this.goals.unshift(data);
        
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
        matter_id: null,
        completion_percentage: 0,
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
                }
                break;
              
              case 'UPDATE':
                const updateIndex = this.goals.findIndex(goal => goal.id === payload.new.id);
                if (updateIndex !== -1) {
                  this.goals[updateIndex] = payload.new;
                }
                break;
              
              case 'DELETE':
                const deleteIndex = this.goals.findIndex(goal => goal.id === payload.old.id);
                if (deleteIndex !== -1) {
                  this.goals.splice(deleteIndex, 1);
                }
                break;
            }
          }
        )
        .subscribe();
    },

    async handleStatusChange(goal, newStatus) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        const { data, error } = await supabase
          .from('goals')
          .update({ 
            status: newStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', goal.id)
          .select()
          .single();

        if (error) throw error;

        // Update local state
        const index = this.goals.findIndex(g => g.id === goal.id);
        if (index !== -1) {
          this.goals[index] = data;
        }
        
        // Close the specific goal's popover
        goal.statusPopoverVisible = false;
        
        ElMessage.success('Goal status updated successfully');
      } catch (error) {
        ElMessage.error('Error updating goal status: ' + error.message);
      }
    },

    async startTitleEdit(goal) {
      goal.isEditingTitle = true;
      goal.editingTitle = goal.title;
      this.$nextTick(() => {
        this.$refs.titleInput?.[0]?.focus();
      });
    },

    async saveTitle(goal) {
      if (!goal.editingTitle?.trim() || goal.editingTitle === goal.title) {
        goal.isEditingTitle = false;
        return;
      }

      try {
        const { data, error } = await supabase
          .from('goals')
          .update({ 
            title: goal.editingTitle,
            updated_at: new Date().toISOString()
          })
          .eq('id', goal.id)
          .select()
          .single();

        if (error) throw error;
        
        goal.title = goal.editingTitle;
        goal.isEditingTitle = false;
        ElMessage.success('Goal title updated successfully');
      } catch (error) {
        ElMessage.error('Error updating goal title: ' + error.message);
      }
    },

    async updateCompletionPercentage(goal) {
      try {
        const { error } = await supabase
          .from('goals')
          .update({ 
            completion_percentage: goal.completion_percentage,
            updated_at: new Date().toISOString()
          })
          .eq('id', goal.id);

        if (error) throw error;
        ElMessage.success('Progress updated successfully');
      } catch (error) {
        ElMessage.error('Error updating progress: ' + error.message);
      }
    },

    async startDescriptionEdit(goal) {
      goal.isEditingDescription = true;
      goal.editingDescription = goal.description || '';
    },

    async saveDescription(goal) {
      if (!goal.editingDescription?.trim() || goal.editingDescription === goal.description) {
        goal.isEditingDescription = false;
        return;
      }

      try {
        const { data, error } = await supabase
          .from('goals')
          .update({ 
            description: goal.editingDescription,
            updated_at: new Date().toISOString()
          })
          .eq('id', goal.id)
          .select()
          .single();

        if (error) throw error;
        
        goal.description = goal.editingDescription;
        goal.isEditingDescription = false;
        ElMessage.success('Goal description updated successfully');
      } catch (error) {
        ElMessage.error('Error updating goal description: ' + error.message);
      }
    },

    cancelDescriptionEdit(goal) {
      goal.isEditingDescription = false;
      goal.editingDescription = '';
    },

    getPriorityType(goal) {
      if (!goal?.priority) return '';
      switch (goal.priority) {
        case 'high': return 'danger';
        case 'medium': return 'warning';
        case 'low': return 'info';
        default: return '';
      }
    },

    formatPriority(priority) {
      if (!priority) return 'Not set';
      return priority.charAt(0).toUpperCase() + priority.slice(1);
    },

    async handlePriorityChange(goal, newPriority) {
      try {
        const { error } = await supabase
          .from('goals')
          .update({ 
            priority: newPriority,
            updated_at: new Date().toISOString()
          })
          .eq('id', goal.id);

        if (error) throw error;

        goal.priority = newPriority;
        goal.priorityPopoverVisible = false;
        ElMessage.success('Goal priority updated successfully');
      } catch (error) {
        ElMessage.error('Error updating goal priority: ' + error.message);
      }
    },

    initializeTempDueDate(goal) {
      goal.tempDueDate = goal.due_date ? new Date(goal.due_date) : null;
    },

    async updateDueDate(goal) {
      try {
        const { error } = await supabase
          .from('goals')
          .update({ 
            due_date: goal.tempDueDate,
            updated_at: new Date().toISOString()
          })
          .eq('id', goal.id);

        if (error) throw error;

        goal.due_date = goal.tempDueDate;
        goal.dueDatePopoverVisible = false;
        ElMessage.success('Due date updated successfully');
      } catch (error) {
        ElMessage.error('Error updating due date: ' + error.message);
      }
    },

    openGoalDetails(goal) {
      this.selectedGoal = goal;
      this.goalDetailDrawerVisible = true;
    },
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
            class="goal-description-input"
            type="textarea"
            :rows="3"
            placeholder="Enter goal description" />
        </el-form-item>
        
        <el-form-item label="Status">
          <el-select v-model="newGoal.status" style="width: 100%" class="goal-status-input">
            <el-option label="In Progress" value="in_progress" />
            <el-option label="Completed" value="completed" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="Priority">
          <el-select v-model="newGoal.priority" style="width: 100%" class="goal-priority-input">
            <el-option label="High" value="high" />
            <el-option label="Medium" value="medium" />
            <el-option label="Low" value="low" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="Due Date" class="goal-due-date-input">
          <el-date-picker
            v-model="newGoal.due_date"
            type="datetime"
            style="width: 100%"
            placeholder="Select due date" />
        </el-form-item>

        <el-form-item label="Completion Percentage">
          <el-slider
            v-model="newGoal.completion_percentage"
            :step="5"
            :marks="{
              0: '0%',
              25: '25%',
              50: '50%',
              75: '75%',
              100: '100%'
            }"
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false" class="goal-cancel-button">Cancel</el-button>
          <el-button
            type="primary"
            :loading="loading"
            :disabled="!newGoal.title" 
            class="goal-create-button"
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
        min-width="150">
        <template #default="scope">
          <div v-if="scope.row.isEditingTitle">
            <el-input
              v-model="scope.row.editingTitle"
              @blur="saveTitle(scope.row)"
              @keyup.enter="saveTitle(scope.row)"
              ref="titleInput"
            />
          </div>
          <div v-else class="editable-field">
            <span 
              class="clickable-title"
              @click="openGoalDetails(scope.row)">
              {{ scope.row.title }}
            </span>
            <el-icon class="edit-icon" @click="startTitleEdit(scope.row)"><Edit /></el-icon>
          </div>
        </template>
      </el-table-column>
        
      <el-table-column 
        prop="description" 
        label="Description" 
        min-width="200">
        <template #default="scope">
          <div v-if="scope.row.isEditingDescription">
            <el-input
              v-model="scope.row.editingDescription"
              type="textarea"
              :rows="2"
              @blur="saveDescription(scope.row)"
            />
            <div class="description-edit-actions">
              <el-button @click="cancelDescriptionEdit(scope.row)" size="small">Cancel</el-button>
              <el-button 
                type="primary" 
                @click="saveDescription(scope.row)" 
                size="small"
                :disabled="!scope.row.editingDescription?.trim() || scope.row.editingDescription === scope.row.description"
              >
                Save
              </el-button>
            </div>
          </div>
          <div v-else class="editable-field" @click="startDescriptionEdit(scope.row)">
            {{ scope.row.description || 'Add description...' }}
            <el-icon class="edit-icon"><Edit /></el-icon>
          </div>
        </template>
      </el-table-column>
        
      <el-table-column 
        prop="status" 
        label="Status" 
        width="120">
        <template #default="scope">
          <el-popover
            placement="bottom"
            :width="200"
            trigger="click"
            v-model:visible="scope.row.statusPopoverVisible">
            <template #reference>
              <el-tag 
                :type="scope.row.status === 'completed' ? 'success' : 'warning'"
                class="clickable-status">
                {{ scope.row.status }}
              </el-tag>
            </template>
            <div class="status-options">
              <div 
                v-for="status in statusOptions" 
                :key="status.value"
                class="status-option"
                @click="handleStatusChange(scope.row, status.value)">
                <el-tag :type="status.value === 'completed' ? 'success' : 'warning'">
                  {{ status.label }}
                </el-tag>
              </div>
            </div>
          </el-popover>
        </template>
      </el-table-column>
      
      <el-table-column prop="priority" label="Priority" width="100">
        <template #default="scope">
          <el-popover
            ref="priorityPopover"
            placement="bottom"
            :width="200"
            trigger="click"
            v-model:visible="scope.row.priorityPopoverVisible">
            <template #reference>
              <el-tag 
                :type="getPriorityType(scope.row)"
                class="clickable-status">
                {{ formatPriority(scope.row.priority) }}
              </el-tag>
            </template>
            <div class="status-options">
              <div 
                v-for="priority in priorityOptions" 
                :key="priority.value"
                class="status-option"
                @click="handlePriorityChange(scope.row, priority.value)">
                <el-tag :type="getPriorityType({ priority: priority.value })">
                  {{ priority.label }}
                </el-tag>
              </div>
            </div>
          </el-popover>
        </template>
      </el-table-column>
      
      <el-table-column prop="due_date" label="Due Date" width="140">
        <template #default="scope">
          <el-popover
            placement="bottom"
            trigger="click"
            :width="240"
            v-model:visible="scope.row.dueDatePopoverVisible"
            @show="initializeTempDueDate(scope.row)">
            <template #reference>
              <div class="editable-field">
                {{ scope.row.due_date ? new Date(scope.row.due_date).toLocaleDateString() : 'Set due date' }}
                <el-icon class="edit-icon"><Edit /></el-icon>
              </div>
            </template>
            <div class="due-date-editor">
              <el-date-picker
                v-model="scope.row.tempDueDate"
                type="datetime"
                placeholder="Select date and time"
                format="YYYY-MM-DD HH:mm"
                :clearable="true"
                @change="updateDueDate(scope.row)"
              />
            </div>
          </el-popover>
        </template>
      </el-table-column>

      <el-table-column prop="completion_percentage" label="Progress" width="150">
        <template #default="scope">
          <el-popover
            placement="bottom"
            :width="300"
            trigger="click">
            <template #reference>
              <div class="progress-bar-wrapper">
                <el-progress 
                  :percentage="scope.row.completion_percentage"
                  :status="scope.row.completion_percentage === 100 ? 'success' : ''"
                />
              </div>
            </template>
            <el-slider
              v-model="scope.row.completion_percentage"
              :step="5"
              @change="updateCompletionPercentage(scope.row)"
              :marks="{
                0: '0%',
                25: '25%',
                50: '50%',
                75: '75%',
                100: '100%'
              }"
            />
          </el-popover>
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
          <el-button @click="showTaskSelectionDialog = false" class="task-suggestion-cancel-button">Cancel</el-button>
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

    <GoalDetailDrawer
      v-model="goalDetailDrawerVisible"
      :goal="selectedGoal"
    />
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
  color: var(--el-color-primary);
  transition: color 0.3s;
}

.clickable-title:hover {
  color: var(--el-color-primary-light-3);
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

.status-options {
  display: flex;
  flex-wrap: wrap;
  flex-direction: column;
  gap: 8px;
}

.status-option {
  cursor: pointer;
}

.clickable-status {
  cursor: pointer;
}

.comments-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.comments-list {
  max-height: 400px;
  overflow-y: auto;
}

.comment {
  padding: 1rem;
  border: 1px solid var(--el-border-color-light);
  border-radius: 4px;
  margin-bottom: 0.5rem;
}

.comment-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  font-size: 0.9em;
  color: var(--el-text-color-secondary);
}

.comment-input {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.editable-field {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px;
}

.editable-field:hover {
  background-color: var(--el-bg-color-page);
}

.edit-icon {
  opacity: 0;
  transition: opacity 0.3s;
}

.editable-field:hover .edit-icon {
  opacity: 1;
}

.progress-bar-wrapper {
  padding: 8px;
  cursor: pointer;
}

.description-edit-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  justify-content: flex-end;
}

.due-date-editor {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.due-date-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style> 