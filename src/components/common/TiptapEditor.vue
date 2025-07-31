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
          <el-icon>
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M3 5h18v2H3V5zm0 4h12v2H3V9zm0 4h18v2H3v-2zm0 4h12v2H3v-2z"/>
            </svg>
          </el-icon>
        </el-button>
        <el-button 
          size="small"
          :class="{ 'is-active': editor?.isActive({ textAlign: 'center' }) }"
          @click="editor?.chain().focus().setTextAlign('center').run()"
          title="Align Center">
          <el-icon>
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M3 5h18v2H3V5zm3 4h12v2H6V9zm-3 4h18v2H3v-2zm3 4h12v2H6v-2z"/>
            </svg>
          </el-icon>
        </el-button>
        <el-button 
          size="small"
          :class="{ 'is-active': editor?.isActive({ textAlign: 'right' }) }"
          @click="editor?.chain().focus().setTextAlign('right').run()"
          title="Align Right">
          <el-icon>
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M3 5h18v2H3V5zm6 4h12v2H9V9zm-6 4h18v2H3v-2zm6 4h12v2H9v-2z"/>
            </svg>
          </el-icon>
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

      <!-- Table Controls -->
      <el-button-group class="toolbar-group">
        <el-button 
          size="small"
          title="Insert Table"
          @click="insertTable">
          <el-icon><TableIcon /></el-icon>
        </el-button>
        <el-button size="small" @click="addRowAfter" title="Add Row Below">
          <div class="table-icon-add-row"></div>
        </el-button>
        <el-button size="small" @click="addColumnAfter" title="Add Column Right">
          <div class="table-icon-add-column"></div>
        </el-button>
        <el-button size="small" @click="deleteRow" title="Delete Row">
          <div class="table-icon-delete-row"></div>
        </el-button>
        <el-button size="small" @click="deleteColumn" title="Delete Column">
          <div class="table-icon-delete-column"></div>
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
      <!-- Replace the existing upload button group in TiptapEditor.vue -->
      <el-button-group class="toolbar-group">
        <el-button 
          size="small"
          title="Insert File"
          @click="showFileDialog = true">
          <el-icon><UploadIcon /></el-icon>
        </el-button>
      </el-button-group>

      <!-- Collapse Toggle -->
      <el-button 
        size="small"
        :class="{ 'is-active': editor?.isActive('collapsibleListItem', { collapsed: true }) }"
        @click="editor?.chain().focus().toggleCollapse().run()"
        title="Toggle List Collapse (Ctrl+Alt+C)">
        <el-icon>
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M4 9h12l-6 6z"/>
          </svg>
        </el-icon>
      </el-button>
    </div>

    <div class="editor-content-wrapper">
      <editor-content :editor="editor" />
      
      <!-- Replace existing typeahead suggestions with inline suggestions -->
      <div 
        v-if="showTypeahead && typeaheadSuggestions.length" 
        class="inline-suggestions"
        :style="typeaheadPosition">
        <div class="suggestion-list">
          <div 
            v-for="(suggestion, index) in typeaheadSuggestions" 
            :key="index"
            :class="['suggestion-item', { 'selected': index === typeaheadSelectedIndex }]"
          >
            {{ suggestion }}
          </div>
        </div>
        <div class="suggestion-controls">
          <div class="controls-left">
            <kbd>Tab</kbd> to accept
          </div>
          <div class="controls-right">
            <kbd>Esc</kbd> to cancel
          </div>
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

    <FileInsertDialog
      v-model="showFileDialog"
      @file-selected="handleFileSelected"
    />

    <!-- Table Dialog -->
    <el-dialog
      v-model="showTableDialog"
      title="Insert Table"
      width="300px">
      <el-form>
        <el-form-item label="Rows">
          <el-input-number 
            v-model="tableForm.rows" 
            :min="2" 
            :max="10" 
            size="small" />
        </el-form-item>
        <el-form-item label="Columns">
          <el-input-number 
            v-model="tableForm.columns" 
            :min="2" 
            :max="10" 
            size="small" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showTableDialog = false">Cancel</el-button>
        <el-button type="primary" @click="createTable">Insert</el-button>
      </template>
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
  Close,
  CaretRight,
  CaretBottom
} from '@element-plus/icons-vue'
import { FileUpload } from '../../extensions/FileUpload'
import { useMatterStore } from '../../store/matter'
import { storeToRefs } from 'pinia'
import { Typeahead } from '../../extensions/Typeahead'
import debounce from 'lodash/debounce'
import FileInsertDialog from './FileInsertDialog.vue'
import { Mention } from '../../extensions/Mention'
import tippy from 'tippy.js'
import 'tippy.js/dist/tippy.css'
import { supabase } from '../../supabase'
import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import { Grid as TableIcon } from '@element-plus/icons-vue'
import { Extension } from '@tiptap/core'
import { Link } from '@tiptap/extension-link'
import { CollapsibleList } from '../../extensions/CollapsibleList'
import { CollapsibleListItem } from '../../extensions/CollapsibleListItem'
import { CollapsibleHeading } from '../../extensions/CollapsibleHeading'
import { CollapsibleHeadingNode } from '../../extensions/CollapsibleHeadingNode'
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
    Close,
    FileInsertDialog,
    TableIcon
  },
  props: {
    modelValue: {
      type: String,
      default: ''
    },
    placeholder: {
      type: String,
      default: 'Write something...'
    },
    sharedUsers: {
      type: Array,
      default: () => []
    },
    taskId: {
      type: String,
      required: false,
      default: "0"
    },
    taskTitle: {
      type: String,
      required: true
    },
    isTaskComment: {
      type: Boolean,
      default: false
    },
    enableTypeahead: {
      type: Boolean,
      default: true
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
      pythonApiBaseUrl: import.meta.env.VITE_PYTHON_API_URL,
      showFileDialog: false,
      processedMentions: [],
      typeaheadTimer: null,
      mentionPopup: null,
      showTableDialog: false,
      tableForm: {
        rows: 3,
        columns: 3
      }
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
    window.selectMention = (index) => {
      const mentionState = this.editor.state.selection.$from.marks().find(mark => mark.type.name === 'mention')
      if (mentionState) {
        const items = mentionState.attrs.items || []
        const item = items[index]
        if (item) {
          this.editor.commands.insertMention({ id: item.id, label: item.label })
        }
      }
    }
    
    this.editor = new Editor({
      extensions: [
        StarterKit.configure({
          heading: true,
          link: false,
        }),
        TaskList,
        TaskItem,
        TextAlign.configure({
          types: ['heading', 'paragraph']
        }),
        CollapsibleList,
        CollapsibleListItem,
        CollapsibleHeadingNode,
        CollapsibleHeading,
        FileUpload,
        Link.configure({
          openOnClick: true,
          HTMLAttributes: {
            target: '_blank',
            rel: 'noopener noreferrer',
            class: 'editor-link'
          },
          validate: href => /^https?:\/\//.test(href),
        }),
        Typeahead.configure({
          onKeyDown: ({ text, cursorPosition, event }) => {
            // Return early if typeahead is disabled
            if (!this.enableTypeahead) {
              return false;
            }

            // Get the last word
            const lastWord = text.slice(0, cursorPosition).split(/\s+/).pop()
            
            // If last word starts with @, hide typeahead and return
            if (lastWord?.startsWith('@')) {
              if (this.showTypeahead) {
                this.showTypeahead = false
                this.typeaheadSuggestions = []
              }
              return false
            }

            // Handle navigation keys
            if (this.showTypeahead && this.typeaheadSuggestions.length) {
              switch (event.key) {
                case 'ArrowDown':
                  event.preventDefault()
                  this.typeaheadSelectedIndex = Math.min(
                    (this.typeaheadSelectedIndex + 1),
                    this.typeaheadSuggestions.length - 1
                  )
                  return true
                case 'ArrowUp':
                  event.preventDefault()
                  this.typeaheadSelectedIndex = Math.max(this.typeaheadSelectedIndex - 1, 0)
                  return true
                case 'Tab':
                  if (this.showTypeahead) {
                    event.preventDefault()
                    this.applySuggestion(
                      this.typeaheadSuggestions[
                        this.typeaheadSelectedIndex >= 0 ? this.typeaheadSelectedIndex : 0
                      ]
                    )
                    return true
                  }
                  break
                case 'Enter':
                  // Don't prevent default - let Enter create new line
                  this.showTypeahead = false
                  return false
                case 'Escape':
                  if (this.showTypeahead) {
                    event.preventDefault()
                    this.showTypeahead = false
                    return true
                  }
                  break
              }
            }

            // Check for typeahead trigger
            if (lastWord && lastWord.length > 1 && !lastWord.startsWith('@')) {
              if (this.typeaheadTimer) {
                clearTimeout(this.typeaheadTimer)
              }
              
              this.typeaheadTimer = setTimeout(() => {
                this.getTypeaheadSuggestions(text, cursorPosition)
              }, 300)
            }
            return false
          }
        }),
        Mention.configure({
          vueComponent: this
        }),
        Table.configure({
          resizable: true,
          HTMLAttributes: {
            class: 'editor-table',
          },
        }),
        TableRow,
        TableCell,
        TableHeader,
        Extension.create({
          addProseMirrorPlugins() {
            return [
              new Plugin({
                props: {
                  handleTextInput: (view, from, to, text) => {
                    if (text === ' ') {
                      const { state } = view
                      const $pos = state.doc.resolve(from)
                      
                      // Check for heading pattern first
                      const textBefore = state.doc.textBetween(0, from)
                      const headingMatch = /(?:^|\n)(#{1,3})$/.exec(textBefore)
                      if (headingMatch) {
                        const level = headingMatch[1].length
                        const start = from - headingMatch[1].length
                        
                        const tr = state.tr
                          .delete(start, from + 1)
                          .setBlockType(start, start, state.schema.nodes.heading, { level })
                        
                        view.dispatch(tr)
                        return true
                      }
                      
                      // Enhanced URL handling with nested list awareness
                      let depth = $pos.depth
                      let listItemStart = from
                      let inList = false
                      
                      // Find the innermost list item containing our position
                      while (depth > 0) {
                        const node = $pos.node(depth)
                        if (node.type.name === 'listItem' || 
                            node.type.name === 'orderedList' || 
                            node.type.name === 'bulletList') {
                          inList = true
                          listItemStart = $pos.before(depth)
                          break
                        }
                        depth--
                      }
                      
                      // Get text from the current list item or full text if not in a list
                      const relevantText = inList 
                        ? state.doc.textBetween(listItemStart, from)
                        : textBefore
                      
                      const urlRegex = /(https?):\/\/[^\s\n]+$/
                      const urlMatch = relevantText.match(urlRegex)
                      
                      if (urlMatch) {
                        const matchedUrl = urlMatch[0]
                        const start = from - matchedUrl.length
                        const tr = state.tr
                        
                        tr.delete(start, from + 1)
                        tr.insertText(matchedUrl, start)
                        
                        const mark = state.schema.marks.link.create({ href: matchedUrl })
                        tr.addMark(start, start + matchedUrl.length, mark)
                        
                        // Add space after link without including it in the URL
                        tr.insertText(' ', start + matchedUrl.length)
                        
                        view.dispatch(tr)
                        return true
                      }
                    }
                    return false
                  }
                }
              })
            ]
          }
        })
      ],
      content: this.modelValue,
      onUpdate: ({ editor }) => {
        this.$emit('update:modelValue', editor.getHTML())
        this.handleMentions(editor)
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
        const giteaHost = import.meta.env.VITE_GITEA_HOST;
        
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
          `${giteaHost}/api/v1/repos/associateattorney/${this.currentMatter.git_repo}/contents/${file.name}`,
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
        const downloadUrl = data.content.download_url;

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
      // Skip processing for arrow keys
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        return false;
      }

      if (event.key === 'Escape' && this.showTypeahead) {
        event.preventDefault();
        event.stopPropagation();
        this.showTypeahead = false;
        this.typeaheadSuggestions = [];
        return true;
      }

      if (event.key === 'Tab' && this.showTypeahead && this.typeaheadSuggestions.length) {
        event.preventDefault();
        this.applySuggestion(this.typeaheadSuggestions[0]);
        return true;
      }

      // Rest of the existing code...
    },

    async getTypeaheadSuggestions(text, cursorPosition) {
      // Return early if typeahead is disabled
      if (!this.enableTypeahead) {
        this.showTypeahead = false;
        return;
      }

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
              task_id: this.taskId,
              task_title: this.taskTitle
            }
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to get suggestions: ${errorText}`);
        }
        
        const data = await response.json();
        
        if (data.suggestions?.length) {
          this.typeaheadSuggestions = data.suggestions;
          this.showTypeahead = true;
          this.typeaheadSelectedIndex = -1;
          this.updateTypeaheadPosition();
        } else {
          this.showTypeahead = false;
        }
      } catch (error) {
        console.error('Error getting suggestions:', error);
        this.showTypeahead = false;
      }
    },

    handleTypeaheadNavigation(event) {
      if (!this.showTypeahead || !this.typeaheadSuggestions.length) return;

      switch (event.key) {
        case 'Tab':
          event.preventDefault();
          this.applySuggestion(this.typeaheadSuggestions[0]);
          break;
        case 'Escape':
          event.preventDefault();
          this.showTypeahead = false;
          break;
      }
    },

    applySuggestion(suggestion) {
      if (!this.editor || !suggestion) return
      
      const { state, dispatch } = this.editor.view
      const { from } = state.selection
      
      // Get the word before cursor
      const text = state.doc.textBetween(0, from)
      const words = text.split(/\s+/)
      const lastWord = words[words.length - 1]
      
      // Calculate the position to replace
      const start = from - lastWord.length
      
      // Create the transaction
      const tr = state.tr.replaceWith(
        start,
        from,
        state.schema.text(suggestion)
      )
      
      // Apply the transaction
      dispatch(tr)
      
      // Reset typeahead state
      this.showTypeahead = false
      this.typeaheadSuggestions = []
      this.typeaheadSelectedIndex = -1
      
      // Focus back on editor
      this.editor.commands.focus()
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
        
        // Set the cap triangle position using CSS variable
        const root = document.documentElement
        root.style.setProperty('--cap-left', `${relativeLeft}px`)
        
        this.typeaheadPosition = {
          top: `${relativeTop}px`,
          // left position is now handled by CSS
        }
      })
    },

    getUniqueFileName(originalName) {
      const timestamp = new Date().getTime();
      const lastDotIndex = originalName.lastIndexOf('.');
      
      // Handle files with no extension
      if (lastDotIndex === -1) {
        return `${originalName}_${timestamp}`;
      }
      
      // Handle files with extension
      const baseName = originalName.substring(0, lastDotIndex);
      const ext = originalName.substring(lastDotIndex);
      
      return `${baseName}_${timestamp}${ext}`;
    },

    async handleFileSelected(file) {
      try {
        if (file.download_url) {
          // If file already has a download_url, it's an existing file - use it directly
          this.editor.chain().focus().insertContent(`[${file.name}](${file.download_url})`).run();
          this.showFileDialog = false;
          ElMessage.success('File inserted successfully');
        } else {
          // Only for new file uploads
          const giteaToken = import.meta.env.VITE_GITEA_TOKEN;
          const giteaHost = import.meta.env.VITE_GITEA_HOST;
          const uniqueFileName = this.getUniqueFileName(file.name);
          
          // Convert file to base64
          const base64Content = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64 = reader.result.split(',')[1];
              resolve(base64);
            };
            reader.readAsDataURL(file);
          });

          // Upload with new filename
          const response = await fetch(
            `${giteaHost}/api/v1/repos/associateattorney/${this.currentMatter.git_repo}/contents/${uniqueFileName}`,
            {
              method: 'POST',
              headers: {
                'Authorization': `token ${giteaToken}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                message: `Upload ${uniqueFileName}`,
                content: base64Content,
                branch: 'main'
              })
            }
          );

          if (!response.ok) throw new Error('Failed to upload file');
          
          const data = await response.json();
          const downloadUrl = data.content.download_url;

          // Insert the file link into the editor
          this.editor.chain().focus().insertContent(`[${uniqueFileName}](${downloadUrl})`).run();
          this.showFileDialog = false;
          ElMessage.success('File uploaded successfully');
        }
      } catch (error) {
        console.error('Error handling file:', error);
        ElMessage.error('Failed to handle file: ' + error.message);
      }
    },

    renderPopup({ items, command, selectedIndex }) {
      const popupContent = document.createElement('div')
      popupContent.className = 'mention-popup'
      
      items.forEach((item, index) => {
        const itemElement = document.createElement('div')
        itemElement.className = `mention-item ${index === selectedIndex ? 'selected' : ''}`
        itemElement.onclick = () => command(item)
        
        itemElement.innerHTML = `
          <div class="mention-item-avatar">
            ${item.label[0].toUpperCase()}
          </div>
          <div class="mention-item-info">
            <div class="mention-item-name">${item.label}</div>
          </div>
        `
        
        popupContent.appendChild(itemElement)
      })
      
      return popupContent
    },

    handleMentionKeydown({ items, command, event, selectedIndex }) {
      if (!items || !items.length) return false
      
      switch (event.key) {
        case 'ArrowUp': {
          event.preventDefault()
          const prevIndex = selectedIndex <= 0 ? items.length - 1 : selectedIndex - 1
          command({ selectedIndex: prevIndex })
          return true
        }
          
        case 'ArrowDown': {
          event.preventDefault()
          const nextIndex = selectedIndex >= items.length - 1 ? 0 : selectedIndex + 1
          command({ selectedIndex: nextIndex })
          return true
        }
          
        case 'Enter':
        case 'Tab': {
          event.preventDefault()
          if (selectedIndex >= 0 && items[selectedIndex]) {
            command(items[selectedIndex])
          }
          return true
        }
          
        case 'Escape': {
          event.preventDefault()
          this.destroyMentionPopup()
          return true
        }
      }
      
      return false
    },

    destroyMentionPopup() {
      if (this.mentionPopup) {
        this.mentionPopup.destroy()
        this.mentionPopup = null
      }
    },

    async handleMentions(editor) {
      const mentions = editor.getJSON().content
        .filter(node => node.type === 'mention')
        .map(node => node.attrs.id)

      // Create notifications for new mentions
      for (const userId of mentions) {
        if (!this.processedMentions.includes(userId)) {
          await this.createNotification(userId)
          this.processedMentions.push(userId)
        }
      }
    },

    async createNotification(userId) {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        
        const { error } = await supabase
          .from('notifications')
          .insert({
            user_id: userId,
            type: 'mention',
            actor_id: user.id,
            metadata: {
              task_id: this.taskId,
              task_title: this.taskTitle,
              comment_by: user.email
            },
            read: false
          })

        if (error) throw error
      } catch (error) {
        console.error('Error creating mention notification:', error)
      }
    },

    renderMentionPopup(props) {
      const { items, command, selectedIndex } = props
      
      const wrapper = document.createElement('div')
      wrapper.className = 'mention-popup'
      
      items.forEach((item, index) => {
        const itemEl = document.createElement('div')
        itemEl.className = `mention-item ${index === selectedIndex ? 'selected' : ''}`
        
        const avatarLetter = (item.label[0] || '').toUpperCase()
        
        itemEl.innerHTML = `
          <div class="mention-item-avatar">${avatarLetter}</div>
          <div class="mention-item-info">
            <div class="mention-item-name">${item.label}</div>
          </div>
        `
        
        itemEl.addEventListener('click', () => command(item))
        wrapper.appendChild(itemEl)
      })
      
      if (!this.mentionPopup) {
        this.mentionPopup = tippy('body', {
          getReferenceClientRect: props.clientRect,
          appendTo: () => document.body,
          content: wrapper,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
        })[0]
      } else {
        this.mentionPopup.setProps({
          getReferenceClientRect: props.clientRect,
          content: wrapper
        })
      }
      
      return this.mentionPopup
    },

    updateMentionPopup(props) {
      if (this.mentionPopup) {
        this.mentionPopup.setProps({
          getReferenceClientRect: props.clientRect,
          content: this.renderPopup(props)
        })
      }
    },

    destroyMentionPopup() {
      if (this.mentionPopup) {
        this.mentionPopup.destroy()
        this.mentionPopup = null
      }
    },

    insertTable() {
      this.showTableDialog = true
    },

    createTable() {
      this.editor
        .chain()
        .focus()
        .insertTable({ 
          rows: this.tableForm.rows, 
          cols: this.tableForm.columns, 
          withHeaderRow: true 
        })
        .run()
      
      this.showTableDialog = false
    },
    addRowAfter() {
    this.editor.chain().focus().addRowAfter().run();
    },
    addColumnAfter() {
      this.editor.chain().focus().addColumnAfter().run();
    },
    deleteRow() {
      this.editor.chain().focus().deleteRow().run();
    },
    deleteColumn() {
      this.editor.chain().focus().deleteColumn().run();
    },
  }
}
</script>

