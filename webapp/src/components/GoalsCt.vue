<script>
import HeaderCt from './HeaderCt.vue';
import { supabase } from '../supabase';
import { ElMessage } from 'element-plus';

export default {
  components: { 
    HeaderCt
  },
  data() {
    return {
      goals: [],
      loading: false
    };
  },
  async created() {
    await this.loadGoals();
  },
  methods: {
    async loadGoals() {
      try {
        this.loading = true;
        const { data: goals, error } = await supabase
          .from('goals')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        this.goals = goals;
      } catch (error) {
        ElMessage.error('Error loading goals: ' + error.message);
      } finally {
        this.loading = false;
      }
    }
  }
};
</script>

<template>
  <div class="goals-container">
    <HeaderCt />
    <div class="content">
      <div class="header">
        <h2>Goals</h2>
        <el-button type="primary" size="small">Add Goal</el-button>
      </div>

      <el-table
        v-loading="loading"
        :data="goals"
        style="width: 100%"
        :default-sort="{ prop: 'created_at', order: 'descending' }">
        
        <el-table-column 
          prop="title" 
          label="Title"
          min-width="200" />
          
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
    </div>
  </div>
</template>

<style scoped>
.goals-container {
  min-height: 100vh;
  background-color: #f5f7fa;
}

.content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.header h2 {
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
  
  .header h2 {
    font-size: 1.4rem;
  }
}
</style> 