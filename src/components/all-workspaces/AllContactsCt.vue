<template>
  <div class="all-contacts-container">
    <div class="all-contacts-header">
      <div class="header-actions">
        <el-button 
          plain
          @click="showFilters = !showFilters">
          {{ showFilters ? 'Hide Filters' : 'Show Filters' }}
        </el-button>
      </div>
    </div>

    <!-- Collapsible Filters Section -->
    <el-collapse-transition>
      <div v-show="showFilters" class="filters-section">
        <div class="filters-container">
          <el-input
            v-model="searchQuery"
            placeholder="Search contacts..."
            prefix-icon="Search"
            clearable
            style="width: 300px; margin-right: 1rem;"
          />
          <el-select
            v-model="selectedWorkspace"
            placeholder="Filter by workspace"
            clearable
            style="width: 250px; margin-right: 1rem;"
          >
            <el-option
              v-for="workspace in workspaces"
              :key="workspace.id"
              :label="workspace.title"
              :value="workspace.id"
            />
          </el-select>
          <el-select
            v-model="selectedTag"
            placeholder="Filter by tag"
            clearable
            style="width: 200px;"
          >
            <el-option
              v-for="tag in availableTags"
              :key="tag"
              :label="tag"
              :value="tag"
            />
          </el-select>
          <el-button 
            plain
            @click="clearFilters"
            :disabled="!hasActiveFilters"
          >
            Clear
        </el-button>
        </div>
      </div>
    </el-collapse-transition>

    <!-- Contacts Table -->
    <div class="all-contacts-table" v-loading="loading">
      <el-table 
        :data="filteredContacts" 
        style="width: 100%"
        :empty-text="loading ? 'Loading...' : 'No contacts found'"
      >
        <el-table-column prop="name" label="Name" min-width="200" sortable>
          <template #default="{ row }">
            <div class="contact-name">
              <span>{{ row.name }}</span>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column prop="phone_number" label="Phone Number" min-width="150">
          <template #default="{ row }">
            <span v-if="row.phone_number">{{ row.phone_number }}</span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="tags" label="Tags" min-width="200">
          <template #default="{ row }">
            <el-tag 
              v-for="tag in row.tags" 
              :key="tag" 
              size="small" 
              type="info"
              class="tag"
            >
              {{ tag }}
            </el-tag>
            <span v-if="!row.tags || row.tags.length === 0" class="text-muted">-</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="workspace_title" label="Workspace" min-width="200" sortable>
          <template #default="{ row }">
            <span class="workspace-name">{{ row.workspace_title }}</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="created_at" label="Created" min-width="120" sortable>
          <template #default="{ row }">
            <span>{{ formatDate(row.created_at) }}</span>
          </template>
        </el-table-column>
        
        <!-- <el-table-column label="Actions" width="120" fixed="right">
          <template #default="{ row }">
            <div class="action-buttons">
              <el-button 
                type="primary" 
                size="small" 
                @click="viewContact(row)"
                title="View Details"
              >
                View
              </el-button>
            </div>
          </template>
        </el-table-column> -->
      </el-table>
    </div>

    <!-- Contact Details Dialog (for future use) -->
    <el-dialog
      v-model="contactDetailsVisible"
      title="Contact Details"
      width="600px"
    >
      <div v-if="selectedContact" class="contact-details">
        <div class="detail-row">
          <label>Name:</label>
          <span>{{ selectedContact.name }}</span>
        </div>
        <div class="detail-row">
          <label>Phone Number:</label>
          <span>{{ selectedContact.phone_number || '-' }}</span>
        </div>
        <div class="detail-row">
          <label>Tags:</label>
          <div class="tags-container">
            <el-tag 
              v-for="tag in selectedContact.tags" 
              :key="tag" 
              size="small" 
              type="info"
              class="tag"
            >
              {{ tag }}
            </el-tag>
            <span v-if="!selectedContact.tags || selectedContact.tags.length === 0" class="text-muted">No tags</span>
          </div>
        </div>
        <div class="detail-row">
          <label>Workspace:</label>
          <span>{{ selectedContact.workspace_title }}</span>
        </div>
        <div class="detail-row">
          <label>Created:</label>
          <span>{{ formatDate(selectedContact.created_at) }}</span>
        </div>
      </div>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="contactDetailsVisible = false">Close</el-button>
          <!-- Future edit button will go here -->
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { supabase } from '../../supabase';
import { ElMessage } from 'element-plus';
import { Search, ArrowUp, ArrowDown } from '@element-plus/icons-vue';

