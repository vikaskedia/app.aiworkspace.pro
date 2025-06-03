<template>
  <li 
    class="outline-item" 
    :data-id="item.id"
    :class="{ 
      'drag-over-top': isDragOverTop,
      'drag-over-bottom': isDragOverBottom,
      'dragging': isDragging
    }"
    @dragover.prevent.stop="handleDragOver"
    @dragenter.prevent.stop="handleDragEnter"
    @dragleave.prevent.stop="handleDragLeave"
    @drop.prevent.stop="handleDrop"
    @dragend.prevent.stop="handleDragEnd"
  >
    <span
      class="collapse-toggle"
      :style="hasChildren ? 'cursor:pointer; visibility:visible;' : 'visibility:hidden;'"
      @click.stop="hasChildren ? toggleCollapse() : undefined"
    >
      <span v-if="hasChildren">
        <span v-if="collapsed">&#9654;</span>
        <span v-else>&#9660;</span>
      </span>
    </span>
    <div 
      class="outline-bullet"
      draggable="true"
      @click="$emit('drilldown', item.id)"
      style="cursor:pointer;"
      @dragstart="handleDragStart"
      @dragend="handleDragEnd"
    ></div>
    <span v-if="!editing && item.text.length > 0" class="outline-text" @click="startEdit">{{ item.text || 'Click to edit...' }}</span>
    <textarea
      v-else
      ref="textarea"
      v-model="editText"
      @blur="finishEdit"
      @keydown.enter.prevent="handleEnter"
      @keydown.backspace="handleBackspace"
      @keydown.up.prevent="handleArrowUp"
      @keydown.down.prevent="handleArrowDown"
      @keydown="handleKeydown"
      @input="autoResize"
      class="outline-textarea"
      rows="1"
    ></textarea>
    <div
      class="dropzone"
      :class="{ 'dropzone-active': isDragOver }"
    ></div>

    <!-- File Preview Section -->
    <div v-if="item.fileUrl" class="file-preview">
      <!-- Image Preview -->
      <img 
        v-if="isImageFile(item.text)" 
        :src="getAuthenticatedUrl(item.fileUrl)" 
        :alt="getFileName(item.text)"
        class="preview-image"
        @click="openImagePreview"
        @error="handleImageError"
        @load="handleImageLoad"
      />
      
      <!-- Other File Types -->
      <div v-else class="file-info">
        <el-button 
          type="primary" 
          link 
          @click="downloadFile(item.fileUrl, getFileName(item.text))"
        >
          Download
        </el-button>
      </div>
    </div>

    <!-- Image Preview Dialog -->
    <el-dialog
      v-model="imagePreviewVisible"
      :title="getFileName(item.text)"
      width="80%"
      class="image-preview-dialog"
    >
      <img 
        :src="getAuthenticatedUrl(item.fileUrl)" 
        :alt="getFileName(item.text)"
        class="preview-image-full"
        @error="handleImageError"
      />
    </el-dialog>

    <ul v-if="hasChildren && !collapsed" class="outline-list">
      <OutlinePointsCt
        v-for="child in item.children"
        :key="child.id"
        :item="child"
        :autoFocus="child.autoFocus"
        @update="updateChild"
        @move="handleMove"
        @delete="handleDelete"
        @drilldown="$emit('drilldown', $event)"
        @navigate="$emit('navigate', $event)"
        @indent="$emit('indent', $event)"
        @outdent="$emit('outdent', $event)"
      />
    </ul>
  </li>
</template>

<script>
import { ref } from 'vue';
import { Plus, ArrowRight, Delete } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { supabase } from '../../supabase';
import { useRoute } from 'vue-router';

