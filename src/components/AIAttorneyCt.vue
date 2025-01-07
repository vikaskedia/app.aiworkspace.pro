<template>
    <div class="ai-attorney-container">
      <HeaderCt />
      <div class="content">
        <div class="actions">
          <el-button type="primary" @click="showCreateDialog = true" size="small">
            <el-icon><Plus /></el-icon>
            Create New Attorney
          </el-button>
        </div>
  
        <!-- Attorney List -->
        <div class="attorney-grid">
          <el-card v-for="attorney in attorneys" :key="attorney.id" class="attorney-card" shadow="hover">
            <div class="attorney-header">
              <el-avatar :size="80" :src="attorney.image_url" class="attorney-avatar">
                {{ attorney.name.charAt(0) }}
              </el-avatar>
              <div class="attorney-title">
                <h3>{{ attorney.name }}</h3>
                <el-tag size="small" type="success">{{ attorney.specialty }}</el-tag>

                <div class="attorney-details">
                    <p><i class="el-icon-location"></i> {{ attorney.jurisdiction }}</p>
                    <p class="system-prompt">{{ attorney.system_prompt }}</p>
                </div>
              </div>
            </div>
  
            <div class="attorney-actions">
              <el-button-group>
                <el-button type="primary" @click="editAttorney(attorney)" size="small">
                  <el-icon><Edit /></el-icon>
                </el-button>
                <el-button type="danger" @click="confirmDelete(attorney)" size="small">
                  <el-icon><Delete /></el-icon>
                </el-button>
              </el-button-group>
              <el-button 
                v-if="attorney.video_url" 
                type="info" 
                @click="showVideo(attorney)"
                size="small">
                <el-icon><VideoPlay /></el-icon>
                Watch Intro
              </el-button>
            </div>
          </el-card>
        </div>
  
        <!-- Create/Edit Attorney Dialog -->
        <el-dialog
          v-model="showCreateDialog"
          :title="editingAttorney ? 'Edit Attorney' : 'Create New Attorney'"
          width="600px">
          <el-form 
            :model="attorneyForm" 
            label-position="top"
            :rules="rules"
            ref="attorneyFormRef">
            <el-form-item label="Name" prop="name">
              <el-input v-model="attorneyForm.name" />
            </el-form-item>
  
            <el-form-item label="Profile Picture">
              <el-upload
                class="avatar-uploader"
                :http-request="handleImageUpload"
                :show-file-list="false"
                accept="image/*">
                <img v-if="attorneyForm.image_url" :src="attorneyForm.image_url" class="avatar" />
                <el-icon v-else class="avatar-uploader-icon"><Plus /></el-icon>
              </el-upload>
            </el-form-item>
  
            <el-form-item label="Introduction Video">
              <el-upload
                class="video-uploader"
                :http-request="handleVideoUpload"
                :show-file-list="false"
                accept="video/*">
                <video 
                  v-if="attorneyForm.video_url" 
                  :src="attorneyForm.video_url" 
                  controls 
                  class="video-preview" />
                <el-button v-else>Upload Video</el-button>
              </el-upload>
            </el-form-item>
  
            <el-form-item label="Specialty" prop="specialty">
              <el-input v-model="attorneyForm.specialty" />
            </el-form-item>
  
            <el-form-item label="Jurisdiction" prop="jurisdiction">
              <el-input v-model="attorneyForm.jurisdiction" />
            </el-form-item>
  
            <el-form-item label="System Prompt" prop="system_prompt">
              <el-input
                v-model="attorneyForm.system_prompt"
                type="textarea"
                :rows="4"
                placeholder="Enter the system prompt that defines this attorney's behavior..." />
            </el-form-item>
          </el-form>
  
          <template #footer>
            <span class="dialog-footer">
              <el-button @click="() => { showCreateDialog = false; resetForm(); }">Cancel</el-button>
              <el-button 
                type="primary" 
                @click="saveAttorney"
                :loading="saving">
                {{ editingAttorney ? 'Update' : 'Create' }}
              </el-button>
            </span>
          </template>
        </el-dialog>
  
        <!-- Video Preview Dialog -->
        <el-dialog
          v-model="showVideoDialog"
          title="Attorney Introduction"
          width="800px">
          <video 
            v-if="selectedAttorney?.video_url" 
            :src="selectedAttorney.video_url" 
            controls 
            style="width: 100%" />
        </el-dialog>
      </div>
    </div>
  </template>
  
  <script>
  import { ref, onMounted } from 'vue';
  import { supabase } from '../supabase';
  import { ElMessage, ElMessageBox } from 'element-plus';
  import HeaderCt from './HeaderCt.vue';
  import { Plus, Edit, Delete, VideoPlay } from '@element-plus/icons-vue';
  
  export default {
    name: 'AIAttorneyCt',
    components: { HeaderCt, Plus, Edit, Delete, VideoPlay },
    
    setup() {
      const attorneys = ref([]);
      const showCreateDialog = ref(false);
      const showVideoDialog = ref(false);
      const selectedAttorney = ref(null);
      const saving = ref(false);
      const attorneyFormRef = ref(null);
      const editingAttorney = ref(null);
      
      const attorneyForm = ref({
        name: '',
        image_url: '',
        video_url: '',
        specialty: '',
        jurisdiction: '',
        system_prompt: ''
      });
  
      const rules = {
        name: [{ required: true, message: 'Name is required', trigger: 'blur' }],
        specialty: [{ required: true, message: 'Specialty is required', trigger: 'blur' }],
        jurisdiction: [{ required: true, message: 'Jurisdiction is required', trigger: 'blur' }],
        system_prompt: [{ required: true, message: 'System prompt is required', trigger: 'blur' }]
      };
  
      const loadAttorneys = async () => {
        try {
          const { data, error } = await supabase
            .from('attorneys')
            .select('*')
            .order('created_at', { ascending: false });
  
          if (error) throw error;
          attorneys.value = data;
        } catch (error) {
          ElMessage.error('Error loading attorneys: ' + error.message);
        }
      };
  
      const handleImageUpload = async ({ file }) => {
        try {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
          const filePath = `images/${fileName}`;
  
          const { error: uploadError } = await supabase.storage
            .from('attorneys')
            .upload(filePath, file);
  
          if (uploadError) throw uploadError;
  
          const { data: { publicUrl } } = supabase.storage
            .from('attorneys')
            .getPublicUrl(filePath);
  
          attorneyForm.value.image_url = publicUrl;
        } catch (error) {
          ElMessage.error('Error uploading image: ' + error.message);
        }
      };
  
      const handleVideoUpload = async ({ file }) => {
        try {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
          const filePath = `videos/${fileName}`;
  
          const { error: uploadError } = await supabase.storage
            .from('attorneys')
            .upload(filePath, file);
  
          if (uploadError) throw uploadError;
  
          const { data: { publicUrl } } = supabase.storage
            .from('attorneys')
            .getPublicUrl(filePath);
  
          attorneyForm.value.video_url = publicUrl;
        } catch (error) {
          ElMessage.error('Error uploading video: ' + error.message);
        }
      };
  
      const saveAttorney = async () => {
        if (!attorneyFormRef.value) return;
        
        await attorneyFormRef.value.validate(async (valid) => {
          if (!valid) return;
          
          try {
            saving.value = true;
            const { data: { user } } = await supabase.auth.getUser();
            
            const attorneyData = {
              name: attorneyForm.value.name,
              image_url: attorneyForm.value.image_url,
              video_url: attorneyForm.value.video_url,
              specialty: attorneyForm.value.specialty,
              jurisdiction: attorneyForm.value.jurisdiction,
              system_prompt: attorneyForm.value.system_prompt
            };
  
            if (!editingAttorney.value) {
              attorneyData.created_by = user.id;
            }
  
            let error;
            if (editingAttorney.value) {
              const { error: updateError } = await supabase
                .from('attorneys')
                .update(attorneyData)
                .eq('id', editingAttorney.value.id);
              error = updateError;
            } else {
              const { error: insertError } = await supabase
                .from('attorneys')
                .insert([attorneyData]);
              error = insertError;
            }
  
            if (error) throw error;
  
            ElMessage.success(`Attorney ${editingAttorney.value ? 'updated' : 'created'} successfully`);
            showCreateDialog.value = false;
            resetForm();
            await loadAttorneys();
          } catch (error) {
            ElMessage.error(`Error ${editingAttorney.value ? 'updating' : 'creating'} attorney: ` + error.message);
          } finally {
            saving.value = false;
          }
        });
      };
  
      const editAttorney = (attorney) => {
        editingAttorney.value = attorney;
        attorneyForm.value = { ...attorney };
        showCreateDialog.value = true;
      };
  
      const resetForm = () => {
        editingAttorney.value = null;
        attorneyForm.value = {
          name: '',
          image_url: '',
          video_url: '',
          specialty: '',
          jurisdiction: '',
          system_prompt: ''
        };
      };
  
      const confirmDelete = (attorney) => {
        ElMessageBox.confirm(
          'Are you sure you want to delete this attorney?',
          'Warning',
          {
            confirmButtonText: 'Delete',
            cancelButtonText: 'Cancel',
            type: 'warning',
          }
        ).then(async () => {
          try {
            const { error } = await supabase
              .from('attorneys')
              .delete()
              .eq('id', attorney.id);
  
            if (error) throw error;
  
            ElMessage.success('Attorney deleted successfully');
            await loadAttorneys();
          } catch (error) {
            ElMessage.error('Error deleting attorney: ' + error.message);
          }
        }).catch(() => {
          // User cancelled deletion
        });
      };
  
      onMounted(() => {
        loadAttorneys();
      });
  
      return {
        attorneys,
        showCreateDialog,
        showVideoDialog,
        selectedAttorney,
        saving,
        attorneyForm,
        attorneyFormRef,
        rules,
        handleImageUpload,
        handleVideoUpload,
        saveAttorney,
        editingAttorney,
        editAttorney,
        resetForm,
        confirmDelete
      };
    },
  
    methods: {
      showVideo(attorney) {
        this.selectedAttorney = attorney;
        this.showVideoDialog = true;
      }
    }
  };
  </script>
  
  <style scoped>
  .ai-attorney-container {
    min-height: 100vh;
    background-color: #f5f7fa;
  }
  
  .content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
  }
  
  .actions {
    margin-bottom: 2rem;
  }
  
  .attorney-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 2rem;
    padding: 1rem 0;
  }
  
  .attorney-card {
    transition: all 0.3s ease;
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  
  .attorney-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 16px rgba(0,0,0,0.1);
  }
  
  .attorney-header {
    display: flex;
    align-items: flex-start;
    gap: 1.5rem;
  }
  
  .attorney-avatar {
    border: 3px solid #fff;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }
  
  .attorney-title {
    flex: 1;
  }
  
  .attorney-title h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.25rem;
    color: var(--el-text-color-primary);
  }
  
  .attorney-details {
    flex: 1;
    margin: 1rem 0;
    color: var(--el-text-color-regular);
  }
  
  .system-prompt {
    margin-top: 1rem;
    font-size: 0.9rem;
    color: var(--el-text-color-secondary);
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .attorney-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: auto;
    padding-top: 1rem;
    border-top: 1px solid var(--el-border-color-lighter);
  }
  
  .avatar-uploader {
    text-align: center;
  }
  
  .avatar {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    object-fit: cover;
  }
  
  .avatar-uploader-icon {
    font-size: 28px;
    color: #8c939d;
    width: 100px;
    height: 100px;
    line-height: 100px;
    text-align: center;
    border: 1px dashed #d9d9d9;
    border-radius: 50%;
  }
  
  .video-preview {
    max-width: 100%;
    max-height: 200px;
  }
  
  @media (max-width: 640px) {
    .content {
      padding: 1rem;
    }
    
    .attorney-grid {
      grid-template-columns: 1fr;
    }
    
    .attorney-actions {
      flex-direction: column;
      gap: 0.5rem;
    }
    
    .attorney-actions .el-button-group {
      width: 100%;
      display: flex;
    }
    
    .attorney-actions .el-button {
      flex: 1;
    }
  }
  </style> 