<template>
  <div class="univer-document">
    <div class="univer-header" v-if="showHeader">
      <h3>{{ documentTitle || 'Untitled Document' }}</h3>
      <div class="univer-actions">
        <el-button 
          type="primary" 
          @click="saveDocument" 
          :loading="saving"
          size="small">
          Save Document
        </el-button>
        <el-button 
          @click="$emit('close')" 
          size="small">
          Close
        </el-button>
      </div>
    </div>
    <div class="univer-container" :style="{ height: containerHeight }">
      <!-- Error State -->
      <div v-if="error" class="error-state">
        <el-icon class="error-icon"><Warning /></el-icon>
        <p>{{ error }}</p>
        <el-button type="primary" @click="retryLoad">
          Retry
        </el-button>
      </div>
      
      <!-- Univer Document Container - Always present but may show loading -->
      <div v-else class="univer-doc-wrapper">
        <!-- Loading overlay -->
        <div v-if="loading" class="loading-overlay">
          <el-skeleton :rows="10" animated />
        </div>
        
        <!-- Univer Document Container -->
        <div ref="univerContainer" :id="`univer-doc-container-${documentId}`" class="univer-doc-container" :class="{ 'loading': loading }">
          <!-- Debug info -->
          <div v-if="!univer && !loading" class="debug-info" style="padding: 20px; text-align: center; color: #666;">
            <p>Univer container ready but editor not initialized</p>
            <p>Container ID: univer-doc-container-{{ documentId }}</p>
            <el-button @click="initializeUniver" type="primary" size="small">Retry Initialize</el-button>
          </div>
        </div>
        
        <!-- Save Changes Button (like markdown files) -->
        <div v-if="univer && !loading" class="save-actions">
          <el-button 
            type="primary" 
            @click="saveDocument" 
            :loading="saving"
            size="default">
            <el-icon style="margin-right: 4px;"><Document /></el-icon>
            Save Changes
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue';
import { Warning, Document } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';

// Import Univer packages and styles
import '@univerjs/design/lib/index.css';
import '@univerjs/ui/lib/index.css';
import '@univerjs/docs-ui/lib/index.css';

import { LocaleType, merge, Univer, UniverInstanceType } from '@univerjs/core';
import { FUniver } from '@univerjs/core/facade';
import { defaultTheme } from '@univerjs/design';
import DesignEnUS from '@univerjs/design/locale/en-US';
import UIEnUS from '@univerjs/ui/locale/en-US';
import DocsUIEnUS from '@univerjs/docs-ui/locale/en-US';

// Import docs plugins to register manually
import { UniverDocsPlugin } from '@univerjs/docs';
import { UniverDocsUIPlugin } from '@univerjs/docs-ui';
import { UniverRenderEnginePlugin } from '@univerjs/engine-render';
import { UniverFormulaEnginePlugin } from '@univerjs/engine-formula';
import { UniverUIPlugin } from '@univerjs/ui';