<style lang="scss" scoped>
.editor {
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  background: white;
  
  .editor-toolbar {
    padding: 4px;
    border-bottom: 1px solid rgb(160 207 255 / 15%);
    background: rgb(160 207 255 / 15%);
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 2px;
  }

  .toolbar-group {
    display: flex;
    align-items: center;
    background: transparent;
    border-radius: 2px;
    padding: 1px;
    gap: 1px;

    &:not(:last-child) {
      margin-right: 2px;
    }
  }
}

:deep(.editor-toolbar .el-button) {
  height: 24px;
  width: 24px;
  padding: 2px;
  border: none;
  border-radius: 2px;
  margin: 0;
  background: transparent;

  .el-icon {
    font-size: 14px;
    color: #444;
  }

  &:hover {
    background-color: rgba(0, 0, 0, 0.1);
    color: #222;
    
    .el-icon {
      color: #222;
    }
  }

  &.is-active {
    background-color: rgba(0, 0, 0, 0.15);
    color: #000;
    
    .el-icon {
      color: #000;
    }
  }
}

.toolbar-separator {
  width: 1px;
  height: 16px;
  background-color: #ddd;
  margin: 0 2px;
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
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 25px;
  background: #f0ecec;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 4px;
  opacity: 1;
  width: 400px;
  left: 20px;
  
  &::before {
    content: '';
    position: absolute;
    top: -8px;
    left: var(--cap-left, 20px);
    width: 0;
    height: 0;
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    border-bottom: 8px solid #f0ecec;
    transform: translateX(-50%);
  }
  
  &::after {
    content: '';
    position: absolute;
    top: -9px;
    left: var(--cap-left, 20px);
    width: 0;
    height: 0;
    border-left: 9px solid transparent;
    border-right: 9px solid transparent;
    border-bottom: 9px solid rgba(0, 0, 0, 0.1);
    transform: translateX(-50%);
    z-index: -1;
  }
  
  .suggestion-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 300px;
    overflow-y: auto;
    width: 100%;
    pointer-events: auto;
    
    &::-webkit-scrollbar {
      width: 6px;
    }
    
    &::-webkit-scrollbar-track {
      background: var(--el-fill-color-lighter);
      border-radius: 3px;
    }
    
    &::-webkit-scrollbar-thumb {
      background: var(--el-border-color);
      border-radius: 3px;
    }
  }

  .suggestion-item {
    color: var(--el-text-color-regular);
    font-family: monospace;
    white-space: pre-wrap;
    padding: 2px 8px;
    border-radius: 2px;
    cursor: pointer;
    width: 100%;
    overflow-wrap: break-word;
    pointer-events: auto;
    
    &.selected {
      background: var(--el-color-primary-light-9);
      color: var(--el-color-primary);
    }
  }
  
  .suggestion-controls {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-top: 1px solid var(--el-border-color-lighter);
    width: 100%;
    background: var(--el-fill-color-lighter);
    border-radius: 0 0 4px 4px;
    
    .controls-left,
    .controls-right {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    kbd {
      background: var(--el-fill-color-light);
      border: 1px solid var(--el-border-color);
      border-radius: 3px;
      padding: 1px 4px;
      font-size: 11px;
      line-height: 1;
      cursor: pointer;
      
      &:hover {
        background: var(--el-fill-color);
      }
    }
  }
}

