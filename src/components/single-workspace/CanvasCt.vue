<template>
  <div class="canvas-container">    
    <div class="canvas-content">
      <div class="canvas-workspace">
        <div class="canvas-toolbar">
          <el-button-group>
            <el-button 
              :type="currentTool === 'select' ? 'primary' : 'default'" 
              @click="setTool('select')">
              <template #icon>
                <Select />
              </template>
              Select
            </el-button>
            <el-button 
              :type="currentTool === 'draw' ? 'primary' : 'default'" 
              @click="setTool('draw')">
              <template #icon>
                <Edit />
              </template>
              Draw
            </el-button>
            <el-button 
              :type="currentTool === 'text' ? 'primary' : 'default'" 
              @click="setTool('text')">
              <template #icon>
                <Document />
              </template>
              Text
            </el-button>
            <el-dropdown @command="addShape" trigger="click">
              <el-button 
                :type="currentTool === 'shape' ? 'primary' : 'default'">
                <template #icon>
                  <CirclePlus />
                </template>
                Shape
                <template #suffix>
                  <CaretBottom />
                </template>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="rectangle">Rectangle</el-dropdown-item>
                  <el-dropdown-item command="circle">Circle</el-dropdown-item>
                  <el-dropdown-item command="triangle">Triangle</el-dropdown-item>
                  <el-dropdown-item command="line">Straight Line</el-dropdown-item>
                  <el-dropdown-item command="curved-line">Curved Line</el-dropdown-item>
                  <el-dropdown-item command="arrow">Straight Arrow</el-dropdown-item>
                  <el-dropdown-item command="curved-arrow">Curved Arrow</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </el-button-group>
          
          <el-divider direction="vertical" />
          
          <div class="color-controls">
            <div class="control-group">
              <span class="control-label">Border:</span>
              <el-color-picker 
                v-model="strokeColor" 
                size="small"
                @change="updateStrokeColor" />
            </div>
            
            <div class="control-group">
              <span class="control-label">Width:</span>
              <el-input-number 
                v-model="strokeWidth" 
                :min="1" 
                :max="20" 
                size="small"
                @change="updateStrokeWidth" />
            </div>
            
            <div class="control-group">
              <span class="control-label">Fill:</span>
              <el-color-picker 
                v-model="fillColor" 
                size="small"
                @change="updateFillColor" />
            </div>
          </div>
          
                     <div class="canvas-toolbar-right">
             <el-button @click="clearCanvas">
               <template #icon>
                 <Delete />
               </template>
               Clear
             </el-button>
           
             <el-dropdown @command="handleToolCommand" trigger="click">
               <el-button>
                 <template #icon>
                   <Setting />
                 </template>
               </el-button>
               <template #dropdown>
                 <el-dropdown-menu>
                   <el-dropdown-item command="export">
                     <el-icon><Download /></el-icon>
                     Export
                   </el-dropdown-item>
                   <el-dropdown-item command="import">
                     <el-icon><Upload /></el-icon>
                     Import
                   </el-dropdown-item>
                   <el-dropdown-item command="history">
                     <el-icon><Clock /></el-icon>
                     History
                   </el-dropdown-item>
                 </el-dropdown-menu>
               </template>
             </el-dropdown>
           </div>
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
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useWorkspaceStore } from '../../store/workspace'
import { supabase } from '../../supabase'
import { CaretBottom, Setting, Download, Upload, Clock, Delete, Select, Edit, Document, CirclePlus} from '@element-plus/icons-vue'

