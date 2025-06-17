<template>
  <li 
    class="outline-item" 
    :data-id="item.id"
    :class="{ 
      'drag-over': isDragOverTop || isDragOverBottom,
      'dragging': isDragging
    }"
    @dragover.prevent.stop="handleDragOver"
    @dragenter.prevent.stop="handleDragEnter"
    @dragleave.prevent.stop="handleDragLeave"
    @drop.prevent.stop="handleDrop"
    @dragend.prevent.stop="handleDragEnd"
    tabindex="0"
  >
    <div class="outline-row">
      <div 
        class="drop-indicator"
        :class="{ 
          'indicator-top': isDragOverTop,
          'indicator-bottom': isDragOverBottom,
          'indicator-child': isDragOverChild
        }"
      ></div>
      <!-- Three-dot menu -->
      <el-dropdown 
        v-if="!readonly" 
        trigger="click" 
        @command="handleMenuCommand"
        class="three-dot-menu"
        @click.stop
      >
        <span class="three-dots">
          <el-icon><MoreFilled /></el-icon>
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="add-comment">
              <el-icon><ChatDotRound /></el-icon>
              Add Comment
            </el-dropdown-item>
            <el-dropdown-item command="copy-internal-link">
              <el-icon><Link /></el-icon>
              Copy Internal Link
            </el-dropdown-item>
            <el-dropdown-item command="indent">
              <el-icon><Right /></el-icon>
              Indent
            </el-dropdown-item>
            <el-dropdown-item command="outdent">
              <el-icon><Back /></el-icon>
              Outdent
            </el-dropdown-item>
            <el-dropdown-item command="delete" divided>
              <el-icon><Delete /></el-icon>
              Delete
            </el-dropdown-item>
            <el-dropdown-item divided class="timestamp-item">
              <strong>Created:&nbsp;</strong> {{ formatTimestamp(item.created_at || item.id) }}
            </el-dropdown-item>
            <el-dropdown-item class="timestamp-item">
              <strong>Changed:&nbsp;</strong> {{ formatTimestamp(item.updated_at || item.created_at || item.id) }}
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
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
      <span v-if="!editing && item.text.length > 0" class="outline-text" @click="handleTextClick" v-html="renderTextWithLinks(item.text)"></span>
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
        @mouseup="handleTextSelection"
        @keyup="handleTextSelection"
        class="outline-textarea"
        rows="1"
      ></textarea>
      <span v-if="hasComments" class="comment-icon" @click.stop="openCommentDialog" title="Show comments">
        💬
      </span>
    </div>

    <!-- Selection Tooltip -->
    <div
      v-if="selectionTooltipVisible"
      class="selection-tooltip"
      :style="tooltipStyle"
      @mousedown.prevent
    >
      <button
        class="tooltip-button"
        @click="handleLinkFromTooltip"
        title="Create Link"
      >
        🔗 Link
      </button>
    </div>

    <div
      class="dropzone"
      :class="{ 'dropzone-active': isDragOver }"
    ></div>

    <!-- Link Creation Dialog -->
    <el-dialog v-model="linkDialogVisible" title="Create Link" width="400px" @close="resetLinkDialog">
      <div class="link-creation-form">
        <div class="form-group">
          <label>Selected Text:</label>
          <p class="selected-text">{{ selectedText }}</p>
        </div>
        <div class="form-group">
          <label>Link URL:</label>
          <el-input 
            v-model="linkUrl" 
            placeholder="https://example.com or domain.com" 
            @keydown.enter="createLink"
            ref="linkUrlInput"
          />
        </div>
        <div class="help-text">
          <small>💡 Tip: Use the three-dot menu to quickly create links for any text</small>
        </div>
      </div>
      <template #footer>
        <p style="font-size: 14px; color: #666; float: left;margin: 6px 0;">Shortcut: cmd+k</p>
        <el-button @click="linkDialogVisible = false">Cancel</el-button>
        <el-button type="primary" @click="createLink" :disabled="!linkUrl.trim()">Create Link</el-button>
      </template>
    </el-dialog>

    <!-- Comment Dialog -->
    <el-dialog v-model="commentDialogVisible" title="Comments" width="350px" @close="resetCommentDialog">
      <div class="comments-list">
        <div v-for="(comment, idx) in comments" :key="idx" class="comment-item">
          <textarea v-model="comment.text" class="comment-edit-textarea" rows="2"
            :ref="'commentEditTextarea' + idx"
            @input="autoResizeComment(idx)"
            @blur="saveComment(idx)"></textarea>
          <div class="comment-actions">
            <el-button size="small" @click="saveComment(idx)">Save</el-button>
            <el-button size="small" type="danger" @click="deleteComment(idx)">Delete</el-button>
          </div>
        </div>
      </div>
      <div class="add-comment-section">
        <textarea v-model="newComment" class="comment-add-textarea" rows="2"
          ref="addCommentTextarea"
          @input="autoResizeAddComment"></textarea>
        <el-button size="small" type="primary" @click="addComment" :disabled="!newComment.trim()">Add</el-button>
      </div>
    </el-dialog>

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
import { ref, computed } from 'vue';
import { Plus, ArrowRight, Delete, MoreFilled, ChatDotRound, Link, Right, Back } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { supabase } from '../../supabase';
import { useRoute } from 'vue-router';
import { dragState } from './dragState.js';

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
  components: { Plus, ArrowRight, Delete, MoreFilled, ChatDotRound, Link, Right, Back },
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
      isDragging: false,
      isDragOver: false,
      unsubscribe: null,
      imagePreviewVisible: false,
      commentDialogVisible: false,
      comments: this.item.comments ? JSON.parse(JSON.stringify(this.item.comments)) : [],
      newComment: '',
      linkDialogVisible: false,
      selectedText: '',
      linkUrl: '',
      selectionStart: 0,
      selectionEnd: 0,
      savingComment: false,
      selectionTooltipVisible: false,
      tooltipStyle: {},
      tooltipTimer: null
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
      } else if (event === 'dragEnd') {
        dragState.hoveredId = null;
        dragState.hoveredPosition = null;
        this.isDragOver = false;
        this.isDragging = false;
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
    },
    isDragOverTop() {
      return dragState.hoveredId === this.item.id && dragState.hoveredPosition === 'top';
    },
    isDragOverBottom() {
      return dragState.hoveredId === this.item.id && dragState.hoveredPosition === 'bottom';
    },
    isDragOverChild() {
      return dragState.hoveredId === this.item.id && dragState.hoveredPosition === 'child';
    },
    hasComments() {
      return this.comments && this.comments.length > 0;
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
            this.autoResize();
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
    // Add global keydown listener for Ctrl+M and Ctrl+K
    this._onKeydown = (e) => {
      if (e.ctrlKey && (e.key === 'm' || e.key === 'M')) {
        // Only open if this node is focused or being edited
        const isNodeFocused = document.activeElement === this.$el || (this.$refs.textarea && document.activeElement === this.$refs.textarea);
        if (isNodeFocused || this.editing) {
          e.preventDefault();
          this.openCommentDialog();
        }
      } else if (e.ctrlKey && (e.key === 'k' || e.key === 'K')) {
        // Only create link if this node is focused or being edited
        const isNodeFocused = document.activeElement === this.$el || (this.$refs.textarea && document.activeElement === this.$refs.textarea);
        if (isNodeFocused || this.editing) {
          e.preventDefault();
          this.handleLinkShortcut();
        }
      }
    };
    
    // Add global click listener to hide tooltip when clicking outside
    this._onGlobalClick = (e) => {
      if (this.selectionTooltipVisible) {
        // Check if click is outside the tooltip and textarea
        const tooltipEl = this.$el.querySelector('.selection-tooltip');
        const textareaEl = this.$refs.textarea;
        
        if (tooltipEl && !tooltipEl.contains(e.target) && 
            textareaEl && !textareaEl.contains(e.target)) {
          this.selectionTooltipVisible = false;
        }
      }
    };
    
    window.addEventListener('keydown', this._onKeydown);
    document.addEventListener('click', this._onGlobalClick);
  },
  beforeUnmount() {
    // Clean up subscription
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    
    // Clear tooltip timer
    if (this.tooltipTimer) {
      clearTimeout(this.tooltipTimer);
      this.tooltipTimer = null;
    }
    
    window.removeEventListener('keydown', this._onKeydown);
    document.removeEventListener('click', this._onGlobalClick);
  },
  updated() {
    if (this.editing && this.$refs.textarea) {
      this.autoResize();
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
      this.selectionTooltipVisible = false;
      if (this.editText !== this.item.text) {
        // Update the timestamp when text changes
        const now = Date.now();
        this.item.updated_at = now;
        this.$emit('update', { 
          id: this.item.id, 
          text: this.editText,
          updated_at: now
        });
      }
    },
    handleEnter() {
      this.finishEdit();
      
      // Create a new sub-point with timestamps
      const now = Date.now();
      const newSubPoint = {
        id: now.toString(),
        text: '',
        children: [],
        autoFocus: true,
        created_at: now,
        updated_at: now
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
      dragState.hoveredId = null;
      dragState.hoveredPosition = null;
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
        eventBus.emit('dragEnter', this.item.id);
        this.isDragOver = true;
        return;
      }
      const rect = this.$el.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const threshold = rect.height / 2;
      // If hovering near the bottom 20%, show child indicator (regardless of children)
      if (y > rect.height * 0.8) {
        dragState.hoveredId = this.item.id;
        dragState.hoveredPosition = 'child';
      } else if (y < threshold) {
        dragState.hoveredId = this.item.id;
        dragState.hoveredPosition = 'top';
      } else {
        dragState.hoveredId = this.item.id;
        dragState.hoveredPosition = 'bottom';
      }
    },
    handleDragOver(e) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      if (e.dataTransfer.types.includes('Files')) {
        this.isDragOver = true;
        return;
      }
      const rect = this.$el.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const threshold = rect.height / 2;
      if (y > rect.height * 0.8) {
        dragState.hoveredId = this.item.id;
        dragState.hoveredPosition = 'child';
      } else if (y < threshold) {
        dragState.hoveredId = this.item.id;
        dragState.hoveredPosition = 'top';
      } else {
        dragState.hoveredId = this.item.id;
        dragState.hoveredPosition = 'bottom';
      }
    },
    handleDragLeave(e) {
      e.preventDefault();
      e.stopPropagation();
      const rect = this.$el.getBoundingClientRect();
      const x = e.clientX;
      const y = e.clientY;
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
        if (dragState.hoveredId === this.item.id) {
          dragState.hoveredId = null;
          dragState.hoveredPosition = null;
        }
        this.isDragOver = false;
      }
    },
    handleDrop(e) {
      e.preventDefault();
      e.stopPropagation();
      dragState.hoveredId = null;
      dragState.hoveredPosition = null;
      this.isDragOver = false;
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
      if (y > rect.height * 0.8) {
        return 'child';
      } else if (y < threshold) {
        return 'before';
      } else {
        return 'after';
      }
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
        //console.log('Auto-resized textarea to:', textarea.scrollHeight + 'px');
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
                description: `Outline files for Workspace ${matterId}`,
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
      } else if (e.key === 'Escape') {
        // Hide tooltip on Escape
        this.selectionTooltipVisible = false;
      } else if (e.ctrlKey && (e.key === 'k' || e.key === 'K')) {
        // Handle Ctrl+K for link creation
        e.preventDefault();
        e.stopPropagation();
        this.handleLinkShortcut();
      }
      
      // Hide tooltip on any keypress that might change selection
      if (this.selectionTooltipVisible && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
        this.selectionTooltipVisible = false;
      }
    },
    handleLinkShortcut() {
      const textarea = this.$refs.textarea;
      
      if (textarea) {
        // If in editing mode, use selected text
        const selectedText = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
        
        if (selectedText.trim().length > 0) {
          this.selectedText = selectedText.trim();
          this.selectionStart = textarea.selectionStart;
          this.selectionEnd = textarea.selectionEnd;
        } else {
          // If no text selected, use the entire text
          this.selectedText = this.item.text || 'Link text';
          this.selectionStart = 0;
          this.selectionEnd = (this.item.text || '').length;
        }
      } else {
        // If not in editing mode, start editing first and use entire text
        this.selectedText = this.item.text || 'Link text';
        this.selectionStart = 0;
        this.selectionEnd = (this.item.text || '').length;
        this.startEdit();
      }
      
      this.linkDialogVisible = true;
      
      // Focus on URL input after dialog opens with a delay to ensure dialog is fully rendered
      this.$nextTick(() => {
        setTimeout(() => {
          if (this.$refs.linkUrlInput) {
            this.$refs.linkUrlInput.focus();
          }
        }, 150);
      });
    },
    openCommentDialog() {
      this.commentDialogVisible = true;
      this.comments = this.item.comments ? JSON.parse(JSON.stringify(this.item.comments)) : [];
      this.newComment = '';
      this.$nextTick(() => {
        // Auto-resize all comment edit textareas
        this.comments.forEach((c, idx) => this.autoResizeComment(idx));
        this.autoResizeAddComment();
        // Focus the add comment textarea with a slight delay to ensure dialog is fully rendered
        setTimeout(() => {
          if (this.$refs.addCommentTextarea) {
            this.$refs.addCommentTextarea.focus();
          }
        }, 100);
      });
    },
    autoResizeComment(idx) {
      this.$nextTick(() => {
        const refName = 'commentEditTextarea' + idx;
        const textarea = this.$refs[refName];
        if (textarea && textarea[0]) {
          textarea[0].style.height = 'auto';
          textarea[0].style.height = textarea[0].scrollHeight + 'px';
        }
      });
    },
    autoResizeAddComment() {
      this.$nextTick(() => {
        const textarea = this.$refs.addCommentTextarea;
        if (textarea) {
          textarea.style.height = 'auto';
          textarea.style.height = textarea.scrollHeight + 'px';
        }
      });
    },
    resetCommentDialog() {
      this.newComment = '';
      this.comments = this.item.comments ? JSON.parse(JSON.stringify(this.item.comments)) : [];
    },
    addComment() {
      if (!this.newComment.trim()) return;
      this.comments.push({ text: this.newComment.trim(), created: Date.now() });
      this.saveCommentsToNode();
      this.newComment = '';
    },
    saveComment(idx) {
      // Prevent double execution
      if (this.savingComment) return;
      this.savingComment = true;
      
      setTimeout(() => {
        this.savingComment = false;
      }, 100);
      
      if (!this.comments[idx].text.trim()) {
        // If comment is empty, remove it
        this.deleteComment(idx);
        return;
      }
      this.comments[idx].text = this.comments[idx].text.trim();
      this.comments[idx].lastModified = Date.now();
      this.saveCommentsToNode();
      ElMessage.success('Comment saved');
    },
    deleteComment(idx) {
      this.$confirm('Are you sure you want to delete this comment?', 'Delete Comment', {
        confirmButtonText: 'Delete',
        cancelButtonText: 'Cancel',
        type: 'warning',
      }).then(() => {
        this.comments.splice(idx, 1);
        this.saveCommentsToNode();
        ElMessage.success('Comment deleted');
      }).catch(() => {
        // User cancelled deletion
      });
    },
    saveCommentsToNode() {
      // Save to node
      this.item.comments = JSON.parse(JSON.stringify(this.comments));
      // Save to localStorage (bubble up to parent)
      this.$emit('update', { id: this.item.id, text: this.item.text, comments: this.item.comments });
    },
    renderTextWithLinks(text) {
      if (!text) return '';
      
      // Parse text for links in the format [text](url)
      const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
      
      return text.replace(linkRegex, (match, linkText, url) => {
        // Ensure URL has protocol
        const fullUrl = url.startsWith('http') ? url : `https://${url}`;
        return `<a href="${fullUrl}" target="_blank" rel="noopener noreferrer" class="outline-link">${linkText}</a>`;
      });
    },
    handleTextClick(event) {
      // If the click was on a link, don't start editing
      if (event.target.tagName === 'A' && event.target.classList.contains('outline-link')) {
        event.stopPropagation();
        return;
      }
      // Otherwise, start editing
      this.startEdit();
    },
    handleTextSelection() {
      const textarea = this.$refs.textarea;
      if (!textarea) return;
      
      // Clear any existing timer
      if (this.tooltipTimer) {
        clearTimeout(this.tooltipTimer);
        this.tooltipTimer = null;
      }
      
      const selectedText = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
      
      if (selectedText.trim().length > 0) {
        this.selectedText = selectedText.trim();
        this.selectionStart = textarea.selectionStart;
        this.selectionEnd = textarea.selectionEnd;
        
        // Calculate tooltip position
        this.calculateTooltipPosition(textarea);
        
        // Show tooltip after a short delay
        this.tooltipTimer = setTimeout(() => {
          this.selectionTooltipVisible = true;
        }, 300);
      } else {
        // Hide tooltip if no text is selected
        this.selectionTooltipVisible = false;
      }
    },
    createLink() {
      if (!this.linkUrl.trim() || !this.selectedText.trim()) {
        return;
      }
      
      // Ensure URL has protocol
      let url = this.linkUrl.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      
      // Create markdown-style link
      const linkMarkdown = `[${this.selectedText}](${url})`;
      
      // Replace selected text with link markdown
      const beforeSelection = this.editText.substring(0, this.selectionStart);
      const afterSelection = this.editText.substring(this.selectionEnd);
      
      this.editText = beforeSelection + linkMarkdown + afterSelection;
      
      // Update the item text
      this.$emit('update', { id: this.item.id, text: this.editText });
      
      // Close dialog and reset
      this.linkDialogVisible = false;
      this.resetLinkDialog();
      
      // Focus back on textarea
      this.$nextTick(() => {
        if (this.$refs.textarea) {
          this.$refs.textarea.focus();
          // Set cursor position after the inserted link
          const newCursorPos = beforeSelection.length + linkMarkdown.length;
          this.$refs.textarea.setSelectionRange(newCursorPos, newCursorPos);
        }
      });
    },
    resetLinkDialog() {
      this.selectedText = '';
      this.linkUrl = '';
      this.selectionStart = 0;
      this.selectionEnd = 0;
    },
    handleMenuCommand(command) {
      if (command === 'add-comment') {
        this.openCommentDialog();
      } else if (command === 'copy-internal-link') {
        this.copyInternalLink();
      } else if (command === 'create-link') {
        this.handleLinkShortcut();
      } else if (command === 'indent') {
        this.$emit('indent', { id: this.item.id });
      } else if (command === 'outdent') {
        this.$emit('outdent', { id: this.item.id });
      } else if (command === 'delete') {
        this.$emit('delete', this.item.id);
      }
    },
    calculateTooltipPosition(textarea) {
      // Get textarea position relative to viewport
      const textareaRect = textarea.getBoundingClientRect();
      const containerRect = this.$el.getBoundingClientRect();
      
      // Calculate approximate position of selected text
      const textBeforeSelection = textarea.value.substring(0, this.selectionStart);
      const lines = textBeforeSelection.split('\n');
      const currentLine = lines.length - 1;
      const charInLine = lines[currentLine].length;
      
      // More accurate character width estimation based on textarea font
      const computedStyle = window.getComputedStyle(textarea);
      const fontSize = parseFloat(computedStyle.fontSize);
      const charWidth = fontSize * 0.6; // Rough estimation for monospace-like characters
      const lineHeight = parseFloat(computedStyle.lineHeight) || fontSize * 1.2;
      
      const x = Math.min(charInLine * charWidth, textarea.offsetWidth - 80); // Prevent overflow
      const y = currentLine * lineHeight;
      
      // Position tooltip above the selection, relative to the textarea
      this.tooltipStyle = {
        position: 'absolute',
        left: `${Math.max(10, x)}px`, // Minimum 10px from left
        top: `${Math.max(-40, y - 40)}px`, // 40px above the text, minimum -40px
        zIndex: 1000
      };
    },
    handleLinkFromTooltip() {
      this.selectionTooltipVisible = false;
      this.handleLinkShortcut();
    },
    async copyInternalLink() {
      try {
        const matterId = this.route.params.matterId;
        const currentUrl = window.location.origin + window.location.pathname;
        const internalLink = `${currentUrl}?focus=${this.item.id}`;
        
        await navigator.clipboard.writeText(internalLink);
        ElMessage.success('Internal link copied to clipboard');
      } catch (error) {
        console.error('Failed to copy link:', error);
        
        // Fallback for browsers that don't support clipboard API
        try {
          const textArea = document.createElement('textarea');
          const matterId = this.route.params.matterId;
          const currentUrl = window.location.origin + window.location.pathname;
          const internalLink = `${currentUrl}?focus=${this.item.id}`;
          
          textArea.value = internalLink;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
          
          ElMessage.success('Internal link copied to clipboard');
        } catch (fallbackError) {
          console.error('Fallback copy failed:', fallbackError);
          ElMessage.error('Failed to copy link to clipboard');
        }
      }
    },
    formatTimestamp(timestamp) {
      const date = new Date(parseInt(timestamp));
      const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      };
      return date.toLocaleDateString('en-US', options).replace(',', ' at');
    }
  }
};
</script>

