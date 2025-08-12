<template>
  <div class="excalidraw-wrapper">
    <div class="excalidraw-toolbar">
      <el-button-group>
        <el-button @click="exportDrawing">
          <template #icon>
            <Download />
          </template>
          Export
        </el-button>
        <el-button @click="importDrawing">
          <template #icon>
            <Upload />
          </template>
          Import
        </el-button>
        <el-button @click="clearDrawing">
          <template #icon>
            <Delete />
          </template>
          Clear
        </el-button>
      </el-button-group>
    </div>
    
    <div class="excalidraw-container" ref="excalidrawContainer">
      <div v-if="!ExcalidrawVueComponent" class="excalidraw-error">
        <el-alert
          title="Excalidraw Loading Error"
          description="Failed to load Excalidraw component. Please refresh the page."
          type="error"
          show-icon />
      </div>
      <component v-else :is="ExcalidrawVueComponent" v-bind="excalidrawProps" />
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useWorkspaceStore } from '../../store/workspace'
import { supabase } from '../../supabase'
import { applyReactInVue } from 'veaury'
import { Download, Upload, Delete } from '@element-plus/icons-vue'

// Import Excalidraw components
import { Excalidraw } from '@excalidraw/excalidraw'

export default {
  name: 'ExcalidrawWrapper',
  components: {
    Download,
    Upload,
    Delete
  },
  setup() {
    const route = useRoute()
    const workspaceStore = useWorkspaceStore()
    const excalidrawContainer = ref(null)
    
    // Excalidraw state
    const excalidrawData = ref(null)
    const currentCanvasId = ref(null)
    const currentWorkspace = ref(null)
    
    // Excalidraw component reference
    const ExcalidrawComponent = Excalidraw
    let ExcalidrawVueComponent = null
    
    try {
      ExcalidrawVueComponent = applyReactInVue(Excalidraw)
    } catch (error) {
      console.error('Failed to create Excalidraw Vue component:', error)
    }
    
    // Excalidraw props
    const excalidrawProps = ref({
      initialData: {
        elements: [],
        appState: {
          viewBackgroundColor: '#ffffff'
        }
      },
      onChange: (elements, appState) => {
        excalidrawData.value = { elements, appState }
        saveCanvasData()
      },
      onCollabButtonClick: () => {
        console.log('Collaboration button clicked')
      },
      theme: 'light',
      gridModeEnabled: false,
      zenModeEnabled: false,
      zoomEnabled: true,
      viewModeEnabled: false,
      UIOptions: {
        canvasActions: {
          saveToActiveFile: false,
          loadScene: false,
          export: false,
          saveAsImage: false
        }
      }
    })
    
    onMounted(async () => {
      const workspaceId = route.params.workspaceId
      if (workspaceId) {
        if (workspaceStore.workspaces.length === 0) {
          await workspaceStore.loadWorkspaces()
        }
        
        currentWorkspace.value = workspaceStore.workspaces.find(w => w.id == workspaceId)
        
        if (currentWorkspace.value) {
          await loadCanvasData(workspaceId)
        }
      }
    })
    
    const loadCanvasData = async (workspaceId) => {
      try {
        const { data, error } = await supabase
          .from('canvas_data')
          .select('*')
          .eq('workspace_id', workspaceId)
          .is('task_id', null)
          .maybeSingle()
        
        if (data && !error) {
          currentCanvasId.value = data.id
          // Load Excalidraw data if it exists
          if (data.canvas_data && data.canvas_data.excalidraw) {
            excalidrawProps.value.initialData = data.canvas_data.excalidraw
            excalidrawData.value = data.canvas_data.excalidraw
          }
        }
      } catch (error) {
        console.error('Error loading canvas data:', error)
      }
    }
    
    const saveCanvasData = async () => {
      if (!currentWorkspace.value || !excalidrawData.value) return
      
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          console.error('No authenticated user found')
          return
        }
        
        const canvasData = {
          excalidraw: excalidrawData.value,
          lastUpdated: new Date().toISOString()
        }
        
        if (currentCanvasId.value) {
          // Update existing canvas
          const { error } = await supabase
            .from('canvas_data')
            .update({
              canvas_data: canvasData,
              updated_by: user.id,
              updated_at: new Date().toISOString()
            })
            .eq('id', currentCanvasId.value)
          
          if (error) {
            console.error('Error updating canvas data:', error)
          }
        } else {
          // Create new canvas
          const { error } = await supabase
            .from('canvas_data')
            .insert({
              workspace_id: currentWorkspace.value.id,
              task_id: null,
              canvas_data: canvasData,
              version_number: 1,
              created_by: user.id,
              updated_by: user.id,
              updated_at: new Date().toISOString()
            })
          
          if (error) {
            console.error('Error creating canvas data:', error)
          }
        }
      } catch (error) {
        console.error('Error saving canvas data:', error)
      }
    }
    
    const exportDrawing = () => {
      if (!excalidrawData.value) return
      
      const dataStr = JSON.stringify(excalidrawData.value, null, 2)
      const dataBlob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(dataBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `excalidraw-${Date.now()}.json`
      link.click()
      URL.revokeObjectURL(url)
    }
    
    const importDrawing = () => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.json'
      input.onchange = (e) => {
        const file = e.target.files[0]
        if (file) {
          const reader = new FileReader()
          reader.onload = (e) => {
            try {
              const data = JSON.parse(e.target.result)
              excalidrawProps.value.initialData = data
              excalidrawData.value = data
              saveCanvasData()
            } catch (error) {
              console.error('Error importing drawing:', error)
            }
          }
          reader.readAsText(file)
        }
      }
      input.click()
    }
    
    const clearDrawing = () => {
      excalidrawProps.value.initialData = {
        elements: [],
        appState: {
          viewBackgroundColor: '#ffffff'
        }
      }
      excalidrawData.value = {
        elements: [],
        appState: {
          viewBackgroundColor: '#ffffff'
        }
      }
      saveCanvasData()
    }
    
    return {
      excalidrawContainer,
      ExcalidrawComponent,
      ExcalidrawVueComponent,
      excalidrawProps,
      exportDrawing,
      importDrawing,
      clearDrawing
    }
  }
}
</script>

<style scoped>
.excalidraw-wrapper {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #f5f7fa;
}

.excalidraw-toolbar {
  padding: 16px;
  background-color: white;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  gap: 16px;
  align-items: center;
}

.excalidraw-container {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.excalidraw-container :deep(.excalidraw) {
  height: 100% !important;
}

.excalidraw-container :deep(.excalidraw__wrapper) {
  height: 100% !important;
}

.excalidraw-container :deep(.excalidraw__canvas) {
  height: 100% !important;
}

.excalidraw-error {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 20px;
}
</style> 