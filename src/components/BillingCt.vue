<script>
import { supabase } from '../supabase';
import { ElMessage } from 'element-plus';
import { ref, onMounted, computed } from 'vue';
import { useMatterStore } from '../store/matter';

export default {
  name: 'BillingCt',
  setup() {
    const loading = ref(false);
    const workHours = ref([]);
    const matters = ref([]);
    const users = ref([]);
    const dialogVisible = ref(false);
    const form = ref({
      matter_id: '',
      hours: 0,
      minutes: 0,
      description: ''
    });

    // Filter states
    const selectedMatter = ref('');
    const dateRange = ref([]);
    const selectedUser = ref('');

    const filteredWorkHours = computed(() => {
      return workHours.value.filter(record => {
        const matterMatch = !selectedMatter.value || record.matter_id === selectedMatter.value;
        const userMatch = !selectedUser.value || record.user_id === selectedUser.value;
        
        // Date range filtering
        if (dateRange.value && dateRange.value.length === 2) {
          const recordDate = new Date(record.created_at);
          const startDate = new Date(dateRange.value[0]);
          const endDate = new Date(dateRange.value[1]);
          
          // Set end date to end of day
          endDate.setHours(23, 59, 59, 999);
          
          const dateMatch = recordDate >= startDate && recordDate <= endDate;
          return matterMatch && userMatch && dateMatch;
        }
        
        return matterMatch && userMatch;
      });
    });

    const totalTime = computed(() => {
      const totalMinutes = filteredWorkHours.value.reduce((sum, record) => sum + record.minutes, 0);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return { hours, minutes, totalMinutes };
    });

    const loadWorkHours = async () => {
      loading.value = true;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
          .from('work_hours')
          .select(`
            *,
            matters (
              title
            )
          `)
          .order('created_at', { ascending: false });

        if (error) throw error;
        workHours.value = data;
        
        // Set default user filter to current user
        selectedUser.value = user.id;
      } catch (error) {
        ElMessage.error('Error loading work hours: ' + error.message);
      } finally {
        loading.value = false;
      }
    };

    const loadMatters = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
          .from('matters')
          .select(`
            *,
            matter_access!inner (
              access_type,
              shared_with_user_id
            )
          `)
          .eq('archived', false)
          .eq('matter_access.shared_with_user_id', user.id);

        if (error) throw error;
        matters.value = data;
      } catch (error) {
        ElMessage.error('Error loading matters: ' + error.message);
      }
    };

    const loadUsers = async () => {
      try {
        // Get all users from the work_hours table
        const { data: workHoursData, error: workHoursError } = await supabase
          .from('work_hours')
          .select('user_id')
          .order('created_at', { ascending: false });

        if (workHoursError) throw workHoursError;

        // Create a unique list of users from work hours
        const uniqueUsers = Array.from(new Set(workHoursData.map(wh => wh.user_id)))
          .map(userId => ({
            id: userId,
            full_name: `User ${userId.slice(0, 8)}` // Using a truncated user ID as display name
          }));

        users.value = uniqueUsers;
      } catch (error) {
        ElMessage.error('Error loading users: ' + error.message);
      }
    };

    const handleSubmit = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const totalMinutes = (form.value.hours * 60) + form.value.minutes;
        
        const { error } = await supabase
          .from('work_hours')
          .insert([{
            user_id: user.id,
            matter_id: form.value.matter_id,
            minutes: totalMinutes,
            description: form.value.description
          }]);

        if (error) throw error;

        ElMessage.success('Work hours logged successfully');
        dialogVisible.value = false;
        form.value = {
          matter_id: '',
          hours: 0,
          minutes: 0,
          description: ''
        };
        await loadWorkHours();
      } catch (error) {
        ElMessage.error('Error logging work hours: ' + error.message);
      }
    };

    onMounted(() => {
      loadWorkHours();
      loadMatters();
      loadUsers();
    });

    return {
      loading,
      workHours,
      matters,
      users,
      dialogVisible,
      form,
      handleSubmit,
      totalTime,
      selectedMatter,
      dateRange,
      selectedUser,
      filteredWorkHours
    };
  }
};
</script>

