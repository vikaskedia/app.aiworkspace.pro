<template>
  <div class="rich-text-editor">
    <div class="editor-toolbar">
      <!-- File Operations -->
      <el-button-group class="toolbar-group">
        <el-button size="small" title="Undo" @click="execCommand('undo')">
          <i class="el-icon-refresh-left">↶</i>
        </el-button>
        <el-button size="small" title="Redo" @click="execCommand('redo')">
          <i class="el-icon-refresh-right">↷</i>
        </el-button>
        <el-button size="small" title="Copy" @click="handleCopy">
          <i class="el-icon-document-copy">⎘</i>
        </el-button>
      </el-button-group>

      <!-- Text Formatting -->
      <el-button-group class="toolbar-group">
        <el-select v-model="fontFamily" size="small" placeholder="Font">
          <el-option label="Arial" value="Arial" />
          <el-option label="Times New Roman" value="Times New Roman" />
          <el-option label="Helvetica" value="Helvetica" />
        </el-select>
        
        <el-select v-model="fontSize" size="small" style="width: 90px">
          <el-option v-for="size in fontSizes" 
            :key="size" :label="`${size}px`" :value="size" />
        </el-select>
      </el-button-group>

      <!-- Text Style -->
      <el-button-group class="toolbar-group">
        <el-button 
          @click="execCommand('bold')"
          :class="{ 'is-active': isActive('bold') }"
          size="small" title="Bold">
          <i class="el-icon-bold">B</i>
        </el-button>
        <el-button 
          @click="execCommand('italic')"
          :class="{ 'is-active': isActive('italic') }"
          size="small" title="Italic">
          <i class="el-icon-italic">I</i>
        </el-button>
        <el-button 
          @click="execCommand('underline')"
          :class="{ 'is-active': isActive('underline') }"
          size="small" title="Underline">
          <i class="el-icon-underline">U</i>
        </el-button>
      </el-button-group>

      <!-- Insert Options -->
      <el-button-group class="toolbar-group">
        <el-button size="small" title="Insert Link" @click="handleInsertLink">
          <i class="el-icon-link">🔗</i>
        </el-button>
        <el-button size="small" title="Insert Image" @click="handleInsertImage">
          <i class="el-icon-picture">🖼</i>
        </el-button>
        <el-button size="small" title="Insert Table" @click="handleInsertTable">
          <i class="el-icon-table">⊞</i>
        </el-button>
      </el-button-group>
    </div>

    <div
      ref="editor"
      class="editor-content"
      contenteditable="true"
      @input="handleInput"
      @paste="handlePaste"
      :placeholder="placeholder"
    />

    <!-- Link Dialog -->
    <el-dialog v-model="showLinkDialog" title="Insert Link" width="500px">
      <el-form :model="linkForm">
        <el-form-item label="Text to display">
          <el-input v-model="linkForm.text" />
        </el-form-item>
        <el-form-item label="URL">
          <el-input v-model="linkForm.url" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showLinkDialog = false">Cancel</el-button>
        <el-button type="primary" @click="insertLink">Insert</el-button>
      </template>
    </el-dialog>

    <!-- Image Dialog -->
    <el-dialog v-model="showImageDialog" title="Insert Image" width="500px">
      <el-form :model="imageForm">
        <el-form-item label="Image URL">
          <el-input v-model="imageForm.url" />
        </el-form-item>
        <el-form-item label="Alt Text">
          <el-input v-model="imageForm.alt" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showImageDialog = false">Cancel</el-button>
        <el-button type="primary" @click="insertImage">Insert</el-button>
      </template>
    </el-dialog>

    <!-- Table Dialog -->
    <el-dialog v-model="showTableDialog" title="Insert Table" width="500px" class="table-dialog">
      <el-form :model="tableForm">
        <el-form-item label="Rows">
          <el-input-number v-model="tableForm.rows" :min="1" :max="10" />
        </el-form-item>
        <el-form-item label="Columns">
          <el-input-number v-model="tableForm.cols" :min="1" :max="10" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showTableDialog = false">Cancel</el-button>
        <el-button type="primary" @click="insertTable">Insert</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
