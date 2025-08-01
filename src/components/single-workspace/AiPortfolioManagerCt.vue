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
            
            <!-- Custom tab label with context menu, edit, and close icon -->
            <template #label>
              <span 
                @contextmenu.prevent="showContextMenu($event, portfolio)"
                @dblclick.stop="editPortfolioName(portfolio)"
                class="tab-label">
                <span class="tab-text">
                  {{ portfolio.name }}
                  <span class="tab-count">({{ getPortfolioSpreadsheetCount(portfolio.id) }})</span>
                  <!-- Dropdown menu for portfolio actions -->
                  <el-dropdown 
                    @command="handlePortfolioAction" 
                    trigger="click"
                    @click.stop>
                    <el-icon class="tab-dropdown-icon">
                      <MoreFilled />
                    </el-icon>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item 
                          :command="{ action: 'edit', portfolio: portfolio }"
                          @click.stop>
                          <el-icon><Edit /></el-icon>
                          Edit portfolio name
                        </el-dropdown-item>
                        <el-dropdown-item 
                          v-if="portfolios.length > 1"
                          :command="{ action: 'delete', portfolio: portfolio }"
                          @click.stop
                          divided>
                          <el-icon><Delete /></el-icon>
                          Delete portfolio
                        </el-dropdown-item>
                        <el-dropdown-item 
                          @click.stop
                          divided>
                          <el-checkbox 
                            :model-value="getPortfolioReadonlyState(portfolio.id)" 
                            @change="handleReadonlyChange(portfolio.id, $event)"
                            @click.stop>
                            Readonly
                          </el-checkbox>
                        </el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </span>
              </span>
            </template>
            
            <!-- Portfolio Content - Compact Design -->
            <div class="portfolio-content">
              <!-- Spreadsheet Instances for this Portfolio -->
              <div class="spreadsheets-container">
                <SpreadsheetInstance
                  v-for="spreadsheet in getPortfolioSpreadsheets(portfolio.id)"
                  :key="`${spreadsheet.id}-${getPortfolioReadonlyState(portfolio.id)}`"
                  :spreadsheet-id="spreadsheet.id"
                  :spreadsheet-name="spreadsheet.name"
                  :initial-rows="spreadsheet.rows"
                  :initial-columns="spreadsheet.columns"
                  :can-remove="getPortfolioSpreadsheets(portfolio.id).length > 1"
                  :matter-id="currentMatterId"
                  :portfolio-id="portfolio.id"
                  :readonly="getPortfolioReadonlyState(portfolio.id)"
                  @remove-spreadsheet="removeSpreadsheet"
                />
              </div>
              
              <!-- Add Spreadsheet Button (compact design) -->
              <div class="add-spreadsheet-section">
                <el-button 
                  type="primary" 
                  @click="showAddSpreadsheetDialog(portfolio.id)"
                  size="default"
                  class="add-spreadsheet-btn">
                  <el-icon><Plus /></el-icon>
                  Add Spreadsheet
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
      
      <!-- Context Menu for Portfolio Management -->
      <div 
        v-if="contextMenuVisible" 
        :style="{ left: contextMenuX + 'px', top: contextMenuY + 'px' }"
        class="context-menu"
        @click.stop>
        <div class="context-menu-item" @click="editPortfolioName(selectedPortfolio)">
          <el-icon><Edit /></el-icon>
          Rename Portfolio
        </div>
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
    
    <!-- Edit Portfolio Name Dialog -->
    <el-dialog
      v-model="editPortfolioDialogVisible"
      title="Rename Portfolio"
      width="400px"
      :close-on-click-modal="false"
      @close="editingPortfolio = null">
      <el-form 
        :model="editPortfolioForm" 
        :rules="portfolioFormRules"
        ref="editPortfolioFormRef"
        label-width="120px">
        <el-form-item label="Portfolio Name" prop="name">
          <el-input 
            v-model="editPortfolioForm.name" 
            placeholder="Enter new portfolio name"
            :maxlength="50"
            show-word-limit
            @keyup.enter="updatePortfolioName" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="editPortfolioDialogVisible = false; editingPortfolio = null">Cancel</el-button>
          <el-button 
            type="primary" 
            @click="updatePortfolioName"
            :loading="updatingPortfolio">
            Update Name
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
import { ref, onMounted, computed, onBeforeUnmount } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Delete, Folder, Edit, Close, MoreFilled } from '@element-plus/icons-vue';
import SpreadsheetInstance from './SpreadsheetInstance.vue';
import { supabase } from '../../supabase';
import { useMatterStore } from '../../store/matter';
import { storeToRefs } from 'pinia';
import { setWorkspaceTitle, setComponentTitle } from '../../utils/page-title';

