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
  >
    <span
      v-if="hasChildren"
      class="collapse-toggle"
      :class="{ collapsed }"
      @click="toggleCollapse"
    >
      <span v-if="collapsed">&#9654;</span>
      <span v-else>&#9660;</span>
    </span>
    <div 
      class="outline-bullet"
      draggable="true"
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
      @input="autoResize"
      class="outline-textarea"
      rows="1"
    ></textarea>
    <ul v-if="hasChildren && !collapsed" class="outline-list">
      <OutlinePointsCt
        v-for="child in item.children"
        :key="child.id"
        :item="child"
        @update="updateChild"
        @move="handleMove"
        @delete="handleDelete"
      />
    </ul>
  </li>
</template>

<script>
export default {
  name: 'OutlinePointsCt',
  props: {
    item: { type: Object, required: true }
  },
  emits: ['update', 'move', 'delete'],
  data() {
    return {
      editing: false,
      editText: this.item.text,
      collapsed: false,
      isDragOverTop: false,
      isDragOverBottom: false,
      isDragging: false
    };
  },
  computed: {
    hasChildren() {
      return this.item.children && this.item.children.length > 0;
    }
  },
  watch: {
    'item.text'(val) {
      this.editText = val;
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
        children: []
      };
      
      // Initialize children array if it doesn't exist
      if (!this.item.children) {
        this.item.children = [];
      }
      
      // Add the new sub-point
      this.item.children.push(newSubPoint);
      
      // Force Vue to update the DOM
      this.$forceUpdate();
      
      // Wait for the DOM to update and then focus the new textarea
      this.$nextTick(() => {
        // wait for 100ms
        setTimeout(() => {
          const newSubPointElement = this.$el.querySelector(`[data-id="${newSubPoint.id}"]`);
          if (newSubPointElement) {
            const newSubPointComponent = newSubPointElement.__vue__;
            if (newSubPointComponent) {
              // Set editing to true and focus the textarea
              newSubPointComponent.editing = true;
              this.$nextTick(() => {
                const textarea = newSubPointElement.querySelector('textarea');
                if (textarea) {
                  textarea.focus();
                }
              });
            }
          }
        }, 100);
      });
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
      // Remove dragging class from the entire item
      this.isDragging = false;
      this.isDragOverTop = false;
      this.isDragOverBottom = false;

      // Remove dragging class from all children
      const childItems = this.$el.querySelectorAll('.outline-item');
      childItems.forEach(item => {
        item.classList.remove('dragging');
      });
    },
    handleDragOver(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      
      const rect = this.$el.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const threshold = rect.height / 2;
      
      this.isDragOverTop = y < threshold;
      this.isDragOverBottom = y >= threshold;
    },
    handleDragEnter(e) {
      e.preventDefault();
      // Don't show drop zone if we're dragging over our own item or its children
      const draggedId = e.dataTransfer.getData('text/plain');
      if (draggedId === this.item.id) return;
      
      const rect = this.$el.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const threshold = rect.height / 2;
      
      this.isDragOverTop = y < threshold;
      this.isDragOverBottom = y >= threshold;
    },
    handleDragLeave(e) {
      e.preventDefault();
      // Only remove the drop zone if we're leaving the item itself
      if (e.target === this.$el) {
        this.isDragOverTop = false;
        this.isDragOverBottom = false;
      }
    },
    handleDrop(e) {
      e.preventDefault();
      e.stopPropagation(); // Stop event from bubbling up
      this.isDragOverTop = false;
      this.isDragOverBottom = false;
      
      console.log('handleDrop', e.dataTransfer);
      console.log('this.item', this.item);
      const draggedId = e.dataTransfer.getData('text/plain');
      const targetId = this.item.id.toString();
      
      // Don't allow dropping onto itself
      if (draggedId === targetId) return;
      
      console.log('Emitting move event from OutlinePointsCt:', {
        draggedId,
        targetId,
        position: this.getDropPosition(e)
      });
      
      // Emit move event with both IDs
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
      this.$emit('update', payload);
    },
    toggleCollapse() {
      this.collapsed = !this.collapsed;
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
    }
  }
};
</script>

<style scoped>
.outline-item {
  display: block;
  margin: 0.5rem 2.5rem;
  position: relative;
  width: 100%;
  transition: all 0.2s ease;
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
</style> 