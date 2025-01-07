<template>
  <div class="activity-log-container">
    <!-- <h2>Hourly Time Logs</h2> -->
    
      <div class="">
        <div class="content">
          <div class="task-logs-list">
            <!-- Header Row -->
            <div class="task-log-header">
              <div class="task-title-section">
                <span class="header-label">Task Name</span>
              </div>
              <div class="matter-section">
                <span class="header-label">Matter</span>
              </div>
              <div class="time-section">
                <span class="header-label">Total Time</span>
              </div>
            </div>

            <!-- Data Rows -->
            <div 
              v-for="group in groupedTimeLogs" 
              :key="group.id" 
              class="task-log-row"
              @click="showTaskDetails(group)"
            >
              <div class="task-title-section">
                <span class="task-name">{{ group.title }}</span>
              </div>
              <div class="matter-section">
                <el-tag size="small" type="info" effect="plain" class="matter-name">
                  {{ group.children[0]?.task?.matter?.title || 'No Matter' }}
                </el-tag>
              </div>
              <div class="time-section">
                <el-tag size="small" type="primary" effect="plain" class="total-time-tag">
                  {{ formatTime(group.totalTime) }}
                </el-tag>
              </div>
            </div>


            <!-- Grand Total Summary Row -->
        <div class="task-log-summary">
          <div class="task-title-section">
            <span class="summary-label">Grand Total</span>
            <span class="summary-details">
              {{ groupedTimeLogs.length }} tasks, 
              {{ getTotalTimeLogsCount }} time entries
            </span>
          </div>
          <div class="matter-section"></div>
          <div class="time-section">
            <el-tag size="default" type="success" class="grand-total-tag">
              {{ formatTime(grandTotalHours) }}
            </el-tag>
          </div>
        </div>


          </div>
        </div>
      </div>
     

    <!-- Task Details Drawer -->
    <el-drawer
      v-model="taskDetailsVisible"
      :title="selectedTask?.title"
      size="700px"
      direction="rtl"
    >
      <template #header>
        <div class="drawer-header">
          <h3>{{ selectedTask?.title }}</h3>
          <div class="drawer-tags">
            <el-tag size="small" type="primary" effect="plain">
              Total Time: {{ selectedTask?.totalTime }}
            </el-tag>
            <el-tag size="small" type="info" effect="plain">
              {{ selectedTask?.children.length }} entries
            </el-tag>
          </div>
        </div>
      </template>

      <div class="task-details-content">
        <el-table 
          :data="selectedTask?.children" 
          style="width: 100%"
          :max-height="'calc(100vh - 200px)'"
        >
          <el-table-column label="Time" width="100" fixed="left">
            <template #default="scope">
              <el-tag size="small" type="success" class="time-tag">
                {{ formatTime(scope.row.time_taken) }}
              </el-tag>
            </template>
          </el-table-column>
          
          <el-table-column label="Date" width="180">
            <template #default="scope">
              <span class="log-date">
                {{ new Date(scope.row.created_at).toLocaleString() }}
              </span>
            </template>
          </el-table-column>
          
          <el-table-column label="Comment" min-width="200">
            <template #default="scope">
              <span class="comment-text">{{ scope.row.comment || '-' }}</span>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-drawer>
  </div>
</template>

<script>
import { supabase } from '../../supabase';
import { ElMessage } from 'element-plus';

export default {
  name: 'AllActivityLogCt',
  data() {
    return {
      timeLogs: [],
      users: [],
      selectedUser: null,
      loading: false,
      taskDetailsVisible: false,
      selectedTask: null
    };
  },
  computed: {
    groupedTimeLogs() {
      const groups = {};
      
      // Group time logs by task
      this.timeLogs.forEach(log => {
        const taskTitle = log.task?.title || 'Untitled Task';
        if (!groups[taskTitle]) {
          groups[taskTitle] = {
            logs: [],
            totalTime: '00:00:00'
          };
        }
        groups[taskTitle].logs.push(log);
        
        // Calculate total time for the group
        const currentTotal = this.parseTime(groups[taskTitle].totalTime);
        const logTime = this.parseTime(log.time_taken);
        groups[taskTitle].totalTime = this.addTimes(currentTotal, logTime);
        //log.grandTotalTime =  this.addTimes(currentTotal, logTime);
      });
      
      // Transform groups into tree structure
      return Object.entries(groups).map(([title, group]) => ({
        id: title, // Using title as ID for the group
        title,
        isGroup: true,
        totalTime: group.totalTime,
        children: group.logs.map(log => ({
          ...log,
          id: log.id, // Ensure each log has a unique ID
          isGroup: false
        }))
      }));
    },
    grandTotalHours() {
      return this.groupedTimeLogs.reduce((total, group) => {

        return this.addTimes(this.parseTime(total), this.parseTime(group.totalTime));
      }, '00:00:00');
    },
    getTotalTimeLogsCount() {
      return this.groupedTimeLogs.reduce((count, group) => {
        return count + group.children.length;
      }, 0);
    }
  },
  methods: {
    async loadAllUsers() {
      try {
        const { data: users, error } = await supabase
          .rpc('get_all_users');

        if (error) throw error;
        this.users = users;
      } catch (error) {
        ElMessage.error('Error loading users: ' + error.message);
      }
    },
    
    async loadTimeLogs() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        this.loading = true;
        
        let query = supabase
          .from('task_hours_logs')
          .select(`
            *,
            task:tasks(
              title,
              matter:matters(title)
            )
          `)
          .eq('user_id',  user.id)
          .order('created_at', { ascending: false });
          
        //if (this.selectedUser) {
          //query = query.eq('user_id', this.selectedUser);
        //}
       
        const { data, error } = await query;
        
        if (error) throw error;
        this.timeLogs = data;
      } catch (error) {
        ElMessage.error('Error loading time logs: ' + error.message);
      } finally {
        this.loading = false;
      }
    },
    
    formatTime(timeString) {
      if (!timeString) return '-';
      const [hours, minutes, seconds] = timeString.split(':').map(Number);
      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      }
      return `${minutes}m`;
    },
    
    parseTime(timeString) {
      if (!timeString) return { hours: 0, minutes: 0, seconds: 0 };
      const [hours, minutes, seconds] = timeString.split(':').map(Number);
      return { hours, minutes, seconds };
    },
    
    addTimes(time1, time2) {
      let totalSeconds = time1.seconds + time2.seconds;
      let totalMinutes = time1.minutes + time2.minutes + Math.floor(totalSeconds / 60);
      let totalHours = time1.hours + time2.hours + Math.floor(totalMinutes / 60);
      
      totalSeconds %= 60;
      totalMinutes %= 60;
      
      return `${String(totalHours).padStart(2, '0')}:${String(totalMinutes).padStart(2, '0')}:${String(totalSeconds).padStart(2, '0')}`;
    },
    
    toggleRow(row) {
      // Toggle the expanded state
      row.expanded = !row.expanded;
      
      // Get the table ref and toggle the row
      const table = this.$refs.timeLogsTable;
      table.toggleRowExpansion(row);
    },
    
    showTaskDetails(task) {
      this.selectedTask = task;
      this.taskDetailsVisible = true;
    }
  },
  mounted() {
    this.loadAllUsers();
    this.loadTimeLogs();
  }
};
</script>

