<template>
  <div class="ai-fund-analyst-ct">
    <div class="form-section">
      <!-- Settings Icon -->
      <div class="form-header">
        <el-icon class="settings-icon" @click="showSettings = true">
          <Setting />
        </el-icon>
      </div>
      
      <!-- Strategy Selection -->
      <div class="form-row" style="display: flex; gap: 1rem;">
        <label class="form-label">Strategy:</label>
        <el-select 
          v-model="selectedStrategyFilter" 
          placeholder="Select a strategy to filter reports" 
          style="width: 300px;"
          @change="filterReportsByStrategy"
          clearable
          filterable
        > 
          <el-option
            v-for="strategy in uniqueStrategies"
            :key="strategy"
            :label="getStrategyLabel(strategy)"
            :value="strategy"
          />
        </el-select>

        <el-select 
          v-if="selectedStrategyFilter && strategyLLMResults.length"
          v-model="selectedReportDate"
          placeholder="Select report date"
          @change="onSelectReportDate"
          filterable
        >
          <el-option
            v-for="result in strategyLLMResults.filter(r => r.status !== 'failed')"
            :key="result.created_at"
            :label="`${formatDateTime(result.created_at)} (${capitalize(result.status)})`"
            :value="result.created_at"
          />
        </el-select>
      </div>
    </div>

    <!-- Report Content -->
    <div v-if="reportContent" class="report-section">
      <div class="report-content" v-html="reportContent"></div>
    </div>

    <!-- Empty State -->
    <div v-if="!reportContent && !loading" class="empty-state">
      <el-empty description="No report generated yet">
        <el-text class="mx-1">Select a strategy, enter a prompt, and generate your first report</el-text>
      </el-empty>
    </div>

    <!-- Settings Drawer -->
    <el-drawer
      v-model="showSettings"
      title=""
      size="50%"
      direction="rtl"
    >
      <div class="settings-content">
        <el-form label-width="100px" label-position="left">
          <div class="form-row">
            <label class="form-label">Strategy:</label>
            <el-input
              v-model="strategyDisplayValue"
              placeholder="Add strategy..."
            />
          </div>

          <div class="form-row">
            <label class="form-label">Prompt:</label>
            <el-input
              v-model="prompt"
              type="textarea"
              :rows="4"
              placeholder="Enter your analysis prompt or specific questions..."
              style="width: 100%;"
            />
          </div>

          <div class="form-row" style="display: flex; gap: 1rem; float: right;">
            <el-button type="primary" plain @click="createNewStrategy">Create new strategy</el-button>
          </div>
        </el-form>
      </div>
      <el-divider />
      <div class="form-row">
        <label class="form-label">Existing Strategies:</label>
        <el-select 
          v-model="selectedExistingStrategy" 
          placeholder="Select a strategy to filter reports" 
          style="width: 300px;"
          @change="filterReportsByExistingStrategy"
          clearable
          filterable
        > 
          <el-option
            v-for="strategy in uniqueStrategies"
            :key="strategy"
            :label="getStrategyLabel(strategy)"
            :value="strategy"
          />
        </el-select>
        <div class="form-row" style="display: flex; gap: 0.5rem; float: right;" v-if="selectedExistingStrategy">
          <el-button type="primary" plain @click="runExistingStrategy" :loading="loading">Run</el-button>
          <el-button type="primary" plain @click="scheduleExistingStrategy">Schedule</el-button>
        </div>
      </div>

      <div class="all-previous-reports" v-if="selectedExistingStrategy">
        <h3>{{ getStrategyLabel(selectedExistingStrategy) }} Reports:</h3>
        <div class="previous-reports-list">
          <el-table
          :data="historicalReports"
          border
          style="width: 100%"
          v-loading="loadingHistory"
          max-height="400"
          width="100%"
        >
          <el-table-column prop="analysis.strategy" label="Strategy" width="200">
              <template #default="{ row }">
                {{ getStrategyLabel(row.analysis.strategy) }}
              </template>
            </el-table-column>
            
            <el-table-column prop="analysis.prompt" label="Prompt" width="752">
              <template #default="{ row }">
                <span>{{ row.analysis.prompt }}</span>                
              </template>
            </el-table-column>
            
            <el-table-column prop="status" label="Status" width="150">
              <template #default="{ row }">
                <el-tag
                  :type="row.status === 'completed' ? 'success' : row.status === 'failed' ? 'danger' : 'warning'"
                >
                  {{ row.status }}
                </el-tag>
              </template>
            </el-table-column>
            
            <el-table-column prop="created_at" label="Created" width="237">
              <template #default="{ row }">
                {{ formatDateTime(row.created_at) }}
              </template>
            </el-table-column>
            
            <!-- <el-table-column label="Actions" width="116" fixed="right">
              <template #default="{ row }">
                <el-button 
                  type="primary" 
                  size="small" 
                  @click="loadLLMResultReport(row)"
                  :disabled="row.status !== 'completed'"
                >
                  Load Report
                </el-button>
              </template>
            </el-table-column> -->
          </el-table>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script>
