<template>
  <div class="portfolio-manager-wrapper">
    <!-- ✨ Enhanced AI Portfolio Manager with Multiple Spreadsheets:
         
         🎨 Rich Formatting & Styling:
         - Fonts, sizes, colors, and text styling
         - Cell backgrounds, borders, and alignments  
         - Number formatting and themes
         
         📊 Advanced Content:
         - Images, media, and drawings
         - Charts and visualizations
         - Formulas and calculations
         
         🔧 Professional Features:
         - Data validation and conditional formatting
         - Filtering, sorting, and merging
         - Multiple sheets with complete state preservation
         - All formatting and rich content saved to Supabase
         
         📊 Multiple Spreadsheets:
         - Add unlimited spreadsheets with custom names
         - Each spreadsheet has independent data and formatting
         - Individual save/load functionality per spreadsheet
         
         💾 Enhanced Save System captures ALL Univer features! -->
   
    <!-- Spreadsheet Instances -->
    <div class="spreadsheets-container" v-if="currentMatter">
      <SpreadsheetInstance
        v-for="spreadsheet in spreadsheets"
        :key="spreadsheet.id"
        :spreadsheet-id="spreadsheet.id"
        :spreadsheet-name="spreadsheet.name"
        :initial-rows="spreadsheet.rows"
        :initial-columns="spreadsheet.columns"
        :can-remove="spreadsheets.length > 1"
        :matter-id="currentMatterId"
        @remove-spreadsheet="removeSpreadsheet"
      />
    </div>
    
    <!-- Add Spreadsheet Button (at bottom) -->
    <div class="add-spreadsheet-section" v-if="spreadsheets.length > 0 && currentMatter">
      <el-button 
        type="primary" 
        @click="showAddSpreadsheetDialog"
        size="large"
        class="add-spreadsheet-btn">
        <el-icon><Plus /></el-icon>
        Add a new spreadsheet
      </el-button>
    </div>
    
    <!-- Add Spreadsheet Dialog -->
    <el-dialog
      v-model="addSpreadsheetDialogVisible"
      title="Add New Spreadsheet"
      width="400px"
      :close-on-click-modal="false">
      <el-form 
        :model="newSpreadsheetForm" 
        :rules="spreadsheetFormRules"
        ref="spreadsheetFormRef"
        label-width="120px">
        <el-form-item label="Name" prop="name">
          <el-input 
            v-model="newSpreadsheetForm.name" 
            placeholder="Enter spreadsheet name"
            :maxlength="50"
            show-word-limit
            @keyup.enter="addNewSpreadsheet" />
        </el-form-item>
        <el-form-item label="Rows" prop="rows">
          <el-input-number 
            v-model="newSpreadsheetForm.rows" 
            :min="5"
            :max="100"
            :step="5" />
        </el-form-item>
        <el-form-item label="Columns" prop="columns">
          <el-input-number 
            v-model="newSpreadsheetForm.columns" 
            :min="5"
            :max="26"
            :step="1" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="addSpreadsheetDialogVisible = false">Cancel</el-button>
          <el-button 
            type="primary" 
            @click="addNewSpreadsheet"
            :loading="addingSpreadsheet">
            Add Spreadsheet
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Folder } from '@element-plus/icons-vue';
import SpreadsheetInstance from './SpreadsheetInstance.vue';
import { supabase } from '../../supabase';
import { useMatterStore } from '../../store/matter';
import { storeToRefs } from 'pinia';

