<template>
  <div class="excalidraw-page">
    <div class="excalidraw-header">
      <div class="header-content">
        &nbsp;
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
        
        <!--<el-button @click="goBack" plain>
          <template #icon>
            <ArrowLeft />
          </template>
          Back to Workspace
        </el-button>-->
      </div>
    </div>
    
    <div class="excalidraw-container">
      <div v-if="!isDataLoaded" class="loading-container">
        <div class="loading-spinner">
          <el-icon class="is-loading"><Loading /></el-icon>
          <p>Loading canvas data...</p>
        </div>
      </div>
      <div v-else class="excalidraw-wrapper">
        <component :is="ExcalidrawVueComponent" v-bind="excalidrawProps" />
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWorkspaceStore } from '../../store/workspace'
import { supabase } from '../../supabase'
import { applyReactInVue } from 'veaury'
import { Download, Upload, Delete, ArrowLeft, Loading } from '@element-plus/icons-vue'

// Import Excalidraw components and CSS
import { Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'

export default {
  name: 'ReusableCanvasCt',
  components: {
    Download,
    Upload,
    Delete,
    ArrowLeft,
    Loading
  },
  setup() {
    const route = useRoute()
    const router = useRouter()
    const workspaceStore = useWorkspaceStore()
    
    // Excalidraw state
    const excalidrawData = ref(null)
    const currentCanvasId = ref(null)
    const currentWorkspace = ref(null)
    const currentTaskId = ref(null) // Current task ID for task-specific canvas data
    const isDataLoaded = ref(false) // Flag to track if data loading is complete
    const currentUser = ref(null) // Store current user to avoid repeated auth calls
    
    // Excalidraw component reference - simplified approach
    const ExcalidrawVueComponent = applyReactInVue(Excalidraw)
    
    // Function to clean and sanitize Excalidraw elements
    const sanitizeElements = (elements) => {
      if (!Array.isArray(elements)) return []
      
      return elements.map(element => {
        try {
          // Create a clean copy of the element
          const cleanElement = { ...element }
          
          // Ensure required properties exist
          if (!cleanElement.id || !cleanElement.type) {
            console.warn('Element missing required properties:', element)
            return null
          }
          
          // Fix arrow elements with invalid fixedSegments
          if (element.type === 'arrow') {
            // Remove invalid fixedSegments
            if (cleanElement.fixedSegments) {
              // Only keep segments that are horizontal or vertical
              cleanElement.fixedSegments = cleanElement.fixedSegments.filter(segment => {
                if (Array.isArray(segment) && segment.length === 2) {
                  const [x1, y1] = segment[0]
                  const [x2, y2] = segment[1]
                  // Check if segment is horizontal or vertical
                  return x1 === x2 || y1 === y2
                }
                return false
              })
              
              // If no valid segments remain, remove the property
              if (cleanElement.fixedSegments.length === 0) {
                delete cleanElement.fixedSegments
              }
            }
            
            // Ensure points array is valid
            if (cleanElement.points && Array.isArray(cleanElement.points)) {
              cleanElement.points = cleanElement.points.filter(point => {
                return Array.isArray(point) && point.length === 2 && 
                       typeof point[0] === 'number' && typeof point[1] === 'number'
              })
            }
            
            // Remove other problematic arrow properties that might cause issues
            const problematicProps = ['lastCommittedPoint', 'startBinding', 'endBinding', 'boundElements']
            problematicProps.forEach(prop => {
              if (cleanElement[prop]) {
                // Only keep valid object properties, remove everything else
                if (typeof cleanElement[prop] !== 'object' || cleanElement[prop] === null) {
                  delete cleanElement[prop]
                }
              }
            })
          }
          
          // Ensure numeric properties are valid numbers
          const numericProps = ['x', 'y', 'width', 'height', 'angle', 'opacity', 'strokeWidth']
          numericProps.forEach(prop => {
            if (cleanElement[prop] !== undefined && (isNaN(cleanElement[prop]) || !isFinite(cleanElement[prop]))) {
              cleanElement[prop] = 0
            }
          })
          
          // Remove any undefined or null values that might cause issues
          Object.keys(cleanElement).forEach(key => {
            if (cleanElement[key] === undefined || cleanElement[key] === null) {
              delete cleanElement[key]
            }
          })
          
          return cleanElement
        } catch (error) {
          console.error('Error sanitizing element:', error, element)
          return null
        }
      }).filter(element => element !== null) // Remove any null elements
    }
    
    // Excalidraw props - simplified to match sandbox
    const excalidrawProps = ref({
      initialData: {
        elements: [],
        appState: {
          viewBackgroundColor: '#ffffff'
        }
      },
      onChange: (elements, appState) => {
        try {
          // Sanitize elements before updating state
          const sanitizedElements = sanitizeElements(elements)
          excalidrawData.value = { elements: sanitizedElements, appState }
          saveCanvasData()
        } catch (error) {
          console.error('Error in onChange handler:', error)
          // Continue with unsanitized elements if sanitization fails
          excalidrawData.value = { elements, appState }
          saveCanvasData()
        }
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
      const taskId = route.params.taskId || route.query.taskId // Get task ID from route params or query
      
      if (workspaceId) {
        if (workspaceStore.workspaces.length === 0) {
          await workspaceStore.loadWorkspaces()
        }
        
        currentWorkspace.value = workspaceStore.workspaces.find(w => w.id == workspaceId)
        currentTaskId.value = taskId
        
        if (currentWorkspace.value) {
          await loadCanvasData(workspaceId, taskId)
        }
      }
    })
    
    const loadCanvasData = async (workspaceId, taskId) => {
      try {
        let query = supabase
          .from('canvas_data')
          .select('*')
          .eq('workspace_id', workspaceId)
        
        // If taskId is provided, filter by task_id, otherwise get workspace-level canvas data
        if (taskId) {
          query = query.eq('task_id', taskId)
        } else {
          query = query.is('task_id', null)
        }
        
        const { data, error } = await query.maybeSingle()
        
        console.log('Loading canvas data for workspace:', workspaceId, 'task:', taskId)
        console.log('data', data)
        console.log('error', error)
        
        if (data && !error) {
          currentCanvasId.value = data.id
          
          // Load Excalidraw data if it exists
          if (data.canvas_data && data.canvas_data.excalidraw) {
            console.log('data.canvas_data.excalidraw', data.canvas_data.excalidraw)
            
            // Extract elements and appState from the saved data
            const savedElements = data.canvas_data.excalidraw.elements || []
            const savedAppState = {}
            
            // Sanitize the elements to fix any invalid data
            const sanitizedElements = sanitizeElements(savedElements)
            
            // Update the initialData with the loaded elements and appState
            excalidrawProps.value.initialData = {
              elements: sanitizedElements,
              appState: {
                viewBackgroundColor: '#ffffff',
                ...savedAppState
              }
            }
            
            // Also update excalidrawData for consistency
            excalidrawData.value = {
              elements: sanitizedElements,
              appState: {
                viewBackgroundColor: '#ffffff',
                ...savedAppState
              }
            }
            
            console.log('Loaded Elements:', sanitizedElements)
            console.log('Loaded AppState:', savedAppState)
          } else {
            // No saved data found, initialize with empty canvas
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
            
            console.log('No saved data found, initializing with empty canvas')
          }
        } else {
          // No data found, initialize with empty canvas
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
          
          console.log('No data found, initializing with empty canvas')
        }
        
        // Mark data loading as complete
        isDataLoaded.value = true
        console.log('Data loading complete, component will render')
        
      } catch (error) {
        console.error('Error loading canvas data:', error)
        
        // Even if there's an error, initialize with empty canvas and mark as loaded
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
        
        isDataLoaded.value = true
        console.log('Error occurred, but component will render with empty canvas')
      }
    }
    
    const saveCanvasData = async () => {
      if (!currentWorkspace.value || !excalidrawData.value) return
      
      try {
        if (!currentUser.value) {
          console.error('No authenticated user found')
          return
        }
        
        const canvasData = {
          excalidraw: excalidrawData.value,
          lastUpdated: new Date().toISOString()
        }
        
        console.log('Saving canvas data for workspace:', currentWorkspace.value.id, 'task:', currentTaskId.value)
        
        if (currentCanvasId.value) {
          // Update existing canvas by ID
          const { error } = await supabase
            .from('canvas_data')
            .update({
              canvas_data: canvasData,
              updated_by: currentUser.value.id,
              updated_at: new Date().toISOString()
            })
            .eq('workspace_id', currentWorkspace.value.id)
            .eq('task_id', currentTaskId.value)
          
          if (error) {
            console.error('Error updating canvas data:', error)
          } else {
            console.log('Canvas data updated successfully by ID')
          }
        } else {
          // Check if canvas data already exists for this workspace and task combination
          let existingCanvasQuery = supabase
            .from('canvas_data')
            .select('id')
            .eq('workspace_id', currentWorkspace.value.id)
          
          if (currentTaskId.value) {
            existingCanvasQuery = existingCanvasQuery.eq('task_id', currentTaskId.value)
          } else {
            existingCanvasQuery = existingCanvasQuery.is('task_id', null)
          }
          
          const { data: existingCanvas, error: checkError } = await existingCanvasQuery.maybeSingle()
          
          if (checkError) {
            console.error('Error checking existing canvas data:', checkError)
            return
          }
          
          if (existingCanvas) {
            // Update existing canvas by workspace and task combination
            const { error } = await supabase
              .from('canvas_data')
              .update({
                canvas_data: canvasData,
                updated_by: currentUser.value.id,
                updated_at: new Date().toISOString()
              })
              .eq('workspace_id', currentWorkspace.value.id)
              .eq('task_id', currentTaskId.value)
            
            if (error) {
              console.error('Error updating existing canvas data:', error)
            } else {
              currentCanvasId.value = existingCanvas.id
              console.log('Existing canvas data updated successfully')
            }
          } else {
            // Create new canvas with task_id if available
            const { data: newCanvas, error } = await supabase
              .from('canvas_data')
              .insert({
                workspace_id: currentWorkspace.value.id,
                task_id: currentTaskId.value, // Include task_id if available
                canvas_data: canvasData,
                version_number: 1,
                created_by: currentUser.value.id,
                updated_by: currentUser.value.id,
                updated_at: new Date().toISOString()
              })
              .select('id')
              .single()
            
            if (error) {
              console.error('Error creating canvas data:', error)
            } else {
              currentCanvasId.value = newCanvas.id
              console.log('New canvas data created successfully')
            }
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
      // Only allow importing if data is loaded
      if (!isDataLoaded.value) {
        console.log('Cannot import drawing - data not loaded yet')
        return
      }
      
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
              
              // Extract elements and appState from imported data
              let importedElements = data.elements || []
              const importedAppState = data.appState || {}
              
              // Sanitize the imported elements
              importedElements = sanitizeElements(importedElements)
              
              excalidrawProps.value.initialData = {
                elements: importedElements,
                appState: {
                  viewBackgroundColor: '#ffffff',
                  ...importedAppState
                }
              }
              excalidrawData.value = {
                elements: importedElements,
                appState: {
                  viewBackgroundColor: '#ffffff',
                  ...importedAppState
                }
              }
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
      // Only allow clearing if data is loaded
      if (!isDataLoaded.value) {
        console.log('Cannot clear drawing - data not loaded yet')
        return
      }
      
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
      // If we have a task ID, go back to the task, otherwise go to dashboard
      if (currentTaskId.value) {
        router.push(`/single-workspace/${route.params.workspaceId}/tasks/${currentTaskId.value}`)
      } else {
        router.push(`/single-workspace/${route.params.workspaceId}/dashboard`)
      }
    }
    
    // Get current user once to avoid repeated auth calls
    const getCurrentUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          currentUser.value = user
        } else {
          console.error('No authenticated user found')
        }
      } catch (error) {
        console.error('Error getting current user:', error)
      }
    }
    
    // Get current user when component is mounted
    onMounted(async () => {
      await getCurrentUser()
    })
    
    return {
      ExcalidrawVueComponent,
      excalidrawProps,
      isDataLoaded,
      currentTaskId,
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

.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  background-color: #f5f7fa;
}

.loading-spinner {
  text-align: center;
  color: #606266;
}

.loading-spinner .el-icon {
  font-size: 32px;
  margin-bottom: 16px;
}

.loading-spinner p {
  margin: 0;
  font-size: 14px;
}

.excalidraw-wrapper {
  height: 100%;
  width: 100%;
  position: relative;
}

.excalidraw .sidebar-trigger__label-element {
  display: none;
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