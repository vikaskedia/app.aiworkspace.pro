<template>
  <div class="ai-portfolio-manager">


    <div class="portfolio-content" v-loading="loading">
      <div v-if="!loading && portfolioData.length === 0 && columns.length === 0" class="empty-state">
        <el-empty description="No portfolio data yet">
          <el-button type="primary" @click="initializePortfolio">Create First Portfolio</el-button>
        </el-empty>
      </div>

      <div v-else-if="columns.length > 0" class="handsontable-wrapper">
        <!-- Filter Controls -->
        <div class="filter-controls">
          <div class="filter-toolbar">
            <div class="filter-actions">
              <el-button-group>
                <el-button 
                  size="small" 
                  @click="clearAllFilters"
                  :icon="RefreshRight"
                  title="Clear All Filters"
                >
                  Clear Filters
                </el-button>
                <el-button 
                  size="small" 
                  @click="showFilterDialog = true"
                  :icon="Filter"
                  title="Advanced Filters"
                >
                  Advanced
                </el-button>
                <el-button 
                  size="small" 
                  @click="showSavedFiltersDialog = true"
                  :icon="FolderOpened"
                  title="Saved Filters"
                >
                  Saved
                </el-button>
              </el-button-group>
            </div>
            <div class="active-filters" v-if="activeFilters.length > 0">
              <span class="filter-label">Active Filters:</span>
              <el-tag 
                v-for="filter in activeFilters" 
                :key="filter.id"
                closable
                @close="removeFilter(filter)"
                size="small"
                effect="light"
                class="filter-tag"
              >
                {{ getFilterDisplayText(filter) }}
              </el-tag>
            </div>
          </div>
        </div>
        
        <div class="handsontable-container">
          <HotTable
            ref="hotTableComponent"
            :settings="hotSettings"
            :data="handsontableData"
          />
        </div>
      </div>

      <!-- AI Analysis Section -->
      <div class="ai-analysis-section">
        <div class="analysis-header">
          <h3>AI Analysis</h3>
          <div class="analysis-actions">
            <el-button @click="showSystemPromptDialog = true" :icon="Tools" title="Configure AI Analysis">
              Settings
            </el-button>
            <el-button 
              type="primary" 
              @click="runAIAnalysis" 
              :loading="runningAnalysis"
              :disabled="!systemPrompt.trim() || portfolioData.length === 0"
            >
              {{ runningAnalysis ? 'Analyzing...' : 'Run Analysis' }}
            </el-button>
          </div>
        </div>

        <!-- No Data Message -->
        <div v-if="portfolioData.length === 0" class="no-data-message">
          <el-alert 
            type="info" 
            title="No Portfolio Data" 
            description="Create your portfolio spreadsheet first, then configure a system prompt to run AI analysis."
            :closable="false"
          />
        </div>

        <!-- No System Prompt Message -->
        <div v-else-if="!systemPrompt.trim()" class="no-prompt-message">
          <el-alert 
            type="warning" 
            title="No System Prompt Configured" 
            description="Click the Settings button to configure an AI analysis prompt before running analysis."
            :closable="false"
          />
        </div>

        <!-- Analysis Results -->
        <div v-if="analysisResults.length > 0" class="analysis-results">
          <h4>Analysis History</h4>
          <div class="results-list">
            <div 
              v-for="result in analysisResults" 
              :key="result.id"
              class="result-item"
            >
              <div class="result-header">
                <span class="result-date">{{ formatDate(result.created_at) }}</span>
                <div class="result-actions">
                  <el-button 
                    size="small" 
                    type="info" 
                    @click="toggleDebug(result.id)"
                    :icon="Tools"
                  >
                    Debug
                  </el-button>
                  <el-button size="small" @click="viewAnalysis(result)">View</el-button>
                </div>
              </div>
              <div class="result-preview">
                {{ truncateText(result.ai_response, 150) }}
              </div>
              
              <!-- Debug Info -->
              <div v-if="expandedDebug.has(result.id)" class="debug-info">
                <div class="debug-section">
                  <h5>🤖 AI Request Details</h5>
                  <div class="debug-details">
                    <p><strong>Request ID:</strong> {{ result.id }}</p>
                    <p><strong>Timestamp:</strong> {{ formatDate(result.created_at) }}</p>
                    <p><strong>Matter ID:</strong> {{ result.matter_id }}</p>
                    <p><strong>AI Model:</strong> {{ result.ai_model || 'GPT-4 (default)' }}</p>
                    <p><strong>Request Status:</strong> <span class="status-success">✓ Completed</span></p>
                  </div>
                </div>
                
                <div class="debug-section">
                  <h5>📝 System Prompt Sent to AI</h5>
                  <div class="debug-prompt">{{ result.system_prompt }}</div>
                  <div class="prompt-meta">
                    <small>Character count: {{ result.system_prompt.length }} | Word count: {{ result.system_prompt.split(' ').length }}</small>
                  </div>
                </div>
                
                <div class="debug-section">
                  <h5>📊 Spreadsheet Data Payload</h5>
                  <div class="debug-data">{{ formatDetailedSpreadsheetData(result.spreadsheet_data) }}</div>
                  <div class="data-meta">
                    <small>
                      Columns: {{ result.spreadsheet_data?.columns?.length || 0 }} | 
                      Rows: {{ result.spreadsheet_data?.data?.length || 0 }} | 
                      Total cells: {{ (result.spreadsheet_data?.columns?.length || 0) * (result.spreadsheet_data?.data?.length || 0) }}
                    </small>
                  </div>
                </div>
                
                <!--div class="debug-section">
                  <h5>🔄 Raw JSON Payload Sent to AI</h5>
                  <div class="debug-json">{{ formatAIRequestPayload(result) }}</div>
                </div-->
                
                <div class="debug-section">
                  <h5>💬 AI Response Data</h5>
                  <div class="debug-response">
                    <div class="response-stats">
                      <small>
                        Response length: {{ result.ai_response.length }} characters | 
                        Words: {{ result.ai_response.split(' ').length }} | 
                        Lines: {{ result.ai_response.split('\n').length }}
                      </small>
                    </div>
                    <div class="response-content">{{ result.ai_response }}</div>
                  </div>
                </div>
                
                <div class="debug-section">
                  <h5>⚡ Performance Metrics</h5>
                  <div class="debug-details">
                    <p><strong>Processing Time:</strong> {{ result.processing_time || 'N/A' }}</p>
                    <p><strong>Token Usage:</strong> {{ result.token_usage || 'N/A' }}</p>
                    <p><strong>Cost Estimate:</strong> {{ result.cost_estimate || 'N/A' }}</p>
                    <p><strong>API Endpoint:</strong> https://app.aiworkspace.pro/api/ai-portfolio-analysis</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>


    </div>

    <!-- System Prompt Dialog -->
    <el-dialog
      v-model="showSystemPromptDialog"
      title="Configure AI Analysis Prompt"
      width="600px"
    >
      <el-form label-width="120px">
        <el-form-item label="System Prompt">
          <el-input
            v-model="systemPrompt"
            type="textarea"
            :rows="8"
            placeholder="Enter the system prompt for AI analysis of your portfolio data..."
          />
        </el-form-item>
        <el-form-item>
          <el-text type="info" size="small">
            This prompt will be sent to ChatGPT along with your spreadsheet data for analysis.
          </el-text>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showSystemPromptDialog = false">Cancel</el-button>
        <el-button type="primary" @click="saveSystemPrompt">Save Prompt</el-button>
      </template>
    </el-dialog>

    <!-- View Analysis Dialog -->
    <el-dialog
      v-model="showAnalysisDialog"
      title="AI Analysis Result"
      width="800px"
    >
      <div v-if="selectedAnalysis" class="analysis-content">
        <div class="analysis-meta">
          <p><strong>Date:</strong> {{ formatDate(selectedAnalysis.created_at) }}</p>
          <p><strong>System Prompt:</strong></p>
          <div class="prompt-box">{{ selectedAnalysis.system_prompt }}</div>
        </div>
        <div class="analysis-response">
          <p><strong>AI Response:</strong></p>
          <div class="response-box" v-html="formatResponse(selectedAnalysis.ai_response)"></div>
        </div>
      </div>
      <template #footer>
        <el-button @click="showAnalysisDialog = false">Close</el-button>
      </template>
    </el-dialog>

    <!-- Create Column Group Dialog -->
    <el-dialog
      v-model="showGroupColumnsDialog"
      title="Create Column Group"
      width="500px"
    >
      <div class="group-dialog-content">
        <div class="selected-columns-info">
          <p><strong>Selected Columns:</strong></p>
          <div class="columns-preview">
            <span v-if="selectedColumns.length === 2" class="columns-range">
              {{ String.fromCharCode(65 + selectedColumns[0]) }} - {{ String.fromCharCode(65 + selectedColumns[1]) }}
              ({{ columns[selectedColumns[0]]?.label }} to {{ columns[selectedColumns[1]]?.label }})
            </span>
          </div>
        </div>
        <el-form label-width="120px" class="group-form">
          <el-form-item label="Group Name" required>
            <el-input
              v-model="groupName"
              placeholder="Enter group name (e.g., User Info, Contact Details)"
              maxlength="50"
              show-word-limit
              @keyup.enter="createColumnGroup"
            />
          </el-form-item>
          <el-form-item>
            <el-text type="info" size="small">
              This will create a collapsible group header that spans the selected columns.
              You can expand/collapse the group by clicking the button in the header.
            </el-text>
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="showGroupColumnsDialog = false">Cancel</el-button>
        <el-button type="primary" @click="createColumnGroup" :disabled="!groupName.trim()">
          Create Group
        </el-button>
      </template>
    </el-dialog>

    <!-- Advanced Filter Dialog -->
    <el-dialog
      v-model="showFilterDialog"
      title="Advanced Filters"
      width="700px"
    >
      <div class="filter-dialog-content">
        <div class="filter-builder">
          <h4>Create Custom Filter</h4>
          <el-form :model="newFilter" label-width="120px">
            <el-form-item label="Column">
              <el-select v-model="newFilter.column" placeholder="Select column">
                <el-option 
                  v-for="(col, index) in columns" 
                  :key="index"
                  :label="col.label" 
                  :value="index"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="Condition">
              <el-select v-model="newFilter.condition" placeholder="Select condition">
                <el-option label="Contains" value="contains" />
                <el-option label="Equals" value="eq" />
                <el-option label="Not equals" value="neq" />
                <el-option label="Starts with" value="begins_with" />
                <el-option label="Ends with" value="ends_with" />
                <el-option label="Greater than" value="gt" />
                <el-option label="Less than" value="lt" />
                <el-option label="Greater or equal" value="gte" />
                <el-option label="Less or equal" value="lte" />
                <el-option label="Is empty" value="empty" />
                <el-option label="Is not empty" value="not_empty" />
                <el-option label="Between" value="between" />
              </el-select>
            </el-form-item>
            <el-form-item label="Value" v-if="needsValue(newFilter.condition)">
              <el-input 
                v-if="newFilter.condition !== 'between'"
                v-model="newFilter.value" 
                placeholder="Enter filter value"
              />
              <div v-else class="between-inputs">
                <el-input 
                  v-model="newFilter.value" 
                  placeholder="From"
                  style="width: 48%"
                />
                <span style="width: 4%; text-align: center">to</span>
                <el-input 
                  v-model="newFilter.value2" 
                  placeholder="To"
                  style="width: 48%"
                />
              </div>
            </el-form-item>
          </el-form>
          <div class="filter-actions">
            <el-button type="primary" @click="addCustomFilter" :disabled="!isValidFilter">
              Add Filter
            </el-button>
          </div>
        </div>

        <div class="filter-presets" v-if="columns.length > 0">
          <h4>Quick Filters</h4>
          <div class="preset-buttons">
            <el-button 
              v-for="(col, index) in columns" 
              :key="index"
              size="small" 
              @click="showColumnValueFilter(index)"
            >
              Filter {{ col.label }}
            </el-button>
          </div>
        </div>

        <div class="applied-filters" v-if="activeFilters.length > 0">
          <h4>Applied Filters</h4>
          <div class="filter-list">
            <div 
              v-for="filter in activeFilters" 
              :key="filter.id"
              class="filter-item"
            >
              <span class="filter-description">{{ getFilterDisplayText(filter) }}</span>
              <el-button size="small" type="danger" @click="removeFilter(filter)">
                Remove
              </el-button>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="showFilterDialog = false">Close</el-button>
        <el-button type="primary" @click="saveCurrentFilters">Save Filter Set</el-button>
      </template>
    </el-dialog>

    <!-- Saved Filters Dialog -->
    <el-dialog
      v-model="showSavedFiltersDialog"
      title="Saved Filter Sets"
      width="600px"
    >
      <div class="saved-filters-content">
        <div v-if="savedFilters.length === 0" class="no-saved-filters">
          <el-empty description="No saved filter sets">
            <el-text type="info">Create and save filter combinations for quick access</el-text>
          </el-empty>
        </div>
        <div v-else class="saved-filter-list">
          <div 
            v-for="savedFilter in savedFilters" 
            :key="savedFilter.id"
            class="saved-filter-item"
          >
            <div class="saved-filter-info">
              <h5>{{ savedFilter.name }}</h5>
              <p class="filter-description">{{ savedFilter.description }}</p>
              <div class="filter-tags">
                <el-tag 
                  v-for="filter in savedFilter.filters" 
                  :key="filter.id"
                  size="small"
                  effect="plain"
                >
                  {{ getFilterDisplayText(filter) }}
                </el-tag>
              </div>
            </div>
            <div class="saved-filter-actions">
              <el-button size="small" type="primary" @click="applySavedFilter(savedFilter)">
                Apply
              </el-button>
              <el-button size="small" type="danger" @click="deleteSavedFilter(savedFilter.id)">
                Delete
              </el-button>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="showSavedFiltersDialog = false">Close</el-button>
      </template>
    </el-dialog>

    <!-- Column Value Filter Dialog -->
    <el-dialog
      v-model="showColumnValueDialog"
      :title="`Filter ${selectedColumnForValues !== null ? columns[selectedColumnForValues]?.label : ''}`"
      width="500px"
    >
      <div class="column-value-filter">
        <div class="search-values">
          <el-input
            v-model="valueFilterSearch"
            placeholder="Search values..."
            :prefix-icon="Search"
            clearable
          />
        </div>
        <div class="value-list">
          <el-checkbox-group v-model="selectedValues">
            <div class="value-options">
              <el-checkbox 
                v-for="value in filteredColumnValues" 
                :key="value"
                :label="value"
                class="value-option"
              >
                {{ value || '(empty)' }}
              </el-checkbox>
            </div>
          </el-checkbox-group>
        </div>
        <div class="value-actions">
          <el-button size="small" @click="selectAllValues">Select All</el-button>
          <el-button size="small" @click="selectNoneValues">Select None</el-button>
        </div>
      </div>
      <template #footer>
        <el-button @click="showColumnValueDialog = false">Cancel</el-button>
        <el-button type="primary" @click="applyColumnValueFilter">Apply Filter</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ref, reactive, onMounted, computed, watch } from 'vue';
