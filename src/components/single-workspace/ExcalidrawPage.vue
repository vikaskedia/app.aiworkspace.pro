<template>
  <div class="excalidraw-page">
    <div class="excalidraw-header">
      <div class="header-content">
        <h1>Canvas</h1>
        <p class="header-description">Create beautiful hand-drawn diagrams and sketches</p>
      </div>
      
      <div class="header-actions">
        <el-button-group>
          <el-button @click="exportDrawing" type="primary">
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
          <el-button @click="clearDrawing" type="danger">
            <template #icon>
              <Delete />
            </template>
            Clear
          </el-button>
        </el-button-group>
        
        <el-button @click="goBack" plain>
          <template #icon>
            <ArrowLeft />
          </template>
          Back to Workspace
        </el-button>
      </div>
    </div>
    
    <div class="excalidraw-container">
      <component :is="ExcalidrawVueComponent" v-bind="excalidrawProps" />
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWorkspaceStore } from '../../store/workspace'
import { supabase } from '../../supabase'
import { applyReactInVue } from 'veaury'
import { Download, Upload, Delete, ArrowLeft } from '@element-plus/icons-vue'

// Import Excalidraw components and CSS
import { Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'

export default {
  name: 'ExcalidrawPage',
  components: {
    Download,
    Upload,
    Delete,
    ArrowLeft
  },
  setup() {
    const route = useRoute()
    const router = useRouter()
    const workspaceStore = useWorkspaceStore()
    
    // Excalidraw state
    const excalidrawData = ref(null)
    const currentCanvasId = ref(null)
    const currentWorkspace = ref(null)
    
    // Excalidraw component reference - simplified approach
    const ExcalidrawVueComponent = applyReactInVue(Excalidraw)
    
    // Excalidraw props - simplified to match sandbox
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
    
    const goBack = () => {
      router.push(`/single-workspace/${route.params.workspaceId}/dashboard`)
    }
    
    return {
      ExcalidrawVueComponent,
      excalidrawProps,
      exportDrawing,
      importDrawing,
      clearDrawing,
      goBack
    }
  }
}
</script>

<style>
.excalidraw-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #f5f7fa;
}

.excalidraw-header {
  background-color: white;
  border-bottom: 1px solid #e4e7ed;
  padding: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.header-content h1 {
  margin: 0 0 8px 0;
  color: #303133;
  font-size: 24px;
  font-weight: 600;
}

.header-description {
  margin: 0;
  color: #606266;
  font-size: 14px;
}

.header-actions {
  display: flex;
  gap: 16px;
  align-items: center;
}

.excalidraw-container {
  flex: 1;
  position: relative;
  overflow: hidden;
  height: 100%;
}

/* Simple approach - let Excalidraw handle its own styling */
.excalidraw-container :deep(.excalidraw) {
  height: 100% !important;
  width: 100% !important;
}

/* Responsive design */
@media (max-width: 768px) {
  .excalidraw-header {
    flex-direction: column;
    gap: 16px;
    align-items: flex-start;
  }
  
  .header-actions {
    width: 100%;
    justify-content: space-between;
  }
}
</style> 