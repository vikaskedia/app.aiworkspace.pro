<template>
  <div class="profile-edit-container">
    <div class="profile-edit-card">
      <div class="profile-header">
        <h1 class="profile-title">Edit Profile</h1>
        <p class="profile-subtitle">Update your personal information and profile picture</p>
      </div>

      <el-form 
        ref="profileForm" 
        :model="profileData" 
        :rules="rules" 
        label-position="top"
        class="profile-form"
      >
        <!-- Profile Picture Section -->
        <div class="profile-picture-section">
          <div class="current-avatar">
            <el-avatar 
              :size="120"
              :src="profileData.avatar_url"
              :icon="!profileData.avatar_url ? 'UserFilled' : undefined"
              class="profile-avatar"
            />
          </div>
          
          <div class="avatar-upload">
            <el-upload
              ref="uploadRef"
              class="avatar-uploader"
              :auto-upload="false"
              :show-file-list="false"
              :on-change="handleFileChange"
              accept="image/*"
              :limit="1"
            >
              <el-button type="primary" :loading="uploading" icon="Upload">
                {{ uploading ? 'Uploading...' : 'Change Picture' }}
              </el-button>
            </el-upload>
            
            <div class="upload-tips">
              <p>Recommended: Square image, max 2MB</p>
              <p>Supported formats: JPG, PNG, GIF</p>
            </div>
          </div>
        </div>

        <!-- Personal Information -->
        <div class="form-section">
          <h3 class="section-title">Personal Information</h3>
          
          <el-form-item label="Full Name" prop="full_name">
            <el-input 
              v-model="profileData.full_name" 
              placeholder="Enter your full name"
              clearable
            />
          </el-form-item>

          <el-form-item label="Username" prop="user_name">
            <el-input 
              v-model="profileData.user_name" 
              placeholder="Enter your username"
              clearable
            />
          </el-form-item>

          <el-form-item label="Email">
            <el-input 
              v-model="profileData.email" 
              disabled
              placeholder="Email cannot be changed"
            />
            <div class="field-help">
              Email address cannot be changed. Contact support if you need to update it.
            </div>
          </el-form-item>
        </div>

        <!-- Account Settings -->
        <div class="form-section">
          <h3 class="section-title">Display Preferences</h3>
          
          <el-form-item label="Display Name">
            <el-select 
              v-model="profileData.display_name_preference" 
              placeholder="Choose how your name appears"
              style="width: 100%"
            >
              <el-option label="Full Name" value="full_name" />
              <el-option label="Username" value="user_name" />
              <el-option label="Email" value="email" />
            </el-select>
          </el-form-item>
        </div>

        <!-- Action Buttons -->
        <div class="form-actions">
          <el-button @click="handleCancel" size="large">
            Cancel
          </el-button>
          <el-button 
            type="primary" 
            @click="handleSave" 
            :loading="saving"
            size="large"
          >
            {{ saving ? 'Saving...' : 'Save Changes' }}
          </el-button>
        </div>
      </el-form>
    </div>
  </div>
</template>

<script>
import { ElForm, ElFormItem, ElInput, ElButton, ElAvatar, ElUpload, ElSelect, ElOption, ElMessage, ElMessageBox } from 'element-plus';
import { Upload, UserFilled } from '@element-plus/icons-vue';
import { supabase } from '../supabase';