import { Plus, Document, Delete, Tools, ArrowDown, Filter, RefreshRight, FolderOpened, Search } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { HotTable } from '@handsontable/vue3';
import { registerAllModules } from 'handsontable/registry';
import { HyperFormula } from 'hyperformula';
import 'handsontable/styles/handsontable.css';
import 'handsontable/styles/ht-theme-main.css';
import { supabase } from '../../supabase.js';
import { useMatterStore } from '../../store/matter';
import { storeToRefs } from 'pinia';

// Register Handsontable modules
registerAllModules();

export default {
  name: 'AiPortfolioManagerCt',
  components: {
    Plus,
    Document,
    Delete,
    Tools,
    ArrowDown,
    Filter,
    RefreshRight,
    FolderOpened,
    Search,
    HotTable
  },
  setup() {
    const matterStore = useMatterStore();
    const { currentMatter } = storeToRefs(matterStore);

    const loading = ref(false);
    const portfolioData = ref([]);
    const columns = ref([]);
    const hotTableComponent = ref(null);

    // AI Analysis variables
    const showSystemPromptDialog = ref(false);
    const systemPrompt = ref('');
    const runningAnalysis = ref(false);
    const analysisResults = ref([]);
    const showAnalysisDialog = ref(false);
    const selectedAnalysis = ref(null);
    const expandedDebug = ref(new Set());

    // Column Groups variables
    const columnGroups = ref([]);
    const showGroupColumnsDialog = ref(false);
    const selectedColumns = ref([]);
    const groupName = ref('');

    // Filter variables
    const showFilterDialog = ref(false);
    const showSavedFiltersDialog = ref(false);
    const showColumnValueDialog = ref(false);
    const activeFilters = ref([]);
    const savedFilters = ref([]);
    const newFilter = reactive({
      column: null,
      condition: '',
      value: '',
      value2: ''
    });
    const selectedColumnForValues = ref(null);
    const selectedValues = ref([]);
    const valueFilterSearch = ref('');

    // Initialize HyperFormula instance for formulas
    const hyperformulaInstance = HyperFormula.buildEmpty({
      licenseKey: 'gpl-v3',
      useArrayArithmetic: true,
      useColumnIndex: true
    });



    // Handsontable configuration
    const hotSettings = computed(() => {
      const rowCount = Math.max(handsontableData.value.length, 8); // At least 8 rows visible
      const nestedHeaderHeight = columnGroups.value.length > 0 ? 100 : 50; // 3 rows when groups exist, 2 rows when no groups
      const rowHeight = 20; // More generous row height
      const calculatedHeight = Math.min(rowCount * rowHeight + nestedHeaderHeight + 20, 700); // Increased max height to 700px
      
      return {
        height: calculatedHeight,
        width: '100%',
        rowHeaders: true,
        colHeaders: false, // Disable simple headers since we're using nested headers
        nestedHeaders: columnHeaders.value,
        collapsibleColumns: getCollapsibleColumnsConfig(),
        contextMenu: [
          'row_above',
          'row_below',
          'col_left', 
          'col_right',
          '---------',
          'remove_row',
          'remove_col',
          '---------',
          'copy',
          'cut',
          'paste',
          '---------',
          'alignment',
          '---------',
          {
            name: 'Insert Formula',
            callback: function(key, selection, clickEvent) {
              insertFormulaHelper(selection);
            }
          },
          {
            name: 'Edit Column Label',
            callback: function(key, selection, clickEvent) {
              editColumnLabel(selection);
            }
          },
          '---------',
          {
            name: 'Group Columns',
            callback: function(key, selection, clickEvent) {
              groupSelectedColumns(selection);
            }
          },
          {
            name: 'Ungroup Columns',
            callback: function(key, selection, clickEvent) {
              ungroupSelectedColumns(selection);
            }
          }
        ],
        licenseKey: 'non-commercial-and-evaluation',
        formulas: {
          engine: hyperformulaInstance,
          sheetName: 'Portfolio'
        },
        dropdownMenu: [
          'filter_by_condition',
          'filter_by_value',
          'filter_action_bar'
        ],
        filters: true,
        columnSorting: true,
        autoWrapRow: true,
        autoWrapCol: true,
        manualColumnResize: true,
        manualRowResize: true,
        copyPaste: true,
        fillHandle: true,
        minRows: 1,
        minCols: columns.value.length || 3,
        afterChange: function (changes, source) {
          if (source !== 'loadData') {
            onCellChange(changes, source);
          }
        },
        afterRender: function () {
          // Debug: Check if collapsible buttons are rendered
          const buttons = document.querySelectorAll('.collapsibleIndicator');
          if (buttons.length > 0) {
            console.log('🔘 Found', buttons.length, 'collapsible buttons');
          } else {
            console.log('❌ No collapsible buttons found');
          }
        },
        afterColumnResize: function (newSize, column, isDoubleClick) {
          // Save column widths when user resizes columns
          saveColumnWidths();
        },
        colWidths: getColumnWidths(),
        cells: function (row, col) {
          const cellProperties = {};
          
          // Check if cell contains a formula
          const cellData = this.instance.getDataAtCell(row, col);
          if (typeof cellData === 'string' && cellData.startsWith('=')) {
            cellProperties.className = 'formula-cell';
          }
          
          return cellProperties;
        }
      };
    });

    // Computed properties for Handsontable
    const columnHeaders = computed(() => {
      if (columns.value.length === 0) return true;
      
      const headers = [];
      
      // If there are column groups, create group headers first
      if (columnGroups.value.length > 0) {
        const groupHeaderRow = [];
        let currentCol = 0;
        
        // Sort groups by startCol to process them in order
        const sortedGroups = [...columnGroups.value].sort((a, b) => a.startCol - b.startCol);
        
        for (const group of sortedGroups) {
          // Add individual columns before this group
          while (currentCol < group.startCol) {
            groupHeaderRow.push(String.fromCharCode(65 + currentCol));
            currentCol++;
          }
          
          // Add the group header with colspan
          groupHeaderRow.push({
            label: group.name,
            colspan: group.endCol - group.startCol + 1
          });
          currentCol = group.endCol + 1;
        }
        
        // Add remaining individual columns
        while (currentCol < columns.value.length) {
          groupHeaderRow.push(String.fromCharCode(65 + currentCol));
          currentCol++;
        }
        
        headers.push(groupHeaderRow);
        
        // Create A, B, C... row (sub-headers under groups)
        const letterRow = [];
        currentCol = 0;
        
        for (const group of sortedGroups) {
          // Add individual column letters before this group
          while (currentCol < group.startCol) {
            letterRow.push(String.fromCharCode(65 + currentCol));
            currentCol++;
          }
          
          // Add letters for grouped columns
          for (let i = group.startCol; i <= group.endCol; i++) {
            letterRow.push(String.fromCharCode(65 + i));
          }
          currentCol = group.endCol + 1;
        }
        
        // Add remaining individual column letters
        while (currentCol < columns.value.length) {
          letterRow.push(String.fromCharCode(65 + currentCol));
          currentCol++;
        }
        
        headers.push(letterRow);
      } else {
        // No groups - just add A, B, C... row
        headers.push(columns.value.map((_, index) => String.fromCharCode(65 + index)));
      }
      
      // Always add column names as the last row
      headers.push(columns.value.map(col => col.label));
      
      return headers;
    });



    // Column Groups Functions
    const getCollapsibleColumnsConfig = () => {
      if (columnGroups.value.length === 0) return false;
      
      // Calculate the position of each group in the group header row
      const config = [];
      const sortedGroups = [...columnGroups.value].sort((a, b) => a.startCol - b.startCol);
      
      let headerPosition = 0;
      let currentCol = 0;
      
      for (const group of sortedGroups) {
        // Account for individual columns before this group
        while (currentCol < group.startCol) {
          headerPosition++;
          currentCol++;
        }
        
        // Add collapsible config for this group
        const configItem = {
          row: -3, // Top row (group headers row)
          col: headerPosition,
          collapsible: true
        };
        config.push(configItem);
        
        console.log(`🎯 Group "${group.name}" at header position ${headerPosition}, columns ${group.startCol}-${group.endCol}`);
        
        // Move past this group
        headerPosition++;
        currentCol = group.endCol + 1;
      }
      
      console.log('🔧 Final collapsible config:', config);
      return config;
    };

    const groupSelectedColumns = (selection) => {
      if (!hotTableComponent.value?.hotInstance) {
        ElMessage.warning('Table not ready');
        return;
      }
      
      // Get current selection from Handsontable instance
      const selected = hotTableComponent.value.hotInstance.getSelected();
      if (!selected || selected.length === 0) {
        ElMessage.warning('Please select multiple columns first');
        return;
      }
      
      const [startRow, startCol, endRow, endCol] = selected[0];
      const minCol = Math.min(startCol, endCol);
      const maxCol = Math.max(startCol, endCol);
      
      if (minCol === maxCol) {
        ElMessage.warning('Please select multiple columns to group');
        return;
      }
      
      // Check for overlapping groups
      const overlapping = columnGroups.value.some(group => 
        (minCol >= group.startCol && minCol <= group.endCol) ||
        (maxCol >= group.startCol && maxCol <= group.endCol) ||
        (minCol <= group.startCol && maxCol >= group.endCol)
      );
      
      if (overlapping) {
        ElMessage.warning('Cannot create overlapping column groups');
        return;
      }
      
      selectedColumns.value = [minCol, maxCol];
      showGroupColumnsDialog.value = true;
    };

    const ungroupSelectedColumns = async (selection) => {
      if (!hotTableComponent.value?.hotInstance) {
        ElMessage.warning('Table not ready');
        return;
      }
      
      // Get current selection from Handsontable instance
      const selected = hotTableComponent.value.hotInstance.getSelected();
      if (!selected || selected.length === 0) {
        ElMessage.warning('Please select columns first');
        return;
      }
      
      const [startRow, startCol, endRow, endCol] = selected[0];
      const minCol = Math.min(startCol, endCol);
      const maxCol = Math.max(startCol, endCol);
      
      // Find groups that overlap with selection
      const groupsToRemove = columnGroups.value.filter(group => 
        (minCol >= group.startCol && minCol <= group.endCol) ||
        (maxCol >= group.startCol && maxCol <= group.endCol) ||
        (minCol <= group.startCol && maxCol >= group.endCol)
      );
      
      if (groupsToRemove.length === 0) {
        ElMessage.warning('No column groups found in selection');
        return;
      }
      
      // Remove the groups
      groupsToRemove.forEach(groupToRemove => {
        const index = columnGroups.value.findIndex(g => g.id === groupToRemove.id);
        if (index !== -1) {
          columnGroups.value.splice(index, 1);
        }
      });
      
      await savePortfolio();
      
      // Debug: Log after ungrouping
      console.log('Remaining groups:', columnGroups.value);
      console.log('Updated headers:', columnHeaders.value);
      console.log('Updated collapsible config:', getCollapsibleColumnsConfig());
      
      ElMessage.success(`Removed ${groupsToRemove.length} column group(s)`);
    };

    const createColumnGroup = async () => {
      if (!groupName.value.trim()) {
        ElMessage.warning('Please enter a group name');
        return;
      }
      
      if (selectedColumns.value.length !== 2) {
        ElMessage.error('Invalid column selection');
        return;
      }
      
      const [startCol, endCol] = selectedColumns.value;
      const newGroup = {
        id: Date.now().toString(),
        name: groupName.value.trim(),
        startCol: startCol,
        endCol: endCol
      };
      
      columnGroups.value.push(newGroup);
      columnGroups.value.sort((a, b) => a.startCol - b.startCol);
      
      await savePortfolio();
      
      showGroupColumnsDialog.value = false;
      groupName.value = '';
      selectedColumns.value = [];
      
      // Debug: Log the configuration
      console.log('✅ Created group:', newGroup);
      console.log('📊 Column headers structure:', columnHeaders.value);
      console.log('🔧 Collapsible config:', getCollapsibleColumnsConfig());
      console.log('📏 Header rows count:', columnHeaders.value.length);
      
      ElMessage.success('Column group created successfully');
    };



    const initializePortfolio = async () => {
      // Create default columns with widths
      columns.value = [
        { key: 'item', label: 'Portfolio Item', width: 150 },
        { key: 'value', label: 'Value', width: 120 },
        { key: 'status', label: 'Status', width: 120 }
      ];
      
      // Add first row
      portfolioData.value = [
        { item: '', value: '', status: '' }
      ];
      
      await savePortfolio();
      
      // Force update Handsontable after initialization
      setTimeout(() => {
        if (hotTableComponent.value?.hotInstance) {
          hotTableComponent.value.hotInstance.render();
        }
      }, 100);
    };

    const addRow = () => {
      if (columns.value.length === 0) {
        ElMessage.warning('Please add columns first');
        return;
      }
      
      const newRow = {};
      columns.value.forEach(column => {
        newRow[column.key] = '';
      });
      portfolioData.value.push(newRow);
      savePortfolio();
    };

    const removeLastRow = async () => {
      if (portfolioData.value.length <= 1) return;
      
      try {
        await ElMessageBox.confirm('Are you sure you want to delete the last row?', 'Confirm', {
          type: 'warning'
        });
        portfolioData.value.pop();
        await savePortfolio();
      } catch {
        // User cancelled
      }
    };

    const addColumn = async () => {
      try {
        const { value: columnName } = await ElMessageBox.prompt('Enter column name:', 'Add Column', {
          confirmButtonText: 'Add',
          cancelButtonText: 'Cancel',
          inputPattern: /^.+$/,
          inputErrorMessage: 'Column name cannot be empty'
        });

        if (columnName) {
          const columnKey = columnName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
          const newCol = {
            key: columnKey,
            label: columnName.trim(),
            width: 120 // Default width for new columns
          };
          
          columns.value.push(newCol);
          
          // Add empty values for this column to all existing rows
          portfolioData.value.forEach(row => {
            row[columnKey] = '';
          });
          
          // Update Handsontable
          if (hotTableComponent.value?.hotInstance) {
            hotTableComponent.value.hotInstance.updateSettings({
              colHeaders: columns.value.map(col => col.label),
              minCols: columns.value.length
            });
          }
          
          await savePortfolio();
        }
      } catch (error) {
        // User cancelled or error occurred
        console.log('Add column cancelled');
      }
    };

    const removeLastColumn = async () => {
      if (columns.value.length <= 1) return;
      
      try {
        await ElMessageBox.confirm('Are you sure you want to delete the last column?', 'Confirm', {
          type: 'warning'
        });
        
        const removedColumn = columns.value.pop();
        
        // Remove column data from all rows
        portfolioData.value.forEach(row => {
          delete row[removedColumn.key];
        });
        
        // Update Handsontable
        if (hotTableComponent.value?.hotInstance) {
          hotTableComponent.value.hotInstance.updateSettings({
            colHeaders: columns.value.map(col => col.label),
            minCols: columns.value.length
          });
        }
        
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
          systemPrompt.value = data.system_prompt || '';
          columnGroups.value = data.column_groups || [];
          savedFilters.value = data.saved_filters || [];
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
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        // Get current data from Handsontable if available
        let currentData = portfolioData.value;
        if (hotTableComponent.value?.hotInstance) {
          currentData = hotTableComponent.value.hotInstance.getSourceData();
          // Convert array data back to object format
          currentData = currentData.map(row => {
            const rowObj = {};
            columns.value.forEach((col, index) => {
              rowObj[col.key] = row[index] || '';
            });
            return rowObj;
          });
        }
        
        const portfolioRecord = {
          matter_id: currentMatter.value.id,
          columns: columns.value,
          data: currentData,
          system_prompt: systemPrompt.value,
          column_groups: columnGroups.value,
          saved_filters: savedFilters.value,
          created_by: user.id,
          updated_by: user.id
        };

        const { error } = await supabase
          .from('portfolio_data')
          .upsert(portfolioRecord, {
            onConflict: 'matter_id'
          });

        if (error) throw error;
        
        portfolioData.value = currentData;
        ElMessage.success('Portfolio saved');
      } catch (error) {
        console.error('Error saving portfolio:', error);
        ElMessage.error('Failed to save portfolio data');
      }
    };

    // Handsontable event handlers
    const onCellChange = (changes, source) => {
      if (source !== 'loadData' && changes) {
        // Convert Handsontable array data back to object format
        const tableData = hotTableComponent.value?.hotInstance?.getSourceData() || [];
        portfolioData.value = tableData.map(row => {
          const rowObj = {};
          columns.value.forEach((col, index) => {
            rowObj[col.key] = row[index] || '';
          });
          return rowObj;
        });
        savePortfolio();
      }
    };

    // AI Analysis functions
    const saveSystemPrompt = async () => {
      if (!currentMatter.value?.id) return;
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        const promptRecord = {
          matter_id: currentMatter.value.id,
          columns: columns.value,
          data: portfolioData.value,
          system_prompt: systemPrompt.value,
          column_groups: columnGroups.value,
          created_by: user.id,
          updated_by: user.id
        };

        const { error } = await supabase
          .from('portfolio_data')
          .upsert(promptRecord, {
            onConflict: 'matter_id'
          });

        if (error) throw error;
        
        ElMessage.success('System prompt saved successfully!');
        showSystemPromptDialog.value = false;
      } catch (error) {
        console.error('Error saving system prompt:', error);
        ElMessage.error('Failed to save system prompt: ' + error.message);
      }
    };

    const runAIAnalysis = async () => {
      if (!systemPrompt.value.trim() || !currentMatter.value?.id || portfolioData.value.length === 0) {
        ElMessage.warning('Please ensure you have portfolio data and a system prompt configured.');
        return;
      }
      
      runningAnalysis.value = true;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        // Get current data from Handsontable
        let currentData = portfolioData.value;
        if (hotTableComponent.value?.hotInstance) {
          currentData = hotTableComponent.value.hotInstance.getSourceData();
          // Convert array data back to object format for analysis
          currentData = currentData.map(row => {
            const rowObj = {};
            columns.value.forEach((col, index) => {
              rowObj[col.key] = row[index] || '';
            });
            return rowObj;
          });
        }
        
        // Prepare spreadsheet data for AI
        const spreadsheetData = {
          columns: columns.value,
          data: currentData
        };

        // Make API call to ChatGPT
        const response = await fetch('https://app.aiworkspace.pro/api/ai-portfolio-analysis', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            systemPrompt: systemPrompt.value,
            spreadsheetData: spreadsheetData,
            matterId: currentMatter.value.id
          })
        });

        if (!response.ok) throw new Error('AI analysis failed');
        
        const result = await response.json();
        
        // Save analysis result to database
        const { error } = await supabase
          .from('portfolio_analysis_results')
          .insert({
            matter_id: currentMatter.value.id,
            system_prompt: systemPrompt.value,
            spreadsheet_data: spreadsheetData,
            ai_response: result.response,
            created_by: user.id
          });

        if (error) throw error;
        
        // Reload analysis results
        await loadAnalysisResults();
        
        ElMessage.success('AI analysis completed successfully!');
      } catch (error) {
        console.error('Error running AI analysis:', error);
        ElMessage.error('Failed to run AI analysis: ' + error.message);
      } finally {
        runningAnalysis.value = false;
      }
    };

    const loadAnalysisResults = async () => {
      if (!currentMatter.value?.id) return;
      
      try {
        const { data, error } = await supabase
          .from('portfolio_analysis_results')
          .select('*')
          .eq('matter_id', currentMatter.value.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        analysisResults.value = data || [];
      } catch (error) {
        console.error('Error loading analysis results:', error);
      }
    };

    const viewAnalysis = (analysis) => {
      selectedAnalysis.value = analysis;
      showAnalysisDialog.value = true;
    };

    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleString();
    };

    const truncateText = (text, length) => {
      if (text.length <= length) return text;
      return text.substring(0, length) + '...';
    };

    const formatResponse = (response) => {
      // Convert line breaks to HTML and handle basic formatting
      return response.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    };

    const toggleDebug = (resultId) => {
      if (expandedDebug.value.has(resultId)) {
        expandedDebug.value.delete(resultId);
      } else {
        expandedDebug.value.add(resultId);
      }
    };

    const formatSpreadsheetDebug = (spreadsheetData) => {
      if (!spreadsheetData || !spreadsheetData.columns || !spreadsheetData.data) {
        return 'No data available';
      }
      
      const { columns, data } = spreadsheetData;
      let formatted = `Columns: ${columns.length}, Rows: ${data.length}\n\n`;
      
      // Show column structure
      formatted += 'Column Structure:\n';
      columns.forEach((col, index) => {
        formatted += `  ${index + 1}. ${col.label} (${col.key})\n`;
      });
      
      // Show sample data (first 3 rows)
      if (data.length > 0) {
        formatted += '\nSample Data (first 3 rows):\n';
        const sampleData = data.slice(0, 3);
        sampleData.forEach((row, index) => {
          formatted += `  Row ${index + 1}: `;
          columns.forEach(col => {
            formatted += `${col.label}="${row[col.key] || ''}" `;
          });
          formatted += '\n';
        });
      }
      
      return formatted;
    };

    const formatDetailedSpreadsheetData = (spreadsheetData) => {
      if (!spreadsheetData || !spreadsheetData.columns || !spreadsheetData.data) {
        return 'No data available';
      }
      
      const { columns, data } = spreadsheetData;
      let formatted = `=== SPREADSHEET STRUCTURE ===\n`;
      formatted += `Total Columns: ${columns.length}\n`;
      formatted += `Total Rows: ${data.length}\n`;
      formatted += `Total Data Points: ${columns.length * data.length}\n\n`;
      
      // Column definitions
      formatted += `=== COLUMN DEFINITIONS ===\n`;
      columns.forEach((col, index) => {
        formatted += `Column ${index + 1}:\n`;
        formatted += `  - Label: "${col.label}"\n`;
        formatted += `  - Key: "${col.key}"\n`;
        formatted += `  - Type: text\n\n`;
      });
      
      // All data (not just sample)
      formatted += `=== COMPLETE DATA SET ===\n`;
      if (data.length === 0) {
        formatted += 'No data rows\n';
      } else {
        // Header row
        formatted += 'ROW | ';
        columns.forEach(col => {
          formatted += `${col.label.padEnd(15)} | `;
        });
        formatted += '\n';
        formatted += '----+';
        columns.forEach(() => {
          formatted += '-----------------+';
        });
        formatted += '\n';
        
        // Data rows
        data.forEach((row, rowIndex) => {
          formatted += `${String(rowIndex + 1).padStart(3)} | `;
          columns.forEach(col => {
            const value = row[col.key] || '';
            formatted += `${String(value).padEnd(15)} | `;
          });
          formatted += '\n';
        });
      }
      
      return formatted;
    };

    const formatAIRequestPayload = (result) => {
      const payload = {
        systemPrompt: result.system_prompt,
        spreadsheetData: result.spreadsheet_data,
        matterId: result.matter_id,
        timestamp: result.created_at,
        requestId: result.id
      };
      
      return JSON.stringify(payload, null, 2);
    };

    // Filter Computed Properties
    const isValidFilter = computed(() => {
      return newFilter.column !== null && 
             newFilter.condition && 
             (needsValue(newFilter.condition) ? newFilter.value || newFilter.condition === 'between' && newFilter.value && newFilter.value2 : true);
    });

    const filteredColumnValues = computed(() => {
      if (selectedColumnForValues.value === null) return [];
      
      const columnKey = columns.value[selectedColumnForValues.value]?.key;
      if (!columnKey) return [];
      
      // Get unique values from the column
      const values = portfolioData.value.map(row => row[columnKey] || '').filter((value, index, self) => {
        return self.indexOf(value) === index;
      });
      
      // Filter by search term
      if (valueFilterSearch.value) {
        return values.filter(value => 
          value.toString().toLowerCase().includes(valueFilterSearch.value.toLowerCase())
        );
      }
      
      return values;
    });

    // Filter Functions
    const needsValue = (condition) => {
      return !['empty', 'not_empty'].includes(condition);
    };

    const clearAllFilters = () => {
      if (hotTableComponent.value?.hotInstance) {
        const filtersPlugin = hotTableComponent.value.hotInstance.getPlugin('filters');
        filtersPlugin.clearConditions();
        filtersPlugin.filter();
        activeFilters.value = [];
        ElMessage.success('All filters cleared');
      }
    };

    const addCustomFilter = () => {
      if (!isValidFilter.value || !hotTableComponent.value?.hotInstance) return;
      
      const filtersPlugin = hotTableComponent.value.hotInstance.getPlugin('filters');
      const column = newFilter.column;
      const condition = newFilter.condition;
      
      let filterCondition;
      
      if (condition === 'between') {
        filterCondition = [condition, [newFilter.value, newFilter.value2]];
      } else if (needsValue(condition)) {
        filterCondition = [condition, [newFilter.value]];
      } else {
        filterCondition = [condition, []];
      }
      
      // Add to Handsontable filters
      filtersPlugin.addCondition(column, filterCondition[0], filterCondition[1]);
      filtersPlugin.filter();
      
      // Add to our tracking
      const filterId = Date.now().toString();
      activeFilters.value.push({
        id: filterId,
        column: column,
        condition: condition,
        value: newFilter.value,
        value2: newFilter.value2
      });
      
      // Reset form
      Object.assign(newFilter, {
        column: null,
        condition: '',
        value: '',
        value2: ''
      });
      
      ElMessage.success('Filter applied');
    };

    const removeFilter = (filter) => {
      if (!hotTableComponent.value?.hotInstance) return;
      
      const filtersPlugin = hotTableComponent.value.hotInstance.getPlugin('filters');
      
      // Remove from active filters
      const index = activeFilters.value.findIndex(f => f.id === filter.id);
      if (index !== -1) {
        activeFilters.value.splice(index, 1);
      }
      
      // Rebuild all filters
      filtersPlugin.clearConditions();
      
      activeFilters.value.forEach(f => {
        let filterCondition;
        if (f.condition === 'between') {
          filterCondition = [f.condition, [f.value, f.value2]];
        } else if (needsValue(f.condition)) {
          filterCondition = [f.condition, [f.value]];
        } else {
          filterCondition = [f.condition, []];
        }
        filtersPlugin.addCondition(f.column, filterCondition[0], filterCondition[1]);
      });
      
      filtersPlugin.filter();
      ElMessage.success('Filter removed');
    };

    const getFilterDisplayText = (filter) => {
      const columnName = columns.value[filter.column]?.label || 'Unknown';
      const conditionNames = {
        'contains': 'contains',
        'eq': 'equals',
        'neq': 'not equals',
        'begins_with': 'starts with',
        'ends_with': 'ends with',
        'gt': 'greater than',
        'lt': 'less than',
        'gte': 'greater or equal',
        'lte': 'less or equal',
        'empty': 'is empty',
        'not_empty': 'is not empty',
        'between': 'between'
      };
      
      const conditionName = conditionNames[filter.condition] || filter.condition;
      
      if (filter.condition === 'between') {
        return `${columnName} ${conditionName} ${filter.value} and ${filter.value2}`;
      } else if (needsValue(filter.condition)) {
        return `${columnName} ${conditionName} "${filter.value}"`;
      } else {
        return `${columnName} ${conditionName}`;
      }
    };

    const showColumnValueFilter = (columnIndex) => {
      selectedColumnForValues.value = columnIndex;
      selectedValues.value = [];
      valueFilterSearch.value = '';
      showColumnValueDialog.value = true;
    };

    const selectAllValues = () => {
      selectedValues.value = [...filteredColumnValues.value];
    };

    const selectNoneValues = () => {
      selectedValues.value = [];
    };

    const applyColumnValueFilter = () => {
      if (!hotTableComponent.value?.hotInstance || selectedColumnForValues.value === null) return;
      
      const filtersPlugin = hotTableComponent.value.hotInstance.getPlugin('filters');
      const column = selectedColumnForValues.value;
      
      if (selectedValues.value.length === 0) {
        ElMessage.warning('Please select at least one value');
        return;
      }
      
      // Use "by_value" condition for multi-select
      filtersPlugin.addCondition(column, 'by_value', selectedValues.value);
      filtersPlugin.filter();
      
      // Add to our tracking
      const filterId = Date.now().toString();
      activeFilters.value.push({
        id: filterId,
        column: column,
        condition: 'by_value',
        value: selectedValues.value.join(', '),
        values: selectedValues.value
      });
      
      showColumnValueDialog.value = false;
      ElMessage.success('Value filter applied');
    };

    const saveCurrentFilters = async () => {
      if (activeFilters.value.length === 0) {
        ElMessage.warning('No filters to save');
        return;
      }
      
      try {
        const { value: filterSetName } = await ElMessageBox.prompt('Enter a name for this filter set:', 'Save Filters', {
          confirmButtonText: 'Save',
          cancelButtonText: 'Cancel',
          inputPattern: /^.+$/,
          inputErrorMessage: 'Filter set name cannot be empty'
        });

        if (filterSetName) {
          const savedFilter = {
            id: Date.now().toString(),
            name: filterSetName.trim(),
            description: `${activeFilters.value.length} filter(s)`,
            filters: [...activeFilters.value],
            created_at: new Date().toISOString()
          };
          
          savedFilters.value.push(savedFilter);
          await saveSavedFilters();
          
          ElMessage.success('Filter set saved successfully');
          showFilterDialog.value = false;
        }
      } catch (error) {
        // User cancelled
      }
    };

    const applySavedFilter = (savedFilter) => {
      if (!hotTableComponent.value?.hotInstance) return;
      
      // Clear existing filters
      clearAllFilters();
      
      const filtersPlugin = hotTableComponent.value.hotInstance.getPlugin('filters');
      
      // Apply each saved filter
      savedFilter.filters.forEach(filter => {
        let filterCondition;
        
        if (filter.condition === 'between') {
          filterCondition = [filter.condition, [filter.value, filter.value2]];
        } else if (filter.condition === 'by_value') {
          filterCondition = [filter.condition, filter.values || [filter.value]];
        } else if (needsValue(filter.condition)) {
          filterCondition = [filter.condition, [filter.value]];
        } else {
          filterCondition = [filter.condition, []];
        }
        
        filtersPlugin.addCondition(filter.column, filterCondition[0], filterCondition[1]);
      });
      
      filtersPlugin.filter();
      
      // Update active filters
      activeFilters.value = [...savedFilter.filters];
      
      showSavedFiltersDialog.value = false;
      ElMessage.success(`Applied filter set: ${savedFilter.name}`);
    };

    const deleteSavedFilter = async (filterId) => {
      try {
        await ElMessageBox.confirm('Are you sure you want to delete this filter set?', 'Confirm', {
          type: 'warning'
        });
        
        const index = savedFilters.value.findIndex(f => f.id === filterId);
        if (index !== -1) {
          savedFilters.value.splice(index, 1);
          await saveSavedFilters();
          ElMessage.success('Filter set deleted');
        }
      } catch {
        // User cancelled
      }
    };

    const loadSavedFilters = async () => {
      if (!currentMatter.value?.id) return;
      
      try {
        const { data, error } = await supabase
          .from('portfolio_data')
          .select('saved_filters')
          .eq('matter_id', currentMatter.value.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        if (data?.saved_filters) {
          savedFilters.value = data.saved_filters;
        }
      } catch (error) {
        console.error('Error loading saved filters:', error);
      }
    };

    const saveSavedFilters = async () => {
      if (!currentMatter.value?.id) return;
      
      try {
        const { error } = await supabase
          .from('portfolio_data')
          .update({ saved_filters: savedFilters.value })
          .eq('matter_id', currentMatter.value.id);

        if (error) throw error;
      } catch (error) {
        console.error('Error saving filters:', error);
        ElMessage.error('Failed to save filters');
      }
    };



    const insertFormulaHelper = (selection) => {
      if (!hotTableComponent.value?.hotInstance) {
        ElMessage.warning('Table not ready');
        return;
      }
      
      // Get current selection from Handsontable instance
      const selected = hotTableComponent.value.hotInstance.getSelected();
      if (selected && selected.length > 0) {
        const [startRow, startCol, endRow, endCol] = selected[0];
        const cellRef = `${String.fromCharCode(65 + startCol)}${startRow + 1}`;
        
        ElMessageBox.prompt(
          `Enter a formula for cell ${cellRef}. Examples:\n• =A1+B1 (add two cells)\n• =SUM(A1:A5) (sum range)\n• =AVERAGE(A:A) (average column)`,
          'Insert Formula',
          {
            confirmButtonText: 'Insert',
            cancelButtonText: 'Cancel',
            inputPattern: /^=/,
            inputErrorMessage: 'Formula must start with ='
          }
        ).then(({ value }) => {
          hotTableComponent.value.hotInstance.setDataAtCell(startRow, startCol, value);
          ElMessage.success('Formula inserted successfully!');
        }).catch(() => {
          // User cancelled
        });
      }
    };

    const editColumnLabel = async (selection) => {
      if (!hotTableComponent.value?.hotInstance) {
        ElMessage.warning('Table not ready');
        return;
      }
      
      // Get current selection from Handsontable instance
      const selected = hotTableComponent.value.hotInstance.getSelected();
      if (!selected || selected.length === 0) {
        ElMessage.warning('Please select a column first');
        return;
      }
      
      const [startRow, startCol, endRow, endCol] = selected[0];
      const columnIndex = startCol;
      
      await editColumnHeaderByIndex(columnIndex);
    };

    const editColumnHeaderByIndex = async (columnIndex) => {
      if (columnIndex < 0 || columnIndex >= columns.value.length) {
        ElMessage.warning('Invalid column selected');
        return;
      }
      
      const currentColumn = columns.value[columnIndex];
      const currentLabel = currentColumn.label;
      const columnLetter = String.fromCharCode(65 + columnIndex);
      
      try {
        const { value: newLabel } = await ElMessageBox.prompt(
          `Edit label for column ${columnLetter}:`,
          'Edit Column Label',
          {
            confirmButtonText: 'Save',
            cancelButtonText: 'Cancel',
            inputValue: currentLabel,
            inputPattern: /^.+$/,
            inputErrorMessage: 'Column label cannot be empty'
          }
        );

        if (newLabel && newLabel.trim() !== currentLabel) {
          // Update the column label
          columns.value[columnIndex].label = newLabel.trim();
          
          // Save the portfolio
          await savePortfolio();
          
          ElMessage.success('Column label updated successfully!');
        }
      } catch (error) {
        // User cancelled or error occurred
        console.log('Edit column label cancelled');
      }
    };

    // Column width management functions
    const getColumnWidths = () => {
      if (!columns.value.length) return undefined;
      
      return columns.value.map((col, index) => {
        return col.width || 120; // Get width from column definition or default 120px
      });
    };

    const saveColumnWidths = async () => {
      if (!hotTableComponent.value?.hotInstance || !currentMatter.value?.id) return;
      
      try {
        // Get current column widths from Handsontable and update column definitions
        const instance = hotTableComponent.value.hotInstance;
        
        columns.value.forEach((col, index) => {
          const width = instance.getColWidth(index);
          if (width && width > 0) {
            col.width = width; // Store width directly in column definition
          }
        });
        
        // Save to database with a small delay to avoid too frequent saves
        setTimeout(() => {
          savePortfolio();
        }, 1000);
        
      } catch (error) {
        console.error('Error saving column widths:', error);
      }
    };

    // Watch portfolioData to convert object data to array format for Handsontable
    const handsontableData = computed(() => {
      if (!columns.value.length) return [];
      
      // If no data, create at least one empty row
      if (!portfolioData.value || portfolioData.value.length === 0) {
        return [columns.value.map(() => '')];
      }
      
      return portfolioData.value.map(row => {
        return columns.value.map(col => row[col.key] || '');
      });
    });

    // Watch for changes to columns, portfolioData, and columnGroups and update Handsontable
    watch([columns, portfolioData, columnGroups], () => {
      if (hotTableComponent.value?.hotInstance) {
        setTimeout(() => {
          // Update height based on new content with improved calculation
          const rowCount = Math.max(handsontableData.value.length, 8);
          const nestedHeaderHeight = columnGroups.value.length > 0 ? 100 : 50;
          const rowHeight = 20;
          const calculatedHeight = Math.min(rowCount * rowHeight + nestedHeaderHeight + 20, 700);
          
          hotTableComponent.value.hotInstance.updateSettings({
            height: calculatedHeight,
            nestedHeaders: columnHeaders.value,
            collapsibleColumns: getCollapsibleColumnsConfig(),
            colWidths: getColumnWidths()
          });
          hotTableComponent.value.hotInstance.render();
        }, 50);
      }
    }, { deep: true });

    onMounted(() => {
      loadPortfolio();
      loadAnalysisResults();
      loadSavedFilters();
    });

    return {
      loading,
      portfolioData,
      columns,
      hotTableComponent,
      showSystemPromptDialog,
      systemPrompt,
      runningAnalysis,
      analysisResults,
      showAnalysisDialog,
      selectedAnalysis,
      expandedDebug,
      columnGroups,
      showGroupColumnsDialog,
      selectedColumns,
      groupName,
      // Filter variables
      showFilterDialog,
      showSavedFiltersDialog,
      showColumnValueDialog,
      activeFilters,
      savedFilters,
      newFilter,
      selectedColumnForValues,
      selectedValues,
      valueFilterSearch,
      // Computed
      hotSettings,
      columnHeaders,
      handsontableData,
      isValidFilter,
      filteredColumnValues,
      // Functions
      initializePortfolio,
      savePortfolio,
      onCellChange,
      saveSystemPrompt,
      runAIAnalysis,
      loadAnalysisResults,
      viewAnalysis,
      formatDate,
      truncateText,
      formatResponse,
      toggleDebug,
      formatSpreadsheetDebug,
      formatDetailedSpreadsheetData,
      formatAIRequestPayload,
      insertFormulaHelper,
      editColumnLabel,
      editColumnHeaderByIndex,
      getColumnWidths,
      saveColumnWidths,
      getCollapsibleColumnsConfig,
      groupSelectedColumns,
      ungroupSelectedColumns,
      createColumnGroup,
      // Filter functions
      needsValue,
      clearAllFilters,
      addCustomFilter,
      removeFilter,
      getFilterDisplayText,
      showColumnValueFilter,
      selectAllValues,
      selectNoneValues,
      applyColumnValueFilter,
      saveCurrentFilters,
      applySavedFilter,
      deleteSavedFilter
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



.portfolio-content {
  flex: 1;
  overflow-x: hidden;
  overflow-y: auto;
  background: #fafafa;
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  background: white;
}

.handsontable-wrapper {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  margin: 16px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}



.handsontable-container {
  width: 100%;
  position: relative;
}

/* Scrollbars */
.handsontable-container::-webkit-scrollbar {
  width: 12px;
  height: 12px;
}

.handsontable-container::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.handsontable-container::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 6px;
}

.handsontable-container::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

.handsontable-container::-webkit-scrollbar-corner {
  background: #f1f1f1;
}

/* Mobile Responsive */
@media (max-width: 768px) {
  .handsontable-wrapper {
    margin: 8px;
    border-radius: 4px;
  }



  .handsontable-container {
    /* Height is now dynamic based on content */
  }
}

/* Selection and focus styles */
.handsontable-container .ht_master .ht_clone {
  z-index: 1000; /* Ensure cloned cells are above other elements */
}

.handsontable-container .ht_master .ht_clone .ht_clone_cell {
  border: 2px solid #1a73e8;
  box-shadow: 0 0 0 2px #1a73e8;
}

.handsontable-container .ht_master .ht_clone .ht_clone_cell .ht_clone_cell_content {
  border: 2px solid #1a73e8;
  box-shadow: 0 0 0 2px #1a73e8;
}

/* Animation for smooth interactions */
.handsontable-container .ht_master .ht_clone .ht_clone_cell,
.handsontable-container .ht_master .ht_clone .ht_clone_cell .ht_clone_cell_content {
  transition: border-color 0.1s ease, box-shadow 0.1s ease;
}

  /* Data row height adjustment */
  :deep(.htCore tbody tr td) {
    height: 20px !important;
    vertical-align: middle !important;
    padding: 2px 6px !important;
    line-height: 16px !important;
  }

  /* Formula cell styling */
  :deep(.formula-cell) {
    background-color: #e8f5e8 !important;
    font-family: 'Roboto Mono', monospace;
    font-weight: 500;
    border-left: 3px solid #4caf50 !important;
  }

:deep(.formula-cell):hover {
  background-color: #d4edda !important;
}



/* AI Analysis Section */
.ai-analysis-section {
  margin: 24px 16px;
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}

.analysis-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e0e0e0;
}

