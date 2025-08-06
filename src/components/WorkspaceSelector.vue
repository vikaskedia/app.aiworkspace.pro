<script>
import { ref, onMounted, watch, computed } from 'vue';
import { supabase } from '../supabase';
import { ElMessage } from 'element-plus';
import { useRouter, useRoute } from 'vue-router';
import { useWorkspaceStore } from '../store/workspace';
import { storeToRefs } from 'pinia';
import { CaretBottom, More, FolderOpened, Document } from '@element-plus/icons-vue';

export default {
  components: {
    CaretBottom,
    More,
    FolderOpened,
    Document
  },
  emits: ['workspace-selected'],
  setup(props, { emit }) {
    const workspaces = ref([]);
    const workspaceTree = ref([]);
    const userAccessMap = ref(new Map()); // Track which workspaces user has access to
    const selectedWorkspace = ref(null);
    const dialogVisible = ref(false);
    const searchQuery = ref('');
    const newWorkspace = ref({
      title: '',
      description: '',
      parentWorkspaceId: null
    });
    const router = useRouter();
    const route = useRoute();
    const workspaceStore = useWorkspaceStore();
    const { currentWorkspace } = storeToRefs(workspaceStore);

    // Watch for changes in the store's currentWorkspace
    watch(currentWorkspace, (newWorkspace) => {
      selectedWorkspace.value = newWorkspace;
    });

    // Computed property for filtered workspaces based on search query
    const filteredWorkspaces = computed(() => {
      const flattened = flattenTree(renderWorkspaceTree(workspaceTree.value));
      if (!searchQuery.value.trim()) {
        return flattened;
      }
      
      const query = searchQuery.value.toLowerCase();
      return flattened.filter(workspace => 
        workspace.title.toLowerCase().includes(query)
      );
    });

    // Show "All Workspaces" option only if search query is empty or matches
    const showAllWorkspacesOption = computed(() => {
      if (!searchQuery.value.trim()) return true;
      return 'all workspaces'.includes(searchQuery.value.toLowerCase());
    });

    // Handle dropdown visibility changes
    const handleDropdownVisibleChange = (visible) => {
      if (!visible) {
        // Clear search when dropdown closes
        searchQuery.value = '';
      }
    };

    const buildWorkspaceTree = (workspacesList, userAccess) => {
      const workspaceMap = new Map();
      const rootWorkspaces = [];
      
      // Create a map of all workspaces
      workspacesList.forEach(workspace => {
        workspaceMap.set(workspace.id, {
          ...workspace,
          children: [],
          hasAccess: userAccess.has(workspace.id),
          accessType: userAccess.get(workspace.id)?.access_type || null
        });
      });
      
      // Build the tree structure
      workspacesList.forEach(workspace => {
        const workspaceNode = workspaceMap.get(workspace.id);
        
        if (workspace.parent_workspace_id) {
          const parent = workspaceMap.get(workspace.parent_workspace_id);
          if (parent) {
            parent.children.push(workspaceNode);
          } else {
            // Parent not in our list, treat as root
            rootWorkspaces.push(workspaceNode);
          }
        } else {
          rootWorkspaces.push(workspaceNode);
        }
      });
      
      return rootWorkspaces;
    };

    const loadWorkspaces = async () => {
      try {
        // Use the store's improved loadWorkspaces method
        const workspacesWithActivity = await workspaceStore.loadWorkspaces();
        workspaces.value = workspacesWithActivity;
        
        // Create userAccessMap from the workspace data
        const userAccess = new Map();
        workspacesWithActivity.forEach(workspace => {
          if (workspace.hasAccess) {
            userAccess.set(workspace.id, { access_type: workspace.accessType });
          }
        });
        userAccessMap.value = userAccess;
        
        // Build tree structure
        workspaceTree.value = buildWorkspaceTree(workspacesWithActivity, userAccess);

        // After loading workspaces, check URL for workspace ID first
        const workspaceId = route.params.workspaceId;
        if (workspaceId) {
          const workspace = workspacesWithActivity.find(m => m.id === parseInt(workspaceId));
          if (workspace && workspace.hasAccess) {
            selectedWorkspace.value = workspace;
            workspaceStore.setCurrentWorkspace(workspace);
            emit('workspace-selected', workspace);
            return; // Exit early since we found workspace from URL
          }
        }

        // If no workspace from URL, validate currentWorkspace from store
        if (currentWorkspace.value) {
          const storedWorkspace = workspacesWithActivity.find(m => m.id === currentWorkspace.value.id);
          if (storedWorkspace && storedWorkspace.hasAccess) {
            // Current workspace is valid, update with fresh data
            selectedWorkspace.value = storedWorkspace;
            workspaceStore.setCurrentWorkspace(storedWorkspace);
            emit('workspace-selected', storedWorkspace);
          } else {
            // Current workspace is no longer valid, clear it
            selectedWorkspace.value = null;
            workspaceStore.setCurrentWorkspace(null);
          }
        }
      } catch (error) {
        ElMessage.error('Error loading workspaces: ' + error.message);
      }
    };

    const createWorkspace = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        // Generate repository name - lowercase, no spaces, with timestamp
        const repoName = `${newWorkspace.value.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`;
        const emailStorage = `${repoName}@associateattorney.ai`;

        // Create repository in Gitea
        const giteaHost = import.meta.env.VITE_GITEA_HOST;
        const giteaToken = import.meta.env.VITE_GITEA_TOKEN;

        const createRepoResponse = await fetch(
          `${giteaHost}/api/v1/org/associateattorney/repos`,
          {
            method: 'POST',
            headers: {
              'Authorization': `token ${giteaToken}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Cache-Control': 'no-cache'
            },
            body: JSON.stringify({
              name: repoName,
              description: newWorkspace.value.description,
              private: true,
              auto_init: true
            })
          }
        );

        if (!createRepoResponse.ok) {
          throw new Error('Failed to create Gitea repository');
        }

        // Create workspace in database with repository info
        const { data, error } = await supabase
          .from('workspaces')
          .insert([{
            title: newWorkspace.value.title,
            description: newWorkspace.value.description,
            created_by: user.id,
            git_repo: repoName,
            email_storage: emailStorage,
            parent_workspace_id: newWorkspace.value.parentWorkspaceId
          }])
          .select()
          .single();

        if (error) throw error;

        // Reload workspaces to get updated tree
        await loadWorkspaces();
        
        // Close dialog and reset form
        dialogVisible.value = false;
        newWorkspace.value = { title: '', description: '', parentWorkspaceId: null };
        ElMessage.success('Workspace created successfully');

        // Select the newly created workspace
        selectedWorkspace.value = data;
        emit('workspace-selected', data);
      } catch (error) {
        if (error.message.includes('JWT')) {
          ElMessage.error('Your session has expired. Please log in again.');
        } else {
          ElMessage.error('Error creating workspace: ' + error.message);
        }
      }
    };

    const handleWorkspaceClick = (workspace) => {

      if (workspace === null) {
        selectedWorkspace.value = null;
        workspaceStore.setCurrentWorkspace(null);
        router.push('/all-workspace/tasks');
      } else {
        // Check if user has access to this workspace
        if (!userAccessMap.value.has(workspace.id)) {
          ElMessage.warning(`You don't have access to "${workspace.title}". Please contact the workspace owner for access.`);
          return;
        }
        selectedWorkspace.value = workspace;
        workspaceStore.setCurrentWorkspace(workspace);
        
        // Get the current route path segments
        const currentPath = route.path;
        
        // If we're in all-workspaces/tasks or any tasks view, always go to tasks
        if (currentPath.includes('/tasks')) {
          router.push(`/single-workspace/${workspace.id}/tasks`);
          return;
        }
        
        // For other routes, preserve the current section
        const segments = currentPath.split('/');
        const lastSegment = segments[segments.length - 1];
        
        switch(lastSegment) {
          case 'goals':
            router.push(`/single-workspace/${workspace.id}/goals`);
            break;
          case 'events':
            router.push(`/single-workspace/${workspace.id}/events`);
            break;
          case 'files':
            router.push(`/single-workspace/${workspace.id}/files`);
            break;
          default:
            router.push(`/single-workspace/${workspace.id}/tasks`); // Default to tasks instead of dashboard
        }
        
        emit('workspace-selected', workspace);
      }
    };

    const handleWorkspaceSelect = (workspace) => {
      handleWorkspaceClick(workspace);
    };

    const handleWorkspaceCommand = (command) => {
      if (!selectedWorkspace.value) return;
      
      switch(command) {
        case 'dashboard':
          router.push(`/single-workspace/${selectedWorkspace.value.id}`);
          break;
        case 'goals':
          router.push(`/single-workspace/${selectedWorkspace.value.id}/goals`);
          break;
        case 'tasks':
          router.push(`/single-workspace/${selectedWorkspace.value.id}/tasks`);
          break;
        case 'events':
          router.push(`/single-workspace/${selectedWorkspace.value.id}/events`);
          break;
        case 'files':
          router.push(`/single-workspace/${selectedWorkspace.value.id}/files`);
          break;
        case 'settings':
          router.push(`/single-workspace/${selectedWorkspace.value.id}/settings`);
          break;
      }
    };

    const renderWorkspaceTree = (workspaceNodes, level = 0) => {
      return workspaceNodes.map(workspace => ({
        ...workspace,
        level,
        children: workspace.children ? renderWorkspaceTree(workspace.children, level + 1) : []
      }));
    };

    const flattenTree = (tree) => {
      const result = [];
      const traverse = (nodes) => {
        nodes.forEach(node => {
          result.push(node);
          if (node.children && node.children.length > 0) {
            traverse(node.children);
          }
        });
      };
      traverse(tree);
      return result;
    };

    onMounted(() => {
      // Initialize selected workspace from store if available
      if (currentWorkspace.value) {
        selectedWorkspace.value = currentWorkspace.value;
      }
      loadWorkspaces();
    });

    return {
      workspaces,
      workspaceTree,
      userAccessMap,
      selectedWorkspace,
      dialogVisible,
      searchQuery,
      newWorkspace,
      createWorkspace,
      handleWorkspaceSelect,
      handleWorkspaceCommand,
      handleWorkspaceClick,
      renderWorkspaceTree,
      flattenTree,
      route,
      filteredWorkspaces,
      showAllWorkspacesOption,
      handleDropdownVisibleChange
    };
  }
};
</script>

