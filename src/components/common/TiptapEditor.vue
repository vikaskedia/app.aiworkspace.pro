<template>
  <div class="editor">
    <div class="editor-toolbar">
      <!-- Text Style -->
      <el-button-group class="toolbar-group">
        <el-button 
          size="small" 
          :class="{ 'is-active': editor?.isActive('bold') }"
          @click="editor?.chain().focus().toggleBold().run()"
          title="Bold">
          <i class="el-icon-bold">B</i>
        </el-button>
        <el-button 
          size="small"
          :class="{ 'is-active': editor?.isActive('italic') }"
          @click="editor?.chain().focus().toggleItalic().run()"
          title="Italic">
          <i class="el-icon-italic">I</i>
        </el-button>
        <el-button 
          size="small"
          :class="{ 'is-active': editor?.isActive('strike') }"
          @click="editor?.chain().focus().toggleStrike().run()"
          title="Strike">
          <i class="el-icon-strikethrough">S</i>
        </el-button>
      </el-button-group>

      <!-- Lists -->
      <el-button-group class="toolbar-group">
        <el-button 
          size="small"
          :class="{ 'is-active': editor?.isActive('bulletList') }"
          @click="editor?.chain().focus().toggleBulletList().run()"
          title="Bullet List">
          <i class="el-icon-list">•</i>
        </el-button>
        <el-button 
          size="small"
          :class="{ 'is-active': editor?.isActive('orderedList') }"
          @click="editor?.chain().focus().toggleOrderedList().run()"
          title="Numbered List">
          <i class="el-icon-list">1.</i>
        </el-button>
      </el-button-group>

      <!-- Undo/Redo -->
      <el-button-group class="toolbar-group">
        <el-button 
          size="small"
          @click="editor?.chain().focus().undo().run()"
          :disabled="!editor?.can().undo()"
          title="Undo">
          <i class="el-icon-refresh-left">↶</i>
        </el-button>
        <el-button 
          size="small"
          @click="editor?.chain().focus().redo().run()"
          :disabled="!editor?.can().redo()"
          title="Redo">
          <i class="el-icon-refresh-right">↷</i>
        </el-button>
      </el-button-group>
    </div>

    <editor-content :editor="editor" />
  </div>
</template>

<script>
import { Editor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'

export default {
  components: {
    EditorContent,
  },
  props: {
    modelValue: {
      type: String,
      default: ''
    },
    placeholder: {
      type: String,
      default: 'Write something...'
    }
  },
  data() {
    return {
      editor: null
    }
  },
  watch: {
    modelValue(newValue) {
      const isSame = this.editor?.getHTML() === newValue
      if (!isSame) {
        this.editor?.commands.setContent(newValue)
      }
    }
  },
  mounted() {
    this.editor = new Editor({
      extensions: [
        StarterKit,
      ],
      content: this.modelValue,
      onUpdate: () => {
        this.$emit('update:modelValue', this.editor.getHTML())
      },
    })
  },
  beforeUnmount() {
    this.editor?.destroy()
  }
}
</script>

<style lang="scss" scoped>
.editor {
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  
  .editor-toolbar {
    padding: 8px;
    border-bottom: 1px solid #dcdfe6;
    background: #f5f7fa;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }

  .toolbar-group {
    display: flex;
    align-items: center;
    gap: 1px;
  }

  :deep(.el-button) {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px;

    &.is-active {
      background-color: #ecf5ff;
      color: #409EFF;
    }
  }
  
  :deep(.ProseMirror) {
    min-height: 100px;
    padding: 12px;
    outline: none;
    
    &:focus {
      border-color: #409eff;
    }
    
    p.is-editor-empty:first-child::before {
      content: attr(data-placeholder);
      float: left;
      color: #909399;
      pointer-events: none;
      height: 0;
    }
  }
}
</style> 