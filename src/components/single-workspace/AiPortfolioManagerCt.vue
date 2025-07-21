<template>
  <div class="ai-portfolio-manager">
    <div class="header">
      <h2>AI Portfolio Manager</h2>
      <div class="header-actions">
        <el-button type="info" @click="savePortfolio" :loading="saving" :icon="Check">
          {{ saving ? 'Saving...' : 'Save Portfolio' }}
        </el-button>
      </div>
    </div>

    <div class="portfolio-content" v-loading="loading">
      <div v-if="!loading && portfolioData.length === 0 && columns.length === 0" class="empty-state">
        <el-empty description="No portfolio data yet">
          <el-button type="primary" @click="initializePortfolio">Create First Portfolio</el-button>
        </el-empty>
      </div>

      <div v-else-if="columns.length > 0" class="spreadsheet-wrapper">
        <div class="spreadsheet-container">
          <!-- Spreadsheet Header -->
          <div class="spreadsheet-header">
            <!-- Empty corner cell -->
            <div class="corner-cell"></div>
            <!-- Column headers -->
            <div 
              v-for="(column, index) in columns" 
              :key="column.key"
              class="column-header-cell"
              @contextmenu.prevent="showColumnMenu($event, column.key)"
            >
              <input 
                v-model="column.label"
                class="column-header-input"
                @blur="savePortfolio"
                @keyup.enter="savePortfolio"
                :placeholder="`Column ${getColumnLetter(index)}`"
              />
              <button 
                v-if="columns.length > 1"
                class="delete-column-btn"
                @click="removeColumn(column.key)"
                title="Delete column"
              >
                ×
              </button>
            </div>
            <!-- Add column button -->
            <div class="add-column-cell" @click="addColumn">
              <Plus class="add-icon" />
            </div>
          </div>

          <!-- Spreadsheet Body -->
          <div class="spreadsheet-body">
            <div 
              v-for="(row, rowIndex) in portfolioData" 
              :key="rowIndex"
              class="spreadsheet-row"
            >
              <!-- Row number -->
              <div class="row-number-cell">
                {{ rowIndex + 1 }}
                <button 
                  class="delete-row-btn"
                  @click="removeRow(rowIndex)"
                  title="Delete row"
                >
                  ×
                </button>
              </div>
              <!-- Data cells -->
              <div 
                v-for="column in columns"
                :key="column.key"
                class="data-cell"
                @click="selectCell(rowIndex, column.key)"
                :class="{ 'selected': selectedCell?.row === rowIndex && selectedCell?.column === column.key }"
              >
                <input
                  v-model="row[column.key]"
                  class="cell-input"
                  @focus="selectCell(rowIndex, column.key)"
                  @blur="savePortfolio"
                  @keyup.enter="savePortfolio"
                  @keydown="handleCellKeydown($event, rowIndex, column.key)"
                  :ref="el => setCellRef(el, rowIndex, column.key)"
                />
              </div>
            </div>
            <!-- Add row button -->
            <div class="add-row-container">
              <div class="add-row-cell" @click="addRow">
                <Plus class="add-icon" />
                <span>Add Row</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Column Dialog -->
    <el-dialog
      v-model="addColumnDialogVisible"
      title="Add New Column"
      width="400px"
    >
      <el-form :model="newColumn" label-width="120px">
        <el-form-item label="Column Name" required>
          <el-input v-model="newColumn.label" placeholder="Enter column name" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addColumnDialogVisible = false">Cancel</el-button>
        <el-button type="primary" @click="confirmAddColumn" :disabled="!newColumn.label">
          Add Column
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue';
import { Plus, Document, Delete, Check } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { supabase } from '../../supabase.js';
import { useMatterStore } from '../../store/matter';
import { storeToRefs } from 'pinia';