.suggestion-controls {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border-top: 1px solid var(--el-border-color-lighter);
  width: 100%;
  background: var(--el-fill-color-lighter);
  border-radius: 0 0 4px 4px;
  
  kbd {
    background: var(--el-fill-color-light);
    border: 1px solid var(--el-border-color);
    border-radius: 3px;
    padding: 1px 4px;
    font-size: 11px;
    line-height: 1;
  }
}

.mention-popup {
  padding: 0.2em;
  background: white;
  border-radius: 4px;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.05), 0px 10px 20px rgba(0, 0, 0, 0.1);
  
  .mention-item {
    display: flex;
    align-items: center;
    padding: 0.5em;
    cursor: pointer;
    border-radius: 4px;
    color: var(--el-text-color-primary);
    
    &:hover, &.selected {
      background: #edf2fc;
      color: var(--el-color-primary);
    }
    
    .mention-item-avatar {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: #409eff;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 8px;
      font-size: 12px;
    }
    
    .mention-item-info {
      .mention-item-name {
        font-weight: 500;
      }
    }
  }
}

.mention-item {
  &:hover, &.selected {
    background: var(--el-color-primary-light-9);
  }
}

.mention-item-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--el-color-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.mention-item-info {
  flex: 1;
}

.mention-item-name {
  font-weight: 500;
  font-size: 14px;
}

