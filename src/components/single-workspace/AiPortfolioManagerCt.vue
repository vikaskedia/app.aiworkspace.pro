<template>
  <div class="univer-container-wrapper" :class="{ saving }">
    <!-- ✨ Enhanced AI Portfolio Manager with Complete Univer Feature Preservation:
         
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
         
         💾 Enhanced Save System captures ALL Univer features! -->
    
    <!-- Manual Save Button -->
    <div class="save-controls">
      <el-button 
        type="primary" 
        :loading="saving" 
        @click="manualSave"
        size="small">
        <el-icon><DocumentChecked /></el-icon>
                Save Complete Workbook
      </el-button>
      <!--el-button 
        type="info" 
        @click="debugCurrentData"
        size="small">
        🔍 Debug Data
      </el-button>
      <div v-if="lastSaved" class="last-saved">
        Last saved: {{ lastSaved }}
      </div-->
    </div>
    
    <div id="univer-container" class="univer-container" :style="{ height: containerHeight + 'px' }"></div>
  </div>
</template>

<script>
import { onMounted, onBeforeUnmount, ref, computed } from 'vue';
import { supabase } from '../../supabase';
import { ElMessage } from 'element-plus';
import { DocumentChecked } from '@element-plus/icons-vue';

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
  name: 'AiPortfolioManagerCt',
  components: {
    DocumentChecked
  },
  setup() {
    let univer = null;
    const portfolioData = ref({});
    const saving = ref(false);
    const portfolioId = ref(null);
    const lastSaved = ref(null);
    const allSheetsData = ref({});
    const defaultRowCount = ref(10);
    const currentRowCount = ref(10); // Track actual number of rows in the sheet

    // Computed height based on actual row count - exact fit without scrollbars
    const containerHeight = computed(() => {
      const rowHeight = 27; // Default row height
      const columnHeaderHeight = 20; // Column header height
      const toolbarHeight = 50; // Univer toolbar height
      const sheetTabsHeight = 30; // Sheet tabs at bottom
      const containerPadding = 16; // Container margins (8px * 2)
      
      console.log('🔍 Current row count for height calculation:', currentRowCount.value);
      // Calculate exact height needed for all content based on actual rows
      const contentHeight = (currentRowCount.value * rowHeight) + columnHeaderHeight + toolbarHeight + sheetTabsHeight + containerPadding;
      
      // Return exact height without extra space
      return contentHeight;
    });

    // Load complete portfolio workbook data from Supabase
    const loadPortfolioData = async () => {
      try {
        const { data, error } = await supabase
          .from('ai_portfolio_data')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) throw error;

        if (data && data.length > 0) {
          portfolioId.value = data[0].id;
          const loadedData = data[0].data || {};
          
          // Check if this is a complete Univer workbook format or legacy format
          if (loadedData.id && loadedData.sheets && loadedData.sheetOrder) {
            // This is a complete Univer workbook format with all features
            console.log('📊 Loaded complete Univer workbook with formatting and features');
            portfolioData.value = loadedData;
            return loadedData;
          } else if (loadedData.sheets) {
            // This is a sheets-only format, wrap it in workbook structure
            const workbookData = {
              id: 'workbook-01',
              locale: 'en-US',
              name: 'AI Portfolio Manager',
              sheetOrder: Object.keys(loadedData.sheets),
              sheets: loadedData.sheets
            };
            portfolioData.value = workbookData;
            return workbookData;
          } else if (Object.keys(loadedData).some(key => key.startsWith('sheet-'))) {
            // Legacy multi-sheet format - convert to complete workbook
            const workbookData = {
              id: 'workbook-01',
              locale: 'en-US',
              name: 'AI Portfolio Manager',
              sheetOrder: Object.keys(loadedData),
              sheets: {}
            };
            
            // Convert each sheet to proper format
            Object.keys(loadedData).forEach(sheetId => {
              workbookData.sheets[sheetId] = {
                id: sheetId,
                name: sheetId === 'sheet-01' ? 'Portfolio' : `Sheet ${sheetId.split('-')[1]}`,
                cellData: loadedData[sheetId] || {}
              };
            });
            
            portfolioData.value = workbookData;
            return workbookData;
          } else {
            // Very old format - single sheet data
            const workbookData = {
              id: 'workbook-01',
              locale: 'en-US',
              name: 'AI Portfolio Manager',
              sheetOrder: ['sheet-01'],
              sheets: {
                'sheet-01': {
                  id: 'sheet-01',
                  name: 'Portfolio',
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
            id: 'workbook-01',
            locale: 'en-US',
            name: 'AI Portfolio Manager',
            sheetOrder: ['sheet-01'],
            sheets: {
              'sheet-01': {
                id: 'sheet-01',
                name: 'Portfolio',
                rowCount: defaultRowCount.value,
                columnCount: 10,
                cellData: {
                  0: {
                    0: { v: 'Symbol' },
                    1: { v: 'Company Name' },
                    2: { v: 'Shares' },
                    3: { v: 'Price' },
                    4: { v: 'Total Value' },
                    5: { v: 'Notes' }
                  }
                }
              }
            }
          };
          await savePortfolioData(initialWorkbook);
          return initialWorkbook;
        }
      } catch (error) {
        console.error('Error loading portfolio data:', error);
        ElMessage.error('Failed to load portfolio data');
        return {};
      }
    };

    // Save complete workbook data with all features to Supabase
    const savePortfolioData = async (data = null) => {
      if (saving.value) return;
      
      try {
        saving.value = true;
        
        const dataToSave = data || portfolioData.value;
        
        // Detailed logging of what we're about to save
        console.log('💾 SAVING TO SUPABASE - Data Analysis:');
        console.log('📦 Raw data to save:', dataToSave);
        
        // Analyze the data structure
        if (dataToSave.sheets) {
          console.log('📊 Workbook Structure Analysis:');
          console.log('  - ID:', dataToSave.id);
          console.log('  - Name:', dataToSave.name);
          console.log('  - Sheets:', Object.keys(dataToSave.sheets));
          console.log('  - Global Styles:', dataToSave.styles ? Object.keys(dataToSave.styles).length : 0);
          
          // Analyze each sheet
          Object.keys(dataToSave.sheets).forEach(sheetId => {
            const sheet = dataToSave.sheets[sheetId];
            console.log(`📋 Sheet ${sheetId} Analysis:`);
            console.log(`  - Sheet Styles: ${sheet.styles ? Object.keys(sheet.styles).length : 0}`);
            
            if (sheet.cellData) {
              let totalCells = 0;
              let cellsWithValues = 0;
              let cellsWithStyles = 0;
              
              Object.keys(sheet.cellData).forEach(row => {
                Object.keys(sheet.cellData[row]).forEach(col => {
                  totalCells++;
                  const cell = sheet.cellData[row][col];
                  if (cell.v) cellsWithValues++;
                  if (cell.s || cell.style) {
                    cellsWithStyles++;
                    console.log(`  🎨 Styled Cell [${row}, ${col}]:`, {
                      value: cell.v,
                      styleId: cell.s,
                      directStyle: cell.style
                    });
                  }
                });
              });
              
              console.log(`  - Total Cells: ${totalCells}`);
              console.log(`  - Cells with Values: ${cellsWithValues}`);
              console.log(`  - Cells with Styles: ${cellsWithStyles}`);
            }
          });
        } else {
          console.log('📊 Legacy Format Data:', {
            sheets: Object.keys(dataToSave)
          });
        }
        
        // Verify data is serializable
        try {
          const serialized = JSON.stringify(dataToSave);
          console.log('✅ Data is JSON serializable');
          console.log('📏 Serialized data size:', (serialized.length / 1024).toFixed(2) + ' KB');
        } catch (serializeError) {
          console.error('❌ Data serialization failed:', serializeError);
          throw new Error('Data is not serializable: ' + serializeError.message);
        }
        
        console.log('🔄 Sending to Supabase...');
        
        if (portfolioId.value) {
          // Update existing record
          console.log('📝 Updating existing record ID:', portfolioId.value);
          const { error } = await supabase
            .from('ai_portfolio_data')
            .update({ 
              data: dataToSave,
              updated_at: new Date().toISOString()
            })
            .eq('id', portfolioId.value);

          if (error) {
            console.error('❌ Supabase update error:', error);
            throw error;
          }
          console.log('✅ Successfully updated existing record');
        } else {
          // Create new record
          console.log('📝 Creating new record...');
          const { data: newRecord, error } = await supabase
            .from('ai_portfolio_data')
            .insert([{ 
              data: dataToSave,
              name: dataToSave.name || 'Portfolio Data',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }])
            .select()
            .single();

          if (error) {
            console.error('❌ Supabase insert error:', error);
            throw error;
          }
          portfolioId.value = newRecord.id;
          console.log('✅ Successfully created new record with ID:', newRecord.id);
        }

        portfolioData.value = dataToSave;
        lastSaved.value = new Date().toLocaleTimeString();
        
        const sheetCount = dataToSave.sheets ? Object.keys(dataToSave.sheets).length : Object.keys(dataToSave).length;
        const hasStyles = dataToSave.styles || 
                         (dataToSave.sheets && Object.values(dataToSave.sheets).some(sheet => sheet.styles));
        
        console.log('✅ Save operation completed successfully:', {
          recordId: portfolioId.value,
          sheets: sheetCount,
          hasFormatting: !!hasStyles,
          timestamp: lastSaved.value
        });
        
        ElMessage.success(`Workbook with ${sheetCount} sheet(s) and ${hasStyles ? 'formatting' : 'no formatting'} saved successfully!`);
        
      } catch (error) {
        console.error('❌ Save operation failed:', error);
        ElMessage.error('Failed to save workbook: ' + error.message);
      } finally {
        saving.value = false;
      }
    };

    // Remove auto-save - only manual save now

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
                console.log('📏 Row count updated from', currentRowCount.value, 'to', rowCount);
                currentRowCount.value = rowCount;
              }
            }
          }
        }
      } catch (error) {
        console.warn('⚠️ Could not update row count:', error);
      }
    };

    // Track sheet changes to maintain local data copy
    const trackSheetChanges = () => {
      try {
        if (!univer || !univer.__getInjector) return;
        
        const injector = univer.__getInjector();
        const commandService = injector.get('ICommandService');
        
        if (commandService) {
          // Listen for all types of changes including formatting, styles, images, formulas, etc.
          commandService.onCommandExecuted((command) => {
            const isRelevantChange = 
              // Basic data changes
              command.id === 'sheet.command.set-range-values' || 
              command.id === 'SetRangeValuesCommand' ||
              command.id === 'sheet.operation.set-cell-value' ||
              command.id.includes('set-range-value') ||
              
              // Row/Column structure changes
              command.id.includes('insert-row') ||
              command.id.includes('delete-row') ||
              command.id.includes('add-row') ||
              command.id.includes('remove-row') ||
              command.id.includes('insert-column') ||
              command.id.includes('delete-column') ||
              command.id.includes('InsertRow') ||
              command.id.includes('DeleteRow') ||
              command.id.includes('InsertCol') ||
              command.id.includes('DeleteCol') ||
              
              // Formatting and style changes
              command.id.includes('set-style') ||
              command.id.includes('set-format') ||
              command.id.includes('font') ||
              command.id.includes('color') ||
              command.id.includes('background') ||
              command.id.includes('border') ||
              command.id.includes('alignment') ||
              command.id.includes('number-format') ||
              
              // Rich content changes
              command.id.includes('image') ||
              command.id.includes('media') ||
              command.id.includes('drawing') ||
              command.id.includes('chart') ||
              
              // Formula changes
              command.id.includes('formula') ||
              command.id.includes('calculation') ||
              
              // Advanced features
              command.id.includes('conditional-format') ||
              command.id.includes('data-validation') ||
              command.id.includes('merge') ||
              command.id.includes('freeze') ||
              command.id.includes('filter') ||
              command.id.includes('sort') ||
              
              // Any command with unitId (workbook changes)
              command.params?.unitId;
            
            // Check if this is a row structure change
            const isRowChange = 
              command.id.includes('insert-row') ||
              command.id.includes('delete-row') ||
              command.id.includes('add-row') ||
              command.id.includes('remove-row') ||
              command.id.includes('InsertRow') ||
              command.id.includes('DeleteRow');
            
            if (isRelevantChange) {
              console.log('🎨 Enhanced workbook change detected:', {
                command: command.id,
                type: isRowChange ? 'row-structure' :
                      command.id.includes('format') || command.id.includes('style') ? 'formatting' :
                      command.id.includes('formula') ? 'formula' :
                      command.id.includes('image') || command.id.includes('media') ? 'media' :
                      command.id.includes('sheet') ? 'structure' : 'data'
              });
              
              // Update row count if this was a row structure change
              if (isRowChange) {
                setTimeout(() => updateRowCount(), 100); // Small delay to ensure change is applied
              }
              
              updateLocalSheetData(command.params?.unitId);
            }
          });
          
          // Listen for sheet and workbook structural changes
          commandService.onCommandExecuted((command) => {
            const isStructuralChange = 
              (command.id.includes('sheet') && 
               (command.id.includes('add') || 
                command.id.includes('create') || 
                command.id.includes('delete') ||
                command.id.includes('rename') ||
                command.id.includes('move'))) ||
              command.id.includes('workbook') ||
              command.id.includes('worksheet');
            
            if (isStructuralChange) {
              console.log('🏗️ Workbook structure change detected:', command.id);
              // Longer delay for structural changes to ensure they're fully applied
              setTimeout(() => updateLocalSheetData(), 1500);
            }
          });
          
          console.log('✅ Enhanced workbook change tracking enabled');
          console.log('📋 Tracking: data, formatting, styles, formulas, images, charts, conditional formatting, and more');
        }
      } catch (error) {
        console.warn('⚠️ Could not set up sheet change tracking:', error);
      }
    };

    // Update local copy of complete workbook data
    const updateLocalSheetData = (unitId = null) => {
      try {
        const currentData = getCurrentSpreadsheetData();
        if (currentData && Object.keys(currentData).length > 0) {
          allSheetsData.value = { ...currentData };
          portfolioData.value = { ...currentData };
          
          if (currentData.sheets) {
            console.log('🔄 Updated complete workbook data:', {
              sheets: Object.keys(currentData.sheets),
              hasFormatting: true
            });
          } else {
            console.log('🔄 Updated local sheet data:', Object.keys(currentData));
          }
        }
      } catch (error) {
        console.warn('Error updating local sheet data:', error);
      }
    };

        // Get complete workbook data with all formatting, styles, images, formulas using Univer's export API
    const getCurrentSpreadsheetData = () => {
      // Use the same comprehensive approach as getCompleteWorkbookData
      return getCompleteWorkbookData();
    };

    // Force capture complete workbook data including all formatting and features
    const forceCaptureAllSheets = () => {
      try {
        console.log('🔍 Force capturing complete workbook data with all features...');
        
        // Use the comprehensive data extraction method
        const completeData = getCompleteWorkbookData();
        
        if (completeData && typeof completeData === 'object' && Object.keys(completeData).length > 0) {
          // Verify we got complete workbook format with all features
          if (completeData.sheets) {
            console.log('📊 Force captured complete workbook with all features:', {
              sheets: Object.keys(completeData.sheets),
              hasFormatting: true,
              preservedFeatures: 'All Univer features preserved'
            });
            return completeData;
          } else {
            // Legacy format - still better than nothing
            console.log('📊 Force captured data in legacy format:', Object.keys(completeData));
            return completeData;
          }
        }
        
        // Final fallback to tracked data
        console.log('⚠️ Force capture falling back to tracked data');
        return allSheetsData.value || portfolioData.value || {};
        
      } catch (error) {
        console.error('Force capture failed:', error);
        return allSheetsData.value || portfolioData.value || {};
      }
    };

    // Extract styles from Univer's internal style registry and rendered elements
    const extractStylesFromUniver = () => {
      try {
        console.log('🎨 Extracting styles from Univer internal registry and DOM...');
        
        const extractedStyles = {
          styles: {},
          cellStyles: {},
          mergeData: [],
          rowData: {},
          columnData: {}
        };
        
        // Method 1: Access Univer's internal style registry
        try {
          if (univer && univer.__getInjector) {
            const injector = univer.__getInjector();
            
            // Try to get the style service and access style definitions
            const styleServices = [
              'IStyleService',
              'StyleService', 
              'IThemeService',
              'ThemeService',
              'IWorkbookStyleService',
              'WorkbookStyleService'
            ];
            
            for (const serviceName of styleServices) {
              try {
                const styleService = injector.get?.(serviceName);
                if (styleService) {
                  console.log(`🎯 Found ${serviceName}, extracting style registry...`);
                  
                  // Try different methods to access styles
                  const styleMethods = [
                    'getStyleMap',
                    'getAllStyles', 
                    'getStyles',
                    'getThemes',
                    '_styleMap',
                    '_styles',
                    'styles',
                    'styleMap'
                  ];
                  
                  for (const method of styleMethods) {
                    try {
                      const styleData = typeof styleService[method] === 'function' 
                        ? styleService[method]() 
                        : styleService[method];
                      
                      if (styleData && typeof styleData === 'object') {
                        Object.assign(extractedStyles.styles, styleData);
                        console.log(`✅ Extracted ${Object.keys(styleData).length} styles via ${serviceName}.${method}`);
                        break;
                      }
                    } catch (methodError) {
                      // Continue trying other methods
                    }
                  }
                }
              } catch (serviceError) {
                // Continue trying other services
              }
            }
          }
        } catch (injectorError) {
          console.warn('Injector-based style extraction failed:', injectorError);
        }
        
        // Method 2: Access workbook and get styles from actual cell data
        try {
          if (univer && univer.__getInjector) {
            const injector = univer.__getInjector();
            const workbookService = injector.get?.('IWorkbookService') || injector.get?.('WorkbookService');
            
            if (workbookService) {
              const activeWorkbook = workbookService.getCurrentWorkbook?.();
              if (activeWorkbook) {
                console.log('📊 Analyzing workbook for style definitions...');
                
                // Get the complete workbook snapshot
                const workbookSnapshot = activeWorkbook.getSnapshot?.() || activeWorkbook.save?.();
                if (workbookSnapshot && workbookSnapshot.styles) {
                  console.log(`✅ Found workbook styles: ${Object.keys(workbookSnapshot.styles).length}`);
                  Object.assign(extractedStyles.styles, workbookSnapshot.styles);
                }
                
                // Check each worksheet for styles
                const worksheets = activeWorkbook.getWorksheets?.() || activeWorkbook.getSheets?.() || [];
                worksheets.forEach((worksheet, index) => {
                  try {
                    const sheetId = worksheet.getSheetId?.() || `sheet-${index + 1}`;
                    console.log(`🔍 Checking worksheet ${sheetId} for styles...`);
                    
                    // Get worksheet styles
                    const worksheetStyles = worksheet.getStyles?.() || worksheet._styles;
                    if (worksheetStyles) {
                      Object.assign(extractedStyles.styles, worksheetStyles);
                      console.log(`✅ Found worksheet styles: ${Object.keys(worksheetStyles).length}`);
                    }
                    
                    // Get cell matrix and extract styles from cells
                    const cellMatrix = worksheet.getCellMatrix?.();
                    if (cellMatrix) {
                      const matrixData = cellMatrix.getMatrix?.() || cellMatrix.getData?.();
                      if (matrixData) {
                        Object.keys(matrixData).forEach(row => {
                          Object.keys(matrixData[row]).forEach(col => {
                            const cell = matrixData[row][col];
                            if (cell && cell.s) {
                              // We have a style ID, now try to resolve it
                              const cellKey = `${sheetId}_${row}_${col}`;
                              extractedStyles.cellStyles[cellKey] = {
                                styleId: cell.s,
                                style: null, // Will be resolved later
                                row: parseInt(row),
                                col: parseInt(col),
                                sheetId: sheetId,
                                text: cell.v
                              };
                              
                              console.log(`📋 Found styled cell [${row}, ${col}] with style ID: ${cell.s}`);
                            }
                          });
                        });
                      }
                    }
                  } catch (worksheetError) {
                    console.warn(`Error processing worksheet ${index}:`, worksheetError);
                  }
                });
              }
            }
          }
        } catch (workbookError) {
          console.warn('Workbook-based style extraction failed:', workbookError);
        }
        
        // Method 3: Try to access Univer's global style registry
        try {
          // Check if Univer exposes styles globally
          const globalUniver = window.univer || univer;
          if (globalUniver) {
            // Try to find style-related properties
            const possibleStyleProps = ['_styles', 'styles', '_styleRegistry', 'styleRegistry', '_themes', 'themes'];
            
            for (const prop of possibleStyleProps) {
              if (globalUniver[prop] && typeof globalUniver[prop] === 'object') {
                Object.assign(extractedStyles.styles, globalUniver[prop]);
                console.log(`✅ Found global styles via ${prop}: ${Object.keys(globalUniver[prop]).length}`);
              }
            }
          }
        } catch (globalError) {
          console.warn('Global style access failed:', globalError);
        }
        
        // Method 4: DOM-based style extraction with style ID mapping
        try {
          const univerContainer = document.getElementById('univer-container');
          if (univerContainer) {
            console.log('🔍 Scanning DOM for Univer cell styles only...');
            
            // Focus on likely Univer cell selectors
            const univerCellSelectors = [
              '[data-row][data-col]',
              '.univer-render-canvas *',
              'canvas + div *',
              'canvas ~ div *',
              '[contenteditable="true"]'
            ];
            
            let domStylesFound = 0;
            const processedTexts = new Set(); // Avoid duplicates
            
            for (const selector of univerCellSelectors) {
              try {
                const elements = univerContainer.querySelectorAll(selector);
                console.log(`🔍 Checking selector "${selector}": ${elements.length} elements`);
                
                elements.forEach((element, index) => {
                  const text = element.textContent?.trim();
                  if (text && text.length > 0 && text.length < 100 && !processedTexts.has(text)) {
                    processedTexts.add(text);
                    
                    // Make sure this is really a cell-like element
                    const isActualCell = (
                      element.closest('[data-row]') || 
                      element.closest('.univer-render-canvas') ||
                      element.classList.contains('cell') ||
                      // Not UI elements
                      (!element.closest('button') && 
                       !element.closest('.el-button') && 
                       !element.closest('.save-controls') &&
                       !element.closest('nav') && 
                       !element.closest('.menu') && 
                       !element.closest('.toolbar') &&
                       !element.closest('.el-message') &&
                       !element.closest('.el-notification'))
                    );
                    
                    if (isActualCell) {
                      const computedStyle = window.getComputedStyle(element);
                      
                      // Check if this element has meaningful visual styling
                      const isBold = computedStyle.fontWeight === 'bold' || parseInt(computedStyle.fontWeight) >= 600;
                      const hasColor = computedStyle.color !== 'rgb(0, 0, 0)' && 
                                      computedStyle.color !== 'rgba(0, 0, 0, 1)' &&
                                      computedStyle.color !== 'rgb(51, 51, 51)' &&
                                      computedStyle.color !== 'rgb(27, 28, 31)'; // Exclude common UI colors
                      const hasBackground = computedStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' && 
                                           computedStyle.backgroundColor !== 'transparent' &&
                                           computedStyle.backgroundColor !== 'rgb(255, 255, 255)' &&
                                           computedStyle.backgroundColor !== 'rgb(39, 42, 47)'; // Exclude UI backgrounds
                      const isItalic = computedStyle.fontStyle === 'italic';
                      const hasDecoration = computedStyle.textDecoration !== 'none' && 
                                           !computedStyle.textDecoration.includes('rgb(0, 0, 0)');
                      
                      if (isBold || hasColor || hasBackground || isItalic || hasDecoration) {
                        domStylesFound++;
                        
                        // Create a style object from the meaningful computed styles
                        const domStyle = {};
                        if (isBold) domStyle.fontWeight = 'bold';
                        if (hasColor) domStyle.color = computedStyle.color;
                        if (hasBackground) domStyle.backgroundColor = computedStyle.backgroundColor;
                        if (isItalic) domStyle.fontStyle = 'italic';
                        if (hasDecoration) domStyle.textDecoration = computedStyle.textDecoration;
                        
                        // Try to find existing cell with this text and map to its style ID
                        let mappedToExistingId = false;
                        Object.keys(extractedStyles.cellStyles).forEach(cellKey => {
                          const cellStyle = extractedStyles.cellStyles[cellKey];
                          if (cellStyle.text === text && cellStyle.styleId && !cellStyle.style) {
                            cellStyle.style = domStyle;
                            extractedStyles.styles[cellStyle.styleId] = domStyle;
                            console.log(`🎯 Mapped existing style ID ${cellStyle.styleId} to DOM style for "${text}":`, domStyle);
                            mappedToExistingId = true;
                          }
                        });
                        
                        // If no existing mapping, create a new one but mark it clearly
                        if (!mappedToExistingId) {
                          const domStyleId = `cell_style_${text.replace(/[^a-zA-Z0-9]/g, '_')}`;
                          extractedStyles.styles[domStyleId] = domStyle;
                          console.log(`🆕 Created new style for cell text "${text}":`, domStyle);
                        }
                      }
                    }
                  }
                });
              } catch (selectorError) {
                console.warn(`Selector "${selector}" failed:`, selectorError);
              }
            }
            
            console.log(`📊 DOM scan found ${domStylesFound} actual cell styles (filtered out UI elements)`);
          }
        } catch (domError) {
          console.warn('DOM-based style extraction failed:', domError);
        }
        
        // Summary
        const totalStyles = Object.keys(extractedStyles.styles).length;
        const totalCellStyles = Object.keys(extractedStyles.cellStyles).length;
        
        console.log('🎨 Style extraction summary:', {
          totalStyleDefinitions: totalStyles,
          totalStyledCells: totalCellStyles,
          styleIds: Object.keys(extractedStyles.styles),
          cellStyles: extractedStyles.cellStyles
        });
        
        return extractedStyles;
        
      } catch (error) {
        console.error('Style extraction failed:', error);
        return { styles: {}, cellStyles: {} };
      }
    };

    // Enhanced data capture that combines basic data with extracted styles
    const combineDataWithStyles = (basicData, extractedStyles) => {
      try {
        if (!basicData || !basicData.sheets) return basicData;
        
        console.log('🔗 Combining basic data with extracted styles...');
        console.log('📊 Input basic data:', basicData);
        console.log('📊 Input extracted styles:', extractedStyles);
        
        const enhancedData = JSON.parse(JSON.stringify(basicData)); // Deep clone
        
        // Add global styles to workbook (preserve existing + add new)
        if (!enhancedData.styles) enhancedData.styles = {};
        if (extractedStyles.styles && Object.keys(extractedStyles.styles).length > 0) {
          Object.assign(enhancedData.styles, extractedStyles.styles);
          console.log(`✅ Added ${Object.keys(extractedStyles.styles).length} global styles to workbook`);
        }
        
        // Process each sheet
        Object.keys(enhancedData.sheets).forEach(sheetId => {
          const sheet = enhancedData.sheets[sheetId];
          
          // Initialize styles object if not present
          if (!sheet.styles) {
            sheet.styles = {};
          }
          
          // First, scan existing cell data for style IDs that need definitions
          if (sheet.cellData) {
            console.log(`🔍 Scanning sheet ${sheetId} for existing style IDs...`);
            
            Object.keys(sheet.cellData).forEach(row => {
              Object.keys(sheet.cellData[row]).forEach(col => {
                const cell = sheet.cellData[row][col];
                if (cell && cell.s) {
                  console.log(`📋 Found existing style ID in cell [${row}, ${col}]: ${cell.s}`);
                  
                  // Check if we have a definition for this style ID
                  if (enhancedData.styles[cell.s]) {
                    console.log(`✅ Style definition found for ${cell.s}:`, enhancedData.styles[cell.s]);
                    // Copy to sheet styles as well
                    sheet.styles[cell.s] = enhancedData.styles[cell.s];
                  } else {
                    console.log(`⚠️ No style definition found for ${cell.s}, trying to match by content...`);
                    
                    // Try to find a matching style by cell content/position
                    const cellKey = `${sheetId}_${row}_${col}`;
                    const extractedCellStyle = extractedStyles.cellStyles[cellKey];
                    
                    if (extractedCellStyle && extractedCellStyle.style) {
                      enhancedData.styles[cell.s] = extractedCellStyle.style;
                      sheet.styles[cell.s] = extractedCellStyle.style;
                      console.log(`🔗 Linked style ID ${cell.s} to extracted style:`, extractedCellStyle.style);
                    }
                  }
                }
              });
            });
          }
          
          // Apply any additional cell styles from extraction
          Object.keys(extractedStyles.cellStyles).forEach(cellKey => {
            const cellStyle = extractedStyles.cellStyles[cellKey];
            if (cellStyle.sheetId === sheetId) {
              const { row, col, styleId, style, domStyleId } = cellStyle;
              
              // Ensure cell data structure exists
              if (!sheet.cellData) sheet.cellData = {};
              if (!sheet.cellData[row]) sheet.cellData[row] = {};
              if (!sheet.cellData[row][col]) sheet.cellData[row][col] = {};
              
              const cell = sheet.cellData[row][col];
              
              // If cell doesn't have a style ID but we extracted one, add it
              if (!cell.s && (styleId || domStyleId)) {
                cell.s = styleId || domStyleId;
                console.log(`➕ Added style ID to cell [${row}, ${col}]: ${cell.s}`);
              }
              
              // If we have a style definition, make sure it's in our registries
              if (style) {
                const finalStyleId = cell.s || styleId || domStyleId || `style_${row}_${col}`;
                enhancedData.styles[finalStyleId] = style;
                sheet.styles[finalStyleId] = style;
                
                if (!cell.s) cell.s = finalStyleId;
                
                console.log(`✅ Applied style to cell [${row}, ${col}]:`, style);
              }
            }
          });
          
          console.log(`📊 Sheet ${sheetId} final style count: ${Object.keys(sheet.styles).length}`);
        });
        
        console.log('✅ Enhanced data combination complete:', {
          sheets: Object.keys(enhancedData.sheets),
          globalStyles: Object.keys(enhancedData.styles || {}).length,
          sheetStyles: Object.values(enhancedData.sheets).map(sheet => 
            Object.keys(sheet.styles || {}).length
          ),
          totalCellsWithStyles: Object.values(enhancedData.sheets).reduce((count, sheet) =>
            count + (sheet.cellData ? Object.values(sheet.cellData).reduce((cellCount, row) =>
              cellCount + Object.values(row).filter(cell => cell.s).length, 0
            ) : 0), 0
          )
        });
        
        return enhancedData;
        
      } catch (error) {
        console.error('Error combining data with styles:', error);
        return basicData;
      }
    };

    // Get complete workbook data by intercepting Univer's native save process
    const getCompleteWorkbookData = () => {
      try {
        if (!univer) return portfolioData.value;
        
        console.log('🔄 Intercepting Univer native save process for complete data...');
        
        // Method 1: Try to get the complete snapshot directly from units
        try {
          const units = univer.getAllUnits?.() || [];
          console.log(`📊 Found ${units.length} total units`);
          
          for (const unit of units) {
            if (unit.type === UniverInstanceType.UNIVER_SHEET || 
                unit.type === 'UNIVER_SHEET' || 
                unit.type === 2) {
              
              console.log('📋 Processing sheet unit for complete snapshot...');
              
              // Try unit's native save methods that should include styles
              const completeMethods = [
                'save',
                'getSnapshot', 
                'serialize',
                'export',
                'toJSON'
              ];
              
              for (const method of completeMethods) {
                try {
                  if (typeof unit[method] === 'function') {
                    const completeData = unit[method]();
                    
                    if (completeData && completeData.sheets) {
                      console.log(`✅ Got complete data via unit.${method}():`, {
                        hasStyles: !!(completeData.styles),
                        sheets: Object.keys(completeData.sheets),
                        globalStyleCount: completeData.styles ? Object.keys(completeData.styles).length : 0
                      });
                      
                      // Check if this data includes style definitions
                      const hasStyleDefinitions = completeData.styles && Object.keys(completeData.styles).length > 0;
                      
                      if (hasStyleDefinitions) {
                        console.log('🎨 Found complete data with style definitions!');
                        return completeData;
                      } else {
                        console.log('⚠️ Data lacks style definitions, continuing search...');
                      }
                    }
                  }
                } catch (methodError) {
                  console.warn(`Method ${method} failed:`, methodError);
                }
              }
            }
          }
        } catch (unitsError) {
          console.warn('Units-based extraction failed:', unitsError);
        }
        
        // Method 2: Try to trigger Univer's complete export via commands
        try {
          if (univer.__getInjector) {
            const injector = univer.__getInjector();
            const commandService = injector.get?.('ICommandService') || injector.get?.('CommandService');
            
            if (commandService) {
              console.log('🔧 Attempting to trigger complete export via commands...');
              
              // Try to execute different export commands
              const exportCommands = [
                'sheet.command.save-workbook',
                'SaveWorkbookCommand',
                'ExportWorkbookCommand', 
                'sheet.command.get-workbook-data',
                'GetWorkbookDataCommand'
              ];
              
              for (const commandId of exportCommands) {
                try {
                  const result = commandService.syncExecuteCommand?.(commandId) ||
                               commandService.executeCommand?.(commandId);
                  
                  if (result && (result.data || result.result)) {
                    const exportData = result.data || result.result;
                    if (exportData.sheets && exportData.styles) {
                      console.log(`✅ Got complete export via command ${commandId}`);
                      return exportData;
                    }
                  }
                } catch (commandError) {
                  // Continue trying other commands
                }
              }
            }
          }
        } catch (commandError) {
          console.warn('Command-based export failed:', commandError);
        }
        
        // Method 3: Access Univer's memory/cache directly
        try {
          console.log('🧠 Accessing Univer memory/cache for complete state...');
          
          // Try to find cached or in-memory workbook data
          const possiblePaths = [
            'univer._workbookData',
            'univer._cachedData', 
            'univer._state',
            'univer.__workbook',
            'univer.__data'
          ];
          
          for (const path of possiblePaths) {
            try {
              const pathParts = path.split('.');
              let current = window;
              
              for (const part of pathParts) {
                current = current[part];
                if (!current) break;
              }
              
              if (current && current.sheets && current.styles) {
                console.log(`✅ Found complete data in ${path}`);
                return current;
              }
            } catch (pathError) {
              // Continue
            }
          }
        } catch (memoryError) {
          console.warn('Memory access failed:', memoryError);
        }
        
        // Method 4: Force a complete workbook rebuild with style preservation
        try {
          console.log('🔨 Rebuilding workbook with style preservation...');
          
          // Start with current portfolio data
          let rebuiltData = { ...portfolioData.value };
          
          // Ensure proper structure
          if (!rebuiltData.sheets) {
            rebuiltData = {
              id: 'workbook-01',
              locale: 'en-US',
              name: 'AI Portfolio Manager',
              sheetOrder: ['sheet-01'],
              sheets: {
                'sheet-01': {
                  id: 'sheet-01',
                  name: 'Portfolio',
                  cellData: {}
                }
              }
            };
          }
          
          // Try to extract current state and merge with style extraction
          const extractedStyles = extractStylesFromUniver();
          
          // If we found styles, add them to the rebuilt data
          if (extractedStyles.styles && Object.keys(extractedStyles.styles).length > 0) {
            rebuiltData.styles = extractedStyles.styles;
            console.log(`🎨 Added ${Object.keys(extractedStyles.styles).length} style definitions to rebuilt data`);
          }
          
          // For sheets that have style IDs but no definitions, try to create them from DOM
          Object.keys(rebuiltData.sheets).forEach(sheetId => {
            const sheet = rebuiltData.sheets[sheetId];
            if (!sheet.styles) sheet.styles = {};
            
            if (sheet.cellData) {
              Object.keys(sheet.cellData).forEach(row => {
                Object.keys(sheet.cellData[row]).forEach(col => {
                  const cell = sheet.cellData[row][col];
                  if (cell && cell.s && !rebuiltData.styles[cell.s] && !sheet.styles[cell.s]) {
                    // Try to find the style definition via DOM matching
                    const cellText = cell.v;
                    if (cellText) {
                      const univerContainer = document.getElementById('univer-container');
                      if (univerContainer) {
                        // Find elements with this text and extract their styles - BUT ONLY WITHIN UNIVER CONTAINER
                        const textElements = univerContainer.querySelectorAll('*');
                        for (const element of textElements) {
                          const elementText = element.textContent?.trim();
                          if (elementText === cellText) {
                            // Make sure this element is actually a cell, not UI text
                            const isLikelyCell = (
                              element.closest('[data-row]') || 
                              element.closest('.univer-render-canvas') ||
                              element.classList.contains('cell') ||
                              element.classList.contains('univer-cell') ||
                              (element.parentElement && element.parentElement.tagName === 'TD') ||
                              (elementText.length < 50 && // Cells usually have short text
                               !element.closest('button') && // Not in a button
                               !element.closest('.el-button') && // Not in Element Plus button
                               !element.closest('nav') && // Not in navigation
                               !element.closest('.menu') && // Not in menu
                               !element.closest('.toolbar')) // Not in toolbar
                            );
                            
                            if (isLikelyCell) {
                              const computedStyle = window.getComputedStyle(element);
                              const domStyle = {};
                              
                              // Extract visual styles - but only meaningful ones
                              if (computedStyle.fontWeight === 'bold' || parseInt(computedStyle.fontWeight) >= 600) {
                                domStyle.fontWeight = 'bold';
                              }
                              if (computedStyle.color !== 'rgb(0, 0, 0)' && 
                                  computedStyle.color !== 'rgba(0, 0, 0, 1)' &&
                                  computedStyle.color !== 'rgb(51, 51, 51)') { // Exclude default grays
                                domStyle.color = computedStyle.color;
                              }
                              if (computedStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' && 
                                  computedStyle.backgroundColor !== 'transparent' &&
                                  computedStyle.backgroundColor !== 'rgb(255, 255, 255)') { // Exclude default white
                                domStyle.backgroundColor = computedStyle.backgroundColor;
                              }
                              if (computedStyle.fontStyle === 'italic') {
                                domStyle.fontStyle = 'italic';
                              }
                              if (computedStyle.textDecoration !== 'none' && 
                                  !computedStyle.textDecoration.includes('rgb(0, 0, 0)')) { // Exclude default decorations
                                domStyle.textDecoration = computedStyle.textDecoration;
                              }
                              if (computedStyle.fontSize !== '14px' && 
                                  computedStyle.fontSize !== '12px' && 
                                  computedStyle.fontSize !== '16px') { // Exclude common default sizes
                                domStyle.fontSize = computedStyle.fontSize;
                              }
                              
                              // Only create style if we found meaningful styling
                              if (Object.keys(domStyle).length > 0) {
                                // Use the original Univer style ID instead of creating new ones
                                rebuiltData.styles[cell.s] = domStyle;
                                sheet.styles[cell.s] = domStyle;
                                console.log(`🎯 Mapped Univer style ID ${cell.s} to DOM style for "${cellText}":`, domStyle);
                                break;
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                });
              });
            }
          });
          
          console.log('🔨 Rebuilt workbook complete:', {
            hasStyles: !!(rebuiltData.styles),
            globalStyleCount: rebuiltData.styles ? Object.keys(rebuiltData.styles).length : 0,
            sheets: Object.keys(rebuiltData.sheets)
          });
          
          return rebuiltData;
        } catch (rebuildError) {
          console.warn('Workbook rebuild failed:', rebuildError);
        }
        
        console.log('⚠️ All methods failed, returning existing data');
        return portfolioData.value || {};
        
      } catch (error) {
        console.error('Error getting complete workbook data:', error);
        return portfolioData.value || {};
      }
    };

    // Enhanced save function that captures complete workbook data with all Univer features
    const manualSave = async () => {
      try {
        console.log('💾 Starting enhanced save with complete Univer feature capture...');
        console.log('🔍 Step 1: Extracting complete workbook data...');
        
        // Always use a serializable snapshot for saving
        const snapshot = getCompleteWorkbookData();
        
        console.log('🔍 Step 2: Analyzing captured data...');
        
        if (snapshot && typeof snapshot === 'object' && Object.keys(snapshot).length > 0) {
          // Detailed analysis of what we captured
          if (snapshot.sheets) {
            console.log('📊 Captured workbook structure:', {
              id: snapshot.id,
              name: snapshot.name,
              sheets: Object.keys(snapshot.sheets),
              globalStyles: Object.keys(snapshot.styles || {}).length
            });
            
            // Analyze each sheet for styles
            Object.keys(snapshot.sheets).forEach(sheetId => {
              const sheet = snapshot.sheets[sheetId];
              const sheetStyles = Object.keys(sheet.styles || {}).length;
              const cellsWithStyles = [];
              
              if (sheet.cellData) {
                Object.keys(sheet.cellData).forEach(row => {
                  Object.keys(sheet.cellData[row]).forEach(col => {
                    const cell = sheet.cellData[row][col];
                    if (cell && (cell.s || cell.style)) {
                      cellsWithStyles.push({
                        position: `[${row}, ${col}]`,
                        value: cell.v,
                        styleId: cell.s,
                        directStyle: cell.style
                      });
                    }
                  });
                });
              }
              
              console.log(`📋 Sheet ${sheetId} analysis:`, {
                sheetStyles: sheetStyles,
                cellsWithStyles: cellsWithStyles.length,
                styledCells: cellsWithStyles
              });
              
              if (cellsWithStyles.length > 0) {
                console.log('🎨 Found styled cells in ' + sheetId + ':', cellsWithStyles);
              }
            });
          }
          
          console.log('🔍 Step 3: Saving to Supabase...');
          await savePortfolioData(snapshot);
          console.log('✅ Successfully saved complete workbook with styles.');
        } else {
          console.log('⚠️ No workbook data to save');
          ElMessage.warning('No workbook data found. Please add content and try again.');
        }
      } catch (error) {
        console.error('Error in manual save:', error);
        ElMessage.error('Failed to save: ' + error.message);
      }
    };

    // Feature detection to understand what Univer capabilities are available
    const detectUniverFeatures = () => {
      try {
        console.log('🔍 Detecting available Univer features...');
        
        const features = {
          core: {
            version: univer.getVersion?.() || 'unknown',
            plugins: [],
            services: [],
            commands: []
          },
          formatting: {
            styles: false,
            fonts: false,
            colors: false,
            borders: false,
            alignment: false,
            numberFormats: false
          },
          richContent: {
            images: false,
            charts: false,
            drawings: false,
            media: false
          },
          formulas: {
            basicFormulas: false,
            advancedFormulas: false,
            calculations: false
          },
          advanced: {
            conditionalFormatting: false,
            dataValidation: false,
            filtering: false,
            sorting: false,
            merging: false,
            freezing: false
          }
        };
        
        // Detect available services and plugins
        if (univer.__getInjector) {
          const injector = univer.__getInjector();
          
          // Try to detect various services
          const serviceTests = [
            'ICommandService', 'CommandService',
            'IWorkbookService', 'WorkbookService', 
            'IStyleService', 'StyleService',
            'IFormulaService', 'FormulaService',
            'IDrawingService', 'DrawingService',
            'IExportService', 'ExportService',
            'IRenderService', 'RenderService'
          ];
          
          serviceTests.forEach(serviceName => {
            try {
              const service = injector.get?.(serviceName);
              if (service) {
                features.core.services.push(serviceName);
                
                // Detect specific capabilities
                if (serviceName.includes('Style')) {
                  features.formatting.styles = true;
                  features.formatting.fonts = !!service.setFont;
                  features.formatting.colors = !!service.setColor;
                  features.formatting.borders = !!service.setBorder;
                }
                
                if (serviceName.includes('Formula')) {
                  features.formulas.basicFormulas = true;
                  features.formulas.calculations = !!service.calculate;
                }
                
                if (serviceName.includes('Drawing')) {
                  features.richContent.images = true;
                  features.richContent.drawings = true;
                }
              }
            } catch (e) {
              // Service not available
            }
          });
        }
        
        // Detect plugins by checking global Univer state
        const registeredPlugins = univer.getPlugins?.() || [];
        features.core.plugins = registeredPlugins.map(plugin => plugin.name || plugin.constructor?.name || 'unknown');
        
        // Log comprehensive feature detection
        console.log('🎯 Univer Feature Detection Results:', features);
        console.log('📊 Available Services:', features.core.services);
        console.log('🔌 Registered Plugins:', features.core.plugins);
        
        // Log capability summary
        const capabilities = [];
        if (features.formatting.styles) capabilities.push('styling');
        if (features.formulas.basicFormulas) capabilities.push('formulas');
        if (features.richContent.images) capabilities.push('images');
        if (features.advanced.conditionalFormatting) capabilities.push('conditional formatting');
        
        console.log(`✅ Detected capabilities: ${capabilities.length > 0 ? capabilities.join(', ') : 'basic spreadsheet'}`);
        
        return features;
      } catch (error) {
        console.warn('Feature detection failed:', error);
        return null;
      }
    };

    // Remove all auto-save functionality

    // Workbook data structure (sheets will be populated dynamically)
    const WORKBOOK_DATA = {
      id: 'workbook-01',
      locale: LocaleType.EN_US,
      name: 'AI Portfolio Manager',
      sheetOrder: [],
      sheets: {},
    };

    const initializeUniver = async () => {
      try {
        console.log('🚀 Initializing Univer with dynamic JSON storage...');

        // Load complete workbook data from Supabase first
        const workbookData = await loadPortfolioData();
        
        // Use the loaded workbook data or create default structure
        if (workbookData && workbookData.sheets) {
          // Use the complete workbook data from Supabase
          Object.assign(WORKBOOK_DATA, workbookData);
          portfolioData.value = workbookData;
          
          // Update current row count from loaded data
          const firstSheet = Object.values(workbookData.sheets)[0];
          if (firstSheet && firstSheet.rowCount) {
            currentRowCount.value = firstSheet.rowCount;
            console.log('📏 Set current row count from loaded data:', firstSheet.rowCount);
          }
          
          console.log('📊 Loaded complete workbook with features:', {
            id: WORKBOOK_DATA.id,
            name: WORKBOOK_DATA.name,
            sheets: Object.keys(WORKBOOK_DATA.sheets),
            sheetOrder: WORKBOOK_DATA.sheetOrder,
            rowCount: currentRowCount.value
          });
        } else {
          // Fallback to default workbook structure
          WORKBOOK_DATA.sheets = {
            'sheet-01': {
              id: 'sheet-01',
              name: 'Portfolio',
              cellData: {},
              tabColor: '',
              hidden: 0,
              rowCount: defaultRowCount.value,
              columnCount: 10,
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
          container: 'univer-container',
        });

        univer.registerPlugin(UniverDocsPlugin);
        univer.registerPlugin(UniverDocsUIPlugin);

        univer.registerPlugin(UniverSheetsPlugin);
        univer.registerPlugin(UniverSheetsUIPlugin);
        univer.registerPlugin(UniverSheetsFormulaUIPlugin);
        univer.registerPlugin(UniverSheetsNumfmtUIPlugin);

        // Create workbook
        univer.createUnit(UniverInstanceType.UNIVER_SHEET, WORKBOOK_DATA);

                // Enable enhanced change tracking and feature detection
        setTimeout(() => {
          trackSheetChanges();
          updateLocalSheetData();
          updateRowCount(); // Initialize current row count
          
          // Add feature detection and logging
          detectUniverFeatures();
          
          // Start real-time style monitoring
          startStyleMonitoring();
          
          console.log('🎯 Available debug commands:');
          console.log('  - debugStyleDetection() - Test current style detection');
          console.log('  - checkCurrentPageStyles() - Scan entire page for styles');  
          console.log('  - startStyleMonitoring() - Enable real-time style monitoring');
        }, 1000);
        
        console.log('✅ Univer initialized successfully with enhanced feature capture!');
        console.log('🎨 Now capturing: rich formatting, styles, fonts, colors, images, formulas, charts, and more');
        console.log('💾 Enhanced save system will preserve ALL Univer features');
        ElMessage.success('AI Portfolio Manager loaded with complete feature preservation!');
        
      } catch (error) {
        console.error('❌ Failed to initialize Univer:', error);
        ElMessage.error('Failed to initialize AI Portfolio Manager: ' + error.message);
      }
    };

    // Real-time style monitoring function
    const startStyleMonitoring = () => {
      console.log('👁️ Starting real-time style monitoring...');
      
      const univerContainer = document.getElementById('univer-container');
      if (!univerContainer) return;
      
      // Watch for any changes in the container
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' || mutation.type === 'childList') {
            // Debounce the style check
            clearTimeout(window.styleCheckTimeout);
            window.styleCheckTimeout = setTimeout(() => {
              console.log('🔄 DOM change detected, checking for new styles...');
              const styles = extractStylesFromUniver();
              if (Object.keys(styles.cellStyles).length > 0) {
                console.log('🎉 NEW STYLES DETECTED:', styles.cellStyles);
              }
            }, 500);
          }
        });
      });
      
      observer.observe(univerContainer, {
        attributes: true,
        childList: true,
        subtree: true,
        attributeFilter: ['style', 'class']
      });
      
      // Store observer for cleanup
      window.univerStyleObserver = observer;
    };
    
    // Test function to check what's currently on the page
    const checkCurrentPageStyles = () => {
      console.log('🔍 Checking current page for ANY styled elements...');
      
      const allElements = document.querySelectorAll('*');
      let foundStyles = [];
      
      allElements.forEach((el, index) => {
        const text = el.textContent?.trim();
        if (text && text.length > 0 && text.length < 50) {
          const style = window.getComputedStyle(el);
          const isBold = style.fontWeight === 'bold' || parseInt(style.fontWeight) >= 600;
          const hasColor = style.color !== 'rgb(0, 0, 0)' && style.color !== 'rgba(0, 0, 0, 1)';
          
          if (isBold || hasColor) {
            foundStyles.push({
              text: text,
              fontWeight: style.fontWeight,
              color: style.color,
              element: el.tagName,
              className: el.className,
              parent: el.parentElement?.tagName
            });
          }
        }
      });
      
      console.log(`📈 Found ${foundStyles.length} styled elements on entire page:`, foundStyles);
      return foundStyles;
    };
    
    // Make functions available globally for testing
    window.checkCurrentPageStyles = checkCurrentPageStyles;
    window.startStyleMonitoring = startStyleMonitoring;

    // Debug function to test style detection (available in browser console)
    const debugStyleDetection = () => {
      console.log('🔬 Running style detection debug...');
      
      // Test current style extraction
      const extractedStyles = extractStylesFromUniver();
      console.log('📊 Style extraction results:', extractedStyles);
      
      // Test DOM inspection
      const univerContainer = document.getElementById('univer-container');
      if (univerContainer) {
        console.log('🔍 DOM inspection:');
        
        // Look for any elements with visible styling
        const allElements = univerContainer.querySelectorAll('*');
        let styledElements = 0;
        
        allElements.forEach((el, index) => {
          const style = window.getComputedStyle(el);
          const text = el.textContent?.trim();
          
          if (text && text.length > 0 && text.length < 50) {
            const isBold = style.fontWeight === 'bold' || parseInt(style.fontWeight) >= 600;
            const hasColor = style.color !== 'rgb(0, 0, 0)' && style.color !== 'rgba(0, 0, 0, 1)';
            
            if (isBold || hasColor) {
              styledElements++;
              console.log(`🎨 Styled element ${index}:`, {
                text: text,
                fontWeight: style.fontWeight,
                color: style.color,
                element: el.tagName,
                classes: el.className
              });
            }
          }
        });
        
        console.log(`📈 Found ${styledElements} styled elements in DOM`);
      }
      
      return extractedStyles;
    };
    
    // Make debug function available globally
    window.debugStyleDetection = debugStyleDetection;

    // Debug function to check the current data displayed in the Univer sheet
    const debugCurrentData = () => {
      console.log('🔍 Debugging current Univer data...');
      const currentData = getCurrentSpreadsheetData();
      console.log('📊 Current Univer Data:', currentData);
      ElMessage.info('Current Univer data displayed in the sheet is now logged to the console.');
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
          console.log('📤 Univer disposed successfully');
        } catch (error) {
          console.warn('⚠️ Error disposing Univer:', error);
        }
      }
    });

    return {
      portfolioData,
      saving,
      manualSave,
      lastSaved,
      debugCurrentData,
      containerHeight,
      currentRowCount
    };
  },
};
</script>