const props = defineProps({
  documentData: {
    type: Object,
    default: () => null
  },
  file: {
    type: Object,
    default: () => null
  },
  showHeader: {
    type: Boolean,
    default: true
  },
  height: {
    type: String,
    default: '600px'
  },
  readonly: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['save', 'close', 'update:documentData', 'unsaved-changes']);

// Univer instance refs
const univer = ref(null);
const univerAPI = ref(null);
const univerContainer = ref(null);
const loading = ref(false);
const error = ref(null);
const saving = ref(false);
const hasUnsavedChanges = ref(false);
const documentTitle = ref('');
const documentId = ref(`univer-doc-${Date.now()}`);
// Store the last known document data as fallback
const lastKnownDocumentData = ref(null);

const containerHeight = computed(() => {
  // Account for header (60px) and save actions section (60px)
  let deductions = '0px';
  if (props.showHeader) {
    deductions = '120px'; // 60px header + 60px save actions
  } else {
    deductions = '60px'; // Just save actions
  }
  return `calc(${props.height} - ${deductions})`;
});

// Default document data structure for Univer Docs
const getDefaultDocumentData = () => {
  const docName = props.file?.name?.replace(/\.[^/.]+$/, '') || 'Untitled Document';
  return {
    id: `doc-${Date.now()}`,
    body: {
      dataStream: `${docName}\r\n\r\nWelcome to your new Univer document! Start typing to add your content.\r\n\r\n`,
      textRuns: [
        {
          st: 0,
          ed: docName.length,
          ts: {
            fs: 24,
            bl: 1, // Bold
          },
        },
        {
          st: docName.length + 2,
          ed: docName.length + 2 + 69,
          ts: {
            fs: 14,
          },
        },
      ],
      paragraphs: [
        {
          startIndex: docName.length + 1,
          paragraphStyle: {
            spaceBelow: { v: 20 },
            headingId: 'heading1',
          },
        },
        {
          startIndex: docName.length + 2 + 69 + 1,
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
};

// Initialize Univer document
const initializeUniver = async () => {
  try {
    loading.value = true;
    error.value = null;
    
    console.log('Initializing Univer document editor...');
    
    // Set document title
    if (props.file?.name) {
      documentTitle.value = props.file.name.replace(/\.[^/.]+$/, ''); // Remove extension
    }
    
    // Wait for next tick to ensure DOM is ready
    await nextTick();
    
    if (!univerContainer.value) {
      throw new Error('Container element not found');
    }
    
    console.log('Container found, proceeding with initialization...');
    
    // Create Univer instance using the classic approach (like the commented spreadsheet code)
    const univerInstance = new Univer({
      theme: defaultTheme,
      locale: LocaleType.EN_US,
      locales: {
        [LocaleType.EN_US]: merge(
          {},
          DesignEnUS,
          UIEnUS,
          DocsUIEnUS
        ),
      },
    });
    
    // Store references
    univer.value = univerInstance;
    
    console.log('✅ Univer instance created successfully');
    
    // Register plugins in the correct order (following the pattern from spreadsheet)
    univer.value.registerPlugin(UniverRenderEnginePlugin);
    univer.value.registerPlugin(UniverFormulaEnginePlugin);
    
    univer.value.registerPlugin(UniverUIPlugin, {
      container: univerContainer.value,
      header: true,
      toolbar: true,
      footer: false,
    });
    
    univer.value.registerPlugin(UniverDocsPlugin);
    univer.value.registerPlugin(UniverDocsUIPlugin, {
      container: univerContainer.value,
      layout: {
        docContainerConfig: {
          innerLeft: false,
        },
      },
    });
    
    console.log('✅ Plugins registered successfully');
    
    // Create the univerAPI using FUniver facade
    univerAPI.value = FUniver.newAPI(univer.value);
    console.log('✅ UniversAPI facade created successfully');
    
    // Get document data
    let docData;
    if (props.documentData && props.documentData.body) {
      // Use existing document data
      docData = props.documentData;
    } else {
      // Create new document with default content
      docData = getDefaultDocumentData();
    }
    
    console.log('Creating document with data:', docData);
    
    // Store the document data as fallback
    lastKnownDocumentData.value = docData;
    
    // Create the document unit using the standard Univer API
    univer.value.createUnit(UniverInstanceType.UNIVER_DOC, docData);
    console.log('✅ Document unit created successfully');
    
    // Check if the editor UI was actually created
    setTimeout(() => {
      const container = univerContainer.value;
      if (container) {
        console.log('📊 Container after initialization:', {
          hasChildren: container.children.length > 0,
          innerHTML: container.innerHTML.length,
          containerRect: container.getBoundingClientRect()
        });
        
        // Look for Univer-specific elements
        const univerElements = container.querySelectorAll('[class*="univer"]');
        console.log('🎯 Found Univer DOM elements:', univerElements.length);
      }
    }, 1000);
    
    // Note: Change tracking disabled for now due to API limitations
    // The document editor will work without automatic change detection
    console.log('✅ Change tracking disabled - manual save required');
    
    // Reset unsaved changes flag
    hasUnsavedChanges.value = false;
    
    console.log('Univer document editor initialized successfully');
    isInitialized.value = true;
    
  } catch (err) {
    console.error('Error initializing Univer document:', err);
    error.value = `Failed to initialize document editor: ${err.message}`;
    isInitialized.value = false;
  } finally {
    loading.value = false;
  }
};

// Set up change tracking (simplified version)
const setupChangeTracking = () => {
  if (!univer.value || props.readonly) return;
  
  console.log('ℹ️ Automatic change tracking not available for documents');
  console.log('ℹ️ Users will need to manually save changes');
  
  // For now, we'll rely on manual saving
  // Future enhancement: implement alternative change detection methods
};

// Get current document data
const getDocumentData = () => {
  if (!univer.value) {
    console.warn('No Univer instance available for getting document data');
    return null;
  }
  
  try {
    // Try univerAPI approach first
    if (univerAPI.value) {
      try {
        const activeDoc = univerAPI.value.getActiveDocument();
        if (activeDoc && activeDoc.getSnapshot) {
          console.log('✅ Got document data using univerAPI.getActiveDocument');
          return activeDoc.getSnapshot();
        }
      } catch (apiError) {
        console.warn('univerAPI.getActiveDocument failed:', apiError.message);
      }
    }
    
    // Try core Univer API approaches
    if (univer.value) {
      try {
        // Try getActiveUnit if available
        if (typeof univer.value.getActiveUnit === 'function') {
          const activeUnit = univer.value.getActiveUnit();
          if (activeUnit && typeof activeUnit.getSnapshot === 'function') {
            console.log('✅ Got document data using getActiveUnit');
            return activeUnit.getSnapshot();
          }
        }
      } catch (unitError) {
        console.warn('getActiveUnit failed:', unitError.message);
      }
      
      try {
        // Try getting units by type
        if (typeof univer.value.getUnitsByType === 'function') {
          const docUnits = univer.value.getUnitsByType(UniverInstanceType.UNIVER_DOC);
          if (docUnits && docUnits.length > 0) {
            const firstUnit = docUnits[0];
            if (firstUnit && typeof firstUnit.getSnapshot === 'function') {
              console.log('✅ Got document data using getUnitsByType');
              return firstUnit.getSnapshot();
            }
          }
        }
      } catch (unitsError) {
        console.warn('getUnitsByType failed:', unitsError.message);
      }
    }
    
    console.warn('Could not retrieve document data - no valid API method available');
    console.warn('Available methods on univer:', Object.getOwnPropertyNames(univer.value || {}));
    
    // Fallback to last known document data
    if (lastKnownDocumentData.value) {
      console.log('⚠️ Using fallback: last known document data');
      return lastKnownDocumentData.value;
    }
    
    return null;
  } catch (err) {
    console.error('Error getting document data:', err);
    return null;
  }
};

// Save document
const saveDocument = async () => {
  // Always attempt save since we don't have automatic change tracking
  console.log('🔄 Starting document save...');

  try {
    saving.value = true;
    
    // Get current document data with enhanced error handling
    console.log('📊 Attempting to retrieve document data...');
    const docData = getDocumentData();
    
    if (!docData) {
      console.error('❌ No document data available for saving');
      // Provide user-friendly message
      ElMessage.warning('Unable to retrieve document content. Please try again or check if the document is properly loaded.');
      return;
    }

    console.log('✅ Document data retrieved successfully:', docData);

    // Emit save event with document data
    emit('save', docData);
    emit('update:documentData', docData);
    
    hasUnsavedChanges.value = false;
    emit('unsaved-changes', false);
    
    console.log('✅ Document save completed successfully');
    ElMessage.success('Document saved successfully');
  } catch (error) {
    console.error('❌ Error saving document:', error);
    ElMessage.error('Failed to save document: ' + error.message);
  } finally {
    saving.value = false;
  }
};

// Cleanup Univer instance
const cleanup = () => {
  if (univer.value) {
    try {
      // Dispose change listener
      if (univer.value._changeDisposable) {
        univer.value._changeDisposable.dispose();
      }
      
      // Dispose Univer instance
      univer.value.dispose();
    } catch (err) {
      console.warn('Error during cleanup:', err);
    }
    
    univer.value = null;
  }
  
  if (univerAPI.value) {
    try {
      univerAPI.value.dispose();
    } catch (err) {
      console.warn('Error disposing univerAPI:', err);
    }
    univerAPI.value = null;
  }
  
  // Reset initialization flag
  isInitialized.value = false;
};

// Retry loading
const retryLoad = () => {
  error.value = null;
  cleanup();
  nextTick(() => {
    initializeUniver();
  });
};

// Track if we've already initialized
const isInitialized = ref(false);

// Watch for document data changes and initialize when ready
watch(() => props.documentData, (newData) => {
  if (newData && !isInitialized.value && !univer.value) {
    console.log('📝 Document data loaded, initializing editor...');
    nextTick(() => {
      initializeUniver();
    });
  }
}, { immediate: true });

// Lifecycle hooks
onMounted(async () => {
  await nextTick();
  // Only initialize if we don't have document data (for cases where no data is needed)
  if (!props.documentData && !isInitialized.value) {
    await initializeUniver();
  }
});

onUnmounted(() => {
  cleanup();
});

// Expose methods for parent components
defineExpose({
  saveDocument,
  getDocumentData,
  hasUnsavedChanges
});
</script>

<style scoped>
.univer-document {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: white;
}

.univer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 1px solid #dcdfe6;
  background: #f8f9fa;
}

.univer-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  color: #303133;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.univer-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.univer-container {
  flex: 1;
  width: 100%;
  overflow: hidden;
  position: relative;
}

/* Override Univer styles if needed */
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  color: #909399;
}

.error-icon {
  font-size: 48px;
  margin-bottom: 16px;
  color: #f56c6c;
}

.univer-doc-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.univer-doc-container {
  width: 100%;
  height: 100%;
  min-height: 400px;
  position: relative;
  overflow: hidden;
  background: #fff;
  flex: 1; /* Allow the container to grow and the save section to be at bottom */
}

.univer-doc-container.loading {
  opacity: 0.3;
  pointer-events: none;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

/* Override Univer styles for better integration */
.univer-doc-container :deep(.univer-container) {
  height: 100% !important;
  background: white;
}

.univer-doc-container :deep(.univer-render-canvas) {
  background: white;
}

.univer-doc-container :deep(.univer-toolbar) {
  border-bottom: 1px solid #dcdfe6;
  background: #f8f9fa;
}

.univer-doc-container :deep(.univer-doc-container) {
  height: 100% !important;
  background: white;
}

/* Ensure the document editor takes full height */
.univer-doc-container :deep(.univer-scroll-container) {
  height: 100% !important;
}

/* Save actions section */
.save-actions {
  padding: 16px;
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid #dcdfe6;
  background: #f8f9fa;
}

/* Responsive styles */
@media (max-width: 768px) {
  .univer-header {
    padding: 8px 12px;
  }
  
  .univer-header h3 {
    font-size: 14px;
  }
  
  .univer-actions .el-button {
    padding: 4px 8px;
    font-size: 12px;
  }
  
  .save-actions {
    padding: 12px;
  }
  
  .save-actions .el-button {
    width: 100%;
  }
}
</style>