export default {
  name: 'RichTextEditor',
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
      fontFamily: 'Arial',
      fontSize: 14,
      fontSizes: [8,9,10,11,12,14,16,18,20,22,24,26,28,36,48,72],
      isComposing: false,
      showLinkDialog: false,
      showImageDialog: false,
      showTableDialog: false,
      linkForm: {
        text: '',
        url: ''
      },
      imageForm: {
        url: '',
        alt: ''
      },
      tableForm: {
        rows: 2,
        cols: 2
      }
    }
  },
  mounted() {
    this.$refs.editor.innerHTML = this.modelValue
    // Initialize font settings
    this.execCommand('fontName', this.fontFamily)
    this.execCommand('fontSize', this.fontSize)
  },
  methods: {
    execCommand(command, value = null) {
      document.execCommand(command, false, value)
      this.$refs.editor.focus()
      this.handleInput()
    },
    isActive(command) {
      return document.queryCommandState(command)
    },
    handleInput() {
      this.$emit('update:modelValue', this.$refs.editor.innerHTML)
    },
    handlePaste(e) {
      e.preventDefault()
      const text = e.clipboardData.getData('text/plain')
      document.execCommand('insertText', false, text)
    },
    handleCopy() {
      const selection = window.getSelection()
      const text = selection.toString()
      if (text) {
        navigator.clipboard.writeText(text)
      }
    },
    handleInsertLink() {
      const selection = window.getSelection()
      this.linkForm.text = selection.toString()
      this.showLinkDialog = true
    },
    insertLink() {
      if (this.linkForm.url) {
        const html = `<a href="${this.linkForm.url}" target="_blank">${this.linkForm.text || this.linkForm.url}</a>`
        this.execCommand('insertHTML', html)
      }
      this.showLinkDialog = false
      this.linkForm = { text: '', url: '' }
    },
    handleInsertImage() {
      this.showImageDialog = true
    },
    insertImage() {
      if (this.imageForm.url) {
        const html = `<img src="${this.imageForm.url}" alt="${this.imageForm.alt}" style="max-width: 100%;">`
        this.execCommand('insertHTML', html)
      }
      this.showImageDialog = false
      this.imageForm = { url: '', alt: '' }
    },
    handleInsertTable() {
      this.showTableDialog = true
    },
    insertTable() {
      let table = '<table border="1" style="border-collapse: collapse; width: 100%;">'
      for (let i = 0; i < this.tableForm.rows; i++) {
        table += '<tr>'
        for (let j = 0; j < this.tableForm.cols; j++) {
          const tag = i === 0 ? 'th' : 'td'
          table += `<${tag} style="padding: 8px;">Cell</${tag}>`
        }
        table += '</tr>'
      }
      table += '</table><p></p>' // Add paragraph after table for easier editing
      this.execCommand('insertHTML', table)
      this.showTableDialog = false
      this.tableForm = { rows: 2, cols: 2 }
    }
  },
  watch: {
    modelValue(newValue) {
      if (this.$refs.editor.innerHTML !== newValue) {
        this.$refs.editor.innerHTML = newValue
      }
    },
    fontFamily(newValue) {
      this.execCommand('fontName', newValue)
    },
    fontSize(newValue) {
      this.execCommand('fontSize', Math.ceil(newValue/7)) // Convert to 1-7 scale
    }
  }
}
</script>

<style scoped>
.rich-text-editor {
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
}

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

.editor-content {
  padding: 12px;
  min-height: 120px;
  outline: none;
}

.editor-content:empty:before {
  content: attr(placeholder);
  color: #909399;
}

:deep(.el-button-group) {
  display: flex;
  gap: 1px;
}

:deep(.el-button) {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
}

:deep(.el-select) {
  width: 120px;
}

.is-active {
  background-color: #ecf5ff;
  color: #409EFF;
}

/* Table styles */
:deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 8px 0;
}

:deep(th), :deep(td) {
  border: 1px solid #dcdfe6;
  padding: 8px;
}

:deep(th) {
  background-color: #f5f7fa;
}
.el-dialog.table-dialog button.el-button {
    display: inline-block;
}

.el-dialog.table-dialog .el-dialog__footer {
    padding-top: 0;
}
</style>