<template>
  <div class="single-event-view" v-if="event">
    <div class="event-header">
      <div class="back-button">
        <el-button 
          type="primary" 
          link 
          @click="$router.push(`/single-workspace/${matterId}/events`)">
          <el-icon><ArrowLeft /></el-icon>
          Back to Events
        </el-button>
      </div>
    </div>

    <div class="event-content-wrapper" v-loading="loading">
      <div class="event-main-content">
        <div class="event-main-info">
          <h2>{{ event.title }}</h2>
          <div class="event-details-box">
            <!-- Event Type Dropdown -->
            <div class="event-detail-item">
              <div>
                <div class="field-label"><el-icon><Calendar /></el-icon><span>Event Type</span></div>
                <div class="field-value">
                  <span>{{ eventTypeLabel }}</span>
                  <el-popover
                    placement="bottom"
                    width="200"
                    trigger="click"
                    v-model:visible="editing.eventType">
                    <el-select v-model="event.event_type" @change="saveEventField('event_type', event.event_type)">
                      <el-option label="Meeting" value="meeting" />
                      <el-option label="Court Hearing" value="court_hearing" />
                      <el-option label="Deposition" value="deposition" />
                      <el-option label="Client Call" value="client_call" />
                      <el-option label="Google Calendar Event" value="google_calendar_event" />
                      <el-option label="Other" value="other" />
                    </el-select>
                    <template #reference>
                      <el-icon class="edit-icon" @click="toggleEventTypePopover"><Edit /></el-icon>
                    </template>
                  </el-popover>
                </div>
              </div>
            </div>

            <!-- Start Time Date Picker -->
            <div class="event-detail-item">
              <div>
                <div class="field-label"><el-icon><Clock /></el-icon><span>Start Time</span></div>
                <div class="field-value">
                  <span>{{ new Date(event.start_time).toLocaleString() }}</span>
                  <el-popover
                    placement="bottom"
                    width="250"
                    trigger="click"
                    v-model:visible="editing.startTime">
                    <el-date-picker v-model="event.start_time" type="datetime" @change="saveEventField('start_time', event.start_time)" />
                    <template #reference>
                      <el-icon class="edit-icon" @click="toggleStartTimePopover"><Edit /></el-icon>
                    </template>
                  </el-popover>
                </div>
              </div>
            </div>

            <!-- End Time Date Picker -->
            <div class="event-detail-item">
              <div>
                <div class="field-label"><el-icon><Clock /></el-icon><span>End Time</span></div>
                <div class="field-value">
                  <span>{{ new Date(event.end_time).toLocaleString() }}</span>
                  <el-popover
                    placement="bottom"
                    width="250"
                    trigger="click"
                    v-model:visible="editing.endTime">
                    <el-date-picker v-model="event.end_time" type="datetime" @change="saveEventField('end_time', event.end_time)" />
                    <template #reference>
                      <el-icon class="edit-icon" @click="toggleEndTimePopover"><Edit /></el-icon>
                    </template>
                  </el-popover>
                </div>
              </div>
            </div>

            <!-- Assigned To Typeahead Dropdown -->
            <div class="event-detail-item">
              <div>
                <div class="field-label"><el-icon><User /></el-icon><span>Added by</span></div>
                <div class="field-value">
                  <span>{{ addedByEmail }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Description Text Area -->
          <div class="event-title-description">
            <h3 class="field-label"><strong>Description</strong></h3>
            <div class="field-value" @mouseenter="showEdit.description = true" @mouseleave="showEdit.description = false">
              <p v-if="!editing.description">{{ event.description || 'No description added' }}</p>
              <el-input
                v-else
                v-model="event.description"
                type="textarea"
                :rows="3"
                @blur="handleDescriptionBlur"
              />
              <el-icon 
                v-if="showEdit.description && !editing.description" 
                class="edit-icon" 
                @click="editing.description = true">
                <Edit />
              </el-icon>
              <el-icon 
                v-else-if="editing.description" 
                class="edit-icon" 
                @click="cancelDescriptionEdit">
                <Close />
              </el-icon>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div v-else>
    <p>Loading event details...</p>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { supabase } from '../../supabase';
import { ArrowLeft, Calendar, Clock, User, Edit, Close } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';

export default {
  components: {
    ArrowLeft,
    Calendar,
    Clock,
    User,
    Edit,
    Close
  },
  setup() {
    const route = useRoute();
    const event = ref(null);
    const loading = ref(true);
    const matterId = ref(route.params.matterId);
    const addedByEmail = ref('');
    const editing = ref({
      eventType: false,
      startTime: false,
      endTime: false,
      addedByEmail: false,
      description: false
    });
    const showEdit = ref({
      eventType: false,
      startTime: false,
      endTime: false,
      addedByEmail: false,
      description: false
    });

    const fetchEventDetails = async (eventId) => {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('id', eventId)
          .single();

        if (error) {
          console.error('Error fetching event:', error);
        } else {
          event.value = data;
          fetchUserName(data.created_by);
        }
      } catch (err) {
        console.error('Unexpected error:', err);
      } finally {
        loading.value = false;
      }
    };

    const fetchUserName = async (userId) => {
      try {
        const { data, error } = await supabase
          .rpc('get_user_info_by_id', { user_id: userId });

        if (error) {
          console.error('Error fetching user detail:', error);
        } else if (data && data.length > 0) {
          addedByEmail.value = data[0].email;
        }
      } catch (err) {
        console.error('Unexpected error:', err);
      }
    };

    const toggleEventTypePopover = () => {
      console.log('Toggling eventType popover:', !editing.eventType);
      editing.eventType = !editing.eventType;
    };

    const toggleStartTimePopover = () => {
      console.log('Toggling startTime popover:', !editing.startTime);
      editing.startTime = !editing.startTime;
    };

    const toggleEndTimePopover = () => {
      console.log('Toggling endTime popover:', !editing.endTime);
      editing.endTime = !editing.endTime;
    };

    const saveEventField = async (field, value) => {
      try {
        const { error } = await supabase
          .from('events')
          .update({ [field]: value })
          .eq('id', event.value.id);

        if (error) {
          console.error(`Error updating ${field}:`, error);
        } else {
          console.log(`${field} updated successfully`);
          ElMessage.success(`${field.replace('_', ' ')} updated successfully`);

          // Revert editing state for description
          if (field === 'description') {
            editing.description = false;
          }
        }
      } catch (err) {
        console.error('Unexpected error:', err);
      }
    };

    const eventTypeLabel = computed(() => {
      const options = [
        { label: 'Meeting', value: 'meeting' },
        { label: 'Court Hearing', value: 'court_hearing' },
        { label: 'Deposition', value: 'deposition' },
        { label: 'Client Call', value: 'client_call' },
        { label: 'Google Calendar Event', value: 'google_calendar_event' },
        { label: 'Other', value: 'other' }
      ];
      const selectedOption = options.find(option => option.value === event.value.event_type);
      return selectedOption ? selectedOption.label : 'Unknown';
    });

    const originalDescription = ref('');

    const handleDescriptionBlur = () => {
      if (event.value.description !== originalDescription.value) {
        saveEventField('description', event.value.description);
      } else {
        editing.description = false;
      }
    };

    const cancelDescriptionEdit = () => {
      console.log('Canceling description edit');
      console.log('Original description:', originalDescription.value);
      editing.description = false;
      event.value.description = originalDescription.value;
    };

    onMounted(async () => {
      const eventId = route.params.id;
      console.log(matterId);
      if (eventId) {
        await fetchEventDetails(eventId);
        if (event.value) {
          originalDescription.value = event.value.description;
        }
      }
    });

    return { event, loading, matterId, addedByEmail, addedByEmail, editing, showEdit, toggleEventTypePopover, toggleStartTimePopover, toggleEndTimePopover, saveEventField, eventTypeLabel, originalDescription, handleDescriptionBlur, cancelDescriptionEdit };
  }
};
</script>

