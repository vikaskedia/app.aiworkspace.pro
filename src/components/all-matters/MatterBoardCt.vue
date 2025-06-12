<template>
  <div class="matter-board">
    <div class="board-container">
      <draggable
        class="board-columns"
        v-model="columns"
        item-key="id"
        :group="{ name: 'columns' }">
        <template #item="{ element: column }">
          <div class="board-column">
            <div class="column-header" :style="{ backgroundColor: getHeaderBackgroundColor(column) }">
              <div class="column-title">
                <h3>{{ column.title }}</h3>
                <span class="matter-count">({{ column.matters.length }})</span>
              </div>
            </div>
            
            <draggable
              class="matter-list"
              v-model="column.matters"
              :group="{ name: 'matters' }"
              item-key="id"
              @change="(e) => onMatterMove(e, column)">
              <template #item="{ element: matter }">
                <div class="matter-card">
                  <div class="matter-header">
                    <h4>{{ matter.title }}</h4>
                  </div>
                  <div class="matter-stats">
                    <div class="stat-item">
                      <span>{{ matter.stats?.tasks_completed || 0 }}/{{ matter.stats?.tasks_total || 0 }} Tasks</span>
                    </div>
                    <div class="stat-item">
                      <span>{{ matter.stats?.goals_completed || 0 }}/{{ matter.stats?.goals_total || 0 }} Goals</span>
                    </div>
                  </div>
                  <div class="matter-actions">
                    <el-button 
                      type="primary" 
                      link 
                      @click="$emit('view-matter', matter)">
                      View Dashboard
                    </el-button>
                  </div>
                </div>
              </template>
            </draggable>
          </div>
        </template>
      </draggable>
    </div>
  </div>
</template>

<script>
import { defineComponent } from 'vue'
import draggable from 'vuedraggable'

export default defineComponent({
  components: {
    draggable
  },

  props: {
    matters: {
      type: Array,
      required: true
    },
    groupBy: {
      type: String,
      default: 'status',
      validator: (value) => ['status', 'progress'].includes(value)
    }
  },

  data() {
    return {
      columns: []
    }
  },

  methods: {
    initializeColumns() {
      let columns = [];
      
      switch (this.groupBy) {
        case 'status':
          columns = [
            { id: 'active', title: 'Active Workspaces', matters: [] },
            { id: 'archived', title: 'Archived Workspaces', matters: [] }
          ];
          break;
        case 'progress':
          columns = [
            { id: 'not_started', title: 'Not Started', matters: [] },
            { id: 'in_progress', title: 'In Progress', matters: [] },
            { id: 'completed', title: 'Completed', matters: [] }
          ];
          break;
      }

      // Distribute matters to columns
      this.matters.forEach(matter => {
        const columnId = this.getColumnIdForMatter(matter);
        const column = columns.find(col => col.id === columnId);
        if (column) {
          column.matters.push(matter);
        }
      });

      this.columns = columns;
    },

    getColumnIdForMatter(matter) {
      if (this.groupBy === 'status') {
        return matter.archived ? 'archived' : 'active';
      } else if (this.groupBy === 'progress') {
        const completionRate = this.calculateCompletionRate(matter);
        if (completionRate === 0) return 'not_started';
        if (completionRate === 100) return 'completed';
        return 'in_progress';
      }
    },

    calculateCompletionRate(matter) {
      const totalTasks = matter.stats?.tasks_total || 0;
      const completedTasks = matter.stats?.tasks_completed || 0;
      if (totalTasks === 0) return 0;
      return (completedTasks / totalTasks) * 100;
    },

    getHeaderBackgroundColor(column) {
      switch (column.id) {
        case 'active':
        case 'in_progress':
          return 'var(--el-color-primary)';
        case 'archived':
          return 'var(--el-color-info)';
        case 'not_started':
          return 'var(--el-color-warning)';
        case 'completed':
          return 'var(--el-color-success)';
        default:
          return 'var(--el-color-info)';
      }
    },

    onMatterMove(event, targetColumn) {
      if (event.added) {
        const matter = event.added.element;
        this.$emit('update-matter-status', {
          matterId: matter.id,
          newStatus: targetColumn.id
        });
      }
    }
  },

  watch: {
    matters: {
      handler() {
        this.initializeColumns();
      },
      deep: true
    },
    groupBy() {
      this.initializeColumns();
    }
  },

  created() {
    this.initializeColumns();
  },

  emits: ['view-matter', 'update-matter-status']
})
</script>

<style scoped>
.matter-board {
  height: 100%;
  overflow: hidden;
  padding: 16px;
  background: var(--el-fill-color-blank);
}

.board-container {
  height: 100%;
  overflow-x: auto;
  padding: 0.35rem 0;
}

.board-columns {
  display: flex;
  gap: 1rem;
  min-height: 100%;
  padding: 0.5rem;
}

.board-column {
  flex: 0 0 300px;
  background: var(--el-fill-color-light);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  max-height: 100%;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
  border: 1px solid var(--el-border-color-lighter);
}

.column-header {
  padding: 11px 14px;
  border-radius: 12px 12px 0 0;
}

.column-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.column-title h3 {
  margin: 0;
  font-size: 1rem;
  color: #ffffff;
  font-weight: 600;
}

.matter-count {
  color: #ffffff;
  font-size: 0.85rem;
  background: rgba(255, 255, 255, 0.2);
  padding: 2px 8px;
  border-radius: 12px;
}

.matter-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.matter-card {
  background: white;
  border-radius: 8px;
  padding: 1rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  border: 1px solid var(--el-border-color-lighter);
}

.matter-stats {
  display: flex;
  gap: 1rem;
  margin: 0.5rem 0;
  font-size: 0.9rem;
  color: var(--el-text-color-secondary);
}

.matter-actions {
  margin-top: 0.5rem;
  display: flex;
  justify-content: flex-end;
}
</style> 