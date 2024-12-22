<template>
  <div class="file-preview-pane" v-if="file">
    <div class="preview-header">
      <h3>{{ file.name }}</h3>
      <el-button type="primary" link @click="$emit('close')">
        <el-icon><Close /></el-icon>
      </el-button>
    </div>
    
    <div class="preview-content">
      <!-- PDF Preview -->
      <iframe
        v-if="file.type === 'application/pdf'"
        :src="file.download_url"
        class="pdf-viewer"
      ></iframe>
      
      <!-- Image Preview -->
      <img
        v-else-if="file.type.startsWith('image/')"
        :src="file.download_url"
        class="image-preview"
      />
      
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
import { Close, Document } from '@element-plus/icons-vue';

const props = defineProps({
  file: {
    type: Object,
    required: true
  }
});

const textContent = ref('');

async function loadTextContent() {
  if (props.file.type === 'text/plain') {
    const response = await fetch(props.file.download_url);
    textContent.value = await response.text();
  }
}

function downloadFile() {
  window.open(props.file.download_url, '_blank');
}

watch(() => props.file, async (newFile) => {
  if (newFile) {
    await loadTextContent();
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
}

.preview-content {
  flex: 1;
  overflow: auto;
  padding: 16px;
}

.pdf-viewer,
.image-preview {
  width: 100%;
  height: 100%;
  border: none;
}

.text-preview {
  height: 100%;
  overflow: auto;
}

.text-preview pre {
  margin: 0;
  white-space: pre-wrap;
}

.no-preview {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #909399;
}

.no-preview-icon {
  font-size: 48px;
  margin-bottom: 16px;
}
</style> 