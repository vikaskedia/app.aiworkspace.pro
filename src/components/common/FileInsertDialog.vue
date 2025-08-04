<template>
    <el-dialog
      v-model="dialogVisible"
      title="Insert File"
      width="600px">
      <el-tabs v-model="activeTab">
        <!-- Upload New File Tab -->
        <el-tab-pane label="Upload New File" name="upload">
          <el-upload
            class="file-upload"
            drag
            action="#"
            :auto-upload="false"
            :on-change="handleFileChange"
            :file-list="fileList">
            <el-icon class="el-icon--upload"><upload-filled /></el-icon>
            <div class="el-upload__text">
              Drop file here or <em>click to upload</em>
            </div>
          </el-upload>
        </el-tab-pane>
  
        <!-- Select Existing File Tab -->
        <el-tab-pane label="Select Existing File" name="select">
          <div class="file-selector">
            <!-- Breadcrumb Navigation -->
            <div class="file-selector-header">
              <el-breadcrumb separator="/">
                <el-breadcrumb-item 
                  @click="navigateFolder(null)"
                  :class="{ clickable: currentFolder }">
                  Root
                </el-breadcrumb-item>
                <el-breadcrumb-item 
                  v-for="folder in breadcrumbs" 
                  :key="folder.id"
                  @click="navigateFolder(folder)"
                  :class="{ clickable: folder.id !== currentFolder?.id }">
                  {{ folder.name }}
                </el-breadcrumb-item>
              </el-breadcrumb>
            </div>
  
            <!-- Search Input -->
            <el-input
              v-model="searchQuery"
              placeholder="Search files..."
              clearable />
  
            <!-- Files List -->
            <div class="files-list">
              <div v-if="loading" class="loading-container">
                <el-icon class="is-loading"><Loading /></el-icon>
                <span>Loading...</span>
              </div>
              <template v-else>
                <div
                  v-for="item in filteredItems"
                  :key="item.id"
                  class="file-item"
                  @click="item.type === 'dir' ? navigateFolder(item) : selectFile(item)">
                  <el-icon>
                    <Folder v-if="item.type === 'dir'" />
                    <Document v-else />
                  </el-icon>
                  {{ item.name }}
                </div>
                <div v-if="filteredItems.length === 0" class="no-results">
                  No files or folders found
                </div>
              </template>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
  
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">Cancel</el-button>
          <el-button
            v-if="activeTab === 'upload' && fileList.length"
            type="primary"
            @click="uploadFile"
            :loading="uploading">
            Upload & Insert
          </el-button>
        </span>
      </template>
    </el-dialog>
  </template>
  
  <script setup>
  import { ref, watch, computed } from 'vue'
  import { ElMessage } from 'element-plus'
  import { Folder, Document, Loading, UploadFilled } from '@element-plus/icons-vue'
  import { useMatterStore } from '../../store/workspace'
  import { storeToRefs } from 'pinia'
  
  const props = defineProps({
    modelValue: Boolean
  })
  
  const emit = defineEmits(['update:modelValue', 'file-selected'])
  
  const matterStore = useMatterStore()
  const { currentMatter } = storeToRefs(matterStore)
  
  const dialogVisible = ref(false)
  const activeTab = ref('upload')
  const fileList = ref([])
  const searchQuery = ref('')
  const loading = ref(false)
  const uploading = ref(false)
  const currentFolder = ref(null)
  const breadcrumbs = ref([])
  const folders = ref([])
  const files = ref([])
  
  const filteredItems = computed(() => {
    let result = [...folders.value, ...files.value];
    
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase();
      result = result.filter(item => 
        item.name.toLowerCase().includes(query)
      );
    }
    
    return result;
  })
  
  watch(() => props.modelValue, (val) => {
    dialogVisible.value = val
    if (val) {
      loadFiles()
    }
  })
  
  watch(dialogVisible, (val) => {
    emit('update:modelValue', val)
    if (!val) {
      resetState()
    }
  })
  
  function resetState() {
    activeTab.value = 'upload'
    fileList.value = []
    searchQuery.value = ''
    currentFolder.value = null
    breadcrumbs.value = []
  }
  
  // Implement the file loading logic from your existing code
  const loadFiles = async () => {
    if (!currentMatter.value) return
    
    loading.value = true
    try {
      const giteaToken = import.meta.env.VITE_GITEA_TOKEN
      const giteaHost = import.meta.env.VITE_GITEA_HOST;
      const path = currentFolder.value?.path || ''
      
      const response = await fetch(
        `${giteaHost}/api/v1/repos/associateattorney/${currentMatter.value.git_repo}/contents/${path}`,
        {
          headers: {
            'Authorization': `token ${giteaToken}`,
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          }
        }
      )
  
      if (!response.ok) throw new Error('Failed to fetch files')
      
      const contents = await response.json()
      
      folders.value = contents
        .filter(item => item.type === 'dir')
        .map(folder => ({
          id: folder.sha,
          name: folder.name,
          path: folder.path,
          type: 'dir'
        }))
  
      files.value = contents
        .filter(item => item.type === 'file' && item.name !== '.gitkeep')
        .map(file => ({
          id: file.sha,
          name: file.name,
          path: file.path,
          type: 'file',
          download_url: file.download_url
        }))
    } catch (error) {
      ElMessage.error('Error loading files: ' + error.message)
      folders.value = []
      files.value = []
    } finally {
      loading.value = false
    }
  }
  
  // Add these methods after loadFiles()
  const navigateFolder = async (folder) => {
    try {
      loading.value = true
      if (!folder) {
        // Reset to root
        currentFolder.value = null
        breadcrumbs.value = []
      } else {
        // Find if folder exists in current breadcrumbs
        const existingIndex = breadcrumbs.value.findIndex(f => f.id === folder.id)
        
        if (existingIndex >= 0) {
          // Clicking a folder in breadcrumbs - truncate to that point
          breadcrumbs.value = breadcrumbs.value.slice(0, existingIndex + 1)
        } else {
          // New folder - add to breadcrumbs
          breadcrumbs.value.push(folder)
        }
        
        currentFolder.value = folder
      }
      
      await loadFiles()
    } catch (error) {
      ElMessage.error('Error navigating folder: ' + error.message)
    } finally {
      loading.value = false
    }
  }
  
  const selectFile = (file) => {
    emit('file-selected', file)
    dialogVisible.value = false
    ElMessage.success('File selected successfully')
  }
  
  // Add other necessary methods (handleFileChange, uploadFile, navigateFolder, selectFile)
  
  const handleFileChange = (uploadFile) => {
    fileList.value = [uploadFile]
  }
  
  const getUniqueFileName = (originalName) => {
    const timestamp = new Date().getTime();
    const lastDotIndex = originalName.lastIndexOf('.');
    
    // Handle files with no extension
    if (lastDotIndex === -1) {
      return `${originalName}_${timestamp}`;
    }
    
    // Handle files with extension
    const baseName = originalName.substring(0, lastDotIndex);
    const ext = originalName.substring(lastDotIndex);
    
    return `${baseName}_${timestamp}${ext}`;
  }
  
  const uploadFile = async () => {
    if (!fileList.value.length) return
    
    uploading.value = true
    try {
      const file = fileList.value[0].raw
      const giteaToken = import.meta.env.VITE_GITEA_TOKEN
      const giteaHost = import.meta.env.VITE_GITEA_HOST;
      
      if (!currentMatter.value) throw new Error('No workspace selected')
      
      // Generate unique filename for new uploads only
      const uniqueFileName = getUniqueFileName(file.name)
      
      // Convert file to base64
      const base64Content = await new Promise((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const base64 = reader.result.split(',')[1]
          resolve(base64)
        }
        reader.readAsDataURL(file)
      })
  
      // Upload to Gitea with unique filename
      const response = await fetch(
        `${giteaHost}/api/v1/repos/associateattorney/${currentMatter.value.git_repo}/contents/${uniqueFileName}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `token ${giteaToken}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: `Upload ${uniqueFileName}`,
            content: base64Content,
            branch: 'main'
          })
        }
      )
  
      if (!response.ok) throw new Error('Failed to upload file')
      
      const data = await response.json()
      const downloadUrl = data.content.download_url
  
      // Emit the file selected event with the new filename
      emit('file-selected', {
        name: uniqueFileName,
        download_url: downloadUrl
      })
      
      // Close dialog and reset state
      dialogVisible.value = false
      fileList.value = []
      
    } catch (error) {
      ElMessage.error('Error uploading file: ' + error.message)
    } finally {
      uploading.value = false
    }
  }
  </script>
  
  <style scoped>
  .files-list {
    max-height: 300px;
    overflow-y: auto;
  }
  
  .file-item {
    padding: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .file-item:hover {
    background-color: var(--el-fill-color-light);
  }
  
  .loading-container {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 20px;
  }
  
  .clickable {
    cursor: pointer;
    color: var(--el-color-primary);
  }
  
  .clickable:hover {
    text-decoration: underline;
  }
  
  .no-results {
    text-align: center;
    color: var(--el-text-color-secondary);
    padding: 20px;
  }
  </style> 