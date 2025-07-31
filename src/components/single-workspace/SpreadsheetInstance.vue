<template>
  <div class="spreadsheet-instance-wrapper" :class="{ saving }">
    <!-- Spreadsheet Container -->
    <div class="spreadsheet-container">
      <!-- State indicator -->
      <div class="state-indicator" :class="{ 
        'loading': isInitializing, 
        'unsaved': !isInitializing && hasUnsavedChanges,
        'saved': !isInitializing && !hasUnsavedChanges
      }">
        <span class="state-text">
          <template v-if="isInitializing">
            <span class="state-icon">⏳</span> Loading...
          </template>
          <template v-else-if="hasUnsavedChanges">
            <span class="state-icon">⚠️</span> Unsaved data
          </template>
          <template v-else>
            <span class="state-icon">✅</span> Saved
          </template>
        </span>
      </div>
      
      <!-- Debug controls (temporary) -->
      <!--div class="debug-controls" style="position: absolute; top: 40px; right: 8px; z-index: 1001; background: rgba(0,0,0,0.8); padding: 8px; border-radius: 4px;">
        <div style="color: white; font-size: 10px; margin-bottom: 4px;">
          State: {{ hasUnsavedChanges ? 'UNSAVED' : 'SAVED' }}
        </div>
        <div style="color: yellow; font-size: 10px; margin-bottom: 4px;">
          Init: {{ isInitializing ? 'LOADING...' : 'READY' }}
        </div>
        <button @click="markAsUnsaved" style="background: orange; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 10px; margin-right: 4px;">Test Unsaved</button>
        <button @click="markAsSaved" style="background: green; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 10px;">Test Saved</button>
      </div-->
      <div :id="`univer-container-${spreadsheetId}`" class="univer-container" :style="{ height: containerHeight + 'px' }"></div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref, computed, watch } from 'vue';
import { supabase } from '../../supabase';
import { ElMessage } from 'element-plus';
import { useMatterStore } from '../../store/matter';
import { useTaskStore } from '../../store/task';
import { storeToRefs } from 'pinia';

// Univer core with locale support
// import { LocaleType, merge, Univer, UniverInstanceType } from '@univerjs/core';

// Locale imports
import DesignEnUS from '@univerjs/design/locale/en-US';
import UIEnUS from '@univerjs/ui/locale/en-US';
import DocsUIEnUS from '@univerjs/docs-ui/locale/en-US';
import SheetsEnUS from '@univerjs/sheets/locale/en-US';
import SheetsUIEnUS from '@univerjs/sheets-ui/locale/en-US';
import SheetsFormulaUIEnUS from '@univerjs/sheets-formula-ui/locale/en-US';
import SheetsNumfmtUIEnUS from '@univerjs/sheets-numfmt-ui/locale/en-US';
import SheetsNoteUIEnUS from '@univerjs/sheets-note-ui/locale/en-US';

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


// Note/Annotation plugin
//import { UniverSheetsNotePlugin } from '@univerjs/sheets-note';
//import { UniverSheetsNoteUIPlugin } from '@univerjs/sheets-note-ui';

// Custom menu plugin

// CSS imports - exactly as in documentation
import '@univerjs/design/lib/index.css';
import '@univerjs/ui/lib/index.css';
import '@univerjs/docs-ui/lib/index.css';
import '@univerjs/sheets-ui/lib/index.css';
import '@univerjs/sheets-formula-ui/lib/index.css';
import '@univerjs/sheets-numfmt-ui/lib/index.css';
import '@univerjs/sheets-note-ui/lib/index.css';





// Univer imports
import  { FUniver, Univer, createUniver, LocaleType, merge, UniverInstanceType } from '@univerjs/presets'
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core'

// plugin imports
import { UniverSheetsNotePreset } from '@univerjs/preset-sheets-note'

// Locale imports
import UniverPresetSheetsCoreEnUS from '@univerjs/preset-sheets-core/locales/en-US'
import UniverPresetSheetsNoteEnUS from '@univerjs/preset-sheets-note/locales/en-US'

