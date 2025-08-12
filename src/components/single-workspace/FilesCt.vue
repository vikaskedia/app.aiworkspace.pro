<!-- 
Architecture description:
All the files are stored in the Gitea server.
The files are stored in the workspace's repository.
-->
<script setup>
import { ref, onMounted, onUnmounted, watch, computed, nextTick } from 'vue';
import { Plus, UploadFilled, Folder, FolderAdd, ArrowLeft, Download, MoreFilled, ArrowDown, Document, Picture, Tickets, ReadingLamp, Files } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { useWorkspaceStore } from '../../store/workspace';
import { storeToRefs } from 'pinia';
import { useRoute, useRouter } from 'vue-router';
import FilePreviewPane from './FilePreviewPane.vue';
import { updateWorkspaceActivity } from '../../utils/workspaceActivity';
import { setWorkspaceTitle } from '../../utils/page-title';

const route = useRoute();
const router = useRouter();
const workspaceStore = useWorkspaceStore();
const { currentWorkspace } = storeToRefs(workspaceStore);

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
const newDocDialogVisible = ref(false);
const newDocName = ref('');
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
const isUpdatingUrl = ref(false);
const downloadingFiles = ref(new Set());

// Column visibility settings with localStorage persistence
const columnVisibility = ref({
  type: JSON.parse(localStorage.getItem('filesTable_showTypeColumn') || 'false'),
  size: JSON.parse(localStorage.getItem('filesTable_showSizeColumn') || 'false')
});

// Add request tracking to prevent race conditions
const activeRequests = ref({
  loadFiles: null,
  loadFolders: null
});

// Track the last requested path to avoid unnecessary cancellations
const lastRequestedPaths = ref({
  loadFiles: '',
  loadFolders: ''
});

// Expose these refs to make them accessible from parent
defineExpose({
  uploadDialogVisible,
  newFolderDialogVisible,
  newDocDialogVisible,
  filters
});

const FILE_TYPES = {
  FOLDER: 'dir',
  PDF: 'application/pdf',
  WORD: 'application/msword',
  TEXT: 'text/plain',
  IMAGE: ['image/jpeg', 'image/png', 'image/gif'],
  MD: 'text/markdown',
  UNIVER_DOC: 'application/vnd.univer-doc'
};

const activeFiltersCount = computed(() => {
  let count = 0;
  if (filters.value.search) count++;
  if (filters.value.type) count++;
  return count;
});

// Function to create a natural sort key for alphanumeric sorting
function createNaturalSortKey(name) {
  return name.toLowerCase().replace(/(\d+)/g, (match) => {
    // Pad numbers with leading zeros to ensure proper numeric sorting
    return match.padStart(10, '0');
  });
}

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
  
  // Add sorting properties to help ElementPlus sort correctly
  return result.map(item => ({
    ...item,
    // Use natural/numeric sorting without separating folders and files
    sortKey: createNaturalSortKey(item.name),
    // Convert size to number for proper sorting (folders get -1)
    sizeForSort: item.type === 'dir' ? -1 : (item.size || 0)
  }));
});

// Load files when workspace changes
watch(currentWorkspace, async (newWorkspace) => {
  if (newWorkspace?.id) {
    // Clear split views when workspace changes
    splitViews.value = [];
    // Don't clear selected file if we're just updating URL
    if (!isUpdatingUrl.value) {
      selectedFile.value = null;
    }
    await Promise.all([loadFolders(), loadFiles()]);
    updatePageTitle();
  } else {
    files.value = [];
    folders.value = [];
    splitViews.value = [];
    selectedFile.value = null;
  }
}, { immediate: true });

// Watch for route changes (when user manually changes URL or uses browser back/forward)
watch(() => route.query, async (newQuery, oldQuery) => {
  // Check if the query actually changed
  const queryChanged = JSON.stringify(newQuery) !== JSON.stringify(oldQuery);
  if (queryChanged && currentWorkspace.value) {
    console.log('Route query changed, initializing from URL:', newQuery);
    console.log('isUpdatingUrl.value:', isUpdatingUrl.value);
    
    // Always respond to browser navigation, even if we're updating URL
    // Reset the updating flag first to prevent conflicts
    if (isUpdatingUrl.value) {
      console.log('Resetting isUpdatingUrl flag for browser navigation');
      isUpdatingUrl.value = false;
    }
    
    await initializeFromUrl();
  }
}, { deep: true });

// Function to update page title
const updatePageTitle = () => {
  const workspaceName = currentWorkspace.value?.title || 'Workspace';
  setWorkspaceTitle('Files', workspaceName);
};

