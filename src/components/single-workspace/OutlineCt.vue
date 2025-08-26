<template>
  <div class="outline-container">
    <!-- Page moved warning -->
    <el-alert
      title="Page Moved"
      type="warning"
      :closable="false"
      show-icon
      class="page-moved-alert">
      <template #default>
        This page has moved to 
        <a :href="getNewOutlineUrl()" target="_self" class="moved-link">
          {{ getNewOutlineUrl() }}
        </a>
      </template>
    </el-alert>

    <div style="display: none;">
      <div v-if="breadcrumbPath.length" class="outline-breadcrumbs">
        <template v-for="(node, idx) in breadcrumbPath" :key="node.id">
          <span v-if="idx > 0"> &gt; </span>
          <a
            :href="workspaceId ? '/single-workspace/' + workspaceId + '/outlines?focus=' + node.id : '#'"
            class="breadcrumb-link"
            @click.prevent="handleBreadcrumb(node, idx)"
            :style="{ fontWeight: idx === breadcrumbPath.length - 1 ? 'bold' : 'normal' }"
          >{{ getBreadcrumbText(node.text) }}</a>
        </template>
      </div>
      <div class="outline-header">
        <div class="outline-actions">
          <!-- Search Input -->
          <div class="search-container">
            <el-input
              v-model="searchQuery"
              placeholder="Search outline..."
              clearable
              @input="handleSearchInput"
              @clear="clearSearch"
              @keydown.esc="clearSearch"
              class="search-input"
              style="width: 250px; margin-right: 8px;"
            >
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>
            <span v-if="searchQuery && searchStats" class="search-stats">
              {{ searchStats.matches }} matches in {{ searchStats.items }} items
            </span>
          </div>
          
          <!--el-button 
            type="primary" 
            @click="saveOutline" 
            :loading="saving"
            :disabled="!hasChanges"
            style="margin-right: 8px;"
          >
            Save Outline (cmd+s)
          </el-button-->
          <el-tooltip content="Refresh outline from server" placement="bottom">
            <el-button 
              icon 
              @click="manualRefresh" 
              :loading="refreshing"
              style="margin-right: 8px;"
              :type="hasChanges ? 'warning' : 'default'"
            >
              <el-icon><Refresh /></el-icon>
            </el-button>
          </el-tooltip>
          <el-tooltip content="View outline version history" placement="bottom">
            <el-button 
              icon 
              @click="openHistoryDialog" 
              style="margin-right: 8px;"
            >
              <el-icon><Clock /></el-icon>
            </el-button>
          </el-tooltip>
        </div>
        <div class="sync-status">
          <el-tag 
            v-if="!hasChanges" 
            type="success" 
            size="small"
            effect="light"
          >
            ✅ Synced ({{ displayVersion }})
          </el-tag>
          <el-tag 
            v-else 
            type="warning" 
            size="small"
            effect="light"
          >
            📝 Unsaved changes
          </el-tag>
        </div>
      </div>
      <el-dialog v-model="historyDialogVisible" title="Outline Version History" width="700px">
        <el-table :data="versionHistory" style="width: 100%" v-loading="loadingHistory">
          <el-table-column prop="version" label="Version" width="80" />
          <el-table-column label="Saved At" width="250">
            <template #default="scope">
              {{ formatDate(scope.row.created_at) }}
            </template>
          </el-table-column>
          <el-table-column prop="creator_email" label="Created By" width="250" />
          <el-table-column label="Action" width="80">
            <template #default="scope">
              <el-button size="small" @click="viewVersion(scope.row)">View</el-button>
            </template>
          </el-table-column>
        </el-table>
        <template #footer>
          <el-button @click="historyDialogVisible = false">Close</el-button>
        </template>
      </el-dialog>

      <el-dialog v-model="viewVersionDialogVisible" title="Version Content" width="800px">
        <div v-if="selectedVersion" class="version-content">
          <div class="version-info">
            <p><strong>Version:</strong> {{ selectedVersion.version }}</p>
            <p><strong>Created By:</strong> {{ selectedVersion.creator_email }}</p>
            <p><strong>Created At:</strong> {{ formatDate(selectedVersion.created_at) }}</p>
          </div>
          <div class="version-outline">
            <ul class="outline-list">
              <OutlinePointsCt
                v-for="item in selectedVersion.content"
                :key="item.id"
                :item="item"
                :readonly="true"
                :collapsed="false"
                :is-node-collapsed="() => false"
                :check-version-before-edit="checkVersionBeforeEdit"
                :handle-version-conflict="handleVersionConflict"
              />
            </ul>
          </div>
        </div>
        <template #footer>
          <el-button @click="viewVersionDialogVisible = false">Close</el-button>
        </template>
      </el-dialog>
      
      <!-- Search Results Header -->
      <div v-if="searchQuery && searchQuery.trim()" class="search-results-header">
        <el-icon class="search-icon"><Search /></el-icon>
        <span class="search-results-text">
          Showing search results for "<strong>{{ searchQuery }}</strong>"
        </span>
        <el-button 
          text 
          type="primary" 
          @click="clearSearch"
          class="clear-search-btn"
        >
          Clear search
        </el-button>
      </div>
      
      <ul class="outline-list">
        <OutlinePointsCt
          v-for="item in getFocusedOutline()"
          :key="item.id"
          :item="item"
          :collapsed="isNodeCollapsed(item.id)"
          :is-node-collapsed="isNodeCollapsed"
          :check-version-before-edit="checkVersionBeforeEdit"
          :handle-version-conflict="handleVersionConflict"
          :search-query="searchQuery"
          @update="onOutlineUpdate"
          @move="handleMove"
          @delete="handleDelete"
          @drilldown="handleDrilldown"
          @navigate="handleNavigate"
          @indent="handleIndent"
          @outdent="handleOutdent"
          @add-sibling="handleAddSiblingRoot"
          @collapse-toggle="handleCollapseToggle"
        />
      </ul>
    </div>
  </div>
</template>

<script>
import { ref, watch, onMounted, onUnmounted, computed, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElNotification, ElMessageBox } from 'element-plus';
import { Clock, Refresh, Search } from '@element-plus/icons-vue';
import { supabase } from '../../supabase';
import OutlinePointsCt from './OutlinePointsCt.vue';
import { updateWorkspaceActivity } from '../../utils/workspaceActivity';
import { setOutlineTitle, getCleanText } from '../../utils/page-title';
import { useWorkspaceStore } from '../../store/workspace';

