<template>
  <div class="spreadsheet-instance-wrapper" :class="{ saving }">
    <!-- Spreadsheet Header -->
    <div class="spreadsheet-header">
      <h3 class="spreadsheet-title">{{ spreadsheetName }}</h3>
      <div class="spreadsheet-controls">
        <el-button 
          type="primary" 
          :loading="saving" 
          @click="manualSave"
          size="small">
          <el-icon><DocumentChecked /></el-icon>
          Save
        </el-button>
        <el-button 
          type="danger" 
          @click="$emit('remove-spreadsheet', spreadsheetId)"
          size="small"
          v-if="canRemove">
          <el-icon><Delete /></el-icon>
          Remove
        </el-button>
      </div>
    </div>
    
    <div :id="`univer-container-${spreadsheetId}`" class="univer-container" :style="{ height: containerHeight + 'px' }"></div>
  </div>
</template>

<script>
import { onMounted, onBeforeUnmount, ref, computed, watch } from 'vue';
import { supabase } from '../../supabase';
import { ElMessage } from 'element-plus';
import { DocumentChecked, Delete } from '@element-plus/icons-vue';
import { useMatterStore } from '../../store/matter';
import { storeToRefs } from 'pinia';

// Univer core with locale support
import { LocaleType, merge, Univer, UniverInstanceType } from '@univerjs/core';

// Locale imports
import DesignEnUS from '@univerjs/design/locale/en-US';
import UIEnUS from '@univerjs/ui/locale/en-US';
import DocsUIEnUS from '@univerjs/docs-ui/locale/en-US';
import SheetsEnUS from '@univerjs/sheets/locale/en-US';
import SheetsUIEnUS from '@univerjs/sheets-ui/locale/en-US';
import SheetsFormulaUIEnUS from '@univerjs/sheets-formula-ui/locale/en-US';
import SheetsNumfmtUIEnUS from '@univerjs/sheets-numfmt-ui/locale/en-US';

// Plugin imports
import { UniverRenderEnginePlugin } from '@univerjs/engine-render';
import { UniverFormulaEnginePlugin } from '@univerjs/engine-formula';
import { UniverUIPlugin } from '@univerjs/ui';
import { UniverDocsPlugin } from '@univerjs/docs';
import { UniverDocsUIPlugin } from '@univerjs/docs-ui';
import { UniverSheetsPlugin } from '@univerjs/sheets';
import { UniverSheetsUIPlugin } from '@univerjs/sheets-ui';
import { UniverSheetsFormulaUIPlugin } from '@univerjs/sheets-formula-ui';
import { UniverSheetsNumfmtUIPlugin } from '@univerjs/sheets-numfmt-ui';

// CSS imports - exactly as in documentation
import '@univerjs/design/lib/index.css';
import '@univerjs/ui/lib/index.css';
import '@univerjs/docs-ui/lib/index.css';
import '@univerjs/sheets-ui/lib/index.css';
import '@univerjs/sheets-formula-ui/lib/index.css';
import '@univerjs/sheets-numfmt-ui/lib/index.css';