export default {
  name: 'CanvasCt',
  components: {
    CaretBottom,
    Setting,
    Download,
    Upload,
    Clock,
    Delete,
    Select,
    Edit,
    Document,
    CirclePlus
  },
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
    
    // Undo/Redo state
    const undoStack = ref([])
    const redoStack = ref([])
    const maxUndoSteps = 50
    
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
          setupKeyboardEvents()
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
      saveState()
      
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
            saveState() // Save state before resizing
            return
          }
        }
        
        // Check for node selection/dragging
        const clickedNode = getNodeAtPosition(x, y)
        if (clickedNode) {
          selectedNode.value = clickedNode
          isDragging.value = true
          dragStart.value = { x, y }
          saveState() // Save state before dragging
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
        
        // Special handling for drawing nodes - transform the path data
        if (selectedNode.value.type === 'drawing' && selectedNode.value.data.path) {
          transformDrawingPath(selectedNode.value)
        }
        
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
      const rect = canvas.value.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      
      if (currentTool.value === 'text') {
        textInputPosition.value = {
          x: x,
          y: y
        }
        showTextInput.value = true
        nextTick(() => {
          textInput.value?.focus()
        })
      } else if (currentTool.value === 'shape' && selectedShape.value) {
        addShapeAtPosition(selectedShape.value, x, y)
      } else if (currentTool.value === 'select') {
        // Check if we clicked on a text node to edit it
        const clickedNode = getNodeAtPosition(x, y)
        if (clickedNode && clickedNode.type === 'text') {
          // Activate text editing for the selected text node
          selectedNode.value = clickedNode
          textInputPosition.value = {
            x: clickedNode.x,
            y: clickedNode.y
          }
          textInputValue.value = clickedNode.data.text || ''
          showTextInput.value = true
          nextTick(() => {
            textInput.value?.focus()
          })
        }
      }
    }
    
    const addDrawingNode = () => {
      saveState()
      
      // Calculate proper bounding box for the drawing
      const minX = Math.min(...drawingPath.value.map(p => p.x))
      const maxX = Math.max(...drawingPath.value.map(p => p.x))
      const minY = Math.min(...drawingPath.value.map(p => p.y))
      const maxY = Math.max(...drawingPath.value.map(p => p.y))
      
      const node = {
        id: `drawing-${Date.now()}`,
        type: 'drawing',
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
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
      
      saveState()
      
      // Check if we're editing an existing text node
      if (selectedNode.value && selectedNode.value.type === 'text') {
        // Update existing text node
        selectedNode.value.data.text = textInputValue.value
        selectedNode.value.data.color = strokeColor.value
        selectedNode.value = null // Clear selection
      } else {
        // Create new text node
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
      }
      
      saveCanvasData()
      cancelTextInput()
    }
    
    const cancelTextInput = () => {
      showTextInput.value = false
      textInputValue.value = ''
      // Clear selected node if we were editing text
      if (selectedNode.value && selectedNode.value.type === 'text') {
        selectedNode.value = null
      }
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
    
    const handleToolCommand = (command) => {
      switch (command) {
        case 'export':
          exportCanvas()
          break
        case 'import':
          importCanvas()
          break
        case 'history':
          showVersionHistory()
          break
      }
    }
    
    const setupKeyboardEvents = () => {
      document.addEventListener('keydown', handleKeyDown)
    }
    
    const handleKeyDown = (e) => {
      // Check if we're in a text input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return
      }
      
      // Support both CMD (Mac) and CTRL (other OS) keys
      const isModifierKey = e.metaKey || e.ctrlKey
      
      if (isModifierKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if (isModifierKey && e.shiftKey && e.key === 'Z') {
        e.preventDefault()
        redo()
      }
    }
    
    const saveState = () => {
      // Save current state to undo stack
      const currentState = JSON.parse(JSON.stringify(canvasData.value))
      undoStack.value.push(currentState)
      
      // Clear redo stack when new action is performed
      redoStack.value = []
      
      // Limit undo stack size
      if (undoStack.value.length > maxUndoSteps) {
        undoStack.value.shift()
      }
    }
    
    const undo = () => {
      if (undoStack.value.length === 0) return
      
      // Save current state to redo stack
      const currentState = JSON.parse(JSON.stringify(canvasData.value))
      redoStack.value.push(currentState)
      
      // Restore previous state
      const previousState = undoStack.value.pop()
      canvasData.value = previousState
      
      // Limit redo stack size
      if (redoStack.value.length > maxUndoSteps) {
        redoStack.value.shift()
      }
    }
    
    const redo = () => {
      if (redoStack.value.length === 0) return
      
      // Save current state to undo stack
      const currentState = JSON.parse(JSON.stringify(canvasData.value))
      undoStack.value.push(currentState)
      
      // Restore next state
      const nextState = redoStack.value.pop()
      canvasData.value = nextState
      
      // Limit undo stack size
      if (undoStack.value.length > maxUndoSteps) {
        undoStack.value.shift()
      }
    }
    
    const getNodeAtPosition = (x, y) => {
      // Check nodes in reverse order (top to bottom)
      for (let i = canvasData.value.nodes.length - 1; i >= 0; i--) {
        const node = canvasData.value.nodes[i]
        if (node.type === 'shape' || node.type === 'text' || node.type === 'drawing') {
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
    
    const transformDrawingPath = (node) => {
      if (!node.data.path || node.data.path.length < 2) return
      
      // Calculate the original bounding box of the path
      const originalPoints = node.data.path
      const minX = Math.min(...originalPoints.map(p => p.x))
      const maxX = Math.max(...originalPoints.map(p => p.x))
      const minY = Math.min(...originalPoints.map(p => p.y))
      const maxY = Math.max(...originalPoints.map(p => p.y))
      const originalWidth = maxX - minX
      const originalHeight = maxY - minY
      
      // Avoid division by zero
      if (originalWidth === 0 || originalHeight === 0) return
      
      // Calculate scale factors
      const scaleX = node.width / originalWidth
      const scaleY = node.height / originalHeight
      
      // Transform each point in the path
      const transformedPath = originalPoints.map(point => ({
        x: node.x + (point.x - minX) * scaleX,
        y: node.y + (point.y - minY) * scaleY
      }))
      
      // Update the node's path data
      node.data.path = transformedPath
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
      if (selectedNode.value && (selectedNode.value.type === 'shape' || selectedNode.value.type === 'text' || selectedNode.value.type === 'drawing')) {
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
          // Straight horizontal line
          ctx.value.beginPath()
          ctx.value.moveTo(x, y + height/2)
          ctx.value.lineTo(x + width, y + height/2)
          ctx.value.stroke()
          break
          
        case 'curved-line':
          // Curved line with control points
          ctx.value.beginPath()
          ctx.value.moveTo(x, y + height/2)
          const cp1x = x + width * 0.25
          const cp1y = y
          const cp2x = x + width * 0.75
          const cp2y = y + height
          ctx.value.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x + width, y + height/2)
          ctx.value.stroke()
          break
          
        case 'arrow':
          // Straight horizontal arrow
          const arrowWidth = width * 0.8
          const arrowY = y + height/2
          
          // Draw arrow line
          ctx.value.beginPath()
          ctx.value.moveTo(x, arrowY)
          ctx.value.lineTo(x + arrowWidth, arrowY)
          ctx.value.stroke()
          
          // Draw arrow head
          const arrowHeadSize = 12
          ctx.value.beginPath()
          ctx.value.moveTo(x + arrowWidth, arrowY)
          ctx.value.lineTo(x + arrowWidth - arrowHeadSize, arrowY - arrowHeadSize/2)
          ctx.value.moveTo(x + arrowWidth, arrowY)
          ctx.value.lineTo(x + arrowWidth - arrowHeadSize, arrowY + arrowHeadSize/2)
          ctx.value.stroke()
          break
          
        case 'curved-arrow':
          // Curved arrow
          const curvedArrowY = y + height/2
          const curvedArrowWidth = width * 0.8
          
          // Draw curved arrow line
          ctx.value.beginPath()
          ctx.value.moveTo(x, curvedArrowY)
          const arrowCp1x = x + width * 0.25
          const arrowCp1y = y
          const arrowCp2x = x + width * 0.75
          const arrowCp2y = y + height
          ctx.value.bezierCurveTo(arrowCp1x, arrowCp1y, arrowCp2x, arrowCp2y, x + curvedArrowWidth, curvedArrowY)
          ctx.value.stroke()
          
          // Draw curved arrow head
          const curvedArrowHeadSize = 12
          const endX = x + curvedArrowWidth
          const endY = curvedArrowY
          
          // Calculate tangent at the end point
          const tangentX = arrowCp2x - arrowCp1x
          const tangentY = arrowCp2y - arrowCp1y
          const tangentLength = Math.sqrt(tangentX * tangentX + tangentY * tangentY)
          const unitTangentX = tangentX / tangentLength
          const unitTangentY = tangentY / tangentLength
          
          // Perpendicular vector for arrow head
          const perpX = -unitTangentY
          const perpY = unitTangentX
          
          ctx.value.beginPath()
          ctx.value.moveTo(endX, endY)
          ctx.value.lineTo(
            endX - curvedArrowHeadSize * unitTangentX - curvedArrowHeadSize/2 * perpX,
            endY - curvedArrowHeadSize * unitTangentY - curvedArrowHeadSize/2 * perpY
          )
          ctx.value.moveTo(endX, endY)
          ctx.value.lineTo(
            endX - curvedArrowHeadSize * unitTangentX + curvedArrowHeadSize/2 * perpX,
            endY - curvedArrowHeadSize * unitTangentY + curvedArrowHeadSize/2 * perpY
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
      saveState()
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
          .is('task_id', null)
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
          .is('task_id', null)
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
              task_id: null,
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
    
    // Cleanup keyboard events on unmount
    onUnmounted(() => {
      document.removeEventListener('keydown', handleKeyDown)
    })
    
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
        undoStack,
        redoStack,
        showVersionDialog,
        canvasVersions,
        currentWorkspace,
        setTool,
        addShape,
        updateFillColor,
        handleToolCommand,
        undo,
        redo,
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

.canvas-toolbar-right {
  margin-left: auto;
  display: flex;
  gap: 16px;
  align-items: center;
  float: right;
}

.color-controls {
  display: flex;
  gap: 16px;
  align-items: center;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.control-label {
  font-size: 0.85rem;
  color: #606266;
  font-weight: 500;
  white-space: nowrap;
}

/* Icon styling */
.el-icon {
  width: 1em;
  height: 1em;
  vertical-align: middle;
}

.el-button .el-icon {
  margin-right: 4px;
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