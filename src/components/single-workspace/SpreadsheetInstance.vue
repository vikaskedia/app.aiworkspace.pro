<template>
  <div class="spreadsheet-instance-wrapper" :class="{ saving }">
    <!-- Spreadsheet Container -->
    <div class="spreadsheet-container">
      <div :id="`univer-container-${spreadsheetId}`" class="univer-container" :style="{ height: containerHeight + 'px' }"></div>
    </div>
  </div>
</template>

<script>
import { onMounted, onBeforeUnmount, ref, computed, watch } from 'vue';
import { supabase } from '../../supabase';
import { ElMessage } from 'element-plus';
import { useMatterStore } from '../../store/matter';
import { useTaskStore } from '../../store/task';
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
import { UniverSheetsFormulaPlugin } from '@univerjs/sheets-formula';
import { UniverSheetsFormulaUIPlugin } from '@univerjs/sheets-formula-ui';
import { UniverSheetsNumfmtUIPlugin } from '@univerjs/sheets-numfmt-ui';

// Custom menu plugin

// CSS imports - exactly as in documentation
import '@univerjs/design/lib/index.css';
import '@univerjs/ui/lib/index.css';
import '@univerjs/docs-ui/lib/index.css';
import '@univerjs/sheets-ui/lib/index.css';
import '@univerjs/sheets-formula-ui/lib/index.css';
import '@univerjs/sheets-numfmt-ui/lib/index.css';

