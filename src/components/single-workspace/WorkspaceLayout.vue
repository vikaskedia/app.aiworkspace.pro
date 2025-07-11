<template>
  <div class="matter-layout">
    <HeaderCt @logo-click="showQuickActions = true" />
    <QuickActionDrawer
      v-model="showQuickActions"
      :context="currentContext"
      @action="handleQuickAction"
    />
    <div class="matter-content" :class="`matter-content--${currentContext}`">
      <router-view v-slot="{ Component }">
        <component :is="Component" ref="currentComponent" />
      </router-view>
    </div>
  </div>
</template>

<script>
import HeaderCt from '../HeaderCt.vue'
import QuickActionDrawer from '../common/QuickActionDrawer.vue'

export default {
  name: 'WorkspaceLayout',
  components: {
    HeaderCt,
    QuickActionDrawer
  },
  data() {
    return {
      showQuickActions: false
    }
  },
  computed: {
    currentContext() {
      const path = this.$route.path
      if (path.includes('/tasks')) return 'tasks'
      if (path.includes('/files')) return 'files'
      if (path.includes('/goals')) return 'goals'
      if (path.includes('/events')) return 'events'
      if (path.includes('/outlines')) return 'outlines'
      if (path.includes('/contacts')) return 'contacts'
      if (path.includes('/ai_phone')) return 'ai-phone'
      if (path.includes('/ai_intake')) return 'ai-intake'
      return 'dashboard'
    }
  },
  methods: {
    handleQuickAction(actionId) {
      const component = this.$refs.currentComponent
      if (!component) return

      switch (actionId) {
        case 'new_task':
          component.dialogVisible = true
          break
        case 'toggle_filters':
          component.showFilters = !component.showFilters
          break
        case 'manage_filters':
          component.savedFiltersDialogVisible = true
          break
        case 'new_folder':
          component.newFolderDialogVisible = true
          break
        case 'upload_files':
          component.uploadDialogVisible = true
          break
        case 'new_goal':
          component.dialogVisible = true
          break
        case 'new_event':
          component.dialogVisible = true
          break
      }
    }
  }
}
</script>

<style scoped>
.matter-layout {
  min-height: 100vh;
  background-color: #f5f7fa;
}

.matter-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

@media (max-width: 640px) {
  .matter-content {
    padding: 1rem;
  }
}
.matter-content.matter-content--tasks {
    max-width: 100%;
}

.matter-content.matter-content--ai-phone {
    max-width: 100%;
}

.matter-content.matter-content--ai-intake {
    max-width: 100%;
}
</style>