export default {
  name: 'SpreadsheetInstance',
  components: {
    DocumentChecked,
    Delete
  },
  props: {
    spreadsheetId: {
      type: String,
      required: true
    },
    spreadsheetName: {
      type: String,
      required: true
    },
    initialRows: {
      type: Number,
      default: 10
    },
    initialColumns: {
      type: Number,
      default: 10
    },
    canRemove: {
      type: Boolean,
      default: true
    },
    matterId: {
      type: Number,
      required: false,
      default: null
    }
  },
  emits: ['remove-spreadsheet'],
  setup(props) {
    // Matter store for workspace context
    const matterStore = useMatterStore();
    const { currentMatter } = storeToRefs(matterStore);
    
    // Use prop matterId if provided, otherwise get from current matter
    const currentMatterId = computed(() => props.matterId || currentMatter.value?.id);
    
    let univer = null;
    const portfolioData = ref({});
    const saving = ref(false);
    const portfolioId = ref(null);
    const lastSaved = ref(null);
    const allSheetsData = ref({});
    const currentRowCount = ref(props.initialRows);

    // Computed height based on actual row count - exact fit without scrollbars
    const containerHeight = computed(() => {
      const rowHeight = 27; // Default row height
      const columnHeaderHeight = 20; // Column header height
      const toolbarHeight = 50; // Univer toolbar height
      const sheetTabsHeight = 30; // Sheet tabs at bottom
      const containerPadding = 16; // Container margins (8px * 2)
      
      console.log(`🔍 Current row count for height calculation (${props.spreadsheetId}):`, currentRowCount.value);
      // Calculate exact height needed for all content based on actual rows
      const contentHeight = (currentRowCount.value * rowHeight) + columnHeaderHeight + toolbarHeight + sheetTabsHeight + containerPadding;
      
      // Return exact height without extra space
      return contentHeight;
    });

    // Load complete portfolio workbook data from Supabase
    const loadPortfolioData = async () => {
      if (!currentMatterId.value) {
        console.warn(`⚠️ No matter ID available for loading portfolio data (${props.spreadsheetId})`);
        return {};
      }

      try {
        // Find data with the specific spreadsheet_id AND matter_id for workspace filtering
        const { data, error } = await supabase
          .from('ai_portfolio_data')
          .select('*')
          .eq('spreadsheet_id', props.spreadsheetId)
          .eq('matter_id', currentMatterId.value)
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) throw error;

        if (data && data.length > 0) {
          portfolioId.value = data[0].id;
          const loadedData = data[0].data || {};
          
          console.log(`📊 Loading portfolio data for workspace ${currentMatterId.value}, spreadsheet ${props.spreadsheetId}`);
          
          // Check if this is a complete Univer workbook format or legacy format
          if (loadedData.id && loadedData.sheets && loadedData.sheetOrder) {
            // This is a complete Univer workbook format with all features
            console.log(`📊 Loaded complete Univer workbook with formatting and features (${props.spreadsheetId})`);
            portfolioData.value = loadedData;
            return loadedData;
          } else if (loadedData.sheets) {
            // This is a sheets-only format, wrap it in workbook structure
            const workbookData = {
              id: `workbook-${props.spreadsheetId}`,
              locale: 'en-US',
              name: props.spreadsheetName,
              sheetOrder: Object.keys(loadedData.sheets),
              sheets: loadedData.sheets
            };
            portfolioData.value = workbookData;
            return workbookData;
          } else if (Object.keys(loadedData).some(key => key.startsWith('sheet-'))) {
            // Legacy multi-sheet format - convert to complete workbook
            const workbookData = {
              id: `workbook-${props.spreadsheetId}`,
              locale: 'en-US',
              name: props.spreadsheetName,
              sheetOrder: Object.keys(loadedData),
              sheets: {}
            };
            
            // Convert each sheet to proper format
            Object.keys(loadedData).forEach(sheetId => {
              workbookData.sheets[sheetId] = {
                id: sheetId,
                name: sheetId === 'sheet-01' ? props.spreadsheetName : `Sheet ${sheetId.split('-')[1]}`,
                cellData: loadedData[sheetId] || {}
              };
            });
            
            portfolioData.value = workbookData;
            return workbookData;
          } else {
            // Very old format - single sheet data
            const workbookData = {
              id: `workbook-${props.spreadsheetId}`,
              locale: 'en-US',
              name: props.spreadsheetName,
              sheetOrder: ['sheet-01'],
              sheets: {
                'sheet-01': {
                  id: 'sheet-01',
                  name: props.spreadsheetName,
                  cellData: loadedData
                }
              }
            };
            portfolioData.value = workbookData;
            return workbookData;
          }
        } else {
          // Create initial empty workbook with default headers
          const initialWorkbook = {
            id: `workbook-${props.spreadsheetId}`,
            locale: 'en-US',
            name: props.spreadsheetName,
            sheetOrder: ['sheet-01'],
            sheets: {
              'sheet-01': {
                id: 'sheet-01',
                name: props.spreadsheetName,
                rowCount: props.initialRows,
                columnCount: props.initialColumns,
                cellData: {
                  0: {
                    0: { v: 'Column A' },
                    1: { v: 'Column B' },
                    2: { v: 'Column C' },
                    3: { v: 'Column D' },
                    4: { v: 'Column E' }
                  }
                }
              }
            }
          };
          await savePortfolioData(initialWorkbook);
          return initialWorkbook;
        }
      } catch (error) {
        console.error(`Error loading portfolio data (${props.spreadsheetId}):`, error);
        ElMessage.error(`Failed to load spreadsheet data: ${props.spreadsheetName}`);
        return {};
      }
    };

    // Save complete workbook data with all features to Supabase
    const savePortfolioData = async (data = null) => {
      if (saving.value) {
        console.log(`⏭️ Save already in progress for ${props.spreadsheetId}, skipping...`);
        return;
      }
      
      if (!currentMatterId.value) {
        console.warn(`⚠️ No matter ID available for saving portfolio data (${props.spreadsheetId})`);
        ElMessage.warning(`Cannot save ${props.spreadsheetName}: No workspace selected`);
        return;
      }
      
      try {
        saving.value = true;
        
        const dataToSave = data || portfolioData.value;
        
        // Validate data exists and is not empty
        if (!dataToSave || typeof dataToSave !== 'object' || Object.keys(dataToSave).length === 0) {
          console.warn(`⚠️ No valid data to save for ${props.spreadsheetId}`);
          ElMessage.warning(`No data to save for ${props.spreadsheetName}`);
          return;
        }
        
        console.log(`💾 SAVING TO SUPABASE (${props.spreadsheetId}) for workspace ${currentMatterId.value}:`, {
          hasSheets: !!(dataToSave.sheets),
          sheetCount: dataToSave.sheets ? Object.keys(dataToSave.sheets).length : 0,
          hasStyles: !!(dataToSave.styles),
          styleCount: dataToSave.styles ? Object.keys(dataToSave.styles).length : 0
        });
        
        // Clean and prepare data for serialization
        const cleanedData = cleanDataForSerialization(dataToSave);
        
        // Verify data is serializable
        try {
          const serialized = JSON.stringify(cleanedData);
          const sizeKB = (serialized.length / 1024).toFixed(2);
          console.log(`✅ Data is JSON serializable (${props.spreadsheetId}), size: ${sizeKB} KB`);
          
          // Warn if data is getting large (>1MB)
          if (serialized.length > 1024 * 1024) {
            console.warn(`⚠️ Large data size (${sizeKB} KB) for ${props.spreadsheetId}, consider optimization`);
          }
        } catch (serializeError) {
          console.error(`❌ Data serialization failed (${props.spreadsheetId}):`, serializeError);
          throw new Error('Data contains non-serializable content: ' + serializeError.message);
        }
        
        if (portfolioId.value) {
          // Update existing record - verify it belongs to current workspace
          console.log(`📝 Updating existing record ID (${props.spreadsheetId}):`, portfolioId.value);
          const { error } = await supabase
            .from('ai_portfolio_data')
            .update({ 
              data: cleanedData,
              name: props.spreadsheetName,
              spreadsheet_id: props.spreadsheetId,
              matter_id: currentMatterId.value,
              updated_at: new Date().toISOString()
            })
            .eq('id', portfolioId.value)
            .eq('matter_id', currentMatterId.value); // Extra security: ensure we only update records from current workspace

          if (error) {
            console.error(`❌ Supabase update error (${props.spreadsheetId}):`, error);
            throw error;
          }
          console.log(`✅ Successfully updated existing record (${props.spreadsheetId}) for workspace ${currentMatterId.value}`);
        } else {
          // Create new record
          console.log(`📝 Creating new record (${props.spreadsheetId}) for workspace ${currentMatterId.value}...`);
          const { data: newRecord, error } = await supabase
            .from('ai_portfolio_data')
            .insert([{ 
              data: cleanedData,
              name: props.spreadsheetName,
              spreadsheet_id: props.spreadsheetId,
              matter_id: currentMatterId.value,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }])
            .select()
            .single();

          if (error) {
            console.error(`❌ Supabase insert error (${props.spreadsheetId}):`, error);
            throw error;
          }
          portfolioId.value = newRecord.id;
          console.log(`✅ Successfully created new record with ID (${props.spreadsheetId}) for workspace ${currentMatterId.value}:`, newRecord.id);
        }

        portfolioData.value = cleanedData;
        lastSaved.value = new Date().toLocaleTimeString();
        
        const sheetCount = cleanedData.sheets ? Object.keys(cleanedData.sheets).length : 0;
        const styleCount = cleanedData.styles ? Object.keys(cleanedData.styles).length : 0;
        
        console.log(`✅ Save operation completed successfully (${props.spreadsheetId}) for workspace ${currentMatterId.value}:`, {
          recordId: portfolioId.value,
          sheets: sheetCount,
          styles: styleCount,
          timestamp: lastSaved.value
        });
        
        ElMessage.success(`${props.spreadsheetName} saved successfully!`);
        
      } catch (error) {
        console.error(`❌ Save operation failed (${props.spreadsheetId}):`, error);
        ElMessage.error(`Failed to save ${props.spreadsheetName}: ${error.message || 'Unknown error'}`);
        throw error; // Re-throw for caller to handle
      } finally {
        saving.value = false;
      }
    };

    // Helper function to clean data for serialization
    const cleanDataForSerialization = (data) => {
      try {
        // Create a deep copy to avoid modifying original data
        const cleaned = JSON.parse(JSON.stringify(data));
        
        // Remove any circular references, functions, or undefined values
        const removeProblematicValues = (obj) => {
          if (obj === null || typeof obj !== 'object') return obj;
          
          if (Array.isArray(obj)) {
            return obj.map(item => removeProblematicValues(item)).filter(item => item !== undefined);
          }
          
          const cleanedObj = {};
          for (const [key, value] of Object.entries(obj)) {
            if (value !== undefined && typeof value !== 'function') {
              if (typeof value === 'object' && value !== null) {
                cleanedObj[key] = removeProblematicValues(value);
              } else {
                cleanedObj[key] = value;
              }
            }
          }
          return cleanedObj;
        };
        
        const result = removeProblematicValues(cleaned);
        console.log(`🧹 Data cleaned for serialization (${props.spreadsheetId})`);
        return result;
      } catch (error) {
        console.error(`❌ Failed to clean data for serialization (${props.spreadsheetId}):`, error);
        // Return original data if cleaning fails
        return data;
      }
    };

    // Update current row count based on worksheet data
    const updateRowCount = () => {
      try {
        if (!univer || !univer.__getInjector) return;
        
        const injector = univer.__getInjector();
        const workbookService = injector.get?.('IWorkbookService') || injector.get?.('WorkbookService');
        
        if (workbookService) {
          const activeWorkbook = workbookService.getCurrentWorkbook?.();
          if (activeWorkbook) {
            const activeWorksheet = activeWorkbook.getActiveSheet?.();
            if (activeWorksheet) {
              const rowCount = activeWorksheet.getRowCount?.() || activeWorksheet.getMaxRows?.() || currentRowCount.value;
              if (rowCount && rowCount !== currentRowCount.value) {
                console.log(`📏 Row count updated from ${currentRowCount.value} to ${rowCount} (${props.spreadsheetId})`);
                currentRowCount.value = rowCount;
              }
            }
          }
        }
      } catch (error) {
        console.warn(`⚠️ Could not update row count (${props.spreadsheetId}):`, error);
      }
    };

    // Simplified style registry for basic style preservation
    const realTimeStyleRegistry = ref({});
    
    // Simplified change tracking that focuses on data integrity
    const trackSheetChanges = () => {
      try {
        if (!univer || !univer.__getInjector) {
          console.warn(`⚠️ Univer not available for tracking (${props.spreadsheetId})`);
          return;
        }
        
        const injector = univer.__getInjector();
        console.log(`🎯 Setting up simplified change tracking (${props.spreadsheetId})...`);
        
        // Try to get the command service for basic change detection
        let commandService = null;
        try {
          commandService = injector.get?.('ICommandService') || injector.get?.('CommandService');
        } catch (serviceError) {
          console.warn(`⚠️ Could not get command service (${props.spreadsheetId}):`, serviceError.message);
          return;
        }
        
        if (!commandService || typeof commandService.onCommandExecuted !== 'function') {
          console.warn(`⚠️ Command service not available for tracking (${props.spreadsheetId})`);
          return;
        }
        
        // Listen for important changes to update local data
        commandService.onCommandExecuted((command) => {
          // Only track essential changes for data integrity
          const isDataChange = 
            command.id.includes('set-range-value') ||
            command.id.includes('SetRangeValues') ||
            command.id.includes('insert-row') ||
            command.id.includes('delete-row') ||
            command.id.includes('insert-column') ||
            command.id.includes('delete-column') ||
            command.id.includes('style') ||
            command.id.includes('format');

          if (isDataChange) {
            console.log(`📝 Data change detected (${props.spreadsheetId}):`, command.id);
            
            // Simple style capture from command params
            if (command.params?.styles && typeof command.params.styles === 'object') {
              Object.assign(realTimeStyleRegistry.value, command.params.styles);
              console.log(`🎨 Captured ${Object.keys(command.params.styles).length} styles from command`);
            }
            
            // Update local data after a short delay
            setTimeout(() => {
              updateLocalSheetData();
              updateRowCount();
            }, 100);
          }
        });
        
        console.log(`✅ Simplified change tracking enabled (${props.spreadsheetId})`);
      } catch (error) {
        console.warn(`⚠️ Could not set up change tracking (${props.spreadsheetId}):`, error);
      }
    };




    // Update local copy of complete workbook data
    const updateLocalSheetData = (unitId = null) => {
      try {
        const currentData = getCurrentSpreadsheetData();
        if (currentData && Object.keys(currentData).length > 0) {
          allSheetsData.value = { ...currentData };
          portfolioData.value = { ...currentData };
          
          console.log(`🔄 Updated workbook data (${props.spreadsheetId}):`, {
            sheets: currentData.sheets ? Object.keys(currentData.sheets).length : 0,
            styles: currentData.styles ? Object.keys(currentData.styles).length : 0
          });
        }
      } catch (error) {
        console.warn(`Error updating local sheet data (${props.spreadsheetId}):`, error);
      }
    };

    // Get complete workbook data with all formatting, styles, images, formulas using Univer's export API
    const getCurrentSpreadsheetData = () => {
      return getCompleteWorkbookData();
    };

    // Simplified workbook data extraction
    const getCompleteWorkbookData = () => {
      try {
        if (!univer) {
          console.log(`⚠️ Univer not available, returning stored data (${props.spreadsheetId})`);
          return portfolioData.value;
        }
        
        console.log(`🔄 Extracting current workbook data (${props.spreadsheetId})...`);
        
        // First try to get data through the injector services
        try {
          const injector = univer.__getInjector();
          if (injector) {
            const workbookService = injector.get?.('IWorkbookService') || injector.get?.('WorkbookService');
            if (workbookService) {
              const currentWorkbook = workbookService.getCurrentWorkbook?.();
              if (currentWorkbook) {
                // Try the save method first (most complete data)
                try {
                  const savedData = currentWorkbook.save?.();
                  if (savedData && savedData.sheets && Object.keys(savedData.sheets).length > 0) {
                    console.log(`✅ Got current data via workbook.save() (${props.spreadsheetId}):`, {
                      sheets: Object.keys(savedData.sheets).length,
                      styles: savedData.styles ? Object.keys(savedData.styles).length : 0,
                      firstSheetCells: savedData.sheets[Object.keys(savedData.sheets)[0]]?.cellData ? Object.keys(savedData.sheets[Object.keys(savedData.sheets)[0]].cellData).length : 0
                    });
                    return savedData;
                  }
                } catch (saveError) {
                  console.warn(`workbook.save() failed (${props.spreadsheetId}):`, saveError.message);
                }

                // Try getSnapshot method as fallback
                try {
                  const snapshot = currentWorkbook.getSnapshot?.();
                  if (snapshot && snapshot.sheets && Object.keys(snapshot.sheets).length > 0) {
                    console.log(`✅ Got current data via getSnapshot() (${props.spreadsheetId}):`, {
                      sheets: Object.keys(snapshot.sheets).length,
                      styles: snapshot.styles ? Object.keys(snapshot.styles).length : 0,
                      firstSheetCells: snapshot.sheets[Object.keys(snapshot.sheets)[0]]?.cellData ? Object.keys(snapshot.sheets[Object.keys(snapshot.sheets)[0]].cellData).length : 0
                    });
                    return snapshot;
                  }
                } catch (snapshotError) {
                  console.warn(`getSnapshot() failed (${props.spreadsheetId}):`, snapshotError.message);
                }

                // Try manual sheet data extraction
                try {
                  const activeSheet = currentWorkbook.getActiveSheet?.();
                  if (activeSheet) {
                    console.log(`🔄 Manually extracting sheet data (${props.spreadsheetId})...`);
                    
                    // Build workbook data structure manually
                    const manualData = {
                      id: `workbook-${props.spreadsheetId}`,
                      locale: 'en-US',
                      name: props.spreadsheetName,
                      sheetOrder: ['sheet-01'],
                      sheets: {
                        'sheet-01': {
                          id: 'sheet-01',
                          name: props.spreadsheetName,
                          cellData: {},
                          rowCount: activeSheet.getRowCount?.() || 10,
                          columnCount: activeSheet.getColumnCount?.() || 10,
                          // Add default sheet properties
                          freeze: { xSplit: 0, ySplit: 0, startRow: -1, startColumn: -1 },
                          hidden: 0,
                          rowData: {},
                          tabColor: "",
                          mergeData: [],
                          rowHeader: { width: 46, hidden: 0 },
                          scrollTop: 0,
                          zoomRatio: 1,
                          columnData: {},
                          scrollLeft: 0,
                          rightToLeft: 0,
                          columnHeader: { height: 20, hidden: 0 },
                          showGridlines: 1,
                          defaultRowHeight: 24,
                          defaultColumnWidth: 88
                        }
                      },
                      styles: {}
                    };

                    // Extract cell data manually
                    const maxRows = activeSheet.getRowCount?.() || 100;
                    const maxCols = activeSheet.getColumnCount?.() || 26;
                    
                    console.log(`📊 Scanning ${maxRows}x${maxCols} cells for data...`);
                    
                    for (let row = 0; row < Math.min(maxRows, 100); row++) {
                      for (let col = 0; col < Math.min(maxCols, 26); col++) {
                        try {
                          const cellValue = activeSheet.getCellValue?.(row, col) || 
                                          activeSheet.getCell?.(row, col)?.getValue?.() || 
                                          activeSheet.getCell?.(row, col)?.v;
                          
                          if (cellValue !== undefined && cellValue !== null && cellValue !== '') {
                            if (!manualData.sheets['sheet-01'].cellData[row]) {
                              manualData.sheets['sheet-01'].cellData[row] = {};
                            }
                            manualData.sheets['sheet-01'].cellData[row][col] = { v: cellValue };
                            console.log(`📝 Found cell [${row}, ${col}]: "${cellValue}"`);
                          }
                        } catch (cellError) {
                          // Skip this cell if there's an error
                        }
                      }
                    }

                    const cellCount = Object.keys(manualData.sheets['sheet-01'].cellData).reduce((total, row) => {
                      return total + Object.keys(manualData.sheets['sheet-01'].cellData[row]).length;
                    }, 0);

                    console.log(`✅ Manual extraction complete (${props.spreadsheetId}): ${cellCount} cells with data`);
                    
                    if (cellCount > 0) {
                      return manualData;
                    }
                  }
                } catch (manualError) {
                  console.warn(`Manual extraction failed (${props.spreadsheetId}):`, manualError.message);
                }
              }
            }
          }
        } catch (serviceError) {
          console.warn(`Service-based extraction failed (${props.spreadsheetId}):`, serviceError.message);
        }

        // Try the original unit-based approach as final fallback
        try {
          const units = univer.getAllUnits?.() || [];
          console.log(`📊 Trying unit-based extraction with ${units.length} units (${props.spreadsheetId})`);
          
          for (const unit of units) {
            if (unit.type === UniverInstanceType.UNIVER_SHEET || 
                unit.type === 'UNIVER_SHEET' || 
                unit.type === 2) {
              
              const methods = ['save', 'getSnapshot', 'serialize'];
              for (const method of methods) {
                try {
                  if (typeof unit[method] === 'function') {
                    const data = unit[method]();
                    if (data && data.sheets && Object.keys(data.sheets).length > 0) {
                      console.log(`✅ Got workbook data via unit.${method}() (${props.spreadsheetId}):`, {
                        sheets: Object.keys(data.sheets).length,
                        styles: data.styles ? Object.keys(data.styles).length : 0
                      });
                      return data;
                    }
                  }
                } catch (methodError) {
                  console.warn(`Unit method ${method} failed (${props.spreadsheetId}):`, methodError.message);
                }
              }
            }
          }
        } catch (extractionError) {
          console.warn(`Unit-based extraction failed (${props.spreadsheetId}):`, extractionError.message);
        }
        
        console.log(`⚠️ All extraction methods failed, falling back to stored data (${props.spreadsheetId})`);
        return portfolioData.value || {};
        
      } catch (error) {
        console.error(`Error getting workbook data (${props.spreadsheetId}):`, error);
        return portfolioData.value || {};
      }
    };

    // Simplified and reliable manual save function
    const manualSave = async () => {
      try {
        console.log(`💾 Starting save operation (${props.spreadsheetId})...`);
        
        // Force update local data first to ensure we have the latest state
        console.log(`🔄 Forcing data refresh before save...`);
        updateLocalSheetData();
        
        // Small delay to ensure data is captured
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Get current workbook data directly from Univer
        const currentData = getCurrentSpreadsheetData();
        
        if (!currentData || Object.keys(currentData).length === 0) {
          console.warn(`⚠️ No workbook data to save (${props.spreadsheetId})`);
          ElMessage.warning(`No workbook data found for ${props.spreadsheetName}. Please add content and try again.`);
          return;
        }
        
        // Ensure proper workbook structure
        if (!currentData.styles) {
          currentData.styles = {};
        }
        
        // Merge any captured styles from our registry (simplified)
        if (realTimeStyleRegistry.value && Object.keys(realTimeStyleRegistry.value).length > 0) {
          currentData.styles = { ...currentData.styles, ...realTimeStyleRegistry.value };
          console.log(`✅ Merged ${Object.keys(realTimeStyleRegistry.value).length} captured styles`);
        }
        
        // Count cells with actual data for verification
        let totalCells = 0;
        if (currentData.sheets) {
          Object.keys(currentData.sheets).forEach(sheetId => {
            const sheet = currentData.sheets[sheetId];
            if (sheet.cellData) {
              Object.keys(sheet.cellData).forEach(row => {
                totalCells += Object.keys(sheet.cellData[row]).length;
              });
            }
          });
        }
        
        console.log(`📊 Saving workbook (${props.spreadsheetId}):`, {
          sheets: currentData.sheets ? Object.keys(currentData.sheets).length : 0,
          styles: currentData.styles ? Object.keys(currentData.styles).length : 0,
          totalCells: totalCells,
          hasContent: totalCells > 0
        });
        
        // Debug: Show what cells we're actually saving
        if (currentData.sheets) {
          Object.keys(currentData.sheets).forEach(sheetId => {
            const sheet = currentData.sheets[sheetId];
            if (sheet.cellData) {
              console.log(`📋 Sheet ${sheetId} cell data:`, sheet.cellData);
            }
          });
        }
        
        await savePortfolioData(currentData);
        console.log(`✅ Save completed successfully (${props.spreadsheetId})`);
        
      } catch (error) {
        console.error(`❌ Manual save failed (${props.spreadsheetId}):`, error);
        ElMessage.error(`Failed to save ${props.spreadsheetName}: ${error.message || 'Unknown error'}`);
      }
    };

    // Workbook data structure
    const WORKBOOK_DATA = {
      id: `workbook-${props.spreadsheetId}`,
      locale: LocaleType.EN_US,
      name: props.spreadsheetName,
      sheetOrder: [],
      sheets: {},
    };

    const initializeUniver = async () => {
      try {
        console.log(`🚀 Initializing Univer instance for ${props.spreadsheetName} (${props.spreadsheetId})...`);

        // Load complete workbook data from Supabase first
        const workbookData = await loadPortfolioData();
        
        // Use the loaded workbook data or create default structure
        if (workbookData && workbookData.sheets) {
          // Use the complete workbook data from Supabase
          Object.assign(WORKBOOK_DATA, workbookData);
          portfolioData.value = workbookData;
          
          // IMPORTANT: Ensure styles are at the root level of WORKBOOK_DATA
          if (workbookData.styles) {
            WORKBOOK_DATA.styles = { ...workbookData.styles };
            realTimeStyleRegistry.value = { ...workbookData.styles };
            console.log(`✅ Loaded ${Object.keys(workbookData.styles).length} styles from Supabase`);
            console.log(`📊 Loaded styles applied to WORKBOOK_DATA:`, WORKBOOK_DATA.styles);
          } else {
            console.log(`⚠️ No styles found in loaded workbook data`);
          }
          
          // Update current row count from loaded data
          const firstSheet = Object.values(workbookData.sheets)[0];
          if (firstSheet && firstSheet.rowCount) {
            currentRowCount.value = firstSheet.rowCount;
            console.log(`📏 Set current row count from loaded data (${props.spreadsheetId}):`, firstSheet.rowCount);
          }
          
          console.log(`📊 Loaded complete workbook with features (${props.spreadsheetId}):`, {
            id: WORKBOOK_DATA.id,
            name: WORKBOOK_DATA.name,
            sheets: Object.keys(WORKBOOK_DATA.sheets),
            sheetOrder: WORKBOOK_DATA.sheetOrder,
            stylesCount: WORKBOOK_DATA.styles ? Object.keys(WORKBOOK_DATA.styles).length : 0,
            hasStylesInWorkbookData: !!(WORKBOOK_DATA.styles),
            rowCount: currentRowCount.value
          });
        } else {
          // Fallback to default workbook structure
          WORKBOOK_DATA.sheets = {
            'sheet-01': {
              id: 'sheet-01',
              name: props.spreadsheetName,
              cellData: {},
              tabColor: '',
              hidden: 0,
              rowCount: props.initialRows,
              columnCount: props.initialColumns,
              zoomRatio: 1,
              scrollTop: 0,
              scrollLeft: 0,
              defaultColumnWidth: 120,
              defaultRowHeight: 27,
              mergeData: [],
              rowData: {},
              columnData: {},
              showGridlines: 1,
              rowHeader: {
                width: 46,
                hidden: 0,
              },
              columnHeader: {
                height: 20,
                hidden: 0,
              },
              selections: ['A1'],
              rightToLeft: 0,
            }
          };
          WORKBOOK_DATA.sheetOrder = ['sheet-01'];
          WORKBOOK_DATA.styles = {}; // Ensure styles property exists
        }

        // Create Univer instance with locales - exactly as in documentation
        univer = new Univer({
          locale: LocaleType.EN_US,
          locales: {
            [LocaleType.EN_US]: merge(
              {},
              DesignEnUS,
              UIEnUS,
              DocsUIEnUS,
              SheetsEnUS,
              SheetsUIEnUS,
              SheetsFormulaUIEnUS,
              SheetsNumfmtUIEnUS,
            ),
          },
        });

        // Register plugins in exact order from documentation
        univer.registerPlugin(UniverRenderEnginePlugin);
        univer.registerPlugin(UniverFormulaEnginePlugin);
        univer.registerPlugin(UniverUIPlugin, {
          container: `univer-container-${props.spreadsheetId}`,
        });

        univer.registerPlugin(UniverDocsPlugin);
        univer.registerPlugin(UniverDocsUIPlugin);

        univer.registerPlugin(UniverSheetsPlugin);
        univer.registerPlugin(UniverSheetsUIPlugin);
        univer.registerPlugin(UniverSheetsFormulaUIPlugin);
        univer.registerPlugin(UniverSheetsNumfmtUIPlugin);

        // Create workbook with loaded data and styles
        console.log(`📊 Creating Univer workbook with loaded data and ${Object.keys(WORKBOOK_DATA.styles || {}).length} styles...`);
        univer.createUnit(UniverInstanceType.UNIVER_SHEET, WORKBOOK_DATA);

        // Enable change tracking with error handling
        setTimeout(() => {
          try {
            trackSheetChanges();
            updateLocalSheetData();
            updateRowCount();
            console.log(`✅ Change tracking initialized (${props.spreadsheetId})`);
          } catch (trackingError) {
            console.warn(`⚠️ Failed to initialize change tracking (${props.spreadsheetId}):`, trackingError.message);
            // Continue without change tracking rather than failing completely
          }
        }, 500);
        
        console.log(`✅ Univer initialized successfully for ${props.spreadsheetName} (${props.spreadsheetId})!`);
        
      } catch (error) {
        console.error(`❌ Failed to initialize Univer (${props.spreadsheetId}):`, error);
        ElMessage.error(`Failed to initialize ${props.spreadsheetName}: ${error.message}`);
      }
    };

    onMounted(() => {
      // Ensure DOM is ready before initialization
      setTimeout(() => {
        initializeUniver();
      }, 100);
    });

    onBeforeUnmount(() => {
      if (univer) {
        try {
          univer.dispose();
          console.log(`📤 Univer disposed successfully (${props.spreadsheetId})`);
        } catch (error) {
          console.warn(`⚠️ Error disposing Univer (${props.spreadsheetId}):`, error);
        }
      }
    });

    return {
      portfolioData,
      saving,
      manualSave,
      lastSaved,
      containerHeight,
      currentRowCount
    };
  },
};
</script>