import { ElMessage } from 'element-plus';
import { Setting } from '@element-plus/icons-vue';
import { useMatterStore } from '../../store/workspace';
import { storeToRefs } from 'pinia';
import { supabase } from '../../supabase';
import { marked } from 'marked';
import { setWorkspaceTitle } from '../../utils/page-title';

export default {
  name: 'AiFundAnalystCt',
  components: {
    Setting
  },
  setup() {
    const matterStore = useMatterStore();
    const { currentMatter } = storeToRefs(matterStore);
    return { currentMatter };
  },
  data() {
    return {
      loading: false,
      loadingHistory: false,
      error: null,
      successMessage: null,
      showSettings: false,
      isDark: false,
      selectedStrategy: '',
      prompt: '',
      reportDateTime: new Date().toISOString().slice(0, 19).replace('T', ' '),
      reportContent: '',
      historicalReports: [],
      allHistoricalReports: [],
      uniqueStrategies: [],
      selectedStrategyFilter: '',
      selectedReportDate: '',
      strategyLLMResults: [], // LLM results for selected strategy
      selectedExistingStrategy: '',
      strategies: [],
      selectedStrategyToDisplay: '',
      promptToDisplay: '',
      reportDateTimeToDisplay: ''
    };
  },
  computed: {
    
    strategyDisplayValue: {
      get() {
        if (!this.selectedStrategy) return '';
        const strategy = this.strategies.find(s => s.value === this.selectedStrategy);
        return strategy ? strategy.label : this.selectedStrategy;
      },
      set(value) {
        // Find strategy by label and set the value
        const strategy = this.strategies.find(s => s.label === value);
        this.selectedStrategy = strategy ? strategy.value : value;
      }
    }
  },
  watch: {
    currentMatter: {
      handler() {
        this.updatePageTitle();
      },
      immediate: true
    }
  },
  async mounted() {
    await this.loadHistoricalReports();
    this.updatePageTitle();
  },
  methods: {
    updatePageTitle() {
      const workspaceName = this.currentMatter?.title || 'Workspace';
      setWorkspaceTitle('AI Fund Analyst', workspaceName);
    },

    async createNewStrategy() {
      // Validate required fields
      if (!this.strategyDisplayValue || !this.strategyDisplayValue.trim()) {
        ElMessage.warning('Please enter a strategy name');
        return;
      }

      if (!this.prompt || !this.prompt.trim()) {
        ElMessage.warning('Please enter a prompt');
        return;
      }

      this.loading = true;

      try {
        // Insert new record without OpenAI response and without status
        const { data, error } = await supabase
          .from('ai_fund_analyzing_data')
          .insert({
            matter_id: this.currentMatter.id,
            strategy: this.strategyDisplayValue.trim(),
            prompt: this.prompt.trim(),
            report_datetime: new Date().toISOString(),
            created_by: (await supabase.auth.getUser()).data.user.id
          })
          .select()
          .single();

        if (error) throw error;

        // Clear the form fields
        this.strategyDisplayValue = '';
        this.prompt = '';
        
        // Close the settings drawer
        this.showSettings = true;

        // Refresh historical reports list and unique strategies
        await this.loadHistoricalReports();

        ElMessage.success('New strategy record created successfully');

      } catch (error) {
        console.error('Error creating new strategy:', error);
        ElMessage.error(`Failed to create new strategy: ${error.message || 'Unknown error'}`);
      } finally {
        this.loading = false;
      }
    },

    async callOpenAI(prompt, strategy) {
      // Construct the system prompt based on strategy
      const strategyLabel = this.getStrategyLabel(strategy);
      const systemPrompt = `You are a professional financial analyst specializing in ${strategyLabel}. 
        Provide a comprehensive, detailed analysis based on the user's request. 
        Structure your response with clear sections: Executive Summary, Analysis, Key Findings, and Recommendations.
        Be specific, actionable, and professional in your analysis.
        Format your response with proper headings and bullet points where appropriate.`;

      const userPrompt = prompt;

      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: systemPrompt
              },
              {
                role: 'user',
                content: userPrompt
              }
            ],
            max_tokens: 2000,
            temperature: 0.7
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        
        // Extract the content from OpenAI response
        const content = data.choices?.[0]?.message?.content;
        
        if (!content) {
          throw new Error('No content received from OpenAI API');
        }
        
        return {
          content: content
        };
        
      } catch (error) {
        console.error('OpenAI API call failed:', error);
        
        // Handle specific API errors
        if (error.message.includes('401')) {
          throw new Error('Invalid OpenAI API key. Please check your VITE_OPENAI_API_KEY environment variable.');
        }
        
        if (error.message.includes('429')) {
          throw new Error('OpenAI API rate limit exceeded. Please try again later.');
        }
        
        if (error.message.includes('quota')) {
          throw new Error('OpenAI API quota exceeded. Please check your usage limits.');
        }
        
        throw error;
      }
    },

    formatOpenAIResponse(content) {
      // Configure marked options for better rendering
      marked.setOptions({
        breaks: true,
        gfm: true,
        headerIds: false,
        mangle: false,
        tables: true,
        tablesHeaderId: true
      });

      // Convert markdown to HTML
      const markdownContent = marked(content);
      
      // Format the OpenAI response for display
      return `
        <div class="report-content-inner">          
          <div class="openai-response">
            ${markdownContent}
          </div>
          
          <div class="report-footer">
            <p class="disclaimer"><em>This report is generated using AI and should be reviewed by a qualified financial professional.</em></p>
          </div>
        </div>
      `;
    },

    getStrategyLabel(value) {
      const strategy = this.strategies.find(s => s.value === value);
      return strategy ? strategy.label : value;
    },

    formatDateTime(dateTime) {
      if (!dateTime) return '';
      const date = new Date(dateTime);
      // Get UTC offset in minutes
      const offset = date.getTimezoneOffset();
      // Map offset to abbreviation
      // IST: UTC+5:30 (offset -330)
      // PST: UTC-8:00 (offset 480)
      // PDT: UTC-7:00 (offset 420)
      // EDT: UTC-4:00 (offset 240)
      let tz = '';
      if (offset === -330) {
        tz = 'IST';
      } else if (offset === 480) {
        tz = 'PST';
      } else if (offset === 420) {
        tz = 'PDT';
      } else if (offset === 240) {
        tz = 'EDT';
      } else {
        // fallback: show local short name
        tz = date.toLocaleString('en-US', { timeZoneName: 'short' }).split(' ').pop();
      }
      // Format date
      const formatted = date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      return `${formatted} ${tz}`;
    },

    capitalize(str) {
      if (!str) return '';
      return str.charAt(0).toUpperCase() + str.slice(1);
    },

    // Autocomplete methods
    querySearch(queryString, cb) {
      const strategies = this.strategies;
      const results = queryString
        ? strategies.filter(this.createFilter(queryString))
        : strategies;
      
      // Transform to autocomplete format
      const suggestions = results.map(strategy => ({
        value: strategy.label,
        strategyValue: strategy.value
      }));
      
      cb(suggestions);
    },

    createFilter(queryString) {
      return (strategy) => {
        return (
          strategy.label.toLowerCase().indexOf(queryString.toLowerCase()) === 0
        );
      };
    },

    async loadHistoricalReports() {
      if (!this.currentMatter?.id) return;

      this.loadingHistory = true;
      try {
        const { data, error } = await supabase
          .from('ai_fund_analyzing_data')
          .select('*')
          .eq('matter_id', this.currentMatter.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        this.allHistoricalReports = data || [];
        this.historicalReports = []; // Don't show any reports initially
        
        // Extract unique strategies from the data
        this.extractUniqueStrategies();
        
      } catch (error) {
        console.error('Error loading historical reports:', error);
        ElMessage.error('Failed to load historical reports');
      } finally {
        this.loadingHistory = false;
      }
    },

    extractUniqueStrategies() {
      const strategies = new Set();
      this.allHistoricalReports.forEach(report => {
        if (report.strategy) {
          strategies.add(report.strategy);
        }
      });
      this.uniqueStrategies = Array.from(strategies).sort();
    },

    async filterReportsByStrategy() {
      this.selectedReportDate = '';
      this.strategyLLMResults = [];
      if (!this.selectedStrategyFilter) {
        this.historicalReports = this.allHistoricalReports;
        this.reportContent = '';
        this.selectedStrategyToDisplay = '';
        this.promptToDisplay = '';
        this.reportDateTimeToDisplay = '';
        return;
      }
      // Filter analysis requests by selected strategy
      const filteredRequests = this.allHistoricalReports.filter(
        report => report.strategy === this.selectedStrategyFilter
      );
      const analysisIds = filteredRequests.map(r => r.id);
      if (analysisIds.length === 0) {
        this.historicalReports = [];
        this.reportContent = '';
        return;
      }
      // Fetch all LLM results (any status) for these analysis IDs
      const { data: results, error } = await supabase
        .from('ai_fund_analysis_results')
        .select('*, analysis:analysis_id(strategy, prompt, created_at)')
        .in('analysis_id', analysisIds)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Error fetching LLM results:', error);
        this.historicalReports = [];
        this.reportContent = '';
        return;
      }
      this.historicalReports = results || [];
      this.strategyLLMResults = results || [];
      // Show the latest result in the report view
      const latest = (results || [])[0];
      if (latest) {
        this.selectedReportDate = latest.created_at;
        this.loadLLMResultReport(latest, false);
      } else {
        this.reportContent = '';
      }
    },

    onSelectReportDate(date) {
      const result = this.strategyLLMResults.find(r => r.created_at === date);
      if (result) {
        this.loadLLMResultReport(result, false);
      }
    },

    async filterReportsByExistingStrategy() {
      if (!this.selectedExistingStrategy) {
        this.historicalReports = [];
        this.reportContent = '';
        this.selectedStrategyToDisplay = '';
        this.promptToDisplay = '';
        this.reportDateTimeToDisplay = '';
        return;
      }
      // 1. Get all analysis requests for the selected strategy
      const filteredRequests = this.allHistoricalReports.filter(
        report => report.strategy === this.selectedExistingStrategy
      );
      const analysisIds = filteredRequests.map(r => r.id);
      if (analysisIds.length === 0) {
        this.historicalReports = [];
        this.reportContent = '';
        return;
      }
      // 2. Fetch all LLM results for these analysis IDs
      const { data: results, error } = await supabase
        .from('ai_fund_analysis_results')
        .select('*, analysis:analysis_id(strategy, prompt, created_at)')
        .in('analysis_id', analysisIds)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Error fetching LLM results:', error);
        this.historicalReports = [];
        this.reportContent = '';
        return;
      }
      // 3. Show all results in the table
      this.historicalReports = results || [];
      // 4. Auto-load the latest completed report if any
      const latest = (results || []).filter(r => r.status === 'completed' && r.openai_response)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
      if (latest) {
        //this.loadLLMResultReport(latest, false);
      } else {
        this.reportContent = '';
      }
    },

    // New: Load report from LLM result record
    loadLLMResultReport(result, showMessage = true) {
      if (result.status !== 'completed' || !result.openai_response) {
        ElMessage.warning('This report is not completed or has no content');
        return;
      }
      this.reportContent = this.formatOpenAIResponse(result.openai_response);
      this.selectedStrategyToDisplay = result.analysis?.strategy || '';
      this.promptToDisplay = result.analysis?.prompt || '';
      this.reportDateTimeToDisplay = result.analysis?.created_at || '';
      this.showSettings = false;
      if (showMessage) {
        ElMessage.success('Report loaded successfully');
      }
    },

    formatDate(dateString) {
      if (!dateString) return '';
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    },

    async runExistingStrategy() {
      if (!this.selectedExistingStrategy) {
        ElMessage.warning('Please select a strategy');
        return;
      }
      // Find the latest analysis request for this strategy
      const filteredRequests = this.allHistoricalReports.filter(
        report => report.strategy === this.selectedExistingStrategy
      );
      if (!filteredRequests.length) {
        ElMessage.warning('No analysis request found for this strategy');
        return;
      }
      // Use the latest by created_at
      const latestRequest = filteredRequests.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
      this.loading = true;
      let resultId = null;
      try {
        // 1. Create a new result record with status 'pending'
        const { data: result, error: insertError } = await supabase
          .from('ai_fund_analysis_results')
          .insert({
            analysis_id: latestRequest.id,
            status: 'pending'
          })
          .select()
          .single();
        if (insertError) throw insertError;
        resultId = result.id;
        // 2. Call OpenAI
        const openAIResponse = await this.callOpenAI(latestRequest.prompt, latestRequest.strategy);
        // 3. Update the result record with the response
        const { error: updateError } = await supabase
          .from('ai_fund_analysis_results')
          .update({
            openai_response: openAIResponse.content,
            status: 'completed',
            error_message: null
          })
          .eq('id', resultId);
        if (updateError) throw updateError;
        ElMessage.success('LLM analysis completed and saved!');
        // Refresh reports
        await this.loadHistoricalReports();
        // Auto-refresh filtered table
        await this.filterReportsByExistingStrategy();
      } catch (error) {
        console.error('Error running LLM analysis:', error);
        if (resultId) {
          await supabase
            .from('ai_fund_analysis_results')
            .update({
              status: 'failed',
              error_message: error.message || 'Unknown error'
            })
            .eq('id', resultId);
        }
        ElMessage.error('Failed to run LLM analysis: ' + (error.message || 'Unknown error'));
      } finally {
        this.loading = false;
      }
    },

    async scheduleExistingStrategy() {
      console.log('Scheduling existing strategy');
    }
  }
};
</script>

