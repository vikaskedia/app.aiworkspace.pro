<template>
  <div class="file-preview-pane" v-if="file">
    <div class="preview-header">
      <h3>{{ file.name }}</h3>
      <!-- <div class="header-actions">
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
      </div> -->
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
      <template v-else-if="file.type === 'application/pdf'">
        <div class="pdf-viewer" ref="pdfViewerRef">
          <div v-for="page in numPages" :key="page" class="pdf-page" ref="pdfPages">
            <vue-pdf-embed
              :source="file.download_url"
              :page="page"
              @loaded="handlePdfLoad"
              @error="handleError"
              style="width: 100%;"
            />
          </div>
          <div v-if="loading" class="loading-indicator">
            Loading PDF...
          </div>
          <div class="pdf-controls" v-show="numPages > 1">
            <el-pagination
              v-model:current-page="currentPage"
              :page-size="1"
              :total="numPages"
              layout="prev, pager, next"
              @current-change="handlePageChange"
            />
          </div>
        </div>
      </template>
      
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
      
      <!-- Markdown Preview -->
      <div
        v-else-if="file.type === 'text/markdown'"
        class="markdown-preview"
      >
        <MarkDownEditor
          v-model="markdownContent"
          :placeholder="'Edit markdown content...'"
          :storage-key="`markdown-${file.id}`"
          class="markdown-editor"
          @update:modelValue="handleMarkdownChange"
          @unsaved-changes="handleUnsavedChanges"
          ref="markdownEditor"
        />
        <div class="markdown-actions">
          <el-button 
            type="primary" 
            :loading="saving" 
            :disabled="!hasUnsavedChanges"
            @click="saveMarkdownContent"
          >
            Save Changes
          </el-button>
        </div>
      </div>
      
      <!-- Fallback -->
      <div v-else-if="file.type !== 'application/pdf'" class="no-preview">
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
import { ref, onMounted, watch, nextTick } from 'vue';
import { Close, Edit, Document, Warning } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import VuePdfEmbed from 'vue-pdf-embed'
import MarkDownEditor from '../common/MarkDownEditor.vue'

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

const numPages = ref(1);
const currentPage = ref(1);
const markdownContent = ref('');
const saving = ref(false);
const isLoadingPdf = ref(false);
const pdfViewerRef = ref(null);
const pdfPages = ref([]);
const observers = ref([]);
const isScrolling = ref(false);
const hasUnsavedChanges = ref(false);

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

async function handlePdfLoad(pdfDocument) {
  if (isLoadingPdf.value) return;
  
  try {
    isLoadingPdf.value = true;
    loading.value = true;
    error.value = null;
    
    if (typeof pdfDocument === 'number') {
      numPages.value = pdfDocument;
      currentPage.value = 1;
      await nextTick();
      setupIntersectionObserver();
      return;
    }
    
    if (numPages.value > 1) {
      loading.value = false;
      return;
    } else {
      console.log('PDF loaded with pages:::', numPages.value);
      loading.value = false;
    }

    const loadingTask = window.pdfjsLib.getDocument(props.file.download_url);
    const pdf = await loadingTask.promise;
    numPages.value = pdf.numPages;
    currentPage.value = 1;
    await nextTick();
    setupIntersectionObserver();
    
  } catch (err) {
    console.error('Error loading PDF:', err);
    error.value = 'Error loading PDF document';
  } finally {
    loading.value = false;
    isLoadingPdf.value = false;
  }
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
      download_url: newFileData.content.download_url
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

async function saveMarkdownContent() {
  if (!markdownContent.value || !hasUnsavedChanges.value) return;

  try {
    saving.value = true;
    const giteaToken = import.meta.env.VITE_GITEA_TOKEN;
    const giteaHost = import.meta.env.VITE_GITEA_HOST;
    
    const base64Content = btoa(markdownContent.value);

    const response = await fetch(
      `${giteaHost}/api/v1/repos/associateattorney/${props.file.git_repo}/contents/${props.file.storage_path}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${giteaToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify({
          message: `Update ${props.file.name}`,
          content: base64Content,
          sha: props.file.id,
          branch: 'main'
        })
      }
    );

    if (!response.ok) throw new Error('Failed to save changes');

    const newFileData = await response.json();
    
    // Force a fresh fetch of the content after saving
    const contentResponse = await fetch(newFileData.content.download_url, {
      headers: {
        'Authorization': `token ${giteaToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Cache-Control': 'no-cache',
      },
    });
    
    if (!contentResponse.ok) throw new Error('Failed to fetch updated content');
    
    // Update the content and file data
    markdownContent.value = await contentResponse.text();

    // Clear local storage after successful save
    const markdownEditor = ref(null);
    markdownEditor.value?.clearLocalStorage();
    
    // Update the file object and content
    const updatedFile = {
      ...props.file,
      id: newFileData.content.sha,
      download_url: newFileData.content.download_url
    };

    //emit('update:file', updatedFile);
    ElMessage.success('Changes saved successfully');

    // After successful save
    hasUnsavedChanges.value = false;
  } catch (error) {
    console.error('Error saving markdown:', error);
    ElMessage.error('Failed to save changes: ' + error.message);
  } finally {
    saving.value = false;
  }
}

