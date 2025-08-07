<template>
  <div class="canvas-container">    
    <div class="canvas-content">
      <div class="canvas-workspace">
        <div class="canvas-toolbar">
          <el-button-group>
            <el-button 
              :type="currentTool === 'select' ? 'primary' : 'default'" 
              icon="Select"
              @click="setTool('select')">
              Select
            </el-button>
            <el-button 
              :type="currentTool === 'draw' ? 'primary' : 'default'" 
              icon="Edit"
              @click="setTool('draw')">
              Draw
            </el-button>
            <el-button 
              :type="currentTool === 'text' ? 'primary' : 'default'" 
              icon="Document"
              @click="setTool('text')">
              Text
            </el-button>
            <el-dropdown @command="addShape" trigger="click">
              <el-button 
                :type="currentTool === 'shape' ? 'primary' : 'default'" 
                icon="CirclePlus">
                Shape
                <el-icon class="el-icon--right"><caret-bottom /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="rectangle">Rectangle</el-dropdown-item>
                  <el-dropdown-item command="circle">Circle</el-dropdown-item>
                  <el-dropdown-item command="triangle">Triangle</el-dropdown-item>
                  <el-dropdown-item command="line">Line</el-dropdown-item>
                  <el-dropdown-item command="arrow">Arrow</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </el-button-group>
          
          <el-divider direction="vertical" />
          
          <el-button-group>
            <el-button icon="Delete" @click="clearCanvas">Clear</el-button>
            <el-button icon="Download" @click="exportCanvas">Export</el-button>
            <el-button icon="Upload" @click="importCanvas">Import</el-button>
            <el-button icon="Clock" @click="showVersionHistory">History</el-button>
          </el-button-group>
          
          <el-divider direction="vertical" />
          
          <el-color-picker 
            v-model="strokeColor" 
            size="small"
            @change="updateStrokeColor" />
          <el-input-number 
            v-model="strokeWidth" 
            :min="1" 
            :max="20" 
            size="small"
            @change="updateStrokeWidth" />
          <el-color-picker 
            v-model="fillColor" 
            size="small"
            @change="updateFillColor" />
        </div>
        
        <div class="canvas-area" ref="canvasContainer">
          <canvas 
            ref="canvas"
            @mousedown="handleMouseDown"
            @mousemove="handleMouseMove"
            @mouseup="handleMouseUp"
            @click="handleClick">
          </canvas>
          
          <!-- Text input overlay -->
          <div 
            v-if="showTextInput" 
            class="text-input-overlay"
            :style="{ left: textInputPosition.x + 'px', top: textInputPosition.y + 'px' }">
            <el-input
              ref="textInput"
              v-model="textInputValue"
              placeholder="Enter text..."
              @keyup.enter="addTextNode"
              @blur="addTextNode"
              @keyup.esc="cancelTextInput" />
          </div>
        </div>
      </div>
    </div>
    
    <!-- Version History Dialog -->
    <el-dialog
      v-model="showVersionDialog"
      title="Canvas Version History"
      width="600px"
      :close-on-click-modal="false">
      <div v-if="canvasVersions.length === 0" class="empty-versions">
        <el-empty description="No previous versions found" />
      </div>
      <div v-else class="version-list">
        <div
          v-for="version in canvasVersions"
          :key="version.id"
          class="version-item">
          <div class="version-info">
            <div class="version-header">
              <span class="version-number">Version {{ version.version_number }}</span>
              <span class="version-date">{{ new Date(version.created_at).toLocaleString() }}</span>
            </div>
            <div class="version-description">{{ version.change_description }}</div>
          </div>
          <el-button
            size="small"
            type="primary"
            @click="restoreVersion(version)">
            Restore
          </el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { ref, onMounted, nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useWorkspaceStore } from '../../store/workspace'
import { supabase } from '../../supabase'
import { CaretBottom } from '@element-plus/icons-vue'