<style scoped>
.ai-fund-analyst-ct {
  padding: 1rem;
  background: white;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  max-width: 100%;
}

.form-section {
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: #f8f9fa;
  border-radius: 8px;
  position: relative;
}

.form-header {
  position: absolute;
  top: 1rem;
  right: 1rem;
  z-index: 10;
}

.settings-icon {
  font-size: 20px;
  color: #666;
  cursor: pointer;
  padding: 8px;
  border-radius: 50%;
  transition: all 0.3s ease;
}

.settings-icon:hover {
  color: #409eff;
  background-color: rgba(64, 158, 255, 0.1);
  transform: rotate(90deg);
}

.form-row {
  display: flex;
  align-items: flex-start;
  margin-bottom: 1.5rem;
  gap: 1rem;
}

.form-row:last-child {
  margin-bottom: 0;
}

.form-label {
  font-weight: 600;
  color: #333;
  min-width: 150px;
  padding-top: 8px;
  text-align: left;
}

.report-section {
  width: 94.50%;
  margin-top: 2rem;
  padding: 2rem;
  background: white;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
}

.report-header {
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #f0f2f5;
}

.report-header h3 {
  margin: 0 0 1rem 0;
  color: #2c3e50;
  font-size: 1.5rem;
}

.report-meta {
  display: flex;
  gap: 2rem;
  color: #666;
  font-size: 0.9rem;
}