<style scoped>
.activity-log-container {
  padding: 20px;
}

.filters {
  margin-bottom: 20px;
}

.content {
  max-width: 1200px;
  margin: 0 auto;
}
.el-table thead th {
      font-weight: 400;
}

:deep(.el-table) {
  --el-table-border-color: #EBEEF5;
  --el-table-header-bg-color: transparent;
}

.task-group-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 0;
}

.task-title {
  font-weight: 600;
  color: var(--el-text-color-primary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  user-select: none;
}

.task-title:hover {
  color: var(--el-color-primary);
}

.total-time-tag {
  font-weight: 500;
}

.entries-count-tag {
  font-size: 0.85em;
  opacity: 0.8;
}

.time-log-entry {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 0;
}

.time-tag {
  min-width: 70px;
  text-align: center;
}

.log-date {
  color: var(--el-text-color-secondary);
  font-size: 0.9em;
}

.matter-tag {
  font-weight: normal;
}

.comment-text {
  color: var(--el-text-color-regular);
  font-size: 0.95em;
}

:deep(.el-table__row--level-0) {
  background-color: var(--el-fill-color-light);
}

:deep(.el-table__row--level-1) {
  font-size: 0.95em;
}

:deep(.el-table__expand-icon) {
  margin-right: 8px;
}

:deep(.el-table__indent) {
  padding-left: 15px !important;
}

:deep(.el-tag) {
  border-radius: 4px;
}

.el-icon {
  font-size: 14px;
  transition: transform 0.2s;
}

.task-logs-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 20px;
}

.task-log-header {
  display: grid;
  grid-template-columns: 1fr 200px 120px;
  align-items: center;
  padding: 12px 16px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
}

.header-label {
  font-size: 14px;
  letter-spacing: 0.5px;
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

.task-log-row {
  display: grid;
  grid-template-columns: 1fr 200px 120px;
  align-items: center;
  padding: 12px 16px;
  background: white;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  transition: background-color 0.2s ease;
  cursor: pointer;
}

.task-log-row:hover {
  background-color: var(--el-fill-color-light);
}

.task-name {
  font-size: 14px;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.matter-section {
  text-align: center;
}

.time-section {
  text-align: right;
}

.matter-name {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.total-time-tag {
  font-weight: 500;
  min-width: 80px;
  text-align: center;
}


.task-log-summary {
  display: grid;
  grid-template-columns: 1fr 200px 120px;
  align-items: center;
  padding: 16px;
  /* margin-top: 16px; */
  background: var(--el-fill-color-light);
  /* border-top: 2px solid var(--el-border-color-darker); */
  font-weight: 600;
}

.summary-label {
  color: var(--el-text-color-primary);
  font-size: 14px;
  display: block;
}

.summary-details {
  display: block;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  font-weight: normal;
  margin-top: 4px;
}

.grand-total-tag {
  font-weight: 600;
  min-width: 80px;
  text-align: center;
  font-size: 14px;
  background-color: var(--el-color-success-light-9);
  border-color: var(--el-color-success);
}

@media (max-width: 768px) {
  .task-log-row {
    padding: 12px;
  }
  
  .task-metadata {
    gap: 6px;
  }

  .task-log-summary {
    padding: 12px;
  }
  
  .summary-details {
    margin-top: 2px;
  }

}

.drawer-header {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.drawer-header h3 {
  margin: 0;
  font-size: 1.2em;
  color: var(--el-text-color-primary);
}

.drawer-tags {
  display: flex;
  gap: 8px;
  align-items: center;
}

.task-details-content {
  padding: 20px;
  height: 100%;
}

:deep(.el-drawer__header) {
  margin-bottom: 0;
  padding: 20px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

:deep(.el-drawer__body) {
  padding: 0;
  height: calc(100% - 80px);
  overflow: hidden;
}

.time-tag {
  min-width: 70px;
  text-align: center;
}

.log-date {
  color: var(--el-text-color-secondary);
  font-size: 0.9em;
}

.comment-text {
  color: var(--el-text-color-regular);
  font-size: 0.95em;
}
</style> 