// Add debounce utility with cancellation support
function debounce(func, wait) {
  let timeout;
  const executedFunction = function(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
  
  executedFunction.cancel = function() {
    clearTimeout(timeout);
  };
  
  return executedFunction;
}

// Generate unique render ID for this tab
function generateRenderID() {
  return 'render_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

export default {
  name: 'OutlineCt',
  components: { OutlinePointsCt, Clock, Refresh, Search },
  setup() {
    const route = useRoute();
    const router = useRouter();
    const workspaceStore = useWorkspaceStore();
    const workspaceId = computed(() => route.params.workspaceId);
    const saving = ref(false);
    const refreshing = ref(false);
    const outline = ref([]);
    const outlineId = ref(null);
    const currentVersion = ref(1);
    const hasChanges = ref(false);
    const lastSavedContent = ref(null);
    const focusedId = ref(null);
    const historyDialogVisible = ref(false);
    const viewVersionDialogVisible = ref(false);
    const versionHistory = ref([]);
    const loadingHistory = ref(false);
    const selectedVersion = ref(null);
    const realtimeSubscription = ref(null);
    const collapsedNodes = ref(new Set());
    const firstUpdateReceived = ref(false);
    const searchQuery = ref('');
    const searchStats = ref({ matches: 0, items: 0 });
    const lastSaveTime = ref(null);
    
    // Generate unique render ID for this tab/component instance
    const outlineRenderID = ref(generateRenderID());
    
    // Computed property for current workspace
    const currentWorkspace = computed(() => workspaceStore.currentWorkspace);
    
    // Computed property for workspace name
    const workspaceName = computed(() => currentWorkspace.value?.title || 'Workspace');
    
    // Function to update page title
    const updatePageTitle = () => {
      const focusedNode = focusedId.value ? findItemById(outline.value, focusedId.value) : null;
      const focusedText = focusedNode ? getCleanText(focusedNode.text) : undefined;
      setOutlineTitle(focusedText, workspaceName.value);
    };
    
    let refreshInterval = null;

    // Create debounced save function
    const debouncedSave = debounce(async () => {
      // Only save if there are changes and we're not already saving
      if (hasChanges.value && !saving.value) {
        await saveOutline();
      }
    }, 2000);

    // Get localStorage keys for current workspace
    const getLocalStorageKey = () => `outline_${workspaceId.value}`;
    const getVersionKey = () => `outline_version_${workspaceId.value}`;
    const getCollapsedKey = () => `outline_collapsed_${workspaceId.value}_${window.location.pathname}`;

    // Function to check if content has changed
    const checkForChanges = (newContent) => {
      // If there's no saved content yet (new outline), any content represents changes
      if (!lastSavedContent.value) return true;
      try {
        // Create snapshots to avoid reactive object issues
        const newContentSnapshot = JSON.parse(JSON.stringify(newContent));
        const lastSavedSnapshot = JSON.parse(JSON.stringify(lastSavedContent.value));
        
        const newContentStr = JSON.stringify(newContentSnapshot);
        const lastSavedStr = JSON.stringify(lastSavedSnapshot);
        return newContentStr !== lastSavedStr;
      } catch (error) {
        console.warn('⚠️ Error in checkForChanges, assuming changes exist:', error);
        // If serialization fails, assume there are changes to be safe
        return true;
      }
    };

    // Helper to deep clone an object
    const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

    // Functions to handle collapsed state persistence
    const loadCollapsedState = () => {
      // First try to load from URL
      const urlCollapsed = route.query.collapsed;
      if (urlCollapsed) {
        const collapsedIds = urlCollapsed.split(',').filter(id => id.trim());
        collapsedNodes.value = new Set(collapsedIds);
        return;
      }

      // Fall back to localStorage
      const collapsedKey = getCollapsedKey();
      const stored = localStorage.getItem(collapsedKey);
      if (stored) {
        try {
          const collapsedArray = JSON.parse(stored);
          collapsedNodes.value = new Set(collapsedArray);
        } catch (error) {
          console.error('Error parsing collapsed state:', error);
          collapsedNodes.value = new Set();
        }
      }
    };

    const saveCollapsedState = () => {
      const collapsedKey = getCollapsedKey();
      const collapsedArray = Array.from(collapsedNodes.value);
      localStorage.setItem(collapsedKey, JSON.stringify(collapsedArray));
      
      // Update URL
      const newQuery = { ...route.query };
      if (collapsedArray.length > 0) {
        newQuery.collapsed = collapsedArray.join(',');
      } else {
        delete newQuery.collapsed;
      }
      
      router.replace({
        path: route.path,
        query: newQuery
      });
    };

    const handleCollapseToggle = (nodeId, isCollapsed) => {
      console.log('handleCollapseToggle called with:', { nodeId, isCollapsed, currentCollapsedNodes: Array.from(collapsedNodes.value) });
      if (isCollapsed) {
        collapsedNodes.value.add(nodeId.toString());
      } else {
        collapsedNodes.value.delete(nodeId.toString());
      }
      console.log('After toggle, collapsedNodes:', Array.from(collapsedNodes.value));
      saveCollapsedState();
    };

    const isNodeCollapsed = (nodeId) => {
      const result = collapsedNodes.value.has(nodeId.toString());
      console.log('isNodeCollapsed check for node:', nodeId, 'result:', result, 'collapsedNodes:', Array.from(collapsedNodes.value));
      return result;
    };

    // Computed property to ensure version is always displayed
    const displayVersion = computed(() => {
      return currentVersion.value || 1;
    });

    // Default outline data
    const defaultOutline = [
      {
        id: 1,
        text: 'Vue knowledge',
        children: [
          {
            id: 2,
            text: 'What is Vue Js',
            children: [
              {
                id: 3,
                text: 'It is Progressive framework that is mainly focused on view part. It follows a MVVM',
                children: []
              },
              {
                id: 4,
                text: 'test2 test 2 test2',
                children: [
                  {
                    id: 5,
                    text: 'My test testing',
                    children: []
                  },
                  {
                    id: 6,
                    text: 'Another subpoint',
                    children: [
                      {
                        id: 7,
                        text: 'Deep subpoint',
                        children: []
                      }
                    ]
                  }
                ]
              }
            ]
          },
          {
            id: 8,
            text: '',
            children: []
          }
        ]
      }
    ];

    // Helper to ensure all items have autoFocus: false
    function ensureAutoFocusProp(items) {
      for (const item of items) {
        if (!('autoFocus' in item)) item.autoFocus = false;
        if (item.children && item.children.length) {
          ensureAutoFocusProp(item.children);
        }
      }
    }

    // Load from localStorage or use default
    onMounted(async () => {
      if (!workspaceId.value) return;

      // Load collapsed state first
      loadCollapsedState();

      // Check for focus query parameter
      const focusParam = route.query.focus;
      if (focusParam) {
        focusedId.value = focusParam;
      }

      // First load from localStorage
      const localStorageKey = getLocalStorageKey();
      const versionKey = getVersionKey();
      const data = localStorage.getItem(localStorageKey);
      const storedVersion = localStorage.getItem(versionKey);

      if (data) {
        try {
          outline.value = JSON.parse(data);
          ensureAutoFocusProp(outline.value);
          currentVersion.value = storedVersion ? parseInt(storedVersion) : 1;
        } catch {
          outline.value = defaultOutline;
          ensureAutoFocusProp(outline.value);
          currentVersion.value = 1;
        }
      } else {
        outline.value = defaultOutline;
        ensureAutoFocusProp(outline.value);
        currentVersion.value = 1;
      }

      // Then fetch from Supabase
      try {
        // Get the latest main outline for this workspace (not task outlines)
        const { data: outlineData, error: outlineError } = await supabase
          .from('outlines')
          .select('*')
          .eq('workspace_id', workspaceId.value)
          .eq('title', 'Outline')
          .order('version', { ascending: false })
          .limit(1)
          .single();

        if (outlineError && outlineError.code !== 'PGRST116') {
          console.error('Error fetching outline:', outlineError);
          return;
        }

        if (outlineData) {
          console.log(outlineData);
          outlineId.value = outlineData.id;
          
          // If versions match, check for content differences
          if (outlineData.version === currentVersion.value) {
            const localContent = JSON.stringify(outline.value);
            const supabaseContent = JSON.stringify(outlineData.content);
            outline.value = deepClone(outlineData.content);
            lastSavedContent.value = deepClone(outlineData.content);
            hasChanges.value = false;
          } else if (outlineData.version > currentVersion.value) {
            // If Supabase version is newer, update local content
            outline.value = deepClone(outlineData.content);
            ensureAutoFocusProp(outline.value);
            currentVersion.value = outlineData.version;
            localStorage.setItem(localStorageKey, JSON.stringify(outlineData.content));
            localStorage.setItem(versionKey, outlineData.version.toString());
            lastSavedContent.value = deepClone(outlineData.content);
            hasChanges.value = false;
          }
        } else {
          // If no outline in Supabase, we need to properly initialize lastSavedContent
          // Set lastSavedContent to null so that any changes will be detected
          lastSavedContent.value = null;
          hasChanges.value = true; // Mark as having changes since we have content but no saved version
          // Ensure currentVersion is set to 1 if no outline exists in Supabase
          if (!currentVersion.value) {
            currentVersion.value = 1;
          }
        }
      } catch (error) {
        console.error('Error in outline setup:', error);
        // In case of error, assume we have changes if we have local content
        hasChanges.value = outline.value !== defaultOutline;
        lastSavedContent.value = outline.value;
      }

      // Add keyboard shortcut listener for Ctrl+S / Cmd+S and Ctrl+F / Cmd+F
      const handleKeyDown = (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 's') {
          event.preventDefault();
          if (hasChanges.value && !saving.value) {
            saveOutline();
          }
        } else if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
          event.preventDefault();
          // Focus the search input
          const searchInput = document.querySelector('.search-input input');
          if (searchInput) {
            searchInput.focus();
            searchInput.select();
          }
        }
      };

      // Add global paste handler for images
      const handlePaste = async (event) => {
        try {
          const clipboardData = event.clipboardData || window.clipboardData;
          
          if (!clipboardData) {
            return; // Let default paste behavior happen
          }
          
          const items = Array.from(clipboardData.items);
          const imageItem = items.find(item => item.type.startsWith('image/'));
          
          if (imageItem) {
            // Only handle paste if we're not in a text input/textarea
            const activeElement = document.activeElement;
            if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
              return; // Let individual components handle paste
            }
            
            // Prevent default paste behavior for images
            event.preventDefault();
            
            // Get the image file from clipboard
            const imageFile = imageItem.getAsFile();
            
            if (imageFile) {
              // Generate a filename for the pasted image
              const timestamp = Date.now();
              const fileExtension = imageFile.type.split('/')[1] || 'png';
              const fileName = `pasted-image-${timestamp}.${fileExtension}`;
              
              // Create a new File object with the proper name
              const namedFile = new File([imageFile], fileName, {
                type: imageFile.type,
                lastModified: Date.now()
              });
              
              // Add image as a new root-level item
              const now = new Date().toISOString();
              const newItem = {
                id: Date.now().toString(),
                text: fileName,
                children: [],
                fileUrl: await uploadFileToGitea(namedFile, workspaceId.value),
                created_at: now,
                updated_at: now
              };
              
              outline.value.push(newItem);
              
              ElNotification({
                title: 'Image Pasted',
                message: 'Image has been pasted and uploaded to the outline',
                type: 'success',
                duration: 3000
              });
            }
          }
        } catch (error) {
          console.error('Error handling global paste:', error);
          ElNotification({
            title: 'Paste Error',
            message: 'Failed to paste image: ' + error.message,
            type: 'error',
            duration: 5000
          });
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('paste', handlePaste);
      
      // Store the handlers for cleanup
      window.outlineKeyDownHandler = handleKeyDown;
      window.outlinePasteHandler = handlePaste;

      // Disable aggressive localStorage cross-tab syncing for now
      // This was causing text deletion during typing
      // The render ID system and real-time subscription handle cross-tab sync
      function handleStorageChange(event) {
        // Temporarily disabled to prevent text deletion
        return;
      }

      // Add and remove storage event listener (disabled)
      // window.addEventListener('storage', handleStorageChange);

      // Add subscription setup after outline is loaded
      if (outlineId.value) {
        await subscribeToChanges();
      }

      // Set initial page title
      updatePageTitle();

      // Don't use aggressive periodic refresh - rely on real-time subscription
      // Periodic refresh was causing text deletion during typing
    });

    // Cleanup keyboard event listener on unmount
    onUnmounted(() => {
      // Remove storage event listener (was disabled)
      // window.removeEventListener('storage', handleStorageChange);
      
      // Remove keyboard event listener
      if (window.outlineKeyDownHandler) {
        document.removeEventListener('keydown', window.outlineKeyDownHandler);
        delete window.outlineKeyDownHandler;
      }

      // Remove paste event listener
      if (window.outlinePasteHandler) {
        document.removeEventListener('paste', window.outlinePasteHandler);
        delete window.outlinePasteHandler;
      }

      // Clean up real-time subscription
      if (realtimeSubscription.value) {
        realtimeSubscription.value.unsubscribe();
      }

      // No refresh interval to clear anymore
    });

    // Watch for changes in outline - but don't auto-save on every change
    // Only update localStorage and change detection
    watch(outline, (val) => {
      if (workspaceId.value) {
        localStorage.setItem(getLocalStorageKey(), JSON.stringify(val));
        hasChanges.value = checkForChanges(val);
        
        // Don't trigger auto-save here - let individual text updates handle it
        // This prevents conflicts between outline-level and item-level saves
      }
    }, { deep: true });

    // Watch for changes in focused ID and update page title
    watch(focusedId, () => {
      updatePageTitle();
    });

    // Watch for changes in workspace name and update page title
    watch(workspaceName, () => {
      updatePageTitle();
    });

    // Watch for outline content changes and update page title (for focused node text changes)
    watch(() => {
      if (focusedId.value) {
        const focusedNode = findItemById(outline.value, focusedId.value);
        return focusedNode?.text;
      }
      return null;
    }, () => {
      updatePageTitle();
    });

    async function saveOutline() {
      if (!workspaceId.value) {
        console.error('No workspace ID available');
        return;
      }

      // Cancel any pending auto-save when manually saving
      if (debouncedSave && debouncedSave.cancel) {
        debouncedSave.cancel();
      }

      saving.value = true;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No authenticated user');

        const outlineToSave = deepClone(outline.value);
        console.log('Saving outline with renderID:', outlineRenderID.value);

        if (outlineId.value) {
          // Check current server version before saving to detect conflicts
          const { data: serverOutline, error: serverCheckError } = await supabase
            .from('outlines')
            .select('version')
            .eq('id', outlineId.value)
            .single();

          if (serverCheckError) {
            console.error('❌ Error checking server version:', serverCheckError);
            throw serverCheckError;
          }

          // Detect version conflict
          if (serverOutline.version > currentVersion.value) {
            console.log('⚠️ Version conflict detected during save');
            
            ElNotification({
              title: 'Save Conflict',
              message: 'The outline was updated by another user. Please refresh and try again.',
              type: 'warning',
              duration: 7000,
              showClose: true
            });
            
            // Update our version tracking and don't save
            currentVersion.value = serverOutline.version;
            return;
          }

          // First get the new version number
          const { data: newVersion, error: versionError } = await supabase
            .rpc('increment_version', { outline_id: outlineId.value });

          if (versionError) {
            console.error('❌ Error incrementing version:', versionError);
            throw versionError;
          }

          console.log('📝 Saving with new version:', newVersion);

          // Then update the outline with the new version and renderID
          const { data: updatedOutline, error: updateError } = await supabase
            .from('outlines')
            .update({
              content: outlineToSave,
              version: newVersion,
              render_id: outlineRenderID.value, // Send render ID with save
              updated_at: new Date().toISOString() // Add explicit updated_at
            })
            .eq('id', outlineId.value)
            .select()
            .single();

          if (updateError) {
            console.error('❌ Error updating outline:', updateError);
            throw updateError;
          }

          console.log('✅ Successfully updated outline:', updatedOutline);
          console.log('📝 Save completed - updating local state:', {
            oldVersion: currentVersion.value,
            newVersion: updatedOutline.version,
            renderID: outlineRenderID.value
          });
          
          // Update version FIRST to prevent race conditions with real-time updates
          currentVersion.value = updatedOutline.version;
          localStorage.setItem(getVersionKey(), currentVersion.value.toString());
          
          // Record save time to prevent conflict detection immediately after save
          lastSaveTime.value = Date.now();
          
          // Update last saved content with what was actually saved
          lastSavedContent.value = deepClone(outlineToSave);
          
          // DON'T overwrite outline.value - user might have made changes during save
          // Instead, recalculate hasChanges based on current outline vs what was saved
          hasChanges.value = checkForChanges(outline.value);

          // Store last saved content in localStorage for cross-tab sync
          localStorage.setItem(`${getLocalStorageKey()}_last_saved`, JSON.stringify(outlineToSave));
          // Update localStorage with current outline state, not the saved snapshot
          localStorage.setItem(getLocalStorageKey(), JSON.stringify(outline.value));
        } else {
          // Create new outline
          const { data: newOutline, error: insertError } = await supabase
            .from('outlines')
            .insert([{
              workspace_id: workspaceId.value,
              title: 'Outline',
              content: outlineToSave,
              render_id: outlineRenderID.value, // Send render ID with save
              created_by: user.id
            }])
            .select()
            .single();

          if (insertError) throw insertError;
          outlineId.value = newOutline.id;
          currentVersion.value = newOutline.version;
          
          // Record save time to prevent conflict detection immediately after save
          lastSaveTime.value = Date.now();
          
          // Update last saved content with what was actually saved
          lastSavedContent.value = deepClone(outlineToSave);
          
          // DON'T overwrite outline.value - user might have made changes during save
          // Instead, recalculate hasChanges based on current outline vs what was saved
          hasChanges.value = checkForChanges(outline.value);

          // Store last saved content in localStorage for cross-tab sync
          localStorage.setItem(`${getLocalStorageKey()}_last_saved`, JSON.stringify(outlineToSave));
          // Update localStorage with current outline state, not the saved snapshot
          localStorage.setItem(getLocalStorageKey(), JSON.stringify(outline.value));
          localStorage.setItem(getVersionKey(), currentVersion.value.toString());
        }

        // Create version record
        const { error: versionError } = await supabase
          .from('outline_versions')
          .insert([{
            outline_id: outlineId.value,
            content: outlineToSave,
            version: currentVersion.value,
            created_by: user.id
          }]);

        if (versionError) throw versionError;

        // Update workspace activity
        await updateWorkspaceActivity(workspaceId.value);

        // Show success notification
        ElNotification({
          title: 'Outline Saved',
          message: `Successfully saved version ${currentVersion.value}`,
          type: 'success',
          duration: 3000
        });

        // Use nextTick to ensure all state updates are complete before checking for more changes
        await nextTick();
        
        // If there are still changes after saving (user continued editing), schedule another save
        if (hasChanges.value) {
          debouncedSave();
        }

      } catch (error) {
        console.error('❌ Error saving outline:', error);
        
        // Provide specific error messages
        let errorMessage = 'Failed to save outline. Please try again.';
        
        if (error.message?.includes('version')) {
          errorMessage = 'Version conflict detected. Please refresh and try again.';
        } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else if (error.message?.includes('permission') || error.message?.includes('auth')) {
          errorMessage = 'Permission error. Please refresh the page and try again.';
        }
        
        // Show error notification
        ElNotification({
          title: 'Save Failed',
          message: errorMessage,
          type: 'error',
          duration: 7000,
          showClose: true
        });
      } finally {
        saving.value = false;
      }
    }

    // Update outline text by id (recursive)
    function updateTextById(items, id, text) {
      for (const item of items) {
        if (item.id.toString() === id.toString()) {
          item.text = text;
          return true;
        }
        if (item.children && item.children.length) {
          if (updateTextById(item.children, id, text)) return true;
        }
      }
      return false;
    }

    // Find and remove item by id (recursive)
    function removeItemById(items, id) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].id.toString() === id.toString()) {
          return items.splice(i, 1)[0];
        }
        if (items[i].children && items[i].children.length) {
          const removed = removeItemById(items[i].children, id);
          if (removed) return removed;
        }
      }
      return null;
    }

    // Find item by id (recursive)
    function findItemById(items, id) {
      for (const item of items) {
        if (item.id.toString() === id.toString()) {
          return item;
        }
        if (item.children && item.children.length) {
          const found = findItemById(item.children, id);
          if (found) return found;
        }
      }
      return null;
    }

    // Find parent of item by id (recursive)
    function findParentById(items, id, parent = null) {
      for (const item of items) {
        if (item.id.toString() === id.toString()) {
          return parent;
        }
        if (item.children && item.children.length) {
          const found = findParentById(item.children, id, item);
          if (found) return found;
        }
      }
      return null;
    }

    function onOutlineUpdate({ id, text, updated_at, immediate }) {
      updateTextById(outline.value, id, text);
      // Update the timestamp if provided
      if (updated_at) {
        const item = findItemById(outline.value, id);
        if (item) {
          item.updated_at = updated_at;
        }
      }
      
      // Check for changes directly instead of relying on reactive hasChanges
      const currentChanges = checkForChanges(outline.value);
      
      // If immediate save is requested (e.g., when finishing edit), save immediately
      if (immediate && currentChanges && !saving.value) {
        // Cancel any pending debounced save and save immediately
        if (debouncedSave && debouncedSave.cancel) {
          debouncedSave.cancel();
        }
        console.log('Immediate save triggered from onOutlineUpdate');
        saveOutline();
      } else if (currentChanges && !saving.value) {
        // Otherwise, trigger auto-save only when text actually changes
        debouncedSave();
      }
    }

    function handleMove({ draggedId, targetId, position }) {
      console.log('handleMove called in OutlineCt:', { draggedId, targetId, position });
      // Get the dragged item and its parent
      console.log('outline value', outline.value);
      console.log('draggedId', draggedId);
      console.log('targetId', targetId);
      console.log('position', position);
      const draggedItem = removeItemById(outline.value, draggedId);
      if (!draggedItem) {
        console.log('No dragged item found');
        return;
      }

      // Find the target item
      const targetItem = findItemById(outline.value, targetId);
      if (!targetItem) {
        console.log('No target item found');
        return;
      }

      // Get the parent of the target item
      const targetParent = findParentById(outline.value, targetId);

      if (position === 'after') {
        if (targetParent) {
          // Add as sibling in parent's children array
          const targetIndex = targetParent.children.findIndex(child => child.id.toString() === targetId);
          targetParent.children.splice(targetIndex + 1, 0, draggedItem);
        } else {
          // Add as sibling in root array
          const targetIndex = outline.value.findIndex(item => item.id.toString() === targetId);
          outline.value.splice(targetIndex + 1, 0, draggedItem);
        }
      } else if (position === 'child') {
        // Add as last child of the target item
        if (!targetItem.children) {
          targetItem.children = [];
        }
        targetItem.children.push(draggedItem);
      } else {
        // If position is 'before', add as child (first child)
        if (!targetItem.children) {
          targetItem.children = [];
        }
        targetItem.children.unshift(draggedItem);
      }

      // Force Vue to update
      outline.value = [...outline.value];
      console.log('Move operation completed');
      
      // Trigger auto-save after move operation
      nextTick(() => {
        const currentChanges = checkForChanges(outline.value);
        if (currentChanges && !saving.value) {
          console.log('Triggering auto-save after move operation');
          debouncedSave();
        }
      });
    }

    function handleDelete(id) {
      console.log('handleDelete', id);
      // Remove the item from the outline
      removeItemById(outline.value, id);
      // Force Vue to update
      outline.value = [...outline.value];
      
      // Trigger auto-save after deletion using nextTick to ensure changes are detected
      nextTick(() => {
        // Check for changes manually since the deletion represents a structural change
        const currentChanges = checkForChanges(outline.value);
        if (currentChanges && !saving.value) {
          console.log('Triggering auto-save after deletion');
          debouncedSave();
        }
      });
    }

    function handleDrilldown(id) {
      focusedId.value = id;
      // Update the URL with the focus parameter
      router.push({
        path: route.path,
        query: { ...route.query, focus: id }
      });
      // Page title will be updated by the watcher
    }

    function handleBack() {
      focusedId.value = null;
      // Clear the focus parameter from the URL
      const newQuery = { ...route.query };
      delete newQuery.focus;
      router.push({
        path: route.path,
        query: newQuery
      });
      // Page title will be updated by the watcher
    }

    function getFocusedOutline() {
      // If there's a search query, return filtered results
      if (searchQuery.value && searchQuery.value.trim()) {
        return getFilteredOutline();
      }
      
      // If focused on a specific item, show that branch
      if (!focusedId.value) return outline.value;
      function findById(items, id) {
        for (const item of items) {
          if (item.id.toString() === id.toString()) return [item];
          if (item.children) {
            const found = findById(item.children, id);
            if (found) return found;
          }
        }
        return null;
      }
      return findById(outline.value, focusedId.value) || [];
    }

    function getFilteredOutline() {
      const query = searchQuery.value.toLowerCase();
      
      function filterItem(item) {
        const itemText = getCleanText(item.text).toLowerCase();
        const hasMatch = itemText.includes(query);
        
        // Check children recursively
        const filteredChildren = [];
        let hasMatchingDescendants = false;
        
        if (item.children && item.children.length) {
          for (const child of item.children) {
            const filteredChild = filterItem(child);
            if (filteredChild) {
              filteredChildren.push(filteredChild);
              hasMatchingDescendants = true;
            }
          }
        }
        
        // Include this item if:
        // 1. It matches the search query, OR
        // 2. It has children that match (to preserve tree structure)
        if (hasMatch || hasMatchingDescendants) {
          return {
            ...item,
            children: filteredChildren,
            isSearchMatch: hasMatch,
            isSearchContext: !hasMatch && hasMatchingDescendants,
            // Expand nodes that contain matches so search results are visible
            forceExpanded: hasMatchingDescendants
          };
        }
        
        return null;
      }
      
      const filteredItems = [];
      for (const item of outline.value) {
        const filteredItem = filterItem(item);
        if (filteredItem) {
          filteredItems.push(filteredItem);
        }
      }
      
      return filteredItems;
    }

    // Helper to find the path from root to focused node
    function findPathToNode(items, id, path = []) {
      for (const item of items) {
        const newPath = [...path, item];
        if (item.id.toString() === id?.toString()) return newPath;
        if (item.children) {
          const found = findPathToNode(item.children, id, newPath);
          if (found) return found;
        }
      }
      return null;
    }

    const breadcrumbPath = computed(() => {
      if (!focusedId.value) return [];
      return findPathToNode(outline.value, focusedId.value) || [];
    });

    function handleBreadcrumb(node, idx) {
      // If last breadcrumb, do nothing (already focused)
      if (idx === breadcrumbPath.value.length - 1) return;
      focusedId.value = node.id;
      // Update the URL with the focus parameter
      router.push({
        path: route.path,
        query: { ...route.query, focus: node.id }
      });
      // Page title will be updated by the watcher
    }

    function getBreadcrumbText(text) {
      if (!text) return '';
      const words = text.split(/\s+/);
      return words.length > 5 ? words.slice(0, 5).join(' ') + '…' : text;
    }

    async function openHistoryDialog() {
      if (!outlineId.value) {
        ElNotification({
          title: 'No Outline',
          message: 'No outline found to show history.',
          type: 'warning',
          duration: 3000
        });
        return;
      }
      historyDialogVisible.value = true;
      loadingHistory.value = true;
      // Fetch version history from Supabase
      const { data: versionsData, error: versionsError } = await supabase
        .from('outline_versions')
        .select('id, version, created_at, content, created_by')
        .eq('outline_id', outlineId.value)
        .order('version', { ascending: false });
      
      if (versionsError) {
        ElNotification({
          title: 'Error',
          message: 'Failed to fetch version history.',
          type: 'error',
          duration: 4000
        });
        versionHistory.value = [];
        loadingHistory.value = false;
        return;
      }

      // Get unique creator IDs
      const creatorIds = [...new Set(versionsData.map(v => v.created_by))];
      
      // Fetch creator information for each creator
      const profilesData = [];
      for (const creatorId of creatorIds) {
        const { data: profileData, error: profileError } = await supabase
          .rpc('get_user_info_by_id', {
            user_id: creatorId
          });
        
        if (profileError) {
          console.error('Error fetching profile:', profileError);
          continue;
        }
        
        if (profileData) {
          console.log('profileData', profileData);
          profilesData.push(profileData[0]);
        }
      }

      // Create a map of creator IDs to names
      const creatorMap = new Map(
        profilesData.map(profile => [profile.id, profile.email])
      );

      console.log('creatorMap', creatorMap);
      // Transform the data to include creator name
      versionHistory.value = versionsData.map(version => ({
        ...version,
        creator_email: creatorMap.get(version.created_by) || 'Unknown'
      }));
      
      loadingHistory.value = false;
    }

    function viewVersion(versionRow) {
      selectedVersion.value = versionRow;
      viewVersionDialogVisible.value = true;
    }

    function formatDate(dateString) {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    }

    // --- Keyboard navigation logic ---
    function flattenOutline(items, result = []) {
      for (const item of items) {
        result.push(item);
        if (item.children && item.children.length) {
          flattenOutline(item.children, result);
        }
      }
      return result;
    }

    function handleNavigate({ id, direction }) {
      // Flatten the visible outline
      const flat = flattenOutline(getFocusedOutline());
      //console.log('Flat outline:', flat.map(i => i.text));
      const idx = flat.findIndex(item => item.id.toString() === id.toString());
      //console.log('Current item id:', id, 'index:', idx, 'direction:', direction);
      if (idx === -1) return;
      let targetIdx = null;
      if (direction === 'up' && idx > 0) targetIdx = idx - 1;
      if (direction === 'down' && idx < flat.length - 1) targetIdx = idx + 1;
      //console.log('Target index:', targetIdx, 'Target item:', targetIdx !== null ? flat[targetIdx] : null);
      if (targetIdx !== null) {
        // Use Object.assign to ensure reactivity
        Object.assign(flat[targetIdx], { autoFocus: true });
        outline.value = [...outline.value];
      }
    }

    // --- Indent/Outdent logic ---
    function handleIndent({ id }) {
      // Find parent and previous sibling
      function findParentAndIndex(items, id, parent = null) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].id.toString() === id.toString()) {
            return { parent, index: i, items };
          }
          if (items[i].children && items[i].children.length) {
            const res = findParentAndIndex(items[i].children, id, items[i]);
            if (res) return res;
          }
        }
        return null;
      }
      const res = findParentAndIndex(outline.value, id);
      if (!res || res.index === 0) return; // No previous sibling
      const { parent, index, items } = res;
      const prevSibling = items[index - 1];
      // Remove from current position
      const [moved] = items.splice(index, 1);
      // Add as last child of previous sibling
      if (!prevSibling.children) prevSibling.children = [];
      prevSibling.children.push(moved);
      // Set autoFocus for moved node
      moved.autoFocus = true;
      outline.value = [...outline.value];
      
      // Trigger auto-save after indent operation
      nextTick(() => {
        const currentChanges = checkForChanges(outline.value);
        if (currentChanges && !saving.value) {
          console.log('Triggering auto-save after indent operation');
          debouncedSave();
        }
      });
    }

    function handleOutdent({ id }) {
      // Always use the latest structure from localStorage
      const localStorageKey = getLocalStorageKey();
      const latestOutline = JSON.parse(localStorage.getItem(localStorageKey) || '[]');

      // Recursively find the node, its parent, and its grandparent
      function findNodeAndAncestors(items, id, parent = null, grandparent = null) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.id.toString() === id.toString()) {
            return { node: item, parent, grandparent, index: i, items };
          }
          if (item.children && item.children.length) {
            const res = findNodeAndAncestors(item.children, id, item, parent);
            if (res) return res;
          }
        }
        return null;
      }
      const res = findNodeAndAncestors(latestOutline, id);
      if (!res || !res.parent || !res.grandparent) {
        //console.log('Cannot outdent: node is at root or top-level', res);
        return;
      }
      const { parent, grandparent, index, items } = res;

      // Log before
      //console.log('Outline before:', JSON.stringify(latestOutline, null, 2));
      //console.log('Node:', res.node.text, 'Parent:', parent.text, 'Grandparent:', grandparent.text);
      //console.log('Removing from items:', items.map(i => i.text));
      //console.log('Inserting into gpChildren:', (grandparent.children || latestOutline).map(i => i.text));

      // Remove from current position
      const [moved] = items.splice(index, 1);

      // Find parent in grandparent's children
      const gpChildren = grandparent.children || latestOutline;
      const parentIdx = gpChildren.findIndex(child => child.id === parent.id);
      if (parentIdx === -1) {
        //console.log('Parent not found in grandparent children');
        return;
      }

      gpChildren.splice(parentIdx + 1, 0, moved);

      // Log after
      //console.log('Outline after:', JSON.stringify(latestOutline, null, 2));

      // Set autoFocus for moved node
      moved.autoFocus = true;
      outline.value = [...latestOutline];
      
      // Trigger auto-save after outdent operation
      nextTick(() => {
        const currentChanges = checkForChanges(outline.value);
        if (currentChanges && !saving.value) {
          console.log('Triggering auto-save after outdent operation');
          debouncedSave();
        }
      });
    }

    function handleAddSiblingRoot({ id }) {
      // Find the index in the root outline array
      const idx = outline.value.findIndex(item => item.id === id);
      if (idx !== -1) {
        const now = new Date().toISOString();
        const newSibling = {
          id: Date.now().toString(),
          text: '',
          children: [],
          autoFocus: true,
          created_at: now,
          updated_at: now
        };
        outline.value.splice(idx + 1, 0, newSibling);
        
        // Trigger auto-save after adding new sibling
        nextTick(() => {
          const currentChanges = checkForChanges(outline.value);
          if (currentChanges && !saving.value) {
            console.log('Triggering auto-save after adding sibling');
            debouncedSave();
          }
        });
      }
    }

    // Function to subscribe to real-time changes
    async function subscribeToChanges() {
      if (!workspaceId.value || !outlineId.value) return;

      // Unsubscribe from any existing subscription
      if (realtimeSubscription.value) {
        realtimeSubscription.value.unsubscribe();
      }

      // Subscribe to changes on the outlines table
      realtimeSubscription.value = supabase
        .channel(`outline_changes_${outlineId.value}_${outlineRenderID.value}`)
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'outlines',
            filter: `id=eq.${outlineId.value}`
          },
          async (payload) => {
            console.log('🔄 Received real-time update:', {
              eventType: payload.eventType,
              newVersion: payload.new?.version,
              currentLocalVersion: currentVersion.value,
              updateRenderID: payload.new?.render_id,
              ourRenderID: outlineRenderID.value,
              isSaving: saving.value
            });
            
            // Check if this update came from our own tab
            const updateRenderID = payload.new?.render_id;
            const updateVersion = payload.new?.version;
            
            if (updateRenderID === outlineRenderID.value) {
              console.log('⏭️ Skipping update - this came from our own tab (renderID match)');
              // Update our local version tracking to stay in sync
              if (updateVersion && updateVersion > currentVersion.value) {
                currentVersion.value = updateVersion;
                localStorage.setItem(getVersionKey(), updateVersion.toString());
              }
              return;
            }
            
            // If we're currently saving, skip processing to avoid race conditions
            // Our own save will update local state properly
            if (saving.value) {
              console.log('⏭️ Skipping update - currently saving (avoiding race condition)');
              return;
            }
            
            // If we just saved recently (within 2 seconds), skip processing to avoid 
            // conflict detection on our own saves that may have slight timing delays
            if (lastSaveTime.value && (Date.now() - lastSaveTime.value) < 2000) {
              console.log('⏭️ Skipping update - recent save detected (avoiding post-save conflict)');
              // Still update version tracking if the received version is higher
              if (updateVersion && updateVersion > currentVersion.value) {
                console.log('📝 Updating version after recent save:', updateVersion);
                currentVersion.value = updateVersion;
                localStorage.setItem(getVersionKey(), updateVersion.toString());
              }
              return;
            }

            // Add a small delay to avoid immediate notifications after saves
            // This helps prevent notification spam when one tab saves
            await new Promise(resolve => setTimeout(resolve, 300));

            // Skip notifications for the first update after page load to avoid spam
            const isFirstUpdate = !firstUpdateReceived.value;
            firstUpdateReceived.value = true;

            try {
              // For UPDATE events
              if (payload.eventType === 'UPDATE') {
                const newContent = payload.new.content;
                const newVersion = payload.new.version;

                console.log('📊 Version check:', {
                  current: currentVersion.value,
                  received: newVersion,
                  updateRenderID,
                  ourRenderID: outlineRenderID.value
                });

                // Always update version tracking, regardless of content merge
                const versionIsNewer = newVersion > currentVersion.value;
                const versionIsSame = newVersion === currentVersion.value;
                
                if (versionIsNewer || versionIsSame) {
                  console.log('🔄 Processing update from another tab');
                  
                  // Safe content comparison with error handling
                  let currentContentStr, newContentStr, contentIsDifferent;
                  try {
                    // Create a deep clone to avoid reactive object issues during comparison
                    const currentContentSnapshot = JSON.parse(JSON.stringify(outline.value));
                    currentContentStr = JSON.stringify(currentContentSnapshot);
                    newContentStr = JSON.stringify(newContent);
                    contentIsDifferent = currentContentStr !== newContentStr;
                  } catch (serializationError) {
                    console.warn('⚠️ Content comparison failed, assuming content is different:', serializationError);
                    // If serialization fails, assume content is different and proceed safely
                    contentIsDifferent = true;
                    currentContentStr = '';
                    newContentStr = JSON.stringify(newContent);
                  }
                  
                  if (contentIsDifferent) {
                    console.log('📝 Content is different, deciding how to merge...');
                    
                    if (!hasChanges.value) {
                      // No local changes - safe to update completely
                      console.log('✅ No local changes - applying remote update');
                      const freshContent = JSON.parse(JSON.stringify(newContent));
                      
                      // Update local state
                      try {
                        await nextTick(() => {
                          outline.value = freshContent;
                          currentVersion.value = newVersion;
                          lastSavedContent.value = JSON.parse(JSON.stringify(freshContent));
                          hasChanges.value = false;
                        });
                      } catch (updateError) {
                        console.warn('⚠️ Error updating local state, applying manually:', updateError);
                        // Fallback to direct assignment if nextTick fails
                        outline.value = freshContent;
                        currentVersion.value = newVersion;
                        lastSavedContent.value = JSON.parse(JSON.stringify(freshContent));
                        hasChanges.value = false;
                      }

                      // Update localStorage
                      try {
                        const localStorageKey = getLocalStorageKey();
                        const versionKey = getVersionKey();
                        localStorage.setItem(localStorageKey, JSON.stringify(freshContent));
                        localStorage.setItem(versionKey, newVersion.toString());
                        localStorage.setItem(`${localStorageKey}_last_saved`, JSON.stringify(freshContent));
                      } catch (storageError) {
                        console.warn('⚠️ Failed to update localStorage:', storageError);
                        // Continue execution even if localStorage fails
                      }

                      // Only show notification if this is a significant structural change
                      // and it's not the first update after page load
                      const currentItemCount = JSON.stringify(outline.value).split('"id":').length - 1;
                      const newItemCount = JSON.stringify(freshContent).split('"id":').length - 1;
                      const hasStructuralChanges = currentItemCount !== newItemCount;
                      
                      if (hasStructuralChanges && !isFirstUpdate) {
                        ElNotification({
                          title: 'Outline Updated',
                          message: 'The outline structure has been updated from another tab',
                          type: 'success',
                          duration: 3000
                        });
                      }
                    } else {
                      // We have local changes - check if they're actually conflicting
                      console.log('⚠️ Local changes detected - checking for actual conflicts');
                      
                      // Check if our local changes are the same as what we're receiving
                      // This can happen when one tab saves and another tab receives the update
                      let localChangesStr, remoteChangesStr;
                      try {
                        const localSnapshot = JSON.parse(JSON.stringify(outline.value));
                        localChangesStr = JSON.stringify(localSnapshot);
                        remoteChangesStr = JSON.stringify(newContent);
                      } catch (comparisonError) {
                        console.warn('⚠️ Local changes comparison failed, treating as conflict:', comparisonError);
                        // If comparison fails, treat as a conflict to be safe
                        localChangesStr = 'local_error';
                        remoteChangesStr = 'remote_content';
                      }
                      
                      if (localChangesStr === remoteChangesStr) {
                        // Our local changes match the remote content - this is a sync, not a conflict
                        console.log('✅ Local changes match remote content - applying sync');
                        
                        // Update local state to match the server
                        try {
                          await nextTick(() => {
                            outline.value = JSON.parse(JSON.stringify(newContent));
                            currentVersion.value = newVersion;
                            lastSavedContent.value = JSON.parse(JSON.stringify(newContent));
                            hasChanges.value = false;
                          });
                        } catch (syncUpdateError) {
                          console.warn('⚠️ Error updating state during sync, applying manually:', syncUpdateError);
                          // Fallback to direct assignment if nextTick fails
                          outline.value = JSON.parse(JSON.stringify(newContent));
                          currentVersion.value = newVersion;
                          lastSavedContent.value = JSON.parse(JSON.stringify(newContent));
                          hasChanges.value = false;
                        }

                        // Update localStorage
                        try {
                          const localStorageKey = getLocalStorageKey();
                          const versionKey = getVersionKey();
                          localStorage.setItem(localStorageKey, JSON.stringify(newContent));
                          localStorage.setItem(versionKey, newVersion.toString());
                          localStorage.setItem(`${localStorageKey}_last_saved`, JSON.stringify(newContent));
                        } catch (syncStorageError) {
                          console.warn('⚠️ Failed to update localStorage during sync:', syncStorageError);
                          // Continue execution even if localStorage fails
                        }

                        // Silently sync - no notification needed for seamless sync
                        console.log('✅ Changes synchronized between tabs');
                      } else {
                        // Actual conflict - local changes are different from remote
                        console.log('⚠️ Actual conflict detected - preserving local changes');
                        
                        // Update version and saved content reference for conflict tracking
                        currentVersion.value = newVersion;
                        lastSavedContent.value = JSON.parse(JSON.stringify(newContent));
                        
                        // Recalculate hasChanges based on new remote content
                        hasChanges.value = checkForChanges(outline.value);
                        
                        // Update localStorage with remote version info but keep local content
                        try {
                          const versionKey = getVersionKey();
                          localStorage.setItem(versionKey, newVersion.toString());
                          localStorage.setItem(`${getLocalStorageKey()}_last_saved`, JSON.stringify(newContent));
                        } catch (conflictStorageError) {
                          console.warn('⚠️ Failed to update localStorage during conflict handling:', conflictStorageError);
                          // Continue execution even if localStorage fails
                        }
                        
                        // Show conflict notification only for real conflicts, but only if not first update
                        if (!isFirstUpdate) {
                          ElNotification({
                            title: 'Sync Conflict Detected',
                            message: 'Another user updated the outline while you have different unsaved changes. Your changes are preserved.',
                            type: 'warning',
                            duration: 5000,
                            showClose: true
                          });
                        }
                      }
                    }
                  } else {
                    // Content is the same, just update version tracking
                    console.log('📄 Content is identical - updating version only');
                    currentVersion.value = newVersion;
                    lastSavedContent.value = JSON.parse(JSON.stringify(newContent));
                    hasChanges.value = checkForChanges(outline.value);
                    
                    // Update localStorage version
                    try {
                      const versionKey = getVersionKey();
                      localStorage.setItem(versionKey, newVersion.toString());
                    } catch (versionStorageError) {
                      console.warn('⚠️ Failed to update version in localStorage:', versionStorageError);
                      // Continue execution even if localStorage fails
                    }
                  }
                } else {
                  console.log('⏪ Received older version - ignoring');
                }
              }
            } catch (error) {
              console.error('❌ Error handling real-time update:', error);
              
              // Try to recover by refreshing data
              try {
                await refreshOutlineData();
                console.log('🔄 Successfully recovered from sync error');
              } catch (recoveryError) {
                console.error('❌ Failed to recover from sync error:', recoveryError);
              }
            }
          }
        )
        .subscribe((status) => {
          console.log('📡 Subscription status:', status);
          
          if (status === 'SUBSCRIBED') {
            console.log('✅ Successfully subscribed to outline changes');
          } else if (status === 'CLOSED') {
            console.log('❌ Subscription closed - attempting to reconnect...');
            // Retry subscription after a delay
            setTimeout(() => {
              if (outlineId.value && workspaceId.value) {
                subscribeToChanges();
              }
            }, 2000);
          } else {
            console.log('📡 Subscription status changed:', status);
          }
        });
    }

    // Enhanced refreshOutlineData with better conflict handling
    async function refreshOutlineData() {
      if (!workspaceId.value || !outlineId.value) return;

      console.log('🔄 Refreshing outline data...');

      try {
        const { data: outlineData, error: outlineError } = await supabase
          .from('outlines')
          .select('*')
          .eq('id', outlineId.value)
          .single();

        if (outlineError) {
          console.error('❌ Error fetching outline data:', outlineError);
          throw outlineError;
        }

        if (outlineData) {
          console.log('📄 Received fresh outline data:', {
            version: outlineData.version,
            currentVersion: currentVersion.value,
            hasLocalChanges: hasChanges.value
          });

          const freshContent = JSON.parse(JSON.stringify(outlineData.content));
          const contentIsDifferent = JSON.stringify(outline.value) !== JSON.stringify(freshContent);
          
          if (!hasChanges.value || !contentIsDifferent) {
            // Safe to update - no local changes or content is identical
            console.log('✅ Safe to update - applying fresh data');
            
            await nextTick(() => {
              outline.value = freshContent;
              currentVersion.value = outlineData.version;
              lastSavedContent.value = JSON.parse(JSON.stringify(freshContent));
              hasChanges.value = false;
            });

            // Update localStorage
            const localStorageKey = getLocalStorageKey();
            const versionKey = getVersionKey();
            localStorage.setItem(localStorageKey, JSON.stringify(freshContent));
            localStorage.setItem(versionKey, outlineData.version.toString());
            localStorage.setItem(`${localStorageKey}_last_saved`, JSON.stringify(freshContent));
            
            console.log('✅ Successfully refreshed outline data');
          } else {
            // We have local changes and content is different - check if it's a real conflict
            console.log('⚠️ Local changes detected during refresh - checking for actual conflicts');
            
            // Check if our local changes are the same as the server content
            const localChangesStr = JSON.stringify(outline.value);
            const serverChangesStr = JSON.stringify(freshContent);
            
            if (localChangesStr === serverChangesStr) {
              // Local changes match server - this is a sync, not a conflict
              console.log('✅ Local changes match server content - applying sync');
              
              await nextTick(() => {
                outline.value = freshContent;
                currentVersion.value = outlineData.version;
                lastSavedContent.value = JSON.parse(JSON.stringify(freshContent));
                hasChanges.value = false;
              });

              // Update localStorage
              const localStorageKey = getLocalStorageKey();
              const versionKey = getVersionKey();
              localStorage.setItem(localStorageKey, JSON.stringify(freshContent));
              localStorage.setItem(versionKey, outlineData.version.toString());
              localStorage.setItem(`${localStorageKey}_last_saved`, JSON.stringify(freshContent));
              
              console.log('✅ Successfully synced outline data');
            } else {
              // Actual conflict - local changes are different from server
              console.log('⚠️ Actual conflict detected during refresh - preserving local changes');
              
              currentVersion.value = outlineData.version;
              lastSavedContent.value = JSON.parse(JSON.stringify(freshContent));
              hasChanges.value = checkForChanges(outline.value);
              
              // Update localStorage with server version info
              const versionKey = getVersionKey();
              localStorage.setItem(versionKey, outlineData.version.toString());
              localStorage.setItem(`${getLocalStorageKey()}_last_saved`, JSON.stringify(freshContent));
              
              // Notify user of actual conflict
              ElNotification({
                title: 'Sync Conflict',
                message: 'Your local changes are different from the server. Your changes have been preserved.',
                type: 'warning',
                duration: 5000,
                showClose: true
              });
            }
          }
        }
      } catch (error) {
        console.error('❌ Error refreshing outline data:', error);
        
        throw error; // Re-throw for caller handling
      }
    }

    // Helper function to upload file to Gitea
    async function uploadFileToGitea(file, workspaceId) {
      const giteaToken = import.meta.env.VITE_GITEA_TOKEN;
      const giteaHost = import.meta.env.VITE_GITEA_HOST;
      
      if (!workspaceId) {
        throw new Error('No workspace ID found');
      }
      
      // Create repo name for the workspace
      const repoName = `Workspace_${workspaceId}_Outline`;
      
      // Try to create the repository if it doesn't exist
      try {
        await fetch(
          `${giteaHost}/api/v1/org/associateattorney/repos`,
          {
            method: 'POST',
            headers: {
              'Authorization': `token ${giteaToken}`,
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache'
            },
            body: JSON.stringify({
              name: repoName,
              description: `Outline files for Workspace ${workspaceId}`,
              private: true,
              auto_init: true,
              trust_model: 'collaborator'
            })
          }
        );
      } catch (error) {
        // Ignore 409 errors (repo already exists)
        if (!error.message.includes('409')) {
          throw error;
        }
      }

      // Generate unique filename
      const timestamp = Date.now();
      const uniqueFileName = `${timestamp}-${file.name}`;
      
      // Convert file to base64
      const base64Content = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        };
        reader.readAsDataURL(file);
      });

      // Upload to Gitea
      const response = await fetch(
        `${giteaHost}/api/v1/repos/associateattorney/${repoName}/contents/${uniqueFileName}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `token ${giteaToken}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          },
          body: JSON.stringify({
            message: `Upload ${uniqueFileName}`,
            content: base64Content,
            branch: 'main'
          })
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('File upload response:', data);
      
      // Return the raw download URL
      return data.content.download_url;
    }

    // Manual refresh function for user-triggered sync
    async function manualRefresh() {
      if (refreshing.value) return;
      
      refreshing.value = true;
      try {
        console.log('🔄 Manual refresh triggered');
        await refreshOutlineData();
        
        ElNotification({
          title: 'Sync Complete',
          message: 'Outline has been synced with server',
          type: 'success',
          duration: 2000
        });
      } catch (error) {
        console.error('❌ Manual refresh failed:', error);
        // Error notification is already shown in refreshOutlineData
      } finally {
        refreshing.value = false;
      }
    }

    // Check if current version matches server version
    async function checkVersionBeforeEdit() {
      if (!outlineId.value) {
        // No outline saved yet, safe to edit
        return { canEdit: true };
      }

      try {
        const { data: serverOutline, error: serverCheckError } = await supabase
          .from('outlines')
          .select('version')
          .eq('id', outlineId.value)
          .single();

        if (serverCheckError) {
          console.error('❌ Error checking server version:', serverCheckError);
          // Allow editing but warn user
          return { 
            canEdit: true, 
            warning: 'Could not verify latest version. Your changes might conflict with others.' 
          };
        }

        if (serverOutline.version > currentVersion.value) {
          console.log('⚠️ Outdated version detected before edit');
          return {
            canEdit: false,
            isOutdated: true,
            serverVersion: serverOutline.version,
            currentVersion: currentVersion.value,
            message: `Outline update required: ${serverOutline.version - currentVersion.value} new changes detected.`
          };
        }

        // Version is current, safe to edit
        return { canEdit: true };
      } catch (error) {
        console.error('❌ Error in version check:', error);
        // Allow editing but warn user
        return { 
          canEdit: true, 
          warning: 'Could not verify latest version. Your changes might conflict with others.' 
        };
      }
    }

    // Handle version conflict with user choice
    async function handleVersionConflict(versionCheck) {
      return new Promise((resolve) => {
        // GitHub-style conflict message that forces reload
        const conflictMessage = `⚠️ **Conflict Detected**

The outline has been updated by another user while you were away.

**Your version:** ${versionCheck.currentVersion}
**Latest version:** ${versionCheck.serverVersion}

To prevent data loss and conflicts, you need to reload the latest changes before editing.

This is similar to how Git requires you to pull before pushing when there are conflicts.`;

        ElMessageBox.confirm(
          conflictMessage,
          '🔄 Update Required - Reload Latest Version',
          {
            confirmButtonText: '🔄 Reload Latest Version',
            cancelButtonText: 'Cancel',
            distinguishCancelAndClose: false,
            type: 'warning',
            closeOnClickModal: false,
            closeOnPressEscape: false,
            showClose: false,
            dangerouslyUseHTMLString: false,
            customStyle: {
              width: '500px'
            }
          }
        ).then(async () => {
          // User chose to reload
          try {
            refreshing.value = true;
            await refreshOutlineData();
            ElNotification({
              title: '✅ Updated Successfully',
              message: 'Outline has been reloaded with the latest changes. You can now edit safely.',
              type: 'success',
              duration: 4000
            });
            resolve({ canEdit: true, reloaded: true });
          } catch (error) {
            console.error('❌ Failed to reload:', error);
            ElNotification({
              title: '❌ Reload Failed',
              message: 'Could not reload latest version. Please refresh the page manually.',
              type: 'error',
              duration: 7000,
              showClose: true
            });
            resolve({ canEdit: false });
          } finally {
            refreshing.value = false;
          }
        }).catch(() => {
          // User cancelled - no editing allowed
          ElNotification({
            title: 'Edit Cancelled',
            message: 'Please reload the latest version before editing to avoid conflicts.',
            type: 'info',
            duration: 4000
          });
          resolve({ canEdit: false });
        });
      });
    }

          // Search functionality
      const searchTimer = ref(null);

         function handleSearchInput() {
       if (searchTimer.value) {
         clearTimeout(searchTimer.value);
       }
       searchTimer.value = setTimeout(() => {
         updateSearchStats();
       }, 300); // Debounce time
     }

     function clearSearch() {
       searchQuery.value = '';
       searchStats.value = { matches: 0, items: 0 };
     }

     function updateSearchStats() {
       if (!searchQuery.value || !searchQuery.value.trim()) {
         searchStats.value = { matches: 0, items: 0 };
         return;
       }

       const query = searchQuery.value.toLowerCase();
       let matchCount = 0;

       function countMatches(items) {
         for (const item of items) {
           const itemText = getCleanText(item.text).toLowerCase();
           if (itemText.includes(query)) {
             matchCount++;
           }
           
           if (item.children && item.children.length) {
             countMatches(item.children);
           }
         }
       }

       countMatches(outline.value);
       
       // Count how many items are shown in filtered results
       const filteredOutline = getFilteredOutline();
       let shownItemCount = 0;
       
       function countShownItems(items) {
         for (const item of items) {
           shownItemCount++;
           if (item.children && item.children.length) {
             countShownItems(item.children);
           }
         }
       }
       
       countShownItems(filteredOutline);
       
       searchStats.value = { matches: matchCount, items: shownItemCount };
     }

    // Method to generate new outline URL
    const getNewOutlineUrl = () => {
      const currentPath = route.fullPath;
      return `https://outline.aiworkspace.pro${currentPath}`;
    };

    return { 
      workspaceId,
      outline, 
      saving,
      refreshing,
      hasChanges,
      outlineRenderID,
      displayVersion,
      lastSaveTime,
      currentWorkspace,
      workspaceName,
      updatePageTitle,
      onOutlineUpdate, 
      handleMove, 
      handleDelete,
      saveOutline,
      manualRefresh,
      checkVersionBeforeEdit,
      handleVersionConflict,
      getNewOutlineUrl,
      // Drilldown
      focusedId,
      handleDrilldown,
      handleBack,
      getFocusedOutline,
      // Breadcrumbs
      breadcrumbPath,
      handleBreadcrumb,
      getBreadcrumbText,
      openHistoryDialog,
      historyDialogVisible,
      viewVersionDialogVisible,
      versionHistory,
      loadingHistory,
      selectedVersion,
      viewVersion,
      formatDate,
      handleNavigate,
      handleIndent,
      handleOutdent,
      handleAddSiblingRoot,
      isNodeCollapsed,
      handleCollapseToggle,
              // Search
        searchQuery,
        searchStats,
        handleSearchInput,
        clearSearch,
    };
  }
};
</script>