export default {
  name: 'SpreadsheetInstance',
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
    },
    portfolioId: {
      type: String,
      required: false,
      default: null
    }
  },
  emits: ['remove-spreadsheet'],
  setup(props, { emit }) {
    // Matter store for workspace context
    const matterStore = useMatterStore();
    const { currentMatter } = storeToRefs(matterStore);
    
    // Task store for fetching task information
    const taskStore = useTaskStore();
    
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
        // Find data with the specific spreadsheet_id AND matter_id AND portfolio_id for filtering
        let query = supabase
          .from('ai_portfolio_data')
          .select('*')
          .eq('spreadsheet_id', props.spreadsheetId)
          .eq('matter_id', currentMatterId.value);
        
        // Add portfolio_id filter if provided
        if (props.portfolioId) {
          query = query.eq('portfolio_id', props.portfolioId);
        }
        
        const { data, error } = await query
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
              portfolio_id: props.portfolioId,
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
              portfolio_id: props.portfolioId,
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
    
        // try to return WORKBOOK_DATA
        try {
          return WORKBOOK_DATA;
        } catch (error) {
          console.warn(`Error getting workbook data (${props.spreadsheetId}):`, error);
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
      styles: {}
    };

    const initializeUniver = async () => {
      try {
        console.log(`🚀 Initializing Univer instance for ${props.spreadsheetName} (${props.spreadsheetId})...`);

        // Store references to functions for menu commands
        const emitFunction = emit;
        const saveFunction = manualSave;

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
        univer.registerPlugin(UniverSheetsFormulaPlugin);
        univer.registerPlugin(UniverSheetsFormulaUIPlugin);
        univer.registerPlugin(UniverSheetsNumfmtUIPlugin);

        // Add custom menu directly using Univer's injector (official documentation pattern)
        try {
          console.log(`🎯 Adding custom menu using official pattern for ${props.spreadsheetId}...`);
          
          // Wait for Univer to be fully initialized
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Try to get the injector through different methods
          let injector = null;
          
          // Method 1: Try the internal injector property
          if (univer._injector) {
            injector = univer._injector;
            console.log('✅ Got injector from _injector property');
          }
          // Method 2: Try through context
          else if (univer.getContext && univer.getContext().injector) {
            injector = univer.getContext().injector;
            console.log('✅ Got injector from context');
          }
          // Method 3: Try accessing it differently
          else if (univer.__container) {
            injector = univer.__container;
            console.log('✅ Got injector from __container property');
          }
          
          if (!injector) {
            console.warn('⚠️ Could not access injector, custom menu will not be added');
            return;
          }
          
          // Import custom menu dependencies
          const { ICommandService, CommandType } = await import('@univerjs/core');
          const { ComponentManager, IMenuManagerService, RibbonStartGroup, MenuItemType } = await import('@univerjs/ui');
          
          // Get services
          const commandService = injector.get(ICommandService);
          const menuManagerService = injector.get(IMenuManagerService);
          const componentManager = injector.get(ComponentManager);
          
          console.log('✅ Got all required services from injector');
          
          // Define custom commands
          const SINGLE_BUTTON_OPERATION = {
            id: 'custom-menu.operation.single-button',
            type: CommandType.OPERATION,
            handler: async () => {
              // Quick save functionality
              console.log('⚡ Quick save triggered from toolbar button');
              try {
                await saveFunction();
                console.log('✅ Quick save completed successfully');
              } catch (error) {
                console.error('❌ Quick save failed:', error);
              }
              return true;
            },
          };
          
          const DROPDOWN_FIRST_ITEM_OPERATION = {
            id: 'custom-menu.operation.dropdown-list-first-item',
            type: CommandType.OPERATION,
            handler: async () => {
              // Save spreadsheet functionality
              console.log('💾 Save operation triggered from dropdown menu');
              try {
                await saveFunction();
                console.log('✅ Save operation completed successfully');
              } catch (error) {
                console.error('❌ Save operation failed:', error);
              }
              return true;
            },
          };
          
          const DROPDOWN_SECOND_ITEM_OPERATION = {
            id: 'custom-menu.operation.dropdown-list-second-item',
            type: CommandType.OPERATION,
            handler: async () => {
              // Delete spreadsheet functionality
              console.log('🗑️ Delete operation triggered from dropdown menu');
              if (props.canRemove) {
                try {
                  // Directly emit the delete event - parent component will handle confirmation
                  emitFunction('remove-spreadsheet', props.spreadsheetId);
                  console.log('✅ Delete operation initiated successfully');
                } catch (error) {
                  console.error('❌ Delete operation failed:', error);
                }
              } else {
                alert('Cannot delete the last spreadsheet in a portfolio');
                console.log('⚠️ Delete operation blocked - last spreadsheet in portfolio');
              }
              return true;
            },
          };
          
          const CUSTOM_MENU_DROPDOWN_LIST_OPERATION_ID = 'custom-menu.operation.dropdown-list';
          
          // Register commands
          commandService.registerCommand(SINGLE_BUTTON_OPERATION);
          commandService.registerCommand(DROPDOWN_FIRST_ITEM_OPERATION);
          commandService.registerCommand(DROPDOWN_SECOND_ITEM_OPERATION);
          console.log('✅ Custom menu commands registered');
          
          // Register simple icon components (using createElement directly)
          const QuickSaveIcon = () => {
            const React = window.React || window['React'];
            if (!React) {
              return null;
            }
            return React.createElement('svg', {
              width: 16, height: 16, viewBox: '0 0 24 24', fill: 'currentColor'
            }, React.createElement('path', {
              d: 'M15 9H5V5H15M12 19C15.87 19 19 15.87 19 12S15.87 5 12 5C8.13 5 5 8.13 5 12S8.13 19 12 19M12 2C17.5 2 22 6.5 22 12S17.5 22 12 22 2 17.5 2 12 6.5 2 12 2M9 16L14 11L12.59 9.59L9 13.17L7.41 11.59L6 13L9 16Z'
            }));
          };
          
          const SaveIcon = () => {
            const React = window.React || window['React'];
            if (!React) {
              return null;
            }
            return React.createElement('svg', {
              width: 16, height: 16, viewBox: '0 0 24 24', fill: 'currentColor'
            }, React.createElement('path', {
              d: 'M17 3H5C3.89 3 3 3.9 3 5V19C3 20.1 3.89 21 5 21H19C20.1 21 21 20.1 21 19V7L17 3M19 19H5V5H16.17L19 7.83V19M12 12C13.66 12 15 13.34 15 15S13.66 18 12 18 9 16.66 9 15 10.34 12 12 12'
            }));
          };
          
          const DeleteIcon = () => {
            const React = window.React || window['React'];
            if (!React) {
              return null;
            }
            return React.createElement('svg', {
              width: 16, height: 16, viewBox: '0 0 24 24', fill: 'currentColor'
            }, React.createElement('path', {
              d: 'M19 4H15.5L14.5 3H9.5L8.5 4H5V6H19M6 19C6 20.1 6.9 21 8 21H16C17.1 21 18 20.1 18 19V7H6V19Z'
            }));
          };
          
          const MainButtonIcon = () => {
            const React = window.React || window['React'];
            if (!React) {
              return null;
            }
            return React.createElement('svg', {
              width: 16, height: 16, viewBox: '0 0 24 24', fill: 'currentColor'
            }, React.createElement('path', {
              d: 'M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z'
            }));
          };
          
          componentManager.register('QuickSaveIcon', QuickSaveIcon);
          componentManager.register('SaveIcon', SaveIcon);
          componentManager.register('DeleteIcon', DeleteIcon);
          componentManager.register('MainButtonIcon', MainButtonIcon);
          console.log('✅ Custom menu components registered');
          
          // Register menu items using proper factory functions
          menuManagerService.mergeMenu({
            [RibbonStartGroup.OTHERS]: {
              [SINGLE_BUTTON_OPERATION.id]: {
                order: 10,
                menuItemFactory: () => ({
                  id: SINGLE_BUTTON_OPERATION.id,
                  type: MenuItemType.BUTTON,
                  title: 'Quick Save',
                  icon: 'QuickSaveIcon',
                  tooltip: 'Save spreadsheet instantly',
                }),
              },
              [CUSTOM_MENU_DROPDOWN_LIST_OPERATION_ID]: {
                order: 11,
                menuItemFactory: () => ({
                  id: CUSTOM_MENU_DROPDOWN_LIST_OPERATION_ID,
                  type: MenuItemType.SUBITEMS,
                  icon: 'MainButtonIcon',
                  tooltip: 'Spreadsheet Actions (Save & Delete)',
                  title: 'Actions',
                }),
                [DROPDOWN_FIRST_ITEM_OPERATION.id]: {
                  order: 0,
                  menuItemFactory: () => ({
                    id: DROPDOWN_FIRST_ITEM_OPERATION.id,
                    type: MenuItemType.BUTTON,
                    title: 'Save',
                    icon: 'SaveIcon',
                  }),
                },
                [DROPDOWN_SECOND_ITEM_OPERATION.id]: {
                  order: 1,
                  menuItemFactory: () => ({
                    id: DROPDOWN_SECOND_ITEM_OPERATION.id,
                    type: MenuItemType.BUTTON,
                    title: 'Delete',
                    icon: 'DeleteIcon',
                  }),
                },
              },
            },
          });
          
          console.log('✅ Custom menu items registered');
          console.log(`🎯 Custom dropdown menu should now appear in Univer toolbar for ${props.spreadsheetId}!`);
          
        } catch (error) {
          console.warn(`⚠️ Failed to add custom menu for ${props.spreadsheetId}:`, error);
          console.error('Error details:', error);
        }

        // TASKSTATUS formula processor - fetches real task status from database
        const processTaskStatusFormulas = async () => {
          try {
            const currentData = getCurrentSpreadsheetData();
            if (!currentData || !currentData.sheets) return;
            
            let processedCount = 0;
            let needsReload = false;
            
            // Helper function to format status for display
            const formatTaskStatus = (status) => {
              const statusMap = {
                'not_started': 'Not Started',
                'in_progress': 'In Progress',
                'awaiting_external': 'Awaiting External',
                'awaiting_internal': 'Awaiting Internal',
                'completed': 'Completed'
              };
              return statusMap[status] || status || 'Unknown';
            };
            
            // Process each sheet
            for (const sheetId of Object.keys(currentData.sheets)) {
              const sheet = currentData.sheets[sheetId];
              if (!sheet.cellData) continue;
              
              // Process each row
              for (const row of Object.keys(sheet.cellData)) {
                // Process each column
                for (const col of Object.keys(sheet.cellData[row])) {
                  const cell = sheet.cellData[row][col];
                  if (cell && cell.f && typeof cell.f === 'string') {
                    const formula = cell.f.trim();
                    const taskStatusMatch = formula.match(/^=TASKSTATUS\((\d+)\)$/i);
                    
                    if (taskStatusMatch) {
                      const taskId = parseInt(taskStatusMatch[1], 10);
                      if (!isNaN(taskId)) {
                        try {
                          console.log(`🔍 Fetching status for task ID: ${taskId} at [${row}, ${col}] (${props.spreadsheetId})`);
                          
                          // Fetch task from database
                          const task = await taskStore.getTaskById(taskId);
                          
                          if (task && task.status) {
                            const formattedStatus = formatTaskStatus(task.status);
                            
                            // Update the cell value and remove formula
                            cell.v = formattedStatus;
                            delete cell.f;
                            
                            console.log(`✅ Processed TASKSTATUS(${taskId}) → "${formattedStatus}" at [${row}, ${col}] (${props.spreadsheetId})`);
                            
                            // Show user notification
                            ElMessage.success(`Task ${taskId} status: ${formattedStatus}`);
                            
                            processedCount++;
                            needsReload = true;
                          } else {
                            // Task not found or has no status
                            cell.v = 'Task Not Found';
                            delete cell.f;
                            
                            console.warn(`⚠️ Task ${taskId} not found or has no status (${props.spreadsheetId})`);
                            ElMessage.warning(`Task ${taskId} not found or not accessible`);
                            
                            processedCount++;
                            needsReload = true;
                          }
                        } catch (fetchError) {
                          console.error(`❌ Error fetching task ${taskId}:`, fetchError);
                          
                          // Update cell with error message
                          cell.v = 'Access Denied';
                          delete cell.f;
                          
                          ElMessage.error(`Cannot access task ${taskId}: ${fetchError.message || 'Permission denied'}`);
                          
                          processedCount++;
                          needsReload = true;
                        }
                      }
                    }
                  }
                }
              }
            }
            
            if (needsReload) {
              console.log(`📊 Processed ${processedCount} TASKSTATUS formulas (${props.spreadsheetId})`);
              
              // Update portfolio data
              portfolioData.value = { ...currentData };
              
              // Save to database
              try {
                await savePortfolioData(currentData);
                console.log(`💾 Saved processed formulas to database (${props.spreadsheetId})`);
              } catch (saveError) {
                console.warn(`⚠️ Could not save processed data (${props.spreadsheetId}):`, saveError.message);
              }
              
              // Trigger data refresh
              console.log(`🔄 Task status data updated, will reflect on next reload (${props.spreadsheetId})`);
            }
          } catch (error) {
            console.error(`❌ Error processing TASKSTATUS formulas (${props.spreadsheetId}):`, error);
          }
        };
        
        // Start monitoring for TASKSTATUS formulas
        console.log(`🔧 Starting TASKSTATUS formula processor (${props.spreadsheetId})...`);

        // Create workbook with loaded data and styles
        console.log(`📊 Creating Univer workbook with loaded data and ${Object.keys(WORKBOOK_DATA.styles || {}).length} styles...`);
        univer.createUnit(UniverInstanceType.UNIVER_SHEET, WORKBOOK_DATA);

        // Start formula processing after workbook is created
        setTimeout(() => {
          // Process immediately
          processTaskStatusFormulas();
          
          // Then process every 2 seconds for faster response
          const formulaInterval = setInterval(processTaskStatusFormulas, 2000);
          
          // Store interval for cleanup
          if (!window.taskStatusIntervals) window.taskStatusIntervals = new Map();
          window.taskStatusIntervals.set(props.spreadsheetId, formulaInterval);
          
          console.log(`✅ TASKSTATUS formula processor started - checks every 2 seconds (${props.spreadsheetId})`);
          console.log(`📋 TASKSTATUS Usage: Type "=TASKSTATUS(2464)" in any cell to get the status of task 2464. Wait 2 seconds, then refresh or navigate away and back to see the actual task status.`);
        }, 1000);

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
      // Clean up TASKSTATUS formula processor
      if (window.taskStatusIntervals && window.taskStatusIntervals.has(props.spreadsheetId)) {
        clearInterval(window.taskStatusIntervals.get(props.spreadsheetId));
        window.taskStatusIntervals.delete(props.spreadsheetId);
        console.log(`🧹 Cleaned up TASKSTATUS processor for ${props.spreadsheetId}`);
      }
      
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
  /*width: 100%;*/
  margin-bottom: 8px;
  background: #f5f7fa;
  border-radius: 8px;
  padding: 12px;
  position: relative;
}

.spreadsheet-container {
  position: relative;
  width: 100%;
}

.univer-container {
  width: 100%;
  background: white;
  border: 1px solid #e0e6ed;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

/* Animations for smooth transitions */
</style> 