.analysis-header h3 {
  margin: 0;
  color: #202124;
  font-size: 18px;
  font-weight: 500;
}

.analysis-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.analysis-results {
  margin-top: 24px;
}

.analysis-results h4 {
  margin: 0 0 16px 0;
  color: #3c4043;
  font-size: 16px;
  font-weight: 500;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.result-item {
  background: #f8f9fa;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 16px;
  transition: background-color 0.2s ease;
}

.result-item:hover {
  background: #f1f3f4;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.result-date {
  font-size: 13px;
  color: #5f6368;
  font-weight: 500;
}

.result-actions {
  display: flex;
  gap: 8px;
}

.result-preview {
  color: #3c4043;
  font-size: 14px;
  line-height: 1.4;
}

/* Debug Information Styles */
.debug-info {
  margin-top: 16px;
  padding: 16px;
  background: #f1f3f4;
  border: 1px solid #dadce0;
  border-radius: 6px;
  font-size: 13px;
}

.debug-section {
  margin-bottom: 20px;
  border-bottom: 1px solid #e0e0e0;
  padding-bottom: 16px;
}

.debug-section:last-child {
  margin-bottom: 0;
  border-bottom: none;
  padding-bottom: 0;
}

.debug-section h5 {
  margin: 0 0 12px 0;
  color: #1a73e8;
  font-size: 15px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.debug-prompt,
.debug-data,
.debug-json,
.debug-response .response-content {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 12px;
  font-family: 'Roboto Mono', monospace;
  font-size: 12px;
  line-height: 1.4;
  white-space: pre-wrap;
  color: #202124;
  max-height: 200px;
  overflow-y: auto;
}

.debug-json {
  background: #f8f9fa;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 12px;
  font-family: 'Roboto Mono', monospace;
  font-size: 11px;
  line-height: 1.3;
  white-space: pre-wrap;
  color: #5f6368;
  max-height: 300px;
  overflow-y: auto;
}

.prompt-meta,
.data-meta,
.response-stats {
  margin-top: 8px;
  padding: 8px;
  background: #f8f9fa;
  border-radius: 4px;
  color: #5f6368;
  font-size: 11px;
}

.status-success {
  color: #137333;
  font-weight: 600;
}

.debug-response {
  margin-top: 8px;
}

.response-stats {
  margin-bottom: 8px;
}

.debug-details p {
  margin: 4px 0;
  color: #3c4043;
}

.debug-details strong {
  color: #1a73e8;
}

/* Dialog Content */
.analysis-content {
  max-height: 70vh;
  overflow-y: auto;
}

.analysis-meta {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e0e0e0;
}

.analysis-meta p {
  margin: 8px 0;
  color: #3c4043;
}

.prompt-box,
.response-box {
  background: #f8f9fa;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 12px;
  margin-top: 8px;
  font-family: 'Roboto Mono', monospace;
  font-size: 13px;
  line-height: 1.5;
}

.prompt-box {
  color: #5f6368;
  white-space: pre-wrap;
}

.response-box {
  color: #202124;
  white-space: pre-wrap;
}

.response-box strong {
  font-weight: 600;
  color: #1a73e8;
}

/* Alert Messages */
.no-data-message,
.no-prompt-message {
  margin-top: 16px;
}

.no-data-message :deep(.el-alert),
.no-prompt-message :deep(.el-alert) {
  border-radius: 6px;
}

.no-data-message :deep(.el-alert__content),
.no-prompt-message :deep(.el-alert__content) {
  padding-left: 8px;
}

/* Mobile Responsive for AI Section */
@media (max-width: 768px) {
  .ai-analysis-section {
    margin: 16px 8px;
    padding: 16px;
  }

  .analysis-header {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }

  .analysis-actions {
    justify-content: center;
  }

  .result-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .result-actions {
    align-self: stretch;
    justify-content: center;
  }

  .result-date {
    order: 2;
    align-self: flex-start;
  }

  .debug-info {
    padding: 12px;
    font-size: 12px;
  }

  .debug-prompt,
  .debug-data {
    font-size: 11px;
    padding: 8px;
    max-height: 150px;
  }
}

/* Column Groups Dialog Styles */
.group-dialog-content {
  padding: 8px 0;
}

.selected-columns-info {
  margin-bottom: 20px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
}

.selected-columns-info p {
  margin: 0 0 8px 0;
  color: #3c4043;
  font-weight: 500;
}

.columns-preview {
  display: flex;
  align-items: center;
  gap: 8px;
}

.columns-range {
  background: #e8f0fe;
  color: #1a73e8;
  padding: 4px 8px;
  border-radius: 4px;
  font-family: 'Roboto Mono', monospace;
  font-size: 13px;
  font-weight: 500;
}

.group-form {
  margin-top: 16px;
}

.group-form .el-form-item {
  margin-bottom: 16px;
}

.group-form .el-input {
  width: 100%;
}

  /* Enhanced Nested Headers for Groups */
  :deep(.ht_clone_top .htCore thead tr:first-child th),
  :deep(.htCore thead tr:first-child th) {
    background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%) !important;
    color: #0d47a1 !important;
    font-weight: 700 !important;
    font-size: 14px !important;
    border: 2px solid #1976d2 !important;
    text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);
    position: relative;
  }
  
  /* Second row headers (A, B, C...) */
  :deep(.ht_clone_top .htCore thead tr:nth-child(2) th),
  :deep(.htCore thead tr:nth-child(2) th) {
    background: #f8f9fa !important;
    color: #1976d2 !important;
    font-weight: 600 !important;
    font-size: 12px !important;
    height: 25px !important;
    border-bottom: 1px solid #dadce0 !important;
  }
  
  /* Third row headers (column names) */
  :deep(.ht_clone_top .htCore thead tr:nth-child(3) th),
  :deep(.htCore thead tr:nth-child(3) th) {
    background: #ffffff !important;
    color: #202124 !important;
    font-weight: 500 !important;
    font-size: 13px !important;
    height: 30px !important;
    border-bottom: 2px solid #dadce0 !important;
  }