// Function to initialize from URL parameters
async function initializeFromUrl() {
  console.log('initializeFromUrl called with:', {
    currentWorkspace: currentWorkspace.value?.id,
    isUpdatingUrl: isUpdatingUrl.value,
    folderParam: route.query.folder,
    fileParam: route.query.file
  });
  
  if (!currentWorkspace.value) {
    console.log('No current workspace, skipping initialization');
    return;
  }
  
  const folderParam = route.query.folder;
  const fileParam = route.query.file;
  
  try {
    // Set flag to prevent URL updates during initialization
    isUpdatingUrl.value = true;
    
    // Navigate to folder if specified
    if (folderParam) {
      console.log('Navigating to folder from URL:', folderParam);
      const folderPath = folderParam.split('/');
      
      // Reset navigation state first
      currentFolder.value = null;
      folderBreadcrumbs.value = [];
      
      // Load folders first to get the folder objects
      await loadFolders();
      console.log('Available folders after loadFolders:', folders.value.map(f => f.name));
      
      // Navigate through the folder path WITHOUT updating URL
      for (const folderName of folderPath) {
        console.log('Looking for folder:', folderName);
        const folder = folders.value.find(f => f.name === folderName);
        if (folder) {
          console.log('Found folder:', folder.name, 'adding to breadcrumbs');
          // Navigate directly without URL updates
          const existingIndex = folderBreadcrumbs.value.findIndex(f => f.id === folder.id);
          
          if (existingIndex >= 0) {
            folderBreadcrumbs.value = folderBreadcrumbs.value.slice(0, existingIndex + 1);
          } else {
            folderBreadcrumbs.value.push(folder);
          }
          currentFolder.value = folder;
          
          // Load folders and files for this path (programmatic, not user action)
          currentFolder.value = folder;
          await Promise.all([loadFolders(), loadFiles()]);
        } else {
          console.log('Folder not found:', folderName);
        }
      }
    } else {
      console.log('No folder param, resetting to root');
      // Reset to root if no folder specified
      currentFolder.value = null;
      folderBreadcrumbs.value = [];
      await Promise.all([loadFolders(), loadFiles()]);
    }
    
    // Select file if specified (only if files are already loaded)
    if (fileParam && files.value.length > 0) {
      const file = files.value.find(f => f.name === fileParam);
      if (file) {
        selectedFile.value = file;
      }
    } else if (fileParam && files.value.length === 0) {
      // Load files only if they haven't been loaded yet
      await loadFiles();
      const file = files.value.find(f => f.name === fileParam);
      if (file) {
        selectedFile.value = file;
      }
    }
  } catch (error) {
    console.error('Error initializing from URL:', error);
  } finally {
    // Reset flag after initialization is complete
    setTimeout(() => {
      isUpdatingUrl.value = false;
    }, 100);
  }
}

// Load workspace if not already loaded
onMounted(async () => {
  // if (route.params.workspaceId && !currentWorkspace.value) {
  //   const { data, error } = await supabase
  //     .from('workspaces')
  //     .select('*')
  //     .eq('id', route.params.workspaceId)
  //     .single();
      
  //   if (error) {
  //     ElMessage.error('Error loading workspace');
  //     return;
  //   }
    
  //   if (data) {
  //     workspaceStore.setCurrentWorkspace(data);
  //   }
  // }
  
  // Set initial page title
  updatePageTitle();
  
  // Initialize from URL parameters
  await initializeFromUrl();
});