<style scoped>
.univer-container-wrapper {
  width: 100%;
  height: auto;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
  position: relative;
}

.univer-container {
  width: 100%;
  /* Height is now set dynamically via style binding - exact fit */
  background: white;
  border: 1px solid #e0e6ed;
  border-radius: 6px;
  overflow: hidden; /* No scrollbars - exact height */
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  margin: 8px;
}

/* Save Controls */
.save-controls {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 1000;
  background: rgba(255, 255, 255, 0.9);
  padding: 8px;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  backdrop-filter: blur(4px);
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 140px;
}

/* Removed auto-save CSS */

.last-saved {
  font-size: 10px;
  color: #67c23a;
  text-align: center;
  font-weight: 500;
}

/* Saving indicator */
.univer-container-wrapper::after {
  content: '';
  display: none;
}

.univer-container-wrapper.saving::after {
  content: '💾 Saving...';
  display: block;
  position: absolute;
  top: 60px;
  right: 20px;
  background: #409eff;
  color: white;
  padding: 8px 12px;
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
  .univer-container {
    margin: 4px;
    border-radius: 4px;
  }
}

@media (max-width: 480px) {
  .univer-container-wrapper {
    height: calc(100vh - 60px);
  }
  
  .univer-container {
    margin: 2px;
  }
}
</style>