.report-content {
  width: 100%;
  line-height: 1.8;
  color: #333;
}

.report-content-inner {
  width: 100%;
}

.report-content-inner h2 {
  color: #2c3e50;
  margin: 0 0 1.5rem 0;
  font-size: 1.8rem;
  text-align: center;
  padding-bottom: 1rem;
  border-bottom: 3px solid #3498db;
}

.report-content-inner h3 {
  color: #34495e;
  margin: 2rem 0 1rem 0;
  font-size: 1.3rem;
  border-left: 4px solid #3498db;
  padding-left: 1rem;
}

.report-content-inner h4 {
  color: #555;
  margin: 1.5rem 0 0.75rem 0;
  font-size: 1.1rem;
}

.report-content-inner p {
  margin: 1rem 0;
  text-align: justify;
}

.report-content-inner ul, .report-content-inner ol {
  margin: 1rem 0;
  padding-left: 2rem;
}

.report-content-inner li {
  margin: 0.5rem 0;
  line-height: 1.6;
}

.report-footer {
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 2px solid #f0f2f5;
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 6px;
}

.report-footer p {
  margin: 0.5rem 0;
  font-size: 0.9rem;
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: #666;
}

.settings-content {
  padding: 1rem;
}

.settings-content h3 {
  margin: 0 0 1rem 0;
  color: #2c3e50;
  font-size: 1.3rem;
}

