<template>
  <div class="events-container">
    <div class="content">
      <div class="events-header">
        <div class="header-buttons">
          <el-button 
            @click="showFilters = !showFilters"
            type="info"
            plain>
            {{ showFilters ? `Hide Filters${activeFiltersCount ? ` (${activeFiltersCount})` : ''}` : `Show Filters${activeFiltersCount ? ` (${activeFiltersCount})` : ''}` }}
          </el-button>
          <!-- <el-dropdown @command="handleSavedFilter">
            <el-button type="info" plain>
              Saved Filters
              <el-icon class="el-icon--right"><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="save">Save Current Filters</el-dropdown-item>
                <el-dropdown-item divided command="manage">Manage Saved Filters</el-dropdown-item>
                <template v-if="savedFilters.length > 0">
                  <el-dropdown-item 
                    v-for="filter in savedFilters" 
                    :key="filter.id" 
                    :command="['load', filter.id]"
                    :class="{ 'active-filter': isFilterApplied(filter) }">
                    <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                      <span>{{ filter.filter_name }}</span>
                      <el-icon v-if="isFilterApplied(filter)" style="color: var(--el-color-primary)">
                        <Check />
                      </el-icon>
                    </div>
                  </el-dropdown-item>
                </template>
              </el-dropdown-menu>
            </template>
          </el-dropdown> -->
        </div>
      </div>

      <!-- Filters -->
      <el-collapse-transition>
        <div v-show="showFilters" class="filters-container">
          <el-form :inline="true" class="filter-form">
            <el-form-item label="Workspace">
              <el-select
                v-model="filters.matter"
                placeholder="All matters"
                multiple
                collapse-tags
                collapse-tags-tooltip
                clearable
                filterable
                style="width: 300px">
                <el-option 
                  v-for="matter in matters"
                  :key="matter.id"
                  :label="matter.title"
                  :value="matter.id"
                />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button @click="clearFilters">Clear</el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-collapse-transition>

      <!-- Events Table -->
      <el-table
        v-loading="loading"
        :data="filteredEvents"
        style="width: 100%">
        <el-table-column 
          prop="title" 
          label="Title"
          min-width="200">
          <template #default="scope">
            <div class="title-with-matter">
              <div class="event-title">{{ scope.row.title }}
                <el-tag size="small" type="success">{{ getMatterTitle(scope.row.matter_id) }}</el-tag>
              </div>
            </div>
          </template>
        </el-table-column>
        <!-- <el-table-column 
          prop="event_type" 
          label="Type"
          width="180" /> -->
        <el-table-column 
          prop="start_time" 
          label="Start Time"
          width="180">
          <template #default="scope">
            {{ scope.row.start_time ? new Date(scope.row.start_time).toLocaleString() : '-' }}
          </template>
        </el-table-column>
        <el-table-column 
          prop="end_time" 
          label="End Time"
          width="180">
          <template #default="scope">
            {{ scope.row.end_time ? new Date(scope.row.end_time).toLocaleString() : '-' }}
          </template>
        </el-table-column>
        <el-table-column 
          prop="location" 
          label="Location"
          min-width="150" />
      </el-table>
    </div>
  </div>
</template>

<script>
import { supabase } from '../../supabase';
import { ElMessage } from 'element-plus';
import { ArrowDown, Check } from '@element-plus/icons-vue';