<style scoped>
.spreadsheet-instance-wrapper {
  width: 100%;
  margin-bottom: 32px;
  background: #f5f7fa;
  border-radius: 8px;
  padding: 16px;
  position: relative;
}

.spreadsheet-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: white;
  border-radius: 6px;
  border: 1px solid #e0e6ed;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.spreadsheet-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #2c3e50;
}

.spreadsheet-controls {
  display: flex;
  gap: 8px;
}

.univer-container {
  width: 100%;
  background: white;
  border: 1px solid #e0e6ed;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

/* Saving indicator */
.spreadsheet-instance-wrapper::after {
  content: '';
  display: none;
}

.spreadsheet-instance-wrapper.saving::after {
  content: '💾 Saving...';
  display: block;
  position: absolute;
  top: 20px;
  right: 20px;
  background: #409eff;
  color: white;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  z-index: 1001;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}

/* Ensure Univer takes exact space without scrollbars */
:deep(.univer-container) {
  width: 100%;
  height: 100%;
}

:deep(.univer-container .univer) {
  width: 100%;
  height: 100%;
}

/* Remove all internal scrollbars and ensure exact fit */
:deep(.univer-container .universheet-render-canvas) {
  width: 100% !important;
  height: 100% !important;
}

:deep(.univer-container .univer-scroll-container) {
  overflow: hidden !important;
}

:deep(.univer-container .univer-scroll-bar) {
  display: none !important;
}

:deep(.univer-container .univer-scrollbar) {
  display: none !important;
}

/* Hide any viewport scrollbars within Univer */
:deep(.univer-container .univer-viewport) {
  overflow: hidden !important;
}

:deep(.univer-container .univer-canvas-container) {
  overflow: hidden !important;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .spreadsheet-instance-wrapper {
    padding: 12px;
    margin-bottom: 24px;
  }
  
  .spreadsheet-header {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
  
  .spreadsheet-controls {
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .spreadsheet-instance-wrapper {
    padding: 8px;
  }
  
  .univer-container {
    border-radius: 4px;
  }
}
</style> 