.setting-item {
  margin: 1.5rem 0;
}

.setting-item h4 {
  margin: 0 0 0.5rem 0;
  color: #34495e;
  font-size: 1.1rem;
}

.setting-item p {
  margin: 0;
  color: #666;
  font-size: 0.9rem;
  line-height: 1.5;
}

/* Drawer specific styles */
.settings-content .form-row {
  margin-bottom: 1.5rem;
}

.settings-content .form-label {
  min-width: 100px;
  font-weight: 600;
  color: #333;
}

.settings-content .inline-input {
  width: 100% !important;
}

.settings-content .w-50 {
  width: 100% !important;
}

.display-text {
  color: #333;
  font-weight: 500;
  padding: 8px 12px;
  background: #f8f9fa;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  min-height: 20px;
  display: inline-block;
  width: auto;
  max-width: 500px;
  word-wrap: break-word;
}

/* Strategy Filter Dropdown */
.form-section .el-select {
  width: 300px;
}

.form-section .el-select .el-input__inner {
  border-radius: 6px;
  border: 2px solid #e4e7ed;
  padding: 8px 12px;
  font-size: 14px;
  transition: all 0.3s ease;
}

.form-section .el-select .el-input__inner:hover {
  border-color: #409eff;
}

.form-section .el-select .el-input__inner:focus {
  border-color: #409eff;
  box-shadow: 0 0 5px rgba(64, 158, 255, 0.3);
}