export default {
  name: 'AiPortfolioManagerCt',
  components: {
    Plus,
    Document,
    Delete,
    Check
  },
  setup() {
    const matterStore = useMatterStore();
    const { currentMatter } = storeToRefs(matterStore);

    const loading = ref(false);
    const saving = ref(false);
    const portfolioData = ref([]);
    const columns = ref([]);
    const addColumnDialogVisible = ref(false);
    const selectedCell = ref(null);
    const cellRefs = ref(new Map());
    const newColumn = reactive({
      label: ''
    });

    const initializePortfolio = async () => {
      // Create default columns
      columns.value = [
        { key: 'item', label: 'Portfolio Item' },
        { key: 'value', label: 'Value' },
        { key: 'status', label: 'Status' }
      ];
      
      // Add first row
      portfolioData.value = [
        { item: '', value: '', status: '' }
      ];
      
      await savePortfolio();
    };

    const addRow = () => {
      const newRow = {};
      columns.value.forEach(column => {
        newRow[column.key] = '';
      });
      portfolioData.value.push(newRow);
    };

    const removeRow = async (index) => {
      try {
        await ElMessageBox.confirm('Are you sure you want to delete this row?', 'Confirm', {
          type: 'warning'
        });
        portfolioData.value.splice(index, 1);
        await savePortfolio();
      } catch {
        // User cancelled
      }
    };

    const addColumn = () => {
      newColumn.label = '';
      addColumnDialogVisible.value = true;
    };

    const confirmAddColumn = () => {
      if (!newColumn.label.trim()) return;
      
      const columnKey = newColumn.label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      const newCol = {
        key: columnKey,
        label: newColumn.label.trim()
      };
      
      columns.value.push(newCol);
      
      // Add empty values for this column to all existing rows
      portfolioData.value.forEach(row => {
        row[columnKey] = '';
      });
      
      addColumnDialogVisible.value = false;
      savePortfolio();
    };

    const removeColumn = async (columnKey) => {
      try {
        await ElMessageBox.confirm('Are you sure you want to delete this column?', 'Confirm', {
          type: 'warning'
        });
        
        // Remove column from columns array
        columns.value = columns.value.filter(col => col.key !== columnKey);
        
        // Remove column data from all rows
        portfolioData.value.forEach(row => {
          delete row[columnKey];
        });
        
        await savePortfolio();
      } catch {
        // User cancelled
      }
    };

    const loadPortfolio = async () => {
      if (!currentMatter.value?.id) return;
      
      loading.value = true;
      try {
        const { data, error } = await supabase
          .from('portfolio_data')
          .select('*')
          .eq('matter_id', currentMatter.value.id)
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
          throw error;
        }

        if (data) {
          columns.value = data.columns || [];
          portfolioData.value = data.data || [];
        }
      } catch (error) {
        console.error('Error loading portfolio:', error);
        ElMessage.error('Failed to load portfolio data');
      } finally {
        loading.value = false;
      }
    };

    const savePortfolio = async () => {
      if (!currentMatter.value?.id) return;
      
      saving.value = true;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        const portfolioRecord = {
          matter_id: currentMatter.value.id,
          columns: columns.value,
          data: portfolioData.value,
          created_by: user.id,
          updated_by: user.id
        };

        const { error } = await supabase
          .from('portfolio_data')
          .upsert(portfolioRecord, {
            onConflict: 'matter_id'
          });

        if (error) throw error;
        
        ElMessage.success('Portfolio saved successfully!');
      } catch (error) {
        console.error('Error saving portfolio:', error);
        ElMessage.error('Failed to save portfolio data');
      } finally {
        saving.value = false;
      }
    };

    // Google Sheets-like functionality
    const getColumnLetter = (index) => {
      let result = '';
      while (index >= 0) {
        result = String.fromCharCode(65 + (index % 26)) + result;
        index = Math.floor(index / 26) - 1;
      }
      return result;
    };

    const selectCell = (rowIndex, columnKey) => {
      selectedCell.value = { row: rowIndex, column: columnKey };
    };

    const setCellRef = (el, rowIndex, columnKey) => {
      if (el) {
        cellRefs.value.set(`${rowIndex}-${columnKey}`, el);
      }
    };

    const handleCellKeydown = (event, rowIndex, columnKey) => {
      const currentColumnIndex = columns.value.findIndex(col => col.key === columnKey);
      
      switch (event.key) {
        case 'ArrowUp':
          if (rowIndex > 0) {
            event.preventDefault();
            const upCell = cellRefs.value.get(`${rowIndex - 1}-${columnKey}`);
            if (upCell) upCell.focus();
          }
          break;
        case 'ArrowDown':
          if (rowIndex < portfolioData.value.length - 1) {
            event.preventDefault();
            const downCell = cellRefs.value.get(`${rowIndex + 1}-${columnKey}`);
            if (downCell) downCell.focus();
          }
          break;
        case 'ArrowLeft':
          if (currentColumnIndex > 0) {
            event.preventDefault();
            const leftColumnKey = columns.value[currentColumnIndex - 1].key;
            const leftCell = cellRefs.value.get(`${rowIndex}-${leftColumnKey}`);
            if (leftCell) leftCell.focus();
          }
          break;
        case 'ArrowRight':
          if (currentColumnIndex < columns.value.length - 1) {
            event.preventDefault();
            const rightColumnKey = columns.value[currentColumnIndex + 1].key;
            const rightCell = cellRefs.value.get(`${rowIndex}-${rightColumnKey}`);
            if (rightCell) rightCell.focus();
          }
          break;
        case 'Tab':
          event.preventDefault();
          if (event.shiftKey) {
            // Move left
            if (currentColumnIndex > 0) {
              const leftColumnKey = columns.value[currentColumnIndex - 1].key;
              const leftCell = cellRefs.value.get(`${rowIndex}-${leftColumnKey}`);
              if (leftCell) leftCell.focus();
            }
          } else {
            // Move right
            if (currentColumnIndex < columns.value.length - 1) {
              const rightColumnKey = columns.value[currentColumnIndex + 1].key;
              const rightCell = cellRefs.value.get(`${rowIndex}-${rightColumnKey}`);
              if (rightCell) rightCell.focus();
            }
          }
          break;
        case 'Enter':
          event.preventDefault();
          if (rowIndex < portfolioData.value.length - 1) {
            const downCell = cellRefs.value.get(`${rowIndex + 1}-${columnKey}`);
            if (downCell) downCell.focus();
          }
          savePortfolio();
          break;
      }
    };

    const showColumnMenu = (event, columnKey) => {
      // Future: Add context menu functionality
      console.log('Column menu for:', columnKey);
    };

    onMounted(() => {
      loadPortfolio();
    });

    return {
      loading,
      saving,
      portfolioData,
      columns,
      addColumnDialogVisible,
      selectedCell,
      newColumn,
      initializePortfolio,
      addRow,
      removeRow,
      addColumn,
      confirmAddColumn,
      removeColumn,
      savePortfolio,
      getColumnLetter,
      selectCell,
      setCellRef,
      handleCellKeydown,
      showColumnMenu
    };
  }
};
</script>