function handleMarkdownChange(newContent) {
  markdownContent.value = newContent;
  // Compare with original content to determine if there are unsaved changes
  const originalContent = props.file.content || '';
  hasUnsavedChanges.value = newContent !== originalContent;
}

function handleUnsavedChanges(hasChanges) {
  hasUnsavedChanges.value = hasChanges;
}

function handlePageChange(newPage) {
  isScrolling.value = true;
  currentPage.value = newPage;
  
  const targetPage = pdfPages.value[newPage - 1];
  if (targetPage) {
    targetPage.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    // Reset scrolling flag after animation
    setTimeout(() => {
      isScrolling.value = false;
    }, 500);
  }
}

function setupIntersectionObserver() {
  // Clear existing observers
  observers.value.forEach(observer => observer.disconnect());
  observers.value = [];

  // Wait for PDF pages to be rendered
  nextTick(() => {
    const options = {
      root: pdfViewerRef.value,
      threshold: 0.5 // Page is considered visible when 50% is in view
    };

    const callback = (entries) => {
      if (isScrolling.value) return;

      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const pageNum = parseInt(entry.target.getAttribute('data-page'));
          if (pageNum !== currentPage.value) {
            currentPage.value = pageNum;
          }
        }
      });
    };

    const observer = new IntersectionObserver(callback, options);

    // Observe each PDF page
    const pages = pdfPages.value;
    pages.forEach((page, index) => {
      if (page) {
        page.setAttribute('data-page', index + 1);
        observer.observe(page);
        observers.value.push(observer);
      }
    });
  });
}

// Initialize PDF when file changes
watch(() => props.file, async (newFile) => {
  if (newFile) {
    loading.value = true;
    error.value = null;
    
    if (newFile.type === 'text/plain') {
      await loadTextContent();
    } else if (newFile.type === 'text/markdown') {
      try {
        loading.value = true;
        error.value = null;
        
        // First load the original content
        const response = await fetch(newFile.download_url);
        if (!response.ok) throw new Error('Failed to load file content');
        const originalContent = await response.text();
        
        // Store original content for comparison
        markdownContent.value = originalContent;
        
        // After loading original content, check local storage
        const storageKey = `markdown-${newFile.id}`;
        const savedContent = localStorage.getItem(storageKey);
        
        if (savedContent) {
          // If there's saved content, use it and set unsaved changes flag
          markdownContent.value = savedContent;
          hasUnsavedChanges.value = savedContent !== originalContent;
        }
        
      } catch (err) {
        error.value = 'Failed to load markdown content';
        console.error('Error loading markdown content:', err);
      } finally {
        loading.value = false;
      }
    } else if (!newFile.type.startsWith('image/')) {
      loading.value = false;
    }
  }
}, { immediate: true });

// Add watch for file changes to reset unsaved changes state
watch(() => props.file, () => {
  hasUnsavedChanges.value = false;
});
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
  padding: 8px 16px;
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
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: auto;
  scroll-behavior: smooth;
}

.pdf-page {
  width: 100%;
  margin-bottom: 16px;
  scroll-snap-align: start;
}

.pdf-controls {
  position: sticky;
  bottom: 0;
  background: white;
  padding: 8px;
  border-top: 1px solid #dcdfe6;
  width: 100%;
  display: flex;
  justify-content: center;
  z-index: 1;
}

/* Style for PDF pages */
.pdf-viewer :deep(canvas) {
  max-width: 100%;
  height: auto !important;
  margin-bottom: 16px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
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

.markdown-preview {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.markdown-editor {
  flex: 1;
  overflow: auto;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
}

.markdown-actions {
  padding: 16px;
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid #dcdfe6;
}

.loading-indicator {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(255, 255, 255, 0.9);
  padding: 1rem;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
</style> 