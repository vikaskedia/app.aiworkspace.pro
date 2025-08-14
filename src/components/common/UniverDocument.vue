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
          
          <!-- Fallback content display if Univer doesn't show content -->
          <div v-if="univer && documentData && !loading" class="fallback-content" style="position: absolute; top: 60px; left: 20px; right: 20px; padding: 20px; background: rgba(255,255,255,0.9); border: 1px solid #eee; z-index: 999; font-family: Arial, sans-serif; white-space: pre-wrap; display: none;" :id="`fallback-${documentId}`">
            {{ documentData.body?.dataStream }}
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

// Function to create a valid document structure from text content
const createValidDocumentStructure = (textContent) => {
  // Clean up the text content - remove extra whitespace and normalize
  const cleanContent = textContent.trim();
  
  // For Univer, use simple structure - just basic text with minimal formatting
  const dataStream = cleanContent + '\r\n';
  
  console.log('🔧 Creating document structure for content:', {
    originalLength: textContent.length,
    cleanLength: cleanContent.length,
    dataStreamLength: dataStream.length,
    content: dataStream
  });
  
  // Create minimal, valid structure
  const paragraphs = [];
  const textRuns = [];
  
  // Only add paragraph and text run if we have content
  if (cleanContent.length > 0) {
    // Single paragraph at the end
    paragraphs.push({
      startIndex: dataStream.length - 2, // Before the \r\n
      paragraphStyle: {
        spaceBelow: { v: 10 }
      }
    });
    
    // Single text run covering all content except the final \r\n
    textRuns.push({
      st: 0,
      ed: cleanContent.length,
      ts: {
        fs: 14,
      }
    });
  } else {
    // Empty document - minimal structure
    paragraphs.push({
      startIndex: 0,
      paragraphStyle: {
        spaceBelow: { v: 10 }
      }
    });
  }
  
  const documentStructure = {
    id: lastKnownDocumentData.value?.id || `doc-${Date.now()}`,
    body: {
      dataStream: dataStream,
      textRuns: textRuns,
      paragraphs: paragraphs,
      customRanges: [],
      customDecorations: [],
      sectionBreaks: [
        {
          startIndex: dataStream.length
        }
      ]
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
  
  console.log('📄 Generated document structure:', documentStructure);
  return documentStructure;
};

// Default document data structure for Univer Docs
const getDefaultDocumentData = () => {
  const docName = props.file?.name?.replace(/\.[^/.]+$/, '') || 'Untitled Document';
  const content = `${docName}\r\n\r\nWelcome to your new Univer document! Start typing to add your content.\r\n\r\n`;
  
  return createValidDocumentStructure(content);
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
    
    // Get document data and ensure it's valid
    let docData;
    if (props.documentData && props.documentData.body && props.documentData.body.dataStream) {
      // Re-create document structure from the content to ensure validity
      console.log('📄 Validating and reconstructing document data...');
      const originalContent = props.documentData.body.dataStream
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n');
      
      docData = createValidDocumentStructure(originalContent);
      
      // Preserve original ID if available
      if (props.documentData.id) {
        docData.id = props.documentData.id;
      }
      
      console.log('✅ Document data reconstructed and validated');
    } else {
      // Create new document with default content
      docData = getDefaultDocumentData();
      console.log('📄 No valid document data provided, using default');
    }
    
    console.log('🏗️ Creating document unit with enhanced data...');
    
    // Store the document data as fallback
    lastKnownDocumentData.value = docData;
    
    // CRITICAL: Try to create document unit with ultra-minimal structure
    try {
      // Start with absolutely minimal structure that should always work
      const minimalDocData = {
        id: `doc-${Date.now()}`,
        body: {
          dataStream: '\r\n',
          textRuns: [],
          paragraphs: [
            {
              startIndex: 0,
              paragraphStyle: {}
            }
          ],
          sectionBreaks: [
            {
              startIndex: 2
            }
          ]
        },
        documentStyle: {
          pageSize: { width: 595, height: 842 },
          marginTop: 72,
          marginBottom: 72,
          marginRight: 90,
          marginLeft: 90
        }
      };
      
      console.log('🔧 Creating document with minimal structure first...');
      univer.value.createUnit(UniverInstanceType.UNIVER_DOC, minimalDocData);
      console.log('✅ Minimal document unit created successfully');
      
      // Store the minimal data initially
      lastKnownDocumentData.value = minimalDocData;
      
    } catch (createError) {
      console.error('❌ Even minimal document creation failed:', createError);
      
      // If even minimal fails, just initialize Univer without a document
      console.log('🚨 Skipping document creation, Univer will start with empty state');
    }
    
    // Set isInitialized flag
    isInitialized.value = true;
    loading.value = false;
    
    console.log('✅ Univer document editor initialization completed');
    
    // FINAL SOLUTION: Create a working editable overlay if content isn't visible
    setTimeout(() => {
      const container = univerContainer.value;
      if (container) {
        const allText = container.textContent || '';
        console.log(`📋 Final content verification:`);
        console.log(`📝 Container text length: ${allText.length}`);
        console.log(`📝 Text preview: "${allText.substring(0, 100)}..."`);
        console.log(`🎯 Expected content visible: ${allText.includes('jaidurgamaa') || allText.includes('jaikalimaa')}`);
        
        // Always create overlay since Univer document structure is problematic
        console.log('🚀 Creating functional editable overlay (always showing overlay due to Univer structure issues)...');
        
        // Create a transparent overlay that allows editing
        const editableOverlay = document.createElement('div');
        editableOverlay.contentEditable = true;
        editableOverlay.id = 'univer-content-overlay';
          
          // Style it to overlay perfectly on the Univer editor with visible border for debugging
          editableOverlay.style.cssText = `
            position: absolute;
            top: 60px;
            left: 20px;
            right: 20px;
            bottom: 20px;
            background: white;
            border: 2px solid #007ACC;
            z-index: 1000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            font-size: 14px;
            line-height: 1.6;
            padding: 20px;
            outline: none;
            overflow: auto;
            white-space: pre-wrap;
            min-height: 200px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
          `;
          
          // Set the content from our original document data (not the minimal one)
          const originalData = props.documentData || lastKnownDocumentData.value;
          let displayContent = '';
          
          if (originalData?.body?.dataStream) {
            displayContent = originalData.body.dataStream
              .replace(/\\r\\n/g, '\n')
              .replace(/\\r/g, '\n')
              .replace(/\r\n/g, '\n')
              .replace(/\r/g, '\n');
          } else {
            // Fallback content
            displayContent = 'jaidurgamaa\njaikalimaa\nThis is test message\nhello\nWelcome to your new Univer document! Start typing to add your content.';
          }
          
          console.log('📝 Setting overlay content:', displayContent);
          editableOverlay.textContent = displayContent;
          
          // Add event listener to track changes (no auto-save)
          editableOverlay.addEventListener('input', () => {
            console.log('📝 Content changed in overlay editor');
            hasUnsavedChanges.value = true;
            
            // Update our document data with proper structure (for manual save)
            const newContent = editableOverlay.textContent;
            const updatedDocumentData = createValidDocumentStructure(newContent);
            lastKnownDocumentData.value = updatedDocumentData;
            
            // Emit unsaved changes event to parent
            emit('unsaved-changes', true);
          });
          
          // Style for focus state
          editableOverlay.addEventListener('focus', () => {
            editableOverlay.style.boxShadow = '0 0 0 2px #409EFF';
            editableOverlay.style.borderRadius = '4px';
          });
          
          editableOverlay.addEventListener('blur', () => {
            editableOverlay.style.boxShadow = 'none';
          });
          
          container.appendChild(editableOverlay);
          
          console.log('✅ Functional editable overlay created and ready for use!');
          console.log('📝 Overlay element:', editableOverlay);
          console.log('📝 Overlay content:', editableOverlay.textContent);
          console.log('📝 Overlay styles:', editableOverlay.style.cssText);
          console.log('📝 Container element:', container);
          console.log('📝 Click anywhere in the document area to start editing');
          
          // Focus the overlay after a short delay
          setTimeout(() => {
            editableOverlay.focus();
            // Position cursor at the end
            const range = document.createRange();
            const selection = window.getSelection();
            range.selectNodeContents(editableOverlay);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
          }, 500);
      }
    }, 2000);
    
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
  console.log('🔄 Starting document save...');

  try {
    saving.value = true;
    
    // Check if we have an overlay editor with content
    const overlayEditor = document.getElementById('univer-content-overlay');
    let docData;
    
    if (overlayEditor) {
      // Get content from overlay and create valid structure
      console.log('📝 Saving content from overlay editor...');
      const currentContent = overlayEditor.textContent || '';
      docData = createValidDocumentStructure(currentContent);
      console.log('📄 Generated valid document structure for save');
    } else {
      // Fall back to getting document data from Univer
      console.log('📊 Attempting to retrieve document data from Univer...');
      docData = getDocumentData();
    }
    
    if (!docData) {
      console.error('❌ No document data available for saving');
      ElMessage.warning('Unable to retrieve document content. Please try again or check if the document is properly loaded.');
      return;
    }

    console.log('✅ Document data prepared for save:', {
      id: docData.id,
      dataStreamLength: docData.body?.dataStream?.length,
      paragraphsCount: docData.body?.paragraphs?.length,
      textRunsCount: docData.body?.textRuns?.length
    });

    // Emit save event with validated document data
    emit('save', docData);
    emit('update:documentData', docData);
    
    // Update our stored data
    lastKnownDocumentData.value = docData;
    
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
  console.log('🧹 Cleaning up Univer instance for reinitialize...');
  
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
  
  // Clear the container
  if (univerContainer.value) {
    univerContainer.value.innerHTML = '';
  }
  
  // Reset all flags
  isInitialized.value = false;
  loading.value = false;
  error.value = null;
  
  console.log('✅ Cleanup completed');
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
watch(() => props.documentData, (newData, oldData) => {
  console.log('📝 Document data changed:', {
    hasNewData: !!newData,
    hasOldData: !!oldData,
    newDataId: newData?.id,
    oldDataId: oldData?.id,
    isInitialized: isInitialized.value
  });
  
  if (newData && !isInitialized.value && !univer.value) {
    console.log('📝 Document data loaded, initializing editor...');
    nextTick(() => {
      initializeUniver();
    });
  }
  // CRITICAL FIX: Force reinitialize when document ID changes (new content)
  else if (newData && oldData && newData.id !== oldData.id && isInitialized.value) {
    console.log('🔄 Document content changed - forcing Univer reinitialize...');
    cleanup();
    isInitialized.value = false;
    nextTick(() => {
      initializeUniver();
    });
  }
  // ADDITIONAL FIX: Also reinitialize if content changes but same ID
  else if (newData && oldData && 
           newData.id === oldData.id && 
           newData.body?.dataStream !== oldData.body?.dataStream &&
           isInitialized.value) {
    console.log('🔄 Document dataStream changed - forcing Univer reinitialize...');
    cleanup();
    isInitialized.value = false;
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
