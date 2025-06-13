<script>
export default {
  name: 'EditableTable',
  props: {
    modelValue: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      tableData: [],
      headers: []
    }
  },
  created() {
    this.parseMarkdownTable(this.modelValue)
  },
  methods: {
    parseMarkdownTable(markdown) {
      const lines = markdown.trim().split('\n')
      const headerRow = lines[0]
      
      // Parse headers
      this.headers = headerRow
        .split('|')
        .filter(cell => cell.trim())
        .map(cell => cell.trim())
      
      // Parse data rows (skip header and separator rows)
      this.tableData = lines
        .slice(2)
        .filter(line => line.trim() && !line.includes('---'))
        .map(line => {
          const cells = line
            .split('|')
            .filter(cell => cell.trim())
            .map(cell => cell.trim())
          return cells
        })
    },
    
    generateMarkdownTable() {
      const headerRow = `|${this.headers.join('|')}|`
      const separatorRow = `|${this.headers.map(() => '-------').join('|')}|`
      const dataRows = this.tableData.map(row => `|${row.join('|')}|`).join('\n')
      
      return `${headerRow}\n${separatorRow}\n${dataRows}`
    },
    
    updateCell(rowIndex, colIndex, value) {
      if (rowIndex === -1) {
        // Update header
        this.headers[colIndex] = value
      } else {
        // Update data cell
        this.tableData[rowIndex][colIndex] = value
      }
      this.$emit('update:modelValue', this.generateMarkdownTable())
    },
    
    addRow() {
      this.tableData.push(Array(this.headers.length).fill(''))
      this.$emit('update:modelValue', this.generateMarkdownTable())
    },
    
    removeRow(index) {
      this.tableData.splice(index, 1)
      this.$emit('update:modelValue', this.generateMarkdownTable())
    },
    
    addColumn() {
      this.headers.push('')
      this.tableData.forEach(row => row.push(''))
      this.$emit('update:modelValue', this.generateMarkdownTable())
    },
    
    removeColumn(index) {
      this.headers.splice(index, 1)
      this.tableData.forEach(row => row.splice(index, 1))
      this.$emit('update:modelValue', this.generateMarkdownTable())
    }
  }
}
</script>

<template>
  <div class="editable-table">
    <div class="table-controls">
      <el-button size="small" @click="addRow">Add Row</el-button>
      <el-button size="small" @click="addColumn">Add Column</el-button>
    </div>
    
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th v-for="(header, index) in headers" :key="'header-' + index">
              <el-input
                v-model="headers[index]"
                @input="updateCell(-1, index, $event)"
                size="small"
              />
              <el-button 
                type="text" 
                @click="removeColumn(index)"
                class="remove-btn"
              >×</el-button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, rowIndex) in tableData" :key="'row-' + rowIndex">
            <td v-for="(cell, colIndex) in row" :key="'cell-' + rowIndex + '-' + colIndex">
              <el-input
                v-model="tableData[rowIndex][colIndex]"
                @input="updateCell(rowIndex, colIndex, $event)"
                size="small"
              />
            </td>
            <td class="actions">
              <el-button 
                type="text" 
                @click="removeRow(rowIndex)"
                class="remove-btn"
              >×</el-button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.editable-table {
  margin: 1rem 0;
}

.table-controls {
  margin-bottom: 1rem;
  display: flex;
  gap: 8px;
}

.table-wrapper {
  overflow-x: auto;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  padding: 8px;
  border: 1px solid #dcdfe6;
  position: relative;
}

.remove-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  padding: 2px 4px;
  color: #f56c6c;
}

.remove-btn:hover {
  background: rgba(245, 108, 108, 0.1);
  border-radius: 4px;
}

.actions {
  border: none;
  width: 40px;
}
</style>