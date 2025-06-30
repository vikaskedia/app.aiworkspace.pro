<template>
  <div class="reusable-outline-container">
    <!-- Optional breadcrumbs -->
    <div v-if="showBreadcrumbs && breadcrumbPath.length" class="outline-breadcrumbs">
      <template v-for="(node, idx) in breadcrumbPath" :key="node.id">
        <span v-if="idx > 0"> &gt; </span>
        <a
          href="#"
          class="breadcrumb-link"
          @click.prevent="$emit('breadcrumbClick', { node, index: idx })"
          :style="{ fontWeight: idx === breadcrumbPath.length - 1 ? 'bold' : 'normal' }"
        >{{ getBreadcrumbText(node.text) }}</a>
      </template>
    </div>

    <!-- Optional header with save button -->
    <div v-if="showHeader" class="outline-header">
      <el-button 
        type="primary" 
        @click="handleSave" 
        :loading="saving"
        :disabled="!hasChanges"
        :size="headerSize"
      >
        <el-icon><DocumentChecked /></el-icon>
        {{ saveButtonText }}
      </el-button>
      
      <!-- Optional history button for main outline -->
      <el-button 
        v-if="showHistory" 
        icon 
        @click="$emit('openHistory')"
        :size="headerSize"
        style="margin-left: 8px;"
      >
        <el-icon><Clock /></el-icon>
      </el-button>
    </div>

    <!-- Outline content -->
    <div class="outline-content">
      <ul v-if="outlineData.length" class="outline-list">
        <OutlinePointsCt
          v-for="item in outlineData"
          :key="item.id"
          :item="item"
          @update="handleUpdate"
          @move="handleMove"
          @delete="handleDelete"
          @drilldown="handleDrilldown"
          @navigate="handleNavigate"
          @indent="handleIndent"
          @outdent="handleOutdent"
          @add-sibling="handleAddSibling"
        />
      </ul>
      
      <!-- Empty state -->
      <div v-else class="empty-outline">
        <p>{{ emptyStateText }}</p>
        <el-button 
          type="primary" 
          @click="addFirstItem"
          size="small"
        >
          <el-icon><Plus /></el-icon>
          Add First Item
        </el-button>
      </div>
    </div>
  </div>
</template>

<script>
import { Plus, DocumentChecked, Clock } from '@element-plus/icons-vue';
import OutlinePointsCt from './OutlinePointsCt.vue';

