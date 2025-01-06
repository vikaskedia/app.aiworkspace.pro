<template>
  <div class="file-preview-pane" v-if="file">
    <div class="preview-header">
      <h3>{{ file.name }}</h3>
      <div class="header-actions">
        <el-button 
          type="primary" 
          link 
          @click="showRenameDialog"
          @click.native="console.log('Rename button clicked')">
          <el-icon><Edit /></el-icon>
        </el-button>
        <el-button type="primary" link @click="$emit('close')">
          <el-icon><Close /></el-icon>
        </el-button>
      </div>
    </div>
    
    <el-dialog
      v-model="renameDialogVisible"
      title="Rename File"
      width="400px">
      <el-form :model="renameForm" label-position="top">
        <el-form-item 
          label="New File Name" 
          required
          :rules="[{ required: true, message: 'File name is required' }]">
          <el-input v-model="renameForm.newName" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="renameDialogVisible = false">Cancel</el-button>
          <el-button
            type="primary"
            @click="handleRename"
            :loading="renaming"
            :disabled="!renameForm.newName || renameForm.newName === file.name">
            Rename
          </el-button>
        </span>
      </template>
    </el-dialog>
    
    <div class="preview-content">
      <!-- Loading State -->
      <el-skeleton v-if="loading" :rows="10" animated />
      
      <!-- Error State -->
      <div v-else-if="error" class="no-preview">
        <el-icon class="no-preview-icon"><Warning /></el-icon>
        <p>{{ error }}</p>
        <el-button type="primary" @click="retryLoad">
          Retry
        </el-button>
      </div>
      
      <!-- PDF Preview -->
      <iframe
        v-else-if="file.type === 'application/pdf'"
        :src="file.download_url"
        class="pdf-viewer"
        @load="handlePdfLoad"
        @error="handleError"
        sandbox="allow-same-origin allow-scripts allow-forms"
        type="application/pdf"
      ></iframe>
      
      <!-- Image Preview -->
      <template v-if="file.type.startsWith('image/')">
        <div class="image-container">
          <img
            :src="file.download_url"
            class="image-preview"
            @load="handleImageLoad"
            @error="handleImageError"
            :alt="file.name"
          />
          <div v-if="debug" class="debug-info">
            <p>Image URL: {{ file.download_url }}</p>
            <p>Image Type: {{ file.type }}</p>
          </div>
        </div>
      </template>
      
      <!-- Text Preview -->
      <div
        v-else-if="file.type === 'text/plain'"
        class="text-preview"
      >
        <pre>{{ textContent }}</pre>
      </div>
      
      <!-- Fallback -->
      <div v-else class="no-preview">
        <el-icon class="no-preview-icon"><Document /></el-icon>
        <p>Preview not available for this file type</p>
        <el-button type="primary" @click="downloadFile">
          Download File
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { Close, Edit, Document, Warning } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';

const props = defineProps({
  file: {
    type: Object,
    required: true
  }
});

const textContent = ref('');
const loading = ref(true);
const error = ref(null);
const debug = ref(true);
const renameDialogVisible = ref(false);
const renameForm = ref({ newName: '' });
const renaming = ref(false);
const emit = defineEmits(['close', 'update:file']);

async function loadTextContent() {
  if (props.file.type === 'text/plain') {
    try {
      loading.value = true;
      error.value = null;
      const response = await fetch(props.file.download_url);
      if (!response.ok) throw new Error('Failed to load file content');
      textContent.value = await response.text();
    } catch (err) {
      error.value = 'Failed to load text content';
      console.error('Error loading text content:', err);
    } finally {
      loading.value = false;
    }
  }
}

function handleError() {
  loading.value = false;
  error.value = 'Failed to load file preview';
}

function retryLoad() {
  loading.value = true;
  error.value = null;
  loadTextContent();
}

function downloadFile() {
  window.open(props.file.download_url, '_blank');
}

function handleImageLoad() {
  loading.value = false;
  error.value = null;
}

function handleImageError(e) {
  console.error('Image load error:', e);
  loading.value = false;
  error.value = 'Failed to load image';
}