// Cleanup function to cancel active requests when component unmounts
onUnmounted(() => {
  // Cancel any active requests
  if (activeRequests.value.loadFiles) {
    console.log('Cancelling active loadFiles request on unmount');
    activeRequests.value.loadFiles.abort();
    activeRequests.value.loadFiles = null;
  }
  if (activeRequests.value.loadFolders) {
    console.log('Cancelling active loadFolders request on unmount');
    activeRequests.value.loadFolders.abort();
    activeRequests.value.loadFolders = null;
  }
  // Clear path tracking
  lastRequestedPaths.value.loadFiles = '';
  lastRequestedPaths.value.loadFolders = '';
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
  
  const path = currentFolder.value?.path || '';
  
  // Only cancel if we're requesting a different path
  if (activeRequests.value.loadFiles && lastRequestedPaths.value.loadFiles !== path) {
    console.log('Cancelling previous loadFiles request for different path:', lastRequestedPaths.value.loadFiles, '→', path);
    activeRequests.value.loadFiles.abort();
  } else if (activeRequests.value.loadFiles && lastRequestedPaths.value.loadFiles === path) {
    console.log('loadFiles already in progress for same path:', path, '- skipping duplicate request');
    return;
  }
  
  // Track the path we're requesting
  lastRequestedPaths.value.loadFiles = path;
  
  // Create new AbortController for this request
  const abortController = new AbortController();
  activeRequests.value.loadFiles = abortController;
  
  loading.value = true;
  try {
    validateGiteaConfig();
    const giteaHost = import.meta.env.VITE_GITEA_HOST;
    const giteaToken = import.meta.env.VITE_GITEA_TOKEN;
    
    console.log('loadFiles API call for path:', path);
    const apiUrl = `${giteaHost}/api/v1/repos/associateattorney/${currentWorkspace.value.git_repo}/contents/${path}`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: getGiteaHeaders(giteaToken),
      credentials: 'same-origin',
      signal: abortController.signal
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
        workspace_id: currentWorkspace.value.id,
        git_repo: currentWorkspace.value.git_repo,
        created_at: new Date().toISOString(),
        tags: [],
        download_url: getAuthenticatedDownloadUrl(file.download_url)
      }));

    // Only update state if this request wasn't cancelled
    if (!abortController.signal.aborted) {
      console.log('loadFiles completed successfully for path:', path, 'with', fileItems.length, 'files');
      // Update the appropriate array based on context
      if (splitViews.value.length > 0) {
        splitFiles.value = fileItems;
      } else {
        files.value = fileItems;
      }
    } else {
      console.log('loadFiles request was cancelled for path:', path);
    }

  } catch (error) {
    // Don't show error for cancelled requests
    if (error.name === 'AbortError') {
      console.log('loadFiles request was aborted for path:', path);
      return;
    }
    
    // Only show error if this is still the current request (not a stale one)
    if (activeRequests.value.loadFiles === abortController) {
      console.error('Error loading files for path:', path, error);
      ElMessage.error('Error loading files: ' + error.message);
      if (splitViews.value.length > 0) {
        splitFiles.value = [];
      } else {
        files.value = [];
      }
    } else {
      console.log('Ignoring error from stale loadFiles request for path:', path);
    }
  } finally {
    // Clear the active request if it's still the current one
    if (activeRequests.value.loadFiles === abortController) {
      activeRequests.value.loadFiles = null;
      lastRequestedPaths.value.loadFiles = '';
    }
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
    md: 'text/markdown',
    univer: 'application/vnd.univer-doc'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

function getFileIcon(file) {
  if (file.type === 'dir') {
    return Folder;
  }
  
  const filename = file.name.toLowerCase();
  const ext = filename.split('.').pop();
  
  // Image files
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'].includes(ext)) {
    return Picture;
  }
  
  // Document files
  if (['pdf', 'doc', 'docx', 'odt', 'rtf'].includes(ext)) {
    return Document;
  }
  
  // Spreadsheet files
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) {
    return Tickets;
  }
  
  // Text files
  if (['txt', 'md', 'markdown', 'log', 'json', 'xml', 'yaml', 'yml'].includes(ext)) {
    return ReadingLamp;
  }
  
  // Univer documents
  if (ext === 'univer') {
    return Document;
  }
  
  // Default file icon
  return Files;
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
      workspace_id: currentWorkspace.value.id,
      git_repo: currentWorkspace.value.git_repo,
      created_at: new Date().toISOString(),
      tags: selectedTags.value,
      download_url: getAuthenticatedDownloadUrl(giteaData.content.download_url)
    });

    uploadDialogVisible.value = false;
    fileList.value = [];
    selectedTags.value = [];
    
    // Update workspace activity
    await updateWorkspaceActivity(currentWorkspace.value.id);
    
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
    await updateWorkspaceActivity(currentWorkspace.value.id);
    
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
  
  const path = currentFolder.value?.path || '';
  
  // Only cancel if we're requesting a different path
  if (activeRequests.value.loadFolders && lastRequestedPaths.value.loadFolders !== path) {
    console.log('Cancelling previous loadFolders request for different path:', lastRequestedPaths.value.loadFolders, '→', path);
    activeRequests.value.loadFolders.abort();
  } else if (activeRequests.value.loadFolders && lastRequestedPaths.value.loadFolders === path) {
    console.log('loadFolders already in progress for same path:', path, '- skipping duplicate request');
    return;
  }
  
  // Track the path we're requesting
  lastRequestedPaths.value.loadFolders = path;
  
  // Create new AbortController for this request
  const abortController = new AbortController();
  activeRequests.value.loadFolders = abortController;
  
  loading.value = true;
  try {
    const giteaToken = import.meta.env.VITE_GITEA_TOKEN;
    const giteaHost = import.meta.env.VITE_GITEA_HOST;
    
    console.log('loadFolders API call for path:', path);
    const apiUrl = `${giteaHost}/api/v1/repos/associateattorney/${currentWorkspace.value.git_repo}/contents/${path}`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: getGiteaHeaders(giteaToken),
      credentials: 'include',
      mode: 'cors',
      signal: abortController.signal
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

    // Only update state if this request wasn't cancelled
    if (!abortController.signal.aborted) {
      console.log('loadFolders completed successfully for path:', path, 'with', folderItems.length, 'folders');
      // Update the appropriate array based on context
      if (splitViews.value.length > 0) {
        splitFolders.value = folderItems;
      } else {
        folders.value = folderItems;
      }
    } else {
      console.log('loadFolders request was cancelled for path:', path);
    }

  } catch (error) {
    // Don't show error for cancelled requests
    if (error.name === 'AbortError') {
      console.log('loadFolders request was aborted for path:', path);
      return;
    }
    
    // Only show error if this is still the current request (not a stale one)
    if (activeRequests.value.loadFolders === abortController) {
      console.error('Folder loading error for path:', path, error);
      ElMessage.error('Error loading folders: ' + error.message);
      if (splitViews.value.length > 0) {
        splitFolders.value = [];
      } else {
        folders.value = [];
      }
    } else {
      console.log('Ignoring error from stale loadFolders request for path:', path);
    }
  } finally {
    // Clear the active request if it's still the current one
    if (activeRequests.value.loadFolders === abortController) {
      activeRequests.value.loadFolders = null;
      lastRequestedPaths.value.loadFolders = '';
    }
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
        headers: getGiteaHeaders(giteaToken),
        credentials: 'same-origin',
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
    await updateWorkspaceActivity(currentWorkspace.value.id);
    
    ElMessage.success('Folder created successfully');
  } catch (error) {
    ElMessage.error('Error creating folder: ' + error.message);
  }
}

