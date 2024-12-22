<script>
import { supabase } from '../../supabase';
import { ElMessage } from 'element-plus';
import { useMatterStore } from '../../store/matter';
import { storeToRefs } from 'pinia';

export default {
  setup() {
    const matterStore = useMatterStore();
    const { currentMatter } = storeToRefs(matterStore);
    return { currentMatter };
  },
  data() {
    return {
      events: [],
      loading: false,
      dialogVisible: false,
      newEvent: {
        title: '',
        description: '',
        event_type: 'meeting',
        start_time: null,
        end_time: null,
        location: '',
        attendees: []
      }
    };
  },
  watch: {
    currentMatter: {
      handler(newMatter) {
        if (newMatter) {
          this.loadEvents();
        } else {
          this.events = [];
        }
      },
      immediate: true
    }
  },
  methods: {
    async loadEvents() {
      if (!this.currentMatter) return;
      
      try {
        this.loading = true;
        const { data: events, error } = await supabase
          .from('events')
          .select('*')
          .eq('matter_id', this.currentMatter.id)
          .order('start_time', { ascending: true });

        if (error) throw error;
        this.events = events;
      } catch (error) {
        ElMessage.error('Error loading events: ' + error.message);
      } finally {
        this.loading = false;
      }
    },

    async createEvent() {
      if (!this.currentMatter) {
        ElMessage.warning('Please select a matter first');
        return;
      }

      try {
        this.loading = true;
        const { data: { user } } = await supabase.auth.getUser();
        
        const eventData = {
          ...this.newEvent,
          matter_id: this.currentMatter.id,
          created_by: user.id
        };

        const { data, error } = await supabase
          .from('events')
          .insert([eventData])
          .select();

        if (error) throw error;
        
        this.events.push(data[0]);
        this.dialogVisible = false;
        this.resetForm();
        ElMessage.success('Event created successfully');
      } catch (error) {
        ElMessage.error('Error creating event: ' + error.message);
      } finally {
        this.loading = false;
      }
    },

    resetForm() {
      this.newEvent = {
        title: '',
        description: '',
        event_type: 'meeting',
        start_time: null,
        end_time: null,
        location: '',
        attendees: []
      };
    }
  }
};
</script>

<template>
  <div class="events-container">
    <div class="content">
      <div class="events-header">
        <h2>Events</h2>
        <el-button 
          type="primary" 
          @click="dialogVisible = true"
          :disabled="!currentMatter">
          <el-icon><Plus /></el-icon>
          New Event
        </el-button>
      </div>

      <el-table
        v-loading="loading"
        :data="events"
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
          label="Start Time"
          width="180">
          <template #default="scope">
            {{ new Date(scope.row.start_time).toLocaleString() }}
          </template>
        </el-table-column>
        <el-table-column 
          prop="end_time" 
          label="End Time"
          width="180">
          <template #default="scope">
            {{ new Date(scope.row.end_time).toLocaleString() }}
          </template>
        </el-table-column>
        <el-table-column 
          prop="location" 
          label="Location"
          min-width="150" />
      </el-table>

      <!-- Create Event Dialog -->
      <el-dialog
        v-model="dialogVisible"
        title="Create New Event"
        width="500px">
        <el-form :model="newEvent" label-position="top">
          <el-form-item label="Title" required>
            <el-input v-model="newEvent.title" />
          </el-form-item>
          <el-form-item label="Description">
            <el-input 
              v-model="newEvent.description"
              type="textarea"
              :rows="3" />
          </el-form-item>
          <el-form-item label="Event Type">
            <el-select v-model="newEvent.event_type" style="width: 100%">
              <el-option label="Meeting" value="meeting" />
              <el-option label="Court Hearing" value="court_hearing" />
              <el-option label="Deposition" value="deposition" />
              <el-option label="Client Call" value="client_call" />
              <el-option label="Other" value="other" />
            </el-select>
          </el-form-item>
          <el-form-item label="Start Time" required>
            <el-date-picker
              v-model="newEvent.start_time"
              type="datetime"
              style="width: 100%" />
          </el-form-item>
          <el-form-item label="End Time" required>
            <el-date-picker
              v-model="newEvent.end_time"
              type="datetime"
              style="width: 100%" />
          </el-form-item>
          <el-form-item label="Location">
            <el-input v-model="newEvent.location" />
          </el-form-item>
        </el-form>
        <template #footer>
          <span class="dialog-footer">
            <el-button @click="dialogVisible = false">Cancel</el-button>
            <el-button
              type="primary"
              @click="createEvent"
              :disabled="!newEvent.title || !newEvent.start_time || !newEvent.end_time">
              Create
            </el-button>
          </span>
        </template>
      </el-dialog>
    </div>
  </div>
</template>

<style scoped>
.events-container {
  min-height: 100vh;
  background-color: #f5f7fa;
}

.content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.events-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

h2 {
  color: #303133;
  margin: 0;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style> 