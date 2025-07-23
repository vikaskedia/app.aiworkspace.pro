  <template>
    <div class="portfolio-manager-wrapper">
      <!-- ✨ Enhanced AI Portfolio Manager with Portfolio Tabs:
           
           📊 Portfolio Tab Structure:
           - Each tab represents a portfolio (e.g., "Portfolio 1", "Tech Stocks")
           - Start with one default portfolio called "Portfolio 1"
           - + button to add more portfolios with tooltip
           
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
           
           📊 Multiple Spreadsheets per Portfolio:
           - Each portfolio can have unlimited spreadsheets
           - Each spreadsheet has independent data and formatting
           - Individual save/load functionality per spreadsheet
           
           💾 Enhanced Save System captures ALL Univer features! -->
     
      <!-- Portfolio Tabs -->
      <div class="portfolio-tabs-container" v-if="currentMatter">
        <el-tabs 
          v-model="activePortfolioId" 
          type="card" 
          class="portfolio-tabs"
          @tab-change="handlePortfolioChange">
          
          <!-- Portfolio Tab -->
          <el-tab-pane 
            v-for="portfolio in portfolios" 
            :key="portfolio.id"
            :label="portfolio.name" 
            :name="portfolio.id">
            
            <!-- Portfolio Content -->
            <div class="portfolio-content">
              <!-- Portfolio Header -->
              <div class="portfolio-header">
                <div class="portfolio-info">
                  <h2 class="portfolio-title">{{ portfolio.name }}</h2>
                  <p class="portfolio-meta">
                    {{ getPortfolioSpreadsheetCount(portfolio.id) }} spreadsheet(s) • 
                    Last updated {{ portfolio.lastUpdated || 'Never' }}
                  </p>
                </div>
                <div class="portfolio-actions">
                  <el-button 
                    type="danger" 
                    size="small"
                    @click="deletePortfolio(portfolio.id)"
                    v-if="portfolios.length > 1">
                    <el-icon><Delete /></el-icon>
                    Delete Portfolio
                  </el-button>
                </div>
              </div>
              
              <!-- Spreadsheet Instances for this Portfolio -->
              <div class="spreadsheets-container">
                <SpreadsheetInstance
                  v-for="spreadsheet in getPortfolioSpreadsheets(portfolio.id)"
                  :key="spreadsheet.id"
                  :spreadsheet-id="spreadsheet.id"
                  :spreadsheet-name="spreadsheet.name"
                  :initial-rows="spreadsheet.rows"
                  :initial-columns="spreadsheet.columns"
                  :can-remove="getPortfolioSpreadsheets(portfolio.id).length > 1"
                  :matter-id="currentMatterId"
                  :portfolio-id="portfolio.id"
                  @remove-spreadsheet="removeSpreadsheet"
                />
              </div>
              
              <!-- Add Spreadsheet Button (at bottom of each portfolio) -->
              <div class="add-spreadsheet-section">
                <el-button 
                  type="primary" 
                  @click="showAddSpreadsheetDialog(portfolio.id)"
                  size="large"
                  class="add-spreadsheet-btn">
                  <el-icon><Plus /></el-icon>
                  Add spreadsheet to {{ portfolio.name }}
                </el-button>
              </div>
            </div>
          </el-tab-pane>
          
        </el-tabs>
        
        <!-- Add Portfolio Button (floating next to tabs) -->
        <div class="add-portfolio-button-container">
          <el-tooltip content="Add a new portfolio" placement="top">
            <el-button 
              type="text" 
              @click="showAddPortfolioDialog"
              class="add-portfolio-btn">
              <el-icon><Plus /></el-icon>
            </el-button>
          </el-tooltip>
        </div>
      </div>

      <!-- No Workspace Warning -->
      <div v-else class="no-workspace-container">
        <el-alert
          title="No Workspace Selected"
          description="Please select a workspace to manage your portfolios."
          type="warning"
          :closable="false"
          show-icon
          class="no-workspace-warning" />
      </div>
      
      <!-- Add Portfolio Dialog -->
      <el-dialog
        v-model="addPortfolioDialogVisible"
        title="Add New Portfolio"
        width="400px"
        :close-on-click-modal="false">
        <el-form 
          :model="newPortfolioForm" 
          :rules="portfolioFormRules"
          ref="portfolioFormRef"
          label-width="120px">
          <el-form-item label="Portfolio Name" prop="name">
            <el-input 
              v-model="newPortfolioForm.name" 
              placeholder="Enter portfolio name (e.g., Tech Stocks, Real Estate)"
              :maxlength="50"
              show-word-limit
              @keyup.enter="addNewPortfolio" />
          </el-form-item>
        </el-form>
        <template #footer>
          <span class="dialog-footer">
            <el-button @click="addPortfolioDialogVisible = false">Cancel</el-button>
            <el-button 
              type="primary" 
              @click="addNewPortfolio"
              :loading="addingPortfolio">
              Create Portfolio
            </el-button>
          </span>
        </template>
      </el-dialog>
    
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
import { Plus, Delete, Folder } from '@element-plus/icons-vue';
import SpreadsheetInstance from './SpreadsheetInstance.vue';
import { supabase } from '../../supabase';
import { useMatterStore } from '../../store/matter';
import { storeToRefs } from 'pinia';

