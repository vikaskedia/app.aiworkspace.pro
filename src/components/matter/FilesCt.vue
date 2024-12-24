<!-- 
Architecture description:
All the files are stored in the Gitea server.
The files are stored in the matter's repository.
-->
<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { Plus, UploadFilled, Folder, FolderAdd } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { useMatterStore } from '../../store/matter';
import { storeToRefs } from 'pinia';
import { useRoute } from 'vue-router';
import FilePreviewPane from './FilePreviewPane.vue';

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
const selectedFile = ref(null);
const currentFolder = ref(null);
const folders = ref([]);
const newFolderDialogVisible = ref(false);
const newFolderName = ref('');
const folderBreadcrumbs = ref([]);
const filters = ref({
  search: '',
  type: null,
  showFilters: false
});

const FILE_TYPES = {
  FOLDER: 'dir',
  PDF: 'application/pdf',
  WORD: 'application/msword',
  TEXT: 'text/plain',
  IMAGE: ['image/jpeg', 'image/png', 'image/gif']
};

const activeFiltersCount = computed(() => {
  let count = 0;
  if (filters.value.search) count++;
  if (filters.value.type) count++;
  return count;
});

const filteredItems = computed(() => {
  let result = [...folders.value, ...files.value];
  
  if (filters.value.search) {
    const query = filters.value.search.toLowerCase();
    result = result.filter(item => 
      item.name.toLowerCase().includes(query)
    );
  }
  
  if (filters.value.type) {
    console.log('Filter type:', filters.value.type);
    result = result.filter(item => {
      console.log('Item type:', item.type);
      if (filters.value.type === FILE_TYPES.FOLDER) {
        return item.type === 'dir';
      }
      if (Array.isArray(filters.value.type)) {
        return filters.value.type.includes(item.type);
      }
      return item.type === filters.value.type;
    });
  }
  
  return result;
});

// Load files when matter changes
watch(currentMatter, async (newMatter) => {
  if (newMatter?.id) {
    await Promise.all([loadFolders(), loadFiles()]);
  } else {
    files.value = [];
    folders.value = [];
  }
}, { immediate: true });

// Load matter if not already loaded
onMounted(async () => {
  // if (route.params.matterId && !currentMatter.value) {
  //   const { data, error } = await supabase
  //     .from('matters')
  //     .select('*')
  //     .eq('id', route.params.matterId)
  //     .single();
      
  //   if (error) {
  //     ElMessage.error('Error loading matter');
  //     return;
  //   }
    
  //   if (data) {
  //     matterStore.setCurrentMatter(data);
  //   }
  // }
});

