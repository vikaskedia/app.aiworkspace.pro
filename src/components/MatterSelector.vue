<script>
import { ref, onMounted, watch } from 'vue';
import { supabase } from '../supabase';
import { ElMessage } from 'element-plus';
import { useRouter, useRoute } from 'vue-router';
import { useMatterStore } from '../store/matter';
import { storeToRefs } from 'pinia';
import { CaretBottom, More } from '@element-plus/icons-vue';

export default {
  components: {
    CaretBottom,
    More
  },
  emits: ['matter-selected'],
  setup(props, { emit }) {
    const workspaces = ref([]);
    const selectedMatter = ref(null);
    const dialogVisible = ref(false);
    const newMatter = ref({
      title: '',
      description: ''
    });
    const router = useRouter();
    const route = useRoute();
    const matterStore = useMatterStore();
    const { currentMatter } = storeToRefs(matterStore);

    // Watch for changes in the store's currentMatter
    watch(currentMatter, (newMatter) => {
      selectedMatter.value = newMatter;
    });

    const loadMatters = async () => {
      try {
        // Get the current user first
        const { data: { user } } = await supabase.auth.getUser();
        
        // Get all workspaces that the user has access to with their activity in a single query
        const { data: workspacesData, error } = await supabase
          .from('workspaces')
          .select(`
            *,
           workspace_access!inner (
              access_type,
              shared_with_user_id
            ),
            workspace_activities!left (
              updated_at
            )
          `)
          .eq('archived', false)
          .eq('workspace_access.shared_with_user_id', user.id)
          .eq('workspace_activities.user_id', user.id);

        if (error) throw error;

        // Process workspaces and add latest activity
        const workspacesWithActivity = workspacesData.map(matter => ({
          ...matter,
          latest_activity: matter.workspace_activities?.[0]?.updated_at || matter.created_at
        }));

        // Sort by latest activity (most recent first)
        workspacesWithActivity.sort((a, b) => {
          const dateA = new Date(a.latest_activity);
          const dateB = new Date(b.latest_activity);
          return dateB - dateA;
        });

        workspaces.value = workspacesWithActivity;

        // After loading workspaces, check URL for matter ID
        const matterId = route.params.matterId;
        if (matterId) {
          const matter = workspaces.value.find(m => m.id === parseInt(matterId));
          if (matter) {
            selectedMatter.value = matter;
            emit('matter-selected', matter);
          }
        }
      } catch (error) {
        ElMessage.error('Error loading workspaces: ' + error.message);
      }
    };

    const createMatter = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        // Generate repository name - lowercase, no spaces, with timestamp
        const repoName = `${newMatter.value.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`;
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
              description: newMatter.value.description,
              private: true,
              auto_init: true
            })
          }
        );

        if (!createRepoResponse.ok) {
          throw new Error('Failed to create Gitea repository');
        }

        // Create matter in database with repository info
        const { data, error } = await supabase
          .from('workspaces')
          .insert([{
            title: newMatter.value.title,
            description: newMatter.value.description,
            created_by: user.id,
            git_repo: repoName,
            email_storage: emailStorage
          }])
          .select()
          .single();

        if (error) throw error;

        // Add the new matter to the list
        workspaces.value.unshift(data);
        
        // Close dialog and reset form
        dialogVisible.value = false;
        newMatter.value = { title: '', description: '' };
        ElMessage.success('Workspace created successfully');

        // Select the newly created matter
        selectedMatter.value = data;
        emit('matter-selected', data);
      } catch (error) {
        if (error.message.includes('JWT')) {
          ElMessage.error('Your session has expired. Please log in again.');
        } else {
          ElMessage.error('Error creating matter: ' + error.message);
        }
      }
    };

    const handleMatterSelect = (matter) => {
      if (matter === null) {
        selectedMatter.value = null;
        matterStore.setCurrentMatter(null);
        router.push('/all-workspace/tasks');
      } else {
        selectedMatter.value = matter;
        matterStore.setCurrentMatter(matter);
        
        // Get the current route path segments
        const currentPath = route.path;
        
        // If we're in all-workspaces/tasks or any tasks view, always go to tasks
        if (currentPath.includes('/tasks')) {
          router.push(`/single-workspace/${matter.id}/tasks`);
          return;
        }
        
        // For other routes, preserve the current section
        const segments = currentPath.split('/');
        const lastSegment = segments[segments.length - 1];
        
        switch(lastSegment) {
          case 'goals':
            router.push(`/single-workspace/${matter.id}/goals`);
            break;
          case 'events':
            router.push(`/single-workspace/${matter.id}/events`);
            break;
          case 'files':
            router.push(`/single-workspace/${matter.id}/files`);
            break;
          default:
            router.push(`/single-workspace/${matter.id}/tasks`); // Default to tasks instead of dashboard
        }
        
        emit('matter-selected', matter);
      }
    };

    const handleMatterCommand = (command) => {
      if (!selectedMatter.value) return;
      
      switch(command) {
        case 'dashboard':
          router.push(`/single-workspace/${selectedMatter.value.id}`);
          break;
        case 'goals':
          router.push(`/single-workspace/${selectedMatter.value.id}/goals`);
          break;
        case 'tasks':
          router.push(`/single-workspace/${selectedMatter.value.id}/tasks`);
          break;
        case 'events':
          router.push(`/single-workspace/${selectedMatter.value.id}/events`);
          break;
        case 'files':
          router.push(`/single-workspace/${selectedMatter.value.id}/files`);
          break;
        case 'settings':
          router.push(`/single-workspace/${selectedMatter.value.id}/settings`);
          break;
      }
    };

    onMounted(() => {
      loadMatters();
    });

    return {
      workspaces,
      selectedMatter,
      dialogVisible,
      newMatter,
      createMatter,
      handleMatterSelect,
      handleMatterCommand,
      route
    };
  }
};
</script>

<template>
  <div class="matter-selector">
    <el-dropdown trigger="click">
      <span class="matter-dropdown-link">
        {{ selectedMatter?.title || 'All Workspaces' }}
        <el-icon><caret-bottom /></el-icon>
      </span>
      
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item>
            <a href="/all-workspace/tasks">All Workspaces</a>
          </el-dropdown-item>
          <el-dropdown-item divided />
          <el-dropdown-item
            v-for="matter in workspaces"
            :key="matter.id">
            <a :href="`/single-workspace/${matter.id}/tasks`">{{ matter.title }}</a>
          </el-dropdown-item>
          <el-dropdown-item divided @click="dialogVisible = true">
            New Workspace
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
  <el-dialog
    v-model="dialogVisible"
    title="Create New Workspace"
    width="500px">
    <el-form :model="newMatter" label-position="top">
      <el-form-item label="Title" required>
        <el-input v-model="newMatter.title" placeholder="Enter matter title" />
      </el-form-item>
      
      <el-form-item label="Description">
        <el-input
          v-model="newMatter.description"
          type="textarea"
          rows="3"
          placeholder="Enter matter description" />
      </el-form-item>
    </el-form>
    
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="dialogVisible = false">Cancel</el-button>
        <el-button
          type="primary"
          :disabled="!newMatter.title"
          @click="createMatter">
          Create Workspace
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<style scoped>
.matter-selector {
  display: flex;
  align-items: center;
  gap: 8px;
}

.matter-dropdown-link {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.matter-dropdown-link:hover {
  background-color: rgba(0, 0, 0, 0.03);
}

:deep(.el-dropdown-menu__item a) {
  text-decoration: none;
  color: inherit;
  display: block;
  width: 100%;
  height: 100%;
}
</style> 