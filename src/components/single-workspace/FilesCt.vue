<!-- 
Architecture description:
All the files are stored in the Gitea server.
The files are stored in the workspace's repository.
-->
<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { Plus, UploadFilled, Folder, FolderAdd } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { useMatterStore } from '../../store/workspace';
import { storeToRefs } from 'pinia';
import { useRoute } from 'vue-router';
import FilePreviewPane from './FilePreviewPane.vue';
import { updateMatterActivity } from '../../utils/workspaceActivity';
import { setWorkspaceTitle } from '../../utils/page-title';

const route = useRoute();
const matterStore = useMatterStore();
const { currentWorkspace } = storeToRefs(matterStore);

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
const splitViews = ref([]);
const maxSplits = 10;
const splitFiles = ref([]);
const splitFolders = ref([]);

// Expose these refs to make them accessible from parent
defineExpose({
  uploadDialogVisible,
  newFolderDialogVisible,
  filters
});

const FILE_TYPES = {
  FOLDER: 'dir',
  PDF: 'application/pdf',
  WORD: 'application/msword',
  TEXT: 'text/plain',
  IMAGE: ['image/jpeg', 'image/png', 'image/gif'],
  MD: 'text/markdown'
};

const activeFiltersCount = computed(() => {
  let count = 0;
  if (filters.value.search) count++;
  if (filters.value.type) count++;
  return count;
});