export default {
  name: 'ProfileEditCt',
  components: {
    ElForm,
    ElFormItem,
    ElInput,
    ElButton,
    ElAvatar,
    ElUpload,
    ElSelect,
    ElOption,
    Upload,
    UserFilled
  },
  data() {
    return {
      profileData: {
        email: '',
        full_name: '',
        user_name: '',
        avatar_url: '',
        display_name_preference: 'full_name'
      },
      originalData: {},
      uploading: false,
      saving: false,
      uploadProgress: 0,
      rules: {
        full_name: [
          { required: true, message: 'Please enter your full name', trigger: 'blur' },
          { min: 2, max: 50, message: 'Name should be 2-50 characters', trigger: 'blur' }
        ],
        user_name: [
          { required: true, message: 'Please enter a username', trigger: 'blur' },
          { min: 3, max: 30, message: 'Username should be 3-30 characters', trigger: 'blur' },
          { pattern: /^[a-zA-Z0-9_-]+$/, message: 'Username can only contain letters, numbers, underscores, and hyphens', trigger: 'blur' }
        ]
      }
    };
  },
  computed: {
    hasChanges() {
      return JSON.stringify(this.profileData) !== JSON.stringify(this.originalData);
    }
  },
  async mounted() {
    await this.loadUserProfile();
  },
  methods: {
    async loadUserProfile() {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;

        if (user) {
          this.profileData = {
            email: user.email,
            full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
            user_name: user.user_metadata?.user_name || user.user_metadata?.username || '',
            avatar_url: user.user_metadata?.avatar_url || '',
            display_name_preference: user.user_metadata?.display_name_preference || 'full_name'
          };
          
          // Store original data for comparison
          this.originalData = { ...this.profileData };
        }
      } catch (error) {
        console.error('Error loading profile:', error);
        ElMessage.error('Failed to load profile data');
      }
    },

    async handleFileChange(file) {
      if (!file) return;

      const isImage = file.raw.type.startsWith('image/');
      const isLt2M = file.raw.size / 1024 / 1024 < 2;

      if (!isImage) {
        ElMessage.error('Please upload an image file!');
        return;
      }
      if (!isLt2M) {
        ElMessage.error('Image size must be smaller than 2MB!');
        return;
      }

      this.uploading = true;

      try {
        // Get the current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No user found');

        // Create a unique filename
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        
        // Upload to Supabase storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, file.raw, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw uploadError;

        // Get the public URL
        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName);

        // Update the profile data
        this.profileData.avatar_url = publicUrl;
        
        ElMessage.success('Profile picture uploaded successfully!');
      } catch (error) {
        console.error('Error uploading avatar:', error);
        ElMessage.error('Failed to upload profile picture: ' + error.message);
      } finally {
        this.uploading = false;
      }
    },

    async handleSave() {
      try {
        // Validate form
        const valid = await this.$refs.profileForm.validate();
        if (!valid) return;

        this.saving = true;

        // Update user metadata in Supabase Auth
        const { error } = await supabase.auth.updateUser({
          data: {
            full_name: this.profileData.full_name,
            name: this.profileData.full_name, // Keep both for compatibility
            user_name: this.profileData.user_name,
            username: this.profileData.user_name, // Keep both for compatibility
            avatar_url: this.profileData.avatar_url,
            display_name_preference: this.profileData.display_name_preference
          }
        });

        if (error) throw error;

        // Update original data
        this.originalData = { ...this.profileData };
        
        ElMessage.success('Profile updated successfully!');
        
        // Optionally navigate back or refresh parent components
        this.$router.back();
      } catch (error) {
        console.error('Error updating profile:', error);
        ElMessage.error('Failed to update profile: ' + error.message);
      } finally {
        this.saving = false;
      }
    },

    async handleCancel() {
      if (this.hasChanges) {
        try {
          await ElMessageBox.confirm(
            'You have unsaved changes. Are you sure you want to leave?',
            'Unsaved Changes',
            {
              confirmButtonText: 'Leave',
              cancelButtonText: 'Stay',
              type: 'warning'
            }
          );
        } catch {
          return; // User cancelled
        }
      }
      
      this.$router.back();
    }
  },
  beforeRouteLeave(to, from, next) {
    if (this.hasChanges) {
      ElMessageBox.confirm(
        'You have unsaved changes. Are you sure you want to leave?',
        'Unsaved Changes',
        {
          confirmButtonText: 'Leave',
          cancelButtonText: 'Stay',
          type: 'warning'
        }
      ).then(() => {
        next();
      }).catch(() => {
        next(false);
      });
    } else {
      next();
    }
  }
};
</script>

<style scoped>
.profile-edit-container {
  min-height: 100vh;
  background: #f8fafc;
  padding: 2rem;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.profile-edit-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  padding: 3rem;
  width: 100%;
  max-width: 600px;
  margin-top: 2rem;
}

.profile-header {
  text-align: center;
  margin-bottom: 3rem;
}

.profile-title {
  font-size: 2rem;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 0.5rem 0;
}

.profile-subtitle {
  color: #666;
  font-size: 1rem;
  margin: 0;
}

.profile-picture-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 3rem;
  padding: 2rem;
  background: #f8fafc;
  border-radius: 12px;
  border: 2px dashed #e2e8f0;
}

.current-avatar {
  margin-bottom: 1.5rem;
}

.profile-avatar {
  border: 4px solid white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.avatar-upload {
  text-align: center;
}

.avatar-uploader {
  margin-bottom: 1rem;
}

.upload-tips {
  color: #666;
  font-size: 0.85rem;
  line-height: 1.4;
}

.upload-tips p {
  margin: 0.25rem 0;
}

.form-section {
  margin-bottom: 2.5rem;
}

.section-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 1.5rem 0;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #f1f5f9;
}

.profile-form :deep(.el-form-item__label) {
  font-weight: 500;
  color: #374151;
  font-size: 0.95rem;
}

.profile-form :deep(.el-input__wrapper) {
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
}

.profile-form :deep(.el-input__wrapper):hover {
  border-color: #409eff;
}

.profile-form :deep(.el-input__wrapper.is-focus) {
  border-color: #409eff;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
}

.field-help {
  font-size: 0.8rem;
  color: #666;
  margin-top: 0.5rem;
  line-height: 1.4;
}

.form-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 1px solid #e2e8f0;
}

.form-actions .el-button {
  min-width: 120px;
}

/* Responsive design */
@media (max-width: 768px) {
  .profile-edit-container {
    padding: 1rem;
  }

  .profile-edit-card {
    padding: 2rem 1.5rem;
    margin-top: 1rem;
  }

  .profile-picture-section {
    padding: 1.5rem 1rem;
  }

  .current-avatar {
    margin-bottom: 1rem;
  }

  .form-actions {
    flex-direction: column;
  }

  .form-actions .el-button {
    width: 100%;
  }
}

/* Loading states */
.profile-form :deep(.el-input.is-disabled .el-input__wrapper) {
  background-color: #f5f7fa;
  cursor: not-allowed;
}

/* Upload progress styles */
:deep(.el-upload) {
  display: block;
  width: 100%;
}

:deep(.el-upload .el-button) {
  width: auto;
  min-width: 140px;
}

/* Avatar upload styles */
.avatar-uploader :deep(.el-upload) {
  border: none;
  border-radius: 8px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: all 0.3s;
}

.avatar-uploader :deep(.el-upload:hover) {
  transform: translateY(-2px);
}
</style>