.editor {
  :deep(.ProseMirror) {
    min-height: 200px;
    padding: 2px 5px;
    outline: none;
    line-height: 1.6;
    font-size: 15px;
    color: var(--el-text-color-primary);
    
    p {
      margin: 0.5em 0;
    }
    
    &:focus {
      outline: none;
    }

    // Placeholder styling
    p.is-editor-empty:first-child::before {
      content: attr(data-placeholder);
      float: left;
      color: var(--el-text-color-placeholder);
      pointer-events: none;
      height: 0;
      font-style: italic;
    }

    // Headings
    h1, h2, h3 {
      margin: 1.5em 0 0.5em;
      line-height: 1.3;
      font-weight: 600;
      position: relative;
      margin-left: 20px;
      
      &::before {
        content: '⌄';
        position: absolute;
        left: -20px;
        color: lightgray;
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.2s;
      }
      
      &:hover::before {
        opacity: 1;
      }
      
      &[data-collapsed]::before {
        content: '>';
        transform: rotate(0);
      }
      
      &[data-collapsed] + * {
        display: none;
      }
      
      &[data-collapsed] ~ *:not(h1):not(h2):not(h3) {
        display: none;
      }
    }

    // Lists
    ul[data-type="taskList"] {
      list-style: none;
      padding: 0;

      li {
        display: flex;
        gap: 0.75rem;
        margin: 0.5em 0;
        align-items: flex-start;
        
        > label {
          margin-right: 0.5rem;
          margin-top: 0.25rem;
        }

        > div {
          flex: 1;
        }
      }
    }

    // Blockquotes
    blockquote {
      border-left: 4px solid var(--el-color-primary-light-5);
      margin: 1em 0;
      padding: 0.5em 0 0.5em 1em;
      background: var(--el-color-primary-light-9);
      border-radius: 0 4px 4px 0;
      color: var(--el-text-color-regular);
      font-style: italic;
    }

    // Code blocks
    code {
      background-color: var(--el-fill-color-light);
      padding: 0.2em 0.4em;
      border-radius: 4px;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
      font-size: 0.9em;
    }

    // Table styles.
    table {
      border-collapse: collapse;
      margin: 1em 0;
      width: 100%;
      table-layout: fixed;

      td, th {
        border: 2px solid var(--el-border-color);
        padding: 8px;
        position: relative;
        min-width: 100px;
        
        > * {
          margin: 0;
        }
      }

      th {
        background: var(--el-fill-color-light);
        font-weight: bold;
      }
    }

    .selectedCell {
      background: var(--el-color-primary-light-9);
    }

    a {
      color: var(--el-color-primary);
      text-decoration: none;
      cursor: pointer;
      
      &:hover {
        text-decoration: underline;
      }
    }

    li {
      position: relative;
    }

    li::before {
      content: '';
      position: absolute;
      left: -20px;
      top: 8px;
      width: 16px;
      height: 16px;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.2s ease;
    }

    li:hover::before {
      opacity: 1;
    }

    li:has(> ul, > ol)::before {
      content: '⌄';
      color: lightgray;
      font-size: 16px;
      transform: scaleX(1.5);
      left: -30px;
      top: -4px;
    }

    li[data-collapsed="true"]::before,
    li.collapsed::before {
      content: '>';
      color: lightgray;
      font-size: 13px;
      transform: scale(1.2);
      left: -27px;
      top: 2px;
    }

    li[data-collapsed="true"] > ul,
    li[data-collapsed="true"] > ol,
    li.collapsed > ul,
    li.collapsed > ol {
      display: none;
    }

    li > ul,
    li > ol {
      border-left: 1px solid var(--el-border-color);
    }
    
    /* Adjust spacing for ordered lists */
   /* ol > li::before {
      left: -30px;
      top: -4px;
    }*/
  }
}

