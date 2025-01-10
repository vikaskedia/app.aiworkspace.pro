<template>
  <div class="editor">
    <div class="editor-toolbar">
      <!-- Text Formatting -->
      <el-button-group class="toolbar-group">
        <el-button 
          size="small" 
          :class="{ 'is-active': editor?.isActive('bold') }"
          @click="editor?.chain().focus().toggleBold().run()"
          title="Bold">
          <span class="format-text">B</span>
        </el-button>
        <el-button 
          size="small"
          :class="{ 'is-active': editor?.isActive('italic') }"
          @click="editor?.chain().focus().toggleItalic().run()"
          title="Italic">
          <span class="format-text">I</span>
        </el-button>
        <el-button 
          size="small"
          :class="{ 'is-active': editor?.isActive('strike') }"
          @click="editor?.chain().focus().toggleStrike().run()"
          title="Strike">
          <span class="format-text">S</span>
        </el-button>
      </el-button-group>

      <!-- Headings -->
      <el-button-group class="toolbar-group">
        <el-button 
          v-for="level in [1, 2, 3]" 
          :key="level"
          size="small"
          :class="{ 'is-active': editor?.isActive('heading', { level }) }"
          @click="editor?.chain().focus().toggleHeading({ level }).run()"
          :title="`Heading ${level}`">
          H{{ level }}
        </el-button>
      </el-button-group>

      <!-- Lists -->
      <el-button-group class="toolbar-group">
        <el-button 
          size="small"
          :class="{ 'is-active': editor?.isActive('bulletList') }"
          @click="editor?.chain().focus().toggleBulletList().run()"
          title="Bullet List">
          <el-icon><List /></el-icon>
        </el-button>
        <el-button 
          size="small"
          :class="{ 'is-active': editor?.isActive('orderedList') }"
          @click="editor?.chain().focus().toggleOrderedList().run()"
          title="Numbered List">
          <el-icon><Operation /></el-icon>
        </el-button>
      </el-button-group>

      <!-- Code & Quote -->
      <el-button-group class="toolbar-group">
        <el-button 
          size="small"
          :class="{ 'is-active': editor?.isActive('code') }"
          @click="editor?.chain().focus().toggleCode().run()"
          title="Code">
          <el-icon><Terminal /></el-icon>
        </el-button>
        <el-button 
          size="small"
          :class="{ 'is-active': editor?.isActive('blockquote') }"
          @click="editor?.chain().focus().toggleBlockquote().run()"
          title="Quote">
          <el-icon><QuoteRight /></el-icon>
        </el-button>
      </el-button-group>

      <!-- Undo/Redo -->
      <el-button-group class="toolbar-group">
        <el-button 
          size="small"
          @click="editor?.chain().focus().undo().run()"
          :disabled="!editor?.can().undo()"
          title="Undo">
          <el-icon><Back /></el-icon>
        </el-button>
        <el-button 
          size="small"
          @click="editor?.chain().focus().redo().run()"
          :disabled="!editor?.can().redo()"
          title="Redo">
          <el-icon><Right /></el-icon>
        </el-button>
      </el-button-group>
    </div>

    <editor-content :editor="editor" />
  </div>
</template>

<script>
import { Editor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { 
  ArrowLeft as Back, 
  ArrowRight as Right,
  List,
  Operation,
  Monitor as Terminal,
  ChatRound as QuoteRight
} from '@element-plus/icons-vue'

export default {
  components: {
    EditorContent,
    Back,
    Right,
    List,
    Operation,
    Terminal,
    QuoteRight
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
        StarterKit
      ],
      content: this.modelValue,
      onUpdate: ({ editor }) => {
        this.$emit('update:modelValue', editor.getHTML())
      }
    })
  },

  beforeUnmount() {
    this.editor?.destroy()
  }
}
</script>

<style lang="scss" scoped>
.editor {
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  
  .editor-toolbar {
    padding: 4px;
    border-bottom: 1px solid var(--el-border-color-light);
    background: var(--el-fill-color-light);
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 2px;
  }

  .toolbar-group {
    display: flex;
    align-items: center;
    gap: 1px;
    
    &:not(:last-child) {
      margin-right: 2px;
    }
  }

  :deep(.ProseMirror) {
    padding: 20px;
    min-height: 200px;
    outline: none;

    p.is-editor-empty:first-child::before {
      content: attr(data-placeholder);
      float: left;
      color: var(--el-text-color-placeholder);
      pointer-events: none;
      height: 0;
    }

    h1, h2, h3 {
      margin: 1em 0 0.5em;
      line-height: 1.3;
    }

    code {
      background: var(--el-fill-color-light);
      padding: 0.2em 0.4em;
      border-radius: 4px;
    }

    blockquote {
      border-left: 4px solid var(--el-border-color);
      margin: 1em 0;
      padding: 0.5em 1em;
      background: var(--el-fill-color-lighter);
    }
  }
}

.format-text {
  font-family: Times New Roman, serif;
  font-weight: bold;
  font-size: 15px;
  line-height: 1;
}

:deep(.el-button) {
  height: 32px;
  padding: 0 8px;
  
  &.is-active {
    background: var(--el-color-primary-light-9);
    color: var(--el-color-primary);
  }
}
</style>