<style scoped>
/* Page moved alert styling */
.page-moved-alert {
  margin-bottom: 2rem;
}

.moved-link {
  color: var(--el-color-primary);
  text-decoration: none;
  font-weight: 500;
}

.moved-link:hover {
  text-decoration: underline;
}

.outline-container {
  background: white;
  border-radius: 8px;
  padding: 2rem;
  min-height: 200px;
}

.outline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.outline-actions {
  display: flex;
  align-items: center;
}

.search-container {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: 16px;
}

.search-input {
  flex-shrink: 0;
}

.search-input :deep(.el-input__wrapper) {
  border-radius: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.search-input :deep(.el-input__wrapper):hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.search-stats {
  font-size: 0.85em;
  color: #666;
  white-space: nowrap;
  background: #f0f2f5;
  padding: 4px 8px;
  border-radius: 12px;
  font-weight: 500;
}

.sync-status {
  display: flex;
  align-items: center;
  font-size: 0.9em;
}

.outline-list {
  list-style: none;
  padding-left: 0;
  margin: 0;
}

.outline-breadcrumbs {
  margin-bottom: 1rem;
  font-size: 0.95rem;
  color: #888;
}
.breadcrumb-link {
  cursor: pointer;
  color: #1976d2;
  text-decoration: none;
}
.breadcrumb-link[style*='bold'] {
  color: #23272f;
  text-decoration: none;
  cursor: default;
}

.version-content {
  max-height: 600px;
  overflow-y: auto;
}

.version-info {
  margin-bottom: 1rem;
  padding: 1rem;
  background: #f5f7fa;
  border-radius: 4px;
}

.version-info p {
  margin: 0.5rem 0;
}

.version-outline {
  margin-top: 1rem;
}

.search-results-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  margin-bottom: 16px;
  font-size: 0.9em;
}

.search-icon {
  color: #6c757d;
  font-size: 16px;
}

.search-results-text {
  flex: 1;
  color: #495057;
}

.search-results-text strong {
  color: #212529;
  font-weight: 600;
}

.clear-search-btn {
  font-size: 0.85em;
  padding: 4px 8px;
}
</style> 