export default {
  name: 'AllEventsCt',
  components: {
    ArrowDown,
    Check
  },
  data() {
    return {
      events: [],
      loading: false,
      showFilters: false,
      savedFilters: [],
      matters: [],
      filters: {
        matter: []
      }
    };
  },
  computed: {
    activeFiltersCount() {
      let count = 0;
      if (this.filters.matter?.length) count++;
      return count;
    },
    filteredEvents() {
      let filtered = [...this.events];
      
      // Filter by matters if any are selected
      if (this.filters.matter?.length) {
        filtered = filtered.filter(event => 
          this.filters.matter.includes(event.matter_id)
        );
      }
      
      return filtered;
    }
  },
  methods: {
    async loadEvents() {
      try {
        this.loading = true;
        
        // Get active matters from localStorage
        const mattersActive = localStorage.getItem('matters_active');
        if (!mattersActive) {
          console.log('No matters_active found in localStorage');
          this.events = [];
          return;
        }
        
        const mattersData = JSON.parse(mattersActive);
        console.log('Raw matters data from localStorage:', mattersData);
        
        // Extract IDs from matter objects
        let matterIds;
        if (Array.isArray(mattersData)) {
          matterIds = mattersData.map(matter => matter.id || matter);
        } else {
          console.log('Invalid matters data format');
          this.events = [];
          return;
        }
        
        console.log('Extracted matter IDs:', matterIds);
        
        if (!matterIds || matterIds.length === 0) {
          console.log('No active matter IDs found');
          this.events = [];
          return;
        }
        
        // First, let's check the total count for these matters
        const { count, error: countError } = await supabase
          .from('events')
          .select('*', { count: 'exact', head: true })
          .in('matter_id', matterIds);
        
        if (countError) throw countError;
        console.log('Total events for active matters:', count);
        
        // Load events only from active matters
        const { data: events, error } = await supabase
          .from('events')
          .select('*')
          .in('matter_id', matterIds)
          .order('start_time', { ascending: false });

        if (error) throw error;
        
        console.log('Loaded events count:', events.length);
        console.log('First few events:', events.slice(0, 3));
        this.events = events;

      } catch (error) {
        console.error('Error loading events:', error);
        ElMessage.error('Error loading events: ' + error.message);
      } finally {
        this.loading = false;
      }
    },

    async loadMatters() {
      try {
        // Get matters from localStorage for now
        const mattersActive = localStorage.getItem('matters_active');
        if (mattersActive) {
          const mattersData = JSON.parse(mattersActive);
          if (Array.isArray(mattersData)) {
            this.matters = mattersData.map(matter => ({
              id: matter.id || matter,
              title: matter.title || `Workspace ${matter.id || matter}`
            }));
          }
        }
      } catch (error) {
        console.error('Error loading matters:', error);
      }
    },

    handleSavedFilter(command) {
      if (command === 'save') {
        // TODO: Implement saving current filters
        console.log('Save filters');
      } else if (command === 'manage') {
        // TODO: Implement managing saved filters
        console.log('Manage filters');
      } else if (Array.isArray(command) && command[0] === 'load') {
        // TODO: Implement loading a saved filter
        console.log('Load filter:', command[1]);
      }
    },

    isFilterApplied(filter) {
      // TODO: Implement logic to check if a filter is applied
      return false;
    },

    clearFilters() {
      this.filters = {
        matter: []
      };
    },

    getMatterTitle(matterId) {
      const matter = this.matters.find(matter => matter.id === matterId);
      return matter ? matter.title : 'Unknown Workspace';
    }
  },
  async mounted() {
    await this.loadMatters();
    await this.loadEvents();
  },
  watch: {
    filters: {
      deep: true,
      handler() {
        // Filters are applied via computed property automatically
      }
    }
  }
};
</script>

<style scoped>
.events-container {
  min-height: 100vh;
  background-color: #f5f7fa;
}

.content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

h2 {
  color: #303133;
  margin: 0 0 2rem 0;
}

.header-section {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
}

.event-count {
  color: #909399;
  font-size: 1rem;
  font-weight: normal;
}

.events-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.header-buttons {
  display: flex;
  gap: 1rem;
}

.filters-container {
  background-color: #f5f7fa;
  border-radius: 4px;
  border: 1px solid #ddd;
  padding: 1rem;
  margin-bottom: 2rem;
}

.filter-form {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: flex-start;
}

.filter-form .el-form-item {
  margin-bottom: 0;
}

.title-with-matter {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.event-title {
  font-weight: 500;
  color: #303133;
}

.matter-name {
  display: flex;
  align-items: center;
}
</style> 