.ProseMirror {
  .editor-link {
    color: var(--el-color-primary);
    text-decoration: underline;
    cursor: pointer;
    
    &:hover {
      color: var(--el-color-primary-light-3);
    }
  }
}

.file-link {
  color: var(--el-color-primary);
  text-decoration: none;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--el-color-primary-light-9);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  
  &:hover {
    background: var(--el-color-primary-light-8);
    text-decoration: none;
    transform: translateY(-1px);
  }

  &::before {
    content: '📎';
    font-size: 14px;
  }
}
</style> 

<style>
.editor .dialog-footer .el-button,
.editor .el-dialog__footer .el-button {
    display: inline-block;
    padding: 8px 15px;
    width: auto;
}
.el-breadcrumb {
    margin-bottom: 7px;
}
.mention-item:hover .mention-item-name, .mention-item.selected .mention-item-name {
    color: #444;
}
.format-text {
  font-family: Times New Roman, serif;
  font-weight: bold;
  font-size: 15px;
  line-height: 1;
}

/* Table icon CSS classes */
.table-icon-add-row,
.table-icon-add-column,
.table-icon-delete-row,
.table-icon-delete-column {
  width: 12px;
  height: 12px;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
}

.table-icon-add-row {
  background-image: url("data:image/svg+xml,%3Csvg width='16' height='16' viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='1' y='1' width='4' height='4' fill='%23ccc' stroke='%23999' stroke-width='0.5'/%3E%3Crect x='6' y='1' width='4' height='4' fill='%23ccc' stroke='%23999' stroke-width='0.5'/%3E%3Crect x='11' y='1' width='4' height='4' fill='%23ccc' stroke='%23999' stroke-width='0.5'/%3E%3Crect x='1' y='6' width='4' height='4' fill='%23ccc' stroke='%23999' stroke-width='0.5'/%3E%3Crect x='6' y='6' width='4' height='4' fill='%23ccc' stroke='%23999' stroke-width='0.5'/%3E%3Crect x='11' y='6' width='4' height='4' fill='%23ccc' stroke='%23999' stroke-width='0.5'/%3E%3Crect x='1' y='11' width='4' height='4' fill='%2367c23a' stroke='%2367c23a' stroke-width='0.5'/%3E%3Crect x='6' y='11' width='4' height='4' fill='%2367c23a' stroke='%2367c23a' stroke-width='0.5'/%3E%3Crect x='11' y='11' width='4' height='4' fill='%2367c23a' stroke='%2367c23a' stroke-width='0.5'/%3E%3C/svg%3E");
}