<style scoped>
.outline-item {
  display: block;
  margin: 0 2rem;
  position: relative;
  max-width: 100%;
  transition: all 0.2s ease;
  margin-right: 0px;
}

.outline-row {
  position: relative;
  display: flex;
  align-items: baseline;
  min-height: 25px;
}

.outline-text,
.outline-textarea {
  padding-right: 32px;
}

.drop-indicator {
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background: #1976d2;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.drop-indicator.indicator-top {
  top: -1px;
  opacity: 1;
}

.drop-indicator.indicator-bottom {
  bottom: -1px;
  opacity: 1;
}

.drop-indicator.indicator-child {
  left: 0;
  right: 0;
  width: auto;
  bottom: -1px;
  height: 2px;
  background: #1976d2;
  opacity: 1;
  border-radius: 2px;
}

.outline-item.dragging {
  opacity: 0.5;
  cursor: move;
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
  margin-left: 0;
  font-size: 10px;
  vertical-align: baseline;
  margin-right: 16px;
  margin-top: 0;
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
  font-size: 0.95rem;
  font-weight: normal;
  color: #2a3135;
  cursor: pointer;
  vertical-align: baseline;
  line-height: 1.4;
  margin: 0;
}
.outline-item > .outline-text {
  font-size: 1rem;
  font-weight: normal;
  color: #2a3135;
}
.outline-item ul {
  margin-left: 5px;
    padding-left: 0px;
    border-left: 1px solid #ECEEF0;
}
.outline-textarea {
  display: inline-block;
  width: calc(90% - 50px);
  max-width: 90%;
  font-size: 1rem;
  font-weight: normal;
  color: #2a3135;
  border: 0px;
  margin: 0;
  outline: none;
  min-width: 100px;
  margin-bottom: 0.1rem;
  vertical-align: baseline;
  resize: none;
  overflow: hidden;
  line-height: 1.2;
  padding: 0;
  font-family: inherit;
  background:transparent;
}