<style scoped>
.ai-portfolio-manager {
  padding: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: white;
  border-bottom: 1px solid #e0e0e0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  z-index: 10;
}

.header h2 {
  margin: 0;
  color: #202124;
  font-size: 22px;
  font-weight: 400;
  font-family: 'Google Sans', 'Roboto', Arial, sans-serif;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.portfolio-content {
  flex: 1;
  overflow: hidden;
  background: #fafafa;
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  background: white;
}

.spreadsheet-wrapper {
  height: 100%;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  margin: 16px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}

.spreadsheet-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  font-family: 'Roboto', Arial, sans-serif;
  font-size: 13px;
}

/* Spreadsheet Header */
.spreadsheet-header {
  display: flex;
  background: #f8f9fa;
  border-bottom: 1px solid #e0e0e0;
  position: sticky;
  top: 0;
  z-index: 5;
}

.corner-cell {
  width: 60px;
  height: 40px;
  background: #f8f9fa;
  border-right: 1px solid #e0e0e0;
  border-bottom: 1px solid #e0e0e0;
}

.column-header-cell {
  min-width: 120px;
  width: 120px;
  height: 40px;
  background: #f8f9fa;
  border-right: 1px solid #e0e0e0;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  cursor: pointer;
}

.column-header-cell:hover {
  background: #f1f3f4;
}