<template>
  <div class="billing-container">
    <div class="billing-header">
      <h1>Work Hours</h1>
      <el-button type="primary" @click="dialogVisible = true">
        Add Work Hours
      </el-button>
    </div>
    
    <div class="filters-section">
      <div class="filter-controls">
        <el-select
          v-model="selectedUser"
          placeholder="Filter by user"
          clearable
          style="width: 200px"
        >
          <el-option
            v-for="user in users"
            :key="user.id"
            :label="user.full_name"
            :value="user.id"
          />
        </el-select>

        <el-select
          v-model="selectedMatter"
          placeholder="Filter by matter"
          clearable
          style="width: 200px"
        >
          <el-option
            v-for="matter in matters"
            :key="matter.id"
            :label="matter.title"
            :value="matter.id"
          />
        </el-select>

        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="To"
          start-placeholder="Start date"
          end-placeholder="End date"
          :shortcuts="[
            {
              text: 'Last week',
              value: () => {
                const end = new Date();
                const start = new Date();
                start.setTime(start.getTime() - 3600 * 1000 * 24 * 7);
                return [start, end];
              },
            },
            {
              text: 'Last month',
              value: () => {
                const end = new Date();
                const start = new Date();
                start.setTime(start.getTime() - 3600 * 1000 * 24 * 30);
                return [start, end];
              },
            },
            {
              text: 'Last 3 months',
              value: () => {
                const end = new Date();
                const start = new Date();
                start.setTime(start.getTime() - 3600 * 1000 * 24 * 90);
                return [start, end];
              },
            },
          ]"
        />
      </div>
    </div>
    
    <div v-if="loading" class="loading-state">
      <el-skeleton :rows="3" animated />
    </div>
    
    <div v-else class="billing-content">
      <el-table :data="filteredWorkHours" style="width: 100%">
        <el-table-column prop="matters.title" label="Matter" min-width="200" />
        <el-table-column label="Time" width="150">
          <template #default="scope">
            {{ Math.floor(scope.row.minutes / 60) }}h {{ scope.row.minutes % 60 }}m
          </template>
        </el-table-column>
        <el-table-column prop="description" label="Description" min-width="300" />
        <el-table-column label="Added By" width="180">
          <template #default="scope">
            {{ `User ${scope.row.user_id.slice(0, 8)}` }}
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="Date" width="180">
          <template #default="scope">
            {{ new Date(scope.row.created_at).toLocaleString() }}
          </template>
        </el-table-column>
      </el-table>

      <div class="table-summary">
        <div class="summary-row">
          <span class="summary-label">Total Time:</span>
          <span class="summary-value">{{ totalTime.hours }}h {{ totalTime.minutes }}m</span>
        </div>
      </div>
    </div>

    <el-dialog
      v-model="dialogVisible"
      title="Add Work Hours"
      width="500px"
    >
      <el-form :model="form" label-width="120px">
        <el-form-item label="Matter">
          <el-select v-model="form.matter_id" placeholder="Select matter" style="width: 100%">
            <el-option
              v-for="matter in matters"
              :key="matter.id"
              :label="matter.title"
              :value="matter.id"
            />
          </el-select>
        </el-form-item>
        
        <el-form-item label="Hours">
          <el-input-number v-model="form.hours" :min="0" :max="24" />
        </el-form-item>
        
        <el-form-item label="Minutes">
          <el-input-number v-model="form.minutes" :min="0" :max="59" />
        </el-form-item>
        
        <el-form-item label="Description">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="3"
            placeholder="Enter work description"
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">Cancel</el-button>
          <el-button type="primary" @click="handleSubmit">
            Save
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.billing-container {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.billing-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.billing-content {
  margin-top: 2rem;
}

.loading-state {
  margin-top: 2rem;
}

h1 {
  font-size: 1.8rem;
  font-weight: 500;
  color: #1a1a1a;
  margin: 0;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.table-summary {
  margin-top: 1rem;
  background: linear-gradient(to right, #f0f7ff, #e6f3ff);
  border: 1px solid #ccd9e5;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
}

.summary-row {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 1.5rem;
}

.summary-label {
  font-weight: 600;
  color: #409EFF;
  font-size: 1.1em;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.summary-value {
  font-weight: 700;
  color: #1a1a1a;
  font-size: 1.3em;
  background-color: white;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.filters-section {
  margin: 1.5rem 0;
  padding: 1rem;
  background-color: #f5f7fa;
  border-radius: 4px;
  border: 1px solid #e4e7ed;
}

.filter-controls {
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
}

@media (max-width: 640px) {
  .billing-container {
    padding: 1rem;
  }
  
  .billing-header {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }
  
  .dialog-footer {
    flex-direction: column;
    gap: 8px;
  }
  
  .dialog-footer .el-button {
    width: 100%;
  }
  
  .table-summary {
    margin-top: 0.75rem;
    padding: 1rem;
  }
  
  .summary-row {
    flex-direction: column;
    align-items: flex-end;
    gap: 0.75rem;
  }

  .summary-label {
    font-size: 1em;
  }

  .summary-value {
    font-size: 1.2em;
    padding: 0.4rem 0.8rem;
  }

  .filters-section {
    margin: 1rem 0;
    padding: 0.75rem;
  }

  .filter-controls {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-controls .el-select,
  .filter-controls .el-date-picker {
    width: 100% !important;
  }
}
</style> 