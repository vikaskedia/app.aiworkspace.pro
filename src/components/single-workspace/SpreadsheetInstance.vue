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
        <span class="state-text" v-if="!isViewingHistory">
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
      
      <!-- Close History Button - appears when viewing history -->
      <div v-if="isViewingHistory" class="close-history-btn" @click="closeHistoryView">
        <span class="close-icon">✕</span>
        <!-- <span class="close-text">Close History</span> -->
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


      <!-- History Modal -->
      <div v-if="showHistoryModal" class="history-modal-overlay" @click="showHistoryModal = false">
        <div class="history-modal" @click.stop>
          <div class="history-modal-header">
            <h3>Spreadsheet History</h3>
            <button class="history-modal-close" @click="showHistoryModal = false">×</button>
          </div>
          
          <div class="history-modal-content">
            <div v-if="loadingHistory" class="history-loading">
              <span class="loading-spinner">⏳</span> Loading history...
            </div>
            
            <div v-else-if="historyData.length === 0" class="history-empty">
              <span class="empty-icon">📚</span>
              <p>No history found for this spreadsheet</p>
            </div>
            
            <div v-else class="history-list">
              <div 
                v-for="record in historyData" 
                :key="record.id" 
                class="history-item"
                @click="loadHistoryData(record)"
              >
                <div class="history-item-header">
                  <span class="history-item-date">{{ record.formattedDate }}</span>
                  <span class="history-item-relative">{{ record.relativeDate }}</span>
                </div>
                <div class="history-item-details">
                  <!-- <span class="history-item-name">{{ record.name }}</span> -->
                  <span v-if="record.userDisplay" class="history-item-user">by {{ record.userDisplay }}</span>
                  <button class="history-load-btn">Load This Version</button>
                </div>
                <!-- <div class="history-item-actions">
                  <button class="history-load-btn">Load This Version</button>
                </div> -->
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref, computed, watch } from 'vue';
import { supabase } from '../../supabase';
import { ElMessage, ElNotification } from 'element-plus';
import { useWorkspaceStore } from '../../store/workspace';
import { useTaskStore } from '../../store/task';
import { useUserStore } from '../../store/user';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';


/*
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

*/



// Univer imports
import  { FUniver, Univer, createUniver, LocaleType, merge, UniverInstanceType } from '@univerjs/presets'
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core'

// plugin imports
import { UniverSheetsNotePreset } from '@univerjs/preset-sheets-note'
import { UniverSheetsHyperLinkPreset } from '@univerjs/preset-sheets-hyper-link'

// Locale imports
import UniverPresetSheetsCoreEnUS from '@univerjs/preset-sheets-core/locales/en-US'
import UniverPresetSheetsNoteEnUS from '@univerjs/preset-sheets-note/locales/en-US'
import UniverPresetSheetsHyperLinkEnUS from '@univerjs/preset-sheets-hyper-link/locales/en-US'

// Note: APICALL function is implemented as a manual processor, not a registered Univer function

// CSS imports
import '@univerjs/preset-sheets-core/lib/index.css'
import '@univerjs/preset-sheets-note/lib/index.css'
import '@univerjs/preset-sheets-hyper-link/lib/index.css'

