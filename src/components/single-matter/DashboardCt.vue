<template>
  <div class="dashboard-overview">
    <!-- Goals Section -->
    <div class="dashboard-section">
      <div class="section-header">
        <h3>Recent Goals</h3>
        <el-button 
          type="primary" 
          link 
          @click="$router.push(`/single-matter/${currentMatter?.id}/goals`)">
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
          v-if="!currentMatter"
          prop="matter_title" 
          label="Matter"
          min-width="150" />
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
          @click="$router.push(`/single-matter/${currentMatter?.id}/tasks`)">
          View All Tasks
        </el-button>
      </div>
      <div class="recent-task" v-for="task in recentTasks" :key="task.id" 
           @click="navigateToTask(task)" 
           style="cursor: pointer">
        <div class="task-title">{{ task.title }}</div>
        <div class="task-timestamps">
          <el-tooltip>
            <template #content>
              Created: {{ new Date(task.created_at).toLocaleString() }}<br>
              Latest Activity: {{ new Date(task.latest_activity_time).toLocaleString() }}
            </template>
            <span class="time-ago">{{ task.latestActivityTimeAgo }}</span>
          </el-tooltip>
        </div>
      </div>
    </div>

    <!-- Events Section -->
    <div class="dashboard-section">
      <div class="section-header">
        <h3>Upcoming Events</h3>
        <el-button 
          type="primary" 
          link 
          @click="$router.push(`/single-matter/${currentMatter?.id}/events`)">
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
          v-if="!currentMatter"
          prop="matter_title" 
          label="Matter"
          min-width="150" />
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
</template>

<script>
import { supabase } from '../../supabase';
import { useMatterStore } from '../../store/matter';
import { storeToRefs } from 'pinia';
import { ElMessage } from 'element-plus';

export default {
  name: 'DashboardCt',
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
        const { data: recentTasks, error } = await supabase
          .rpc('get_recent_tasks_with_activity', {
            p_matter_id: this.currentMatter.id
          });

        if (error) throw error;
        
        // Add relative time for both creation and latest activity
        this.recentTasks = recentTasks.map(task => ({
          ...task,
          createdTimeAgo: this.getRelativeTime(task.created_at),
          latestActivityTimeAgo: this.getRelativeTime(task.latest_activity_time)
        }));
      } catch (error) {
        ElMessage.error('Error loading recent tasks: ' + error.message);
      }
    },

    getRelativeTime(timestamp) {
      const date = new Date(timestamp);
      const now = new Date();
      const diffInSeconds = Math.floor((now - date) / 1000);
      
      if (diffInSeconds < 60) return 'just now';
      if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
      if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
      if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
      return date.toLocaleDateString();
    },

    async loadUpcomingEvents() {
      try {
        this.loadingEvents = true;
        const { data: events, error } = await supabase
          .from('events')
          .select('*')
          .eq('matter_id', this.currentMatter.id)
          //.gte('start_time', new Date().toISOString())
          .order('start_time', { ascending: true })
          .limit(5);

        if (error) throw error;
        this.upcomingEvents = events;
      } catch (error) {
        ElMessage.error('Error loading events: ' + error.message);
      } finally {
        this.loadingEvents = false;
      }
    },

    formatStatus(status) {
      const statusMap = {
        'in_progress': 'In progress',
        'not_started': 'Not started',
        'completed': 'Completed',
        'awaiting_external': 'Awaiting external factor'
      };
      return statusMap[status] || status;
    },

    navigateToTask(task) {
      this.$router.push({
        name: 'SingleTaskPage',
        params: {
          matterId: task.matter_id,
          taskId: task.id
        }
      });
    }
  }
};
</script>

<style scoped>
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
  .dashboard-section {
    padding: 1rem;
  }
  
  .dashboard-title {
    font-size: 1.5rem;
  }
}

.clickable-title {
  cursor: pointer;
  color: #409EFF;
}

.clickable-title:hover {
  text-decoration: underline;
}

.recent-task {
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 1px solid #EBEEF5;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.recent-task:hover {
  background-color: #F5F7FA;
  border-color: #DCDFE6;
  transform: translateX(2px);
}

.task-title {
  color: #409EFF;
  font-weight: 500;
}

.task-timestamps {
  color: #909399;
  font-size: 0.9em;
}

.time-ago {
  color: #909399;
}
</style>
