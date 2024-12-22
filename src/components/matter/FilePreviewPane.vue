<template>
  <div class="file-preview-pane" v-if="file">
    <div class="preview-header">
      <h3>{{ file.name }}</h3>
      <el-button type="primary" link @click="$emit('close')">
        <el-icon><Close /></el-icon>
      </el-button>
    </div>
    
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
import { Close, Document, Warning } from '@element-plus/icons-vue';

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
</style> 