/* Collapsible button styling - White arrow */
:deep(.collapsibleIndicator) {
  background: transparent !important;
  color: white !important;
  border: none !important;
  padding: 2px 4px !important;
  font-size: 16px !important;
  font-weight: bold !important;
  cursor: pointer !important;
  transition: all 0.2s ease !important;
  margin-left: 8px !important;
  min-width: 20px !important;
  height: 20px !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  position: relative !important;
  z-index: 10 !important;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.7) !important;
}

:deep(.collapsibleIndicator:hover) {
  transform: scale(1.2) !important;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8) !important;
}

/* Arrow content - CSS triangular arrows */
:deep(.collapsibleIndicator::before) {
  content: "" !important;
  width: 0 !important;
  height: 0 !important;
  border-style: solid !important;
  border-width: 6px 8px 6px 0 !important;
  border-color: transparent white transparent transparent !important;
  display: inline-block !important;
}

/* When collapsed, show left-pointing arrow */
:deep(.collapsibleIndicator.collapsed::before) {
  border-width: 6px 0 6px 8px !important;
  border-color: transparent transparent transparent white !important;
}

/* Alternative: Use Unicode arrows if you prefer them over CSS triangles */
/*
:deep(.collapsibleIndicator::before) {
  content: "▼" !important;
  color: white !important;
  font-size: 12px !important;
}

:deep(.collapsibleIndicator.collapsed::before) {
  content: "▶" !important;
}
*/