export default {
  name: 'CanvasCt',
  setup() {
    const route = useRoute()
    const workspaceStore = useWorkspaceStore()
    
    // Canvas refs
    const canvas = ref(null)
    const canvasContainer = ref(null)
    const textInput = ref(null)
    
    // Canvas state
    const ctx = ref(null)
    const isDrawing = ref(false)
    const currentTool = ref('select')
    const strokeColor = ref('#000000')
    const strokeWidth = ref(2)
    const fillColor = ref('transparent')
    
    // Text input state
    const showTextInput = ref(false)
    const textInputValue = ref('')
    const textInputPosition = ref({ x: 0, y: 0 })
    
    // Shape state
    const selectedShape = ref('')
    
    // Selection and interaction state
    const selectedNode = ref(null)
    const isDragging = ref(false)
    const isResizing = ref(false)
    const dragStart = ref({ x: 0, y: 0 })
    const resizeHandle = ref(null) // 'nw', 'ne', 'sw', 'se'
    
    // Version history state
    const showVersionDialog = ref(false)
    const canvasVersions = ref([])
    const currentCanvasId = ref(null)
    
    // Canvas data (JSON Canvas format)
    const canvasData = ref({
      nodes: [],
      edges: []
    })
    
    // Drawing state
    const lastX = ref(0)
    const lastY = ref(0)
    const drawingPath = ref([])
    
    const currentWorkspace = ref(null)
    
    onMounted(async () => {
      const workspaceId = route.params.workspaceId
      if (workspaceId) {
        // Load workspaces if not already loaded
        if (workspaceStore.workspaces.length === 0) {
          await workspaceStore.loadWorkspaces()
        }
        
        // Find the current workspace from the loaded workspaces
        currentWorkspace.value = workspaceStore.workspaces.find(w => w.id == workspaceId)
        
        if (currentWorkspace.value) {
          await loadCanvasData(workspaceId)
          initializeCanvas()
        }
      }
    })
    
    const initializeCanvas = () => {
      if (!canvas.value) return
      
      ctx.value = canvas.value.getContext('2d')
      resizeCanvas()
      
      // Set initial canvas style
      ctx.value.strokeStyle = strokeColor.value
      ctx.value.lineWidth = strokeWidth.value
      ctx.value.lineCap = 'round'
      ctx.value.lineJoin = 'round'
      
      renderCanvas()
    }
    
    const resizeCanvas = () => {
      if (!canvas.value || !canvasContainer.value) return
      
      const container = canvasContainer.value
      canvas.value.width = container.clientWidth
      canvas.value.height = container.clientHeight
    }
    
    const setTool = (tool) => {
      currentTool.value = tool
      if (tool === 'text') {
        canvas.value.style.cursor = 'text'
      } else if (tool === 'shape') {
        canvas.value.style.cursor = 'crosshair'
      } else {
        canvas.value.style.cursor = 'default'
      }
    }
    
    const addShape = (shapeType) => {
      selectedShape.value = shapeType
      setTool('shape')
    }
    
    const addShapeAtPosition = (shapeType, x, y) => {
      const node = {
        id: `shape-${Date.now()}`,
        type: 'shape',
        x: x,
        y: y,
        width: 100,
        height: 100,
        data: {
          shapeType: shapeType,
          strokeColor: strokeColor.value,
          strokeWidth: strokeWidth.value,
          fillColor: fillColor.value
        }
      }
      
      canvasData.value.nodes.push(node)
      saveCanvasData()
      selectedShape.value = '' // Reset selected shape
      setTool('select') // Switch back to select tool
    }
    
    const handleMouseDown = (e) => {
      const rect = canvas.value.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      
      if (currentTool.value === 'draw') {
        isDrawing.value = true
        lastX.value = x
        lastY.value = y
        drawingPath.value = [{ x: lastX.value, y: lastY.value }]
      } else if (currentTool.value === 'select') {
        // Check for resize handle first
        if (selectedNode.value) {
          const handle = getResizeHandle(x, y, selectedNode.value)
          if (handle) {
            isResizing.value = true
            resizeHandle.value = handle
            dragStart.value = { x, y }
            return
          }
        }
        
        // Check for node selection/dragging
        const clickedNode = getNodeAtPosition(x, y)
        if (clickedNode) {
          selectedNode.value = clickedNode
          isDragging.value = true
          dragStart.value = { x, y }
        } else {
          selectedNode.value = null
        }
      }
    }
    
    const handleMouseMove = (e) => {
      const rect = canvas.value.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      
      if (isDrawing.value && currentTool.value === 'draw') {
        ctx.value.beginPath()
        ctx.value.moveTo(lastX.value, lastY.value)
        ctx.value.lineTo(x, y)
        ctx.value.stroke()
        
        drawingPath.value.push({ x, y })
        lastX.value = x
        lastY.value = y
      } else if (isDragging.value && selectedNode.value) {
        const deltaX = x - dragStart.value.x
        const deltaY = y - dragStart.value.y
        
        selectedNode.value.x += deltaX
        selectedNode.value.y += deltaY
        
        dragStart.value = { x, y }
        renderCanvas()
      } else if (isResizing.value && selectedNode.value) {
        const deltaX = x - dragStart.value.x
        const deltaY = y - dragStart.value.y
        
        switch (resizeHandle.value) {
          case 'nw':
            selectedNode.value.x += deltaX
            selectedNode.value.y += deltaY
            selectedNode.value.width -= deltaX
            selectedNode.value.height -= deltaY
            break
          case 'ne':
            selectedNode.value.y += deltaY
            selectedNode.value.width += deltaX
            selectedNode.value.height -= deltaY
            break
          case 'sw':
            selectedNode.value.x += deltaX
            selectedNode.value.width -= deltaX
            selectedNode.value.height += deltaY
            break
          case 'se':
            selectedNode.value.width += deltaX
            selectedNode.value.height += deltaY
            break
        }
        
        // Ensure minimum size
        selectedNode.value.width = Math.max(20, selectedNode.value.width)
        selectedNode.value.height = Math.max(20, selectedNode.value.height)
        
        dragStart.value = { x, y }
        renderCanvas()
      }
    }
    
    const handleMouseUp = () => {
      if (isDrawing.value && currentTool.value === 'draw') {
        isDrawing.value = false
        // Save the drawing path as a node
        if (drawingPath.value.length > 1) {
          addDrawingNode()
        }
      } else if (isDragging.value || isResizing.value) {
        isDragging.value = false
        isResizing.value = false
        resizeHandle.value = null
        saveCanvasData()
      }
    }
    
    const handleClick = (e) => {
      if (currentTool.value === 'text') {
        const rect = canvas.value.getBoundingClientRect()
        textInputPosition.value = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        }
        showTextInput.value = true
        nextTick(() => {
          textInput.value?.focus()
        })
      } else if (currentTool.value === 'shape' && selectedShape.value) {
        const rect = canvas.value.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        addShapeAtPosition(selectedShape.value, x, y)
      }
    }
    
    const addDrawingNode = () => {
      const node = {
        id: `drawing-${Date.now()}`,
        type: 'drawing',
        x: drawingPath.value[0].x,
        y: drawingPath.value[0].y,
        width: Math.max(...drawingPath.value.map(p => p.x)) - Math.min(...drawingPath.value.map(p => p.x)),
        height: Math.max(...drawingPath.value.map(p => p.y)) - Math.min(...drawingPath.value.map(p => p.y)),
        data: {
          path: drawingPath.value,
          strokeColor: strokeColor.value,
          strokeWidth: strokeWidth.value
        }
      }
      
      canvasData.value.nodes.push(node)
      saveCanvasData()
    }
    
    const addTextNode = () => {
      if (!textInputValue.value.trim()) {
        cancelTextInput()
        return
      }
      
      const node = {
        id: `text-${Date.now()}`,
        type: 'text',
        x: textInputPosition.value.x,
        y: textInputPosition.value.y,
        width: 200,
        height: 50,
        data: {
          text: textInputValue.value,
          fontSize: 16,
          fontFamily: 'Arial',
          color: strokeColor.value
        }
      }
      
      canvasData.value.nodes.push(node)
      saveCanvasData()
      cancelTextInput()
    }
    
    const cancelTextInput = () => {
      showTextInput.value = false
      textInputValue.value = ''
    }
    
    const updateStrokeColor = (color) => {
      strokeColor.value = color
      if (ctx.value) {
        ctx.value.strokeStyle = color
      }
    }
    
    const updateStrokeWidth = (width) => {
      strokeWidth.value = width
      if (ctx.value) {
        ctx.value.lineWidth = width
      }
    }
    
    const updateFillColor = (color) => {
      fillColor.value = color
    }
    
    const getNodeAtPosition = (x, y) => {
      // Check nodes in reverse order (top to bottom)
      for (let i = canvasData.value.nodes.length - 1; i >= 0; i--) {
        const node = canvasData.value.nodes[i]
        if (node.type === 'shape' || node.type === 'text') {
          if (x >= node.x && x <= node.x + node.width &&
              y >= node.y && y <= node.y + node.height) {
            return node
          }
        }
      }
      return null
    }
    
    const getResizeHandle = (x, y, node) => {
      const handleSize = 8
      const nodeX = node.x
      const nodeY = node.y
      const nodeWidth = node.width
      const nodeHeight = node.height
      
      // Check corner handles
      if (x >= nodeX - handleSize && x <= nodeX + handleSize &&
          y >= nodeY - handleSize && y <= nodeY + handleSize) {
        return 'nw'
      }
      if (x >= nodeX + nodeWidth - handleSize && x <= nodeX + nodeWidth + handleSize &&
          y >= nodeY - handleSize && y <= nodeY + handleSize) {
        return 'ne'
      }
      if (x >= nodeX - handleSize && x <= nodeX + handleSize &&
          y >= nodeY + nodeHeight - handleSize && y <= nodeY + nodeHeight + handleSize) {
        return 'sw'
      }
      if (x >= nodeX + nodeWidth - handleSize && x <= nodeX + nodeWidth + handleSize &&
          y >= nodeY + nodeHeight - handleSize && y <= nodeY + nodeHeight + handleSize) {
        return 'se'
      }
      
      return null
    }
    
    const renderCanvas = () => {
      if (!ctx.value) return
      
      // Clear canvas
      ctx.value.clearRect(0, 0, canvas.value.width, canvas.value.height)
      
      // Render nodes
      canvasData.value.nodes.forEach(node => {
        if (node.type === 'drawing') {
          renderDrawingNode(node)
        } else if (node.type === 'text') {
          renderTextNode(node)
        } else if (node.type === 'shape') {
          renderShapeNode(node)
        }
      })
      
      // Render edges
      canvasData.value.edges.forEach(edge => {
        renderEdge(edge)
      })
      
      // Render selection handles
      if (selectedNode.value && (selectedNode.value.type === 'shape' || selectedNode.value.type === 'text')) {
        renderSelectionHandles(selectedNode.value)
      }
    }
    
    const renderDrawingNode = (node) => {
      if (!node.data.path || node.data.path.length < 2) return
      
      ctx.value.strokeStyle = node.data.strokeColor || '#000000'
      ctx.value.lineWidth = node.data.strokeWidth || 2
      ctx.value.lineCap = 'round'
      ctx.value.lineJoin = 'round'
      
      ctx.value.beginPath()
      ctx.value.moveTo(node.data.path[0].x, node.data.path[0].y)
      
      for (let i = 1; i < node.data.path.length; i++) {
        ctx.value.lineTo(node.data.path[i].x, node.data.path[i].y)
      }
      
      ctx.value.stroke()
    }
    
    const renderTextNode = (node) => {
      ctx.value.font = `${node.data.fontSize}px ${node.data.fontFamily}`
      ctx.value.fillStyle = node.data.color || '#000000'
      ctx.value.fillText(node.data.text, node.x, node.y + node.data.fontSize)
    }
    
    const renderShapeNode = (node) => {
      ctx.value.strokeStyle = node.data.strokeColor || '#000000'
      ctx.value.lineWidth = node.data.strokeWidth || 2
      ctx.value.fillStyle = node.data.fillColor || 'transparent'
      
      const x = node.x
      const y = node.y
      const width = node.width || 100
      const height = node.height || 100
      
      switch (node.data.shapeType) {
        case 'rectangle':
          ctx.value.beginPath()
          ctx.value.rect(x, y, width, height)
          if (node.data.fillColor !== 'transparent') {
            ctx.value.fill()
          }
          ctx.value.stroke()
          break
          
        case 'circle':
          ctx.value.beginPath()
          ctx.value.arc(x + width/2, y + height/2, Math.min(width, height)/2, 0, 2 * Math.PI)
          if (node.data.fillColor !== 'transparent') {
            ctx.value.fill()
          }
          ctx.value.stroke()
          break
          
        case 'triangle':
          ctx.value.beginPath()
          ctx.value.moveTo(x + width/2, y)
          ctx.value.lineTo(x, y + height)
          ctx.value.lineTo(x + width, y + height)
          ctx.value.closePath()
          if (node.data.fillColor !== 'transparent') {
            ctx.value.fill()
          }
          ctx.value.stroke()
          break
          
        case 'line':
          ctx.value.beginPath()
          ctx.value.moveTo(x, y)
          ctx.value.lineTo(x + width, y + height)
          ctx.value.stroke()
          break
          
        case 'arrow':
          // Draw arrow line
          ctx.value.beginPath()
          ctx.value.moveTo(x, y)
          ctx.value.lineTo(x + width * 0.8, y + height * 0.8)
          ctx.value.stroke()
          
          // Draw arrow head
          const arrowLength = 15
          const angle = Math.atan2(height * 0.8, width * 0.8)
          ctx.value.beginPath()
          ctx.value.moveTo(x + width * 0.8, y + height * 0.8)
          ctx.value.lineTo(
            x + width * 0.8 - arrowLength * Math.cos(angle - Math.PI/6),
            y + height * 0.8 - arrowLength * Math.sin(angle - Math.PI/6)
          )
          ctx.value.moveTo(x + width * 0.8, y + height * 0.8)
          ctx.value.lineTo(
            x + width * 0.8 - arrowLength * Math.cos(angle + Math.PI/6),
            y + height * 0.8 - arrowLength * Math.sin(angle + Math.PI/6)
          )
          ctx.value.stroke()
          break
      }
    }
    
    const renderSelectionHandles = (node) => {
      const x = node.x
      const y = node.y
      const width = node.width || 100
      const height = node.height || 100
      const handleSize = 6
      
      // Draw selection rectangle
      ctx.value.strokeStyle = '#409eff'
      ctx.value.lineWidth = 2
      ctx.value.setLineDash([5, 5])
      ctx.value.strokeRect(x - 2, y - 2, width + 4, height + 4)
      ctx.value.setLineDash([])
      
      // Draw corner handles
      ctx.value.fillStyle = '#409eff'
      ctx.value.strokeStyle = '#ffffff'
      ctx.value.lineWidth = 1
      
      // Top-left
      ctx.value.fillRect(x - handleSize, y - handleSize, handleSize * 2, handleSize * 2)
      ctx.value.strokeRect(x - handleSize, y - handleSize, handleSize * 2, handleSize * 2)
      
      // Top-right
      ctx.value.fillRect(x + width - handleSize, y - handleSize, handleSize * 2, handleSize * 2)
      ctx.value.strokeRect(x + width - handleSize, y - handleSize, handleSize * 2, handleSize * 2)
      
      // Bottom-left
      ctx.value.fillRect(x - handleSize, y + height - handleSize, handleSize * 2, handleSize * 2)
      ctx.value.strokeRect(x - handleSize, y + height - handleSize, handleSize * 2, handleSize * 2)
      
      // Bottom-right
      ctx.value.fillRect(x + width - handleSize, y + height - handleSize, handleSize * 2, handleSize * 2)
      ctx.value.strokeRect(x + width - handleSize, y + height - handleSize, handleSize * 2, handleSize * 2)
    }
    
    const renderEdge = (edge) => {
      const fromNode = canvasData.value.nodes.find(n => n.id === edge.fromNode)
      const toNode = canvasData.value.nodes.find(n => n.id === edge.toNode)
      
      if (!fromNode || !toNode) return
      
      ctx.value.strokeStyle = edge.color || '#666666'
      ctx.value.lineWidth = edge.width || 1
      ctx.value.beginPath()
      ctx.value.moveTo(fromNode.x, fromNode.y)
      ctx.value.lineTo(toNode.x, toNode.y)
      ctx.value.stroke()
    }
    
    const clearCanvas = () => {
      canvasData.value = { nodes: [], edges: [] }
      if (ctx.value) {
        ctx.value.clearRect(0, 0, canvas.value.width, canvas.value.height)
      }
      saveCanvasData()
    }
    
    const exportCanvas = () => {
      const dataStr = JSON.stringify(canvasData.value, null, 2)
      const dataBlob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(dataBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `canvas-${Date.now()}.canvas`
      link.click()
      URL.revokeObjectURL(url)
    }
    
    const importCanvas = () => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.canvas,.json'
      input.onchange = (e) => {
        const file = e.target.files[0]
        if (file) {
          const reader = new FileReader()
          reader.onload = (e) => {
            try {
              const data = JSON.parse(e.target.result)
              canvasData.value = data
              renderCanvas()
              saveCanvasData()
            } catch (error) {
              console.error('Error importing canvas:', error)
            }
          }
          reader.readAsText(file)
        }
      }
      input.click()
    }
    
    const loadCanvasData = async (workspaceId) => {
      try {
        const { data, error } = await supabase
          .from('canvas_data')
          .select('*')
          .eq('workspace_id', workspaceId)
          .maybeSingle()
        
        if (data && !error) {
          canvasData.value = data.canvas_data || { nodes: [], edges: [] }
          currentCanvasId.value = data.id
        }
      } catch (error) {
        console.error('Error loading canvas data:', error)
      }
    }
    
    const showVersionHistory = async () => {
      if (!currentCanvasId.value) {
        console.log('No canvas data found for this workspace')
        return
      }
      
      try {
        const { data, error } = await supabase
          .from('canvas_data_versions')
          .select('*')
          .eq('canvas_data_id', currentCanvasId.value)
          .order('version_number', { ascending: false })
        
        if (error) {
          console.error('Error loading canvas versions:', error)
          return
        }
        
        canvasVersions.value = data || []
        showVersionDialog.value = true
      } catch (error) {
        console.error('Error loading canvas versions:', error)
      }
    }
    
    const restoreVersion = async (version) => {
      try {
        // Update current canvas data with the selected version
        canvasData.value = version.canvas_data
        renderCanvas()
        
        // Save the restored version as a new version
        await saveCanvasData()
        
        showVersionDialog.value = false
      } catch (error) {
        console.error('Error restoring version:', error)
      }
    }
    
    const saveCanvasData = async () => {
      if (!currentWorkspace.value) return
      
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          console.error('No authenticated user found')
          return
        }
        
        // Check if canvas data already exists for this workspace
        const { data: existingCanvas, error: fetchError } = await supabase
          .from('canvas_data')
          .select('*')
          .eq('workspace_id', currentWorkspace.value.id)
          .maybeSingle()
        
        if (fetchError) {
          console.error('Error fetching existing canvas data:', fetchError)
          return
        }
        
        if (existingCanvas) {
          // Update existing canvas - save version first, then update
          await saveCanvasVersion(existingCanvas, user.id)
          
          // Update the main canvas data
          const { error: updateError } = await supabase
            .from('canvas_data')
            .update({
              canvas_data: canvasData.value,
              version_number: existingCanvas.version_number + 1,
              updated_by: user.id,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingCanvas.id)
          
          if (updateError) {
            console.error('Error updating canvas data:', updateError)
          }
        } else {
          // Create new canvas data
          const { error: insertError } = await supabase
            .from('canvas_data')
            .insert({
              workspace_id: currentWorkspace.value.id,
              canvas_data: canvasData.value,
              version_number: 1,
              created_by: user.id,
              updated_by: user.id,
              updated_at: new Date().toISOString()
            })
          
          if (insertError) {
            console.error('Error creating canvas data:', insertError)
          }
        }
      } catch (error) {
        console.error('Error saving canvas data:', error)
      }
    }
    
    const saveCanvasVersion = async (existingCanvas, userId) => {
      try {
        // Save the current version to canvas_data_versions
        const { error: versionError } = await supabase
          .from('canvas_data_versions')
          .insert({
            canvas_data_id: existingCanvas.id,
            workspace_id: currentWorkspace.value.id,
            canvas_data: existingCanvas.canvas_data,
            version_number: existingCanvas.version_number,
            created_by: userId,
            change_description: `Version ${existingCanvas.version_number} - Auto-saved on ${new Date().toLocaleString()}`
          })
        
        if (versionError) {
          console.error('Error saving canvas version:', versionError)
        }
      } catch (error) {
        console.error('Error saving canvas version:', error)
      }
    }
    
    // Watch for canvas data changes and re-render
    watch(canvasData, () => {
      renderCanvas()
    }, { deep: true })
    
          return {
        canvas,
        canvasContainer,
        textInput,
        currentTool,
        strokeColor,
        strokeWidth,
        showTextInput,
        textInputValue,
        textInputPosition,
        selectedShape,
        selectedNode,
        isDragging,
        isResizing,
        fillColor,
        showVersionDialog,
        canvasVersions,
        currentWorkspace,
        setTool,
        addShape,
        updateFillColor,
        showVersionHistory,
        restoreVersion,
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        handleClick,
        addTextNode,
        cancelTextInput,
        updateStrokeColor,
        updateStrokeWidth,
        clearCanvas,
        exportCanvas,
        importCanvas
      }
  }
}
</script>

