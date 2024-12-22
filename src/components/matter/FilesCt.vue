<!-- 
Architecture description:
All the files are stored in the Gitea server.
The files are stored in the matter's repository.
-->
<script setup>
import { ref, onMounted, watch } from 'vue';
import { Plus, UploadFilled } from '@element-plus/icons-vue';
import { supabase } from '../../supabase';
import { ElMessage } from 'element-plus';
import { useMatterStore } from '../../store/matter';
import { storeToRefs } from 'pinia';
import { useRoute } from 'vue-router';

const route = useRoute();
const matterStore = useMatterStore();
const { currentMatter } = storeToRefs(matterStore);

const files = ref([]);
const loading = ref(false);
const uploadDialogVisible = ref(false);
const fileList = ref([]);
const selectedTags = ref([]);
const tagInputVisible = ref(false);
const tagInputValue = ref('');

// Load files when matter changes
watch(currentMatter, async (newMatter) => {
  if (newMatter?.id) {
    await loadFiles();
  } else {
    files.value = [];
  }
}, { immediate: true });

// Load matter if not already loaded
onMounted(async () => {
  if (route.params.matterId && !currentMatter.value) {
    const { data, error } = await supabase
      .from('matters')
      .select('*')
      .eq('id', route.params.matterId)
      .single();
      
    if (error) {
      ElMessage.error('Error loading matter');
      return;
    }
    
    if (data) {
      matterStore.setCurrentMatter(data);
    }
  }
});

