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
          <el-icon><Bold /></el-icon>
        </el-button>
        <el-button 
          size="small"
          :class="{ 'is-active': editor?.isActive('italic') }"
          @click="editor?.chain().focus().toggleItalic().run()"
          title="Italic">
          <el-icon><Italic /></el-icon>
        </el-button>
        <el-button 
          size="small"
          :class="{ 'is-active': editor?.isActive('strike') }"
          @click="editor?.chain().focus().toggleStrike().run()"
          title="Strike">
          <el-icon><Strike /></el-icon>
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
        <el-button 
          size="small"
          :class="{ 'is-active': editor?.isActive('taskList') }"
          @click="editor?.chain().focus().toggleTaskList().run()"
          title="Task List">
          <el-icon><Check /></el-icon>
        </el-button>
      </el-button-group>

      <!-- Alignment -->
      <el-button-group class="toolbar-group">
        <el-button 
          size="small"
          :class="{ 'is-active': editor?.isActive({ textAlign: 'left' }) }"
          @click="editor?.chain().focus().setTextAlign('left').run()"
          title="Align Left">
          <el-icon><AlignLeft /></el-icon>
        </el-button>
        <el-button 
          size="small"
          :class="{ 'is-active': editor?.isActive({ textAlign: 'center' }) }"
          @click="editor?.chain().focus().setTextAlign('center').run()"
          title="Align Center">
          <el-icon><AlignCenter /></el-icon>
        </el-button>
        <el-button 
          size="small"
          :class="{ 'is-active': editor?.isActive({ textAlign: 'right' }) }"
          @click="editor?.chain().focus().setTextAlign('right').run()"
          title="Align Right">
          <el-icon><AlignRight /></el-icon>
        </el-button>
      </el-button-group>

      <!-- Special Formatting -->
      <el-button-group class="toolbar-group">
        <el-button 
          size="small"
          :class="{ 'is-active': editor?.isActive('blockquote') }"
          @click="editor?.chain().focus().toggleBlockquote().run()"
          title="Quote">
          <el-icon><QuoteRight /></el-icon>
        </el-button>
        <el-button 
          size="small"
          :class="{ 'is-active': editor?.isActive('code') }"
          @click="editor?.chain().focus().toggleCode().run()"
          title="Code">
          <el-icon><Terminal /></el-icon>
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

      <!-- File Upload -->
      <el-button-group class="toolbar-group">
        <el-upload
          class="upload-button"
          action="#"
          :auto-upload="false"
          :show-file-list="false"
          :on-change="file => handleFileUpload(file.raw)">
          <el-button 
            size="small"
            title="Upload File">
            <el-icon><UploadIcon /></el-icon>
          </el-button>
        </el-upload>
      </el-button-group>
    </div>

    <div class="editor-content-wrapper">
      <editor-content :editor="editor" />
      
      <!-- Replace existing typeahead suggestions with inline suggestions -->
      <div 
        v-if="showTypeahead && typeaheadSuggestions.length" 
        class="inline-suggestions"
        :style="typeaheadPosition">
        <div class="suggestion-text">
          {{ typeaheadSuggestions[typeaheadSelectedIndex >= 0 ? typeaheadSelectedIndex : 0] }}
        </div>
        <div class="suggestion-controls">
          <kbd>Tab</kbd> to accept
        </div>
      </div>
    </div>

    <!-- File Upload Dialog -->
    <el-dialog
      v-model="uploadDialogVisible"
      title="Upload File"
      width="30%"
      :before-close="handleClose">
      <el-upload
        ref="upload"
        :auto-upload="false"
        :on-change="handleFileUpload"
        :on-remove="handleFileRemove"
        :before-upload="beforeFileUpload"
        :file-list="fileToUpload"
        :limit="1"
        :accept="'.pdf,.doc,.docx,.txt,.jpg,.png'"
        :show-upload-list="false">
        <el-button slot="trigger" type="primary">Select File</el-button>
        <el-button type="success" @click="handleUpload">Upload</el-button>
        <el-button type="danger" @click="uploadDialogVisible = false">Cancel</el-button>
      </el-upload>
    </el-dialog>
  </div>
</template>