function handlePdfLoad() {
  loading.value = false;
  error.value = null;
}

function showRenameDialog() {
  console.log('showRenameDialog called');
  renameForm.value.newName = props.file.name;
  renameDialogVisible.value = true;
  console.log('Dialog visible:', renameDialogVisible.value);
}

async function handleRename() {
  if (!renameForm.value.newName || renameForm.value.newName === props.file.name) {
    return;
  }

  try {
    renaming.value = true;
    const giteaToken = import.meta.env.VITE_GITEA_TOKEN;
    const giteaHost = import.meta.env.VITE_GITEA_HOST;
    
    // Get the current file content
    const getResponse = await fetch(props.file.download_url, {
      headers: {
        'Authorization': `token ${giteaToken}`
      }
    });
    
    if (!getResponse.ok) throw new Error('Failed to get file content');
    
    // Get the file content as base64
    const content = await getResponse.text();
    const base64Content = btoa(content);

    // Delete the old file - Fix the repository path
    const deleteResponse = await fetch(
      `${giteaHost}/api/v1/repos/associateattorney/${props.file.git_repo}/contents/${props.file.storage_path}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `token ${giteaToken}`,
          'Accept': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify({
          message: `Delete ${props.file.name} for rename`,
          sha: props.file.id,
          branch: 'main'
        })
      }
    );

    if (!deleteResponse.ok) throw new Error('Failed to delete old file');

    // Create the new file - Fix the repository path here too
    const createResponse = await fetch(
      `${giteaHost}/api/v1/repos/associateattorney/${props.file.git_repo}/contents/${renameForm.value.newName}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${giteaToken}`,
          'Content-Type': 'application/json',
          'Authorization': `token ${giteaToken}`,
          'Accept': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify({
          message: `Rename ${props.file.name} to ${renameForm.value.newName}`,
          content: base64Content,
          branch: 'main'
        })
      }
    );

    if (!createResponse.ok) throw new Error('Failed to create new file');

    const newFileData = await createResponse.json();

    // Update the file object
    const updatedFile = {
      ...props.file,
      id: newFileData.content.sha,
      name: renameForm.value.newName,
      storage_path: newFileData.content.path,
      download_url: newFileData.content.download_url.replace(import.meta.env.VITE_GITEA_HOST, '/gitea')
    };

    // Emit the updated file
    emit('update:file', updatedFile);
    
    renameDialogVisible.value = false;
    ElMessage.success('File renamed successfully');
  } catch (error) {
    console.error('Error renaming file:', error);
    ElMessage.error('Failed to rename file: ' + error.message);
  } finally {
    renaming.value = false;
  }
}

watch(() => props.file, async (newFile) => {
  if (newFile) {
    loading.value = true;
    error.value = null;
    
    // Only fetch content for text files
    if (newFile.type === 'text/plain') {
      await loadTextContent();
    }
    // For images and PDFs, loading state will be managed by their respective @load events
    else if (!newFile.type.startsWith('image/') && newFile.type !== 'application/pdf') {
      loading.value = false;
    }
  }
}, { immediate: true });
</script>

<style scoped>
.file-preview-pane {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: white;
  border-left: 1px solid #dcdfe6;
}

.preview-header {
  padding: 16px;
  border-bottom: 1px solid #dcdfe6;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.preview-header h3 {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-content {
  flex: 1;
  overflow: auto;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.pdf-viewer {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}

.image-preview {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.text-preview {
  width: 100%;
  height: 100%;
  overflow: auto;
  background: #f8f9fa;
  padding: 16px;
}

.text-preview pre {
  margin: 0;
  white-space: pre-wrap;
  font-family: monospace;
}

.no-preview {
  text-align: center;
  padding: 32px;
  color: #909399;
}

.no-preview-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.folder-navigation {
  padding: 8px 16px;
  border-bottom: 1px solid #EBEEF5;
}

.folder-navigation :deep(.el-breadcrumb) {
  line-height: 32px;
}

.folder-navigation .clickable {
  cursor: pointer;
  color: #409EFF;
}

.folder-navigation .clickable:hover {
  text-decoration: underline;
}
</style> 