.table-icon-add-column {
  background-image: url("data:image/svg+xml,%3Csvg width='16' height='16' viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='1' y='1' width='4' height='4' fill='%23ccc' stroke='%23999' stroke-width='0.5'/%3E%3Crect x='1' y='6' width='4' height='4' fill='%23ccc' stroke='%23999' stroke-width='0.5'/%3E%3Crect x='1' y='11' width='4' height='4' fill='%23ccc' stroke='%23999' stroke-width='0.5'/%3E%3Crect x='6' y='1' width='4' height='4' fill='%23ccc' stroke='%23999' stroke-width='0.5'/%3E%3Crect x='6' y='6' width='4' height='4' fill='%23ccc' stroke='%23999' stroke-width='0.5'/%3E%3Crect x='6' y='11' width='4' height='4' fill='%23ccc' stroke='%23999' stroke-width='0.5'/%3E%3Crect x='11' y='1' width='4' height='4' fill='%2367c23a' stroke='%2367c23a' stroke-width='0.5'/%3E%3Crect x='11' y='6' width='4' height='4' fill='%2367c23a' stroke='%2367c23a' stroke-width='0.5'/%3E%3Crect x='11' y='11' width='4' height='4' fill='%2367c23a' stroke='%2367c23a' stroke-width='0.5'/%3E%3C/svg%3E");
}