export default {
  name: 'ReusableOutlineCt',
  components: { 
    OutlinePointsCt, 
    Plus, 
    DocumentChecked, 
    Clock 
  },
  
  props: {
    // The outline data array
    outlineData: {
      type: Array,
      required: true
    },
    
    // Whether there are unsaved changes
    hasChanges: {
      type: Boolean,
      default: false
    },
    
    // Whether save operation is in progress
    saving: {
      type: Boolean,
      default: false
    },
    
    // Whether to show the header with save button
    showHeader: {
      type: Boolean,
      default: true
    },
    
    // Whether to show breadcrumbs
    showBreadcrumbs: {
      type: Boolean,
      default: false
    },
    
    // Whether to show history button
    showHistory: {
      type: Boolean,
      default: false
    },
    
    // Save button text
    saveButtonText: {
      type: String,
      default: 'Save Outline (⌘S)'
    },
    
    // Header button size
    headerSize: {
      type: String,
      default: 'default'
    },
    
    // Empty state text
    emptyStateText: {
      type: String,
      default: 'No outline items yet. Start typing to create your first outline point...'
    },
    
    // Breadcrumb path for navigation
    breadcrumbPath: {
      type: Array,
      default: () => []
    },
    
    // Whether to enable auto-save
    autoSave: {
      type: Boolean,
      default: false
    },
    
    // Auto-save delay in milliseconds
    autoSaveDelay: {
      type: Number,
      default: 3000
    }
  },
  
  emits: [
    'save',
    'update', 
    'move', 
    'delete', 
    'drilldown', 
    'navigate', 
    'indent', 
    'outdent', 
    'add-sibling',
    'breadcrumbClick',
    'openHistory'
  ],
  
  data() {
    return {
      keyboardHandler: null,
      debouncedAutoSave: null
    };
  },
  
  mounted() {
    this.setupKeyboardShortcuts();
    if (this.autoSave) {
      this.initializeAutoSave();
    }
  },
  
  unmounted() {
    if (this.keyboardHandler) {
      window.removeEventListener('keydown', this.keyboardHandler);
    }
    if (this.debouncedAutoSave && this.debouncedAutoSave.cancel) {
      this.debouncedAutoSave.cancel();
    }
  },
  
  methods: {
    handleSave() {
      this.$emit('save');
    },
    
    handleUpdate(data) {
      this.$emit('update', data);
      if (this.autoSave && this.debouncedAutoSave) {
        this.debouncedAutoSave();
      }
    },
    
    handleMove(payload) {
      this.$emit('move', payload);
      if (this.autoSave && this.debouncedAutoSave) {
        this.debouncedAutoSave();
      }
    },
    
    handleDelete(id) {
      this.$emit('delete', id);
      if (this.autoSave && this.debouncedAutoSave) {
        this.debouncedAutoSave();
      }
    },
    
    handleDrilldown(id) {
      this.$emit('drilldown', id);
    },
    
    handleNavigate(data) {
      this.$emit('navigate', data);
    },
    
    handleIndent(data) {
      this.$emit('indent', data);
      if (this.autoSave && this.debouncedAutoSave) {
        this.debouncedAutoSave();
      }
    },
    
    handleOutdent(data) {
      this.$emit('outdent', data);
      if (this.autoSave && this.debouncedAutoSave) {
        this.debouncedAutoSave();
      }
    },
    
    handleAddSibling(data) {
      this.$emit('add-sibling', data);
      if (this.autoSave && this.debouncedAutoSave) {
        this.debouncedAutoSave();
      }
    },
    
    addFirstItem() {
      this.$emit('add-sibling', { id: null }); // Special case for adding first item
    },
    
    getBreadcrumbText(text) {
      return text && text.length > 30 ? text.substring(0, 30) + '...' : text;
    },
    
    setupKeyboardShortcuts() {
      this.keyboardHandler = (e) => {
        // Ctrl+S or Cmd+S to save
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
          if (this.hasChanges && !this.saving) {
            e.preventDefault();
            this.handleSave();
          }
        }
      };
      
      window.addEventListener('keydown', this.keyboardHandler);
    },
    
    initializeAutoSave() {
      const debounce = (func, wait) => {
        let timeout;
        const executedFunction = function(...args) {
          const later = () => {
            clearTimeout(timeout);
            func(...args);
          };
          clearTimeout(timeout);
          timeout = setTimeout(later, wait);
        };
        
        executedFunction.cancel = function() {
          clearTimeout(timeout);
        };
        
        return executedFunction;
      };

      this.debouncedAutoSave = debounce(() => {
        if (this.hasChanges && !this.saving) {
          this.handleSave();
        }
      }, this.autoSaveDelay);
    }
  }
};
</script>

<style scoped>
.reusable-outline-container {
  width: 100%;
}

.outline-breadcrumbs {
  margin-bottom: 1rem;
  padding: 0.5rem;
  background: var(--el-fill-color-lighter);
  border-radius: 4px;
  font-size: 0.9em;
}

.breadcrumb-link {
  color: var(--el-color-primary);
  text-decoration: none;
  cursor: pointer;
}

.breadcrumb-link:hover {
  text-decoration: underline;
}

.outline-header {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-bottom: 1rem;
}

.outline-content {
  width: 100%;
}

.outline-list {
  list-style: none;
  padding-left: 0;
  margin: 0;
}

.empty-outline {
  text-align: center;
  padding: 2rem;
  color: var(--el-text-color-secondary);
  font-style: italic;
}

.empty-outline p {
  margin: 0 0 1rem 0;
}

@media (max-width: 768px) {
  .outline-header {
    flex-direction: column;
    gap: 0.5rem;
    align-items: stretch;
  }
  
  .outline-header .el-button {
    width: 100%;
    justify-content: center;
  }
}
</style> 