/* Make sure the button is positioned properly in group headers */
:deep(.ht_clone_top .htCore thead tr:first-child th),
:deep(.htCore thead tr:first-child th) {
  padding: 8px 6px !important;
  vertical-align: middle !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  position: relative !important;
}

/* Ensure button appears in group header row - positioned absolutely */
:deep(.ht_clone_top .htCore thead tr:first-child th .collapsibleIndicator),
:deep(.htCore thead tr:first-child th .collapsibleIndicator) {
  position: absolute !important;
  right: 4px !important;
  top: 50% !important;
  transform: translateY(-50%) !important;
  float: none !important;
  margin: 0 !important;
}

/* Group header hover effects */
:deep(.ht_clone_top .htCore thead tr:first-child th):hover,
:deep(.htCore thead tr:first-child th):hover {
  background: linear-gradient(135deg, #d1c4e9 0%, #b39ddb 100%) !important;
  color: #4a148c !important;
}

/* Grouped columns visual indication */
:deep(.htCore tbody tr td.grouped-column) {
  border-left: 3px solid #1976d2 !important;
  background: linear-gradient(90deg, rgba(25, 118, 210, 0.05) 0%, transparent 100%) !important;
}

/* Filter Controls Styles */
.filter-controls {
  background: white;
  border-bottom: 1px solid #e0e0e0;
  padding: 12px 16px;
}

.filter-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.filter-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.active-filters {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-label {
  font-size: 13px;
  color: #5f6368;
  font-weight: 500;
}

.filter-tag {
  margin-right: 4px;
  margin-bottom: 4px;
}

/* Filter Dialog Styles */
.filter-dialog-content {
  padding: 8px 0;
}

.filter-builder {
  margin-bottom: 24px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
}

.filter-builder h4 {
  margin: 0 0 16px 0;
  color: #1a73e8;
  font-size: 16px;
  font-weight: 600;
}

.filter-actions {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.between-inputs {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.filter-presets {
  margin-bottom: 24px;
  padding: 16px;
  background: #f1f3f4;
  border-radius: 6px;
  border: 1px solid #dadce0;
}

.filter-presets h4 {
  margin: 0 0 12px 0;
  color: #3c4043;
  font-size: 15px;
  font-weight: 600;
}

.preset-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.applied-filters {
  padding: 16px;
  background: #e8f0fe;
  border-radius: 6px;
  border: 1px solid #1976d2;
}

.applied-filters h4 {
  margin: 0 0 12px 0;
  color: #1976d2;
  font-size: 15px;
  font-weight: 600;
}

.filter-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filter-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
  padding: 8px 12px;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
}

.filter-description {
  font-size: 14px;
  color: #3c4043;
  flex: 1;
}

/* Saved Filters Dialog Styles */
.saved-filters-content {
  padding: 8px 0;
}

.no-saved-filters {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
}

.saved-filter-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.saved-filter-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
  transition: background-color 0.2s ease;
}

.saved-filter-item:hover {
  background: #f1f3f4;
}

.saved-filter-info {
  flex: 1;
  margin-right: 16px;
}

.saved-filter-info h5 {
  margin: 0 0 8px 0;
  color: #202124;
  font-size: 16px;
  font-weight: 600;
}

.saved-filter-info .filter-description {
  margin: 0 0 12px 0;
  font-size: 13px;
  color: #5f6368;
}

.filter-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.saved-filter-actions {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

/* Column Value Filter Dialog Styles */
.column-value-filter {
  padding: 8px 0;
}

.search-values {
  margin-bottom: 16px;
}

.value-list {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 8px;
  margin-bottom: 16px;
}

.value-options {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.value-option {
  padding: 4px 8px;
  margin: 0;
  border-radius: 4px;
  transition: background-color 0.2s ease;
}

.value-option:hover {
  background: #f8f9fa;
}

.value-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

/* Mobile Responsive for Filter Controls */
@media (max-width: 768px) {
  .filter-toolbar {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .filter-actions {
    justify-content: center;
  }

  .active-filters {
    justify-content: center;
  }

  .filter-builder {
    padding: 12px;
  }

  .preset-buttons {
    justify-content: center;
  }

  .filter-item {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .saved-filter-item {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .saved-filter-actions {
    justify-content: center;
    align-self: stretch;
  }

  .between-inputs {
    flex-direction: column;
    gap: 8px;
  }

  .between-inputs span {
    text-align: center;
    width: 100%;
  }
}

/* Enhanced filter dropdown menu styling */
:deep(.htDropdownMenu) {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
  border-radius: 6px !important;
  border: 1px solid #e0e0e0 !important;
}

:deep(.htDropdownMenu .ht_clone_top) {
  background: white !important;
}

:deep(.htDropdownMenu .htCore) {
  background: white !important;
}

/* Filter condition styling */
:deep(.htUIMultipleSelectHot) {
  border-radius: 4px !important;
  border: 1px solid #e0e0e0 !important;
}

:deep(.htUIMultipleSelectHot .ht_master .ht_clone_top) {
  background: #f8f9fa !important;
}

/* Active filter indication in column headers */
:deep(.htCore thead th.htFiltersActive) {
  background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%) !important;
  color: #0d47a1 !important;
  font-weight: 600 !important;
  position: relative !important;
}

:deep(.htCore thead th.htFiltersActive::after) {
  content: "🔍" !important;
  position: absolute !important;
  top: 2px !important;
  right: 4px !important;
  font-size: 12px !important;
  color: #1976d2 !important;
}


</style> 