.column-header-input {
  width: 100%;
  height: 100%;
  border: none;
  background: transparent;
  text-align: center;
  font-size: 12px;
  font-weight: 500;
  color: #3c4043;
  outline: none;
  padding: 0 8px;
}

.column-header-input:focus {
  background: white;
  border: 2px solid #1a73e8;
  border-radius: 2px;
}

.delete-column-btn {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 16px;
  height: 16px;
  border: none;
  background: #ea4335;
  color: white;
  border-radius: 50%;
  font-size: 10px;
  cursor: pointer;
  display: none;
}

.column-header-cell:hover .delete-column-btn {
  display: block;
}

.add-column-cell {
  width: 60px;
  height: 40px;
  background: #f8f9fa;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #5f6368;
}

.add-column-cell:hover {
  background: #f1f3f4;
}

/* Spreadsheet Body */
.spreadsheet-body {
  flex: 1;
  overflow: auto;
}

.spreadsheet-row {
  display: flex;
  min-height: 32px;
}

.row-number-cell {
  width: 60px;
  min-height: 32px;
  background: #f8f9fa;
  border-right: 1px solid #e0e0e0;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 500;
  color: #3c4043;
  position: relative;
  cursor: pointer;
}

.row-number-cell:hover {
  background: #f1f3f4;
}

.delete-row-btn {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 14px;
  height: 14px;
  border: none;
  background: #ea4335;
  color: white;
  border-radius: 50%;
  font-size: 8px;
  cursor: pointer;
  display: none;
}

.row-number-cell:hover .delete-row-btn {
  display: block;
}

.data-cell {
  min-width: 120px;
  width: 120px;
  min-height: 32px;
  border-right: 1px solid #e0e0e0;
  border-bottom: 1px solid #e0e0e0;
  position: relative;
  background: white;
}

.data-cell:hover {
  background: #f8f9fa;
}

.data-cell.selected {
  background: #e8f0fe;
  border: 2px solid #1a73e8;
}

.cell-input {
  width: 100%;
  height: 100%;
  border: none;
  background: transparent;
  padding: 6px 8px;
  font-size: 13px;
  color: #202124;
  outline: none;
  resize: none;
  line-height: 20px;
}

.cell-input:focus {
  background: white;
  border: 2px solid #1a73e8;
  border-radius: 2px;
  z-index: 2;
  position: relative;
}

/* Add Row Button */
.add-row-container {
  display: flex;
  border-bottom: 1px solid #e0e0e0;
}

.add-row-cell {
  width: 100%;
  height: 40px;
  background: #f8f9fa;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #5f6368;
  gap: 8px;
  font-size: 13px;
}

.add-row-cell:hover {
  background: #f1f3f4;
}

.add-icon {
  width: 16px;
  height: 16px;
}

/* Scrollbars */
.spreadsheet-body::-webkit-scrollbar {
  width: 12px;
  height: 12px;
}

.spreadsheet-body::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.spreadsheet-body::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 6px;
}

.spreadsheet-body::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

.spreadsheet-body::-webkit-scrollbar-corner {
  background: #f1f1f1;
}

/* Mobile Responsive */
@media (max-width: 768px) {
  .header {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
    padding: 12px 16px;
  }

  .header-actions {
    justify-content: center;
  }

  .spreadsheet-wrapper {
    margin: 8px;
    border-radius: 4px;
  }

  .corner-cell,
  .row-number-cell {
    width: 40px;
  }

  .column-header-cell,
  .data-cell {
    min-width: 100px;
    width: 100px;
  }

  .spreadsheet-body {
    font-size: 12px;
  }

  .cell-input {
    font-size: 12px;
    padding: 4px 6px;
  }
}

/* Selection and focus styles */
.data-cell::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border: 2px solid transparent;
  pointer-events: none;
}

.data-cell.selected::before {
  border-color: #1a73e8;
}

/* Animation for smooth interactions */
.data-cell,
.column-header-cell,
.row-number-cell {
  transition: background-color 0.1s ease;
}

.delete-column-btn,
.delete-row-btn {
  transition: opacity 0.2s ease;
}
</style> 