<template>
  <div class="workspace-selector">
    <el-dropdown trigger="click" @visible-change="handleDropdownVisibleChange">
      <span class="workspace-dropdown-link">
        {{ selectedWorkspace?.title || 'All Workspaces' }}
        <el-icon><caret-bottom /></el-icon>
      </span>
      
      <template #dropdown>
        <el-dropdown-menu class="workspace-dropdown-menu">
          <div class="search-container">
            <el-input
              v-model="searchQuery"
              placeholder="Search workspaces..."
              size="small"
              clearable
              @click.stop
              @keydown.stop
              class="workspace-search"
            />
          </div>
          
          <el-dropdown-item @click="handleWorkspaceClick(null)" v-if="showAllWorkspacesOption">
            <div class="workspace-item">
              <el-icon><document /></el-icon>
              <span>All Workspaces</span>
            </div>
          </el-dropdown-item>
          <el-dropdown-item divided v-if="showAllWorkspacesOption && filteredWorkspaces.length > 0" />
          
          <template v-for="workspace in filteredWorkspaces" :key="workspace.id">
            <el-dropdown-item @click="handleWorkspaceClick(workspace)">
              <div class="workspace-item" :class="{ 'no-access': !workspace.hasAccess }" :style="{ paddingLeft: (workspace.level * 20) + 'px' }">
                <el-icon>
                  <folder-opened v-if="workspace.children && workspace.children.length > 0" />
                  <document v-else />
                </el-icon>
                <span :class="{ 'no-access-text': !workspace.hasAccess }">
                  {{ workspace.title }}
                </span>
              </div>
            </el-dropdown-item>
          </template>
          
          <el-dropdown-item divided @click="dialogVisible = true" v-if="filteredWorkspaces.length > 0 || showAllWorkspacesOption">
            <div class="workspace-item">
              <el-icon><more /></el-icon>
              <span>New Workspace</span>
            </div>
          </el-dropdown-item>
          
          <div v-if="!showAllWorkspacesOption && filteredWorkspaces.length === 0" class="no-results">
            No workspaces found
          </div>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
  
  <el-dialog
    v-model="dialogVisible"
    title="Create New Workspace"
    width="500px">
    <el-form :model="newWorkspace" label-position="top">
      <el-form-item label="Title" required>
        <el-input v-model="newWorkspace.title" placeholder="Enter workspace title" />
      </el-form-item>
      
      <el-form-item label="Description">
        <el-input
          v-model="newWorkspace.description"
          type="textarea"
          rows="3"
          placeholder="Enter workspace description" />
      </el-form-item>
      
      <el-form-item label="Parent Workspace (Optional)">
        <el-select 
          v-model="newWorkspace.parentWorkspaceId" 
          placeholder="Select parent workspace"
          clearable
          style="width: 100%">
          <template v-for="workspace in flattenTree(renderWorkspaceTree(workspaceTree))" :key="workspace.id">
            <el-option
              v-if="workspace.hasAccess && workspace.accessType === 'edit'"
              :label="workspace.title"
              :value="workspace.id"
              :style="{ paddingLeft: (workspace.level * 20) + 'px' }">
              <div class="workspace-option">
                <el-icon>
                  <folder-opened v-if="workspace.children && workspace.children.length > 0" />
                  <document v-else />
                </el-icon>
                <span>{{ workspace.title }}</span>
              </div>
            </el-option>
          </template>
        </el-select>
        <div class="form-help-text">
          Only workspaces where you have edit access can be selected as parent workspaces.
        </div>
      </el-form-item>
    </el-form>
    
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="dialogVisible = false">Cancel</el-button>
        <el-button
          type="primary"
          :disabled="!newWorkspace.title"
          @click="createWorkspace">
          Create Workspace
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<style scoped>
.workspace-selector {
  display: flex;
  align-items: center;
  gap: 8px;
}

