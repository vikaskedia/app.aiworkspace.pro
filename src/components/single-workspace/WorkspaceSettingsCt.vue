<script>
import { supabase } from '../../supabase';
import { ElMessage } from 'element-plus';
import { useMatterStore } from '../../store/matter';
import { storeToRefs } from 'pinia';
import { EditPen, Delete} from '@element-plus/icons-vue';

export default {
  name: 'WorkspaceSettingsCt',
  setup() {
    const matterStore = useMatterStore();
    const { currentMatter } = storeToRefs(matterStore);
    return { currentMatter };
  },
  data() {
    return {
      loading: false,
      editingMatter: {
        title: this.currentMatter?.title || '',
        description: this.currentMatter?.description || ''
      },
      newShare: {
        email: '',
        access_type: 'view'
      },
      sharedUsers: [],
      gitSettings: {
        repoName: this.currentMatter?.git_repo || ''
      },
      calendarSettings: {
        calendarId: this.currentMatter?.google_calendar_id || ''
      },
      emailSettings: {
        address: this.currentMatter?.email_storage || ''
      },
      aiSettings: {
        subtaskEnabled: this.currentMatter?.ai_subtask_enabled ?? true
      },
      customFields: [],
      newField: {
        label: '',
        key: '',
        type: 'text',
        options: [], // For dropdown
        value: ''
      },
      fieldTypes: [
        { label: 'Text', value: 'text' },
        { label: 'Checkbox', value: 'checkbox' },
        { label: 'Date', value: 'date' },
        { label: 'Number', value: 'number' }
      ],
      telegramGroups: [],
      newTelegramGroup: {
        chat_id: '',
        name: '',
        notification_types: []
      },
      notificationTypeOptions: [
        { label: 'Task Updates', value: 'task_updates' },
        { label: 'Goal Updates', value: 'goal_updates' },
        { label: 'Workspace Updates', value: 'matter_updates' },
        { label: 'Comments', value: 'comments' },
        { label: 'Document Updates', value: 'document_updates' }
      ],
      phoneNumbers: [],
      newPhoneNumber: {
        label: '',
        number: ''
      },
      showEditPhoneModal: false,
      editingPhone: {
        id: null,
        label: '',
        number: '',
        caller_id_name: ''
      },
      originalPhoneData: null, // Store original phone data for comparison
      // Phone text message actions
      phoneTextActions: [],
      newPhoneTextAction: {
        action_name: '',
        post_url: ''
      },
      loadingPhoneTextActions: false,
      showEditPhoneTextActionModal: false,
      editingPhoneTextAction: {
        id: null,
        action_name: '',
        post_url: ''
      },
    };
  },
  components: {
    EditPen,
    Delete
  },
  watch: {
    currentMatter: {
      handler(newMatter) {
        if (newMatter) {
          this.editingMatter = {
            title: newMatter.title || '',
            description: newMatter.description || ''
          };
          this.gitSettings.repoName = newMatter.git_repo || '';
          this.calendarSettings.calendarId = newMatter.google_calendar_id || '';
          this.emailSettings.address = newMatter.email_storage || '';
          this.loadSharedUsers();
          this.loadCustomFields();
          this.loadTelegramGroups();
          this.loadPhoneNumbers();
          this.loadPhoneTextActions();
        }
      },
      immediate: true
    }
  },
  methods: {
    async loadSharedUsers() {
      try {
        const { data: shares, error } = await supabase
          .from('workspace_access')
          .select('matter_id, shared_with_user_id, access_type, granted_at')
          .eq('matter_id', this.currentMatter.id);

        if (error) throw error;

        // Get user details for each share
        const sharesWithUserInfo = await Promise.all(
          shares.map(async (share) => {
            const { data: userData, error: userError } = await supabase
              .rpc('get_user_info_by_id', {
                user_id: share.shared_with_user_id
              });

            if (userError) throw userError;

            return {
              id: share.shared_with_user_id,
              email: userData[0].email,
              access_type: share.access_type
            };
          })
        );

        this.sharedUsers = sharesWithUserInfo;
      } catch (error) {
        ElMessage.error('Error loading shared users: ' + error.message);
      }
    },

    async updateMatter() {
      try {
        const { data, error } = await supabase
          .from('matters')
          .update({
            title: this.editingMatter.title,
            description: this.editingMatter.description,
            ai_subtask_enabled: this.aiSettings.subtaskEnabled
          })
          .eq('id', this.currentMatter.id)
          .select()
          .single();

        if (error) throw error;

        // Update the Pinia store instead of using Vuex
        this.currentMatter = data;
        ElMessage.success('Workspace updated successfully');
      } catch (error) {
        ElMessage.error('Error updating matter: ' + error.message);
      }
    },

    async createNotification(userId, type, data) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        const { error } = await supabase
          .from('notifications')
          .insert([{
            user_id: userId,
            actor_id: user.id,
            type,
            data,
            read: false
          }]);

        if (error) throw error;
      } catch (error) {
        console.error('Error creating notification:', error);
      }
    },

    async shareMatter() {
      try {
        // Get user ID using the database function
        const { data: userId, error: userError } = await supabase
          .rpc('get_user_id_by_email', {
            email_address: this.newShare.email
          });

        if (userError) throw userError;
        if (!userId) throw new Error('User not found');

        const { data: { user } } = await supabase.auth.getUser();
        
        // Insert the share record
        const { data, error } = await supabase
          .from('workspace_access')
          .insert({
            matter_id: this.currentMatter.id,
            shared_with_user_id: userId,
            granted_by_uuid: user.id,
            access_type: this.newShare.access_type
          })
          .select();

        if (error) throw error;

        // Create notification for the user
        await this.createNotification(
          userId,
          'matter_shared',
          { 
            matter_id: this.currentMatter.id,
            matter_title: this.currentMatter.title,
            access_type: this.newShare.access_type
          }
        );
        
        await this.loadSharedUsers();
        this.dialogVisible = false;
        ElMessage.success('Workspace shared successfully');
      } catch (error) {
        ElMessage.error('Error sharing matter: ' + error.message);
      }
    },

    async removeShare(userId) {
      try {
        const { error } = await supabase
          .from('workspace_access')
          .delete()
          .eq('matter_id', this.currentMatter.id)
          .eq('shared_with_user_id', userId);

        if (error) throw error;

        await this.loadSharedUsers();
        ElMessage.success('Access removed successfully');
      } catch (error) {
        ElMessage.error('Error removing access: ' + error.message);
      }
    },

    async updateGitSettings() {
      try {
        const { error } = await supabase
          .from('matters')
          .update({
            git_repo: this.gitSettings.repoName
          })
          .eq('id', this.currentMatter.id);

        if (error) throw error;
        ElMessage.success('Git repository settings updated successfully');
      } catch (error) {
        ElMessage.error('Error updating Git settings: ' + error.message);
      }
    },

    async updateCalendarSettings() {
      try {
        const { error } = await supabase
          .from('matters')
          .update({
            google_calendar_id: this.calendarSettings.calendarId
          })
          .eq('id', this.currentMatter.id);

        if (error) throw error;
        ElMessage.success('Calendar settings updated successfully');
      } catch (error) {
        ElMessage.error('Error updating calendar settings: ' + error.message);
      }
    },

    async updateEmailSettings() {
      try {
        const { error } = await supabase
          .from('matters')
          .update({
            email_storage: this.emailSettings.address
          })
          .eq('id', this.currentMatter.id);

        if (error) throw error;
        ElMessage.success('Email storage settings updated successfully');
      } catch (error) {
        ElMessage.error('Error updating email settings: ' + error.message);
      }
    },

    async loadCustomFields() {
      try {
        const { data, error } = await supabase
          .from('workspace_custom_fields')
          .select('*')
          .eq('matter_id', this.currentMatter.id)
          .order('created_at');

        if (error) throw error;
        this.customFields = data;
      } catch (error) {
        ElMessage.error('Error loading custom fields: ' + error.message);
      }
    },

    async addCustomField() {
      try {
        const fieldData = {
          matter_id: this.currentMatter.id,
          field_key: this.newField.key,
          field_label: this.newField.label,
          field_type: this.newField.type,
          field_options: this.newField.type === 'dropdown' ? this.newField.options : null,
          field_value: this.newField.value || null
        };

        const { data, error } = await supabase
          .from('workspace_custom_fields')
          .insert([fieldData])
          .select()
          .single();

        if (error) throw error;

        this.customFields.push(data);
        this.resetNewField();
        ElMessage.success('Field added successfully');
      } catch (error) {
        ElMessage.error('Error adding field: ' + error.message);
      }
    },

    async removeCustomField(fieldId) {
      try {
        const { error } = await supabase
          .from('workspace_custom_fields')
          .delete()
          .eq('id', fieldId);

        if (error) throw error;

        this.customFields = this.customFields.filter(f => f.id !== fieldId);
        ElMessage.success('Field removed successfully');
      } catch (error) {
        ElMessage.error('Error removing field: ' + error.message);
      }
    },

    resetNewField() {
      this.newField = {
        label: '',
        key: '',
        type: 'text',
        options: [],
        value: ''
      };
    },

    async updateFieldValue(fieldId, value) {
      try {
        const { error } = await supabase
          .from('workspace_custom_fields')
          .update({ field_value: value })
          .eq('id', fieldId);

        if (error) throw error;
        
        const index = this.customFields.findIndex(f => f.id === fieldId);
        if (index !== -1) {
          this.customFields[index].field_value = value;
        }
        
        ElMessage.success('Field value updated successfully');
      } catch (error) {
        ElMessage.error('Error updating field value: ' + error.message);
      }
    },

    async loadTelegramGroups() {
      try {
        const { data, error } = await supabase
          .from('workspace_telegram_groups')
          .select('*')
          .eq('matter_id', this.currentMatter.id);

        if (error) throw error;
        this.telegramGroups = data;
      } catch (error) {
        ElMessage.error('Error loading Telegram groups: ' + error.message);
      }
    },

    async addTelegramGroup() {
      try {
        const { data, error } = await supabase
          .from('workspace_telegram_groups')
          .insert({
            matter_id: this.currentMatter.id,
            chat_id: this.newTelegramGroup.chat_id,
            name: this.newTelegramGroup.name,
            notification_types: this.newTelegramGroup.notification_types
          })
          .select()
          .single();

        if (error) throw error;

        this.telegramGroups.push(data);
        this.resetNewTelegramGroup();
        ElMessage.success('Telegram group added successfully');
      } catch (error) {
        ElMessage.error('Error adding Telegram group: ' + error.message);
      }
    },

    async removeTelegramGroup(groupId) {
      try {
        const { error } = await supabase
          .from('workspace_telegram_groups')
          .delete()
          .eq('id', groupId);

        if (error) throw error;

        this.telegramGroups = this.telegramGroups.filter(g => g.id !== groupId);
        ElMessage.success('Telegram group removed successfully');
      } catch (error) {
        ElMessage.error('Error removing Telegram group: ' + error.message);
      }
    },

    resetNewTelegramGroup() {
      this.newTelegramGroup = {
        chat_id: '',
        name: '',
        notification_types: []
      };
    },

    async loadPhoneNumbers() {
      try {
        // Phone numbers are stored in the current matter's phone_numbers field
        this.phoneNumbers = this.currentMatter?.phone_numbers || [];
      } catch (error) {
        ElMessage.error('Error loading phone numbers: ' + error.message);
      }
    },

    async isPhoneNumberUnique(number) {
      // First, check if the number exists in the current workspace
      if (this.phoneNumbers && this.phoneNumbers.some(p => p.number === number)) {
        return 'current'; // Already in this workspace
      }
      // Query all matters and check if the phone number exists in any other workspace
      const { data, error } = await supabase
        .from('matters')
        .select('id, phone_numbers');
      if (error) throw error;
      for (const matter of data) {
        if (!matter.phone_numbers) continue;
        try {
          const numbers = Array.isArray(matter.phone_numbers) ? matter.phone_numbers : JSON.parse(matter.phone_numbers);
          if (numbers.some(p => p.number === number)) {
            // If it's the current workspace, skip (already checked above)
            if (matter.id !== this.currentMatter.id) return 'other';
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
      return true;
    },

    async addPhoneNumber() {
      try {
        // Uniqueness check
        const uniqueResult = await this.isPhoneNumberUnique(this.newPhoneNumber.number);
        if (uniqueResult === 'current') {
          ElMessage.error('This phone number is already added in this workspace.');
          return;
        }
        if (uniqueResult === 'other') {
          ElMessage.error('This phone number is already added in another workspace.');
          return;
        }
        const newPhone = {
          id: Date.now(), // Simple ID for frontend use
          label: this.newPhoneNumber.label,
          number: this.newPhoneNumber.number,
          caller_id_name: 'Not Available'
        };

        const updatedPhoneNumbers = [...this.phoneNumbers, newPhone];

        const { data, error } = await supabase
          .from('matters')
          .update({ phone_numbers: updatedPhoneNumbers })
          .eq('id', this.currentMatter.id)
          .select()
          .single();

        if (error) throw error;

        this.phoneNumbers = data.phone_numbers;
        this.resetNewPhoneNumber();
        ElMessage.success('Phone number added successfully');
      } catch (error) {
        ElMessage.error('Error adding phone number: ' + error.message);
      }
    },

    async removePhoneNumber(phoneId) {
      try {
        const updatedPhoneNumbers = this.phoneNumbers.filter(p => p.id !== phoneId);

        const { data, error } = await supabase
          .from('matters')
          .update({ phone_numbers: updatedPhoneNumbers })
          .eq('id', this.currentMatter.id)
          .select()
          .single();

        if (error) throw error;

        this.phoneNumbers = data.phone_numbers;
        ElMessage.success('Phone number removed successfully');
      } catch (error) {
        ElMessage.error('Error removing phone number: ' + error.message);
      }
    },

    resetNewPhoneNumber() {
      this.newPhoneNumber = {
        label: '',
        number: ''
      };
    },

    editPhoneNumber(phone) {
      this.editingPhone = { ...phone };
      this.originalPhoneData = { ...phone }; // Store original data for comparison
      this.showEditPhoneModal = true;
    },

    async savePhoneEdit() {
      try {
        // Check if caller_id_name has changed
        const callerIdNameChanged = this.originalPhoneData && 
          this.originalPhoneData.caller_id_name !== this.editingPhone.caller_id_name;
        
        if (callerIdNameChanged) {
          console.log('Caller ID Name has changed from:', this.originalPhoneData.caller_id_name, 'to:', this.editingPhone.caller_id_name);
          try {
            // Get Telnyx phone number ID
            const phoneNumber = this.editingPhone.number;
            //const apiKey = import.meta.env.VITE_TELNYX_API_KEY;           
            const apiKey = import.meta.env.TELNYX_API_KEY;           
            const response = await fetch(`https://api.telnyx.com/v2/phone_numbers?filter[phone_number]=${encodeURIComponent(phoneNumber)}`, {
              method: 'GET',
              headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${apiKey}`
              }
            });

            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Telnyx API response:', data);

            if (data.data && data.data.length > 0) {
              const telnyxPhoneNumberId = data.data[0].id;
              console.log('Telnyx phone number ID:', telnyxPhoneNumberId);
              
              // Update CNAM listing
              const cnamResponse = await fetch(`https://api.telnyx.com/v2/phone_numbers/${telnyxPhoneNumberId}/voice`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                  cnam_listing: {
                    cnam_listing_enabled: true,
                    cnam_listing_details: this.editingPhone.caller_id_name
                  }
                })
              });

              if (!cnamResponse.ok) {
                const cnamError = await cnamResponse.json();
                console.error('CNAM update error:', cnamError);
                throw new Error(`CNAM update failed: ${cnamResponse.status}`);
              }

              const cnamData = await cnamResponse.json();
              console.log('CNAM update successful:', cnamData);
              
            } else {
              console.log('No phone number found in Telnyx for:', phoneNumber);
            }
          } catch (error) {
            console.error('Error fetching Telnyx phone number ID:', error);
            ElMessage.error('Error fetching phone number details from Telnyx');
          }
        }
        const updatedPhoneNumbers = this.phoneNumbers.map(p => 
          p.id === this.editingPhone.id ? this.editingPhone : p
        );
        
        const { data, error } = await supabase
          .from('matters')
          .update({ phone_numbers: updatedPhoneNumbers })
          .eq('id', this.currentMatter.id)
          .select()
          .single();

        if (error) throw error;

        this.phoneNumbers = data.phone_numbers;
        this.showEditPhoneModal = false;
        ElMessage.success('Phone number updated successfully');
      } catch (error) {
        ElMessage.error('Error updating phone number: ' + error.message);
      }
    },

    async loadPhoneTextActions() {
      this.loadingPhoneTextActions = true;
      try {
        const { data, error } = await supabase
          .from('phone_text_message_actions')
          .select('*')
          .eq('matter_id', this.currentMatter.id)
          .order('created_at', { ascending: true });
        if (error) throw error;
        this.phoneTextActions = data;
      } catch (error) {
        ElMessage.error('Error loading phone text actions: ' + error.message);
      } finally {
        this.loadingPhoneTextActions = false;
      }
    },
    async addPhoneTextAction() {
      if (!this.newPhoneTextAction.action_name || !this.newPhoneTextAction.post_url) return;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No authenticated user');
        const { data, error } = await supabase
          .from('phone_text_message_actions')
          .insert({
            matter_id: this.currentMatter.id,
            action_name: this.newPhoneTextAction.action_name,
            post_url: this.newPhoneTextAction.post_url,
            created_by: user.id
          })
          .select()
          .single();
        if (error) throw error;
        this.phoneTextActions.push(data);
        this.newPhoneTextAction = { action_name: '', post_url: '' };
        ElMessage.success('Action added successfully');
      } catch (error) {
        ElMessage.error('Error adding action: ' + error.message);
      }
    },
    async removePhoneTextAction(actionId) {
      try {
        const { error } = await supabase
          .from('phone_text_message_actions')
          .delete()
          .eq('id', actionId);
        if (error) throw error;
        this.phoneTextActions = this.phoneTextActions.filter(a => a.id !== actionId);
        ElMessage.success('Action removed successfully');
      } catch (error) {
        ElMessage.error('Error removing action: ' + error.message);
      }
    },
    editPhoneTextAction(action) {
      this.editingPhoneTextAction = { ...action };
      this.showEditPhoneTextActionModal = true;
    },
    async savePhoneTextActionEdit() {
      if (!this.editingPhoneTextAction.action_name || !this.editingPhoneTextAction.post_url) return;
      try {
        const { data, error } = await supabase
          .from('phone_text_message_actions')
          .update({
            action_name: this.editingPhoneTextAction.action_name,
            post_url: this.editingPhoneTextAction.post_url,
            updated_at: new Date().toISOString()
          })
          .eq('id', this.editingPhoneTextAction.id)
          .select()
          .single();
        if (error) throw error;
        // Update local state
        const idx = this.phoneTextActions.findIndex(a => a.id === data.id);
        if (idx !== -1) this.phoneTextActions[idx] = data;
        this.showEditPhoneTextActionModal = false;
        ElMessage.success('Action updated successfully');
      } catch (error) {
        ElMessage.error('Error updating action: ' + error.message);
      }
    },
  }
};
</script>

