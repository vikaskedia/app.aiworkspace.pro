<!-- src/components/TasksList.vue -->
<script>
export default {
  props: {
    tasks: {
      type: Array,
      required: true
    },
    loading: {
      type: Boolean,
      default: false
    },
    sharedUsers: {
      type: Array,
      required: true
    }
  },
  emits: ['edit', 'view-comments'],
  data() {
    return {
      filters: {
        search: '',
        status: null,
        priority: null,
        assignee: null,
        dueDate: null
      }
    }
  },
  computed: {
    filteredTasks() {
      let result = [...this.tasks]
      
      // Search filter
      if (this.filters.search) {
        const query = this.filters.search.toLowerCase()
        result = result.filter(task => 
          task.title.toLowerCase().includes(query) ||
          task.description?.toLowerCase().includes(query)
        )
      }

      // Status filter
      if (this.filters.status) {
        result = result.filter(task => task.status === this.filters.status)
      }

      // Priority filter
      if (this.filters.priority) {
        result = result.filter(task => task.priority === this.filters.priority)
      }

      // Assignee filter
      if (this.filters.assignee) {
        result = result.filter(task => task.assignee === this.filters.assignee)
      }

      // Due date filter
      if (this.filters.dueDate) {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        switch (this.filters.dueDate) {
          case 'overdue':
            result = result.filter(task => 
              task.due_date && new Date(task.due_date) < today && task.status !== 'completed'
            )
            break
          case 'today':
            result = result.filter(task => {
              const dueDate = new Date(task.due_date)
              dueDate.setHours(0, 0, 0, 0)
              return dueDate.getTime() === today.getTime()
            })
            break
          case 'week':
            const nextWeek = new Date(today)
            nextWeek.setDate(today.getDate() + 7)
            result = result.filter(task => 
              task.due_date && new Date(task.due_date) <= nextWeek
            )
            break
        }
      }

      return result
    }
  },
  methods: {
    clearFilters() {
      this.filters = {
        search: '',
        status: null,
        priority: null,
        assignee: null,
        dueDate: null
      }
    }
  }
}
</script>

<template>
  <div class="tasks-list">
    <!-- Filters -->
    <div class="filters-section">
      <el-input
        v-model="filters.search"
        placeholder="Search tasks..."
        prefix-icon="Search"
        clearable
        class="filter-item"
      />
      
      <div class="filters-row">
        <el-select 
          v-model="filters.status" 
          placeholder="Status" 
          clearable
          class="filter-item">
          <el-option label="Pending" value="pending" />
          <el-option label="In Progress" value="in_progress" />
          <el-option label="Completed" value="completed" />
        </el-select>

        <el-select 
          v-model="filters.priority" 
          placeholder="Priority" 
          clearable
          class="filter-item">
          <el-option label="High" value="high" />
          <el-option label="Medium" value="medium" />
          <el-option label="Low" value="low" />
        </el-select>

        <el-select 
          v-model="filters.assignee" 
          placeholder="Assignee" 
          clearable
          class="filter-item">
          <el-option
            v-for="user in sharedUsers"
            :key="user.id"
            :label="user.email"
            :value="user.id"
          />
        </el-select>

        <el-select 
          v-model="filters.dueDate" 
          placeholder="Due Date" 
          clearable
          class="filter-item">
          <el-option label="Overdue" value="overdue" />
          <el-option label="Due Today" value="today" />
          <el-option label="Due This Week" value="week" />
        </el-select>

        <el-button @click="clearFilters" class="filter-item">
          Clear Filters
        </el-button>
      </div>
    </div>

    <!-- Tasks Table -->
    <el-table
      v-loading="loading"
      :data="filteredTasks"
      style="width: 100%">
      <el-table-column 
        prop="title" 
        label="Title"
        min-width="200">
        <template #default="scope">
          <span 
            class="clickable-title"
            @click="$emit('view-comments', scope.row)">
            {{ scope.row.title }}
          </span>
        </template>
      </el-table-column>
      
      <el-table-column 
        prop="status" 
        label="Status"
        width="120">
        <template #default="scope">
          <el-tag :type="
            scope.row.status === 'completed' ? 'success' :
            scope.row.status === 'in_progress' ? 'warning' : 'info'
          ">
            {{ scope.row.status }}
          </el-tag>
        </template>
      </el-table-column>
      
      <el-table-column 
        prop="priority" 
        label="Priority"
        width="120">
        <template #default="scope">
          <el-tag :type="
            scope.row.priority === 'high' ? 'danger' :
            scope.row.priority === 'medium' ? 'warning' : 'info'
          ">
            {{ scope.row.priority }}
          </el-tag>
        </template>
      </el-table-column>
      
      <el-table-column 
        prop="due_date" 
        label="Due Date"
        width="150">
        <template #default="scope">
          {{ scope.row.due_date ? new Date(scope.row.due_date).toLocaleDateString() : '-' }}
        </template>
      </el-table-column>
      
      <el-table-column 
        label="Assignee"
        width="200">
        <template #default="scope">
          <span>{{ sharedUsers.find(u => u.id === scope.row.assignee)?.email || '-' }}</span>
        </template>
      </el-table-column>
      
      <el-table-column 
        label="Actions"
        width="100"
        align="center">
        <template #default="scope">
          <el-button
            type="primary"
            link
            @click="$emit('edit', scope.row)">
            Edit
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style scoped>
.tasks-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.filters-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background-color: white;
  padding: 1rem;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
}

.filters-row {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.filter-item {
  min-width: 200px;
}

@media (max-width: 768px) {
  .filter-item {
    width: 100%;
  }
}

.clickable-title {
  cursor: pointer;
  color: #409EFF;
}

.clickable-title:hover {
  text-decoration: underline;
}
</style>