<template>
  <div class="activity-log-container">
    <h2>Hourly  Time Logs</h2>
    <!-- <div class="filters">
        Select User:
      <el-select
        v-model="selectedUser"
        placeholder="Select user"
        clearable
        @change="loadTimeLogs"
        style="width: 200px">
        <el-option
          v-for="user in users"
          :key="user.id"
          :label="user.email"
          :value="user.id"
        />
      </el-select>
    </div> -->
    
    <div class="content">
      <el-table
        ref="timeLogsTable"
        v-loading="loading"
        :data="groupedTimeLogs"
        row-key="id"
        :tree-props="{ children: 'children', hasChildren: 'hasChildren' }"
        style="width: 100%">
        
        <el-table-column
          prop="title"
          label="Task"
          min-width="300">
          <template #default="scope">
            <template v-if="scope.row.isGroup">
              <div class="task-group-header">
                <span 
                  class="task-title" 
                  @click="toggleRow(scope.row)"
                  role="button"
                >
                  <i 
                    :class="[
                      'el-icon', 
                      scope.row.expanded ? 'el-icon-caret-bottom' : 'el-icon-caret-right'
                    ]"
                  ></i>
                  {{ scope.row.title }}
                </span>
                <el-tag size="small" type="primary" effect="plain" class="total-time-tag">
                  Total: {{ formatTime(scope.row.totalTime) }}
                </el-tag>
                <el-tag size="small" type="info" effect="plain" class="entries-count-tag">
                  {{ scope.row.children.length }} entries
                </el-tag>
              </div>
            </template>
            <template v-else>
              <div class="time-log-entry">
                <el-tag size="small" type="success" class="time-tag">
                  {{ formatTime(scope.row.time_taken) }}
                </el-tag>
                <span class="log-date">{{ new Date(scope.row.created_at).toLocaleString() }}</span>
              </div>
            </template>
          </template>
        </el-table-column>

        <el-table-column
          prop="matter.title"
          label="Matter"
          min-width="200">
          <template #default="scope">
            <template v-if="!scope.row.isGroup">
              <el-tag 
                size="small" 
                effect="plain" 
                class="matter-tag"
              >
                {{ scope.row.task?.matter?.title || 'No Matter' }}
              </el-tag>
            </template>
          </template>
        </el-table-column>
        
        <el-table-column
          prop="comment"
          label="Comment"
          min-width="200">
          <template #default="scope">
            <template v-if="!scope.row.isGroup">
              <span class="comment-text">{{ scope.row.comment || '-' }}</span>
            </template>
          </template>
        </el-table-column>
      </el-table>
    </div>
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
      loading: false
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
  margin-top: 20px;
  background: white;
  padding: 24px;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0,0,0,0.05);
}

:deep(.el-table) {
  --el-table-border-color: #EBEEF5;
  --el-table-header-bg-color: #F5F7FA;
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
</style> 