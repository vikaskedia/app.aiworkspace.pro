<template>
  <div class="profile-edit-layout">
    <HeaderCt />
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
          <div class="avatar-row">
            <!-- Main Profile Picture -->
            <div class="main-avatar-section">
              <h4 class="avatar-section-title">Profile Picture</h4>
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
                  :on-change="handleAvatarFileSelect"
                  accept="image/*"
                  :limit="1"
                >
                  <el-button type="primary" :loading="uploading" icon="Upload">
                    {{ uploading ? 'Uploading...' : 'Change Picture' }}
                  </el-button>
                </el-upload>
                
                <div class="upload-tips">
                  <p>Any size image - you can crop it!</p>
                  <p>For header and profile display</p>
                </div>
              </div>
            </div>

            <!-- Small Profile Icon -->
            <div class="icon-avatar-section">
              <h4 class="avatar-section-title">Spreadsheet Icon</h4>
              <div class="current-icon">
                <div class="icon-preview">
                  <img 
                    v-if="profileData.profile_icon_url" 
                    :src="profileData.profile_icon_url" 
                    alt="Profile Icon"
                    class="profile-icon"
                  />
                  <div v-else class="icon-placeholder">
                    <el-icon><UserFilled /></el-icon>
                  </div>
                </div>
              </div>
              
              <div class="icon-upload">
                <el-upload
                  ref="iconUploadRef"
                  class="icon-uploader"
                  :auto-upload="false"
                  :show-file-list="false"
                  :on-change="handleIconFileSelect"
                  accept="image/*"
                  :limit="1"
                >
                  <el-button size="small" :loading="iconUploading" icon="Upload">
                    {{ iconUploading ? 'Uploading...' : 'Change Icon' }}
                  </el-button>
                </el-upload>
                
                <div class="upload-tips">
                  <p>Any size image - will be cropped small</p>
                  <p>For spreadsheet cells display</p>
                </div>
              </div>
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

    <!-- Image Cropping Dialog -->
    <el-dialog
      v-model="showCropDialog"
      :title="cropType === 'avatar' ? 'Crop Profile Picture' : 'Crop Spreadsheet Icon'"
      width="600px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      @close="handleCropCancel"
    >
      <div class="crop-container">
        <div class="cropper-wrapper">
          <Cropper
            ref="cropperRef"
            class="cropper"
            :src="cropImageSrc"
            :stencil-props="cropperConfig.stencilProps"
            :resize-image="cropperConfig.resizeImage"
            :move-image="cropperConfig.moveImage"
            :auto-zoom="true"
            :check-orientation="false"
          />
        </div>
        
        <div class="crop-info">
          <h4>{{ cropType === 'avatar' ? 'Profile Picture' : 'Spreadsheet Icon' }}</h4>
          <p v-if="cropType === 'avatar'">
            Crop your image to create a perfect square profile picture. 
            This will be used in the header and your profile.
          </p>
          <p v-else>
            Crop your image to create a small square icon. 
            This will be optimized for display in spreadsheet cells.
          </p>
          
          <div class="crop-tips">
            <p><strong>Target size:</strong> {{ cropType === 'avatar' ? '300x300 pixels' : '32x32 pixels' }}</p>
            <p><strong>Tip:</strong> Drag to move, scroll/pinch to zoom</p>
          </div>
        </div>
      </div>
      
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="handleCropCancel">Cancel</el-button>
          <el-button type="primary" @click="handleCropConfirm" :loading="uploading || iconUploading">
            {{ (uploading || iconUploading) ? 'Processing...' : 'Crop & Upload' }}
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ElForm, ElFormItem, ElInput, ElButton, ElAvatar, ElUpload, ElSelect, ElOption, ElMessage, ElMessageBox, ElDialog } from 'element-plus';
import { Upload, UserFilled } from '@element-plus/icons-vue';
import { Cropper } from 'vue-advanced-cropper';
import 'vue-advanced-cropper/dist/style.css';
import { supabase } from '../supabase';
import HeaderCt from './HeaderCt.vue';

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
    ElDialog,
    Upload,
    UserFilled,
    HeaderCt,
    Cropper
  },
  data() {
    return {
      profileData: {
        email: '',
        full_name: '',
        user_name: '',
        avatar_url: '',
        profile_icon_url: '',
        display_name_preference: 'full_name'
      },
      originalData: {},
      uploading: false,
      iconUploading: false,
      saving: false,
      uploadProgress: 0,
      showCropDialog: false,
      cropImageSrc: '',
      cropType: 'avatar', // 'avatar' or 'icon'
      selectedFile: null,
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
    },
    cropperConfig() {
      if (this.cropType === 'avatar') {
        return {
          stencilProps: {
            aspectRatio: 1,
            minWidth: 100,
            minHeight: 100
          },
          resizeImage: {
            adjustStencil: false
          },
          moveImage: true
        };
      } else {
        return {
          stencilProps: {
            aspectRatio: 1,
            minWidth: 32,
            minHeight: 32
          },
          resizeImage: {
            adjustStencil: false
          },
          moveImage: true
        };
      }
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
            profile_icon_url: user.user_metadata?.profile_icon_url || '',
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

    handleAvatarFileSelect(file) {
      this.openCropDialog(file, 'avatar');
    },

    handleIconFileSelect(file) {
      this.openCropDialog(file, 'icon');
    },

    openCropDialog(file, type) {
      if (!file) return;

      const isImage = file.raw.type.startsWith('image/');
      const isLt5M = file.raw.size / 1024 / 1024 < 5; // Increased limit since we're cropping

      if (!isImage) {
        ElMessage.error('Please upload an image file!');
        return;
      }
      if (!isLt5M) {
        ElMessage.error('Image size must be smaller than 5MB!');
        return;
      }

      this.selectedFile = file;
      this.cropType = type;
      this.cropImageSrc = URL.createObjectURL(file.raw);
      this.showCropDialog = true;
    },

    handleCropCancel() {
      this.showCropDialog = false;
      this.cropImageSrc = '';
      this.selectedFile = null;
      // Clear the upload input
      if (this.cropType === 'avatar') {
        this.$refs.uploadRef.clearFiles();
      } else {
        this.$refs.iconUploadRef.clearFiles();
      }
    },

    async handleCropConfirm() {
      if (!this.$refs.cropperRef) {
        ElMessage.error('Cropper not ready');
        return;
      }

      const canvas = this.$refs.cropperRef.getResult();
      if (!canvas || !canvas.canvas) {
        ElMessage.error('Failed to crop image');
        return;
      }

      // Set loading state
      if (this.cropType === 'avatar') {
        this.uploading = true;
      } else {
        this.iconUploading = true;
      }

      try {
        // Convert canvas to blob
        const targetSize = this.cropType === 'avatar' ? 300 : 32;
        
        // Create a new canvas with the target size
        const targetCanvas = document.createElement('canvas');
        targetCanvas.width = targetSize;
        targetCanvas.height = targetSize;
        const ctx = targetCanvas.getContext('2d');
        
        // Draw the cropped image at the target size
        ctx.drawImage(canvas.canvas, 0, 0, targetSize, targetSize);

        // Convert to blob
        const blob = await new Promise(resolve => {
          targetCanvas.toBlob(resolve, 'image/jpeg', 0.9);
        });

        if (!blob) {
          throw new Error('Failed to create image blob');
        }

        // Upload the cropped image
        await this.uploadCroppedImage(blob);
        
        // Close dialog
        this.showCropDialog = false;
        this.cropImageSrc = '';
        this.selectedFile = null;
        
      } catch (error) {
        console.error('Error processing cropped image:', error);
        ElMessage.error('Failed to process cropped image: ' + error.message);
      } finally {
        this.uploading = false;
        this.iconUploading = false;
      }
    },

    async uploadCroppedImage(blob) {
      try {
        // Get the current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No user found');

        // Create filename
        const timestamp = Date.now();
        const fileName = this.cropType === 'avatar' 
          ? `${user.id}/avatar-${timestamp}.jpg`
          : `${user.id}/icon-${timestamp}.jpg`;
        
        // Upload to Supabase storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('attorneys')
          .upload(fileName, blob, {
            cacheControl: '3600',
            upsert: false,
            contentType: 'image/jpeg'
          });

        if (uploadError) throw uploadError;

        // Get the public URL
        const { data: { publicUrl } } = supabase.storage
          .from('attorneys')
          .getPublicUrl(fileName);

        // Update the profile data
        if (this.cropType === 'avatar') {
          this.profileData.avatar_url = publicUrl;
          ElMessage.success('Profile picture updated successfully!');
        } else {
          this.profileData.profile_icon_url = publicUrl;
          ElMessage.success('Profile icon updated successfully!');
        }
        
      } catch (error) {
        console.error('Error uploading cropped image:', error);
        throw error;
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
            profile_icon_url: this.profileData.profile_icon_url,
            display_name_preference: this.profileData.display_name_preference
          }
        });

        if (error) throw error;

        // Update original data
        this.originalData = { ...this.profileData };
        
        ElMessage.success('Profile updated successfully!');
        
        // Optionally navigate back or refresh parent components
        //this.$router.back();
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
.profile-edit-layout {
  min-height: 100vh;
  background: #f8fafc;
}

.profile-edit-container {
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
  margin-bottom: 3rem;
  padding: 2rem;
  background: #f8fafc;
  border-radius: 12px;
  border: 2px dashed #e2e8f0;
}

.avatar-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3rem;
  align-items: start;
}