<script>
import { Editor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import TextAlign from '@tiptap/extension-text-align'
import { ElMessage } from 'element-plus'
import { 
  Edit as Bold,
  DocumentCopy as Italic,
  DeleteFilled as Strike,
  Menu as List,
  Tickets as Operation,
  Select as Check,
  CaretLeft as AlignLeft,
  CaretBottom as AlignCenter,
  CaretRight as AlignRight,
  ChatRound as QuoteRight,
  Monitor as Terminal,
  ArrowLeft as Back,
  ArrowRight as Right,
  Upload as UploadIcon,
  Close
} from '@element-plus/icons-vue'
import { FileUpload } from '../../extensions/FileUpload'
import { useMatterStore } from '../../store/matter'
import { storeToRefs } from 'pinia'
import { Typeahead } from '../../extensions/Typeahead'
import debounce from 'lodash/debounce'

export default {
  components: {
    EditorContent,
    Bold,
    Italic,
    Strike,
    List,
    Operation,
    Check,
    AlignLeft,
    AlignCenter,
    AlignRight,
    QuoteRight,
    Terminal,
    Back,
    Right,
    UploadIcon,
    Close
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
      editor: null,
      uploadDialogVisible: false,
      fileToUpload: null,
      showTypeahead: false,
      typeaheadSuggestions: [],
      typeaheadSelectedIndex: -1,
      typeaheadPosition: {
        top: '0px',
        left: '0px'
      },
      pythonApiBaseUrl: import.meta.env.VITE_PYTHON_API_URL
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
        TaskList,
        TaskItem,
        TextAlign.configure({
          types: ['heading', 'paragraph']
        }),
        FileUpload,
        Typeahead.configure({
          onKeyDown: this.handleEditorKeyDown
        })
      ],
      content: this.modelValue,
      onUpdate: () => {
        this.$emit('update:modelValue', this.editor.getHTML())
      },
      editorProps: {
        attributes: {
          class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none',
        },
      }
    })

    // Debounce the suggestion fetch
    this.debouncedGetSuggestions = debounce(this.getTypeaheadSuggestions, 300)
  },
  beforeUnmount() {
    this.editor?.destroy()
  },
  setup() {
    const matterStore = useMatterStore()
    const { currentMatter } = storeToRefs(matterStore)
    return { currentMatter }
  },
  methods: {
    handleClose() {
      this.uploadDialogVisible = false;
      this.fileToUpload = null;
    },
    
    handleFileRemove() {
      this.fileToUpload = null;
    },
    
    beforeFileUpload(file) {
      // Optional: Add file validation here
      return true;
    },
    
    handleUpload() {
      if (this.fileToUpload) {
        this.handleFileUpload(this.fileToUpload);
      }
    },
    
    async handleFileUpload(file) {
      if (!file) return;
      
      try {
        const giteaToken = import.meta.env.VITE_GITEA_TOKEN;
        
        // Use currentMatter from Pinia store instead of this.$store
        if (!this.currentMatter) throw new Error('No matter selected');
        
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
          `/gitea/api/v1/repos/associateattorney/${this.currentMatter.git_repo}/contents/${file.name}`,
          {
            method: 'POST',
            headers: {
              'Authorization': `token ${giteaToken}`,
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: `Upload ${file.name}`,
              content: base64Content,
              branch: 'main'
            })
          }
        );

        if (!response.ok) throw new Error('Failed to upload file');
        
        const data = await response.json();
        const downloadUrl = data.content.download_url.replace(
          import.meta.env.VITE_GITEA_HOST,
          '/gitea'
        );

        // Insert the file link into the editor
        this.editor.chain().focus().insertFile({
          name: file.name,
          url: downloadUrl,
        }).run();

      } catch (error) {
        ElMessage.error('Error uploading file: ' + error.message);
      }
    },

    handleEditorKeyDown({ text, cursorPosition, event }) {
      if (!this.showTypeahead) {
        // Check if we should show typeahead
        const lastWord = text.slice(0, cursorPosition).split(/\s+/).pop()
        if (lastWord && lastWord.length > 2) { // Only show after 2 characters
          this.debouncedGetSuggestions(text, cursorPosition)
          this.updateTypeaheadPosition()
        }
      } else {
        // Handle navigation
        this.handleTypeaheadNavigation(event)
      }
    },

    async getTypeaheadSuggestions(text, cursorPosition) {
      try {
        const response = await fetch(`${this.pythonApiBaseUrl}/gpt/get_typeahead_suggestions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text,
            cursor_position: cursorPosition,
            context: {
              matter_id: this.currentMatter?.id
            }
          })
        })

        if (!response.ok) throw new Error('Failed to get suggestions')
        
        const data = await response.json()
        
        if (data.suggestions?.length) {
          this.typeaheadSuggestions = data.suggestions
          this.showTypeahead = true
          this.typeaheadSelectedIndex = -1
          this.updateTypeaheadPosition()
        }
      } catch (error) {
        console.error('Error getting suggestions:', error)
        this.showTypeahead = false
      }
    },

    handleTypeaheadNavigation(event) {
      if (!this.showTypeahead || !this.typeaheadSuggestions.length) return

      switch (event.key) {
        case 'Tab':
          event.preventDefault()
          this.applySuggestion(this.typeaheadSuggestions[
            this.typeaheadSelectedIndex >= 0 ? this.typeaheadSelectedIndex : 0
          ])
          break
        case 'ArrowDown':
          event.preventDefault()
          this.typeaheadSelectedIndex = Math.min(
            this.typeaheadSelectedIndex + 1,
            this.typeaheadSuggestions.length - 1
          )
          break
        case 'ArrowUp':
          event.preventDefault()
          this.typeaheadSelectedIndex = Math.max(this.typeaheadSelectedIndex - 1, 0)
          break
        case 'Escape':
          event.preventDefault()
          this.showTypeahead = false
          break
      }
    },

    applySuggestion(suggestion) {
      const { state, dispatch } = this.editor.view
      const { from } = state.selection
      
      // Get the word before cursor
      const text = state.doc.textBetween(0, from)
      const words = text.split(/\s+/)
      const lastWord = words[words.length - 1]
      
      // Calculate the position to replace
      const start = from - lastWord.length
      
      // Replace the text
      dispatch(state.tr.replaceWith(
        start,
        from,
        state.schema.text(suggestion)
      ))
      
      this.showTypeahead = false
    },

    updateTypeaheadPosition() {
      this.$nextTick(() => {
        const { view } = this.editor
        const { from } = view.state.selection
        const coords = view.coordsAtPos(from)
        
        // Get the editor's container dimensions
        const editorContainer = view.dom.getBoundingClientRect()
        
        // Calculate position relative to the editor
        const relativeTop = coords.top - editorContainer.top
        const relativeLeft = coords.left - editorContainer.left
        
        this.typeaheadPosition = {
          top: `${relativeTop}px`,
          left: `${relativeLeft}px`
        }
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.editor {
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  
  .editor-toolbar {
    padding: 8px;
    border-bottom: 1px solid var(--el-border-color);
    background: var(--el-fill-color-light);
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
    padding: 6px;
    height: 32px;
    width: 32px;

    &.is-active {
      background-color: var(--el-color-primary-light-9);
      color: var(--el-color-primary);
    }

    .el-icon {
      font-size: 16px;
    }
  }
  
  :deep(.ProseMirror) {
    min-height: 150px;
    padding: 16px;
    outline: none;
    
    line-height: 1.5;
    
    p {
      margin: 0.5em 0;
    }
    
    &:focus {
      outline: none;
    }

    p.is-editor-empty:first-child::before {
      content: attr(data-placeholder);
      float: left;
      color: var(--el-text-color-placeholder);
      pointer-events: none;
      height: 0;
    }

    ul[data-type="taskList"] {
      list-style: none;
      padding: 0;

      li {
        display: flex;
        gap: 0.5rem;
        
        > label {
          margin-right: 0.5rem;
        }
      }
    }

    blockquote {
      border-left: 3px solid var(--el-border-color-darker);
      padding-left: 1rem;
      color: var(--el-text-color-regular);
    }

    code {
      background-color: var(--el-fill-color-lighter);
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      font-family: monospace;
    }
  }
}

.upload-button {
  :deep(.el-upload) {
    display: block;
  }
  
  :deep(.el-button) {
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

.editor-content-wrapper {
  position: relative;
}

.inline-suggestions {
  position: absolute;
  pointer-events: none;
  display: flex;
  align-items: center;
  gap: 8px;
  
  .suggestion-text {
    color: var(--el-text-color-disabled);
    font-family: monospace;
    white-space: pre;
  }
  
  .suggestion-controls {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    display: flex;
    align-items: center;
    gap: 4px;
    
    kbd {
      background: var(--el-fill-color-lighter);
      border: 1px solid var(--el-border-color);
      border-radius: 3px;
      padding: 1px 4px;
      font-size: 11px;
      line-height: 1;
    }
  }
}
</style> 