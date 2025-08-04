import { defineStore } from 'pinia';
import { supabase } from '../supabase';

export const useMatterStore = defineStore('workspace', {
  state: () => ({
    currentMatter: null,
    workspaces: []
  }),

  persist: {
    storage: localStorage,
    paths: ['currentMatter']
  },

  actions: {
    setCurrentMatter(workspace) {
      this.currentMatter = workspace;
    },

    async loadMatters(includeArchived = false) {
      try {
        // Get the current user first
        const { data: { user } } = await supabase.auth.getUser();
        
        // First, get all workspaces that the user has access to
        const { data: userWorkspaces, error: userError } = await supabase
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
          .eq('archived', includeArchived ? null : false)
          .eq('workspace_access.shared_with_user_id', user.id);

        if (userError) throw userError;

        // Create a map of user's access
        const userAccess = new Map();
        userWorkspaces.forEach(workspace => {
          const access = workspace.workspace_access.find(acc => acc.shared_with_user_id === user.id);
          if (access) {
            userAccess.set(workspace.id, access);
          }
        });

        // Get parent workspace IDs that we need to show for tree structure
        const parentIds = [...new Set(
          userWorkspaces
            .filter(w => w.parent_workspace_id)
            .map(w => w.parent_workspace_id)
            .filter(id => !userAccess.has(id)) // Only get parents we don't already have access to
        )];

        // Get parent workspaces for tree structure (even if user doesn't have access)
        let parentWorkspaces = [];
        if (parentIds.length > 0) {
          const { data: parents, error: parentError } = await supabase
            .from('workspaces')
            .select('*')
            .in('id', parentIds)
            .eq('archived', includeArchived ? null : false);
          
          if (parentError) throw parentError;
          parentWorkspaces = parents || [];
        }

        // Combine all workspaces
        const allWorkspaces = [...userWorkspaces, ...parentWorkspaces];

        // Process workspaces and add latest activity and access info
        const workspacesWithActivity = allWorkspaces.map(workspace => ({
          ...workspace,
          latest_activity: workspace.workspace_activities?.[0]?.updated_at || workspace.created_at,
          hasAccess: userAccess.has(workspace.id),
          accessType: userAccess.get(workspace.id)?.access_type || null
        }));

        // Sort by latest activity
        workspacesWithActivity.sort((a, b) => {
          const dateA = new Date(a.latest_activity);
          const dateB = new Date(b.latest_activity);
          return dateB - dateA; // Most recent first
        });

        this.workspaces = workspacesWithActivity;
        return this.workspaces;
      } catch (error) {
        console.error('Error loading workspaces:', error);
        throw error;
      }
    }
  },

  getters: {
    getCurrentMatter: (state) => state.currentMatter
  }
}); 