<style scoped>
.single-event-view {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.event-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.event-content-wrapper {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  padding: 20px;
}

.event-main-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.event-details-box {
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  padding: 16px;
  background-color: var(--el-bg-color);
  margin-bottom: 20px;
  display: grid;
  grid-template-columns: 1fr; /* Default to 1 column */
  gap: 1rem;
}

.event-title-description {
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  padding: 16px;
  background-color: var(--el-bg-color);
  margin-bottom: 20px;
  display: grid;
  grid-template-columns: 1fr; /* Default to 1 column */
  gap: 1rem;
}

.event-title-description h3, .event-title-description p {
  margin: 0px;
}

.event-title-description p {
    position: relative;
    border-left: 3px solid var(--el-color-primary-light-5);
    padding: 12px 16px;
    border-radius: 4px;
    margin: 0;
    font-size: 15px;
    white-space: pre-wrap;
    word-wrap: break-word;
    word-break: break-word;
    overflow-wrap: break-word;
    max-width: 100%;
}

@media (min-width: 720px) {
  .event-details-box {
    grid-template-columns: repeat(2, 1fr); /* 2 columns for screens >= 720px */
  }
}

@media (min-width: 1200px) {
  .event-details-box {
    grid-template-columns: repeat(3, 1fr); /* 3 columns for screens >= 1200px */
  }
}

@media (min-width: 1600px) {
  .event-details-box {
    grid-template-columns: repeat(4, 1fr); /* 4 columns for screens >= 1600px */
  }
}

.event-detail-item {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.event-detail-item el-icon {
  margin-right: 10px;
}

.field-label {
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.field-label span {
  margin-left: 5px;
}

.field-value {
    font-size: 14px;
    line-height: 1.5;
    margin: 5px 10px;
    padding: 5px 10px;
    width: auto;
    background: azure;
    position: relative; /* Ensure the container is positioned relative for absolute positioning of the icon */
}

.edit-icon {
  cursor: pointer;
  position: static;
  right: 0;
  top: 2px;
  margin-left: 5px;
}

.event-title-description .field-value .edit-icon {
  position: absolute !important;
}
</style> 