// CSS imports
import '@univerjs/preset-sheets-core/lib/index.css'
import '@univerjs/preset-sheets-note/lib/index.css'


    // Define props
    const props = defineProps({
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
    })

    // Define emits
    const emit = defineEmits(['remove-spreadsheet'])


    // Matter store for workspace context
    const matterStore = useMatterStore();
    const { currentMatter } = storeToRefs(matterStore);
    
    // Task store for fetching task information
    const taskStore = useTaskStore();
    
    // Use prop matterId if provided, otherwise get from current matter
    const currentMatterId = computed(() => props.matterId || currentMatter.value?.id);
    
    // Cell edit tracking for user history
    const currentUser = ref(null);
    
    // Enhanced function to get current user with debugging
    const getCurrentUser = async () => {
      try {
        console.log(`🔍 Attempting to load current user...`);
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error) {
          console.error(`❌ Supabase auth error:`, error);
          return;
        }
        
        if (user) {
          currentUser.value = user;
          console.log(`✅ User loaded for edit tracking:`, {
            email: user.email,
            id: user.id,
            metadata: user.user_metadata
          });
        } else {
          console.warn(`⚠️ No user returned from Supabase auth`);
        }
      } catch (error) {
        console.error(`❌ Error getting current user:`, error);
      }
    };
    
    // Enhanced function to add edit metadata to a cell with debugging
    const addEditMetadataToCell = (row, col, sheetId = 'sheet-01') => {
      try {
        console.log(`🏗️ Starting addEditMetadataToCell for [${row}, ${col}]`);
        
        if (!currentUser.value) {
          console.warn(`⚠️ No user available for edit metadata`);
          return;
        }
        
        console.log(`👤 User found: ${currentUser.value.email}, ID: ${currentUser.value.id}`);
        
        const currentData = getCurrentSpreadsheetData();
        if (!currentData || !currentData.sheets || !currentData.sheets[sheetId]) {
          console.warn(`⚠️ No sheet data available for edit metadata`);
          console.log(`📊 Available data:`, {
            hasCurrentData: !!currentData,
            hasSheets: !!(currentData?.sheets),
            availableSheets: currentData?.sheets ? Object.keys(currentData.sheets) : [],
            requestedSheet: sheetId
          });
          return;
        }
        
        const sheet = currentData.sheets[sheetId];
        console.log(`📋 Working with sheet: ${sheetId}`);
        
        // Ensure cell structure exists
        if (!sheet.cellData) {
          sheet.cellData = {};
          console.log(`🔧 Created cellData for sheet`);
        }
        if (!sheet.cellData[row]) {
          sheet.cellData[row] = {};
          console.log(`🔧 Created row ${row}`);
        }
        if (!sheet.cellData[row][col]) {
          sheet.cellData[row][col] = {};
          console.log(`🔧 Created cell [${row}, ${col}]`);
        }
        
        const cell = sheet.cellData[row][col];
        const userName = currentUser.value.email?.split('@')[0] || 'Unknown User';
        
        console.log(`📝 Cell before edit metadata:`, cell);
        
        // Add simple edit metadata
        cell.lastEditedBy = currentUser.value.id;
        cell.lastEditedByName = userName;
        cell.lastEditedAt = new Date().toISOString();
        
        console.log(`📝 Cell after edit metadata:`, cell);
        console.log(`✅ Added edit metadata to cell [${row}, ${col}] by ${userName}`);
        
        // Update portfolio data to trigger save
        portfolioData.value = { ...currentData };
        console.log(`🔄 Portfolio data updated to trigger save`);
        
      } catch (error) {
        console.error(`❌ Error in addEditMetadataToCell:`, error);
        console.error(`❌ Error stack:`, error.stack);
      }
    };
    
    let univer = null;
    let univerAPI = null;
    const portfolioData = ref({});
    const saving = ref(false);
    const portfolioId = ref(null);
    const lastSaved = ref(null);
    const allSheetsData = ref({});
    const currentRowCount = ref(props.initialRows);
    const hasUnsavedChanges = ref(false);
    const isInitializing = ref(true); // Prevent change detection during initial load

    // Workbook data structure
    const WORKBOOK_DATA = {
      id: `workbook-${props.spreadsheetId}`,
      locale: LocaleType.EN_US,
      name: props.spreadsheetName,
      sheetOrder: [],
      sheets: {},
      styles: {},
      resources: [
              {
                name: 'SHEET_NOTE_PLUGIN',
                data: '{"sheet-01":{}}'
              },
              {
                name: 'SHEET_RANGE_PROTECTION_PLUGIN',
                data: ""
              },
              {
                name: 'SHEET_AuthzIoMockService_PLUGIN',
                data: "{}"
              },
              {
                name: 'SHEET_WORKSHEET_PROTECTION_PLUGIN',
                data: "{}"
              },
              {
                name: 'SHEET_WORKSHEET_PROTECTION_POINT_PLUGIN',
                data: "{}"
              },
              {
                name: 'SHEET_DEFINED_NAME_PLUGIN',
                data: ""
              },
              {
                name: 'SHEET_RANGE_THEME_MODEL_PLUGIN',
                data: "{}"
              }
            ]
    };

    const initializeUniver = async () => {
      try {
        console.log(`🚀 Initializing Univer instance for ${props.spreadsheetName} (${props.spreadsheetId})...`);

        // Load current user for edit tracking
        console.log(`🚀 Loading user for edit tracking in ${props.spreadsheetId}...`);
        await getCurrentUser();
        console.log(`🚀 User loading complete for ${props.spreadsheetId}:`, currentUser.value ? `✅ ${currentUser.value.email}` : '❌ No user');

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
        /*univer = new Univer({
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
              SheetsNoteUIEnUS,
            ),
          },
        });*/


        const univerInstance = createUniver({
          locale: LocaleType.EN_US,
          locales: {
            [LocaleType.EN_US]: merge(
              {},
              UniverPresetSheetsCoreEnUS,
              UniverPresetSheetsNoteEnUS
            ),
          },
          presets: [
            UniverSheetsCorePreset({
              //container: container.value as HTMLElement,
              container: `univer-container-${props.spreadsheetId}`,
              header: true, // Show header when not readonly
              toolbar: true, // Show toolbar when not readonly
            }),
            UniverSheetsNotePreset(),
          ],
        });
        
        // Store both univer and univerAPI for global access
        univer = univerInstance.univer;
        univerAPI = univerInstance.univerAPI;

        // Register plugins in exact order from 
        /*
        // those plugins are not needed for the new version of Univer for univerapi
        //univer.registerPlugin(UniverRenderEnginePlugin);
        //univer.registerPlugin(UniverFormulaEnginePlugin);
        //univer.registerPlugin(UniverUIPlugin, {
        //  container: `univer-container-${props.spreadsheetId}`,
        //});

        //univer.registerPlugin(UniverDocsPlugin);
        //univer.registerPlugin(UniverDocsUIPlugin);

        //univer.registerPlugin(UniverSheetsPlugin);
        //univer.registerPlugin(UniverSheetsUIPlugin);
        //univer.registerPlugin(UniverSheetsFormulaPlugin);
        //univer.registerPlugin(UniverSheetsFormulaUIPlugin);
        //univer.registerPlugin(UniverSheetsNumfmtUIPlugin);
        */

        // Register annotation plugins
        //univer.registerPlugin(UniverSheetsNotePlugin);
        //univer.registerPlugin(UniverSheetsNoteUIPlugin);

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
          const { ComponentManager, IMenuManagerService, RibbonStartGroup, MenuItemType, ContextMenuPosition, ContextMenuGroup } = await import('@univerjs/ui');
          
          // Get services
          const commandService = injector.get(ICommandService);
          const menuManagerService = injector.get(IMenuManagerService);
          const componentManager = injector.get(ComponentManager);
          
          console.log('✅ Got all required services from injector');
          
          // Define custom commands
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
          
          const CONTEXT_MENU_EDIT_INFO_OPERATION = {
            id: 'custom-menu.operation.context-edit-info',
            type: CommandType.OPERATION,
            handler: async () => {
              // Edit info context menu action
              console.log('📝 Edit info context menu item clicked');
              
              // Get current cell selection for context
              const selection = getCurrentCellSelection();
              if (selection) {
                //const { row, col } = selection;
                //const cellRef = `${String.fromCharCode(65 + col)}${row + 1}`;

                showCellEditInfo();
                
                // Show info about the selected cell
                /*ElMessage({
                  message: `Edit info action triggered on cell ${cellRef}`,
                  type: 'info',
                  duration: 3000
                });
                
                console.log(`✅ Edit info action executed on cell [${row}, ${col}] (${cellRef})`);*/
              } else {
                ElMessage({
                  message: 'Edit info context menu action triggered',
                  type: 'info',
                  duration: 3000
                });
              }
              
              return true;
            },
          };
          
          const CUSTOM_MENU_DROPDOWN_LIST_OPERATION_ID = 'custom-menu.operation.dropdown-list';
          
          // Register commands
          commandService.registerCommand(DROPDOWN_FIRST_ITEM_OPERATION);
          commandService.registerCommand(DROPDOWN_SECOND_ITEM_OPERATION);
          commandService.registerCommand(CONTEXT_MENU_EDIT_INFO_OPERATION);
          console.log('✅ Custom menu commands registered');
          
          // Register simple icon components (using createElement directly)
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
          
          const EditInfoIcon = () => {
            const React = window.React || window['React'];
            if (!React) {
              return null;
            }
            return React.createElement('svg', {
              width: 16, height: 16, viewBox: '0 0 24 24', fill: 'currentColor'
            }, React.createElement('path', {
              d: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z'
            }));
          };
          
          componentManager.register('SaveIcon', SaveIcon);
          componentManager.register('DeleteIcon', DeleteIcon);
          componentManager.register('MainButtonIcon', MainButtonIcon);
          componentManager.register('EditInfoIcon', EditInfoIcon);
          console.log('✅ Custom menu components registered');
          
          // Register menu items using proper factory functions
          menuManagerService.mergeMenu({
            [RibbonStartGroup.OTHERS]: {
              [CUSTOM_MENU_DROPDOWN_LIST_OPERATION_ID]: {
                order: 10,
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
                  }),
                },
                [DROPDOWN_SECOND_ITEM_OPERATION.id]: {
                  order: 1,
                  menuItemFactory: () => ({
                    id: DROPDOWN_SECOND_ITEM_OPERATION.id,
                    type: MenuItemType.BUTTON,
                    title: 'Delete',
                  }),
                },
              },
            },
            // Add context menu configuration
            [ContextMenuPosition.MAIN_AREA]: {
              [ContextMenuGroup.OTHERS]: {
                [CONTEXT_MENU_EDIT_INFO_OPERATION.id]: {
                  order: 100,
                  menuItemFactory: () => ({
                    id: CONTEXT_MENU_EDIT_INFO_OPERATION.id,
                    type: MenuItemType.BUTTON,
                    icon: 'EditInfoIcon',
                    title: 'Edit info',
                    tooltip: 'This is an example context menu item'
                  }),
                },
              },
            },
          });
          
          console.log('✅ Custom menu items registered');
          console.log(`🎯 Custom dropdown menu should now appear in Univer toolbar for ${props.spreadsheetId}!`);
          console.log(`🎯 Edit info context menu item should now appear when right-clicking on cells for ${props.spreadsheetId}!`);
          
          // Set up change detection for unsaved changes indicator
          try {
            console.log(`🔥 Setting up change detection for ${props.spreadsheetId}...`);
            
            // Listen for annotation-related commands AND cell edits
            commandService.onCommandExecuted((command) => {
              // Handle annotations
              if (command.id.includes('comment') || command.id.includes('note') || command.id.includes('annotation')) {
                console.log('📝 Annotation command detected:', command.id);
                handleAnnotationChange(command);
              }
              
              // Handle cell edits - extract actual cell coordinates from command
              const isCellEdit = 
                command.id.includes('set-range-value') ||
                command.id.includes('set-range-values') ||
                command.id.includes('SetRangeValues') ||
                command.id.includes('doc.command.insert-text') ||
                command.id.includes('insert-text') ||
                command.id.includes('sheet.mutation.set-range-values') ||
                command.id.includes('sheet.operation.set-activate-cell-edit');
              
              console.log(`🔍 Checking edit conditions: command="${command.id}", isCellEdit=${isCellEdit}, hasUser=${!!currentUser.value}`);
              console.log(`🔍 Command params:`, command.params);
              
              if (isCellEdit) {
                console.log(`✅ Cell edit detected for command: ${command.id}`);
                
                // Extract actual cell coordinates from command parameters
                const extractCellCoordinates = (commandParams) => {
                  try {
                    console.log(`🧮 Extracting coordinates from:`, commandParams);
                    
                    // Method 1: Check for range property
                    if (commandParams?.range) {
                      const range = commandParams.range;
                      console.log(`📍 Found range:`, range);
                      
                      if (range.startRow !== undefined && range.startColumn !== undefined) {
                        return { row: range.startRow, col: range.startColumn };
                      }
                      if (range.row !== undefined && range.col !== undefined) {
                        return { row: range.row, col: range.col };
                      }
                    }
                    
                    // Method 2: Check for direct row/col properties
                    if (commandParams?.row !== undefined && commandParams?.col !== undefined) {
                      return { row: commandParams.row, col: commandParams.col };
                    }
                    
                    // Method 3: Check for ranges array
                    if (commandParams?.ranges && Array.isArray(commandParams.ranges) && commandParams.ranges.length > 0) {
                      const firstRange = commandParams.ranges[0];
                      console.log(`📍 Found ranges[0]:`, firstRange);
                      
                      if (firstRange.startRow !== undefined && firstRange.startColumn !== undefined) {
                        return { row: firstRange.startRow, col: firstRange.startColumn };
                      }
                    }
                    
                    // Method 4: Check for selection
                    if (commandParams?.selection) {
                      const sel = commandParams.selection;
                      if (sel.startRow !== undefined && sel.startColumn !== undefined) {
                        return { row: sel.startRow, col: sel.startColumn };
                      }
                    }
                    
                    console.log(`⚠️ Could not extract coordinates, using fallback [0,0]`);
                    return { row: 0, col: 0 }; // Fallback
                  } catch (error) {
                    console.warn(`⚠️ Error extracting coordinates:`, error);
                    return { row: 0, col: 0 }; // Fallback
                  }
                };
                
                const { row, col } = extractCellCoordinates(command.params);
                console.log(`📍 Extracted cell coordinates: [${row}, ${col}]`);
                
                if (currentUser.value) {
                  try {
                    console.log(`👤 User available for edit tracking: ${currentUser.value.email}`);
                    addEditMetadataToCell(row, col);
                    console.log(`✅ Edit metadata added for command: ${command.id} at [${row}, ${col}]`);
                  } catch (editError) {
                    console.error(`❌ Error adding edit metadata:`, editError);
                  }
                } else {
                  console.warn(`⚠️ No user available for edit metadata - attempting to load user`);
                  getCurrentUser().then(() => {
                    if (currentUser.value) {
                      console.log(`✅ User loaded, adding edit metadata`);
                      addEditMetadataToCell(row, col);
                    }
                  });
                }
              } else {
                console.log(`📋 Command not detected as cell edit: ${command.id}`);
              }
            });

            // Listen for any command that modifies worksheet data
            let commandDebounceTimer = null;
            const originalExecuteCommand = commandService.executeCommand;
            
            commandService.executeCommand = function(...args) {
              const commandId = args[0];
              console.log(`🔥 Command executed:`, commandId, args);
              
              const result = originalExecuteCommand.apply(this, args);
              
              // Commands that indicate potential data changes
              if (commandId && typeof commandId === 'string') {
                if (commandId.includes('set-cell') || 
                    commandId.includes('set-range') ||
                    commandId.includes('paste') ||
                    commandId.includes('cut') ||
                    commandId.includes('clear') ||
                    commandId.includes('delete') ||
                    commandId.includes('insert') ||
                    commandId.includes('formula')) {
                  console.log(`🔥 Potential data-modifying command detected: ${commandId}`);
                  
                  // Clear any existing timer
                  if (commandDebounceTimer) {
                    clearTimeout(commandDebounceTimer);
                  }
                  
                  // Wait before checking to ensure command is fully processed
                  commandDebounceTimer = setTimeout(() => {
                    markAsUnsaved(); // This now uses smart detection internally
                  }, 300); // Wait 300ms for command to complete
                }
              }
              
              return result;
            };
            
            console.log(`📝 Command interception set up for ${props.spreadsheetId}`);
            
          } catch (changeDetectionError) {
            console.warn(`⚠️ Could not set up command detection for ${props.spreadsheetId}:`, changeDetectionError);
          }
          
          // Smart fallback change detection via DOM events with debouncing
          setTimeout(() => {
            const container = document.getElementById(`univer-container-${props.spreadsheetId}`);
            console.log(`🔥 Setting up smart DOM event detection for ${props.spreadsheetId}, container:`, container);
            
            if (container) {
              let debounceTimer = null;
              
              // Debounced change handler that actually checks for real changes
              const handlePotentialChange = () => {
                console.log(`🔥 Potential DOM change detected in ${props.spreadsheetId}, checking...`);
                
                // Clear any existing timer
                if (debounceTimer) {
                  clearTimeout(debounceTimer);
                }
                
                // Wait a bit before checking to ensure all DOM updates are complete
                debounceTimer = setTimeout(() => {
                  markAsUnsaved(); // This now uses smart detection internally
                }, 500); // Wait 500ms to ensure change is complete
              };
              
              // Listen for events that might indicate real changes
              // Use 'blur' instead of 'input' to avoid false positives from just clicking
              container.addEventListener('blur', handlePotentialChange, true);
              container.addEventListener('paste', handlePotentialChange);
              // Remove 'keypress' as it triggers on any key, add 'change' instead
              container.addEventListener('change', handlePotentialChange);
              
              // Add keyboard shortcut for viewing cell edit info (Ctrl+I on Windows/Linux, Cmd+I on macOS)
              const handleKeyDown = (event) => {
                // Check for Ctrl+I (Windows/Linux) or Cmd+I (macOS)
                if ((event.ctrlKey || event.metaKey) && event.key === 'i') {
                  event.preventDefault();
                  const keyName = event.metaKey ? 'Cmd+I' : 'Ctrl+I';
                  console.log(`⌨️ ${keyName} pressed - showing cell edit info`);
                  showCellEditInfo();
                }
              };
              
              container.addEventListener('keydown', handleKeyDown, true);
              console.log(`⌨️ Keyboard shortcut Ctrl+I (Windows/Linux) / Cmd+I (macOS) set up for cell edit info`);
              
              console.log(`📝 Smart DOM event detection set up for ${props.spreadsheetId} with debouncing`);
            }
          }, 3000); // Wait longer for DOM to be ready
          
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
        // univer.createUnit(UniverInstanceType.UNIVER_SHEET, WORKBOOK_DATA);
        univerAPI.createWorkbook(WORKBOOK_DATA);

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
        
        // Mark initialization as complete after a delay to ensure all setup is done
        setTimeout(() => {
          isInitializing.value = false;
          
          // Establish initial data state for comparison after initialization
          try {
            const currentData = getCurrentSpreadsheetData();
            const currentHash = getDataHash(currentData);
            lastKnownDataState.value = currentHash;
            console.log(`📊 Established initial data state for comparison after initialization (${props.spreadsheetId})`);
          } catch (error) {
            console.warn(`Error establishing initial data state for ${props.spreadsheetId}:`, error);
          }
          
          console.log(`🎯 Initialization complete for ${props.spreadsheetId} - smart change detection now active`);
        }, 5000); // Wait 5 seconds to ensure all initialization commands are processed
        
      } catch (error) {
        console.error(`❌ Failed to initialize Univer (${props.spreadsheetId}):`, error);
        ElMessage.error(`Failed to initialize ${props.spreadsheetName}: ${error.message}`);
      }
    };

    // Function to get edit metadata for a specific cell
    const getCellEditInfo = (row, col, sheetId = 'sheet-01') => {
      try {
        const currentData = getCurrentSpreadsheetData();
        if (!currentData?.sheets?.[sheetId]?.cellData?.[row]?.[col]) {
          return null;
        }
        
        const cell = currentData.sheets[sheetId].cellData[row][col];
        
        if (cell.lastEditedBy || cell.lastEditedAt || cell.lastEditedByName) {
          return {
            lastEditedBy: cell.lastEditedBy,
            lastEditedByName: cell.lastEditedByName,
            lastEditedAt: cell.lastEditedAt,
            cellValue: cell.v,
            cellPosition: `${String.fromCharCode(65 + col)}${row + 1}` // Convert to A1 notation
          };
        }
        
        return null;
      } catch (error) {
        console.error(`❌ Error getting cell edit info:`, error);
        return null;
      }
    };

    // Function to get currently selected cell coordinates
    const getCurrentCellSelection = () => {
      try {
        console.log('🔍 Getting current cell selection...');
        console.log('🔍 Univer available:', !!univer);
        console.log('🔍 UniverAPI available:', !!univerAPI);
        
        // Try using univerAPI first (modern approach)
        if (univerAPI) {
          try {
            console.log('🔍 Trying univerAPI.getActiveWorkbook()...');
            const activeWorkbook = univerAPI.getActiveWorkbook();
            console.log('🔍 Active workbook from API:', activeWorkbook);
            
            if (activeWorkbook) {
              console.log('🔍 Trying to get active sheet...');
              const activeSheet = activeWorkbook.getActiveSheet();
              console.log('🔍 Active sheet from API:', activeSheet);
              
                              if (activeSheet) {
                  console.log('🔍 Trying to get selection from API...');
                  const selection = activeSheet.getSelection();
                  console.log('🔍 Selection from API:', selection);
                  
                  if (selection) {
                    // Try to get selection from different possible structures
                    let selectionData = null;
                    
                    // Method 1: Check _selections array
                    if (selection._selections && selection._selections.length > 0) {
                      selectionData = selection._selections[0];
                      console.log('🔍 Found selection in _selections:', selectionData);
                    }
                    // Method 2: Check ranges array
                    else if (selection.ranges && selection.ranges.length > 0) {
                      selectionData = selection.ranges[0];
                      console.log('🔍 Found selection in ranges:', selectionData);
                    }
                    // Method 3: Check if selection itself has the data
                    else if (selection.primary || selection.range) {
                      selectionData = selection.primary || selection.range;
                      console.log('🔍 Found selection in primary/range:', selectionData);
                    }
                    
                    if (selectionData) {
                      console.log('🔍 Selection data structure:', selectionData);
                      
                      // Try different property names for row/column
                      let row = undefined, col = undefined;
                      
                      // Method 1: Try selectionData.primary (from console logs)
                      if (selectionData.primary) {
                        console.log('🔍 Checking primary:', selectionData.primary);
                        if (selectionData.primary.actualRow !== undefined && selectionData.primary.actualColumn !== undefined) {
                          row = selectionData.primary.actualRow;
                          col = selectionData.primary.actualColumn;
                          console.log(`🔍 Using primary.actualRow/actualColumn: [${row}, ${col}]`);
                        }
                        else if (selectionData.primary.startRow !== undefined && selectionData.primary.startColumn !== undefined) {
                          row = selectionData.primary.startRow;
                          col = selectionData.primary.startColumn;
                          console.log(`🔍 Using primary.startRow/startColumn: [${row}, ${col}]`);
                        }
                        else if (selectionData.primary.row !== undefined && selectionData.primary.col !== undefined) {
                          row = selectionData.primary.row;
                          col = selectionData.primary.col;
                          console.log(`🔍 Using primary.row/col: [${row}, ${col}]`);
                        }
                      }
                      
                      // Method 2: Try selectionData.range if primary didn't work
                      if (row === undefined && selectionData.range) {
                        console.log('🔍 Checking range:', selectionData.range);
                        if (selectionData.range.startRow !== undefined && selectionData.range.startColumn !== undefined) {
                          row = selectionData.range.startRow;
                          col = selectionData.range.startColumn;
                          console.log(`🔍 Using range.startRow/startColumn: [${row}, ${col}]`);
                        }
                        else if (selectionData.range.actualRow !== undefined && selectionData.range.actualColumn !== undefined) {
                          row = selectionData.range.actualRow;
                          col = selectionData.range.actualColumn;
                          console.log(`🔍 Using range.actualRow/actualColumn: [${row}, ${col}]`);
                        }
                      }
                      
                      // Method 3: Try direct properties (fallback)
                      if (row === undefined) {
                        console.log('🔍 Trying direct properties on selectionData');
                        if (selectionData.actualRow !== undefined && selectionData.actualColumn !== undefined) {
                          row = selectionData.actualRow;
                          col = selectionData.actualColumn;
                          console.log(`🔍 Using direct actualRow/actualColumn: [${row}, ${col}]`);
                        }
                        else if (selectionData.startRow !== undefined && selectionData.startColumn !== undefined) {
                          row = selectionData.startRow;
                          col = selectionData.startColumn;
                          console.log(`🔍 Using direct startRow/startColumn: [${row}, ${col}]`);
                        }
                        else if (selectionData.row !== undefined && selectionData.col !== undefined) {
                          row = selectionData.row;
                          col = selectionData.col;
                          console.log(`🔍 Using direct row/col: [${row}, ${col}]`);
                        }
                      }
                      
                      if (row !== undefined && col !== undefined) {
                        const cellRef = `${String.fromCharCode(65 + col)}${row + 1}`;
                        console.log(`✅ Using API selection: [${row}, ${col}] (${cellRef} in spreadsheet terms)`);
                        return { row, col };
                      } else {
                        console.log('⚠️ Could not extract coordinates from selection data');
                      }
                    }
                  }
                  
                  // Try getting active cell from API
                  console.log('🔍 Trying to get active cell from API...');
                  const activeCell = activeSheet.getActiveCell();
                  console.log('🔍 Active cell from API:', activeCell);
                  
                  if (activeCell) {
                    let row = undefined, col = undefined;
                    
                    // Try different property combinations
                    if (activeCell.row !== undefined && activeCell.column !== undefined) {
                      row = activeCell.row;
                      col = activeCell.column;
                    } else if (activeCell.row !== undefined && activeCell.col !== undefined) {
                      row = activeCell.row;
                      col = activeCell.col;
                    } else if (activeCell.actualRow !== undefined && activeCell.actualColumn !== undefined) {
                      row = activeCell.actualRow;
                      col = activeCell.actualColumn;
                    }
                    
                    if (row !== undefined && col !== undefined) {
                      console.log(`✅ Using API active cell: [${row}, ${col}] (${String.fromCharCode(65 + col)}${row + 1} in spreadsheet terms)`);
                      return { row, col };
                    }
                  }
                }
            }
          } catch (apiError) {
            console.log('⚠️ UniverAPI approach failed:', apiError.message);
          }
        }
        
        // Fallback to direct univer instance access
        if (!univer) {
          console.log('⚠️ Univer not available');
          return { row: 0, col: 0 };
        }
        
        console.log('🔍 Trying direct univer access...');
        
        // Try multiple ways to get the injector (matching your existing patterns)
        let injector = null;
        
        // Method 1: Try the _injector property (used elsewhere in your code)
        if (univer._injector) {
          injector = univer._injector;
          console.log('✅ Got injector from _injector property');
        }
        // Method 2: Try __getInjector method
        else if (univer.__getInjector && typeof univer.__getInjector === 'function') {
          injector = univer.__getInjector();
          console.log('✅ Got injector from __getInjector method');
        }
        // Method 3: Try getContext approach
        else if (univer.getContext && univer.getContext().injector) {
          injector = univer.getContext().injector;
          console.log('✅ Got injector from context');
        }
        // Method 4: Try __container property
        else if (univer.__container) {
          injector = univer.__container;
          console.log('✅ Got injector from __container property');
        }
        
        if (!injector) {
          console.log('⚠️ Could not access injector');
          return { row: 0, col: 0 };
        }
        
        console.log('🔍 Injector found, getting services...');
        
        // Try to get workbook service
        let workbookService = null;
        try {
          workbookService = injector.get('IWorkbookService') || injector.get('WorkbookService');
        } catch (serviceError) {
          console.log('⚠️ Could not get workbook service:', serviceError.message);
          return { row: 0, col: 0 };
        }
        
        console.log('🔍 Workbook service:', workbookService);
        
        if (workbookService) {
          const activeWorkbook = workbookService.getCurrentWorkbook?.();
          console.log('🔍 Active workbook:', activeWorkbook);
          
          if (activeWorkbook) {
            const activeWorksheet = activeWorkbook.getActiveSheet?.();
            console.log('🔍 Active worksheet:', activeWorksheet);
            
            if (activeWorksheet) {
              // Try to get selection through different methods
              console.log('🔍 Trying to get selection...');
              
              // Method 1: Try getSelection
              try {
                const selection = activeWorksheet.getSelection?.();
                if (selection) {
                  console.log(`📍 Found selection:`, selection);
                  
                  // Try different selection formats
                  if (selection.startRow !== undefined && selection.startColumn !== undefined) {
                    console.log(`✅ Using startRow/startColumn: [${selection.startRow}, ${selection.startColumn}]`);
                    return { row: selection.startRow, col: selection.startColumn };
                  }
                  if (selection.row !== undefined && selection.col !== undefined) {
                    console.log(`✅ Using row/col: [${selection.row}, ${selection.col}]`);
                    return { row: selection.row, col: selection.col };
                  }
                  if (selection.range && selection.range.startRow !== undefined) {
                    console.log(`✅ Using range: [${selection.range.startRow}, ${selection.range.startColumn}]`);
                    return { row: selection.range.startRow, col: selection.range.startColumn };
                  }
                }
              } catch (selectionError) {
                console.log('⚠️ getSelection failed:', selectionError.message);
              }
              
              // Method 2: Try getActiveSelection
              try {
                const activeSelection = activeWorksheet.getActiveSelection?.();
                if (activeSelection) {
                  console.log(`📍 Found active selection:`, activeSelection);
                  if (activeSelection.startRow !== undefined && activeSelection.startColumn !== undefined) {
                    console.log(`✅ Using active selection: [${activeSelection.startRow}, ${activeSelection.startColumn}]`);
                    return { row: activeSelection.startRow, col: activeSelection.startColumn };
                  }
                }
              } catch (activeSelectionError) {
                console.log('⚠️ getActiveSelection failed:', activeSelectionError.message);
              }
              
              // Method 3: Fallback to active cell
              try {
                const activeCell = activeWorksheet.getActiveCell?.();
                if (activeCell) {
                  console.log(`📍 Found active cell:`, activeCell);
                  const row = activeCell.row !== undefined ? activeCell.row : 0;
                  const col = activeCell.col !== undefined ? activeCell.col : 0;
                  console.log(`✅ Using active cell: [${row}, ${col}]`);
                  return { row, col };
                }
              } catch (activeCellError) {
                console.log('⚠️ getActiveCell failed:', activeCellError.message);
              }
            }
          }
        }
        
        console.log(`⚠️ Could not get cell selection, defaulting to [0,0]`);
        return { row: 0, col: 0 }; // Fallback
      } catch (error) {
        console.error(`❌ Error getting current cell selection:`, error);
        return { row: 0, col: 0 }; // Fallback
      }
    };

    // Function to show edit info for the currently selected cell
    const showCellEditInfo = () => {
      try {
        console.log(`🔍 Showing edit info for current selection...`);
        
        const selection = getCurrentCellSelection();
        if (!selection) {
          ElMessage.warning('Could not determine selected cell');
          return;
        }
        
        const { row, col } = selection;
        console.log(`📍 Checking edit info for cell [${row}, ${col}]`);
        
        const editInfo = getCellEditInfo(row, col);
        
        if (editInfo) {
          const editDate = new Date(editInfo.lastEditedAt);
          const formattedDate = editDate.toLocaleString();
          
          ElMessage({
            message: `Cell ${editInfo.cellPosition}: "${editInfo.cellValue}"\nLast edited by: ${editInfo.lastEditedByName}\nDate: ${formattedDate}`,
            type: 'info',
            duration: 5000,
            showClose: true,
            dangerouslyUseHTMLString: false
          });
          
          console.log(`📋 Edit info for cell [${row}, ${col}]:`, editInfo);
        } else {
          ElMessage({
            message: `Cell ${String.fromCharCode(65 + col)}${row + 1}: No edit history available`,
            type: 'info',
            duration: 3000
          });
          
          console.log(`📋 No edit info available for cell [${row}, ${col}]`);
        }
      } catch (error) {
        console.error(`❌ Error showing cell edit info:`, error);
        ElMessage.error('Error retrieving cell edit information');
      }
    };

    // Test function to manually add edit metadata (for verification)
    const testEditTracking = () => {
      console.log(`🧪 Testing edit tracking...`);
      if (currentUser.value) {
        console.log(`👤 User available: ${currentUser.value.email}`);
        addEditMetadataToCell(0, 0);
        addEditMetadataToCell(1, 1);
        console.log(`✅ Test edit metadata added to cells [0,0] and [1,1]`);
      } else {
        console.warn(`⚠️ No user loaded for testing - loading now...`);
        getCurrentUser().then(() => {
          if (currentUser.value) {
            addEditMetadataToCell(0, 0);
            addEditMetadataToCell(1, 1);
            console.log(`✅ Test edit metadata added after user load`);
          } else {
            console.error(`❌ Still no user after loading attempt`);
          }
        });
      }
    };

    // Expose functions for manual testing and edit info viewing
    defineExpose({
      testEditTracking,
      showCellEditInfo,
      getCellEditInfo
    });

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
      
      // Clear the stored references
      univer = null;
      univerAPI = null;
    });

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
            },
            resources: [
              {
                name: 'SHEET_NOTE_PLUGIN',
                data: '{"sheet-01":{}}'
              },
              {
                name: 'SHEET_RANGE_PROTECTION_PLUGIN',
                data: ""
              },
              {
                name: 'SHEET_AuthzIoMockService_PLUGIN',
                data: "{}"
              },
              {
                name: 'SHEET_WORKSHEET_PROTECTION_PLUGIN',
                data: "{}"
              },
              {
                name: 'SHEET_WORKSHEET_PROTECTION_POINT_PLUGIN',
                data: "{}"
              },
              {
                name: 'SHEET_DEFINED_NAME_PLUGIN',
                data: ""
              },
              {
                name: 'SHEET_RANGE_THEME_MODEL_PLUGIN',
                data: "{}"
              }
            ]
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

      if (!hasUnsavedChanges.value) {
        ElMessage.warning(`No changes to save`);
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
        
        //console.log(`🔄 Extracting current workbook data (${props.spreadsheetId})...`);
        
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
          //console.warn(`Service-based extraction failed (${props.spreadsheetId}):`, serviceError.message);
        }

        // Try the original unit-based approach as final fallback
        try {
          const units = univer.getAllUnits?.() || [];
          //console.log(`📊 Trying unit-based extraction with ${units.length} units (${props.spreadsheetId})`);
          
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

    // Store last known data state for comparison
    const lastKnownDataState = ref(null);
    
    // Helper function to create a simple hash of the data for comparison
    const getDataHash = (data) => {
      try {
        if (!data || !data.sheets) return '';
        
        let hash = '';
        Object.keys(data.sheets).forEach(sheetId => {
          const sheet = data.sheets[sheetId];
          if (sheet.cellData) {
            Object.keys(sheet.cellData).forEach(row => {
              Object.keys(sheet.cellData[row]).forEach(col => {
                const cell = sheet.cellData[row][col];
                if (cell && cell.v !== undefined) {
                  hash += `${sheetId}-${row}-${col}-${cell.v}|`;
                }
              });
            });
          }
        });
        return hash;
      } catch (error) {
        console.warn('Error creating data hash:', error);
        return '';
      }
    };
    
    // Smart change detection that only marks as unsaved if data actually changed
    const checkForRealChanges = () => {
      try {
        if (isInitializing.value) {
          console.log(`⏭️ Skipping change check - still initializing ${props.spreadsheetId}`);
          return false;
        }
        
        const currentData = getCurrentSpreadsheetData();
        const currentHash = getDataHash(currentData);
        
        if (lastKnownDataState.value === null) {
          // First time - store current state
          lastKnownDataState.value = currentHash;
          console.log(`📊 Initial data state stored for ${props.spreadsheetId}`);
          return false;
        }
        
        if (currentHash !== lastKnownDataState.value) {
          console.log(`📝 Real data change detected for ${props.spreadsheetId}`);
          lastKnownDataState.value = currentHash;
          return true;
        }
        
        console.log(`👀 No actual data change detected for ${props.spreadsheetId}`);
        return false;
      } catch (error) {
        console.warn(`Error checking for changes in ${props.spreadsheetId}:`, error);
        // Fallback to old behavior if there's an error
        return true;
      }
    };

    // Unsaved changes tracking - now with smart detection
    const markAsUnsaved = () => {
      console.log(`🔥 markAsUnsaved called for ${props.spreadsheetId}, initializing:`, isInitializing.value, ', current state:', hasUnsavedChanges.value);
      
      // Don't mark as unsaved during initial load
      if (isInitializing.value) {
        console.log(`⏭️ Skipping unsaved marking - still initializing ${props.spreadsheetId}`);
        return;
      }
      
      // Only mark as unsaved if data actually changed
      if (checkForRealChanges()) {
        if (!hasUnsavedChanges.value) {
          hasUnsavedChanges.value = true;
          console.log(`📝 Marked ${props.spreadsheetId} as having unsaved changes - REAL CHANGE DETECTED`);
        }
      } else {
        console.log(`👀 Skipping unsaved marking - no real data change detected for ${props.spreadsheetId}`);
      }
    };
    
    const markAsSaved = () => {
      console.log(`🔥 markAsSaved called for ${props.spreadsheetId}, current state:`, hasUnsavedChanges.value);
      if (hasUnsavedChanges.value) {
        hasUnsavedChanges.value = false;
        console.log(`✅ Marked ${props.spreadsheetId} as saved - NEW STATE:`, hasUnsavedChanges.value);
      }
      
      // Update the known data state to current state after saving
      try {
        const currentData = getCurrentSpreadsheetData();
        const currentHash = getDataHash(currentData);
        lastKnownDataState.value = currentHash;
        console.log(`📊 Updated known data state after save for ${props.spreadsheetId}`);
      } catch (error) {
        console.warn(`Error updating known data state after save for ${props.spreadsheetId}:`, error);
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
        markAsSaved(); // Clear unsaved changes indicator
        console.log(`✅ Save completed successfully (${props.spreadsheetId})`);
        
      } catch (error) {
        console.error(`❌ Manual save failed (${props.spreadsheetId}):`, error);
        ElMessage.error(`Failed to save ${props.spreadsheetName}: ${error.message || 'Unknown error'}`);
      }
    };



    const handleAnnotationChange = async (command) => {

      try {
        console.log('🎯 Annotation change detected:', command);
        
        if (command.params) {
            console.log('📝 Using command parameters for annotation update:', command.params);
            updateWorkbookDataWithAnnotations(command.params);
          }
      } catch (error) {
        console.error('❌ Error handling annotation change:', error);
      }
    }

    const updateWorkbookDataWithAnnotations = (annotations) => {
      // 1. get the latest note annotations
      // 2. fetch the sheet_note_plugin data
      // 3. update the sheet_note_plugin data with the latest annotations
      // 4. update the WORKBOOK_DATA_WITH_ANNOTATIONS with the latest sheet_note_plugin data

      try {
        console.log('🔄 Updating workbook data with annotations:', annotations);
        
        // Handle different annotation data formats
        let annotationData = null;
        
        if (annotations && annotations.params) {
          // Handle the specific annotation JSON structure
          annotationData = {
            row: annotations.params.row,
            col: annotations.params.col,
            note: annotations.params.note
          };
          console.log('📝 Processing annotation data:', annotationData);
        } else if (annotations && typeof annotations === 'object') {
          // Handle other annotation formats
          annotationData = annotations;
          console.log('📝 Processing generic annotation data:', annotationData);
        } else {
          console.log('⚠️ No valid annotation data provided');
          return;
        }

        // Get the current SHEET_NOTE_PLUGIN data 
        const notePluginResource = WORKBOOK_DATA.resources.find(
          resource => resource.name === 'SHEET_NOTE_PLUGIN'
        );
        
        if (!notePluginResource) {
          console.warn('⚠️ SHEET_NOTE_PLUGIN resource not found');
          return;
        }
        
        // Parse the current data
        let noteData = {};
        try {
          noteData = JSON.parse(notePluginResource.data);
        } catch (e) {
          noteData = { 'sheet-01': {} };
        }
        
        // Ensure sheet-01 exists
        if (!noteData['sheet-01']) {
          noteData['sheet-01'] = {};
        }
        
        // Update with the latest annotation
        if (annotationData && annotationData.row !== undefined && annotationData.col !== undefined) {
          const row = annotationData.row;
          const col = annotationData.col;
          
          // Ensure row exists
          if (!noteData['sheet-01'][row]) {
            noteData['sheet-01'][row] = {};
          }
          
          // Update the annotation
          if (annotationData.note) {
            noteData['sheet-01'][row][col] = {
              width: annotationData.note.width || 160,
              height: annotationData.note.height || 72,
              note: annotationData.note.note || 'Annotation',
              show: false
            };
            
            console.log(`📝 Updated annotation at [${row}, ${col}]:`, {
              width: annotationData.note.width || 160,
              height: annotationData.note.height || 72,
              note: annotationData.note.note || 'Annotation'
            });
          } else {
            // Remove annotation if note is null/undefined
            if (noteData['sheet-01'][row][col]) {
              delete noteData['sheet-01'][row][col];
              console.log(`🗑️ Removed annotation at [${row}, ${col}]`);
            }
            
            // Clean up empty rows
            if (Object.keys(noteData['sheet-01'][row]).length === 0) {
              delete noteData['sheet-01'][row];
            }
          }
        }
        
        // Update the resource data
        notePluginResource.data = JSON.stringify(noteData);
        
        console.log('✅ Updated SHEET_NOTE_PLUGIN data:', notePluginResource.data);
        console.log('🔄 Updated WORKBOOK_DATA:', WORKBOOK_DATA);
        
      } catch (error) {
        console.error('❌ Error updating workbook data with annotations:', error);
      }
    }

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

/* State indicator */
.state-indicator {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1000;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(4px);
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  transition: all 0.3s ease;
  border: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* Loading state */
.state-indicator.loading {
  color: #6b7280;
  animation: loadingPulse 1.5s infinite;
}

/* Unsaved state */
.state-indicator.unsaved {
  color: #dc2626;
  animation: unsavedPulse 2s infinite;
}

/* Saved state */
.state-indicator.saved {
  color: #059669;
  animation: savedFade 3s ease-out;
}

.state-text {
  display: flex;
  align-items: center;
  gap: 6px;
}

.state-icon {
  font-size: 14px;
  display: inline-block;
}

/* Icon animations */
.state-indicator.loading .state-icon {
  animation: loadingRotate 2s linear infinite;
}

.state-indicator.unsaved .state-icon {
  animation: unsavedShake 0.5s ease-in-out infinite alternate;
}

/* Animations */
@keyframes loadingPulse {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
}

@keyframes loadingRotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes unsavedPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
}

@keyframes unsavedShake {
  0% { transform: translateX(0); }
  100% { transform: translateX(1px); }
}

@keyframes savedFade {
  0% { opacity: 1; transform: scale(1.02); }
  80% { opacity: 1; transform: scale(1); }
  100% { opacity: 0.8; transform: scale(1); }
}

/* Animations for smooth transitions */
</style> 