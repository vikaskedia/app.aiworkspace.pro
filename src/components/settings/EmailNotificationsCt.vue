<template>
  <div class="email-notifications-container">
    <h2>Email Notification Settings</h2>
    
    <el-form 
      :model="settings" 
      label-position="top" 
      class="settings-form"
      @submit.prevent
    >
      <div 
        class="settings-section"
        tabindex="-1"
      >
        <el-form-item label="Email Notifications">
          <div 
            class="notification-toggle"
            role="group"
            aria-labelledby="notification-toggle-label"
          >
            <el-switch
              v-model="settings.emailNotificationsEnabled"
              :loading="loading"
              :aria-label="settings.emailNotificationsEnabled ? 'Disable email notifications' : 'Enable email notifications'"
            />
            <span 
              id="notification-toggle-label"
              class="toggle-label"
            >
              {{ settings.emailNotificationsEnabled ? 'Enabled' : 'Disabled' }}
            </span>
          </div>
          <div class="help-text" role="note">
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
    const isInitialized = ref(false);

    const loadSettings = async () => {
      try {
        loading.value = true;
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data: existingSettings, error: settingsError } = await supabase
          .from('user_settings')
          .select('settings')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (settingsError) throw settingsError;

        if (existingSettings?.settings?.emailNotificationsEnabled !== undefined) {
          unwatchSettings?.();
          settings.value.emailNotificationsEnabled = existingSettings.settings.emailNotificationsEnabled;
          setupWatch();
        } else {
          const { error: insertError } = await supabase
            .from('user_settings')
            .insert({
              user_id: session.user.id,
              settings: {
                emailNotificationsEnabled: false
              }
            });

          if (insertError) throw insertError;
        }
        isInitialized.value = true;
      } catch (error) {
        ElMessage.error('Error loading settings: ' + error.message);
      } finally {
        loading.value = false;
      }
    };

    const saveSettings = async () => {
      if (!isInitialized.value) return;

      try {
        loading.value = true;
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

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

    let unwatchSettings = null;
    const setupWatch = () => {
      unwatchSettings = watch(() => settings.value.emailNotificationsEnabled, saveSettings);
    };

    onMounted(loadSettings);
    setupWatch();

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