.table-icon-delete-row {
  background-image: url("data:image/svg+xml,%3Csvg width='16' height='16' viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='1' y='1' width='4' height='4' fill='%23ccc' stroke='%23999' stroke-width='0.5'/%3E%3Crect x='6' y='1' width='4' height='4' fill='%23ccc' stroke='%23999' stroke-width='0.5'/%3E%3Crect x='11' y='1' width='4' height='4' fill='%23ccc' stroke='%23999' stroke-width='0.5'/%3E%3Crect x='1' y='6' width='4' height='4' fill='%23ccc' stroke='%23999' stroke-width='0.5'/%3E%3Crect x='6' y='6' width='4' height='4' fill='%23ccc' stroke='%23999' stroke-width='0.5'/%3E%3Crect x='11' y='6' width='4' height='4' fill='%23ccc' stroke='%23999' stroke-width='0.5'/%3E%3Crect x='1' y='11' width='4' height='4' fill='%23f56c6c' stroke='%23f56c6c' stroke-width='0.5'/%3E%3Crect x='6' y='11' width='4' height='4' fill='%23f56c6c' stroke='%23f56c6c' stroke-width='0.5'/%3E%3Crect x='11' y='11' width='4' height='4' fill='%23f56c6c' stroke='%23f56c6c' stroke-width='0.5'/%3E%3C/svg%3E");
}