export default {
  name: 'AiPortfolioManagerCt',
  components: {
    SpreadsheetInstance,
    Plus,
    Delete,
    Folder
  },
  setup() {
    // Matter store for workspace context
    const matterStore = useMatterStore();
    const { currentMatter } = storeToRefs(matterStore);
    
    // Computed matter ID for workspace filtering
    const currentMatterId = computed(() => currentMatter.value?.id);
    
    // Portfolio management
    const portfolios = ref([]);
    const activePortfolioId = ref('');
    const spreadsheets = ref([]); // All spreadsheets across all portfolios
    
    // Dialog states
    const addPortfolioDialogVisible = ref(false);
    const addSpreadsheetDialogVisible = ref(false);
    const addingPortfolio = ref(false);
    const addingSpreadsheet = ref(false);
    const targetPortfolioId = ref(''); // For adding spreadsheets to specific portfolio
    
    // Form refs
    const portfolioFormRef = ref(null);
    const spreadsheetFormRef = ref(null);
    
    // Form for adding new portfolio
    const newPortfolioForm = ref({
      name: ''
    });
    
    // Form for adding new spreadsheet
    const newSpreadsheetForm = ref({
      name: '',
      rows: 10,
      columns: 10
    });
    
    // Form validation rules
    const portfolioFormRules = {
      name: [
        { required: true, message: 'Please enter a portfolio name', trigger: 'blur' },
        { min: 1, max: 50, message: 'Name should be 1 to 50 characters', trigger: 'blur' }
      ]
    };
    
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

    // Generate unique IDs
    const generatePortfolioId = () => {
      return 'portfolio_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    };
    
    const generateSpreadsheetId = () => {
      return 'sheet_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    };
    
    // Get spreadsheets for a specific portfolio
    const getPortfolioSpreadsheets = (portfolioId) => {
      return spreadsheets.value.filter(sheet => sheet.portfolioId === portfolioId);
    };
    
    // Get spreadsheet count for a portfolio
    const getPortfolioSpreadsheetCount = (portfolioId) => {
      return getPortfolioSpreadsheets(portfolioId).length;
    };
    
    // Initialize portfolios and spreadsheets for current workspace
    const initializePortfolios = async () => {
      if (!currentMatterId.value) {
        console.warn('⚠️ No current matter selected, cannot load portfolios');
        return;
      }

      try {
        console.log(`📊 Loading portfolios for workspace ${currentMatterId.value}...`);
        
        // Load portfolios from portfolio_data table
        const { data: portfolioData, error: portfolioError } = await supabase
          .from('portfolio_data')
          .select('*')
          .eq('matter_id', currentMatterId.value)
          .order('created_at', { ascending: true });

        if (portfolioError) {
          console.warn('Error loading portfolios:', portfolioError);
        }

        // Load spreadsheets from ai_portfolio_data table
        const { data: spreadsheetData, error: spreadsheetError } = await supabase
          .from('ai_portfolio_data')
          .select('*')
          .eq('matter_id', currentMatterId.value)
          .not('spreadsheet_id', 'is', null)
          .order('created_at', { ascending: false });

        if (spreadsheetError) {
          console.warn('Error loading spreadsheets:', spreadsheetError);
        }

        // Process portfolios
        if (portfolioData && portfolioData.length > 0) {
          portfolios.value = portfolioData.map(portfolio => ({
            id: portfolio.portfolio_id,
            name: portfolio.portfolio_name,
            createdAt: new Date(portfolio.created_at),
            lastUpdated: new Date(portfolio.updated_at).toLocaleDateString()
          }));
          console.log(`📊 Loaded ${portfolios.value.length} portfolios`);
        } else {
          // Create default portfolio
          await createDefaultPortfolio();
        }

        // Process spreadsheets and assign to portfolios
        if (spreadsheetData && spreadsheetData.length > 0) {
          spreadsheets.value = spreadsheetData.map(sheet => ({
            id: sheet.spreadsheet_id,
            name: sheet.name || 'Spreadsheet',
            rows: 10,
            columns: 10,
            portfolioId: sheet.portfolio_id || portfolios.value[0]?.id, // Assign to first portfolio if no portfolio_id
            createdAt: new Date(sheet.created_at)
          }));
          console.log(`📊 Loaded ${spreadsheets.value.length} spreadsheets`);
        } else {
          // Create default spreadsheet in first portfolio
          if (portfolios.value.length > 0) {
            await createDefaultSpreadsheet(portfolios.value[0].id);
          }
        }

        // Set active portfolio to first one
        if (portfolios.value.length > 0) {
          activePortfolioId.value = portfolios.value[0].id;
        }

        console.log(`✅ Portfolios initialized: ${portfolios.value.length} portfolios, ${spreadsheets.value.length} spreadsheets`);
        
      } catch (error) {
        console.error('Error initializing portfolios:', error);
        ElMessage.error('Failed to load portfolios: ' + error.message);
      }
    };
    
    // Create default portfolio
    const createDefaultPortfolio = async () => {
      if (!currentMatterId.value) return;
      
      try {
        const portfolioId = generatePortfolioId();
        
        // Insert into portfolio_data table
        const { error } = await supabase
          .from('portfolio_data')
          .insert([{
            matter_id: currentMatterId.value,
            portfolio_id: portfolioId,
            portfolio_name: 'Portfolio 1',
            columns: [],
            data: [],
            created_by: (await supabase.auth.getUser()).data.user?.id,
            updated_by: (await supabase.auth.getUser()).data.user?.id
          }]);

        if (error) throw error;

        portfolios.value = [{
          id: portfolioId,
          name: 'Portfolio 1',
          createdAt: new Date(),
          lastUpdated: 'Just created'
        }];
        
        console.log(`✅ Created default portfolio: ${portfolioId}`);
      } catch (error) {
        console.error('Error creating default portfolio:', error);
        throw error;
      }
    };
    
    // Create default spreadsheet in a portfolio
    const createDefaultSpreadsheet = async (portfolioId) => {
      if (!currentMatterId.value || !portfolioId) return;
      
      try {
        const spreadsheetId = generateSpreadsheetId();
        
        const newSpreadsheet = {
          id: spreadsheetId,
          name: 'Spreadsheet 1',
          rows: 10,
          columns: 10,
          portfolioId: portfolioId,
          createdAt: new Date()
        };
        
        spreadsheets.value.push(newSpreadsheet);
        console.log(`✅ Created default spreadsheet in portfolio ${portfolioId}: ${spreadsheetId}`);
      } catch (error) {
        console.error('Error creating default spreadsheet:', error);
      }
    };
    
    // Handle portfolio tab change
    const handlePortfolioChange = (portfolioId) => {
      console.log(`🔄 Switched to portfolio: ${portfolioId}`);
      activePortfolioId.value = portfolioId;
    };
    
    // Show add portfolio dialog
    const showAddPortfolioDialog = () => {
      if (!currentMatterId.value) {
        ElMessage.warning('Please select a workspace first');
        return;
      }
      
      newPortfolioForm.value = { name: '' };
      addPortfolioDialogVisible.value = true;
    };
    
    // Add new portfolio
    const addNewPortfolio = async () => {
      if (!currentMatterId.value) {
        ElMessage.error('No workspace selected');
        return;
      }
      
      try {
        if (!portfolioFormRef.value) {
          ElMessage.error('Form validation failed');
          return;
        }
        
        const valid = await portfolioFormRef.value.validate();
        if (!valid) return;
        
        addingPortfolio.value = true;
        
        // Check for duplicate names
        const isDuplicate = portfolios.value.some(portfolio => 
          portfolio.name.toLowerCase() === newPortfolioForm.value.name.toLowerCase()
        );
        
        if (isDuplicate) {
          ElMessage.error('A portfolio with this name already exists');
          addingPortfolio.value = false;
          return;
        }
        
        const portfolioId = generatePortfolioId();
        const userId = (await supabase.auth.getUser()).data.user?.id;
        
        // Insert into portfolio_data table
        const { error } = await supabase
          .from('portfolio_data')
          .insert([{
            matter_id: currentMatterId.value,
            portfolio_id: portfolioId,
            portfolio_name: newPortfolioForm.value.name,
            columns: [],
            data: [],
            created_by: userId,
            updated_by: userId
          }]);

        if (error) throw error;
        
        // Add to local state
        const newPortfolio = {
          id: portfolioId,
          name: newPortfolioForm.value.name,
          createdAt: new Date(),
          lastUpdated: 'Just created'
        };
        
        portfolios.value.push(newPortfolio);
        
        // Create default spreadsheet in new portfolio
        await createDefaultSpreadsheet(portfolioId);
        
        // Switch to new portfolio
        activePortfolioId.value = portfolioId;
        
        console.log(`📊 Added new portfolio: ${newPortfolio.name} (${portfolioId})`);
        ElMessage.success(`Portfolio "${newPortfolio.name}" created successfully!`);
        
        addPortfolioDialogVisible.value = false;
        
      } catch (error) {
        console.error('Error adding portfolio:', error);
        ElMessage.error('Failed to add portfolio: ' + error.message);
      } finally {
        addingPortfolio.value = false;
      }
    };
    
    // Delete portfolio
    const deletePortfolio = async (portfolioId) => {
      if (!currentMatterId.value || portfolios.value.length <= 1) {
        ElMessage.warning('Cannot delete the last portfolio');
        return;
      }
      
      try {
        const portfolio = portfolios.value.find(p => p.id === portfolioId);
        if (!portfolio) return;
        
        await ElMessageBox.confirm(
          `Are you sure you want to delete "${portfolio.name}" and all its spreadsheets? This action cannot be undone.`,
          'Confirm Deletion',
          {
            confirmButtonText: 'Delete',
            cancelButtonText: 'Cancel',
            type: 'warning',
            confirmButtonClass: 'el-button--danger'
          }
        );
        
        // Delete from database
        const { error: portfolioError } = await supabase
          .from('portfolio_data')
          .delete()
          .eq('portfolio_id', portfolioId)
          .eq('matter_id', currentMatterId.value);

        if (portfolioError) throw portfolioError;
        
        // Delete spreadsheets from database
        const { error: spreadsheetError } = await supabase
          .from('ai_portfolio_data')
          .delete()
          .eq('portfolio_id', portfolioId)
          .eq('matter_id', currentMatterId.value);

        if (spreadsheetError) console.warn('Error deleting spreadsheets:', spreadsheetError);
        
        // Remove from local state
        portfolios.value = portfolios.value.filter(p => p.id !== portfolioId);
        spreadsheets.value = spreadsheets.value.filter(s => s.portfolioId !== portfolioId);
        
        // Switch to first portfolio if deleted was active
        if (activePortfolioId.value === portfolioId && portfolios.value.length > 0) {
          activePortfolioId.value = portfolios.value[0].id;
        }
        
        ElMessage.success(`Portfolio "${portfolio.name}" deleted successfully`);
        
      } catch (error) {
        if (error === 'cancel') return;
        console.error('Error deleting portfolio:', error);
        ElMessage.error('Failed to delete portfolio: ' + error.message);
      }
    };
    
    // Show add spreadsheet dialog
    const showAddSpreadsheetDialog = (portfolioId) => {
      if (!currentMatterId.value) {
        ElMessage.warning('Please select a workspace first');
        return;
      }
      
      targetPortfolioId.value = portfolioId;
      newSpreadsheetForm.value = {
        name: '',
        rows: 10,
        columns: 10
      };
      addSpreadsheetDialogVisible.value = true;
    };
    
    // Add new spreadsheet
    const addNewSpreadsheet = async () => {
      if (!currentMatterId.value || !targetPortfolioId.value) {
        ElMessage.error('No workspace or portfolio selected');
        return;
      }
      
      try {
        if (!spreadsheetFormRef.value) {
          ElMessage.error('Form validation failed');
          return;
        }
        
        const valid = await spreadsheetFormRef.value.validate();
        if (!valid) return;
        
        addingSpreadsheet.value = true;
        
        // Check for duplicate names within the portfolio
        const portfolioSpreadsheets = getPortfolioSpreadsheets(targetPortfolioId.value);
        const isDuplicate = portfolioSpreadsheets.some(sheet => 
          sheet.name.toLowerCase() === newSpreadsheetForm.value.name.toLowerCase()
        );
        
        if (isDuplicate) {
          ElMessage.error('A spreadsheet with this name already exists in this portfolio');
          addingSpreadsheet.value = false;
          return;
        }
        
        // Create new spreadsheet
        const newSpreadsheet = {
          id: generateSpreadsheetId(),
          name: newSpreadsheetForm.value.name,
          rows: newSpreadsheetForm.value.rows,
          columns: newSpreadsheetForm.value.columns,
          portfolioId: targetPortfolioId.value,
          createdAt: new Date()
        };
        
        spreadsheets.value.push(newSpreadsheet);
        
        const portfolio = portfolios.value.find(p => p.id === targetPortfolioId.value);
        console.log(`📊 Added new spreadsheet to portfolio ${portfolio?.name}: ${newSpreadsheet.name}`);
        ElMessage.success(`Spreadsheet "${newSpreadsheet.name}" added successfully!`);
        
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
        
        const portfolioSpreadsheets = getPortfolioSpreadsheets(spreadsheet.portfolioId);
        if (portfolioSpreadsheets.length <= 1) {
          ElMessage.warning('Cannot delete the last spreadsheet in a portfolio');
          return;
        }
        
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
        
        // Delete from database
        const { error } = await supabase
          .from('ai_portfolio_data')
          .delete()
          .eq('spreadsheet_id', spreadsheetId)
          .eq('matter_id', currentMatterId.value);

        if (error) throw error;
        
        // Remove from local state
        const index = spreadsheets.value.findIndex(s => s.id === spreadsheetId);
        if (index > -1) {
          spreadsheets.value.splice(index, 1);
          ElMessage.success(`Spreadsheet "${spreadsheet.name}" deleted successfully`);
        }
        
      } catch (error) {
        if (error === 'cancel') return;
        console.error('Error removing spreadsheet:', error);
        ElMessage.error('Failed to remove spreadsheet: ' + error.message);
      }
    };

    // Watch for matter changes and reload portfolios
    const watchMatterChanges = () => {
      let isInitialized = false;
      
      return computed(() => {
        if (currentMatter.value?.id) {
          const matterId = currentMatter.value.id;
          
          if (isInitialized) {
            console.log(`🔄 Matter changed to ${matterId}, reloading portfolios...`);
            portfolios.value = [];
            spreadsheets.value = [];
            activePortfolioId.value = '';
            initializePortfolios();
          } else {
            isInitialized = true;
            initializePortfolios();
          }
        } else {
          portfolios.value = [];
          spreadsheets.value = [];
          activePortfolioId.value = '';
        }
        
        return currentMatter.value?.id;
      });
    };

    // Initialize component
    onMounted(async () => {
      const matterWatcher = watchMatterChanges();
      matterWatcher.value;
      
      console.log('✅ AI Portfolio Manager with Portfolio Tabs initialized!');
    });

    return {
      currentMatter,
      currentMatterId,
      portfolios,
      activePortfolioId,
      spreadsheets,
      addPortfolioDialogVisible,
      addSpreadsheetDialogVisible,
      addingPortfolio,
      addingSpreadsheet,
      targetPortfolioId,
      portfolioFormRef,
      spreadsheetFormRef,
      newPortfolioForm,
      newSpreadsheetForm,
      portfolioFormRules,
      spreadsheetFormRules,
      getPortfolioSpreadsheets,
      getPortfolioSpreadsheetCount,
      handlePortfolioChange,
      showAddPortfolioDialog,
      addNewPortfolio,
      deletePortfolio,
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
  padding: 20px;
}

/* No Workspace Warning */
.no-workspace-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

.no-workspace-warning {
  max-width: 500px;
}

/* Portfolio Tabs */
.portfolio-tabs-container {
  background: white;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  overflow: hidden;
  position: relative;
}

.portfolio-tabs {
  background: white;
}

/* Add Portfolio Button Container */
.add-portfolio-button-container {
  position: absolute;
  top: 12px;
  right: 20px;
  z-index: 10;
}

/* Portfolio Content */
.portfolio-content {
  padding: 24px;
  min-height: 600px;
}

.portfolio-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 32px;
  padding-bottom: 20px;
  border-bottom: 2px solid #f1f5f9;
}

.portfolio-info {
  flex: 1;
}

.portfolio-title {
  margin: 0 0 8px 0;
  font-size: 28px;
  font-weight: 700;
  color: #1e293b;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.portfolio-meta {
  margin: 0;
  color: #64748b;
  font-size: 14px;
}

.portfolio-actions {
  display: flex;
  gap: 12px;
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

/* Add Portfolio Button */
.add-portfolio-btn {
  background: none !important;
  border: none !important;
  padding: 8px !important;
  font-size: 16px !important;
  color: #667eea !important;
  transition: all 0.3s ease;
}

.add-portfolio-btn:hover {
  color: #4f46e5 !important;
  background: rgba(102, 126, 234, 0.1) !important;
  transform: scale(1.1);
}

/* Tab Styling Overrides */
:deep(.el-tabs__header) {
  margin: 0;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

:deep(.el-tabs__nav-wrap) {
  padding: 0 20px;
}

:deep(.el-tabs__item) {
  font-weight: 600;
  font-size: 16px;
  color: #64748b;
  border: none;
  background: transparent;
  transition: all 0.3s ease;
}

:deep(.el-tabs__item.is-active) {
  color: #667eea;
  background: white;
  border-radius: 8px 8px 0 0;
  box-shadow: 0 -2px 8px rgba(0,0,0,0.1);
}

:deep(.el-tabs__item:hover) {
  color: #4f46e5;
}

:deep(.el-tabs__content) {
  padding: 0;
}

:deep(.el-tabs__nav-next),
:deep(.el-tabs__nav-prev) {
  color: #667eea;
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

.portfolio-content > * {
  animation: slideInUp 0.3s ease-out;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .portfolio-manager-wrapper {
    padding: 12px;
  }
  
  .portfolio-content {
    padding: 16px;
  }
  
  .portfolio-header {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }
  
  .portfolio-title {
    font-size: 24px;
  }
  
  .portfolio-actions {
    justify-content: center;
  }
  
  .add-spreadsheet-btn {
    width: 100%;
    padding: 14px 24px;
    font-size: 15px;
  }
  
  :deep(.el-tabs__nav-wrap) {
    padding: 0 12px;
  }
}

@media (max-width: 480px) {
  .portfolio-manager-wrapper {
    padding: 8px;
  }
  
  .portfolio-content {
    padding: 12px;
  }
  
  .portfolio-title {
    font-size: 22px;
  }
  
  .add-spreadsheet-section {
    padding: 24px 0;
  }
  
  :deep(.el-dialog) {
    width: 95% !important;
    margin: 0 auto;
  }
  
  :deep(.el-tabs__item) {
    font-size: 14px;
    padding: 0 12px;
  }
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .portfolio-manager-wrapper {
    background: #0f172a;
  }
  
  .portfolio-tabs-container {
    background: #1e293b;
    border-color: #334155;
  }
  
  .portfolio-content {
    background: #1e293b;
  }
  
  .portfolio-title {
    color: #f1f5f9;
  }
  
  .portfolio-meta {
    color: #94a3b8;
  }
  
  .add-spreadsheet-section {
    border-color: #475569;
  }
}
</style>