export default {
  name: 'AiPortfolioManagerCt',
  components: {
    SpreadsheetInstance,
    Plus,
    Folder
  },
  setup() {
    // Matter store for workspace context
    const matterStore = useMatterStore();
    const { currentMatter } = storeToRefs(matterStore);
    
    // Computed matter ID for workspace filtering
    const currentMatterId = computed(() => currentMatter.value?.id);
    
    // Spreadsheet management
    const spreadsheets = ref([]);
    const addSpreadsheetDialogVisible = ref(false);
    const addingSpreadsheet = ref(false);
    const spreadsheetFormRef = ref(null);
    
    // Form for adding new spreadsheet
    const newSpreadsheetForm = ref({
      name: '',
      rows: 10,
      columns: 10
    });
    
    // Form validation rules
    const spreadsheetFormRules = {
      name: [
        { required: true, message: 'Please enter a spreadsheet name', trigger: 'blur' },
        { min: 1, max: 50, message: 'Name should be 1 to 50 characters', trigger: 'blur' }
      ],
      rows: [
        { required: true, message: 'Please specify number of rows', trigger: 'blur' }
      ],
      columns: [
        { required: true, message: 'Please specify number of columns', trigger: 'blur' }
      ]
    };

    // Generate unique spreadsheet ID
    const generateSpreadsheetId = () => {
      return 'sheet_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    };
    
    // Initialize with default spreadsheet for current workspace
    const initializeDefaultSpreadsheet = async () => {
      if (!currentMatterId.value) {
        console.warn('⚠️ No current matter selected, cannot load workspace-specific spreadsheets');
        return;
      }

      try {
        // Check if we already have spreadsheets for this workspace
        const { data: existingSpreadsheets, error } = await supabase
          .from('ai_portfolio_data')
          .select('*')
          .eq('matter_id', currentMatterId.value)
          .not('spreadsheet_id', 'is', null)
          .order('created_at', { ascending: false });

        if (error) {
          console.warn('Error checking for existing spreadsheets:', error);
        }

        // If we already have spreadsheets for this workspace, load them
        if (existingSpreadsheets && existingSpreadsheets.length > 0) {
          console.log(`📊 Found ${existingSpreadsheets.length} existing spreadsheets for workspace ${currentMatterId.value}`);
          spreadsheets.value = existingSpreadsheets.map(sheet => ({
            id: sheet.spreadsheet_id,
            name: sheet.name || 'Portfolio',
            rows: 10,
            columns: 10,
            createdAt: new Date(sheet.created_at)
          }));
          return;
        }

        // No existing spreadsheets for this workspace, create a new default one
        const defaultSpreadsheetId = generateSpreadsheetId();
        spreadsheets.value = [{
          id: defaultSpreadsheetId,
          name: 'Portfolio',
          rows: 10,
          columns: 10,
          createdAt: new Date()
        }];

        console.log(`📊 Created new default spreadsheet for workspace ${currentMatterId.value} with ID:`, defaultSpreadsheetId);
      } catch (error) {
        console.error('Error initializing default spreadsheet:', error);
        // Fallback to creating new spreadsheet
        spreadsheets.value = [{
          id: generateSpreadsheetId(),
          name: 'Portfolio',
          rows: 10,
          columns: 10,
          createdAt: new Date()
        }];
      }
    };
    
    // Show add spreadsheet dialog
    const showAddSpreadsheetDialog = () => {
      if (!currentMatterId.value) {
        ElMessage.warning('Please select a workspace first');
        return;
      }
      
      // Reset form
      newSpreadsheetForm.value = {
        name: '',
        rows: 10,
        columns: 10
      };
      addSpreadsheetDialogVisible.value = true;
    };
    
    // Add new spreadsheet
    const addNewSpreadsheet = async () => {
      if (!currentMatterId.value) {
        ElMessage.error('No workspace selected');
        return;
      }
      
      try {
        // Validate form first
        if (!spreadsheetFormRef.value) {
          ElMessage.error('Form validation failed');
          return;
        }
        
        const valid = await spreadsheetFormRef.value.validate();
        if (!valid) {
          return;
        }
        
        addingSpreadsheet.value = true;
        
        // Check for duplicate names within the current workspace
        const isDuplicate = spreadsheets.value.some(sheet => 
          sheet.name.toLowerCase() === newSpreadsheetForm.value.name.toLowerCase()
        );
        
        if (isDuplicate) {
          ElMessage.error('A spreadsheet with this name already exists in this workspace');
          addingSpreadsheet.value = false;
          return;
        }
        
        // Create new spreadsheet
        const newSpreadsheet = {
          id: generateSpreadsheetId(),
          name: newSpreadsheetForm.value.name,
          rows: newSpreadsheetForm.value.rows,
          columns: newSpreadsheetForm.value.columns,
          createdAt: new Date()
        };
        
        spreadsheets.value.push(newSpreadsheet);
        
        console.log(`📊 Added new spreadsheet to workspace ${currentMatterId.value}:`, newSpreadsheet);
        ElMessage.success(`Spreadsheet "${newSpreadsheet.name}" added successfully!`);
        
        // Close dialog
        addSpreadsheetDialogVisible.value = false;
        
        // Scroll to new spreadsheet after a short delay
        setTimeout(() => {
          const newElement = document.querySelector(`#univer-container-${newSpreadsheet.id}`)?.closest('.spreadsheet-instance-wrapper');
          if (newElement) {
            newElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 500);
        
      } catch (error) {
        console.error('Error adding spreadsheet:', error);
        ElMessage.error('Failed to add spreadsheet: ' + error.message);
      } finally {
        addingSpreadsheet.value = false;
      }
    };
    
    // Remove spreadsheet
    const removeSpreadsheet = async (spreadsheetId) => {
      if (!currentMatterId.value) {
        ElMessage.error('No workspace selected');
        return;
      }
      
      try {
        const spreadsheet = spreadsheets.value.find(s => s.id === spreadsheetId);
        if (!spreadsheet) {
          ElMessage.error('Spreadsheet not found');
          return;
        }
        
        // Prevent deleting the last spreadsheet
        if (spreadsheets.value.length <= 1) {
          ElMessage.warning('Cannot delete the last remaining spreadsheet. You must have at least one spreadsheet.');
          return;
        }
        
        // Confirm deletion
        await ElMessageBox.confirm(
          `Are you sure you want to delete "${spreadsheet.name}"? This action cannot be undone.`,
          'Confirm Deletion',
          {
            confirmButtonText: 'Delete',
            cancelButtonText: 'Cancel',
            type: 'warning',
            confirmButtonClass: 'el-button--danger'
          }
        );
        
        console.log(`🗑️ Starting deletion of spreadsheet: ${spreadsheet.name} (${spreadsheetId}) from workspace ${currentMatterId.value}`);
        
        // Show loading state
        const loadingMessage = ElMessage({
          message: `Deleting "${spreadsheet.name}"...`,
          type: 'info',
          duration: 0, // Don't auto-close
          showClose: false
        });
        
        try {
          // Delete from Supabase database - filter by both spreadsheet_id AND matter_id for security
          const { data: deletedRecords, error: deleteError } = await supabase
            .from('ai_portfolio_data')
            .delete()
            .eq('spreadsheet_id', spreadsheetId)
            .eq('matter_id', currentMatterId.value)
            .select(); // Return deleted records for verification

          if (deleteError) {
            console.error('❌ Database deletion failed:', deleteError);
            throw new Error(`Failed to delete from database: ${deleteError.message}`);
          }
          
          console.log(`✅ Successfully deleted ${deletedRecords?.length || 0} record(s) from database for workspace ${currentMatterId.value}:`, deletedRecords);
          
          // Close loading message
          loadingMessage.close();
          
          // Remove from local array
          const index = spreadsheets.value.findIndex(s => s.id === spreadsheetId);
          if (index > -1) {
            spreadsheets.value.splice(index, 1);
            console.log(`📊 Removed spreadsheet from UI: ${spreadsheet.name} (${spreadsheetId})`);
            ElMessage.success(`Spreadsheet "${spreadsheet.name}" deleted successfully`);
          }
          
        } catch (dbError) {
          // Close loading message on error
          loadingMessage.close();
          throw dbError; // Re-throw to be caught by outer catch
        }
        
      } catch (error) {
        if (error === 'cancel') {
          // User cancelled - do nothing
          return;
        }
        console.error('❌ Error removing spreadsheet:', error);
        ElMessage.error('Failed to remove spreadsheet: ' + (error.message || 'Unknown error'));
      }
    };

    // Watch for matter changes and reload spreadsheets
    const watchMatterChanges = () => {
      let isInitialized = false;
      
      return computed(() => {
        if (currentMatter.value?.id) {
          const matterId = currentMatter.value.id;
          
          // Only reload if matter actually changed (not initial load)
          if (isInitialized) {
            console.log(`🔄 Matter changed to ${matterId}, reloading spreadsheets...`);
            spreadsheets.value = []; // Clear current spreadsheets
            initializeDefaultSpreadsheet(); // Load spreadsheets for new workspace
          } else {
            // First time initialization
            isInitialized = true;
            initializeDefaultSpreadsheet();
          }
        } else {
          // No matter selected, clear spreadsheets
          spreadsheets.value = [];
        }
        
        return currentMatter.value?.id;
      });
    };

    // Initialize component
    onMounted(async () => {
      // Set up matter watching
      const matterWatcher = watchMatterChanges();
      
      // Trigger initial load
      matterWatcher.value;
      
      console.log('✅ AI Portfolio Manager initialized with workspace-specific support!');
    });

    return {
      currentMatter,
      currentMatterId,
      spreadsheets,
      addSpreadsheetDialogVisible,
      addingSpreadsheet,
      spreadsheetFormRef,
      newSpreadsheetForm,
      spreadsheetFormRules,
      showAddSpreadsheetDialog,
      addNewSpreadsheet,
      removeSpreadsheet
    };
  },
};
</script>

<style scoped>
.portfolio-manager-wrapper {
  width: 100%;
  min-height: 100vh;
  background: #f8fafc;
}

/* Page Header */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
  padding: 20px 24px;
  background: white;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.page-title {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  color: #1e293b;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.page-actions {
  display: flex;
  gap: 12px;
}

/* Workspace Indicator */
.workspace-indicator {
  background: white;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  padding: 16px 24px;
  margin-bottom: 32px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.workspace-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.workspace-icon {
  font-size: 24px;
  color: #667eea;
}

.workspace-title {
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
}

.no-workspace-warning {
  margin-bottom: 32px;
}

/* Spreadsheets Container */
.spreadsheets-container {
  margin-bottom: 40px;
}

/* Add Spreadsheet Section */
.add-spreadsheet-section {
  display: flex;
  justify-content: center;
  padding: 40px 0;
  border-top: 2px dashed #cbd5e1;
  margin-top: 32px;
}

.add-spreadsheet-btn {
  padding: 16px 32px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 8px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  color: white;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

.add-spreadsheet-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.6);
}

.add-spreadsheet-btn:active {
  transform: translateY(0);
}

/* Dialog Styling */
:deep(.el-dialog) {
  border-radius: 12px;
  padding: 0;
  overflow: hidden;
}

:deep(.el-dialog__header) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 20px 24px;
  margin: 0;
}

:deep(.el-dialog__title) {
  font-size: 20px;
  font-weight: 600;
  color: white;
}

:deep(.el-dialog__close) {
  color: white;
  font-size: 20px;
}

:deep(.el-dialog__body) {
  padding: 24px;
}

:deep(.el-dialog__footer) {
  padding: 16px 24px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
}

/* Form Styling */
:deep(.el-form-item__label) {
  font-weight: 600;
  color: #374151;
}

:deep(.el-input__wrapper) {
  border-radius: 8px;
  border: 2px solid #e5e7eb;
  transition: border-color 0.2s ease;
}

:deep(.el-input__wrapper:hover) {
  border-color: #c7d2fe;
}

:deep(.el-input__wrapper.is-focus) {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

:deep(.el-input-number) {
  width: 100%;
}

:deep(.el-input-number .el-input__wrapper) {
  border-radius: 8px;
}

/* Button Styling */
:deep(.el-button--primary) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 8px;
  font-weight: 600;
  transition: all 0.3s ease;
}

:deep(.el-button--primary:hover) {
  transform: translateY(-1px);
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

:deep(.el-button--success) {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border: none;
  border-radius: 8px;
  font-weight: 600;
  transition: all 0.3s ease;
}

:deep(.el-button--success:hover) {
  transform: translateY(-1px);
  box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);
}

:deep(.el-button--danger) {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  border: none;
  border-radius: 8px;
  font-weight: 600;
  transition: all 0.3s ease;
}

:deep(.el-button--danger:hover) {
  transform: translateY(-1px);
  box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4);
}

/* Animations */
@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.spreadsheets-container > * {
  animation: slideInUp 0.3s ease-out;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
    text-align: center;
  }
  
  .page-title {
    font-size: 24px;
  }
  
  .page-actions {
    justify-content: center;
  }
  
  .add-spreadsheet-btn {
    width: 100%;
    padding: 14px 24px;
    font-size: 15px;
  }
}

@media (max-width: 480px) {
    .page-header {
    padding: 16px;
    margin-bottom: 24px;
  }
  
  .page-title {
    font-size: 22px;
  }
  
  .add-spreadsheet-section {
    padding: 24px 0;
  }
  
  :deep(.el-dialog) {
    width: 95% !important;
    margin: 0 auto;
  }
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .portfolio-manager-wrapper {
    background: #0f172a;
  }
  
  .page-header {
    background: #1e293b;
    border-color: #334155;
  }
  
  .page-title {
    color: #f1f5f9;
  }
  
  .add-spreadsheet-section {
    border-color: #475569;
  }
}
</style>