.table-icon-delete-column {
  background-image: url("data:image/svg+xml,%3Csvg width='16' height='16' viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='1' y='1' width='4' height='4' fill='%23ccc' stroke='%23999' stroke-width='0.5'/%3E%3Crect x='1' y='6' width='4' height='4' fill='%23ccc' stroke='%23999' stroke-width='0.5'/%3E%3Crect x='1' y='11' width='4' height='4' fill='%23ccc' stroke='%23999' stroke-width='0.5'/%3E%3Crect x='6' y='1' width='4' height='4' fill='%23ccc' stroke='%23999' stroke-width='0.5'/%3E%3Crect x='6' y='6' width='4' height='4' fill='%23ccc' stroke='%23999' stroke-width='0.5'/%3E%3Crect x='6' y='11' width='4' height='4' fill='%23ccc' stroke='%23999' stroke-width='0.5'/%3E%3Crect x='11' y='1' width='4' height='4' fill='%23f56c6c' stroke='%23f56c6c' stroke-width='0.5'/%3E%3Crect x='11' y='6' width='4' height='4' fill='%23f56c6c' stroke='%23f56c6c' stroke-width='0.5'/%3E%3Crect x='11' y='11' width='4' height='4' fill='%23f56c6c' stroke='%23f56c6c' stroke-width='0.5'/%3E%3C/svg%3E");
}
</style>