export default {
  name: 'AllContactsCt',
  components: {
    Search,
    ArrowUp,
    ArrowDown
  },
  data() {
    return {
      contacts: [],
      workspaces: [],
      loading: false,
      searchQuery: '',
      selectedWorkspace: null,
      selectedTag: null,
      contactDetailsVisible: false,
      selectedContact: null,
      subscription: null,
      showFilters: false,
      hasActiveFilters: false
    };
  },
  computed: {
    availableTags() {
      const allTags = new Set();
      this.contacts.forEach(contact => {
        if (contact.tags) {
          contact.tags.forEach(tag => allTags.add(tag));
        }
      });
      return Array.from(allTags).sort();
    },
    hasActiveFilters() {
      return this.searchQuery || this.selectedWorkspace || this.selectedTag;
    },
    filteredContacts() {
      let filtered = this.contacts;

      // Filter by search query
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        filtered = filtered.filter(contact => 
          contact.name.toLowerCase().includes(query) ||
          (contact.phone_number && contact.phone_number.toLowerCase().includes(query)) ||
          (contact.workspace_title && contact.workspace_title.toLowerCase().includes(query)) ||
          (contact.tags && contact.tags.some(tag => tag.toLowerCase().includes(query)))
        );
      }

      // Filter by workspace
      if (this.selectedWorkspace) {
        filtered = filtered.filter(contact => contact.workspace_id === this.selectedWorkspace);
      }

      // Filter by tag
      if (this.selectedTag) {
        filtered = filtered.filter(contact => 
          contact.tags && contact.tags.includes(this.selectedTag)
        );
      }

      return filtered;
    }
  },
  async mounted() {
    await this.loadWorkspaces();
    await this.loadContacts();
    this.setupRealtimeSubscription();
  },
  beforeUnmount() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  },
  methods: {
    async loadWorkspaces() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        // First get workspaces the user has access to
        const { data: workspaceAccess, error: accessError } = await supabase
          .from('workspace_access')
          .select('workspace_id')
          .eq('shared_with_user_id', user.id);

        if (accessError) throw accessError;

        // Get workspace IDs from workspace access
        const accessibleWorkspaceIds = workspaceAccess.map(access => access.workspace_id);

        // Get workspaces created by user
        const { data: userWorkspaces, error: userWorkspacesError } = await supabase
          .from('workspaces')
          .select('id')
          .eq('created_by', user.id)
          .eq('archived', false);

        if (userWorkspacesError) throw userWorkspacesError;

        // Combine all accessible workspace IDs
        const allWorkspaceIds = [...new Set([...accessibleWorkspaceIds, ...userWorkspaces.map(m => m.id)])];

        if (allWorkspaceIds.length === 0) {
          this.workspaces = [];
          return;
        }

        // Get all accessible workspaces
        const { data: workspaces, error } = await supabase
          .from('workspaces')
          .select('id, title')
          .eq('archived', false)
          .in('id', allWorkspaceIds)
          .order('title');

        if (error) throw error;
        this.workspaces = workspaces;
      } catch (error) {
        ElMessage.error('Error loading workspaces: ' + error.message);
      }
    },

    async loadContacts() {
      try {
        this.loading = true;
        const { data: { user } } = await supabase.auth.getUser();
        
        // First get workspaces the user has access to
        const { data: workspaceAccess, error: accessError } = await supabase
          .from('workspace_access')
          .select('workspace_id')
          .eq('shared_with_user_id', user.id);

        if (accessError) throw accessError;

        // Get workspace IDs from workspace access
        const accessibleWorkspaceIds = workspaceAccess.map(access => access.workspace_id);

        // Get workspaces created by user
        const { data: userWorkspaces, error: userWorkspacesError } = await supabase
          .from('workspaces')
          .select('id')
          .eq('created_by', user.id)
          .eq('archived', false);

        if (userWorkspacesError) throw userWorkspacesError;

        // Combine all accessible workspace IDs
        const allWorkspaceIds = [...new Set([...accessibleWorkspaceIds, ...userWorkspaces.map(m => m.id)])];

        if (allWorkspaceIds.length === 0) {
          this.contacts = [];
          return;
        }

        // Get contacts from all accessible workspaces
        const { data: contacts, error } = await supabase
          .from('contacts')
          .select(`
            *,
            workspaces!inner(
              id,
              title
            )
          `)
          .eq('archived', false)
          .in('workspace_id', allWorkspaceIds)
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        // Transform data to include workspace title
        this.contacts = contacts.map(contact => ({
          ...contact,
          workspace_title: contact.workspaces.title
        }));
      } catch (error) {
        ElMessage.error('Error loading contacts: ' + error.message);
      } finally {
        this.loading = false;
      }
    },

    setupRealtimeSubscription() {
      this.subscription = supabase
        .channel('all_contacts_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'contacts'
          },
          () => {
            this.loadContacts();
          }
        )
        .subscribe();
    },

    viewContact(contact) {
      this.selectedContact = contact;
      this.contactDetailsVisible = true;
    },

    formatDate(dateString) {
      return new Date(dateString).toLocaleDateString();
    },

    clearFilters() {
      this.searchQuery = '';
      this.selectedWorkspace = null;
      this.selectedTag = null;
      this.hasActiveFilters = false;
    }
  }
};
</script>

<style scoped>
.all-contacts-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
}

.all-contacts-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  flex-wrap: wrap;
  gap: 1rem;
}

.all-contacts-header h1 {
  margin: 0;
  color: #2c3e50;
}

.header-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.filters-container {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.all-contacts-table {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.contact-name {
  font-weight: 500;
}

.workspace-name {
  color: #409eff;
  font-weight: 500;
}

.text-muted {
  color: #999;
  font-style: italic;
}

.tag {
  margin-right: 0.25rem;
  margin-bottom: 0.25rem;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
}

.contact-details {
  padding: 1rem 0;
}

.detail-row {
  display: flex;
  margin-bottom: 1rem;
  align-items: flex-start;
}

.detail-row label {
  font-weight: 600;
  min-width: 120px;
  color: #2c3e50;
}

.detail-row span {
  flex: 1;
  color: #666;
}

.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

@media (max-width: 768px) {
  .all-contacts-container {
    padding: 1rem;
  }
  
  .all-contacts-header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .header-actions {
    flex-direction: column;
    align-items: stretch;
  }
  
  .action-buttons {
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .detail-row {
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .detail-row label {
    min-width: auto;
  }
}
</style> 