// Create a simple event bus
const eventBus = {
  listeners: new Set(),
  emit(event, data) {
    this.listeners.forEach(listener => listener(event, data));
  },
  on(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
};

export default {
  name: 'OutlinePointsCt',
  components: { Plus, ArrowRight, Delete },
  props: {
    item: { type: Object, required: true },
    readonly: {
      type: Boolean,
      default: false
    },
    autoFocus: {
      type: Boolean,
      default: false
    }
  },
  emits: ['update', 'move', 'delete', 'drilldown', 'navigate', 'indent', 'outdent'],
  data() {
    return {
      editing: false,
      editText: this.item.text,
      collapsed: false,
      isDragOverTop: false,
      isDragOverBottom: false,
      isDragging: false,
      isDragOver: false,
      unsubscribe: null,
      imagePreviewVisible: false
    };
  },
  setup() {
    const route = useRoute();
    return {
      route
    };
  },
  created() {
    // Subscribe to drag events
    this.unsubscribe = eventBus.on((event, data) => {
      if (event === 'dragStart') {
        this.isDragOver = false;
      } else if (event === 'dragEnter' && data !== this.item.id) {
        this.isDragOver = false;
      }
    });
  },
  beforeUnmount() {
    // Clean up subscription
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  },
  computed: {
    hasChildren() {
      return this.item.children && this.item.children.length > 0;
    }
  },
  watch: {
    'item.text'(val) {
      this.editText = val;
    },
    autoFocus(newVal) {
      if (newVal) {
        this.editing = true;
        this.$nextTick(() => {
          if (this.$refs.textarea) {
            this.$refs.textarea.focus();
          }
        });
        this.$emit('update', { id: this.item.id, text: this.item.text, autoFocus: false });
      }
    }
  },
  mounted() {
    if (this.autoFocus) {
      this.editing = true;
      this.$nextTick(() => {
        if (this.$refs.textarea) {
          this.$refs.textarea.focus();
        }
      });
      // Optionally clear autoFocus after focusing
      this.$emit('update', { id: this.item.id, text: this.item.text, autoFocus: false });
    }
  },
  methods: {
    startEdit() {
      this.editing = true;
      this.$nextTick(() => {
        if (this.$refs.textarea) {
          this.$refs.textarea.focus();
          this.autoResize();
        }
      });
    },
    finishEdit() {
      this.editing = false;
      if (this.editText !== this.item.text) {
        this.$emit('update', { id: this.item.id, text: this.editText });
      }
    },
    handleEnter() {
      this.finishEdit();
      
      // Create a new sub-point
      const newSubPoint = {
        id: Date.now().toString(),
        text: '',
        children: [],
        autoFocus: true
      };
      
      // Initialize children array if it doesn't exist
      if (!this.item.children) {
        this.item.children = [];
      }
      
      // Add the new sub-point
      this.item.children.push(newSubPoint);
      
      // Force Vue to update the DOM
      this.$forceUpdate();
    },
    handleDragStart(e) {
      // Only allow dragging from the bullet point
      if (!e.target.classList.contains('outline-bullet')) {
        e.preventDefault();
        return;
      }
      // Set the dragged item data with the correct ID
      e.dataTransfer.setData('text/plain', this.item.id.toString());
      e.dataTransfer.effectAllowed = 'move';

      // Add dragging class to the entire item
      this.isDragging = true;

      // If this item has children, add dragging class to all children
      if (this.hasChildren) {
        const childItems = this.$el.querySelectorAll('.outline-item');
        childItems.forEach(item => {
          if (item !== this.$el) {
            item.classList.add('dragging');
          }
        });
      }
    },
    handleDragEnd(e) {
      e.preventDefault();
      e.stopPropagation();
      
      // Reset all drag states
      this.isDragOverTop = false;
      this.isDragOverBottom = false;
      this.isDragOver = false;
      this.isDragging = false;
      
      // Notify other components
      eventBus.emit('dragEnd');
    },
    handleDragEnter(e) {
      e.preventDefault();
      e.stopPropagation();
      
      // Check if this is a file drag
      if (e.dataTransfer.types.includes('Files')) {
        // Notify other components
        eventBus.emit('dragEnter', this.item.id);
        this.isDragOver = true;
        return;
      }
      
      const rect = this.$el.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const threshold = rect.height / 2;
      
      this.isDragOverTop = y < threshold;
      this.isDragOverBottom = y >= threshold;
    },
    handleDragOver(e) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      
      // Check if this is a file drag
      if (e.dataTransfer.types.includes('Files')) {
        this.isDragOver = true;
        return;
      }
      
      const rect = this.$el.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const threshold = rect.height / 2;
      
      this.isDragOverTop = y < threshold;
      this.isDragOverBottom = y >= threshold;
    },
    handleDragLeave(e) {
      e.preventDefault();
      e.stopPropagation();
      
      // Only remove the drop zone if we're leaving the item itself
      // and not entering a child element
      const rect = this.$el.getBoundingClientRect();
      const x = e.clientX;
      const y = e.clientY;
      
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
        this.isDragOverTop = false;
        this.isDragOverBottom = false;
        this.isDragOver = false;
      }
    },
    handleDrop(e) {
      e.preventDefault();
      e.stopPropagation();
      
      // Reset all drag states
      this.isDragOverTop = false;
      this.isDragOverBottom = false;
      this.isDragOver = false;
      
      // Notify other components
      eventBus.emit('dragEnd');
      
      // Check if this is a file drop
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        this.handleFileDrop(e.dataTransfer.files[0]);
        return;
      }
      
      // Handle outline item drag and drop
      const draggedId = e.dataTransfer.getData('text/plain');
      const targetId = this.item.id.toString();
      
      // Don't allow dropping onto itself
      if (draggedId === targetId) return;
      
      this.$emit('move', {
        draggedId,
        targetId,
        position: this.getDropPosition(e)
      });
    },
    getDropPosition(e) {
      const rect = this.$el.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const threshold = rect.height / 2;
      
      return y < threshold ? 'before' : 'after';
    },
    handleMove(payload) {
      console.log('Propagating move event in OutlinePointsCt:', payload);
      // Propagate the move event up to the parent
      this.$emit('move', payload);
    },
    autoResize() {
      const textarea = this.$refs.textarea;
      if (textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
      }
    },
    updateChild(payload) {
      // Remove autoFocus after focusing
      if ('autoFocus' in payload) {
        const child = this.item.children.find(c => c.id === payload.id);
        if (child) child.autoFocus = false;
      }
      this.$emit('update', payload);
    },
    handleBackspace(e) {
      // Only delete if the textarea is empty, we're at the start of the line, and there are no children
      if (this.editText === '' && 
          e.target.selectionStart === 0 && 
          (!this.item.children || this.item.children.length === 0)) {
        e.preventDefault();
        this.$emit('delete', this.item.id);
      }
    },
    handleDelete(id) {
      this.$emit('delete', id);
    },
    toggleCollapse() {
      this.collapsed = !this.collapsed;
    },
    async handleFileDrop(file) {
      try {
        const giteaToken = import.meta.env.VITE_GITEA_TOKEN;
        const giteaHost = import.meta.env.VITE_GITEA_HOST;
        
        // Get the matter ID from the route
        const matterId = this.route.params.matterId;
        
        if (!matterId) {
          throw new Error('No matter ID found');
        }
        
        // Create repo name for the matter
        const repoName = `Matter_${matterId}_Outline`;
        
        // Try to create the repository if it doesn't exist
        try {
          await fetch(
            `${giteaHost}/api/v1/org/associateattorney/repos`,
            {
              method: 'POST',
              headers: {
                'Authorization': `token ${giteaToken}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
              },
              body: JSON.stringify({
                name: repoName,
                description: `Outline files for Matter ${matterId}`,
                private: true,
                auto_init: true,
                trust_model: 'collaborator'
              })
            }
          );
        } catch (error) {
          // Ignore 409 errors (repo already exists)
          if (!error.message.includes('409')) {
            throw error;
          }
        }

        // Generate unique filename
        const timestamp = Date.now();
        const uniqueFileName = `${timestamp}-${file.name}`;
        
        // Convert file to base64
        const base64Content = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
          };
          reader.readAsDataURL(file);
        });

        // Upload to Gitea
        const response = await fetch(
          `${giteaHost}/api/v1/repos/associateattorney/${repoName}/contents/${uniqueFileName}`,
          {
            method: 'POST',
            headers: {
              'Authorization': `token ${giteaToken}`,
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache'
            },
            body: JSON.stringify({
              message: `Upload ${uniqueFileName}`,
              content: base64Content,
              branch: 'main'
            })
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('File upload response:', data);
        
        // Get the raw download URL
        const downloadUrl = data.content.download_url;
        console.log('File download URL:', downloadUrl);

        // Add file as subpoint
        const newSubpoint = {
          id: Date.now().toString(),
          text: file.name,
          children: [],
          fileUrl: downloadUrl
        };

        if (!this.item.children) {
          this.item.children = [];
        }
        this.item.children.push(newSubpoint);
        this.$emit('update', { id: this.item.id, text: this.item.text });

        ElMessage.success('File uploaded successfully');
      } catch (error) {
        console.error('Error uploading file:', error);
        ElMessage.error('Failed to upload file: ' + error.message);
      }
    },
    isImageFile(text) {
      if (!text) return false;
      const fileName = this.getFileName(text);
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      return imageExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
    },
    getFileName(text) {
      if (!text) return '';
      // Remove the file icon (📎) and any leading/trailing spaces
      return text.replace('📎', '').trim();
    },
    handleImageError(e) {
      console.error('Error loading image:', e);
      console.log('Failed URL:', e.target.src);
      ElMessage.error('Failed to load image');
      // If the image fails to load, show the file info view instead
      this.$el.querySelector('.file-preview').innerHTML = `
        <div class="file-info">
          <el-button 
            type="primary" 
            link 
            @click="downloadFile(this.item.fileUrl, this.getFileName(this.item.text))"
          >
            Download
          </el-button>
        </div>
      `;
    },
    handleImageLoad(e) {
      console.log('Image loaded successfully:', e.target.src);
    },
    openImagePreview() {
      this.imagePreviewVisible = true;
    },
    getAuthenticatedUrl(url) {
      if (!url) return '';
      const giteaToken = import.meta.env.VITE_GITEA_TOKEN;
      // Add token as query parameter
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}token=${giteaToken}`;
    },
    async downloadFile(url, fileName) {
      try {
        console.log('Downloading file from:', url);
        const response = await fetch(this.getAuthenticatedUrl(url), {
          headers: {
            'Authorization': `token ${import.meta.env.VITE_GITEA_TOKEN}`
          }
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
      } catch (error) {
        console.error('Error downloading file:', error);
        ElMessage.error('Failed to download file: ' + error.message);
      }
    },
    handleArrowUp(e) {
      this.$emit('navigate', { id: this.item.id, direction: 'up' });
    },
    handleArrowDown(e) {
      this.$emit('navigate', { id: this.item.id, direction: 'down' });
    },
    handleKeydown(e) {
      if (e.key === 'Tab' && e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        this.$emit('outdent', { id: this.item.id });
      } else if (e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        this.$emit('indent', { id: this.item.id });
      }
    }
  }
};
</script>

<style scoped>
.outline-item {
  display: block;
  margin: 0.5rem 2.5rem;
  position: relative;
  max-width: 100%;
  transition: all 0.2s ease;
  margin-right: 0px;
}

.outline-item.drag-over-top {
  margin-top: 1.5rem;
  position: relative;
}

/* Only show top indicator when dragging is active */
.outline-item.drag-over-top:not(.dragging)::before {
  content: '';
  position: absolute;
  top: -0.5rem;
  left: 0;
  right: 0;
  height: 2px;
  background: #ECEEF0;
  border-radius: 2px;
}

.outline-item.drag-over-bottom {
  margin-bottom: 1.5rem;
  position: relative;
}

/* Only show bottom indicator when dragging is active */
.outline-item.drag-over-bottom:not(.dragging)::after {
  content: '';
  position: absolute;
  bottom: -0.5rem;
  left: 0;
  right: 0;
  height: 2px;
  background: #ECEEF0;
  border-radius: 2px;
}

.outline-item.dragging {
  opacity: 0.5;
  cursor: move;
}

/* Show indicators only when dragging is active */
.outline-item:not(.dragging).drag-over-top::before,
.outline-item:not(.dragging).drag-over-bottom::after {
  display: none;
}

.outline-bullet {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #4B5155;
  display: inline-block;
  margin-right: 9px;
  vertical-align: top;
  border: 2px solid #e3eaf6;
  margin-left: -18px;
  margin-top: 5px;
  cursor: move;
  transition: all 0.2s ease;
}

.outline-bullet:hover {
  background: #23272f;
  border-color: #4B5155;
  transform: scale(1.2);
}

.collapse-toggle {
  display: inline-block;
  width: 20px;
  cursor: pointer;
  user-select: none;
  margin-left: -11px;
  font-size: 10px;
  vertical-align: top;
  margin-right: 10px;
  margin-top: 5px;
}
.collapse-toggle:span {
  color: #4B5155;
}
.collapse-toggle.collapsed span {
  /* Optionally rotate the triangle if you use SVG or want animation */
}
.outline-text {
  display: inline-block;
  width: calc(90% - 50px);
  font-size: 1rem;
  font-weight: normal;
  color: #23272f;
  margin-bottom: 0.25rem;
  line-height: 1.2;
  cursor: pointer;
  vertical-align: middle;
}
.outline-item > .outline-text {
  font-size: 1rem;
  font-weight: normal;
  color: #23272f;
}
.outline-item ul {
  margin-left: 5px;
    margin-top: 0.5rem;
    padding-left: 0px;
    border-left: 1px solid #ECEEF0;
}
.outline-textarea {
  display: inline-block;
  width: calc(90% - 50px);
  max-width: 90%;
  font-size: 1rem;
  font-weight: normal;
  color: #23272f;
  border: 0px;
  margin: -2px 0px 0px -2px;
  outline: none;
  min-width: 100px;
  margin-bottom: 0.1rem;
  vertical-align: middle;
  resize: none;
  overflow: hidden;
  line-height: 1.2;
  padding: 0;
  font-family: inherit;
  background:transparent;
}

.dropzone {
  height: 2px;
  background: transparent;
  transition: all 0.2s ease;
  margin: 4px 0;
  position: relative;
  z-index: 1;
}

.dropzone-active {
  height: 4px;
  background: #1976d2;
  border-radius: 2px;
  max-width: 100px;
}

.file-preview {
  margin: 8px 0;
  padding: 8px;
  border-radius: 4px;
  background: transparent;
  width: auto;
}

.preview-image {
  max-width: 200px;
  max-height: 200px;
  border-radius: 4px;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.preview-image:hover {
  transform: scale(1.02);
}

.preview-image-full {
  max-width: 100%;
  max-height: 80vh;
  object-fit: contain;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.file-name {
  flex: 1;
  color: #606266;
}

.image-preview-dialog :deep(.el-dialog__body) {
  padding: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #000;
}

.image-preview-dialog :deep(.el-dialog__header) {
  padding: 16px;
  margin: 0;
  background: #fff;
}
</style> 