// Import formula facade API to enable formula functionality
import '@univerjs/sheets-formula/facade'


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
      workspaceId: {
        type: Number,
        required: false,
        default: null
      },
      portfolioId: {
        type: String,
        required: false,
        default: null
      },
      readonly: {
        type: Boolean,
        default: false
      }
    })

    // Define emits
    const emit = defineEmits(['remove-spreadsheet'])

    // Router for URL navigation
    const router = useRouter();

    // Check if we're loading from URL history parameters
    const isLoadingFromUrlHistory = computed(() => {
      return router.currentRoute.value.params.historyId && router.currentRoute.value.params.spreadsheetId;
    });
    
    // Get history ID from URL if present
    const urlHistoryId = computed(() => router.currentRoute.value.params.historyId);
    const urlSpreadsheetId = computed(() => router.currentRoute.value.params.spreadsheetId);

    // Workspace store for workspace context
    const workspaceStore = useWorkspaceStore();
    const { currentWorkspace } = storeToRefs(workspaceStore);
    
    // Task store for fetching task information
    const taskStore = useTaskStore();
    
    // User store for fetching user/assignee information
    const userStore = useUserStore();
    
    // Real-time subscription for task updates
    let taskUpdateSubscription = null;
    
    // Global references for real-time updates
    const taskStatusCells = new Map(); // taskId -> [{row, col, sheetId}] - Use const to ensure it doesn't get reassigned
    let getCurrentSpreadsheetDataRef = null;
    let saveCurrentDataRef = null;
    let insertHyperlinkInCellRef = null;
    
    // Helper function to format status for display
    const formatTaskStatus = (status) => {
      const statusMap = {
        'not_started': 'Not Started',
        'in_progress': 'In Progress',
        'not_needed_anymore': 'Not needed anymore',
        'awaiting_external': 'Awaiting External',
        'awaiting_internal': 'Awaiting Internal',
        'completed': 'Completed'
      };
      return statusMap[status] || status || 'Unknown';
    };
    
    // Function to refresh specific TASKSTATUS cells when task status changes
    const refreshTaskStatusCells = async (taskId) => {
      console.log(`🔄 Refreshing TASKSTATUS cells for task ${taskId}`);
      console.log(`📊 Current global taskStatusCells map:`, Array.from(taskStatusCells.entries()));
      console.log(`📊 Looking for cells for task ${taskId}:`, taskStatusCells.get(taskId));
      
      const cellsToRefresh = taskStatusCells.get(taskId);
      if (!cellsToRefresh || cellsToRefresh.length === 0) {
        console.log(`📍 No TASKSTATUS cells found for task ${taskId}`);
        console.log(`📊 Available task IDs in map:`, Array.from(taskStatusCells.keys()));
        return;
      }
      
      try {
        // Fetch updated task data
        const task = await taskStore.getTaskById(taskId);
        
        const currentData = getCurrentSpreadsheetDataRef?.();
        if (!currentData?.sheets) {
          console.warn('⚠️ No spreadsheet data available for refresh');
          return;
        }
        
        let refreshCount = 0;
        
        for (const cellInfo of cellsToRefresh) {
          const { row, col, sheetId } = cellInfo;
          const sheet = currentData.sheets[sheetId];
          
          if (sheet?.cellData?.[row]?.[col]) {
            const cell = sheet.cellData[row][col];
            
            if (task && task.status) {
              const formattedStatus = formatTaskStatus(task.status);
              
              // Update cell value
              cell.v = formattedStatus;
              
              // Update stored task data
              cell.taskStatusData = {
                taskId: taskId,
                originalFormula: cell.taskStatusData?.originalFormula || `=TASKSTATUS(${taskId})`,
                workspaceId: workspaceStore.currentWorkspace?.id
              };
              
              // Update hyperlink
              setTimeout(() => {
                try {
                  const workspaceId = workspaceStore.currentWorkspace?.id;
                  if (workspaceId && insertHyperlinkInCellRef) {
                    const taskUrl = `/single-workspace/${workspaceId}/tasks/${taskId}`;
                    const absoluteUrl = `${window.location.origin}${taskUrl}`;
                    insertHyperlinkInCellRef(parseInt(row), parseInt(col), formattedStatus, absoluteUrl);
                  }
                } catch (linkError) {
                  console.warn(`⚠️ Could not update hyperlink for cell [${row}, ${col}]:`, linkError);
                }
              }, 50);
              
              refreshCount++;
              console.log(`✅ Refreshed TASKSTATUS cell [${row}, ${col}] → "${formattedStatus}"`);
            } else {
              // Task not found or has no status
              cell.v = 'Task Not Found';
              console.log(`⚠️ Task ${taskId} not found during refresh`);
            }
          }
        }
        
        if (refreshCount > 0) {
          // Save updated data to database
          if (saveCurrentDataRef) {
            await saveCurrentDataRef(currentData);
          }
          //ElMessage.success(`Updated ${refreshCount} TASKSTATUS cell(s) for task ${taskId}`);
        }
        
      } catch (error) {
        console.error(`❌ Error refreshing TASKSTATUS cells for task ${taskId}:`, error);
        ElMessage.error(`Failed to refresh task ${taskId} status in spreadsheet`);
      }
    };
    
    // Function to clean up duplicate TASKSTATUS formulas in unwanted cells
    const cleanupDuplicateTaskStatusCells = () => {
      console.log(`🧹 Cleaning up duplicate TASKSTATUS formulas...`);
      
      if (!getCurrentSpreadsheetDataRef) return;
      
      try {
        const currentData = getCurrentSpreadsheetDataRef();
        if (!currentData?.sheets) return;
        
        const formulaCells = [];
        
        // First pass: find all cells with TASKSTATUS formulas
        for (const sheetId of Object.keys(currentData.sheets)) {
          const sheet = currentData.sheets[sheetId];
          if (!sheet.cellData) continue;
          
                      for (const row of Object.keys(sheet.cellData)) {
              const rowData = sheet.cellData[row];
              if (!rowData || typeof rowData !== 'object') continue;
              for (const col of Object.keys(rowData)) {
                const cell = rowData[col];
              
              if (cell?.f && typeof cell.f === 'string') {
                const formula = cell.f.trim();
                const taskStatusMatch = formula.match(/^=TASKSTATUS\((\d+)\)$/i);
                
                if (taskStatusMatch) {
                  formulaCells.push({ row, col, sheetId, formula, taskId: parseInt(taskStatusMatch[1], 10) });
                  console.log(`🔍 Found TASKSTATUS formula at [${row}, ${col}]: ${formula}`);
                }
              }
            }
          }
        }
        
        console.log(`📊 Total TASKSTATUS formulas found: ${formulaCells.length}`);
        
        // Group by task ID to find duplicates
        const taskGroups = {};
        formulaCells.forEach(cell => {
          if (!taskGroups[cell.taskId]) {
            taskGroups[cell.taskId] = [];
          }
          taskGroups[cell.taskId].push(cell);
        });
        
        // Report duplicates
        Object.keys(taskGroups).forEach(taskId => {
          const cells = taskGroups[taskId];
          if (cells.length > 1) {
            console.log(`⚠️ Duplicate TASKSTATUS(${taskId}) found in ${cells.length} cells:`, 
              cells.map(c => `[${c.row}, ${c.col}]`).join(', '));
          }
        });
        
      } catch (error) {
        console.error(`❌ Error cleaning duplicate TASKSTATUS cells:`, error);
      }
    };
    
    // Function to scan existing spreadsheet data and track TASKSTATUS cells
    const scanAndTrackExistingTaskStatusCells = () => {
      console.log(`🔍 Scanning for existing TASKSTATUS cells to track...`);
      
      if (!getCurrentSpreadsheetDataRef) {
        console.log(`⚠️ getCurrentSpreadsheetDataRef not available yet`);
        return;
      }
      
      try {
        const currentData = getCurrentSpreadsheetDataRef();
        if (!currentData?.sheets) {
          console.log(`⚠️ No spreadsheet data available for scanning`);
          return;
        }
        
        let foundCells = 0;
        
        // Scan all sheets
        for (const sheetId of Object.keys(currentData.sheets)) {
          const sheet = currentData.sheets[sheetId];
          if (!sheet.cellData) continue;
          
          // Scan all rows
                      for (const row of Object.keys(sheet.cellData)) {
              // Scan all columns
              const rowData = sheet.cellData[row];
              if (!rowData || typeof rowData !== 'object') continue;
              for (const col of Object.keys(rowData)) {
                const cell = rowData[col];
              
              // Debug: log every cell that has any data
              if (cell && (cell.f || cell.v || cell.taskStatusData)) {
                console.log(`🔍 Cell [${row}, ${col}]:`, {
                  formula: cell.f,
                  value: cell.v, 
                  taskStatusData: cell.taskStatusData,
                  hasFormula: !!cell.f,
                  hasValue: !!cell.v,
                  hasTaskData: !!cell.taskStatusData
                });
              }
              
              // Check if cell has taskStatusData (already processed TASKSTATUS formula)
              if (cell?.taskStatusData?.taskId) {
                const taskId = cell.taskStatusData.taskId;
                console.log(`🔍 Found cell with taskStatusData at [${row}, ${col}]:`, cell.taskStatusData);
                
                // Track this cell
                if (!taskStatusCells.has(taskId)) {
                  taskStatusCells.set(taskId, []);
                }
                const cellsForTask = taskStatusCells.get(taskId);
                
                // Check if not already tracked
                const cellExists = cellsForTask.some(c => c.row === row && c.col === col && c.sheetId === sheetId);
                if (!cellExists) {
                  cellsForTask.push({ row, col, sheetId });
                  foundCells++;
                  console.log(`📍 Found and tracked existing TASKSTATUS cell [${row}, ${col}] for task ${taskId}`);
                }
              }
              
              // Also check for cells with TASKSTATUS formula but no taskStatusData yet
              else if (cell?.f && typeof cell.f === 'string') {
                const formula = cell.f.trim();
                console.log(`🔍 Found cell with formula at [${row}, ${col}]: "${formula}"`);
                const taskStatusMatch = formula.match(/^=TASKSTATUS\((\d+)\)$/i);
                
                if (taskStatusMatch) {
                  const taskId = parseInt(taskStatusMatch[1], 10);
                  console.log(`🔍 Found TASKSTATUS formula at [${row}, ${col}] for task ${taskId}`);
                  if (!isNaN(taskId)) {
                    // Track this cell
                    if (!taskStatusCells.has(taskId)) {
                      taskStatusCells.set(taskId, []);
                    }
                    const cellsForTask = taskStatusCells.get(taskId);
                    
                    // Check if not already tracked
                    const cellExists = cellsForTask.some(c => c.row === row && c.col === col && c.sheetId === sheetId);
                    if (!cellExists) {
                      cellsForTask.push({ row, col, sheetId });
                      foundCells++;
                      console.log(`📍 Found and tracked unprocessed TASKSTATUS cell [${row}, ${col}] for task ${taskId}`);
                    }
                  }
                }
              }
            }
          }
        }
        
        console.log(`✅ Scan complete: Found and tracked ${foundCells} TASKSTATUS cells`);
        console.log(`📊 Global taskStatusCells map after scan:`, Array.from(taskStatusCells.entries()));
        
      } catch (error) {
        console.error(`❌ Error scanning for existing TASKSTATUS cells:`, error);
      }
    };
    
    // Set up real-time subscription for task status updates
    const setupTaskUpdateSubscription = () => {
      // Clean up existing subscription
      if (taskUpdateSubscription) {
        taskUpdateSubscription.unsubscribe();
      }
      
      const workspaceId = currentWorkspaceId.value;
      if (!workspaceId) {
        console.warn('⚠️ No workspace ID available for task update subscription');
        return;
      }
      
      console.log(`📡 Setting up task update subscription for workspace ${workspaceId} in spreadsheet ${props.spreadsheetId}`);
      
      taskUpdateSubscription = supabase
        .channel(`tasks-updates-${workspaceId}-${props.spreadsheetId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'tasks',
            filter: `workspace_id=eq.${workspaceId}`
          },
          async (payload) => {
            console.log('📡 Received task update in spreadsheet:', payload);
            
            if (payload.new && payload.old) {
              const taskId = payload.new.id;
              const oldStatus = payload.old.status;
              const newStatus = payload.new.status;
              
              // Only refresh if status actually changed
              if (oldStatus !== newStatus) {
                console.log(`🔄 Task ${taskId} status changed: "${oldStatus}" → "${newStatus}"`);
                
                // Clear task cache to force fresh data
                taskStore.clearTaskCache(workspaceId);
                
                // Refresh TASKSTATUS cells for this task
                await refreshTaskStatusCells(taskId);
              }
            }
          }
        )
        .subscribe((status) => {
          console.log(`📡 Task update subscription status for ${props.spreadsheetId}:`, status);
        });
    };
    
    // Use prop workspaceId if provided, otherwise get from current workspace
    const currentWorkspaceId = computed(() => props.workspaceId || currentWorkspace.value?.id);
    
    // Cell edit tracking for user history
    const currentUser = ref(null);
    const isReadonly = ref(false);
    
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
    let editEventListener = null;
    let isComponentMounted = true; // Track component mount state to prevent disposed injector access
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


    const loadWorkbookData = async () => {
      const workbookData = await loadPortfolioData();
      if (workbookData && workbookData.sheets) {
        Object.assign(WORKBOOK_DATA, workbookData);
        portfolioData.value = workbookData;
      }
    }
    const fnCreateUniver = async (readonlyState) => {

      const univerInstance = createUniver({
          locale: LocaleType.EN_US,
          locales: {
            [LocaleType.EN_US]: merge(
              {},
              UniverPresetSheetsCoreEnUS,
              UniverPresetSheetsNoteEnUS,
              UniverPresetSheetsHyperLinkEnUS
            ),
          },
          presets: [
            UniverSheetsCorePreset({
              //container: container.value as HTMLElement,
              container: `univer-container-${props.spreadsheetId}`,
              header: !readonlyState, // Show header when not readonly
              toolbar: !readonlyState, // Show toolbar when not readonly
              // formula: {
              //   // Enable automatic formula calculation when cells change
              //   initialFormulaComputing: 'FORCED'
              // }
            }),
            UniverSheetsNotePreset(),
            UniverSheetsHyperLinkPreset({
              // Customize the way external links are opened
              urlHandler: {
                navigateToOtherWebsite: url => window.open(`${url}?utm_source=AI+Workspace`, '_blank', 'noopener,noreferrer'),
              },
            }),
          ],
        })

        
        
        // Store both univer and univerAPI for global access
        univer = univerInstance.univer;
        univerAPI = univerInstance.univerAPI;

         // Check if Univer instance creation was successful
        if (!univer || !univerAPI) {
          console.error(`❌ Failed to create Univer instance for ${props.spreadsheetId}:`, {
            univer: !!univer,
            univerAPI: !!univerAPI,
            readonly: props.readonly
          });
          throw new Error('Univer instance creation failed');
        }
        
        console.log(`✅ Univer instance created successfully for ${props.spreadsheetId}:`, {
          univer: !!univer,
          univerAPI: !!univerAPI,
          readonly: props.readonly
        });
      
    }

    // Currency value parsing utility function
    const parseCurrencyValue = (value) => {
      if (value === null || value === undefined) return 0;
      
      // If already a number, return it
      if (typeof value === 'number') return value;
      
      // Convert to string and remove currency symbols and formatting
      const str = String(value);
      
      // Remove common currency symbols, commas, and whitespace
      const cleaned = str
        .replace(/[$€£¥₹₽]/g, '') // Remove currency symbols
        .replace(/[,\s]/g, '') // Remove commas and spaces
        .replace(/[()]/g, '') // Remove parentheses (negative values)
        .trim();
      
      // Check if the original had parentheses (negative)
      const isNegative = str.includes('(') && str.includes(')');
      
      // Parse as float
      const parsed = parseFloat(cleaned);
      
      // Return 0 if not a valid number, otherwise return the value (negative if needed)
      return isNaN(parsed) ? 0 : (isNegative ? -parsed : parsed);
    };
    
    // Enhanced formula calculation with currency support
    const enhanceFormulaCalculation = () => {
      try {
        if (univerAPI && univerAPI.getFormula) {
          const formula = univerAPI.getFormula();
          
          // Add event listener for formula calculations
          formula.calculationStart((forceCalculate) => {
            console.log('🧮 Formula calculation started, ensuring currency values are parsed correctly');
          });
          
          formula.calculationEnd((functionsExecutedState) => {
            console.log('✅ Formula calculation completed');
          });
          
          // Set calculation mode to ensure formulas update automatically
          formula.setInitialFormulaComputing('FORCED');
        }
      } catch (error) {
        console.warn('⚠️ Could not enhance formula calculation:', error);
      }
    };

    // TASKSTATUS formula processor - fetches real task status from database
    const processTaskStatusFormulas = async () => {
      try {
        console.log(`🔍 processTaskStatusFormulas started, global taskStatusCells has ${taskStatusCells.size} entries`);
        const currentData = getCurrentSpreadsheetData();
        if (!currentData || !currentData.sheets) return;
        
        let processedCount = 0;
        let needsReload = false;
        

        
        // Process each sheet
        for (const sheetId of Object.keys(currentData.sheets)) {
          const sheet = currentData.sheets[sheetId];
          if (!sheet.cellData) continue;
          
          // Process each row
                      for (const row of Object.keys(sheet.cellData)) {
              // Process each column
              const rowData = sheet.cellData[row];
              if (!rowData || typeof rowData !== 'object') continue;
              for (const col of Object.keys(rowData)) {
                const cell = rowData[col];
                if (cell && cell.f && typeof cell.f === 'string') {
                  const formula = cell.f.trim();
                  const taskStatusMatch = formula.match(/^=TASKSTATUS\((\d+)\)$/i);
                
                if (taskStatusMatch) {
                  const taskId = parseInt(taskStatusMatch[1], 10);
                  if (!isNaN(taskId)) {
                    console.log(`🔍 Found TASKSTATUS formula at [${row}, ${col}] in sheet ${sheetId}: ${formula}`);
                    // Always process TASKSTATUS formulas to get fresh status on page load
                    console.log(`🔄 Processing TASKSTATUS formula at [${row}, ${col}] to get current status`);
                    
                    // Clear task cache to ensure fresh data
                    taskStore.clearTaskCache();
                    
                    try {
                      console.log(`🔍 Fetching status for task ID: ${taskId} at [${row}, ${col}] (${props.spreadsheetId})`);
                      
                      // Fetch task from database
                      const task = await taskStore.getTaskById(taskId);
                      
                      if (task && task.status) {
                        const formattedStatus = formatTaskStatus(task.status);
                        
                        // Get assignee info to include in the same cell
                        let assigneeInfo = null;
                        if (task.assignee) {
                          try {
                            console.log(`🔍 Fetching assignee info for user ID: ${task.assignee}`);
                            assigneeInfo = await userStore.getUserInfo(task.assignee);
                            console.log(`👤 Assignee info result:`, assigneeInfo);
                          } catch (assigneeError) {
                            console.warn(`⚠️ Could not fetch assignee info for ${task.assignee}:`, assigneeError);
                          }
                        } else {
                          console.log(`📝 Task ${taskId} has no assignee (task.assignee is null/undefined)`);
                        }
                        
                        // Create combined display: "Status 👤" or "Status 👤Name"
                        let cellDisplay = formattedStatus;
                        if (assigneeInfo) {
                          const assigneeName = assigneeInfo.fullName || assigneeInfo.username || assigneeInfo.email.split('@')[0];
                          cellDisplay = `${formattedStatus} 👤 ${assigneeName}`;
                        } else if (task.assignee) {
                          cellDisplay = `${formattedStatus} 👤 Unknown`;
                        } else {
                          cellDisplay = `${formattedStatus} 👤 Unassigned`;
                        }
                        
                        // Update the cell value but keep the formula
                        cell.v = cellDisplay;
                        // Keep the formula so it can be processed again on page refresh
                        
                        // Store task data for click navigation AND assignee info
                        cell.taskStatusData = {
                          taskId: taskId,
                          originalFormula: formula,
                          workspaceId: workspaceStore.currentWorkspace?.id,
                          status: formattedStatus,
                          assigneeInfo: assigneeInfo ? {
                            id: task.assignee,
                            name: assigneeInfo.fullName || assigneeInfo.username || assigneeInfo.email.split('@')[0],
                            email: assigneeInfo.email,
                            avatarUrl: assigneeInfo.avatarUrl
                          } : null
                        };
                        
                        console.log(`✅ Processed TASKSTATUS(${taskId}) → "${cellDisplay}" at [${row}, ${col}] (${props.spreadsheetId})`);
                        
                        // Note: Real-time tracking removed for simplicity
                        
                        // Add hyperlink to cell for right-click functionality
                        setTimeout(() => {
                          try {
                            const workspaceId = workspaceStore.currentWorkspace?.id;
                            if (workspaceId) {
                              const taskUrl = `/single-workspace/${workspaceId}/tasks/${taskId}`;
                              // Use absolute URL for hyperlink
                              const absoluteUrl = `${window.location.origin}${taskUrl}`;
                              insertHyperlinkInCell(parseInt(row), parseInt(col), cellDisplay, absoluteUrl);
                              console.log(`🔗 Added hyperlink to TASKSTATUS cell [${row}, ${col}] → ${absoluteUrl}`);
                            }
                          } catch (linkError) {
                            console.warn(`⚠️ Could not add hyperlink to cell [${row}, ${col}]:`, linkError);
                          }
                        }, 100); // Small delay to ensure cell is updated
                        
                        // Show user notification
                        //ElMessage.success(`Task ${taskId} status: ${formattedStatus}`);
                        
                        // Formula processed successfully
                        
                        processedCount++;
                        needsReload = true;
                      } else {
                        // Task not found or has no status
                        cell.v = 'Task Not Found';
                        // Keep the formula for future processing
                        
                        // Store task data even for failed cases to enable click navigation
                        cell.taskStatusData = {
                          taskId: taskId,
                          originalFormula: formula,
                          workspaceId: workspaceStore.currentWorkspace?.id
                        };
                        
                        console.warn(`⚠️ Task ${taskId} not found or has no status (${props.spreadsheetId})`);
                        ElMessage.warning(`Task ${taskId} not found or not accessible`);
                        
                        // Note: Real-time tracking removed for simplicity
                        
                        // Task not found - formula processed
                        
                        processedCount++;
                        needsReload = true;
                      }
                    } catch (fetchError) {
                      console.error(`❌ Error fetching task ${taskId}:`, fetchError);
                      
                      // Update cell with error message but keep formula
                      cell.v = 'Access Denied';
                      // Keep the formula for future processing
                      
                      // Store task data even for error cases to enable click navigation
                      cell.taskStatusData = {
                        taskId: taskId,
                        originalFormula: formula,
                        workspaceId: workspaceStore.currentWorkspace?.id
                      };
                      
                      ElMessage.error(`Cannot access task ${taskId}: ${fetchError.message || 'Permission denied'}`);
                      
                      // Note: Real-time tracking removed for simplicity
                      
                      // Error handled - formula processed
                      
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
          
          // Force immediate UI refresh to display cell values
          setTimeout(() => {
            try {
              // Update Vue reactivity
              portfolioData.value = { ...currentData };
              
              // Force browser re-render with a small DOM manipulation
              const container = document.querySelector(`#univer-container-${props.spreadsheetId}`);
              if (container) {
                container.style.opacity = '0.999';
                setTimeout(() => {
                  container.style.opacity = '1';
                }, 1);
              }
              
              console.log(`🔄 Forced UI refresh for TASKSTATUS results (${props.spreadsheetId})`);
            } catch (refreshError) {
              console.warn(`⚠️ UI refresh failed, but data was saved (${props.spreadsheetId}):`, refreshError);
            }
          }, 10);
          
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
    
    // APICALL formula processor - makes HTTP requests and extracts JSON values
    // Cache to prevent re-processing the same formula repeatedly
    const apiCallCache = new Map();
    
    const processApiCallFormulas = async () => {
      try {
        const currentData = getCurrentSpreadsheetData();
        if (!currentData || !currentData.sheets) return;
        
        let processedCount = 0;
        let needsReload = false;
        
        // Helper function to extract value from JSON using dot notation
        const extractValue = (obj, key) => {
          if (!obj || typeof obj !== 'object') return undefined;
          
          const keys = key.split('.');
          let current = obj;
          
          for (const k of keys) {
            if (current && typeof current === 'object' && k in current) {
              current = current[k];
            } else {
              return undefined;
            }
          }
          
          return current;
        };
        
        // Process each sheet
        for (const sheetId of Object.keys(currentData.sheets)) {
          const sheet = currentData.sheets[sheetId];
          if (!sheet.cellData) continue;
          
          // Process each row
                      for (const row of Object.keys(sheet.cellData)) {
              // Process each column
              const rowData = sheet.cellData[row];
              if (!rowData || typeof rowData !== 'object') continue;
              for (const col of Object.keys(rowData)) {
                const cell = rowData[col];
                if (cell && cell.f && typeof cell.f === 'string') {
                  const formula = cell.f.trim();
                  // Match APICALL("url", "key") pattern
                  const apiCallMatch = formula.match(/^=APICALL\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']\s*\)$/i);
                
                if (apiCallMatch) {
                  const url = apiCallMatch[1];
                  const key = apiCallMatch[2];
                  
                  // Create cache key to prevent re-processing the same formula
                  const cacheKey = `${sheetId}-${row}-${col}-${formula}`;
                  const now = Date.now();
                  const cacheEntry = apiCallCache.get(cacheKey);
                  
                  // Skip if processed within the last 30 seconds
                  if (cacheEntry && (now - cacheEntry.timestamp) < 30000) {
                    continue;
                  }
                  
                  // Skip if cell already has a value (unless it's an error)
                  if (cell.v && !String(cell.v).startsWith('Error:') && !String(cell.v).includes('not found')) {
                    // Cache successful results for 30 seconds
                    apiCallCache.set(cacheKey, { timestamp: now, status: 'cached' });
                    continue;
                  }
                  
                  try {
                    console.log(`🌐 Making API call to ${url} for key '${key}' at [${row}, ${col}] (${props.spreadsheetId})`);
                    
                    // Validate URL format
                    try {
                      new URL(url);
                    } catch (urlError) {
                      throw new Error('Invalid URL format');
                    }
                    
                    // Make the HTTP request
                    const response = await fetch(url, {
                      method: 'GET',
                      headers: {
                        'Accept': 'application/json',
                      },
                      mode: 'cors',
                    });
                    
                    if (!response.ok) {
                      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    
                    // Parse JSON response
                    const data = await response.json();
                    console.log(`📊 APICALL: Received data from ${url}:`, data);
                    
                    // Extract the requested value
                    const value = extractValue(data, key);
                    
                    if (value === undefined || value === null) {
                      // Key not found - keep formula but set error value
                      cell.v = `Key '${key}' not found`;
                      // Keep cell.f - don't delete the formula
                      
                      console.warn(`⚠️ APICALL: Key '${key}' not found in response from ${url}`);
                      ElMessage.warning(`APICALL: Key '${key}' not found in API response`);
                    } else {
                      // Success - keep formula and set calculated value
                      const oldValue = cell.v;
                      cell.v = String(value);
                      // Keep cell.f - don't delete the formula so it behaves like predefined formulas
                      
                      console.log(`✅ Processed APICALL(${url}, ${key}) → "${value}" at [${row}, ${col}] (${props.spreadsheetId})`);
                      console.log(`📝 Cell update: "${oldValue}" → "${cell.v}" | Formula kept: ${!!cell.f}`);
                      ElMessage.success(`APICALL: Got ${key} = ${value}`);
                    }
                    
                    // Cache this result for 30 seconds
                    apiCallCache.set(cacheKey, { timestamp: now, status: 'processed' });
                    
                    processedCount++;
                    needsReload = true;
                    
                  } catch (apiError) {
                    console.error(`❌ APICALL Error for ${url}:`, apiError);
                    
                    // Update cell with error message but keep formula
                    cell.v = `Error: ${apiError.message || 'API call failed'}`;
                    // Keep cell.f - don't delete the formula so it behaves like predefined formulas
                    
                    ElMessage.error(`APICALL failed: ${apiError.message || 'Unknown error'}`);
                    
                    // Cache this error for 30 seconds to prevent repeated failed calls
                    apiCallCache.set(cacheKey, { timestamp: now, status: 'error' });
                    
                    processedCount++;
                    needsReload = true;
                  }
                }
              }
            }
          }
        }
        
        if (needsReload) {
          console.log(`📊 Processed ${processedCount} APICALL formulas (${props.spreadsheetId})`);
          
          // Update portfolio data
          portfolioData.value = { ...currentData };
          
          // Force immediate UI refresh to display cell values
          setTimeout(() => {
            try {
              // Update Vue reactivity
              const oldData = portfolioData.value;
              portfolioData.value = { ...currentData };
              console.log(`📊 Vue data updated - Old: ${!!oldData}, New: ${!!portfolioData.value}`);
              
              // Force browser re-render with a small DOM manipulation
              const container = document.querySelector(`#univer-container-${props.spreadsheetId}`);
              if (container) {
                console.log(`🎯 Found container, forcing visual refresh`);
                container.style.opacity = '0.999';
                setTimeout(() => {
                  container.style.opacity = '1';
                  console.log(`🔄 Visual refresh completed`);
                }, 1);
              } else {
                console.warn(`⚠️ Container not found: #univer-container-${props.spreadsheetId}`);
              }
              
              console.log(`🔄 Forced UI refresh for APICALL results (${props.spreadsheetId})`);
            } catch (refreshError) {
              console.warn(`⚠️ UI refresh failed, but data was saved (${props.spreadsheetId}):`, refreshError);
            }
          }, 10);
          
          // Save to database
          try {
            await savePortfolioData(currentData);
            console.log(`💾 Saved processed APICALL results to database (${props.spreadsheetId})`);
          } catch (saveError) {
            console.warn(`⚠️ Could not save APICALL data (${props.spreadsheetId}):`, saveError.message);
          }
          
          // Trigger data refresh
          console.log(`🔄 APICALL data updated, will reflect on next reload (${props.spreadsheetId})`);
        }
      } catch (error) {
        console.error(`❌ Error processing APICALL formulas (${props.spreadsheetId}):`, error);
      }
    };

    const hyperlinkEventListener = (univerAPI, hasUnsavedChanges, commandService) => {

                
          // Setup hyperlink event listeners (v0.9.4 compatible)
          try {
            console.log(`🔗 Setting up hyperlink event listeners for ${props.spreadsheetId}...`);
            
            // Check if hyperlink events are available in this version
            if (univerAPI.Event && univerAPI.Event.BeforeSheetLinkAdd) {
              // Listen for link addition events
              const linkAddDisposable = univerAPI.addEvent(univerAPI.Event.BeforeSheetLinkAdd, (params) => {
                console.log('🔗 Link being added:', params);
                const { workbook, worksheet, row, col, link } = params;
                console.log(`📝 Adding hyperlink at [${row}, ${col}]: ${link}`);
                
                // Force mark as unsaved for hyperlink changes (bypass smart detection)
                hasUnsavedChanges.value = true;
                console.log(`📝 Forced unsaved state for hyperlink addition at [${row}, ${col}]`);
              });
              
              // Listen for link update events (should work in v0.9.4)
              let linkUpdateDisposable = null;
              try {
                if (univerAPI.Event.BeforeSheetLinkUpdate) {
                  linkUpdateDisposable = univerAPI.addEvent(univerAPI.Event.BeforeSheetLinkUpdate, (params) => {
                    console.log('🔗 Link being updated:', params);
                    const { workbook, worksheet, row, column, id, payload } = params;
                    console.log(`📝 Updating hyperlink at [${row}, ${column}] with ID ${id}:`, payload);
                    
                    // Force mark as unsaved for hyperlink changes (bypass smart detection)
                    hasUnsavedChanges.value = true;
                    console.log(`📝 Forced unsaved state for hyperlink update at [${row}, ${column}]`);
                  });
                }
              } catch (updateError) {
                console.log('ℹ️ Link update events not available in this version');
              }
              
              // Listen for link deletion events (should work in v0.9.4)
              let linkDeleteDisposable = null;
              try {
                if (univerAPI.Event.BeforeSheetLinkCancel) {
                  linkDeleteDisposable = univerAPI.addEvent(univerAPI.Event.BeforeSheetLinkCancel, (params) => {
                    console.log('🔗 Link being deleted:', params);
                    const { workbook, worksheet, row, column, id } = params;
                    console.log(`🗑️ Deleting hyperlink at [${row}, ${column}] with ID ${id}`);
                    
                    // Force mark as unsaved for hyperlink changes (bypass smart detection)
                    hasUnsavedChanges.value = true;
                    console.log(`📝 Forced unsaved state for hyperlink deletion at [${row}, ${column}]`);
                  });
                }
              } catch (deleteError) {
                console.log('ℹ️ Link deletion events not available in this version');
              }
              
              // Store disposables for cleanup
              if (!window.hyperlinkDisposables) window.hyperlinkDisposables = new Map();
              window.hyperlinkDisposables.set(props.spreadsheetId, {
                linkAdd: linkAddDisposable,
                linkUpdate: linkUpdateDisposable,
                linkDelete: linkDeleteDisposable
              });
              
              console.log(`✅ Hyperlink event listeners set up successfully for ${props.spreadsheetId}`);
            } else {
              console.log(`ℹ️ Hyperlink events not available in this version, using fallback detection`);
              
              // Fallback: Monitor for hyperlink-related commands
              if (commandService) {
                const originalExecuteCommand = commandService.executeCommand;
                commandService.executeCommand = function(...args) {
                  const commandId = args[0];
                  const result = originalExecuteCommand.apply(this, args);
                  
                  // Detect hyperlink-related commands
                  if (commandId && typeof commandId === 'string' && 
                      (commandId.includes('hyperlink') || commandId.includes('link'))) {
                    console.log(`🔗 Hyperlink command detected: ${commandId}`);
                    // Force mark as unsaved for hyperlink changes (bypass smart detection)
                    hasUnsavedChanges.value = true;
                    console.log(`📝 Forced unsaved state for hyperlink command: ${commandId}`);
                  }
                  
                  return result;
                };
              }
            }
            
          } catch (hyperlinkError) {
            console.warn(`⚠️ Failed to set up hyperlink event listeners for ${props.spreadsheetId}:`, hyperlinkError);
            console.log(`ℹ️ Hyperlink functionality will still work, but without event tracking`);
          }

    }

    const fnChangeDetectionListener = (univerAPI, commandService) => {


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
              
              // Handle cell clicks for TASKSTATUS navigation
              const isCellClick = 
                command.id.includes('sheet.operation.set-active-cell') ||
                command.id.includes('set-active-cell') ||
                command.id.includes('SetActiveCell') ||
                command.id.includes('SelectCell') ||
                command.id.includes('sheet.command.set-selection') ||
                command.id.includes('sheet.operation.set-selections') ||
                command.id.includes('sheet.mutation.set-selections') ||
                command.id.includes('set-selections') ||
                command.id.includes('SetSelections');

              if (isCellClick) {
                console.log(`🖱️ Cell click detected for command: ${command.id}`);
                console.log(`🖱️ Command params:`, command.params);
                
                // Extract cell coordinates for click detection
                const extractCellCoordinates = (commandParams) => {
                  try {
                    console.log(`🧮 Extracting coordinates from click:`, commandParams);
                    
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
                    
                    console.log(`⚠️ Could not extract coordinates for click`);
                    return null;
                  } catch (error) {
                    console.warn(`⚠️ Error extracting coordinates for click:`, error);
                    return null;
                  }
                };

                const clickCoords = extractCellCoordinates(command.params);
                if (clickCoords) {
                  const { row, col } = clickCoords;
                  console.log(`🖱️ Cell clicked at: [${row}, ${col}]`);
                  
                  // Check if this cell contains a TASKSTATUS formula
                  const currentData = getCurrentSpreadsheetData();
                  if (currentData?.sheets) {
                    for (const sheetId of Object.keys(currentData.sheets)) {
                      const sheet = currentData.sheets[sheetId];
                      if (sheet.cellData?.[row]?.[col]) {
                        const cell = sheet.cellData[row][col];
                        console.log(`🔍 Cell data at [${row}, ${col}]:`, {
                          formula: cell.f,
                          value: cell.v,
                          taskStatusData: cell.taskStatusData,
                          fullCell: cell
                        });
                        
                        // Check if cell has TASKSTATUS formula OR stored task data
                        let taskId = null;
                        let formula = null;
                        
                        // Method 1: Check if formula still exists
                        if (cell.f && typeof cell.f === 'string') {
                          formula = cell.f.trim();
                          const taskStatusMatch = formula.match(/^=TASKSTATUS\((\d+)\)$/i);
                          if (taskStatusMatch) {
                            taskId = parseInt(taskStatusMatch[1], 10);
                          }
                        }
                        
                        // Method 2: Check if we stored task data when processing the formula
                        if (!taskId && cell.taskStatusData) {
                          taskId = cell.taskStatusData.taskId;
                          formula = cell.taskStatusData.originalFormula;
                        }
                        
                        if (taskId && !isNaN(taskId)) {
                          console.log(`🔗 TASKSTATUS cell clicked: ${formula || 'stored data'}, task ${taskId}`);
                          
                          // Check if assignee info is available and show it
                          const assigneeInfo = cell.taskStatusData?.assigneeInfo;
                          if (assigneeInfo) {
                            console.log(`👤 Showing assignee details for task ${taskId}:`, assigneeInfo);
                            
                            // Show assignee popup with avatar
                            if (assigneeInfo.avatarUrl) {
                              ElNotification({
                                title: `Task ${taskId} - ${cell.taskStatusData.status}`,
                                message: `
                                  <div style="display: flex; align-items: center; gap: 12px;">
                                    <img src="${assigneeInfo.avatarUrl}" 
                                         style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; border: 2px solid #e0e0e0;" 
                                         onerror="this.style.display='none'" />
                                    <div>
                                      <div style="font-weight: bold; font-size: 14px; margin-bottom: 4px;">👤 ${assigneeInfo.name}</div>
                                      <div style="color: #666; font-size: 12px;">${assigneeInfo.email}</div>
                                      <div style="color: #999; font-size: 11px; margin-top: 2px;">Assigned to this task</div>
                                    </div>
                                  </div>
                                `,
                                dangerouslyUseHTMLString: true,
                                duration: 5000,
                                position: 'top-right',
                                type: 'info'
                              });
                            } else {
                              ElNotification({
                                title: `Task ${taskId} - ${cell.taskStatusData.status}`,
                                message: `👤 ${assigneeInfo.name}\n📧 ${assigneeInfo.email}\n📋 Assigned to this task`,
                                duration: 4000,
                                position: 'top-right',
                                type: 'info'
                              });
                            }
                            
                            // Don't navigate immediately, let user see the popup first
                            setTimeout(() => {
                              const workspaceId = workspaceStore.currentWorkspace?.id;
                              if (workspaceId) {
                                const taskUrl = `/single-workspace/${workspaceId}/tasks/${taskId}`;
                                console.log(`🔗 Navigating to: ${taskUrl}`);
                                router.push(taskUrl);
                              }
                            }, 2000); // Wait 2 seconds to let user see assignee details
                            
                          } else {
                            // No assignee info, just navigate to task
                            console.log(`📝 Task ${taskId} has no assignee, navigating directly`);
                            
                            try {
                              const workspaceId = workspaceStore.currentWorkspace?.id;
                              if (workspaceId) {
                                const taskUrl = `/single-workspace/${workspaceId}/tasks/${taskId}`;
                                console.log(`🔗 Navigating to: ${taskUrl}`);
                                router.push(taskUrl);
                                //ElMessage.success(`Opening task ${taskId}`);
                              } else {
                                console.warn('⚠️ No current workspace available for navigation');
                                ElMessage.warning('Cannot navigate: No workspace selected');
                              }
                            } catch (navError) {
                              console.error('❌ Error navigating to task:', navError);
                              ElMessage.error(`Failed to open task ${taskId}`);
                            }
                          }
                        }
                      }
                    }
                  }
                }
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
                /*
                //  depricated code for currency conversion due to univer API formatting cells in json format

                // Currency conversion for cell values
                if (command.params && command.params.value) {
                  const originalValue = command.params.value;
                  const numericValue = parseCurrencyValue(originalValue);
                  
                  // If the value was a currency string and got converted to a number
                  if (typeof originalValue === 'string' && originalValue !== String(numericValue) && numericValue !== 0) {
                    console.log(`💰 Converting currency: "${originalValue}" → ${numericValue}`);
                    command.params.value = numericValue;
                  }
                }
                
                // Also check ranges if present
                if (command.params && command.params.ranges) {
                  command.params.ranges.forEach(range => {
                    if (range.value) {
                      const originalValue = range.value;
                      const numericValue = parseCurrencyValue(originalValue);
                      
                      if (typeof originalValue === 'string' && originalValue !== String(numericValue) && numericValue !== 0) {
                        console.log(`💰 Converting currency in range: "${originalValue}" → ${numericValue}`);
                        range.value = numericValue;
                      }
                    }
                  });
                }
                */
                
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
    }

    // Helper functions for CSV parsing
    const readFileAsText = (file) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target?.result);
        reader.onerror = (error) => reject(error);
        reader.readAsText(file);
      });
    };

    const parseCSV = (csvContent) => {
      const lines = csvContent.split('\n');
      const result = [];
      
      for (const line of lines) {
        // Skip empty lines
        if (line.trim() === '') continue;
        
        // Simple CSV parsing (handles basic cases)
        const row = parseCSVLine(line.trim());
        result.push(row);
      }
      
      return result;
    };

    const parseCSVLine = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      
      // Don't forget the last field
      result.push(current.trim());
      
      return result;
    };

          // Helper function to export current spreadsheet data to CSV
      const exportToCSV = () => {
        try {
          console.log('📤 Starting CSV export...');
          
          // Get current workbook data
          const currentData = getCurrentSpreadsheetData();
          
          if (!currentData || !currentData.sheets) {
            console.warn('⚠️ No spreadsheet data to export');
            alert('No data to export. Please add content to the spreadsheet first.');
            return;
          }
          
          // Get the active sheet
          const activeSheet = univerAPI.getActiveWorkbook().getActiveSheet();
          const activeSheetId = activeSheet.getSheetId();
          const sheetData = currentData.sheets[activeSheetId];
          
          if (!sheetData || !sheetData.cellData) {
            console.warn('⚠️ No data in active sheet to export');
            alert('No data in the current sheet to export.');
            return;
          }
          
          console.log('📊 Converting sheet data to CSV format...');
          
          // Convert sheet data to CSV format
          const csvContent = convertSheetDataToCSV(sheetData.cellData);
          
          // Create and download CSV file
          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          const link = document.createElement('a');
          const url = URL.createObjectURL(blob);
          
          link.setAttribute('href', url);
          link.setAttribute('download', `${props.spreadsheetName || 'spreadsheet'}.csv`);
          link.style.visibility = 'hidden';
          
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          console.log('✅ CSV export completed successfully');
          alert(`CSV file "${props.spreadsheetName || 'spreadsheet'}.csv" has been downloaded!`);
          
        } catch (error) {
          console.error('❌ Error exporting to CSV:', error);
          alert(`Failed to export CSV: ${error.message}`);
        }
      };

      // Helper function to convert sheet cell data to CSV format
      const convertSheetDataToCSV = (cellData) => {
        const csvRows = [];
        const maxRow = Math.max(...Object.keys(cellData).map(Number));
        let maxCol = 0;
        
        // Find the maximum column across all rows
        Object.keys(cellData).forEach(rowIndex => {
          const row = cellData[rowIndex];
          if (row) {
            const colNumbers = Object.keys(row).map(Number);
            maxCol = Math.max(maxCol, ...colNumbers);
          }
        });
        
        // Convert each row to CSV format
        for (let rowIndex = 0; rowIndex <= maxRow; rowIndex++) {
          const row = cellData[rowIndex] || {};
          const csvCells = [];
          
          for (let colIndex = 0; colIndex <= maxCol; colIndex++) {
            const cell = row[colIndex];
            let cellValue = '';
            
            if (cell && cell.v !== undefined && cell.v !== null) {
              cellValue = String(cell.v);
              
              // Escape quotes and wrap in quotes if necessary
              if (cellValue.includes(',') || cellValue.includes('"') || cellValue.includes('\n')) {
                cellValue = '"' + cellValue.replace(/"/g, '""') + '"';
              }
            }
            
            csvCells.push(cellValue);
          }
          
          csvRows.push(csvCells.join(','));
        }
        
        return csvRows.join('\n');
      };

      const fnRegisterCustomCommands = (commandService, CommandType, menuManagerService, componentManager, RibbonStartGroup, ContextMenuPosition, ContextMenuGroup, MenuItemType, saveFunction, emitFunction) => {



          // Define CSV export command
          const CSV_EXPORT_OPERATION = {
            id: 'custom-menu.operation.csv-export',
            type: CommandType.OPERATION,
            handler: async () => {
              console.log('🔽 CSV Export command triggered');
              exportToCSV();
              return true;
            },
          };

          // Define CSV import command
          const CSV_IMPORT_OPERATION = {
            id: 'custom-menu.operation.csv-import',
            type: CommandType.OPERATION,
            handler: async () => {
              console.log('🔄 CSV Import operation started');
              
              try {
                // Create file input element
                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.accept = '.csv';
                fileInput.style.display = 'none';
                
                // Add to DOM temporarily
                document.body.appendChild(fileInput);
                
                // Wait for user to select file
                const file = await new Promise((resolve) => {
                  fileInput.onchange = (event) => {
                    const target = event.target;
                    const selectedFile = target.files?.[0] || null;
                    resolve(selectedFile);
                    document.body.removeChild(fileInput);
                  };
                  
                  fileInput.oncancel = () => {
                    resolve(null);
                    document.body.removeChild(fileInput);
                  };
                  
                  fileInput.click();
                });
                
                if (!file) {
                  console.log('📝 CSV import cancelled by user');
                  return false;
                }
                
                console.log('📁 Selected file:', file.name);
                
                // Read and parse CSV file
                const csvContent = await readFileAsText(file);
                const csvData = parseCSV(csvContent);
                
                if (csvData.length === 0) {
                  console.warn('⚠️ CSV file is empty or invalid');
                  alert('The selected CSV file is empty or invalid.');
                  return false;
                }
                
                console.log('📊 Parsed CSV data:', csvData.length, 'rows');
                
                // Get current selection from univerAPI
                const activeSheet = univerAPI.getActiveWorkbook().getActiveSheet();
                const selection = activeSheet.getSelection().getActiveRange();
                
                const startRow = selection?.startRow ?? 0;
                const startCol = selection?.startColumn ?? 0;
                
                console.log(`📍 Importing CSV data starting at row ${startRow}, column ${startCol}`);
                
                // Convert CSV data to cell values and set to worksheet
                const cellValues = [];
                
                csvData.forEach((row, rowIndex) => {
                  const rowData = [];
                  row.forEach((cellValue, colIndex) => {
                    // Detect if it's a number or string
                    const cleanValue = cellValue.replace(/^["']|["']$/g, '');
                    if (!isNaN(Number(cleanValue)) && cleanValue.trim() !== '') {
                      rowData.push(Number(cleanValue));
                    } else {
                      rowData.push(cleanValue);
                    }
                  });
                  cellValues.push(rowData);
                });
                
                // Set the values using univerAPI
                const range = activeSheet.getRange(startRow, startCol, csvData.length, csvData[0].length);
                range.setValues(cellValues);
                
                console.log('✅ CSV data imported successfully');
                alert(`CSV file "${file.name}" imported successfully! ${csvData.length} rows imported.`);
                
                // Trigger save after import
                setTimeout(() => {
                  saveFunction();
                }, 500);
                
                return true;
                
              } catch (error) {
                console.error('❌ Error importing CSV:', error);
                alert('Error importing CSV file. Please check the console for details.');
                return false;
              }
            },
          };

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


          const HISTORY_OPERATION = {
            id: 'custom-menu.operation.history',
            type: CommandType.OPERATION,
            handler: async () => {
              // History functionality
              console.log('📚 History operation triggered from dropdown menu');
              try {
                await showHistory();
                console.log('✅ History operation completed successfully');
              } catch (error) {
                console.error('❌ History operation failed:', error);
              }
              return true;
            },
          };
          
          
          const CUSTOM_MENU_DROPDOWN_LIST_OPERATION_ID = 'custom-menu.operation.dropdown-list';
          
          // Register commands
          commandService.registerCommand(CSV_EXPORT_OPERATION);
          commandService.registerCommand(CSV_IMPORT_OPERATION);
          commandService.registerCommand(DROPDOWN_FIRST_ITEM_OPERATION);
          commandService.registerCommand(DROPDOWN_SECOND_ITEM_OPERATION);
          commandService.registerCommand(CONTEXT_MENU_EDIT_INFO_OPERATION);
          commandService.registerCommand(HISTORY_OPERATION);
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


          const HistoryIcon = () => {
            const React = window.React || window['React'];
            if (!React) {
              return null;
            }
            return React.createElement('svg', {
              width: 16, height: 16, viewBox: '0 0 24 24', fill: 'currentColor'
            }, React.createElement('path', {
              d: 'M13 3C8.03 3 4 7.03 4 12s4.03 9 9 9s9-4.03 9-9c0-.46-.04-.92-.1-1.36c-.98 1.37-2.58 2.26-4.4 2.26c-2.98 0-5.4-2.42-5.4-5.4c0-1.81.89-3.42 2.26-4.4C13.92 3.04 13.46 3 13 3z'
            }));
          };

          const ImportCsvIcon = () => {
            const React = window.React || window['React'];
            if (!React) {
              return null;
            }
            return React.createElement('svg', {
              width: 16, height: 16, viewBox: '0 0 24 24', fill: 'currentColor'
            }, React.createElement('path', {
              d: 'M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3M19 19H5V5H19V19M7 7H9V9H7V7M11 7H13V9H11V7M15 7H17V9H15V7M7 11H9V13H7V11M11 11H13V13H11V11M15 11H17V13H15V11M7 15H9V17H7V15M11 15H13V17H11V15M15 15H17V17H15V15Z'
            }));
          };

          const ExportCsvIcon = () => {
            const React = window.React || window['React'];
            if (!React) {
              return null;
            }
            return React.createElement('svg', {
              width: 16, height: 16, viewBox: '0 0 24 24', fill: 'currentColor'
            }, React.createElement('path', {
              d: 'M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z'
            }), React.createElement('path', {
              d: 'M12,16L16,12H13V8H11V12H8L12,16Z'
            }));
          };
          
          componentManager.register('ExportCsvIcon', ExportCsvIcon);
          componentManager.register('ImportCsvIcon', ImportCsvIcon);
          componentManager.register('SaveIcon', SaveIcon);
          componentManager.register('DeleteIcon', DeleteIcon);
          componentManager.register('MainButtonIcon', MainButtonIcon);
          componentManager.register('EditInfoIcon', EditInfoIcon);
          componentManager.register('HistoryIcon', HistoryIcon);
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
                [HISTORY_OPERATION.id]: {
                  order: 2,
                  menuItemFactory: () => ({
                    id: HISTORY_OPERATION.id,
                    type: MenuItemType.BUTTON,
                    icon: 'HistoryIcon',
                    title: 'History',
                    tooltip: 'View spreadsheet history'
                  }),
                },
                [CSV_IMPORT_OPERATION.id]: {
                  order: 3,
                  menuItemFactory: () => ({
                    id: CSV_IMPORT_OPERATION.id,
                    type: MenuItemType.BUTTON,
                    icon: 'ImportCsvIcon',
                    title: 'Import CSV',
                    tooltip: 'Import data from a CSV file into the current spreadsheet',
                  }),
                },
                [CSV_EXPORT_OPERATION.id]: {
                  order: 4,
                  menuItemFactory: () => ({
                    id: CSV_EXPORT_OPERATION.id,
                    type: MenuItemType.BUTTON,
                    icon: 'ExportCsvIcon',
                    title: 'Export CSV',
                    tooltip: 'Export current spreadsheet data to a CSV file',
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
                    title: 'View Edit info',
                    tooltip: 'This is an example context menu item'
                  }),
                },
              },
            },
          });
          
          console.log('✅ Custom menu items registered');
          console.log(`🎯 Custom dropdown menu should now appear in Univer toolbar for ${props.spreadsheetId}!`);
          console.log(`🎯 Edit info context menu item should now appear when right-clicking on cells for ${props.spreadsheetId}!`);

    }

    const fnSmartChangeDetectionListener = (univerAPI, commandService) => {
    

          
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
    }

    const fnCheckHashAfterUniverInit = (hasUnsavedChanges) => {
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
          
          // Set up beforeunload event to catch browser tab close/reload
          const handleBeforeUnload = (event) => {
            if (hasUnsavedChanges.value) {

              // Show warning to user (browser will show standard message)
              const message = 'You have unsaved changes that will be lost if you leave this page.';
              event.returnValue = message; // For Chrome
              return message; // For other browsers
            }
          };
          
          window.addEventListener('beforeunload', handleBeforeUnload);
          
          // Store the event handler for cleanup
          if (!window.spreadsheetBeforeUnloadHandlers) {
            window.spreadsheetBeforeUnloadHandlers = new Map();
          }
          window.spreadsheetBeforeUnloadHandlers.set(props.spreadsheetId, handleBeforeUnload);
          
        }, 5000); // Wait 5 seconds to ensure all initialization commands are processed

    }

    const fnCellEditAndApiCallListener = (readonlyState, univerAPI) => {

        // Add readonly event listener if needed
        if (readonlyState) {
          editEventListener = univerAPI.addEvent(univerAPI.Event.BeforeSheetEditStart, (params) => {
            params.cancel = true
          })
        } else {
          // Add edit listener for immediate APICALL processing in non-readonly mode
          editEventListener = univerAPI.addEvent(univerAPI.Event.BeforeSheetEditStart, (params) => {
            console.log(`🔍 Sheet edit detected, checking for APICALL formulas:`, params);
            // Process APICALL formulas immediately when user edits
            setTimeout(() => {
              processApiCallFormulas();
            }, 200); // Small delay to let the edit complete
          })
        }
    }

    const fnTrackSheetChangesListener = () => {      
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

    }
    
    // Wrapper function to handle initialization with retry logic
    const initializeUniverWithRetry = async (workbookData = null, forceReadonly = false, retryCount = 0) => {
      const maxRetries = 2;
      
      try {
        await initializeUniver(workbookData, forceReadonly);
      } catch (error) {
        console.error(`❌ Initialization attempt ${retryCount + 1} failed for ${props.spreadsheetId}:`, error);
        
        // If this is a disposal error and we have retries left, try again
        if (retryCount < maxRetries && 
            (error.message?.includes('disposed') || 
             error.message?.includes('Cannot read properties of null'))) {
          console.log(`🔄 Retrying initialization for ${props.spreadsheetId} (attempt ${retryCount + 2}/${maxRetries + 1})`);
          
          // Wait a bit before retrying and check if component is still mounted
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          if (isComponentMounted) {
            return initializeUniverWithRetry(workbookData, forceReadonly, retryCount + 1);
          } else {
            console.log(`⚠️ Component unmounted during retry, aborting for ${props.spreadsheetId}`);
            return;
          }
        }
        
        // If we've exhausted retries or it's a different error, show user-friendly message
        ElMessage.error(`Failed to initialize ${props.spreadsheetName}. Please refresh the page.`);
        throw error;
      }
    };

    const initializeUniver = async (workbookData = null, forceReadonly = false) => {
      try {
        console.log(`🚀 Initializing Univer instance for ${props.spreadsheetName} (${props.spreadsheetId})...`);

        // Determine readonly state - use forceReadonly if provided, otherwise use props.readonly
        const readonlyState = forceReadonly ? true : props.readonly;
        console.log(`📝 Initializing with readonly=${readonlyState} (forceReadonly=${forceReadonly}, props.readonly=${props.readonly})`);

        // Load current user for edit tracking
        console.log(`🚀 Loading user for edit tracking in ${props.spreadsheetId}...`);
        await getCurrentUser();
        console.log(`🚀 User loading complete for ${props.spreadsheetId}:`, currentUser.value ? `✅ ${currentUser.value.email}` : '❌ No user');

        // Store references to functions for menu commands
        const emitFunction = emit;
        const saveFunction = manualSave;

        // Load complete workbook data from Supabase first
        if (!workbookData) {
          workbookData = await loadPortfolioData();
        }
        
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

        await fnCreateUniver(readonlyState);
        
        
        // Formula functionality is now enabled - no blocking needed
        // Apply enhancement after a short delay to ensure univerAPI is ready
        //setTimeout(enhanceFormulaCalculation, 1000);

        // We'll register custom functions after the workbook is created
        console.log(`⏭️ Custom functions will be registered after workbook creation (${props.spreadsheetId})`);

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

          // Check if component is still mounted before proceeding
          if (!isComponentMounted) {
            console.log(`⚠️ Component unmounted during initialization, skipping custom menu for ${props.spreadsheetId}`);
            return;
          }

          // Check if univer instance was created successfully
          if (!univer) {
            console.warn(`⚠️ Univer instance is null, cannot add custom menu for ${props.spreadsheetId}`);
            return;
          }
          
          // Wait for Univer to be fully initialized with mount state checks
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Final mount state check before accessing injector
          if (!isComponentMounted) {
            console.log(`⚠️ Component unmounted before injector access, aborting custom menu for ${props.spreadsheetId}`);
            return;
          }
          
          // Try to get the injector through different methods
          let injector = null;
          
          // Method 1: Try the internal injector property
          if (univer && univer._injector) {
            injector = univer._injector;
            console.log('✅ Got injector from _injector property');
          }
          // Method 2: Try through context
          else if (univer && univer.getContext && univer.getContext().injector) {
            injector = univer.getContext().injector;
            console.log('✅ Got injector from context');
          }
          // Method 3: Try accessing it differently
          else if (univer && univer.__container) {
            injector = univer.__container;
            console.log('✅ Got injector from __container property');
          }
          
          if (!injector) {
            console.warn('⚠️ Could not access injector, custom menu will not be added');
            return;
          }
          
          // Check if injector is disposed before using it
          if (injector.disposed || (injector._disposed === true)) {
            console.warn(`⚠️ Injector is already disposed, skipping custom menu for ${props.spreadsheetId}`);
            return;
          }
          
          // Import custom menu dependencies
          const { ICommandService, CommandType } = await import('@univerjs/core');
          const { ComponentManager, IMenuManagerService, RibbonStartGroup, MenuItemType, ContextMenuPosition, ContextMenuGroup } = await import('@univerjs/ui');
          
          // Check mount state one more time before getting services
          if (!isComponentMounted) {
            console.log(`⚠️ Component unmounted before getting services, aborting custom menu for ${props.spreadsheetId}`);
            return;
          }
          
          // Get services with error handling for disposed injector
          let commandService, menuManagerService, componentManager;
          try {
            commandService = injector.get(ICommandService);
            menuManagerService = injector.get(IMenuManagerService);
            componentManager = injector.get(ComponentManager);
          } catch (serviceError) {
            if (serviceError.message && serviceError.message.includes('disposed')) {
              console.warn(`⚠️ Injector was disposed while getting services for ${props.spreadsheetId}, skipping custom menu`);
              return;
            }
            throw serviceError; // Re-throw if it's not a disposal error
          }
          console.log('✅ Got all required services from injector');
          
          fnRegisterCustomCommands(commandService, CommandType, menuManagerService, componentManager, RibbonStartGroup, ContextMenuPosition, ContextMenuGroup, MenuItemType, saveFunction, emitFunction);

          // depricated code for hyperlink event listener due to new univer API 
          // hyperlinkEventListener(univerAPI, hasUnsavedChanges, commandService);

          fnChangeDetectionListener(univerAPI, commandService);

          //  depricated code for smart change detection due to new univer API 
          // fnSmartChangeDetectionListener(univerAPI, commandService);
          
        } catch (error) {
          console.warn(`⚠️ Failed to add custom menu for ${props.spreadsheetId}:`, error);
          console.error('Error details:', error);
        }

        // Create workbook with loaded data and styles
        console.log(`📊 Creating Univer workbook with loaded data and ${Object.keys(WORKBOOK_DATA.styles || {}).length} styles...`);
        
        // Check if component is still mounted and univerAPI is available before creating workbook
        if (!isComponentMounted) {
          console.log(`⚠️ Component unmounted before workbook creation, aborting for ${props.spreadsheetId}`);
          return;
        }
        
        if (!univerAPI) {
          console.error(`❌ UniversAPI is null, cannot create workbook for ${props.spreadsheetId}`);
          throw new Error('UniversAPI is not available');
        }
        
        // Validate WORKBOOK_DATA structure before creating
        if (!WORKBOOK_DATA || typeof WORKBOOK_DATA !== 'object') {
          console.error(`❌ Invalid WORKBOOK_DATA for ${props.spreadsheetId}:`, WORKBOOK_DATA);
          throw new Error('Invalid workbook data structure');
        }
        
        // univer.createUnit(UniverInstanceType.UNIVER_SHEET, WORKBOOK_DATA);
        univerAPI.createWorkbook(WORKBOOK_DATA);

        fnCellEditAndApiCallListener(readonlyState, univerAPI);

        // fnTrackSheetChangesListener();

        console.log(`✅ Univer initialized successfully for ${props.spreadsheetName} (${props.spreadsheetId})!`);

        // check if the hash has changed after univer is initialized
        fnCheckHashAfterUniverInit(hasUnsavedChanges);

        

        
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
        
        // Try to get workbook service with disposal check
        let workbookService = null;
        try {
          // Check if injector is disposed before using it
          if (injector.disposed || (injector._disposed === true)) {
            console.log('⚠️ Injector is disposed, cannot get workbook service');
            return { row: 0, col: 0 };
          }
          
          workbookService = injector.get('IWorkbookService') || injector.get('WorkbookService');
        } catch (serviceError) {
          if (serviceError.message && serviceError.message.includes('disposed')) {
            console.log('⚠️ Injector was disposed while getting workbook service');
            return { row: 0, col: 0 };
          }
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

    // Hyperlink helper functions (v0.9.4 compatible)
    const insertHyperlinkInCell = (row, col, text, url) => {
      try {
        if (!univerAPI) {
          console.warn('UniverAPI not available');
          ElMessage.warning('Spreadsheet not ready. Please wait for initialization to complete.');
          return;
        }
        
        // Wait a bit to ensure Univer is fully loaded
        setTimeout(() => {
          try {
            const fWorkbook = univerAPI.getActiveWorkbook();
            if (!fWorkbook) {
              console.warn('No active workbook');
              ElMessage.warning('No active workbook found');
              return;
            }
            
            const fWorksheet = fWorkbook.getActiveSheet();
            if (!fWorksheet) {
              console.warn('No active worksheet');
              ElMessage.warning('No active worksheet found');
              return;
            }
            
            // Create a hyperlink in the specified cell
            const cellRef = `${String.fromCharCode(65 + col)}${row + 1}`;
            const fRange = fWorksheet.getRange(cellRef);
            
            // v0.9.4 should have full hyperlink support
            if (univerAPI.newRichText && typeof univerAPI.newRichText === 'function') {
              const richText = univerAPI.newRichText().insertLink(text, url);
              fRange.setRichTextValueForCell(richText);
              
              //console.log(`✅ Inserted hyperlink "${text}" -> "${url}" in cell [${row}, ${col}]`);
              //ElMessage.success(`Hyperlink added to cell ${cellRef}`);
              
              // Force mark as unsaved for hyperlink changes (bypass smart detection)
              hasUnsavedChanges.value = true;
              console.log(`📝 Forced unsaved state for hyperlink insertion at [${row}, ${col}]`);
            } else {
              console.error(`❌ newRichText method not available - unexpected for v0.9.4`);
              ElMessage.error(`Hyperlink functionality not available. Please check Univer version compatibility.`);
            }
          } catch (innerError) {
            console.error('❌ Error in delayed hyperlink insertion:', innerError);
            ElMessage.error(`Failed to insert hyperlink: ${innerError.message}`);
          }
        }, 100);
        
      } catch (error) {
        console.error('❌ Error inserting hyperlink:', error);
        ElMessage.error(`Failed to insert hyperlink: ${error.message}`);
      }
    };
    
    const insertHyperlinkInCurrentCell = (text, url) => {
      try {
        const selection = getCurrentCellSelection();
        if (selection) {
          insertHyperlinkInCell(selection.row, selection.col, text, url);
        } else {
          ElMessage.warning('Please select a cell first');
        }
      } catch (error) {
        console.error('❌ Error inserting hyperlink in current cell:', error);
      }
    };
    
    const getHyperlinksInCell = (row, col) => {
      try {
        if (!univerAPI) {
          console.warn('UniverAPI not available');
          return [];
        }
        
        const fWorkbook = univerAPI.getActiveWorkbook();
        if (!fWorkbook) return [];
        
        const fWorksheet = fWorkbook.getActiveSheet();
        if (!fWorksheet) return [];
        
        const cellRef = `${String.fromCharCode(65 + col)}${row + 1}`;
        const fRange = fWorksheet.getRange(cellRef);
        
        const cellValue = fRange.getValue(true);
        if (cellValue && typeof cellValue.getLinks === 'function') {
          const hyperlinks = cellValue.getLinks();
          console.log(`📋 Found ${hyperlinks.length} hyperlinks in cell [${row}, ${col}]:`, hyperlinks);
          return hyperlinks;
        }
        
        console.log(`ℹ️ No hyperlinks found in cell [${row}, ${col}] or getLinks method not available`);
        return [];
      } catch (error) {
        console.error('❌ Error getting hyperlinks:', error);
        return [];
      }
    };
    
    const updateHyperlinkInCell = (row, col, linkId, newUrl) => {
      try {
        if (!univerAPI) {
          console.warn('UniverAPI not available');
          ElMessage.warning('Spreadsheet not ready');
          return;
        }
        
        const fWorkbook = univerAPI.getActiveWorkbook();
        if (!fWorkbook) {
          ElMessage.warning('No active workbook found');
          return;
        }
        
        const fWorksheet = fWorkbook.getActiveSheet();
        if (!fWorksheet) {
          ElMessage.warning('No active worksheet found');
          return;
        }
        
        const cellRef = `${String.fromCharCode(65 + col)}${row + 1}`;
        const fRange = fWorksheet.getRange(cellRef);
        
        const cellValue = fRange.getValue(true);
        if (cellValue && typeof cellValue.updateLink === 'function') {
          const newRichText = cellValue.copy().updateLink(linkId, newUrl);
          fRange.setRichTextValueForCell(newRichText);
          
          console.log(`✅ Updated hyperlink ${linkId} to "${newUrl}" in cell [${row}, ${col}]`);
          ElMessage.success(`Hyperlink updated in cell ${cellRef}`);
          
          // Force mark as unsaved for hyperlink changes (bypass smart detection)
          hasUnsavedChanges.value = true;
          console.log(`📝 Forced unsaved state for hyperlink update at [${row}, ${col}]`);
        } else {
          console.log(`⚠️ updateLink method not available or no cell value found`);
          ElMessage.warning('Could not update hyperlink. Please ensure the cell contains a hyperlink and try using the UI instead.');
        }
      } catch (error) {
        console.error('❌ Error updating hyperlink:', error);
        ElMessage.error(`Failed to update hyperlink: ${error.message}`);
      }
    };
    
    const removeHyperlinkInCell = (row, col, linkId) => {
      try {
        if (!univerAPI) {
          console.warn('UniverAPI not available');
          ElMessage.warning('Spreadsheet not ready');
          return;
        }
        
        const fWorkbook = univerAPI.getActiveWorkbook();
        if (!fWorkbook) {
          ElMessage.warning('No active workbook found');
          return;
        }
        
        const fWorksheet = fWorkbook.getActiveSheet();
        if (!fWorksheet) {
          ElMessage.warning('No active worksheet found');
          return;
        }
        
        const cellRef = `${String.fromCharCode(65 + col)}${row + 1}`;
        const fRange = fWorksheet.getRange(cellRef);
        
        const cellValue = fRange.getValue(true);
        if (cellValue && typeof cellValue.cancelLink === 'function') {
          const newRichText = cellValue.copy().cancelLink(linkId);
          fRange.setRichTextValueForCell(newRichText);
          
          console.log(`✅ Removed hyperlink ${linkId} from cell [${row}, ${col}]`);
          ElMessage.success(`Hyperlink removed from cell ${cellRef}`);
          
          // Force mark as unsaved for hyperlink changes (bypass smart detection)
          hasUnsavedChanges.value = true;
          console.log(`📝 Forced unsaved state for hyperlink removal at [${row}, ${col}]`);
        } else {
          console.log(`⚠️ cancelLink method not available or no cell value found`);
          ElMessage.warning('Could not remove hyperlink. Please ensure the cell contains a hyperlink and try using the UI instead.');
        }
      } catch (error) {
        console.error('❌ Error removing hyperlink:', error);
        ElMessage.error(`Failed to remove hyperlink: ${error.message}`);
      }
    };

    // Expose functions for manual testing and edit info viewing
    defineExpose({
      testEditTracking,
      showCellEditInfo,
      getCellEditInfo,
      insertHyperlinkInCell,
      insertHyperlinkInCurrentCell,
      getHyperlinksInCell,
      updateHyperlinkInCell,
      removeHyperlinkInCell,

    });

    onMounted(() => {
      console.log(`🚀 SpreadsheetInstance mounted for ${props.spreadsheetId}`);
      console.log(`📊 Mount state:`, {
        spreadsheetId: props.spreadsheetId,
        spreadsheetName: props.spreadsheetName,
        workspaceId: currentWorkspaceId.value,
        portfolioId: props.portfolioId,
        isReadonly: props.readonly
      });
      
      // Set up references for global refresh function (after all functions are defined)
      getCurrentSpreadsheetDataRef = getCurrentSpreadsheetData;
      saveCurrentDataRef = savePortfolioData;
      insertHyperlinkInCellRef = insertHyperlinkInCell;
      
      console.log(`🔧 References set up, about to scan for existing cells...`);
      console.log(`🔧 getCurrentSpreadsheetDataRef available:`, !!getCurrentSpreadsheetDataRef);
      
      // Scan for existing TASKSTATUS cells and track them (with delay to ensure spreadsheet is ready)
      setTimeout(() => {
        console.log(`🕐 Running delayed scan for TASKSTATUS cells...`);
        cleanupDuplicateTaskStatusCells(); // First check for duplicates
        scanAndTrackExistingTaskStatusCells(); // Then track them
      }, 2000); // Wait 2 seconds for spreadsheet to initialize
      
      // Set up real-time subscription for task updates
      if (currentWorkspaceId.value) {
        setupTaskUpdateSubscription();
      }
      

      
      // Check if we're loading from URL history parameters
      if (isLoadingFromUrlHistory.value) {
        console.log(`🔄 Loading from URL history: spreadsheetId=${urlSpreadsheetId.value}, historyId=${urlHistoryId.value}`);
        setTimeout(() => {
          loadHistoryFromUrl();
        }, 100);
      } else {
        // Ensure DOM is ready before initialization
        setTimeout(() => {
          initializeUniverWithRetry();
        }, 100);
      }
    });

    onBeforeUnmount(() => {
      // Mark component as unmounted to prevent further injector access
      isComponentMounted = false;
      console.log(`🔒 Component marked as unmounted for ${props.spreadsheetId}`);
      
      // Clean up real-time task update subscription
      if (taskUpdateSubscription) {
        taskUpdateSubscription.unsubscribe();
        console.log(`🧹 Cleaned up task update subscription for ${props.spreadsheetId}`);
      }
      
      // Clean up TASKSTATUS formula processor
      if (window.taskStatusIntervals && window.taskStatusIntervals.has(props.spreadsheetId)) {
        clearInterval(window.taskStatusIntervals.get(props.spreadsheetId));
        window.taskStatusIntervals.delete(props.spreadsheetId);
        console.log(`🧹 Cleaned up TASKSTATUS processor for ${props.spreadsheetId}`);
      }
      
      // Clean up APICALL formula processor
      if (window.apiCallIntervals && window.apiCallIntervals.has(props.spreadsheetId)) {
        clearInterval(window.apiCallIntervals.get(props.spreadsheetId));
        window.apiCallIntervals.delete(props.spreadsheetId);
        console.log(`🧹 Cleaned up APICALL processor for ${props.spreadsheetId}`);
      }
      
      // Clean up hyperlink event listeners
      if (window.hyperlinkDisposables && window.hyperlinkDisposables.has(props.spreadsheetId)) {
        const disposables = window.hyperlinkDisposables.get(props.spreadsheetId);
        try {
          if (disposables.linkAdd && typeof disposables.linkAdd.dispose === 'function') {
            disposables.linkAdd.dispose();
          }
          if (disposables.linkUpdate && typeof disposables.linkUpdate.dispose === 'function') {
            disposables.linkUpdate.dispose();
          }
          if (disposables.linkDelete && typeof disposables.linkDelete.dispose === 'function') {
            disposables.linkDelete.dispose();
          }
          window.hyperlinkDisposables.delete(props.spreadsheetId);
          console.log(`🧹 Cleaned up hyperlink event listeners for ${props.spreadsheetId}`);
        } catch (error) {
          console.warn(`⚠️ Error cleaning up hyperlink listeners for ${props.spreadsheetId}:`, error);
        }
      }
      
      if (univer) {
        try {
          univer.dispose();
          console.log(`📤 Univer disposed successfully (${props.spreadsheetId})`);
        } catch (error) {
          console.warn(`⚠️ Error disposing Univer (${props.spreadsheetId}):`, error);
        }
      }
      
      // Clean up beforeunload event listener
      if (window.spreadsheetBeforeUnloadHandlers && window.spreadsheetBeforeUnloadHandlers.has(props.spreadsheetId)) {
        const handler = window.spreadsheetBeforeUnloadHandlers.get(props.spreadsheetId);
        window.removeEventListener('beforeunload', handler);
        window.spreadsheetBeforeUnloadHandlers.delete(props.spreadsheetId);
        console.log(`🧹 Cleaned up beforeunload handler for ${props.spreadsheetId}`);
      }
      
      // Clean up auto-save interval
      if (window.spreadsheetAutoSaveIntervals && window.spreadsheetAutoSaveIntervals.has(props.spreadsheetId)) {
        const interval = window.spreadsheetAutoSaveIntervals.get(props.spreadsheetId);
        clearInterval(interval);
        window.spreadsheetAutoSaveIntervals.delete(props.spreadsheetId);
        console.log(`🧹 Cleaned up auto-save interval for ${props.spreadsheetId}`);
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

    // Load complete portfolio workbook data from cache or Supabase
    const loadPortfolioData = async () => {
      if (!currentWorkspaceId.value) {
        console.warn(`⚠️ No workspace ID available for loading portfolio data (${props.spreadsheetId})`);
        return {};
      }



      try {
        // Find data with the specific spreadsheet_id AND workspace_id AND portfolio_id for filtering
        let query = supabase
          .from('ai_portfolio_data')
          .select('*')
          .eq('spreadsheet_id', props.spreadsheetId)
          .eq('workspace_id', currentWorkspaceId.value);
        
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
          
          console.log(`📊 Loading portfolio data for workspace ${currentWorkspaceId.value}, spreadsheet ${props.spreadsheetId}`);
          
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
      
      if (!currentWorkspaceId.value) {
        console.warn(`⚠️ No workspace ID available for saving portfolio data (${props.spreadsheetId})`);
        ElMessage.warning(`Cannot save ${props.spreadsheetName}: No workspace selected`);
        return;
      }

      // if (!hasUnsavedChanges.value) {
      //   ElMessage.warning(`No changes to save`);
      //   return;
      // }
      
      try {
        saving.value = true;
        
        const dataToSave = data || portfolioData.value;
        
        // Validate data exists and is not empty
        if (!dataToSave || typeof dataToSave !== 'object' || Object.keys(dataToSave).length === 0) {
          console.warn(`⚠️ No valid data to save for ${props.spreadsheetId}`);
          ElMessage.warning(`No data to save for ${props.spreadsheetName}`);
          return;
        }
        
        console.log(`💾 SAVING TO SUPABASE (${props.spreadsheetId}) for workspace ${currentWorkspaceId.value}:`, {
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
        
        // Get current display_order from the latest record to preserve ordering
        let currentDisplayOrder = 0;
        const { data: latestRecord } = await supabase
          .from('ai_portfolio_data')
          .select('display_order')
          .eq('spreadsheet_id', props.spreadsheetId)
          .eq('portfolio_id', props.portfolioId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (latestRecord && latestRecord.display_order) {
          currentDisplayOrder = latestRecord.display_order;
        }

        // Always create new record for history tracking
        console.log(`📝 Creating new record (${props.spreadsheetId}) for workspace ${currentWorkspaceId.value}...`);
        const { data: newRecord, error } = await supabase
          .from('ai_portfolio_data')
          .insert([{ 
            data: cleanedData,
            name: props.spreadsheetName,
            spreadsheet_id: props.spreadsheetId,
            workspace_id: currentWorkspaceId.value,
            portfolio_id: props.portfolioId,
            display_order: currentDisplayOrder,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }])
          .select()
          .single();

        if (error) {
          console.error(`❌ Supabase insert error (${props.spreadsheetId}):`, error);
          throw error;
        }
        
        console.log(`✅ Successfully created new record with ID (${props.spreadsheetId}) for workspace ${currentWorkspaceId.value}:`, newRecord.id);
        
        // Now fetch the latest record from Supabase by created_at date
        console.log(`🔄 Fetching latest record from Supabase after save...`);
        const latestData = await fetchLatestRecordFromSupabase();
        
        if (latestData) {
          portfolioData.value = latestData;
          portfolioId.value = newRecord.id;
          console.log(`✅ Updated local data with latest record from Supabase`);
        } else {
          // Fallback to the data we just saved
          portfolioData.value = cleanedData;
          portfolioId.value = newRecord.id;
          console.log(`⚠️ Could not fetch latest record, using saved data as fallback`);
        }

        lastSaved.value = new Date().toLocaleTimeString();
        
        const sheetCount = cleanedData.sheets ? Object.keys(cleanedData.sheets).length : 0;
        const styleCount = cleanedData.styles ? Object.keys(cleanedData.styles).length : 0;
        
        console.log(`✅ Save operation completed successfully (${props.spreadsheetId}) for workspace ${currentWorkspaceId.value}:`, {
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


    // Helper function to fetch the latest record from Supabase
    const fetchLatestRecordFromSupabase = async () => {
      if (!currentWorkspaceId.value) {
        console.warn(`⚠️ No workspace ID available for fetching latest record (${props.spreadsheetId})`);
        return null;
      }

      try {
        console.log(`📊 Fetching latest record from Supabase for ${props.spreadsheetId}...`);
        
        // Build query to get the latest record
        let query = supabase
          .from('ai_portfolio_data')
          .select('*')
          .eq('spreadsheet_id', props.spreadsheetId)
          .eq('workspace_id', currentWorkspaceId.value);
        
        // Add portfolio_id filter if provided
        if (props.portfolioId) {
          query = query.eq('portfolio_id', props.portfolioId);
        }
        
        const { data, error } = await query
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) {
          console.error(`❌ Error fetching latest record:`, error);
          return null;
        }

        if (data && data.length > 0) {
          const latestRecord = data[0];
          console.log(`📅 Fetched latest record from: ${new Date(latestRecord.created_at).toLocaleString()}`);
          
          const loadedData = latestRecord.data || {};
          
          // Check if this is a complete Univer workbook format or legacy format
          if (loadedData.id && loadedData.sheets && loadedData.sheetOrder) {
            // This is a complete Univer workbook format with all features
            console.log(`📊 Fetched complete Univer workbook with formatting and features (${props.spreadsheetId})`);
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
            return workbookData;
          }
        } else {
          console.log(`ℹ️ No records found in Supabase for ${props.spreadsheetId}`);
          return null;
        }
      } catch (error) {
        console.error(`❌ Error fetching latest record from Supabase (${props.spreadsheetId}):`, error);
        return null;
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
        if (!isComponentMounted || !univer || !univer.__getInjector) return;
        
        const injector = univer.__getInjector();
        
        // Check if injector is disposed before using it
        if (!injector || injector.disposed || (injector._disposed === true)) {
          console.log('⚠️ Injector is disposed in updateRowCount, skipping');
          return;
        }
        
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
          if (!isComponentMounted || !univer || !univer.__getInjector) {
            throw new Error('Univer instance not available');
          }
          const injector = univer.__getInjector();
          
          // Check if injector is disposed before using it
          if (!injector || injector.disposed || (injector._disposed === true)) {
            throw new Error('Injector is disposed');
          }
          
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
                        const rowData = manualData.sheets['sheet-01'].cellData[row];
                        return total + (rowData && typeof rowData === 'object' ? Object.keys(rowData).length : 0);
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
          if (WORKBOOK_DATA && Object.keys(WORKBOOK_DATA).length > 0) {
            /*console.log(`📊 Returning WORKBOOK_DATA for ${props.spreadsheetId}:`, {
              hasSheets: !!(WORKBOOK_DATA.sheets),
              sheetsCount: WORKBOOK_DATA.sheets ? Object.keys(WORKBOOK_DATA.sheets).length : 0
            });*/
            return WORKBOOK_DATA;
          }
        } catch (error) {
          console.warn(`Error getting workbook data (${props.spreadsheetId}):`, error);
        }
        
        console.log(`⚠️ All extraction methods failed, falling back to stored data (${props.spreadsheetId})`);
        const fallbackData = portfolioData.value || {};
        console.log(`📊 Fallback data for ${props.spreadsheetId}:`, {
          hasData: !!fallbackData,
          dataKeys: Object.keys(fallbackData),
          hasSheets: !!(fallbackData.sheets),
          sheetsCount: fallbackData.sheets ? Object.keys(fallbackData.sheets).length : 0
        });
        return fallbackData;
        
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
                const rowData = sheet.cellData[row];
                if (!rowData || typeof rowData !== 'object') return;
                Object.keys(rowData).forEach(col => {
                  const cell = rowData[col];
                if (cell) {
                  // Include cell value
                  if (cell.v !== undefined) {
                    hash += `${sheetId}-${row}-${col}-v:${cell.v}|`;
                  }
                  // Include rich text data for hyperlinks
                  if (cell.p !== undefined) {
                    hash += `${sheetId}-${row}-${col}-p:${JSON.stringify(cell.p)}|`;
                  }
                  // Include style data
                  if (cell.s !== undefined) {
                    hash += `${sheetId}-${row}-${col}-s:${JSON.stringify(cell.s)}|`;
                  }
                  // Include formula data
                  if (cell.f !== undefined) {
                    hash += `${sheetId}-${row}-${col}-f:${cell.f}|`;
                  }
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

    // Unsaved changes tracking - now with smart detection and local cache
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


        // get current user
        await getCurrentUser(); // this is a promise

        if (currentUser.value) {
          // Add simple edit metadata
          currentData.created_by = currentUser.value.email;
          currentData.created_by_id = currentUser.value.id;
        }

        
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
                const rowData = sheet.cellData[row];
                if (rowData && typeof rowData === 'object') {
                  totalCells += Object.keys(rowData).length;
                }
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


    // History functionality
    const historyData = ref([]);
    const showHistoryModal = ref(false);
    const loadingHistory = ref(false);
    const isViewingHistory = ref(false);

    // Fetch spreadsheet history
    const fetchSpreadsheetHistory = async () => {
      if (!currentWorkspaceId.value) {
        console.warn(`⚠️ No workspace ID available for fetching history (${props.spreadsheetId})`);
        ElMessage.warning(`Cannot fetch history: No workspace selected`);
        return;
      }

      try {
        loadingHistory.value = true;
        console.log(`📚 Fetching history for spreadsheet ${props.spreadsheetId}...`);

        // Build query to get all records for this spreadsheet
        let query = supabase
          .from('ai_portfolio_data')
          .select('*')
          .eq('spreadsheet_id', props.spreadsheetId)
          .eq('workspace_id', currentWorkspaceId.value);
        
        // Add portfolio_id filter if provided
        if (props.portfolioId) {
          query = query.eq('portfolio_id', props.portfolioId);
        }
        
        const { data, error } = await query
          .order('created_at', { ascending: false });

        if (error) throw error;

        if (data && data.length > 0) {
          // Format history data with user-friendly dates and additional info
          historyData.value = data.map(record => {
            // Try to get user info from created_by if available
            let userDisplay = 'Unknown User';
            if (record.data.created_by) {
              // If created_by is an email, extract the username part
              if (record.data.created_by.includes('@')) {
                userDisplay = record.data.created_by.split('@')[0];
              } else {
                userDisplay = record.data.created_by;
              }
            }
            
            return {
              id: record.id,
              name: record.name || props.spreadsheetName,
              created_at: record.created_at,
              created_by: record.created_by,
              userDisplay: userDisplay,
              data: record.data,
              spreadsheetId: record.spreadsheet_id,
              formattedDate:  getFormattedDate(record.created_at),
              relativeDate: getRelativeTimeString(record.created_at)
            };
          });
          
          console.log(`✅ Fetched ${historyData.value.length} history records for ${props.spreadsheetId}`);
        } else {
          historyData.value = [];
          console.log(`ℹ️ No history found for ${props.spreadsheetId}`);
        }
      } catch (error) {
        console.error(`❌ Error fetching history (${props.spreadsheetId}):`, error);
        ElMessage.error(`Failed to fetch history: ${error.message || 'Unknown error'}`);
      } finally {
        loadingHistory.value = false;
      }
    };

    const getFormattedDate = (dateString) => {
      const date = new Date(dateString+'Z');

      const formatted = new Intl.DateTimeFormat('en-US', {
          month: 'short',    // "Jan"
          day: 'numeric',    // "21"
          year: 'numeric',   // "2025"
          hour: 'numeric',   // "8"
          minute: '2-digit', // "12"
          hour12: true       // "AM/PM"
        }).format(date);
      return formatted.replace(',', ''); 
    }

    // Helper function to get relative time string
    const getRelativeTimeString = (dateString) => {
      const date = new Date(dateString+'Z');
      const now = new Date();
      // get current utc date
      //const utcNow = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds());  

      const diffInSeconds = Math.floor((now - date) / 1000);
      
      if (diffInSeconds < 60) return 'Just now';
      if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
      if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
      if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
      return date.toLocaleDateString();
    };

    // Show history modal
    const showHistory = async () => {
      console.log(`📚 Showing history for ${props.spreadsheetId}...`);
      showHistoryModal.value = true;
      await fetchSpreadsheetHistory();
    };

    // Load history data from URL parameters
    const loadHistoryFromUrl = async () => {
      try {
        console.log(`🔄 Loading history from URL: historyId=${urlHistoryId.value}, spreadsheetId=${urlSpreadsheetId.value}`);
        
        if (!urlHistoryId.value || !urlSpreadsheetId.value) {
          console.warn('⚠️ Missing URL parameters for history loading');
          ElMessage.error('Invalid history URL parameters');
          return;
        }

        // Fetch the specific history record
        const { data, error } = await supabase
          .from('ai_portfolio_data')
          .select('*')
          .eq('id', urlHistoryId.value)
          .eq('spreadsheet_id', urlSpreadsheetId.value)
          .eq('workspace_id', currentWorkspaceId.value)
          .single();

        if (error) {
          console.error('❌ Error fetching history record:', error);
          ElMessage.error('Failed to load history record');
          return;
        }

        if (!data) {
          console.warn('⚠️ No history record found');
          ElMessage.error('History record not found');
          return;
        }

        // Set readonly mode for history loading
        isReadonly.value = true;
        isViewingHistory.value = true;
        
        const workbookData = data.data;
        const cleanedHistoryData = cleanDataForSerialization(workbookData);
        
        // Initialize Univer with history data in readonly mode
        await initializeUniverWithRetry(cleanedHistoryData, true);
        
        // Mark as saved since we loaded from history
        markAsSaved();
        
        console.log(`✅ History data loaded successfully from URL in readonly mode`);
        ElMessage.success(`Loaded spreadsheet from history (Read-only mode)`);
        
      } catch (error) {
        console.error(`❌ Error loading history from URL:`, error);
        ElMessage.error(`Failed to load history data: ${error.message || 'Unknown error'}`);
        // Reset readonly mode on error
        isReadonly.value = false;
        isViewingHistory.value = false;
      }
    };

        const loadHistoryData = async (historyRecord) => {
      try {
        console.log(`🔄 Loading history data for record ${historyRecord.id} in readonly mode...`);
        // console.log('🔄 Loading history data for record:', historyRecord);
        // Set readonly mode for history loading
        isReadonly.value = true;
        isViewingHistory.value = true;
        
        const workbookData = historyRecord.data;
        const cleanedHistoryData = cleanDataForSerialization(workbookData);
        
        // Pass readonly=true to initializeUniver for history loading
        await initializeUniverWithRetry(cleanedHistoryData, true);

        // Update URL to reflect the history state
        const historyUrl = `/single-workspace/${currentWorkspaceId.value}/ai_portfolio/${props.portfolioId}/spreadsheet/${historyRecord.spreadsheetId}/history/${historyRecord.id}`;
        await router.push(historyUrl);

        // Close history modal
        showHistoryModal.value = false;
        
        // Mark as saved since we loaded from history
        markAsSaved();
        
        console.log(`✅ History data loaded successfully from ${historyRecord.formattedDate} in readonly mode`);
        ElMessage.success(`Loaded spreadsheet from ${historyRecord.formattedDate} (Read-only mode)`);
        
      } catch (error) {
        console.error(`❌ Error loading history data:`, error);
        ElMessage.error(`Failed to load history data: ${error.message || 'Unknown error'}`);
        // Reset readonly mode on error
        isReadonly.value = false;
        isViewingHistory.value = false;
      }
    }

    // Close history view and load current spreadsheet from profile
    const closeHistoryView = async () => {
      try {
        console.log(`🔄 Closing history view and loading current spreadsheet...`);
        
        // Reset readonly mode
        isReadonly.value = false;
        isViewingHistory.value = false;
        
        // Load the current spreadsheet data from profile (latest record)
        const currentWorkbookData = await loadPortfolioData();
        const cleanedCurrentData = cleanDataForSerialization(currentWorkbookData);
        
        // Initialize with current data in normal mode (not readonly)
        await initializeUniver(cleanedCurrentData, false);
        
        // Update URL to remove history parameters
        const currentUrl = `/single-workspace/${currentWorkspaceId.value}/ai_portfolio`;
        await router.push(currentUrl);
        
        console.log(`✅ Successfully closed history view and loaded current spreadsheet`);
        ElMessage.success(`Switched back to current spreadsheet`);
        
      } catch (error) {
        console.error(`❌ Error closing history view:`, error);
        ElMessage.error(`Failed to load current spreadsheet: ${error.message || 'Unknown error'}`);
        // Reset states on error
        isReadonly.value = false;
        isViewingHistory.value = false;
      }
    }

</script>

<style scoped>
.spreadsheet-instance-wrapper {
  width: 100%;
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


/* History Modal Styles */
.history-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(4px);
}

.history-modal {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.history-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.history-modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.history-modal-close {
  background: none;
  border: none;
  font-size: 24px;
  color: #6b7280;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.history-modal-close:hover {
  background: #e5e7eb;
  color: #374151;
}

.history-modal-content {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}

.history-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #6b7280;
  font-size: 16px;
}

.loading-spinner {
  margin-right: 8px;
  animation: loadingRotate 2s linear infinite;
}

.history-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #6b7280;
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-item {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: white;
}

.history-item:hover {
  border-color: #3b82f6;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
  transform: translateY(-1px);
}

.history-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.history-item-date {
  font-weight: 600;
  color: #111827;
  font-size: 14px;
}

.history-item-relative {
  font-size: 12px;
  color: #6b7280;
  background: #f3f4f6;
  padding: 2px 8px;
  border-radius: 12px;
}

.history-item-details {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.history-item-name {
  font-weight: 500;
  color: #374151;
  font-size: 14px;
}

.history-item-user {
  font-size: 12px;
  color: #6b7280;
  background: #f3f4f6;
  padding: 2px 8px;
  border-radius: 12px;
}

.history-item-actions {
  display: flex;
  justify-content: flex-end;
}

.history-load-btn {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.history-load-btn:hover {
  background: #2563eb;
  transform: translateY(-1px);
}

.history-load-btn:active {
  transform: translateY(0);
}

/* Close History Button Styles */
.close-history-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  background: #dc3545;
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  z-index: 1000;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(220, 53, 69, 0.3);
}

.close-history-btn:hover {
  background: #c82333;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(220, 53, 69, 0.4);
}

.close-history-btn:active {
  transform: translateY(0);
}

.close-icon {
  font-size: 14px;
  font-weight: bold;
}

.close-text {
  font-size: 11px;
}
</style> 