<template>
  <div class="manage-matter">
    <div class="content">

      <!-- Workspace Details Section -->
      <div class="section">
        <h3>Workspace Details</h3>
        <el-form :model="editingMatter" label-position="top">
          <el-form-item label="Title" required>
            <el-input v-model="editingMatter.title" />
          </el-form-item>
          
          <el-form-item label="Description">
            <el-input
              v-model="editingMatter.description"
              type="textarea"
              :rows="3" />
          </el-form-item>

          <el-form-item>
            <el-button 
              type="primary"
              @click="updateMatter"
              :disabled="!editingMatter.title">
              Save Changes
            </el-button>
          </el-form-item>
        </el-form>
      </div>

      <!-- Share Workspace Section -->
      <div class="section">
        <h3>Share Workspace</h3>
        <el-form :model="newShare" label-position="top">
          <div class="share-inputs">
            <el-form-item label="Email" required>
              <el-input v-model="newShare.email" placeholder="Enter email address" />
            </el-form-item>
            
            <el-form-item label="Access Type">
              <el-select v-model="newShare.access_type">
                <el-option label="View Access" value="view" />
                <el-option label="Edit Access" value="edit" />
              </el-select>
            </el-form-item>

            <el-button 
              type="primary"
              @click="shareMatter"
              :disabled="!newShare.email">
              Share
            </el-button>
          </div>
        </el-form>

        <!-- Shared Users List -->
        <div class="shared-users">
          <h4>Shared With</h4>
          <el-table :data="sharedUsers">
            <el-table-column label="User" min-width="200">
              <template #default="{ row }">
                {{ row.email }}
              </template>
            </el-table-column>
            
            <el-table-column prop="access_type" label="Access" width="120" />
            
            <el-table-column label="Actions" width="100" align="right">
              <template #default="{ row }">
                <el-button 
                  type="danger" 
                  size="small"
                  @click="removeShare(row.id)">
                  Remove
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>

      <!-- Git Repository Section -->
      <div class="section">
        <h3>Namespace Settings</h3>
        <el-form label-position="top">
          <el-form-item 
            label="Namespace Name" 
            required
            :rules="[{ required: true, message: 'Repository name is required' }]">
            <div class="horizontal-form-layout">
              <el-input 
                v-model="gitSettings.repoName" 
                placeholder="Enter Git repository name"
                maxlength="50" />
              <el-button 
                type="primary"
                @click="updateGitSettings"
                :disabled="!gitSettings.repoName">
                Save Changes
              </el-button>
            </div>
          </el-form-item>
          <el-form-item>
            <el-text class="text-sm text-gray-500">
              This namespace will serve as a Git repository and email storage to store all files related to this matter
            </el-text>
          </el-form-item>
        </el-form>
      </div>

      <!-- Calendar Settings Section -->
      <div class="section">
        <h3>Calendar Settings</h3>
        <el-form label-position="top">
          <el-form-item 
            label="Secret address in iCal format" 
            required
            :rules="[{ required: true, message: 'Calendar ID is required' }]">
            <div class="horizontal-form-layout">
              <el-input 
                v-model="calendarSettings.calendarId" 
                placeholder="Secret address in iCal format"
                class="calendar-input" />
              <el-button 
                type="primary"
                @click="updateCalendarSettings"
                :disabled="!calendarSettings.calendarId">
                Save Changes
              </el-button>
            </div>
          </el-form-item>
          <el-form-item>
            <el-text class="text-sm text-gray-500">
              This calendar address will be used to sync events related to this matter
            </el-text>
          </el-form-item>
        </el-form>
      </div>

      <!-- Phone Number Settings Section -->
      <div class="section">
        <h3>Phone Number Settings</h3>
        
        <!-- Add New Phone Number -->
        <el-form :model="newPhoneNumber" label-position="top">
          <div class="phone-number-form">
            <el-form-item label="Label" required>
              <el-input 
                v-model="newPhoneNumber.label" 
                placeholder="e.g., Client Mobile, Office Line" />
            </el-form-item>
            
            <el-form-item label="Phone Number" required>
              <el-input 
                v-model="newPhoneNumber.number" 
                placeholder="Enter phone number"
                type="tel" />
            </el-form-item>

            <div class="button-container">
              <el-button 
                type="primary"
                @click="addPhoneNumber"
                :disabled="!newPhoneNumber.label || !newPhoneNumber.number">
                Add Phone No.
              </el-button>
            </div>
          </div>
        </el-form>

        <!-- Phone Numbers List -->
        <div class="phone-numbers-list">
          <el-table :data="phoneNumbers">
            <el-table-column prop="label" label="Label" />
            <el-table-column prop="number" label="Phone Number" />
            <el-table-column prop="caller_id_name" label="Caller ID Name" />
            <el-table-column label="Actions" width="160" align="right">
              <template #default="{ row }">
                <el-button 
                  type="primary"
                  size="small"
                  @click="editPhoneNumber(row)"
                  style="margin-right: 8px;">
                  <el-icon><EditPen /></el-icon>
                </el-button>
                <el-button 
                  type="danger" 
                  size="small"
                  @click="removePhoneNumber(row.id)">
                  <el-icon><Delete /></el-icon>
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <!-- Edit Phone Number Modal -->
        <el-dialog
          v-model="showEditPhoneModal"
          title="Edit Phone Number"
          width="500px">
          <el-form :model="editingPhone" label-position="top">
            <el-form-item label="Label" required>
              <el-input 
                v-model="editingPhone.label" 
                placeholder="e.g., Client Mobile, Office Line" />
            </el-form-item>
            
            <el-form-item label="Phone Number" required>
              <el-input 
                v-model="editingPhone.number" 
                placeholder="Enter phone number"
                type="tel" />
            </el-form-item>

            <el-form-item label="Caller ID Name">
              <el-input 
                v-model="editingPhone.caller_id_name" 
                placeholder="Enter caller ID name" />
            </el-form-item>
          </el-form>
          
          <template #footer>
            <span class="dialog-footer">
              <el-button @click="showEditPhoneModal = false">Cancel</el-button>
              <el-button
                type="primary"
                @click="savePhoneEdit"
                :disabled="!editingPhone.label || !editingPhone.number">
                Save Changes
              </el-button>
            </span>
          </template>
        </el-dialog>
      </div>

      <!-- Phone text Message actions Section -->
      <div class="section">
        <h3>Phone text message actions</h3>
        <el-form :model="newPhoneTextAction" label-position="top" style="margin-bottom: 1.5rem;">
          <div class="form-container">
            <div class="field-group">
              <el-form-item label="Action name" required>
                <el-input v-model="newPhoneTextAction.action_name" placeholder="Enter action name" />
              </el-form-item>
            </div>
            <div class="field-group">
              <el-form-item label="Post URL" required>
                <el-input v-model="newPhoneTextAction.post_url" placeholder="Enter POST URL" />
              </el-form-item>
            </div>
            <div class="button-container">
              <el-button type="primary" @click="addPhoneTextAction" :disabled="!newPhoneTextAction.action_name || !newPhoneTextAction.post_url">
                Add Action
              </el-button>
            </div>
          </div>
        </el-form>
        <div class="custom-fields-list">
          <el-table :data="phoneTextActions" v-loading="loadingPhoneTextActions">
            <el-table-column prop="action_name" label="Action name" />
            <el-table-column prop="post_url" label="Post URL" />
            <el-table-column label="Actions" width="160" align="right">
              <template #default="{ row }">
                <el-button type="primary" size="small" @click="editPhoneTextAction(row)" style="margin-right: 8px;">Edit</el-button>
                <el-button type="danger" size="small" @click="removePhoneTextAction(row.id)">Remove</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
        <el-dialog
          v-model="showEditPhoneTextActionModal"
          title="Edit Phone Text Message Action"
          width="500px">
          <el-form :model="editingPhoneTextAction" label-position="top">
            <el-form-item label="Action name" required>
              <el-input v-model="editingPhoneTextAction.action_name" placeholder="Enter action name" />
            </el-form-item>
            <el-form-item label="Post URL" required>
              <el-input v-model="editingPhoneTextAction.post_url" placeholder="Enter POST URL" />
            </el-form-item>
          </el-form>
          <template #footer>
            <span class="dialog-footer">
              <el-button @click="showEditPhoneTextActionModal = false">Cancel</el-button>
              <el-button type="primary" @click="savePhoneTextActionEdit" :disabled="!editingPhoneTextAction.action_name || !editingPhoneTextAction.post_url">Save Changes</el-button>
            </span>
          </template>
        </el-dialog>
      </div>

      <!-- Email Storage Section -->
      <!--div class="section">
        <h3>Email Storage Settings</h3>
        <el-form label-position="top">
          <el-form-item 
            label="Email Address" 
            required
            :rules="[
              { required: true, message: 'Email address is required' },
              { type: 'email', message: 'Please enter a valid email address' }
            ]">
            <div class="horizontal-form-layout">
              <el-input 
                v-model="emailSettings.address" 
                placeholder="Enter email address for matter storage"
                maxlength="50" />
              <el-button 
                type="primary"
                @click="updateEmailSettings"
                :disabled="!emailSettings.address">
                Save Changes
              </el-button>
            </div>
          </el-form-item>
          <el-form-item>
            <el-text class="text-sm text-gray-500">
              All emails related to this matter will be stored at this address
            </el-text>
          </el-form-item>
        </el-form>
      </div-->

      <!-- Form Fields Section -->
      <div class="section">
        <h3>Custom Form Fields</h3>
        
        <!-- Add New Field Form -->
        <div class="add-field-form">
          <el-form label-position="top">
            <div class="form-container">
              <div class="field-group">
                <el-form-item label="Field Label" required>
                  <el-input 
                    v-model="newField.label" 
                    placeholder="Enter field label"
                    @input="newField.key = newField.label.toLowerCase().replace(/\s+/g, '_')" />
                </el-form-item>
              </div>
              
              <div class="field-group">
                <el-form-item label="Field Type" required>
                  <el-select v-model="newField.type" style="width: 100%">
                    <el-option 
                      v-for="type in fieldTypes"
                      :key="type.value"
                      :label="type.label"
                      :value="type.value" />
                  </el-select>
                </el-form-item>
              </div>

              <div class="field-group">
                <el-form-item label="Field Value" required>
                  <!-- Date picker -->
                  <el-date-picker
                    v-if="newField.type === 'date'"
                    v-model="newField.value"
                    type="date"
                    style="width: 100%" />

                  <!-- Text/Number input -->
                  <el-input
                    v-else
                    v-model="newField.value"
                    :type="newField.type === 'number' ? 'number' : 'text'"
                    placeholder="Enter value" />
                </el-form-item>
              </div>

              <div class="button-container">
                <el-button 
                  type="primary"
                  @click="addCustomField"
                  :disabled="!newField.label || !newField.type || !newField.value || 
                            (newField.type === 'dropdown' && (!newField.options || newField.options.length === 0))">
                  Add Field
                </el-button>
              </div>
            </div>
          </el-form>
        </div>

        <!-- Custom Fields List -->
        <div class="custom-fields-list">
          <el-table :data="customFields">
            <el-table-column prop="field_label" label="Label" />
            <el-table-column prop="field_type" label="Type" width="120" />
            <el-table-column label="Value" min-width="200">
              <template #default="{ row }">
                <!-- Date picker -->
                <el-date-picker
                  v-if="row.field_type === 'date'"
                  v-model="row.field_value"
                  type="date"
                  @change="updateFieldValue(row.id, row.field_value)"
                  style="width: 100%" />

                <!-- Text input -->
                <el-input
                  v-else 
                  v-model="row.field_value"
                  :type="row.field_type === 'number' ? 'number' : 'text'"
                  @change="updateFieldValue(row.id, row.field_value)"
                  placeholder="Enter value" />
              </template>
            </el-table-column>
            <el-table-column label="Actions" width="100" align="right">
              <template #default="{ row }">
                <el-button 
                  type="danger" 
                  size="small"
                  @click="removeCustomField(row.id)">
                  Remove
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>

      <!-- Telegram Groups Section -->
      <div class="section">
        <h3>Telegram Groups</h3>
        
        <!-- Add New Telegram Group -->
        <el-form :model="newTelegramGroup" label-position="top">
          <div class="telegram-group-form">
            <el-form-item label="Group Name" required>
              <el-input 
                v-model="newTelegramGroup.name" 
                placeholder="Enter group name" />
            </el-form-item>
            
            <el-form-item label="Chat ID" required>
              <el-input 
                v-model="newTelegramGroup.chat_id" 
                placeholder="Enter Telegram chat ID" />
            </el-form-item>

            <el-form-item label="Notification Types">
              <el-checkbox-group v-model="newTelegramGroup.notification_types">
                <div class="notification-checkboxes">
                  <el-checkbox 
                    v-for="option in notificationTypeOptions"
                    :key="option.value"
                    :value="option.value">
                    {{ option.label }}
                  </el-checkbox>
                </div>
              </el-checkbox-group>
            </el-form-item>

            <div class="button-container">
              <el-button 
                type="primary"
                @click="addTelegramGroup"
                :disabled="!newTelegramGroup.name || !newTelegramGroup.chat_id">
                Add Group
              </el-button>
            </div>
          </div>
        </el-form>

        <!-- Telegram Groups List -->
        <div class="telegram-groups-list">
          <el-table :data="telegramGroups">
            <el-table-column prop="name" label="Group Name" />
            <el-table-column prop="chat_id" label="Chat ID" />
            <el-table-column label="Notification Types" min-width="200">
              <template #default="{ row }">
                <el-tag 
                  v-for="type in row.notification_types" 
                  :key="type"
                  size="small"
                  class="notification-tag">
                  {{ type }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="Actions" width="100" align="right">
              <template #default="{ row }">
                <el-button 
                  type="danger" 
                  size="small"
                  @click="removeTelegramGroup(row.id)">
                  Remove
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.manage-matter {
  padding: 2rem;
}

.content {
  max-width: 800px;
  margin: 0 auto;
}

.section {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  margin-bottom: 2rem;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
}

.share-inputs {
  display: grid;
  grid-template-columns: 2fr 1fr auto;
  gap: 1rem;
  align-items: flex-end;
}

.shared-users {
  margin-top: 2rem;
}


h3 {
  margin-bottom: 1.5rem;
  font-size: 1.4rem;
  font-weight: 500;
}

h4 {
  margin: 1rem 0;
  font-size: 1.1rem;
  font-weight: 500;
}

.horizontal-form-layout {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}

.horizontal-form-layout .el-input {
  flex: 1;
}

.horizontal-form-layout .el-button {
  flex-shrink: 0;
  white-space: nowrap;
}

@media (max-width: 640px) {
  .manage-matter {
    padding: 1rem;
  }

  .share-inputs {
    grid-template-columns: 1fr;
  }

  .horizontal-form-layout {
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .horizontal-form-layout .el-button {
    width: 100%;
  }
}

.add-field-form {
  margin-bottom: 2rem;
}

.form-container {
  display: flex;
  gap: 1rem;
  padding: 1.5rem;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  background-color: #f8f9fa;
}

.field-group {
  flex: 1;
}

.field-group .el-form-item {
  margin-bottom: 0;
}

.button-container {
  display: flex;
  align-items: flex-end;
  padding-bottom: 2px;
}

.button-container .el-button {
  width: 120px;
}

@media (max-width: 768px) {
  .form-container {
    flex-direction: column;
    padding: 1rem;
  }
  
  .button-container {
    margin-top: 0.5rem;
  }

  .button-container .el-button {
    width: 100%;
  }
}

.custom-fields-list {
  margin-top: 1rem;
}

@media (max-width: 640px) {
  .add-field-form {
    grid-template-columns: 1fr;
  }
  
  .add-field-form .el-button {
    width: 100%;
  }
}

.telegram-group-form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  padding: 1.5rem;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  background-color: #f8f9fa;
  margin-bottom: 1.5rem;
}

.telegram-group-form .el-form-item:nth-child(3) {
  grid-column: 1 / -1;
}

.telegram-group-form .button-container {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
}

.notification-tag {
  margin-right: 4px;
  margin-bottom: 4px;
}

@media (max-width: 768px) {
  .telegram-group-form {
    grid-template-columns: 1fr;
  }
}

.notification-checkboxes {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.notification-checkboxes .el-checkbox {
  flex: 0 0 auto;
  min-width: 150px;
  margin-right: 1rem;
}

@media (max-width: 640px) {
  .notification-checkboxes {
    flex-direction: column;
    gap: 0.6rem;
  }
  
  .notification-checkboxes .el-checkbox {
    min-width: 100%;
    margin-right: 0;
  }
}

.calendar-input {
  min-width: 600px;
}

@media (max-width: 768px) {
  .calendar-input {
    min-width: 100%;
  }
}

.phone-number-form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  padding: 1.5rem;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  background-color: #f8f9fa;
  margin-bottom: 1.5rem;
}

.phone-number-form .button-container {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
}

.phone-numbers-list {
  margin-top: 1rem;
}

@media (max-width: 768px) {
  .phone-number-form {
    grid-template-columns: 1fr;
  }
  
  .phone-number-form .button-container {
    justify-content: center;
  }
}
</style>
<style>
.ai-settings .el-form-item__content {
    display: block;
}
</style>