<template>
  <div class="settings-container">
    <h2>All Matter Settings</h2>
    
    <el-form :model="settings" label-position="top" class="settings-form">
      <!-- Notification Preferences Section -->
      <div class="settings-section">
        <h3>Notification Preferences</h3>
        
        <el-form-item label="Email Notifications">
          <el-switch v-model="settings.emailNotifications" />
        </el-form-item>

        <!-- Telegram Integration -->
        <div class="telegram-section">
          <h4>Telegram Integration</h4>
          <el-form-item label="Telegram Chat ID">
            <el-input 
              v-model="settings.telegramId"
              placeholder="Enter your Telegram Chat ID"
              :disabled="!settings.telegramEnabled"
            >
              <template #append>
                <el-button @click="verifyTelegramId" :disabled="!settings.telegramEnabled">
                  Verify
                </el-button>
              </template>
            </el-input>
            <div class="help-text">
              To get your Chat ID:
              <ol>
                <li>Open Telegram</li>
                <li>Search for "@AIAttorneyBot"</li>
                <li>Start a chat and type /start</li>
                <li>The bot will reply with your Chat ID</li>
              </ol>
            </div>
          </el-form-item>

          <el-form-item>
            <el-switch
              v-model="settings.telegramEnabled"
              active-text="Enable Telegram Notifications"
            />
          </el-form-item>
        </div>

        <!-- Notification Types -->
        <div class="notification-types">
          <h4>Notify me about:</h4>
          <el-checkbox-group v-model="settings.notificationTypes">
            <el-checkbox label="task_assignments">Task assignments</el-checkbox>
            <el-checkbox label="task_updates">Task updates</el-checkbox>
            <el-checkbox label="goal_updates">Goal updates</el-checkbox>
            <el-checkbox label="matter_updates">Matter updates</el-checkbox>
            <el-checkbox label="comments">New comments</el-checkbox>
          </el-checkbox-group>
        </div>
      </div>

      <div class="form-actions">
        <el-button type="primary" @click="saveSettings" :loading="saving">
          Save Settings
        </el-button>
      </div>
    </el-form>
  </div>
</template>

<script>
import { ref } from 'vue';
import { supabase } from '../../supabase';
import { ElMessage } from 'element-plus';

export default {
  name: 'AllMatterSettingsCt',
  setup() {
    const settings = ref({
      emailNotifications: true,
      telegramEnabled: false,
      telegramId: '',
      notificationTypes: ['task_assignments', 'task_updates'],
      telegramVerified: false
    });
    const saving = ref(false);

    return {
      settings,
      saving
    };
  },
  methods: {
    async loadSettings() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data, error } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', session.user.id)
          .single();

        if (error) throw error;

        if (data) {
          this.settings = {
            ...this.settings,
            ...data.settings
          };
        }
      } catch (error) {
        ElMessage.error('Error loading settings: ' + error.message);
      }
    },

    async verifyTelegramId() {
      try {
        const { data, error } = await supabase
          .functions.invoke('verify-telegram-id', {
            body: { telegram_id: this.settings.telegramId }
          });

        if (error) throw error;

        if (data.verified) {
          this.settings.telegramVerified = true;
          ElMessage.success('Telegram ID verified successfully! Check your Telegram for a test message.');
        } else {
          ElMessage.error(data.error || 'Could not verify Telegram ID. Please check the ID and try again.');
        }
      } catch (error) {
        ElMessage.error('Error verifying Telegram ID: ' + error.message);
      }
    },

    async saveSettings() {
      this.saving = true;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('No active session');

        const { error } = await supabase
          .from('user_settings')
          .upsert({
            user_id: session.user.id,
            settings: this.settings
          });

        if (error) throw error;

        ElMessage.success('Settings saved successfully');
      } catch (error) {
        ElMessage.error('Error saving settings: ' + error.message);
      } finally {
        this.saving = false;
      }
    }
  },
  mounted() {
    this.loadSettings();
  }
};
</script>

<style scoped>
.settings-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
}

.settings-section {
  margin-bottom: 2rem;
  padding: 1.5rem;
  border: 1px solid #ebeef5;
  border-radius: 4px;
}

.settings-section h3 {
  margin-top: 0;
  margin-bottom: 1.5rem;
  color: #303133;
}

.telegram-section {
  margin-top: 1.5rem;
}

.help-text {
  font-size: 0.9em;
  color: #606266;
  margin-top: 0.5rem;
}

.help-text ol {
  margin-top: 0.5rem;
  padding-left: 1.2rem;
}

.notification-types {
  margin-top: 1.5rem;
}

.form-actions {
  margin-top: 2rem;
  text-align: right;
}

.el-checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}
</style> 