<style scoped>
.canvas-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #f5f7fa;
}

.canvas-header {
  padding: 20px;
  background-color: white;
  border-bottom: 1px solid #e4e7ed;
}

.canvas-header h1 {
  margin: 0 0 8px 0;
  color: #303133;
  font-size: 24px;
  font-weight: 600;
}

.canvas-description {
  margin: 0;
  color: #606266;
  font-size: 14px;
}

.canvas-content {
  flex: 1;
  padding-top: 5px;
  overflow: hidden;
}

.canvas-workspace {
  height: 100%;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
}

.canvas-toolbar {
  padding: 16px;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
}

.canvas-area {
  flex: 1;
  position: relative;
  overflow: hidden;
  min-height: 800px;
}

canvas {
  display: block;
  cursor: crosshair;
  background-color: #fafafa;
}

.text-input-overlay {
  position: absolute;
  z-index: 1000;
  background: white;
  border: 1px solid #409eff;
  border-radius: 4px;
  padding: 4px;
}

.text-input-overlay .el-input {
  width: 200px;
}

/* Version History Styles */
.empty-versions {
  text-align: center;
  padding: 20px;
}

.version-list {
  max-height: 400px;
  overflow-y: auto;
}

.version-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border-bottom: 1px solid #e4e7ed;
  transition: background-color 0.2s;
}

.version-item:hover {
  background-color: #f5f7fa;
}

.version-item:last-child {
  border-bottom: none;
}

.version-info {
  flex: 1;
  margin-right: 16px;
}

.version-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.version-number {
  font-weight: 600;
  color: #303133;
}

.version-date {
  font-size: 0.85rem;
  color: #909399;
}

.version-description {
  font-size: 0.9rem;
  color: #606266;
  line-height: 1.4;
}
</style> 