const filteredItems = computed(() => {
  // Use different source arrays based on whether we're in a split view
  const sourceFiles = splitViews.value.length > 0 ? splitFiles.value : files.value;
  const sourceFolders = splitViews.value.length > 0 ? splitFolders.value : folders.value;
  
  let result = [...sourceFolders, ...sourceFiles];
  
  if (filters.value.search) {
    const query = filters.value.search.toLowerCase();
    result = result.filter(item => 
      item.name.toLowerCase().includes(query)
    );
  }
  
  if (filters.value.type) {
    result = result.filter(item => {
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

// Load files when workspace changes
watch(currentWorkspace, async (newMatter) => {
  if (newMatter?.id) {
    // Clear split views when workspace changes
    splitViews.value = [];
    selectedFile.value = null;
    await Promise.all([loadFolders(), loadFiles()]);
    updatePageTitle();
  } else {
    files.value = [];
    folders.value = [];
    splitViews.value = [];
    selectedFile.value = null;
  }
}, { immediate: true });

// Function to update page title
const updatePageTitle = () => {
  const workspaceName = currentWorkspace.value?.title || 'Workspace';
  setWorkspaceTitle('Files', workspaceName);
};

// Load workspace if not already loaded
onMounted(async () => {
  // if (route.params.workspaceId && !currentWorkspace.value) {
  //   const { data, error } = await supabase
  //     .from('workspaces')
  //     .select('*')
  //     .eq('id', route.params.workspaceId)
  //     .single();
      
  //   if (error) {
  //     ElMessage.error('Error loading matter');
  //     return;
  //   }
    
  //   if (data) {
  //     matterStore.setCurrentMatter(data);
  //   }
  // }
  
  // Set initial page title
  updatePageTitle();
});
// Add this before your loadFiles function
function validateGiteaConfig() {
  const errors = [];
  
  if (!import.meta.env.VITE_GITEA_HOST) {
    errors.push('VITE_GITEA_HOST is not configured');
  }
  
  if (!import.meta.env.VITE_GITEA_TOKEN) {
    errors.push('VITE_GITEA_TOKEN is not configured');
  }
  
  if (errors.length > 0) {
    throw new Error(`Gitea configuration errors: ${errors.join(', ')}`);
  }
}
async function loadFiles() {
  if (!currentWorkspace.value) return;
  
  loading.value = true;
  try {
    validateGiteaConfig();
    const giteaHost = import.meta.env.VITE_GITEA_HOST;
    const giteaToken = import.meta.env.VITE_GITEA_TOKEN;
    const path = currentFolder.value?.path || '';
    
    const apiUrl = `${giteaHost}/api/v1/repos/associateattorney/${currentWorkspace.value.git_repo}/contents/${path}`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: getGiteaHeaders(giteaToken),
      credentials: 'same-origin'
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to fetch files: ${response.status} ${response.statusText}`);
    }

    const contents = await response.json();
    const fileItems = contents
      .filter(item => item.type === 'file' && item.name !== '.gitkeep')
      .map(file => ({
        id: file.sha,
        name: file.name,
        type: getFileType(file.name),
        size: file.size,
        storage_path: file.path,
        matter_id: currentWorkspace.value.id,
        git_repo: currentWorkspace.value.git_repo,
        created_at: new Date().toISOString(),
        tags: [],
        download_url: getAuthenticatedDownloadUrl(file.download_url)
      }));

    // Update the appropriate array based on context
    if (splitViews.value.length > 0) {
      splitFiles.value = fileItems;
    } else {
      files.value = fileItems;
    }

  } catch (error) {
    ElMessage.error('Error loading files: ' + error.message);
    if (splitViews.value.length > 0) {
      splitFiles.value = [];
    } else {
      files.value = [];
    }
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
    md: 'text/markdown'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

async function handleFileUpload(file) {
  if (!currentWorkspace.value) {
    ElMessage.warning('Please select a workspace first');
    return;
  }

  if (!file) {
    ElMessage.warning('Please select a file to upload');
    return;
  }

  loading.value = true;

  try {
    const giteaToken = import.meta.env.VITE_GITEA_TOKEN;
    const giteaHost = import.meta.env.VITE_GITEA_HOST;
    
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
      `${giteaHost}/api/v1/repos/associateattorney/${currentWorkspace.value.git_repo}/contents/${uploadPath}`,
      {
        method: 'POST',
        headers: getGiteaHeaders(giteaToken),
        credentials: 'include',
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
      matter_id: currentWorkspace.value.id,
      git_repo: currentWorkspace.value.git_repo,
      created_at: new Date().toISOString(),
      tags: selectedTags.value,
      download_url: getAuthenticatedDownloadUrl(giteaData.content.download_url)
    });

    uploadDialogVisible.value = false;
    fileList.value = [];
    selectedTags.value = [];
    
    // Update workspace activity
    await updateMatterActivity(currentWorkspace.value.id);
    
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
    const giteaHost = import.meta.env.VITE_GITEA_HOST;

    // Delete from Gitea
    const response = await fetch(
      `${giteaHost}/api/v1/repos/associateattorney/${currentWorkspace.value.git_repo}/contents/${file.storage_path}`,
      {
        method: 'DELETE',
        headers: getGiteaHeaders(giteaToken),
        credentials: 'include',
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
    
    // Update workspace activity
    await updateMatterActivity(currentWorkspace.value.id);
    
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
  if (!currentWorkspace.value) {
    console.warn('No current workspace selected');
    return;
  }
  
  loading.value = true;
  try {
    const giteaToken = import.meta.env.VITE_GITEA_TOKEN;
    const giteaHost = import.meta.env.VITE_GITEA_HOST;
    const path = currentFolder.value?.path || '';
    
    const apiUrl = `${giteaHost}/api/v1/repos/associateattorney/${currentWorkspace.value.git_repo}/contents/${path}`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: getGiteaHeaders(giteaToken),
      credentials: 'include',
      mode: 'cors'
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch folders: ${response.status} ${response.statusText}`);
    }

    const contents = await response.json();
    const folderItems = contents
      .filter(item => item.type === 'dir')
      .map(folder => ({
        id: folder.sha,
        name: folder.name,
        path: folder.path,
        type: 'dir'
      }));

    // Update the appropriate array based on context
    if (splitViews.value.length > 0) {
      splitFolders.value = folderItems;
    } else {
      folders.value = folderItems;
    }

  } catch (error) {
    console.error('Folder loading error:', error);
    ElMessage.error('Error loading folders: ' + error.message);
    if (splitViews.value.length > 0) {
      splitFolders.value = [];
    } else {
      folders.value = [];
    }
  } finally {
    loading.value = false;
  }
}

async function createFolder() {
  if (!currentWorkspace.value || !newFolderName.value.trim()) return;
  
  try {
    const giteaToken = import.meta.env.VITE_GITEA_TOKEN;
    const giteaHost = import.meta.env.VITE_GITEA_HOST;
    const path = currentFolder.value ? 
      `${currentFolder.value.path}/${newFolderName.value}` : 
      newFolderName.value;

    // Create an empty file as .gitkeep to create the folder
    const response = await fetch(
      `${giteaHost}/api/v1/repos/associateattorney/${currentWorkspace.value.git_repo}/contents/${path}/.gitkeep`,
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
    
    // Update workspace activity
    await updateMatterActivity(currentWorkspace.value.id);
    
    ElMessage.success('Folder created successfully');
  } catch (error) {
    ElMessage.error('Error creating folder: ' + error.message);
  }
}

async function navigateToFolder(folder, splitIndex = null) {
  try {
    loading.value = true;
    
    if (splitIndex !== null) {
      const split = splitViews.value[splitIndex];
      // Always reset to root when initializing a new split view
      if (!folder) {
        split.currentFolder = null;
        split.folderBreadcrumbs = [];
        currentFolder.value = null;
      } else {
        // Normal folder navigation within the split view
        if (folder.id === split.currentFolder?.id) {
          return; // Clicking current folder - do nothing
        }
        
        const existingIndex = split.folderBreadcrumbs.findIndex(f => f.id === folder.id);
        
        if (existingIndex >= 0) {
          split.folderBreadcrumbs = split.folderBreadcrumbs.slice(0, existingIndex + 1);
        } else {
          split.folderBreadcrumbs.push(folder);
        }
        split.currentFolder = folder;
        currentFolder.value = folder;
      }
    } else {
      // Main view navigation remains unchanged
      if (!folder) {
        currentFolder.value = null;
        folderBreadcrumbs.value = [];
      } else if (folder.id === currentFolder.value?.id) {
        return;
      } else {
        const existingIndex = folderBreadcrumbs.value.findIndex(f => f.id === folder.id);
        
        if (existingIndex >= 0) {
          folderBreadcrumbs.value = folderBreadcrumbs.value.slice(0, existingIndex + 1);
        } else {
          folderBreadcrumbs.value.push(folder);
        }
        currentFolder.value = folder;
      }
    }

    // Load both folders and files
    await Promise.all([loadFolders(), loadFiles()]);

  } catch (error) {
    ElMessage.error('Error navigating to folder: ' + error.message);
    // Reset navigation state based on context
    if (splitIndex !== null) {
      splitViews.value[splitIndex].currentFolder = null;
      splitViews.value[splitIndex].folderBreadcrumbs = [];
      currentFolder.value = null;
    } else {
      currentFolder.value = null;
      folderBreadcrumbs.value = [];
    }
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

function getGiteaHeaders(token) {
  return {
    'Authorization': `token ${token}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache'
  };
}

function logRequestDetails(url, options) {
  console.group('Request Details');
  console.log('URL:', url);
  console.log('Method:', options.method);
  console.log('Headers:', options.headers);
  console.log('Credentials:', options.credentials);
  console.log('Mode:', options.mode);
  console.groupEnd();
}

const canAddSplit = computed(() => splitViews.value.length < maxSplits);

function addSplitView() {
  if (canAddSplit.value) {
    loading.value = true;
    
    // Reset split view arrays first
    splitFiles.value = [];
    splitFolders.value = [];
    
    splitViews.value.push({
      selectedFile: null,
      showFileBrowser: true,
      currentFolder: null,
      folderBreadcrumbs: []
    });
    
    // Reset current folder and load files for split view
    currentFolder.value = null;
    
    // Load files and folders immediately
    Promise.all([loadFolders(), loadFiles()])
      .finally(() => {
        loading.value = false;
      });
  }
}

function removeSplitView(index) {
  splitViews.value.splice(index, 1);
  // If no more splits, show the file system again
  if (splitViews.value.length === 0) {
    selectedFile.value = null;
  }
}

function handleSplitFileSelect(file, splitIndex) {
  splitViews.value[splitIndex].selectedFile = file;
  splitViews.value[splitIndex].showFileBrowser = false;
}

function toggleFileBrowser(splitIndex) {
  splitViews.value[splitIndex].showFileBrowser = 
    !splitViews.value[splitIndex].showFileBrowser;
}

async function getFileContent(repo, path) {
  const giteaHost = import.meta.env.VITE_GITEA_HOST;
  const giteaToken = import.meta.env.VITE_GITEA_TOKEN;
  
  const response = await fetch(
    `${giteaHost}/api/v1/repos/associateattorney/${repo}/contents/${path}`,
    {
      headers: {
        'Authorization': `token ${giteaToken}`,
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch file content');
  }

  const data = await response.json();
  return data.content; // This will be base64 encoded
}

function getAuthenticatedDownloadUrl(originalUrl) {
  if (!originalUrl) return '';
  
  try {
    const giteaToken = import.meta.env.VITE_GITEA_TOKEN;
    const url = new URL(originalUrl);
    
    // Remove any existing token parameter
    url.searchParams.delete('token');
    
    // Add token as a single query parameter
    url.searchParams.set('token', giteaToken);
    
    // Remove any duplicate question marks that might have been added
    return url.toString().replace('??', '?');
  } catch (error) {
    console.error('Error creating authenticated URL:', error);
    return originalUrl;
  }
}
</script>

<template>
  <div class="manage-files">
    <!-- <div class="content" :class="{ 'split-view': splitViews.length > 0 }"> -->
    <div class="content" :class="{ 'split-view': selectedFile }">
      <!-- File system - Only show when no splits are active -->
      <div class="files-section" v-if="!splitViews.length">
        <div class="header">
          <div class="breadcrumbs">
            <el-breadcrumb separator="/">
              <el-breadcrumb-item 
                @click="navigateToFolder(null, null)"
                :class="{ clickable: currentFolder }">
                Root
              </el-breadcrumb-item>
              <el-breadcrumb-item 
                v-for="folder in folderBreadcrumbs" 
                :key="folder.id"
                @click="navigateToFolder(folder, null)"
                :class="{ clickable: folder.id !== currentFolder?.id }">
                {{ folder.name }}
              </el-breadcrumb-item>
            </el-breadcrumb>
          </div>
          <div class="actions">
            <el-button 
              @click="filters.showFilters = !filters.showFilters"
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
                  @click="scope.row.type === 'dir' ? navigateToFolder(scope.row, null) : selectedFile = scope.row">
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

      <!-- Main preview pane -->
      <template v-if="selectedFile">
        <div class="preview-container">
          <div class="preview-actions">
            <el-button
                type="primary"
                @click="addSplitView"
                size="small">
                Split Page
              </el-button>
          </div>
          <FilePreviewPane
            v-model:file="selectedFile"
            @close="selectedFile = null"
            @update:file="handleFileUpdate"
          />
        </div>

        <!-- Split views - show file browser by default -->
        <template v-for="(split, index) in splitViews" :key="index">
          <div class="preview-container split">
            <div class="preview-actions">
              <el-button 
                v-if="split.selectedFile"
                type="primary"
                @click="split.showFileBrowser = true"
                size="small">
                Browse Files
              </el-button>
              <el-button 
                type="danger"
                @click="removeSplitView(index)"
                size="small">
                Close Split
              </el-button>
            </div>
            
            <template v-if="split.showFileBrowser">
              <div class="file-browser">
                <div class="folder-navigation">
                  <el-breadcrumb separator="/">
                    <el-breadcrumb-item 
                      @click="navigateToFolder(null, index)"
                      :class="{ clickable: split.currentFolder }">
                      Root
                    </el-breadcrumb-item>
                    <el-breadcrumb-item 
                      v-for="folder in split.folderBreadcrumbs" 
                      :key="folder.id"
                      @click="navigateToFolder(folder, index)"
                      :class="{ clickable: folder.id !== split.currentFolder?.id }">
                      {{ folder.name }}
                    </el-breadcrumb-item>
                  </el-breadcrumb>
                </div>

                <el-table
                  v-loading="loading"
                  :data="filteredItems"
                  style="width: 100%"
                  @sort-change="handleSort">
                  <el-table-column prop="name" label="Name" sortable="custom">
                    <template #default="scope">
                      <div class="name-cell">
                        <el-icon v-if="scope.row.type === 'dir'">
                          <Folder />
                        </el-icon>
                        <span 
                          class="clickable-filename"
                          @click="scope.row.type === 'dir' ? 
                            navigateToFolder(scope.row, index) : 
                            handleSplitFileSelect(scope.row, index)">
                          {{ scope.row.name }}
                        </span>
                      </div>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
            </template>
            
            <template v-else-if="split.selectedFile">
              <FilePreviewPane
                v-model:file="split.selectedFile"
                @close="split.selectedFile = null"
                @update:file="(file) => split.selectedFile = file"
              />
            </template>
          </div>
        </template>
      </template>
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
            class="create-folder-button"
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
  padding: 1rem;
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

/* Add these styles to your existing styles */
.content.split-view {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 1rem;
  padding: 1rem;
  max-width: none;
}

.preview-container {
  display: flex;
  flex-direction: column;
  border: 1px solid #dcdfe6;
  background: white;
  height: calc(100vh - 2rem);
}

.file-browser {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: white;
}

.files-section {
  background: white;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
}

.folder-navigation {
  padding: 8px 16px;
  border-bottom: 1px solid #dcdfe6;
}

.clickable {
  cursor: pointer;
  color: #409EFF;
}

.clickable:hover {
  text-decoration: underline;
}

.preview-actions {
  padding: 8px;
  border-bottom: 1px solid #dcdfe6;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* Responsive styles */
@media (max-width: 1024px) {
  .content.split-view {
    grid-template-columns: 1fr;
  }
}
</style>

<style>
.matter-content.matter-content--files {
  max-width: 100% !important;
  padding: 0 !important;
}
.el-breadcrumb {
  margin-bottom: 0 !important;
}
</style>