async function loadFiles() {
  if (!currentMatter.value) return;
  
  loading.value = true;
  
  try {
    const giteaToken = import.meta.env.VITE_GITEA_TOKEN;
    const path = currentFolder.value?.path || '';

    const response = await fetch(
      `/gitea/api/v1/repos/vikas/${currentMatter.value.git_repo}/contents/${path}`,
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

    const contents = await response.json();
    files.value = contents
      .filter(item => item.type === 'file' && item.name !== '.gitkeep')
      .map(file => ({
        id: file.sha,
        name: file.name,
        type: getFileType(file.name),
        size: file.size,
        storage_path: file.path,
        matter_id: currentMatter.value.id,
        git_repo: currentMatter.value.git_repo,
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
    png: 'image/png',  
    jpg: 'image/jpeg', 
    jpeg: 'image/jpeg',
    gif: 'image/gif',  
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
    
    // Construct the correct path including current folder
    const uploadPath = currentFolder.value ? 
      `${currentFolder.value.path}/${file.name}` : 
      file.name;

    // Convert file to base64
    const base64Content = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.readAsDataURL(file.raw);
    });

    // Upload to Gitea with the correct path
    const response = await fetch(
      `/gitea/api/v1/repos/vikas/${currentMatter.value.git_repo}/contents/${uploadPath}`,
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
      git_repo: currentMatter.value.git_repo,
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

function handleFileUpdate(updatedFile) {
  // Update the selected file
  selectedFile.value = updatedFile;
  
  // Update the file in the files array
  const index = files.value.findIndex(f => f.id === updatedFile.id);
  if (index !== -1) {
    files.value[index] = updatedFile;
  }
}

async function loadFolders() {
  if (!currentMatter.value) return;
  
  loading.value = true;
  try {
    const giteaToken = import.meta.env.VITE_GITEA_TOKEN;
    const path = currentFolder.value?.path || '';
    
    // Add proper path construction with leading slash
    const apiPath = `/gitea/api/v1/repos/vikas/${currentMatter.value.git_repo}/contents/${path}`.replace(/\/\//g, '/');

    const response = await fetch(
      apiPath,
      {
        headers: {
          'Authorization': `token ${giteaToken}`,
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to fetch folders: ${errorData.message || response.statusText}`);
    }

    const contents = await response.json();
    folders.value = contents
      .filter(item => item.type === 'dir')
      .map(folder => ({
        id: folder.sha,
        name: folder.name,
        path: folder.path,
        type: 'dir'
      }));

  } catch (error) {
    console.error('Folder loading error details:', error);
    ElMessage.error('Error loading folders: ' + error.message);
  } finally {
    loading.value = false;
  }
}

async function createFolder() {
  if (!currentMatter.value || !newFolderName.value.trim()) return;
  
  try {
    const giteaToken = import.meta.env.VITE_GITEA_TOKEN;
    const path = currentFolder.value ? 
      `${currentFolder.value.path}/${newFolderName.value}` : 
      newFolderName.value;

    // Create an empty file as .gitkeep to create the folder
    const response = await fetch(
      `/gitea/api/v1/repos/vikas/${currentMatter.value.git_repo}/contents/${path}/.gitkeep`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${giteaToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `Create folder ${newFolderName.value}`,
          content: '', // Empty file
          branch: 'main'
        })
      }
    );

    if (!response.ok) {
      throw new Error('Failed to create folder');
    }

    const newFolder = {
      id: Date.now().toString(), // Temporary ID
      name: newFolderName.value,
      path: path,
      type: 'dir'
    };
    
    folders.value.push(newFolder);
    newFolderDialogVisible.value = false;
    newFolderName.value = '';
    ElMessage.success('Folder created successfully');
  } catch (error) {
    ElMessage.error('Error creating folder: ' + error.message);
  }
}

async function navigateToFolder(folder) {
  try {
    loading.value = true;
    
    if (!folder) {
      // Reset to root
      currentFolder.value = null;
      folderBreadcrumbs.value = [];
    } else if (folder.id === currentFolder.value?.id) {
      // Clicking current folder - do nothing
      return;
    } else {
      // Find if folder exists in current breadcrumbs
      const existingIndex = folderBreadcrumbs.value.findIndex(f => f.id === folder.id);
      
      if (existingIndex >= 0) {
        // Clicking a folder in breadcrumbs - truncate to that point
        folderBreadcrumbs.value = folderBreadcrumbs.value.slice(0, existingIndex + 1);
      } else {
        // New folder - add to breadcrumbs
        folderBreadcrumbs.value.push(folder);
      }
      currentFolder.value = folder;
    }

    // Load both folders and files, handle errors individually
    const [foldersError, filesError] = await Promise.all([
      loadFolders().catch(error => error),
      loadFiles().catch(error => error)
    ]);

    // Handle errors
    if (foldersError) {
      ElMessage.warning('Could not load folders, but files are available');
      console.error('Folder loading error:', foldersError);
    }

    if (filesError) {
      ElMessage.error('Error loading files');
      console.error('File loading error:', filesError);
      // Revert navigation if both operations failed
      if (foldersError) {
        currentFolder.value = null;
        folderBreadcrumbs.value = [];
        throw new Error('Failed to navigate to folder');
      }
    }

  } catch (error) {
    ElMessage.error('Error navigating to folder: ' + error.message);
    // Reset to previous state
    currentFolder.value = null;
    folderBreadcrumbs.value = [];
  } finally {
    loading.value = false;
  }
}

// Add this function to handle sorting
function handleSort({ prop, order }) {
  if (!prop || !order) return;
  
  const sortedItems = [...filteredItems.value].sort((a, b) => {
    if (prop === 'size') {
      // Handle folder size sorting
      if (a.type === 'dir' && b.type === 'dir') return 0;
      if (a.type === 'dir') return -1;
      if (b.type === 'dir') return 1;
      return a.size - b.size;
    }
    
    if (prop === 'type') {
      if (a.type === 'dir' && b.type !== 'dir') return -1;
      if (a.type !== 'dir' && b.type === 'dir') return 1;
      return a.type.localeCompare(b.type);
    }
    
    // Default name sorting
    return a[prop].localeCompare(b[prop]);
  });
  
  if (order === 'descending') {
    sortedItems.reverse();
  }
  
  files.value = sortedItems.filter(item => item.type !== 'dir');
  folders.value = sortedItems.filter(item => item.type === 'dir');
}
</script>

<template>
  <div class="manage-files">
    <div class="content" :class="{ 'with-preview': selectedFile }">
      <div class="files-section">
        <div class="header">
          <div class="breadcrumbs">
            <el-breadcrumb separator="/">
              <el-breadcrumb-item 
                @click="navigateToFolder(null)"
                :class="{ clickable: currentFolder }">
                Root
              </el-breadcrumb-item>
              <el-breadcrumb-item 
                v-for="folder in folderBreadcrumbs" 
                :key="folder.id"
                @click="navigateToFolder(folder)"
                :class="{ clickable: folder.id !== currentFolder?.id }">
                {{ folder.name }}
              </el-breadcrumb-item>
            </el-breadcrumb>
          </div>
          <div class="actions">
            <el-button 
              @click="filters.showFilters = !filters.showFilters"
              :icon="filters.showFilters ? 'ArrowUp' : 'ArrowDown'"
              type="info"
              plain
              size="small">
              {{ filters.showFilters ? `Hide Filters${activeFiltersCount ? ` (${activeFiltersCount})` : ''}` : `Show Filters${activeFiltersCount ? ` (${activeFiltersCount})` : ''}` }}
            </el-button>
            <el-button 
              type="primary" 
              @click="newFolderDialogVisible = true" 
              size="small" 
              :icon="FolderAdd">
              New Folder
            </el-button>
            <el-button 
              type="primary" 
              @click="uploadDialogVisible = true" 
              size="small" 
              :icon="Plus">
              Upload Files
            </el-button>
          </div>
        </div>

        <!-- Add Filters Section -->
        <el-collapse-transition>
          <div v-show="filters.showFilters" class="filters-section">
            <el-form :inline="true" class="filter-form">
              <el-form-item label="Search">
                <el-input
                  v-model="filters.search"
                  placeholder="Search files..."
                  clearable
                />
              </el-form-item>
              <el-form-item label="Type">
                <el-select
                  v-model="filters.type"
                  placeholder="All types"
                  clearable>
                  <el-option label="Folders" :value="FILE_TYPES.FOLDER" />
                  <el-option label="PDF" :value="FILE_TYPES.PDF" />
                  <el-option label="Word" :value="FILE_TYPES.WORD" />
                  <el-option label="Text" :value="FILE_TYPES.TEXT" />
                  <el-option label="Images" :value="FILE_TYPES.IMAGE" />
                </el-select>
              </el-form-item>
              <el-form-item>
                <el-button @click="filters.search = ''; filters.type = null">
                  Clear Filters
                </el-button>
              </el-form-item>
            </el-form>
          </div>
        </el-collapse-transition>

        <!-- Existing Files Table -->
        <el-table
          v-loading="loading"
          :data="filteredItems"
          style="width: 100%"
          @sort-change="handleSort">
          
          <el-table-column 
            prop="name" 
            label="Name"
            sortable="custom"
            min-width="200">
            <template #default="scope">
              <div class="name-cell">
                <el-icon v-if="scope.row.type === 'dir'"><Folder /></el-icon>
                <span 
                  class="clickable-filename"
                  @click="scope.row.type === 'dir' ? navigateToFolder(scope.row) : selectedFile = scope.row">
                  {{ scope.row.name }}
                </span>
              </div>
            </template>
          </el-table-column>
          
          <el-table-column 
            prop="type" 
            label="Type" 
            sortable="custom"
            width="120"
            :show-overflow-tooltip="true">
            <template #default="scope">
              {{ scope.row.type === 'dir' ? 'Folder' : scope.row.type }}
            </template>
          </el-table-column>
          
          <el-table-column 
            prop="size" 
            label="Size" 
            sortable="custom"
            width="90">
            <template #default="scope">
              {{ scope.row.type === 'dir' ? '-' : Math.round(scope.row.size / 1024) + ' KB' }}
            </template>
          </el-table-column>
        </el-table>
      </div>
      
      <FilePreviewPane
        v-if="selectedFile"
        v-model:file="selectedFile"
        @close="selectedFile = null"
        @update:file="handleFileUpdate"
      />
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

    <!-- New Folder Dialog -->
    <el-dialog
      v-model="newFolderDialogVisible"
      title="Create New Folder"
      width="400px">
      <el-form>
        <el-form-item label="Folder Name" required>
          <el-input 
            v-model="newFolderName"
            placeholder="Enter folder name"
            @keyup.enter="createFolder" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="newFolderDialogVisible = false">Cancel</el-button>
          <el-button
            type="primary"
            @click="createFolder"
            :disabled="!newFolderName.trim()">
            Create
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
  display: flex;
  gap: 2rem;
}

.content.with-preview {
  max-width: none;
  margin: 0;
}

.files-section {
  flex: 1;
  min-width: 0;
}

.name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.name-cell .el-icon {
  color: #909399;
  font-size: 16px;
}

.clickable-filename {
  color: #409EFF;
  cursor: pointer;
}

.clickable-filename:hover {
  text-decoration: underline;
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

/* Add responsive styles for the preview pane */
@media (max-width: 1024px) {
  .content {
    flex-direction: column;
  }
  
  .content.with-preview {
    padding: 1rem;
  }
}

/* Add these styles to the existing styles */
.breadcrumbs {
  margin-bottom: 1rem;
}

.clickable {
  cursor: pointer;
  color: #409EFF;
}

.actions {
  display: flex;
  gap: 1rem;
}

/* Add these to your existing styles */
.filters-section {
  background-color: #f5f7fa;
  padding: 1.5rem;
  border-radius: 4px;
  margin-bottom: 1.5rem;
}

.filter-form {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: flex-start;
}

@media (max-width: 768px) {
  .filter-form {
    flex-direction: column;
  }
  
  .filter-form :deep(.el-form-item) {
    margin-right: 0;
    width: 100%;
  }
  
  .filter-form :deep(.el-input),
  .filter-form :deep(.el-select) {
    width: 100%;
  }
}
</style>
