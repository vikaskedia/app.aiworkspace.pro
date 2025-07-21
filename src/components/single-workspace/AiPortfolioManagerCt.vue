<template>
  <div class="ai-portfolio-manager">


    <div class="portfolio-content" v-loading="loading">
      <div v-if="!loading && portfolioData.length === 0 && columns.length === 0" class="empty-state">
        <el-empty description="No portfolio data yet">
          <el-button type="primary" @click="initializePortfolio">Create First Portfolio</el-button>
        </el-empty>
      </div>

      <div v-else-if="columns.length > 0" class="handsontable-wrapper">

        
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
            <el-button @click="showSystemPromptDialog = true" :icon="Setting" title="Configure AI Analysis">
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
                    :icon="Setting"
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
  </div>
</template>

<script>
import { ref, reactive, onMounted, computed, watch } from 'vue';
import { Plus, Document, Delete, Setting, ArrowDown } from '@element-plus/icons-vue';
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
    Setting,
    ArrowDown,
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

    // Initialize HyperFormula instance for formulas
    const hyperformulaInstance = HyperFormula.buildEmpty({
      licenseKey: 'gpl-v3',
      useArrayArithmetic: true,
      useColumnIndex: true
    });



    // Handsontable configuration
    const hotSettings = computed(() => {
      const rowCount = Math.max(handsontableData.value.length, 8); // At least 8 rows visible
      const nestedHeaderHeight = 50; // Account for two-row nested headers (A,B,C + column names)
      const rowHeight = 20; // More generous row height
      const calculatedHeight = Math.min(rowCount * rowHeight + nestedHeaderHeight + 20, 700); // Increased max height to 700px
      
      return {
        height: calculatedHeight,
        width: '100%',
        rowHeaders: true,
        colHeaders: false, // Disable simple headers since we're using nested headers
        nestedHeaders: columnHeaders.value,
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
          }
        ],
        licenseKey: 'non-commercial-and-evaluation',
        formulas: {
          engine: hyperformulaInstance,
          sheetName: 'Portfolio'
        },
        dropdownMenu: true,
        filters: true,
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
      
      // Create nested headers: [A, B, C...] on top, [column names] below
      return [
        columns.value.map((_, index) => String.fromCharCode(65 + index)), // A, B, C...
        columns.value.map(col => col.label) // Actual column names
      ];
    });



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



    const insertFormulaHelper = (selection) => {
      if (selection && selection.length > 0) {
        const [startRow, startCol, endRow, endCol] = selection[0];
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

    // Watch for changes to columns and update Handsontable
    watch([columns, portfolioData], () => {
      if (hotTableComponent.value?.hotInstance) {
        setTimeout(() => {
          // Update height based on new content with improved calculation
          const rowCount = Math.max(handsontableData.value.length, 8);
          const nestedHeaderHeight = 50;
          const rowHeight = 20;
          const calculatedHeight = Math.min(rowCount * rowHeight + nestedHeaderHeight + 20, 700);
          
          hotTableComponent.value.hotInstance.updateSettings({
            height: calculatedHeight,
            nestedHeaders: columnHeaders.value,
            colWidths: getColumnWidths()
          });
          hotTableComponent.value.hotInstance.render();
        }, 50);
      }
    }, { deep: true });

    onMounted(() => {
      loadPortfolio();
      loadAnalysisResults();
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
      hotSettings,
      columnHeaders,
      handsontableData,
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
      getColumnWidths,
      saveColumnWidths
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

  /* Nested headers styling for A, B, C... notation */
  :deep(.ht_clone_top .htCore thead th),
  :deep(.htCore thead th) {
    background: #f8f9fa !important;
    border-bottom: 1px solid #e0e0e0 !important;
    color: #5f6368 !important;
    font-weight: 500 !important;
    text-align: center !important;
  }

  /* First row of nested headers (A, B, C...) */
  :deep(.ht_clone_top .htCore thead tr:first-child th),
  :deep(.htCore thead tr:first-child th) {
    background: #e8f0fe !important;
    color: #1a73e8 !important;
    font-weight: 700 !important;
    font-size: 14px !important;
    height: 30px !important;
    border-bottom: 2px solid #1a73e8 !important;
  }

  /* Second row of nested headers (column names) */
  :deep(.ht_clone_top .htCore thead tr:last-child th),
  :deep(.htCore thead tr:last-child th) {
    background: #f8f9fa !important;
    color: #202124 !important;
    font-weight: 600 !important;
    font-size: 12px !important;
    height: 35px !important;
    border-bottom: 1px solid #dadce0 !important;
  }

  /* Data row height adjustment */
  :deep(.htCore tbody tr td) {
    height: 20px !important;
    vertical-align: middle !important;
    padding: 2px 6px !important;
    line-height: 16px !important;
  }

  /* Hover effects */
  :deep(.ht_clone_top .htCore thead th):hover,
  :deep(.htCore thead th):hover {
    background: #f1f3f4 !important;
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
</style> 