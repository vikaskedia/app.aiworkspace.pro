<template>
  <div class="email-notifications-container">
    <h2>Email Notification Settings</h2>
    
    <el-form :model="settings" label-position="top" class="settings-form">
      <div class="settings-section">
        <el-form-item label="Email Notifications">
          <div class="notification-toggle">
            <el-switch
              v-model="settings.emailNotificationsEnabled"
              :loading="loading"
            />
            <span class="toggle-label">
              {{ settings.emailNotificationsEnabled ? 'Enabled' : 'Disabled' }}
            </span>
          </div>
          <div class="help-text">
            When enabled, you will receive email notifications for important updates.
          </div>
        </el-form-item>
      </div>
    </el-form>
  </div>
</template>

<script>
import { ref, onMounted, watch } from 'vue';
import { supabase } from '../../supabase';
import { ElMessage } from 'element-plus';

export default {
  name: 'EmailNotifications',
  setup() {
    const settings = ref({
      emailNotificationsEnabled: false
    });
    const loading = ref(false);

    const loadSettings = async () => {
      try {
        loading.value = true;
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data, error } = await supabase
          .from('user_settings')
          .select('settings')
          .eq('user_id', session.user.id)
          .single();

        if (error) throw error;

        if (data?.settings?.emailNotificationsEnabled !== undefined) {
          settings.value.emailNotificationsEnabled = data.settings.emailNotificationsEnabled;
        }
      } catch (error) {
        ElMessage.error('Error loading settings: ' + error.message);
      } finally {
        loading.value = false;
      }
    };

    const saveSettings = async () => {
      try {
        loading.value = true;
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        console.log('session.user.id', session.user.id);
        // First try to get existing settings
        const { data: existingData } = await supabase
          .from('user_settings')
          .select('settings')
          .eq('user_id', session.user.id)
          .single();

        const updatedSettings = {
          ...(existingData?.settings || {}),
          emailNotificationsEnabled: settings.value.emailNotificationsEnabled
        };

        const { error } = await supabase
          .from('user_settings')
          .upsert({
            user_id: session.user.id,
            settings: updatedSettings
          }, {
            onConflict: 'user_id'
          });

        if (error) throw error;
        ElMessage.success('Settings saved successfully');
      } catch (error) {
        ElMessage.error('Error saving settings: ' + error.message);
      } finally {
        loading.value = false;
      }
    };

    // Watch for changes and save automatically
    watch(() => settings.value.emailNotificationsEnabled, saveSettings);

    onMounted(loadSettings);

    return {
      settings,
      loading
    };
  }
};
</script>

<style scoped>
.email-notifications-container {
  max-width: 600px;
  margin: 2rem auto;
  padding: 1rem;
}

.settings-section {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.notification-toggle {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.toggle-label {
  font-size: 0.9rem;
  color: #606266;
}

.help-text {
  margin-top: 0.5rem;
  font-size: 0.85rem;
  color: #909399;
}
</style>