async function loadFiles() {
  if (!currentMatter.value) return;
  
  loading.value = true;
  
  try {
    const giteaToken = import.meta.env.VITE_GITEA_TOKEN;

    if (!giteaToken) {
      throw new Error('Gitea configuration is missing');
    }

    const response = await fetch(
      `/gitea/api/v1/repos/vikas/${currentMatter.value.git_repo}/contents`,
      {
        headers: {
          'Authorization': `token ${giteaToken}`,
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch files');
    }

    const giteaFiles = await response.json();
    
    files.value = giteaFiles.map(file => ({
      id: file.sha,
      name: file.name,
      type: getFileType(file.name),
      size: file.size,
      storage_path: file.path,
      matter_id: currentMatter.value.id,
      created_at: new Date().toISOString(),
      tags: [],
      download_url: file.download_url.replace(import.meta.env.VITE_GITEA_HOST, '/gitea')
    }));

  } catch (error) {
    ElMessage.error('Error loading files: ' + error.message);
  } finally {
    loading.value = false;
  }
}

function getFileType(filename) {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeTypes = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

async function handleFileUpload(file) {
  if (!currentMatter.value) {
    ElMessage.warning('Please select a matter first');
    return;
  }

  if (!file) {
    ElMessage.warning('Please select a file to upload');
    return;
  }

  loading.value = true;

  try {
    const giteaToken = import.meta.env.VITE_GITEA_TOKEN;
    const { data: { user } } = await supabase.auth.getUser();

    // Convert file to base64
    const base64Content = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.readAsDataURL(file.raw);
    });

    // Upload to Gitea
    const response = await fetch(
      `/gitea/api/v1/repos/vikas/${currentMatter.value.git_repo}/contents/${file.name}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${giteaToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `Upload ${file.name}`,
          content: base64Content,
          branch: 'main'
        })
      }
    );

    if (!response.ok) {
      throw new Error('Failed to upload file to Gitea');
    }

    const giteaData = await response.json();

    // Add file to local state
    files.value.unshift({
      id: giteaData.content.sha,
      name: file.name,
      type: getFileType(file.name),
      size: file.size,
      storage_path: giteaData.content.path,
      matter_id: currentMatter.value.id,
      created_at: new Date().toISOString(),
      tags: selectedTags.value,
      download_url: giteaData.content.download_url.replace(import.meta.env.VITE_GITEA_HOST, '/gitea')
    });

    uploadDialogVisible.value = false;
    fileList.value = [];
    selectedTags.value = [];
    ElMessage.success('File uploaded successfully');

  } catch (error) {
    ElMessage.error('Error uploading file: ' + error.message);
  } finally {
    loading.value = false;
  }
}

async function deleteFile(file) {
  try {
    loading.value = true;
    const giteaToken = import.meta.env.VITE_GITEA_TOKEN;

    // Delete from Gitea
    const response = await fetch(
      `/gitea/api/v1/repos/vikas/${currentMatter.value.git_repo}/contents/${file.storage_path}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `token ${giteaToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `Delete ${file.name}`,
          sha: file.id,
          branch: 'main'
        })
      }
    );

    if (!response.ok) {
      throw new Error('Failed to delete file from Gitea');
    }

    // Remove from local state
    files.value = files.value.filter(f => f.id !== file.id);
    ElMessage.success('File deleted successfully');

  } catch (error) {
    ElMessage.error('Error deleting file: ' + error.message);
  } finally {
    loading.value = false;
  }
}

function showTagInput() {
  tagInputVisible.value = true;
  nextTick(() => {
    document.querySelector('.tags-input input')?.focus();
  });
}

function handleTagInputConfirm() {
  const inputValue = tagInputValue.value;
  if (inputValue && !selectedTags.value.includes(inputValue)) {
    selectedTags.value.push(inputValue);
  }
  tagInputVisible.value = false;
  tagInputValue.value = '';
}
</script>

<template>
  <div class="manage-files">
    <div class="content">
      <div class="header">
        <el-button type="primary" @click="uploadDialogVisible = true" size="small" :icon="Plus">
          Upload Files
        </el-button>
      </div>

      <el-table
        v-loading="loading"
        :data="files"
        style="width: 100%"
        :default-sort="{ prop: 'created_at', order: 'descending' }">
        
        <el-table-column 
          prop="name" 
          label="File Name"
          min-width="120" />
          
        <el-table-column 
          prop="type" 
          label="Type" 
          width="120"
          :show-overflow-tooltip="true" />
          
        <el-table-column 
          prop="size" 
          label="Size" 
          width="90">
          <template #default="scope">
            {{ Math.round(scope.row.size / 1024) }} KB
          </template>
        </el-table-column>
        
        <el-table-column 
          prop="tags" 
          label="Tags" 
          width="200"
          :show-overflow-tooltip="true">
          <template #default="scope">
            <el-tag
              v-for="tag in scope.row.tags"
              :key="tag"
              size="small"
              style="margin: 2px">
              {{ tag }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column 
          label="Actions" 
          width="90"
          fixed="right">
          <template #default="scope">
            <el-button
              type="danger"
              size="small"
              @click="deleteFile(scope.row)">
              Delete
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- Upload Dialog -->
    <el-dialog
      v-model="uploadDialogVisible"
      title="Upload Files"
      width="500px">
      <el-upload
        class="upload-area"
        drag
        action="#"
        :auto-upload="false"
        :on-change="(file) => fileList = [file]"
        :file-list="fileList">
        <el-icon class="el-icon--upload"><upload-filled /></el-icon>
        <div class="el-upload__text">
          Drop file here or <em>click to upload</em>
        </div>
      </el-upload>

      <div class="tags-section">
        <h4>Add Tags</h4>
        <div class="tags-input">
          <el-tag
            v-for="tag in selectedTags"
            :key="tag"
            closable
            @close="selectedTags.splice(selectedTags.indexOf(tag), 1)">
            {{ tag }}
          </el-tag>
          <el-input
            v-if="tagInputVisible"
            ref="tagInput"
            v-model="tagInputValue"
            size="small"
            style="width: 100px"
            @keyup.enter="handleTagInputConfirm"
            @blur="handleTagInputConfirm"
          />
          <el-button v-else size="small" @click="showTagInput">
            + New Tag
          </el-button>
        </div>
      </div>

      <template #footer>
        <span class="dialog-footer">
          <el-button @click="uploadDialogVisible = false">Cancel</el-button>
          <el-button
            type="primary"
            @click="handleFileUpload(fileList[0])"
            :disabled="!fileList.length">
            Upload
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.manage-files {
  min-height: 100vh;
  background-color: #f5f7fa;
  font-family: 'Roboto', sans-serif;
}

.content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.header h2 {
  margin: 0;
  font-size: 1.7rem;
  font-weight: 500;
  color: #303133;
}

/* Add responsive padding for mobile */
@media (max-width: 640px) {
  .content {
    padding: 1rem;
  }
  
  .header {
    flex-direction: row;
    gap: 1rem;
    align-items: center;
  }
  
  .header h2 {
    font-size: 1.4rem;
    flex: 1;
  }
  
  /* Make upload button full width on mobile */
  .header .el-button {
    width: auto;
    white-space: nowrap;
  }
  
  /* Adjust table for mobile */
  :deep(.el-table) {
    font-size: 0.9rem;
  }
  
  /* Hide less important columns on mobile */
  :deep(.el-table .cell) {
    padding: 8px;
  }
  
  /* Adjust upload dialog for mobile */
  :deep(.el-dialog) {
    width: 90% !important;
    margin: 0 auto;
  }
  
  /* Make tags wrap better on mobile */
  .tags-input {
    gap: 0.25rem;
  }
  
  /* Adjust tag input sizing */
  :deep(.el-input) {
    width: 80px !important;
  }
  
  /* Make dialog buttons stack on mobile */
  .dialog-footer {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .dialog-footer .el-button {
    width: 100%;
  }
}

/* Adjust table column widths for better mobile display */
@media (max-width: 480px) {
  :deep(.el-table) {
    /* Allow horizontal scroll for table */
    display: block;
    overflow-x: auto;
    white-space: nowrap;
  }
  
  /* Ensure minimum width for action buttons */
  :deep(.el-button--small) {
    min-width: 60px;
  }
}
</style>
