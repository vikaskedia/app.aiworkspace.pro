<template>
  <div class="dashboard-container">
    <HeaderCt />
    <div class="dashboard-content">
      <router-view v-if="$route.path !== `/matters/${currentMatter?.id}`">
      </router-view>
      <div v-else class="dashboard-overview">
        <h2 class="dashboard-title">Dashboard Overview</h2>
        
        <!-- Goals Section -->
        <div class="dashboard-section">
          <div class="section-header">
            <h3>Recent Goals</h3>
            <el-button 
              type="primary" 
              link 
              @click="$router.push(`/matters/${currentMatter?.id}/goals`)">
              View All Goals
            </el-button>
          </div>
          <el-table
            v-loading="loadingGoals"
            :data="recentGoals"
            style="width: 100%">
            <el-table-column 
              prop="title" 
              label="Title"
              min-width="200" />
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
          </el-table>
        </div>

        <!-- Tasks Section -->
        <div class="dashboard-section">
          <div class="section-header">
            <h3>Recent Tasks</h3>
            <el-button 
              type="primary" 
              link 
              @click="$router.push(`/matters/${currentMatter?.id}/tasks`)">
              View All Tasks
            </el-button>
          </div>
          <el-table
            v-loading="loadingTasks"
            :data="recentTasks"
            style="width: 100%">
            <el-table-column 
              prop="title" 
              label="Title"
              min-width="200" />
            <el-table-column 
              prop="status" 
              label="Status"
              width="120">
              <template #default="scope">
                <el-tag :type="
                  scope.row.status === 'completed' ? 'success' :
                  scope.row.status === 'in_progress' ? 'warning' : 'info'
                ">
                  {{ scope.row.status }}
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

        <!-- Events Section -->
        <div class="dashboard-section">
          <div class="section-header">
            <h3>Upcoming Events</h3>
            <el-button 
              type="primary" 
              link 
              @click="$router.push(`/matters/${currentMatter?.id}/events`)">
              View All Events
            </el-button>
          </div>
          <el-table
            v-loading="loadingEvents"
            :data="upcomingEvents"
            style="width: 100%">
            <el-table-column 
              prop="title" 
              label="Title"
              min-width="200" />
            <el-table-column 
              prop="event_type" 
              label="Type"
              width="120">
              <template #default="scope">
                <el-tag>{{ scope.row.event_type }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column 
              prop="start_time" 
              label="Date"
              width="150">
              <template #default="scope">
                {{ scope.row.start_time ? new Date(scope.row.start_time).toLocaleDateString() : '-' }}
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import HeaderCt from './HeaderCt.vue';
import { supabase } from '../supabase';
import { useMatterStore } from '../store/matter';
import { storeToRefs } from 'pinia';
import { ElMessage } from 'element-plus';

export default {
  name: 'DashboardCt',
  components: {
    HeaderCt
  },
  setup() {
    const matterStore = useMatterStore();
    const { currentMatter } = storeToRefs(matterStore);
    return { currentMatter };
  },
  data() {
    return {
      recentGoals: [],
      recentTasks: [],
      upcomingEvents: [],
      loadingGoals: false,
      loadingTasks: false,
      loadingEvents: false
    };
  },
  watch: {
    currentMatter: {
      handler(newMatter) {
        if (newMatter) {
          this.loadDashboardData();
        } else {
          this.recentGoals = [];
          this.recentTasks = [];
          this.upcomingEvents = [];
        }
      },
      immediate: true
    }
  },
  methods: {
    async loadDashboardData() {
      if (!this.currentMatter) return;
      
      await Promise.all([
        this.loadRecentGoals(),
        this.loadRecentTasks(),
        this.loadUpcomingEvents()
      ]);
    },

    async loadRecentGoals() {
      try {
        this.loadingGoals = true;
        const { data: goals, error } = await supabase
          .from('goals')
          .select('*')
          .eq('matter_id', this.currentMatter.id)
          .order('created_at', { ascending: false })
          .limit(5);

        if (error) throw error;
        this.recentGoals = goals;
      } catch (error) {
        ElMessage.error('Error loading goals: ' + error.message);
      } finally {
        this.loadingGoals = false;
      }
    },

    async loadRecentTasks() {
      try {
        this.loadingTasks = true;
        const { data: tasks, error } = await supabase
          .from('tasks')
          .select('*')
          .eq('matter_id', this.currentMatter.id)
          .order('created_at', { ascending: false })
          .limit(5);

        if (error) throw error;
        this.recentTasks = tasks;
      } catch (error) {
        ElMessage.error('Error loading tasks: ' + error.message);
      } finally {
        this.loadingTasks = false;
      }
    },

    async loadUpcomingEvents() {
      try {
        this.loadingEvents = true;
        const { data: events, error } = await supabase
          .from('events')
          .select('*')
          .eq('matter_id', this.currentMatter.id)
          .gte('start_time', new Date().toISOString())
          .order('start_time', { ascending: true })
          .limit(5);

        if (error) throw error;
        this.upcomingEvents = events;
      } catch (error) {
        ElMessage.error('Error loading events: ' + error.message);
      } finally {
        this.loadingEvents = false;
      }
    }
  }
};
</script>

<style scoped>
.dashboard-container {
  min-height: 100vh;
  background-color: #f5f7fa;
}

.dashboard-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.dashboard-overview {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.dashboard-title {
  color: #303133;
  margin: 0 0 1rem 0;
  font-size: 1.8rem;
  font-weight: 500;
}

.dashboard-section {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.section-header h3 {
  margin: 0;
  color: #303133;
  font-size: 1.2rem;
  font-weight: 500;
}

/* Responsive styles */
@media (max-width: 640px) {
  .dashboard-content {
    padding: 1rem;
  }
  
  .dashboard-title {
    font-size: 1.5rem;
  }
  
  .dashboard-section {
    padding: 1rem;
  }
}
</style>