.main-avatar-section,
.icon-avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.avatar-section-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #374151;
  margin: 0 0 1.5rem 0;
}

.current-avatar {
  margin-bottom: 1.5rem;
}

.profile-avatar {
  border: 4px solid white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.current-icon {
  margin-bottom: 1.5rem;
}

.icon-preview {
  width: 64px;
  height: 64px;
  border-radius: 8px;
  border: 2px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.profile-icon {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 6px;
}

.icon-placeholder {
  color: #9ca3af;
  font-size: 24px;
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

  .avatar-row {
    grid-template-columns: 1fr;
    gap: 2rem;
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

/* Cropping Dialog Styles */
.crop-container {
  display: flex;
  gap: 2rem;
  min-height: 400px;
}

.cropper-wrapper {
  flex: 2;
  min-height: 400px;
}

.cropper {
  height: 400px;
  background: #f5f5f5;
}

.crop-info {
  flex: 1;
  padding: 1rem;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.crop-info h4 {
  margin: 0 0 1rem 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #1a1a1a;
}

.crop-info p {
  margin: 0 0 1.5rem 0;
  color: #666;
  line-height: 1.5;
}

.crop-tips {
  background: white;
  padding: 1rem;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
}

.crop-tips p {
  margin: 0.5rem 0;
  font-size: 0.9rem;
}

.crop-tips p:first-child {
  margin-top: 0;
}

.crop-tips p:last-child {
  margin-bottom: 0;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
}

/* Responsive cropping dialog */
@media (max-width: 768px) {
  .crop-container {
    flex-direction: column;
    gap: 1rem;
  }
  
  .cropper-wrapper {
    min-height: 300px;
  }
  
  .cropper {
    height: 300px;
  }
  
  .crop-info {
    padding: 0.75rem;
  }
  
  .dialog-footer {
    flex-direction: column;
  }
  
  .dialog-footer .el-button {
    width: 100%;
  }
}
</style>