.dropzone {
  background: transparent;
  transition: all 0.2s ease;
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

.comment-icon {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  margin-left: 8px;
  cursor: pointer;
  font-size: 1.1em;
  vertical-align: middle;
  z-index: 2;
}

.comments-list {
  margin-bottom: 10px;
}

.comment-item {
  margin-bottom: 8px;
  background: #f5f7fa;
  border-radius: 4px;
  padding: 6px;
}

.comment-edit-textarea {
  width: 100%;
  font-size: 0.95em;
  margin-bottom: 8px;
  border-radius: 3px;
  border: 1px solid #e0e0e0;
  resize: vertical;
  padding: 8px;
}

.comment-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.add-comment-section {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.comment-add-textarea {
  width: 100%;
  font-size: 0.95em;
  border-radius: 3px;
  border: 1px solid #e0e0e0;
  resize: vertical;
  margin-bottom: 4px;
}

/* Link Styles */
.outline-text :deep(.outline-link) {
  color: #1976d2;
  text-decoration: underline;
  cursor: pointer;
  transition: color 0.2s ease;
}

.outline-text :deep(.outline-link:hover) {
  color: #1565c0;
  text-decoration: underline;
}

/* Link Creation Form */
.link-creation-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.link-creation-form .form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.link-creation-form label {
  font-weight: 500;
  color: #606266;
  font-size: 14px;
}

.link-creation-form .selected-text {
  background: #f5f7fa;
  padding: 8px;
  border-radius: 4px;
  border: 1px solid #e4e7ed;
  font-style: italic;
  color: #909399;
  margin: 0;
}

.help-text {
  color: #909399;
  font-size: 12px;
}

.help-text kbd {
  background: #f5f5f5;
  border: 1px solid #d1d5db;
  border-radius: 3px;
  font-size: 11px;
  padding: 2px 4px;
  margin: 0 1px;
}

/* Three-dot menu */
.three-dot-menu {
  margin-right: 5px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s ease;
  margin-top: 5px;
  margin-left: -24px;
}

.outline-row:hover .three-dot-menu {
  opacity: 1;
}

.three-dots {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 3px;
  color: #666;
  font-size: 14px;
}

.three-dots:hover {
  background-color: #f5f5f5;
  color: #333;
}

/* Selection Tooltip */
.selection-tooltip {
  position: absolute;
  background: #fff;
  border: 1px solid #e1e4e8;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  overflow: hidden;
  pointer-events: auto;
}

.selection-tooltip::before {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: #fff;
}

.selection-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 7px solid transparent;
  border-top-color: #e1e4e8;
  z-index: -1;
}

.tooltip-button {
  background: transparent;
  border: none;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
  color: #586069;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 70px;
  font-weight: 500;
}

.tooltip-button:hover {
  background-color: #f6f8fa;
  color: #0366d6;
}

/* Timestamp Tooltip */
.timestamp-tooltip {
  position: absolute;
  background: #fff;
  border: 1px solid #e1e4e8;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  overflow: hidden;
  pointer-events: auto;
  padding: 8px;
  margin-top: 10px;
}

.timestamp-line {
  margin-bottom: 4px;
  font-size: 0.9em;
  color: #606266;
}

.timestamp-line strong {
  font-weight: 500;
}

/* Timestamp items in dropdown menu */
.timestamp-item {
  font-size: 0.85em !important;
  color: #666 !important;
  cursor: default !important;
  padding: 4px 12px !important;
}

.timestamp-item strong {
  font-weight: 500;
  color: #666 !important;
}
</style> 