async function createUniverDocument() {
  if (!currentWorkspace.value || !newDocName.value.trim()) return;
  
  try {
    loading.value = true;
    const giteaToken = import.meta.env.VITE_GITEA_TOKEN;
    const giteaHost = import.meta.env.VITE_GITEA_HOST;
    
    // Ensure the filename has the correct extension
    const fileName = newDocName.value.endsWith('.univer') ? 
      newDocName.value : 
      `${newDocName.value}.univer`;
    
    const path = currentFolder.value ? 
      `${currentFolder.value.path}/${fileName}` : 
      fileName;

    // Create default Univer document structure
    const defaultDocumentData = {
      id: `doc-${Date.now()}`,
      body: {
        dataStream: `${newDocName.value}\r\n\r\nWelcome to your new Univer document! Start typing to add your content.\r\n\r\n`,
        textRuns: [
          {
            st: 0,
            ed: newDocName.value.length,
            ts: {
              fs: 24,
              bl: 1, // Bold
            },
          },
          {
            st: newDocName.value.length + 2,
            ed: newDocName.value.length + 2 + 69,
            ts: {
              fs: 14,
            },
          },
        ],
        paragraphs: [
          {
            startIndex: newDocName.value.length + 1,
            paragraphStyle: {
              spaceBelow: { v: 20 },
              headingId: 'heading1',
            },
          },
          {
            startIndex: newDocName.value.length + 2 + 69 + 1,
            paragraphStyle: {
              spaceBelow: { v: 10 },
            },
          },
        ],
      },
      documentStyle: {
        pageSize: {
          width: 595,
          height: 842,
        },
        marginTop: 72,
        marginBottom: 72,
        marginRight: 90,
        marginLeft: 90,
      },
    };

    // Convert document data to base64
    const documentContent = JSON.stringify(defaultDocumentData, null, 2);
    const base64Content = btoa(documentContent);

    // Create the file in Gitea
    const response = await fetch(
      `${giteaHost}/api/v1/repos/associateattorney/${currentWorkspace.value.git_repo}/contents/${path}`,
      {
        method: 'POST',
        headers: getGiteaHeaders(giteaToken),
        credentials: 'include',
        body: JSON.stringify({
          message: `Create Univer document ${fileName}`,
          content: base64Content,
          branch: 'main'
        })
      }
    );

    if (!response.ok) {
      throw new Error('Failed to create Univer document');
    }

    const giteaData = await response.json();

    // Add file to local state
    const newFile = {
      id: giteaData.content.sha,
      name: fileName,
      type: 'application/vnd.univer-doc',
      size: giteaData.content.size,
      storage_path: giteaData.content.path,
      workspace_id: currentWorkspace.value.id,
      git_repo: currentWorkspace.value.git_repo,
      created_at: new Date().toISOString(),
      tags: [],
      download_url: getAuthenticatedDownloadUrl(giteaData.content.download_url)
    };

    files.value.unshift(newFile);
    newDocDialogVisible.value = false;
    newDocName.value = '';
    
    // Update workspace activity
    await updateWorkspaceActivity(currentWorkspace.value.id);
    
    ElMessage.success('Univer document created successfully');
    
    // Automatically select the new document
    handleFileSelect(newFile);

  } catch (error) {
    ElMessage.error('Error creating Univer document: ' + error.message);
  } finally {
    loading.value = false;
  }
}

async function navigateToFolder(folder, splitIndex = null, fromUserAction = true) {
  try {
    loading.value = true;
    console.log('navigateToFolder called:', { 
      folder: folder?.name, 
      splitIndex, 
      fromUserAction,
      isUpdatingUrl: isUpdatingUrl.value 
    });
    
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

    // Update URL to reflect current navigation state (only for main view, not split views)
    // Only update URL for user-initiated actions, not programmatic navigation
    if (splitIndex === null && currentWorkspace.value && fromUserAction) {
      isUpdatingUrl.value = true;
      const query = { ...route.query };
      
      if (currentFolder.value) {
        // Build folder path from breadcrumbs
        const folderPath = folderBreadcrumbs.value.map(f => f.name).join('/');
        query.folder = folderPath;
      } else {
        // Remove folder parameter when at root
        delete query.folder;
      }
      
      // Only update URL if it's actually different from current URL
      const currentQuery = route.query;
      const targetQuery = Object.keys(query).length > 0 ? query : {};
      const isQueryDifferent = JSON.stringify(currentQuery) !== JSON.stringify(targetQuery);
      
      if (isQueryDifferent) {
        console.log('URL needs update for folder navigation (user action):', query);
        // Use push for user actions to create proper history entries
        router.push({
          name: 'ManageFilesPage',
          params: { workspaceId: currentWorkspace.value.id },
          query: Object.keys(query).length > 0 ? query : undefined
        }).then(() => {
          // Reset flag after URL update is complete
          setTimeout(() => {
            isUpdatingUrl.value = false;
          }, 100);
        }).catch(error => {
          console.warn('Folder URL update failed:', error);
          isUpdatingUrl.value = false;
        });
      } else {
        console.log('URL already matches target, skipping update');
        setTimeout(() => {
          isUpdatingUrl.value = false;
        }, 100);
      }
    } else if (!fromUserAction) {
      console.log('Skipping URL update for programmatic navigation');
    }

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
    // Reset URL updating flag on error
    isUpdatingUrl.value = false;
  } finally {
    loading.value = false;
  }
}