.workspace-dropdown-link {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.workspace-dropdown-link:hover {
  background-color: rgba(0, 0, 0, 0.03);
}

.workspace-dropdown-menu {
  max-height: 400px;
  overflow-y: auto;
  min-width: 250px;
}

.search-container {
  padding: 8px 12px;
  border-bottom: 1px solid #ebeef5;
  margin-bottom: 4px;
}

.workspace-search {
  width: 100%;
}

:deep(.workspace-search .el-input__wrapper) {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.no-results {
  padding: 12px;
  text-align: center;
  color: #909399;
  font-size: 14px;
}

.workspace-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  position: relative;
  padding: 4px 0;
}

.workspace-item .el-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.workspace-item span {
  flex: 1;
}

.workspace-item.no-access {
  opacity: 0.6;
}

.no-access-text {
  color: #999 !important;
}

.access-badge {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 10px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.access-badge.view {
  background-color: #e6f7ff;
  color: #1890ff;
  border: 1px solid #91d5ff;
}

.access-badge.edit {
  background-color: #f6ffed;
  color: #52c41a;
  border: 1px solid #b7eb8f;
}

.no-access-badge {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 10px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background-color: #fff2f0;
  color: #ff4d4f;
  border: 1px solid #ffccc7;
}

.workspace-option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.workspace-option .el-icon {
  font-size: 14px;
}

.form-help-text {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
  line-height: 1.4;
}

:deep(.el-dropdown-menu__item) {
  line-height: 1.4;
}

:deep(.el-dropdown-menu__item:hover) {
  background-color: rgba(0, 0, 0, 0.04);
}

:deep(.el-dropdown-menu__item.is-divided) {
  border-top: 1px solid #e4e7ed;
  margin-top: 6px;
  padding-top: 8px;
}




</style> 