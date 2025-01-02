<template>
  <el-drawer
    v-model="visible"
    direction="ltr"
    :size="drawerSize"
    :title="title">
    
    <div class="quick-actions-menu">
      <el-button-group>
        <el-button
          v-for="action in contextActions"
          :key="action.id"
          :type="action.type || 'primary'"
          @click="handleAction(action)">
          <el-icon v-if="action.icon"><component :is="action.icon" /></el-icon>
          {{ action.label }}
        </el-button>
      </el-button-group>
    </div>
  </el-drawer>
</template>

<script>
import { Plus, Filter, Setting, FolderAdd, Upload } from '@element-plus/icons-vue'

export default {
  components: {
    Plus,
    Filter,
    Setting,
    FolderAdd,
    Upload
  },
  props: {
    modelValue: Boolean,
    context: {
      type: String,
      required: true
    }
  },
  emits: ['update:modelValue', 'action'],
  computed: {
    visible: {
      get() { return this.modelValue },
      set(value) { this.$emit('update:modelValue', value) }
    },
    title() {
      return `Quick Actions - ${this.context.charAt(0).toUpperCase() + this.context.slice(1)}`
    },
    drawerSize() {
      const width = window.innerWidth
      if (width <= 480) return '100%'
      if (width <= 768) return '50%'
      return '300px'
    },
    contextActions() {
      switch (this.context) {
        case 'tasks':
          return [
            { id: 'new_task', label: 'New Task', icon: 'Plus', type: 'primary' },
            { id: 'toggle_filters', label: 'Toggle Filters', icon: 'Filter' },
            { id: 'manage_filters', label: 'Manage Filters', icon: 'Setting' }
          ]
        case 'files':
          return [
            { id: 'new_folder', label: 'New Folder', icon: 'FolderAdd' },
            { id: 'upload_files', label: 'Upload Files', icon: 'Upload' }
          ]
        case 'goals':
          return [
            { id: 'new_goal', label: 'New Goal', icon: 'Plus', type: 'primary' },
            { id: 'toggle_filters', label: 'Toggle Filters', icon: 'Filter' }
          ]
        case 'events':
          return [
            { id: 'new_event', label: 'New Event', icon: 'Plus', type: 'primary' }
          ]
        default:
          return []
      }
    }
  },
  methods: {
    handleAction(action) {
      this.$emit('action', action.id)
      this.visible = false
    }
  }
}
</script>

<style scoped>
.quick-actions-menu {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.el-button-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.el-button-group .el-button {
  width: 100%;
  justify-content: flex-start;
  padding: 12px 20px;
}
</style> 