// Function to handle file selection with URL updates
function handleFileSelect(file) {
  try {
    if (!file) return;
    
    selectedFile.value = file;
    
    // On mobile/smaller screens, scroll to ensure preview is visible
    nextTick(() => {
      const previewContainer = document.querySelector('.preview-container');
      if (previewContainer && window.innerWidth <= 1024) {
        previewContainer.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }
    });
    
    // Update URL to include file selection
    if (currentWorkspace.value) {
      isUpdatingUrl.value = true;
      const query = { ...route.query };
      query.file = file.name;
      
      // Only update URL if it's actually different from current URL
      const currentQuery = route.query;
      const isQueryDifferent = JSON.stringify(currentQuery) !== JSON.stringify(query);
      
      if (isQueryDifferent) {
        console.log('URL needs update for file selection:', query);
        // Use replace for file selection to avoid excessive history entries
        router.replace({
          name: 'ManageFilesPage',
          params: { workspaceId: currentWorkspace.value.id },
          query
        }).then(() => {
          // Reset flag after URL update is complete
          setTimeout(() => {
            isUpdatingUrl.value = false;
          }, 100);
        }).catch(error => {
          console.warn('URL update failed:', error);
          isUpdatingUrl.value = false;
        });
      } else {
        console.log('URL already matches target for file selection, skipping update');
        setTimeout(() => {
          isUpdatingUrl.value = false;
        }, 100);
      }
    }
  } catch (error) {
    console.error('Error handling file selection:', error);
    // Still set the selected file even if URL update fails
    selectedFile.value = file;
    isUpdatingUrl.value = false;
  }
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

// Function to generate href URL for folder navigation
function generateFolderHref(folder) {
  try {
    if (!currentWorkspace.value) return '#';
    
    const query = {};
    
    if (folder) {
      // If folder is in current breadcrumbs, truncate to that point
      const existingIndex = folderBreadcrumbs.value.findIndex(f => f.id === folder.id);
      if (existingIndex >= 0) {
        // Navigating to existing breadcrumb - path up to and including this folder
        const folderPath = folderBreadcrumbs.value.slice(0, existingIndex + 1).map(f => f.name).join('/');
        query.folder = folderPath;
      } else {
        // Navigating to new folder - current breadcrumbs + new folder
        const currentPath = [...folderBreadcrumbs.value, folder];
        const folderPath = currentPath.map(f => f.name).join('/');
        query.folder = folderPath;
      }
    }
    // If folder is null, we're going to root (no query param needed)
    
    const resolved = router.resolve({
      name: 'ManageFilesPage',
      params: { workspaceId: currentWorkspace.value.id },
      query: Object.keys(query).length > 0 ? query : undefined
    });
    
    return resolved.href;
  } catch (error) {
    console.error('Error generating folder href:', error);
    return '#';
  }
}



// Function to handle back navigation
function handleBackNavigation() {
  try {
    // Use browser's back navigation instead of manual navigation
    // This will properly work with browser back/forward buttons and trackpad gestures
    if (window.history.length > 1) {
      router.back();
    } else {
      // If no history, go to workspace dashboard
      router.push({
        name: 'WorkspaceDashboard',
        params: { workspaceId: currentWorkspace.value.id }
      });
    }
  } catch (error) {
    console.error('Error in back navigation:', error);
    // Fallback to workspace dashboard
    router.push({
      name: 'WorkspaceDashboard',
      params: { workspaceId: currentWorkspace.value.id }
    });
  }
}

// Check if back button should be shown
const showBackButton = computed(() => {
  return selectedFile.value || folderBreadcrumbs.value.length > 0;
});

// Download functionality
async function downloadFile(file) {
  try {
    // Add file to downloading set
    downloadingFiles.value.add(file.id);
    
    // For images and PDFs, we need to fetch the file as blob to force download
    const response = await fetch(file.download_url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status}`);
    }
    
    const blob = await response.blob();
    
    // Create object URL and download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the object URL
    URL.revokeObjectURL(url);
    
    ElMessage.success(`Downloaded ${file.name}`);
  } catch (error) {
    console.error('Error downloading file:', error);
    ElMessage.error('Failed to download file: ' + error.message);
  } finally {
    // Remove file from downloading set
    downloadingFiles.value.delete(file.id);
  }
}

async function downloadFolder(folder) {
  try {
    loading.value = true;
    ElMessage.info('Preparing folder download...');
    
    const giteaHost = import.meta.env.VITE_GITEA_HOST;
    const giteaToken = import.meta.env.VITE_GITEA_TOKEN;
    
    // Get the archive URL from Gitea
    const archiveUrl = `${giteaHost}/associateattorney/${currentWorkspace.value.git_repo}/archive/main.zip`;
    
    // For folder-specific download, we'll create a zip of just that folder's contents
    // Since Gitea doesn't have a direct folder archive API, we'll collect all files in the folder
    const files = await getAllFilesInFolder(folder.path);
    
    if (files.length === 0) {
      ElMessage.warning('Folder is empty');
      return;
    }
    
    // Create a zip file using JSZip
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    const folderZip = zip.folder(folder.name);
    
    // Download all files and add to zip
    for (const file of files) {
      try {
        const response = await fetch(file.download_url);
        if (response.ok) {
          const blob = await response.blob();
          const relativePath = file.storage_path.replace(folder.path + '/', '');
          folderZip.file(relativePath, blob);
        }
      } catch (err) {
        console.warn(`Failed to include ${file.name} in zip:`, err);
      }
    }
    
    // Generate and download the zip
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(zipBlob);
    link.download = `${folder.name}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    
    ElMessage.success(`Downloaded ${folder.name}.zip`);
  } catch (error) {
    console.error('Error downloading folder:', error);
    ElMessage.error('Failed to download folder: ' + error.message);
  } finally {
    loading.value = false;
  }
}

async function getAllFilesInFolder(folderPath) {
  try {
    const giteaHost = import.meta.env.VITE_GITEA_HOST;
    const giteaToken = import.meta.env.VITE_GITEA_TOKEN;
    
    const response = await fetch(
      `${giteaHost}/api/v1/repos/associateattorney/${currentWorkspace.value.git_repo}/contents/${folderPath}`,
      {
        headers: getGiteaHeaders(giteaToken),
        credentials: 'include'
      }
    );
    
    if (!response.ok) throw new Error('Failed to fetch folder contents');
    
    const contents = await response.json();
    let allFiles = [];
    
    for (const item of contents) {
      if (item.type === 'file' && item.name !== '.gitkeep') {
        allFiles.push({
          name: item.name,
          storage_path: item.path,
          download_url: getAuthenticatedDownloadUrl(item.download_url)
        });
      } else if (item.type === 'dir') {
        // Recursively get files from subdirectories
        const subFiles = await getAllFilesInFolder(item.path);
        allFiles = allFiles.concat(subFiles);
      }
    }
    
    return allFiles;
  } catch (error) {
    console.error('Error getting files in folder:', error);
    return [];
  }
}

async function downloadWorkspace() {
  try {
    loading.value = true;
    ElMessage.info('Preparing workspace download...');
    
    const giteaHost = import.meta.env.VITE_GITEA_HOST;
    const giteaToken = import.meta.env.VITE_GITEA_TOKEN;
    
    // Get all files in the workspace (root directory)
    const files = await getAllFilesInFolder('');
    
    if (files.length === 0) {
      ElMessage.warning('Workspace is empty');
      return;
    }
    
    // Create a zip file using JSZip
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    
    // Download all files and add to zip
    for (const file of files) {
      try {
        const response = await fetch(file.download_url);
        if (response.ok) {
          const blob = await response.blob();
          zip.file(file.storage_path, blob);
        }
      } catch (err) {
        console.warn(`Failed to include ${file.name} in zip:`, err);
      }
    }
    
    // Generate and download the zip
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(zipBlob);
    link.download = `${currentWorkspace.value.title || 'workspace'}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    
    ElMessage.success(`Downloaded ${currentWorkspace.value.title || 'workspace'}.zip`);
  } catch (error) {
    console.error('Error downloading workspace:', error);
    ElMessage.error('Failed to download workspace: ' + error.message);
  } finally {
    loading.value = false;
  }
}

async function downloadSelectedFiles() {
  // This function can be implemented later for bulk downloads
  ElMessage.info('Bulk download feature coming soon!');
}

// Function to toggle column visibility
function toggleColumnVisibility(column) {
  columnVisibility.value[column] = !columnVisibility.value[column];
  
  // Save to localStorage
  if (column === 'type') {
    localStorage.setItem('filesTable_showTypeColumn', JSON.stringify(columnVisibility.value.type));
  } else if (column === 'size') {
    localStorage.setItem('filesTable_showSizeColumn', JSON.stringify(columnVisibility.value.size));
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
            <div class="breadcrumb-container">
              <!--el-button
                v-if="showBackButton"
                @click="handleBackNavigation"
                type="text"
                :icon="ArrowLeft"
                class="back-button">
                Back
              </el-button-->
              <el-breadcrumb separator="/">
                <el-breadcrumb-item :class="{ clickable: currentFolder }">
                  <a 
                    :href="generateFolderHref(null)"
                    @click.prevent="navigateToFolder(null, null)"
                    class="breadcrumb-link">
                    Root
                  </a>
                </el-breadcrumb-item>
                <el-breadcrumb-item 
                  v-for="folder in folderBreadcrumbs" 
                  :key="folder.id"
                  :class="{ clickable: folder.id !== currentFolder?.id }">
                  <a 
                    :href="generateFolderHref(folder)"
                    @click.prevent="navigateToFolder(folder, null)"
                    class="breadcrumb-link">
                    {{ folder.name }}
                  </a>
                </el-breadcrumb-item>
              </el-breadcrumb>
            </div>
          </div>
          <div class="actions">
            <!-- Menu Dropdown with All Actions -->
            <el-dropdown trigger="click" placement="bottom-end">
              <el-button 
                type="primary" 
                size="small">
                Menu
                <el-icon class="el-icon--right"><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item 
                    @click="uploadDialogVisible = true"
                    :icon="UploadFilled">
                    Upload Files
                  </el-dropdown-item>
                  <el-dropdown-item 
                    @click="newDocDialogVisible = true"
                    :icon="Plus">
                    New Document
                  </el-dropdown-item>
                  <el-dropdown-item 
                    @click="newFolderDialogVisible = true"
                    :icon="FolderAdd">
                    New Folder
                  </el-dropdown-item>
                  <el-dropdown-item divided></el-dropdown-item>
                  <el-dropdown-item 
                    @click="filters.showFilters = !filters.showFilters"
                    icon="Filter">
                    {{ filters.showFilters ? 'Hide Filters' : 'Show Filters' }}
                    <el-badge 
                      v-if="activeFiltersCount > 0" 
                      :value="activeFiltersCount" 
                      class="filter-badge"
                      type="info" />
                  </el-dropdown-item>
                  <el-dropdown-item divided></el-dropdown-item>
                  <el-dropdown-item 
                    @click="toggleColumnVisibility('type')"
                    icon="View">
                    {{ columnVisibility.type ? 'Hide Type Column' : 'Show Type Column' }}
                  </el-dropdown-item>
                  <el-dropdown-item 
                    @click="toggleColumnVisibility('size')"
                    icon="View">
                    {{ columnVisibility.size ? 'Hide Size Column' : 'Show Size Column' }}
                  </el-dropdown-item>
                  <el-dropdown-item divided></el-dropdown-item>
                  <el-dropdown-item 
                    v-if="currentFolder"
                    @click="downloadFolder(currentFolder)"
                    :icon="Download">
                    Download Folder
                  </el-dropdown-item>
                  <el-dropdown-item 
                    v-else
                    @click="downloadWorkspace"
                    :icon="Download">
                    Download All Files
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
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
                  <el-option label="Univer Documents" :value="FILE_TYPES.UNIVER_DOC" />
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
          :default-sort="{ prop: 'sortKey', order: 'ascending' }">
          
          <el-table-column 
            prop="sortKey" 
            label="Name"
            sortable
            min-width="200">
            <template #default="scope">
              <div class="name-cell">
                <el-icon><component :is="getFileIcon(scope.row)" /></el-icon>
                <a 
                  :href="scope.row.type === 'dir' ? generateFolderHref(scope.row) : scope.row.download_url"
                  @click.prevent="scope.row.type === 'dir' ? navigateToFolder(scope.row, null) : handleFileSelect(scope.row)"
                  @contextmenu.stop
                  class="clickable-filename">
                  {{ scope.row.name }}
                </a>
              </div>
            </template>
          </el-table-column>
          
          <el-table-column 
            v-if="columnVisibility.type"
            prop="type" 
            label="Type" 
            sortable
            width="120"
            :show-overflow-tooltip="true">
            <template #default="scope">
              {{ scope.row.type === 'dir' ? 'Folder' : scope.row.type }}
            </template>
          </el-table-column>
          
          <el-table-column 
            v-if="columnVisibility.size"
            prop="sizeForSort" 
            label="Size" 
            sortable
            width="90">
            <template #default="scope">
              {{ scope.row.type === 'dir' ? '-' : Math.round(scope.row.size / 1024) + ' KB' }}
            </template>
          </el-table-column>
          
          <el-table-column 
            label="Actions" 
            width="100"
            fixed="right">
            <template #default="scope">
              <el-tooltip 
                :content="scope.row.type === 'dir' ? 'Download Folder' : 'Download File'"
                placement="top">
                <el-button
                  type="primary"
                  link
                  :icon="Download"
                  :loading="downloadingFiles.has(scope.row.id)"
                  @click.stop="scope.row.type === 'dir' ? downloadFolder(scope.row) : downloadFile(scope.row)"
                  size="small">
                </el-button>
              </el-tooltip>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- Main preview pane -->
      <template v-if="selectedFile">
        <div class="preview-container">
          <div class="preview-actions">
            <el-button
              @click="handleBackNavigation"
              type="text"
              :icon="ArrowLeft"
              size="small">
              Back
            </el-button>
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
                    <el-breadcrumb-item :class="{ clickable: split.currentFolder }">
                      <a 
                        :href="generateFolderHref(null)"
                        @click.prevent="navigateToFolder(null, index)"
                        class="breadcrumb-link">
                        Root
                      </a>
                    </el-breadcrumb-item>
                    <el-breadcrumb-item 
                      v-for="folder in split.folderBreadcrumbs" 
                      :key="folder.id"
                      :class="{ clickable: folder.id !== split.currentFolder?.id }">
                      <a 
                        :href="generateFolderHref(folder)"
                        @click.prevent="navigateToFolder(folder, index)"
                        class="breadcrumb-link">
                        {{ folder.name }}
                      </a>
                    </el-breadcrumb-item>
                  </el-breadcrumb>
                </div>

                <el-table
                  v-loading="loading"
                  :data="filteredItems"
                  style="width: 100%"
                  :default-sort="{ prop: 'sortKey', order: 'ascending' }">
                  <el-table-column prop="sortKey" label="Name" sortable>
                    <template #default="scope">
                      <div class="name-cell">
                        <el-icon><component :is="getFileIcon(scope.row)" /></el-icon>
                        <a 
                          :href="scope.row.type === 'dir' ? generateFolderHref(scope.row) : scope.row.download_url"
                          @click.prevent="scope.row.type === 'dir' ? 
                            navigateToFolder(scope.row, index) : 
                            handleSplitFileSelect(scope.row, index)"
                          @contextmenu.stop
                          class="clickable-filename">
                          {{ scope.row.name }}
                        </a>
                      </div>
                    </template>
                  </el-table-column>
                  <el-table-column 
                    v-if="columnVisibility.type"
                    prop="type" 
                    label="Type" 
                    sortable
                    width="120"
                    :show-overflow-tooltip="true">
                    <template #default="scope">
                      {{ scope.row.type === 'dir' ? 'Folder' : scope.row.type }}
                    </template>
                  </el-table-column>
                  <el-table-column 
                    v-if="columnVisibility.size"
                    prop="sizeForSort" 
                    label="Size" 
                    sortable
                    width="90">
                    <template #default="scope">
                      {{ scope.row.type === 'dir' ? '-' : Math.round(scope.row.size / 1024) + ' KB' }}
                    </template>
                  </el-table-column>
                  <el-table-column 
                    label="Actions" 
                    width="60">
                    <template #default="scope">
                      <el-tooltip 
                        :content="scope.row.type === 'dir' ? 'Download Folder' : 'Download File'"
                        placement="top">
                        <el-button
                          type="primary"
                          link
                          :icon="Download"
                          :loading="downloadingFiles.has(scope.row.id)"
                          @click.stop="scope.row.type === 'dir' ? downloadFolder(scope.row) : downloadFile(scope.row)"
                          size="small">
                        </el-button>
                      </el-tooltip>
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

    <!-- New Document Dialog -->
    <el-dialog
      v-model="newDocDialogVisible"
      title="Create New Univer Document"
      width="400px">
      <el-form>
        <el-form-item label="Document Name" required>
          <el-input 
            v-model="newDocName"
            placeholder="Enter document name"
            @keyup.enter="createUniverDocument" />
          <div class="el-form-item__help">
            The file will be saved with .univer extension
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="newDocDialogVisible = false">Cancel</el-button>
          <el-button
            type="primary"
            @click="createUniverDocument"
            :disabled="!newDocName.trim()">
            Create Document
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
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
  
  .header h2 {
    font-size: 1.4rem;
  }
  
  .actions {
    justify-content: flex-end;
  }
  
  /* Single menu button styling for mobile */
  .actions .el-dropdown .el-button {
    min-width: 100px;
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

/* Add responsive styles for tablets */
@media (max-width: 1024px) {
  .content {
    flex-direction: column;
  }
  
  .content.with-preview {
    padding: 1rem;
  }
  
  .actions {
    justify-content: flex-end;
  }
  
  .actions .el-dropdown .el-button {
    padding: 8px 16px;
    font-size: 0.9rem;
    min-width: 120px;
  }
}

/* Add these styles to the existing styles */
.breadcrumbs {
  margin-bottom: 1rem;
}

.breadcrumb-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.back-button {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: #409EFF;
  padding: 4px 8px;
  margin-right: 0.5rem;
}

.back-button:hover {
  background-color: #ecf5ff;
}

.clickable {
  cursor: pointer;
  color: #409EFF;
}

.actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.filter-badge {
  margin-left: 8px;
}

/* Dropdown menu styling */
:deep(.el-dropdown-menu) {
  min-width: 180px;
}

:deep(.el-dropdown-menu__item) {
  display: flex;
  align-items: center;
  gap: 8px;
}

:deep(.el-dropdown-menu__item .el-badge) {
  margin-left: auto;
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

/* Download button styles */
.download-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.download-button:hover {
  background-color: #f0f9ff;
}

.download-button .el-icon {
  font-size: 14px;
}
</style>

<style>
.workspace-content.workspace-content--files {
  max-width: 100% !important;
  padding: 0 !important;
}
.el-breadcrumb {
  margin-bottom: 0 !important;
}

/* Anchor link styles */
.clickable-filename {
  color: inherit;
  text-decoration: none;
  cursor: pointer;
}

.clickable-filename:hover {
  color: inherit;
  text-decoration: underline;
}

.breadcrumb-link {
  color: inherit;
  text-decoration: none;
}

.breadcrumb-link:hover {
  color: inherit;
  text-decoration: none;
}
</style>