/* Report Header Section */
.report-header-section {
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 3px solid #3498db;
}

.report-title {
  color: #2c3e50;
  margin: 0 0 1rem 0;
  font-size: 2rem;
  font-weight: 700;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.report-metadata {
  display: flex;
  justify-content: center;
  gap: 2rem;
  flex-wrap: wrap;
}

.metadata-item {
  color: #666;
  font-size: 0.9rem;
  padding: 0.5rem 1rem;
  background: #f8f9fa;
  border-radius: 20px;
  border: 1px solid #e9ecef;
}

/* Enhanced OpenAI Response Styling */
.openai-response {
  padding: 2rem;
  background: #ffffff;
  border: 1px solid #e8e8e8;
  border-radius: 12px;
  margin: 2rem 0;
  line-height: 1.8;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

/* Markdown Headers */
.openai-response h1 {
  color: #2c3e50;
  font-size: 1.8rem;
  font-weight: 700;
  margin: 2rem 0 1rem 0;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #3498db;
}

.openai-response h2 {
  color: #34495e;
  font-size: 1.5rem;
  font-weight: 600;
  margin: 1.8rem 0 1rem 0;
  border-left: 4px solid #3498db;
  padding-left: 1rem;
  background: linear-gradient(90deg, #f8f9fa 0%, transparent 100%);
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
}

.openai-response h3 {
  color: #2c3e50;
  font-size: 1.3rem;
  font-weight: 600;
  margin: 1.5rem 0 0.8rem 0;
  border-left: 3px solid #e74c3c;
  padding-left: 0.8rem;
}

.openai-response h4 {
  color: #555;
  font-size: 1.1rem;
  font-weight: 600;
  margin: 1.2rem 0 0.6rem 0;
}

.openai-response h5, .openai-response h6 {
  color: #666;
  font-size: 1rem;
  font-weight: 600;
  margin: 1rem 0 0.5rem 0;
}

/* Paragraphs */
.openai-response p {
  margin: 1.2rem 0;
  text-align: justify;
  color: #333;
  font-size: 1rem;
}

/* Lists */
.openai-response ul, .openai-response ol {
  margin: 1.2rem 0;
  padding-left: 2rem;
}

.openai-response li {
  margin: 0.6rem 0;
  line-height: 1.7;
  color: #333;
}

.openai-response ul li {
  list-style-type: disc;
}

.openai-response ol li {
  list-style-type: decimal;
}

/* Nested lists */
.openai-response ul ul, .openai-response ol ol, .openai-response ul ol, .openai-response ol ul {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
}

/* Text formatting */
.openai-response strong, .openai-response b {
  color: #2c3e50;
  font-weight: 700;
}

.openai-response em, .openai-response i {
  font-style: italic;
  color: #666;
}

.openai-response code {
  background: #f1f3f4;
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
  color: #e74c3c;
  font-size: 0.9rem;
}

.openai-response pre {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 1rem;
  overflow-x: auto;
  margin: 1rem 0;
}

.openai-response pre code {
  background: none;
  padding: 0;
  color: #333;
}

/* Blockquotes */
.openai-response blockquote {
  border-left: 4px solid #3498db;
  padding: 1rem 1.5rem;
  margin: 1.5rem 0;
  background: #f8f9fa;
  border-radius: 0 6px 6px 0;
  font-style: italic;
  color: #555;
}

/* Tables */
.openai-response table {
  width: 100%;
  border-collapse: collapse;
  margin: 1.5rem 0;
  background: white;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.openai-response th, .openai-response td {
  padding: 0.8rem 1rem;
  text-align: left;
  border-bottom: 1px solid #e9ecef;
}

.openai-response th {
  background: #3498db;
  color: white;
  font-weight: 600;
}

.openai-response tr:hover {
  background: #f8f9fa;
}

/* Horizontal rules */
.openai-response hr {
  border: none;
  height: 2px;
  background: linear-gradient(90deg, #3498db, #e74c3c);
  margin: 2rem 0;
  border-radius: 1px;
}

/* Report footer */
.report-footer {
  margin-top: 3rem;
  padding: 1.5rem;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #f39c12;
}

.disclaimer {
  margin: 0;
  font-size: 0.9rem;
  color: #666;
  text-align: center;
  font-style: italic;
}

.mb-3 {
  margin-bottom: 1rem;
}

/* Responsive Design */
@media (max-width: 768px) {
  .form-row {
    flex-direction: column;
    align-items: stretch;
  }
  
  .form-label {
    min-width: auto;
    padding-top: 0;
    margin-bottom: 0.5rem;
  }
  
  .report-section {
    padding: 1rem;
  }
  
  .report-metadata {
    flex-direction: column;
    gap: 0.5rem;
    align-items: center;
  }
  
  .report-title {
    font-size: 1.5rem;
  }
  
  .openai-response {
    padding: 1rem;
  }
  
  .openai-response h1 {
    font-size: 1.5rem;
  }
  
  .openai-response h2 {
    font-size: 1.3rem;
  }
  
  .openai-response h3 {
    font-size: 1.2rem;
  }
  
  .openai-response table {
    font-size: 0.9rem;
  }
  
  .openai-response th, .openai-response td {
    padding: 0.5rem;
  }
}

@media (max-width: 480px) {
  .ai-fund-analyst-ct {
    padding: 0.5rem;
  }
  
  .form-section {
    padding: 1rem;
  }
  
  .report-section {
    padding: 0.75rem;
  }
}
</style> 