export default {
  name: 'AiPortfolioManagerCt',
  components: {
    SpreadsheetInstance,
    Plus,
    Delete,
    Folder,
    Edit,
    Close,
    MoreFilled
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
    
    // Readonly state for portfolios
    const portfolioReadonlyState = ref({}); // Store readonly state for each portfolio
    
    // Load portfolio view mode preferences from Supabase
    const loadPortfolioViewModePreferences = async () => {
      if (!currentMatterId.value) {
        console.warn('⚠️ No current matter ID, cannot load portfolio preferences');
        return;
      }

      try {
        console.log(`🔍 Loading portfolio view mode preferences for workspace ${currentMatterId.value}...`);
        const { data: user } = await supabase.auth.getUser();
        
        if (!user?.user?.id) {
          console.warn('⚠️ No user found, using default view mode preferences');
          return;
        }
        
        const { data, error } = await supabase
          .from('ai_portfolio_settings')
          .select('portfolio_id, view_mode')
          .eq('user_id', user.user.id)
          .eq('matter_id', currentMatterId.value);
        
        if (error) {
          console.error('Error loading portfolio view mode preferences:', error);
          return;
        }
        
        // Convert array to object for easier lookup
        const preferences = {};
        if (data && data.length > 0) {
          data.forEach(setting => {
            preferences[setting.portfolio_id] = setting.view_mode;
          });
          console.log(`✅ Loaded ${data.length} portfolio view mode preferences:`, preferences);
        } else {
          console.log('ℹ️ No portfolio view mode preferences found, will use defaults (readonly mode)');
        }
        
        portfolioReadonlyState.value = preferences;
      } catch (error) {
        console.error('Error loading portfolio view mode preferences:', error);
      }
    };
    
    // Save portfolio view mode preference to Supabase
    const savePortfolioViewModePreference = async (portfolioId, isReadonly) => {
      if (!currentMatterId.value) {
        console.warn('⚠️ No current matter ID, cannot save portfolio preference');
        return;
      }

      try {
        console.log(`💾 Saving portfolio view mode preference for ${portfolioId}: ${isReadonly ? 'readonly' : 'edit'}`);
        const { data: user } = await supabase.auth.getUser();
        
        if (!user?.user?.id) {
          console.warn('⚠️ No user found, cannot save preference');
          return;
        }
        
        // First try to update existing record
        const { data: updateData, error: updateError } = await supabase
          .from('ai_portfolio_settings')
          .update({
            view_mode: isReadonly,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.user.id)
          .eq('matter_id', currentMatterId.value)
          .eq('portfolio_id', portfolioId)
          .select();
        
        if (updateError) {
          console.error('Error updating portfolio view mode preference:', updateError);
          throw updateError;
        }
        
        // If no rows were updated, insert a new record
        if (!updateData || updateData.length === 0) {
          console.log('📝 No existing preference found, creating new record...');
          const { error: insertError } = await supabase
            .from('ai_portfolio_settings')
            .insert({
              user_id: user.user.id,
              matter_id: currentMatterId.value,
              portfolio_id: portfolioId,
              view_mode: isReadonly,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          
          if (insertError) {
            console.error('Error inserting portfolio view mode preference:', insertError);
            throw insertError;
          }
          
          console.log('✅ Created new preference record');
        } else {
          console.log('✅ Updated existing preference record');
        }
        
        // Update local state
        portfolioReadonlyState.value = {
          ...portfolioReadonlyState.value,
          [portfolioId]: isReadonly
        };
        
        console.log(`✅ Successfully saved view mode preference for portfolio ${portfolioId}: ${isReadonly ? 'readonly' : 'edit'}`);
      } catch (error) {
        console.error('Failed to save portfolio view mode preference:', error);
        // Don't throw error to avoid disrupting the user experience
      }
    };
    
    // Computed function to get readonly state for a portfolio
    const getPortfolioReadonlyState = (portfolioId) => {
      // Use the stored preference if it exists, otherwise default to readonly mode (true)
      const readonlyState = portfolioReadonlyState.value[portfolioId] !== undefined 
        ? portfolioReadonlyState.value[portfolioId] 
        : true; // Default to readonly mode
      console.log(`🔍 Getting readonly state for portfolio ${portfolioId}:`, readonlyState);
      return readonlyState;
    };
    
    // Dialog states
    const addPortfolioDialogVisible = ref(false);
    const editPortfolioDialogVisible = ref(false);
    const addSpreadsheetDialogVisible = ref(false);
    const addingPortfolio = ref(false);
    const updatingPortfolio = ref(false);
    const addingSpreadsheet = ref(false);
    const targetPortfolioId = ref(''); // For adding spreadsheets to specific portfolio
    
    // Context menu states
    const contextMenuVisible = ref(false);
    const contextMenuX = ref(0);
    const contextMenuY = ref(0);
    const selectedPortfolio = ref(null);
    const editingPortfolio = ref(null); // Separate variable for portfolio being edited
    
    // Form refs
    const portfolioFormRef = ref(null);
    const editPortfolioFormRef = ref(null);
    const spreadsheetFormRef = ref(null);
    
    // Form for adding new portfolio
    const newPortfolioForm = ref({
      name: ''
    });
    
    // Form for editing portfolio name
    const editPortfolioForm = ref({
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

    // Context menu management
    const showContextMenu = (event, portfolio) => {
      event.preventDefault();
      selectedPortfolio.value = portfolio;
      contextMenuX.value = event.clientX;
      contextMenuY.value = event.clientY;
      contextMenuVisible.value = true;
    };
    
    const hideContextMenu = () => {
      contextMenuVisible.value = false;
      selectedPortfolio.value = null;
    };
    
    // Edit portfolio name
    const editPortfolioName = (portfolio) => {
      hideContextMenu();
      editPortfolioForm.value.name = portfolio.name;
      editingPortfolio.value = portfolio;
      editPortfolioDialogVisible.value = true;
    };
    
    // Handle portfolio actions from dropdown menu
    const handlePortfolioAction = (command) => {
      const { action, portfolio } = command;
      
      switch (action) {
        case 'edit':
          editPortfolioName(portfolio);
          break;
        case 'delete':
          deletePortfolio(portfolio.id);
          break;
        default:
          console.warn('Unknown portfolio action:', action);
      }
    };
    
    // Update portfolio name
    const updatePortfolioName = async () => {
      if (!currentMatterId.value || !editingPortfolio.value) {
        ElMessage.error('No workspace or portfolio selected');
        return;
      }
      
      try {
        if (!editPortfolioFormRef.value) {
          ElMessage.error('Form validation failed');
          return;
        }
        
        const valid = await editPortfolioFormRef.value.validate();
        if (!valid) return;
        
        updatingPortfolio.value = true;
        
        // Check for duplicate names
        const isDuplicate = portfolios.value.some(portfolio => 
          portfolio.id !== editingPortfolio.value.id &&
          portfolio.name.toLowerCase() === editPortfolioForm.value.name.toLowerCase()
        );
        
        if (isDuplicate) {
          ElMessage.error('A portfolio with this name already exists');
          updatingPortfolio.value = false;
          return;
        }
        
        // Update in database
        const { error } = await supabase
          .from('portfolio_data')
          .update({ 
            portfolio_name: editPortfolioForm.value.name,
            updated_by: (await supabase.auth.getUser()).data.user?.id
          })
          .eq('portfolio_id', editingPortfolio.value.id)
          .eq('matter_id', currentMatterId.value);

        if (error) throw error;
        
        // Update local state
        const portfolioIndex = portfolios.value.findIndex(p => p.id === editingPortfolio.value.id);
        if (portfolioIndex > -1) {
          portfolios.value[portfolioIndex].name = editPortfolioForm.value.name;
          portfolios.value[portfolioIndex].lastUpdated = new Date().toLocaleDateString();
        }
        
        ElMessage.success(`Portfolio renamed to "${editPortfolioForm.value.name}" successfully!`);
        
        // Update page title if this was the active portfolio (check before clearing)
        if (editingPortfolio.value && editingPortfolio.value.id === activePortfolioId.value) {
          updatePageTitle();
        }
        
        editPortfolioDialogVisible.value = false;
        editingPortfolio.value = null; // Clear the editing portfolio
        
      } catch (error) {
        console.error('Error updating portfolio name:', error);
        ElMessage.error('Failed to update portfolio name: ' + error.message);
      } finally {
        updatingPortfolio.value = false;
      }
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

        // Process spreadsheets and assign to portfolios
        if (spreadsheetData && spreadsheetData.length > 0) {
          // Create a map to track the latest record for each spreadsheet_id
          const uniqueSpreadsheets = new Map();
          
          spreadsheetData.forEach(sheet => {
            const spreadsheetId = sheet.spreadsheet_id;
            if (spreadsheetId && !uniqueSpreadsheets.has(spreadsheetId)) {
              // Only add the first occurrence (latest due to DESC order) of each spreadsheet_id
              uniqueSpreadsheets.set(spreadsheetId, sheet);
            }
          });
          
          // Convert map values to array
          const uniqueSpreadsheetArray = Array.from(uniqueSpreadsheets.values());
          
          spreadsheets.value = uniqueSpreadsheetArray.map(sheet => ({
            id: sheet.spreadsheet_id,
            name: sheet.name || 'Spreadsheet',
            rows: 10,
            columns: 10,
            portfolioId: sheet.portfolio_id || portfolios.value[0]?.id, // Assign to first portfolio if no portfolio_id
            createdAt: new Date(sheet.created_at)
          }));
          
          console.log(`📊 Loaded ${spreadsheets.value.length} unique spreadsheets (from ${spreadsheetData.length} total records)`);
        } else {
          // Create default spreadsheet in first portfolio
          if (portfolios.value.length > 0) {
            await createDefaultSpreadsheet(portfolios.value[0].id);
          }
        }

        // Process portfolios
        if (portfolioData && portfolioData.length > 0) {
          portfolios.value = portfolioData.map(portfolio => ({
            id: portfolio.portfolio_id,
            name: portfolio.portfolio_name,
            createdAt: new Date(portfolio.created_at),
            lastUpdated: new Date(portfolio.updated_at).toLocaleDateString(),
            isReadonly: portfolio.is_readonly !== undefined ? portfolio.is_readonly : false // Default to edit mode
          }));
          
          console.log(`📊 Loaded ${portfolios.value.length} portfolios`);
        } else {
          // Create default portfolio
          await createDefaultPortfolio();
        }

        // Load view mode preferences after portfolios are loaded
        await loadPortfolioViewModePreferences();

        // Set active portfolio to first one
        if (portfolios.value.length > 0) {
          activePortfolioId.value = portfolios.value[0].id;
          // Update page title now that we have an active portfolio
          updatePageTitle();
        }

        console.log(`✅ Portfolios initialized: ${portfolios.value.length} portfolios, ${spreadsheets.value.length} spreadsheets`);
        console.log(`✅ View mode preferences loaded:`, portfolioReadonlyState.value);
        
        // Ensure page title is updated even if no portfolios were set as active
        if (portfolios.value.length === 0) {
          updatePageTitle();
        }
        
      } catch (error) {
        console.error('Error initializing portfolios:', error);
        ElMessage.error('Failed to load portfolios: ' + error.message);
        // Update page title even on error to show workspace name
        updatePageTitle();
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
          lastUpdated: 'Just created',
          isReadonly: false // Default to edit mode
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
      updatePageTitle();
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
          lastUpdated: 'Just created',
          isReadonly: false // Default to edit mode
        };
        
        portfolios.value.push(newPortfolio);
        
        // Create default spreadsheet in new portfolio
        await createDefaultSpreadsheet(portfolioId);
        
        // Switch to new portfolio
        activePortfolioId.value = portfolioId;
        
        console.log(`📊 Added new portfolio: ${newPortfolio.name} (${portfolioId})`);
        ElMessage.success(`Portfolio "${newPortfolio.name}" created successfully!`);
        
        // Update page title for the new active portfolio
        updatePageTitle();
        
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
        
        // Clean up readonly state
        const { [portfolioId]: removed, ...remainingReadonlyState } = portfolioReadonlyState.value;
        portfolioReadonlyState.value = remainingReadonlyState;
        
        // Switch to first portfolio if deleted was active
        if (activePortfolioId.value === portfolioId && portfolios.value.length > 0) {
          activePortfolioId.value = portfolios.value[0].id;
          updatePageTitle();
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

    // Function to update page title
    const updatePageTitle = () => {
      const workspaceName = currentMatter.value?.title || 'Workspace';
      
      // Get the active portfolio name for the component-specific part
      let portfolioName = undefined;
      if (activePortfolioId.value && portfolios.value.length > 0) {
        const activePortfolio = portfolios.value.find(p => p.id === activePortfolioId.value);
        portfolioName = activePortfolio?.name;
      }
      
      // Use setComponentTitle to include the portfolio name
      setComponentTitle('AI Portfolio', workspaceName, portfolioName);
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
            portfolioReadonlyState.value = {}; // Clear previous preferences
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

    // Watch for activePortfolioId changes to update title
    const watchActivePortfolio = () => {
      return computed(() => {
        // Update page title when active portfolio changes
        if (activePortfolioId.value) {
          updatePageTitle();
        }
        return activePortfolioId.value;
      });
    };

    // Handle readonly state change for a portfolio
    const handleReadonlyChange = async (portfolioId, checked) => {
      console.log(`🔄 handleReadonlyChange called for portfolio ${portfolioId} with checked=${checked}`);
      
      if (!currentMatterId.value) {
        ElMessage.error('No workspace selected');
        return;
      }

      try {
        // Update the local state first and trigger reactivity
        portfolioReadonlyState.value = {
          ...portfolioReadonlyState.value,
          [portfolioId]: checked
        };
        
        console.log(`✅ Updated readonly state for portfolio ${portfolioId}:`, portfolioReadonlyState.value);
        
        await savePortfolioViewModePreference(portfolioId, checked);
        
        const portfolioName = portfolios.value.find(p => p.id === portfolioId)?.name || 'Portfolio';
        ElMessage.success(`Portfolio "${portfolioName}" is now ${checked ? 'Readonly' : 'Editable'}.`);
      } catch (error) {
        console.error('Error updating portfolio readonly state:', error);
        ElMessage.error('Failed to update portfolio readonly state: ' + error.message);
        // Revert the local state if the database update failed
        portfolioReadonlyState.value = {
          ...portfolioReadonlyState.value,
          [portfolioId]: !checked
        };
      }
    };


    // Initialize component
    onMounted(async () => {
      const matterWatcher = watchMatterChanges();
      matterWatcher.value;
      
      const portfolioWatcher = watchActivePortfolio();
      portfolioWatcher.value;
      
      // Add event listener for context menu
      document.addEventListener('click', hideContextMenu);
      document.addEventListener('contextmenu', hideContextMenu);
       
      console.log('✅ AI Portfolio Manager with Portfolio Tabs initialized!');
    });

    onBeforeUnmount(() => {
      document.removeEventListener('click', hideContextMenu);
      document.removeEventListener('contextmenu', hideContextMenu);
    });

    return {
      currentMatter,
      currentMatterId,
      portfolios,
      activePortfolioId,
      spreadsheets,
      addPortfolioDialogVisible,
      editPortfolioDialogVisible,
      addSpreadsheetDialogVisible,
      addingPortfolio,
      updatingPortfolio,
      addingSpreadsheet,
      targetPortfolioId,
      contextMenuVisible,
      contextMenuX,
      contextMenuY,
      selectedPortfolio,
      editingPortfolio,
      portfolioReadonlyState,
      portfolioFormRef,
      editPortfolioFormRef,
      spreadsheetFormRef,
      newPortfolioForm,
      editPortfolioForm,
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
      removeSpreadsheet,
      showContextMenu,
      hideContextMenu,
      editPortfolioName,
      updatePortfolioName,
      handlePortfolioAction,
      handleReadonlyChange,
      getPortfolioReadonlyState
    };
  },
};
</script>

<style scoped>
.portfolio-manager-wrapper {
  /*width: 100%;*/
  min-height: calc(100vh - 40px);
  background: #f8fafc;
  padding: 12px;
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

/* Portfolio Tabs - Compact Design */
.portfolio-tabs-container {
  background: white;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  overflow: hidden;
  position: relative;
}

.portfolio-tabs {
  background: white;
}

/* Tab Labels with Context Menu */
.tab-label {
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  user-select: none;
  width: 100%;
}

.tab-text {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
}

.tab-count {
  font-size: 12px;
  color: #94a3b8;
  font-weight: 500;
}

.tab-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.tab-edit-icon {
  font-size: 12px;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 3px;
  padding: 2px;
  opacity: 1;
}

.tab-label:hover .tab-edit-icon {
  opacity: 0.7;
}

.tab-edit-icon:hover {
  color: #667eea;
  background: rgba(102, 126, 234, 0.1);
  opacity: 1 !important;
  transform: scale(1.1);
}

.tab-close-icon {
  font-size: 14px;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 4px;
  padding: 2px;
  opacity: 0.7;
}

.tab-close-icon:hover {
  color: #dc2626;
  background: rgba(220, 38, 38, 0.1);
  opacity: 1;
  transform: scale(1.1);
}

.tab-dropdown-icon {
  font-size: 12px;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 3px;
  padding: 2px;
  opacity: 0.7;
  margin-left: 4px;
}

.tab-dropdown-icon:hover {
  color: #667eea;
  background: rgba(102, 126, 234, 0.1);
  opacity: 1;
  transform: scale(1.1);
}

/* Context Menu */
.context-menu {
  position: fixed;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 8px 25px rgba(0,0,0,0.15);
  z-index: 9999;
  min-width: 160px;
  padding: 4px 0;
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 14px;
  color: #374151;
  transition: all 0.2s ease;
}

.context-menu-item:hover {
  background: #f3f4f6;
  color: #1f2937;
}

.context-menu-item.danger {
  color: #dc2626;
}

.context-menu-item.danger:hover {
  background: #fef2f2;
  color: #b91c1c;
}

.context-menu-item .el-icon {
  font-size: 16px;
}

/* Add Portfolio Button Container */
.add-portfolio-button-container {
  position: absolute;
  top: 4px;
  right: 16px;
  z-index: 10;
}

/* Portfolio Content - Compact Design */
.portfolio-content {
  min-height: auto;
}

/* Spreadsheets Container - Compact */
.spreadsheets-container {
  margin-bottom: 20px;
}

/* Add Spreadsheet Section - Compact */
.add-spreadsheet-section {
  display: flex;
  justify-content: center;
  padding: 20px 0;
  border-top: 1px dashed #cbd5e1;
  margin-top: 16px;
}

.add-spreadsheet-btn {
  padding: 12px 24px;
  font-size: 14px;
  font-weight: 600;
  border-radius: 6px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  color: white;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

.add-spreadsheet-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

/* Add Portfolio Button */
.add-portfolio-btn {
  background: none !important;
  border: none !important;
  padding: 6px !important;
  font-size: 14px !important;
  color: #667eea !important;
  transition: all 0.3s ease;
}

.add-portfolio-btn:hover {
  color: #4f46e5 !important;
  background: rgba(102, 126, 234, 0.1) !important;
  transform: scale(1.05);
}

/* Tab Styling Overrides - Compact */
:deep(.el-tabs__header) {
  margin: 0;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

/*:deep(.el-tabs__nav-wrap) {
  padding: 0 16px;
}*/

:deep(.el-tabs__item) {
  font-weight: 600;
  font-size: 14px;
  color: #64748b;
  border: none;
  background: transparent;
  transition: all 0.3s ease;
  padding: 12px 16px;
}

:deep(.el-tabs__item.is-active) {
  color: #667eea;
  background: white;
  border-radius: 6px 6px 0 0;
  box-shadow: 0 -2px 6px rgba(0,0,0,0.08);
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

/* Responsive adjustments - Compact */
@media (max-width: 768px) {
  .portfolio-manager-wrapper {
    padding: 6px;
  }
  
  .portfolio-content {
    padding: 12px;
  }
  
  .add-spreadsheet-btn {
    width: 100%;
    padding: 10px 20px;
    font-size: 14px;
  }
  
  .add-spreadsheet-section {
    padding: 16px 0;
  }
  
  :deep(.el-tabs__nav-wrap) {
    padding: 0 12px;
  }
  
  :deep(.el-tabs__item) {
    padding: 10px 12px;
    font-size: 13px;
  }
  
  .add-portfolio-button-container {
    top: 4px;
    right: 12px;
  }
}

@media (max-width: 480px) {
  .portfolio-manager-wrapper {
    padding: 4px;
  }
  
  .portfolio-content {
    padding: 8px;
  }
  
  .tab-count {
    display: none; /* Hide count on very small screens */
  }
  
  .tab-edit-icon {
    font-size: 10px;
    padding: 1px;
    opacity: 0.8 !important; /* Always visible on mobile */
  }
  
  .tab-close-icon {
    font-size: 12px;
    padding: 1px;
  }
  
  .tab-dropdown-icon {
    font-size: 10px;
    padding: 1px;
    opacity: 0.8 !important; /* Always visible on mobile */
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
  
  .tab-count {
    color: #64748b;
  }
  
  .tab-edit-icon {
    color: #64748b;
  }
  
  .tab-edit-icon:hover {
    color: #a5b4fc;
    background: rgba(165, 180, 252, 0.1);
  }
  
  .tab-close-icon {
    color: #64748b;
  }
  
  .tab-close-icon:hover {
    color: #f87171;
    background: rgba(248, 113, 113, 0.1);
  }
  
  .tab-dropdown-icon {
    color: #64748b;
  }
  
  .tab-dropdown-icon:hover {
    color: #a5b4fc;
    background: rgba(165, 180, 252, 0.1);
  }
  
  .context-menu {
    background: #1e293b;
    border-color: #334155;
  }
  
  .context-menu-item {
    color: #e2e8f0;
  }
  
  .context-menu-item:hover {
    background: #374151;
    color: #f3f4f6;
  }
  
  .context-menu-item.danger {
    color: #f87171;
  }
  
  .context-menu-item.danger:hover {
    background: #450a0a;
    color: #dc2626;
  }
  
  .add-spreadsheet-section {
    border-color: #475569;
  }
}
</style>

<style>
.matter-content.matter-content--ai-portfolio {
    padding: 0;
}
</style>