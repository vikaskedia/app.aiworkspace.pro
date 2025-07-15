<template>
  <el-dialog
    v-model="visible"
    title="Sign Document"
    width="95%"
    style="margin-top: 2vh;"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    class="pdf-signature-modal">
    
    <div class="signature-content">
      <!-- Instructions -->
      <div class="instructions-header">
        <h3>{{ document?.name || 'Loading document...' }}</h3>
        <div class="instruction-steps">
          <el-steps :active="currentStep" finish-status="success" simple>
            <el-step title="Review Document" />
            <el-step title="Place Signature" />
            <el-step title="Sign & Submit" />
          </el-steps>
        </div>
        <p class="instruction-text">
          <span v-if="currentStep === 0">Review the document below, then click "Next" to place your signature.</span>
          <span v-else-if="currentStep === 1">Click on the document where you want to place your signature.</span>
          <span v-else-if="currentStep === 2 && signatureAreas.some(area => !area.signatureImage)">
            Click on the blue signature areas below to draw your signature. Signed areas will appear in green.
          </span>
          <span v-else-if="currentStep === 2 && signatureAreas.every(area => area.signatureImage)">
            All signature areas completed! Review your signatures and click "Sign Document" to finalize.
          </span>
          <span v-else>Click on signature areas to sign, then submit the document.</span>
        </p>
      </div>

      <!-- PDF Viewer with Signature Placement -->
      <div class="pdf-container">
        <div class="pdf-controls">
          <el-button-group>
            <el-button 
              @click="zoomOut" 
              :disabled="!document || currentStep === 2"
              size="small">
              <el-icon><ZoomOut /></el-icon>
            </el-button>
            <el-button size="small" disabled>{{ Math.round(zoomLevel * 100) }}%</el-button>
            <el-button 
              @click="zoomIn" 
              :disabled="!document || currentStep === 2"
              size="small">
              <el-icon><ZoomIn /></el-icon>
            </el-button>
          </el-button-group>
          
          <div class="page-controls" v-if="document && numPages > 1">
            <el-button 
              @click="previousPage" 
              :disabled="currentPage === 1"
              size="small">
              <el-icon><ArrowLeft /></el-icon>
            </el-button>
            <span class="page-info">{{ currentPage }} / {{ numPages }}</span>
            <el-button 
              @click="nextPage" 
              :disabled="currentPage === numPages"
              size="small">
              <el-icon><ArrowRight /></el-icon>
            </el-button>
          </div>
        </div>

        <div class="pdf-viewer" ref="pdfViewerRef" :class="{ 'signing-mode': currentStep === 1 }">
          <div class="pdf-page-wrapper" :style="{ transform: `scale(${zoomLevel})` }">
            <div v-if="!document" class="loading-state">
              <el-icon class="is-loading"><Loading /></el-icon>
              <p>Loading document...</p>
            </div>
            <vue-pdf-embed
              v-else-if="document.download_url"
              :source="document.download_url"
              :page="currentPage"
              class="pdf-embed"
              @loaded="onPdfLoaded"
              @page-loaded="onPageLoaded"
              @click="currentStep === 1 ? handlePdfClick($event) : null"
            />
            <div v-else class="error-state">
              <el-icon><Warning /></el-icon>
              <p>Document URL not available</p>
            </div>
            
            <!-- Signature Placement Overlay -->
            <div 
              v-if="signatureAreas.some(area => area.page === currentPage)"
              class="signature-overlays">
                              <div
                  v-for="(area, index) in signatureAreas.filter(a => a.page === currentPage)"
                  :key="index"
                  class="signature-area"
                  :class="{ 'signed': area.signatureImage, 'unsigned': !area.signatureImage }"
                  :style="{
                    left: area.x + 'px',
                    top: area.y + 'px',
                    width: area.width + 'px',
                    height: area.height + 'px'
                  }"
                  @click="currentStep === 1 ? selectSignatureArea(area) : (currentStep === 2 && !area.signatureImage ? selectSignatureArea(area) : null)">
                  
                  <!-- Show signature image if signed -->
                  <div v-if="area.signatureImage" class="signature-display">
                    <img 
                      :src="area.signatureImage" 
                      alt="Signature" 
                      class="signature-image-preview"
                    />
                    <div v-if="currentStep === 2" class="signature-info">
                      <small>✓ Signed</small>
                    </div>
                  </div>
                  
                  <!-- Show placeholder if not signed -->
                  <div v-else class="signature-placeholder">
                    <el-icon><Edit /></el-icon>
                    <span>Click to Sign</span>
                  </div>
                  
                  <el-button 
                    v-if="currentStep === 1"
                    class="remove-area-btn"
                    type="danger"
                    size="small"
                    circle
                    @click.stop="removeSignatureArea(index)">
                    <el-icon><Close /></el-icon>
                  </el-button>
                  
                  <!-- Edit signature button for signed areas in step 2 -->
                  <el-button 
                    v-if="currentStep === 2 && area.signatureImage"
                    class="edit-signature-btn"
                    type="primary"
                    size="small"
                    @click.stop="selectSignatureArea(area)">
                    <el-icon><Edit /></el-icon>
                  </el-button>
                </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Signature Drawing Modal -->
      <el-dialog
        v-model="showSignatureDrawer"
        :title="selectedSignatureArea?.signatureImage ? 'Edit Your Signature' : 'Draw Your Signature'"
        width="95%"
        :close-on-click-modal="false">
        
        <div class="signature-drawer">
          <div class="signature-pad-container">
            <canvas
              ref="signatureCanvas"
              class="signature-canvas"
              @mousedown="startDrawing"
              @mousemove="draw"
              @mouseup="stopDrawing"
              @mouseleave="stopDrawing"
              @touchstart="handleTouch"
              @touchmove="handleTouch"
              @touchend="stopDrawing">
            </canvas>
            <div class="signature-controls">
              <el-button @click="clearSignature" size="small">
                <el-icon><Delete /></el-icon>
                Clear
              </el-button>
            </div>
          </div>

          <!-- Signer Information -->
          <div class="signer-info">
            <el-form :model="signerInfo" label-position="top">
              <el-form-item label="Email" required>
                <el-input
                  v-model="signerInfo.email"
                  :disabled="!!userEmail"
                  placeholder="Enter your email address" />
              </el-form-item>
              <el-form-item label="Full Name" required>
                <el-input
                  v-model="signerInfo.fullName"
                  placeholder="Enter your full name" />
              </el-form-item>
            </el-form>
          </div>
        </div>

        <template #footer>
          <el-button @click="showSignatureDrawer = false">Cancel</el-button>
          <el-button 
            type="primary" 
            @click="applySignature"
            :disabled="!hasSignature || !signerInfo.email.trim() || !signerInfo.fullName.trim()">
            Apply Signature
          </el-button>
        </template>
      </el-dialog>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="$emit('close')" size="large">
          Cancel
        </el-button>
        
        <el-button 
          v-if="currentStep === 0"
          type="primary" 
          @click="currentStep = 1"
          :disabled="!document"
          size="large">
          Next: Place Signature
        </el-button>
        
        <el-button 
          v-if="currentStep === 1 && positionOnlyMode"
          type="primary"
          @click="emitPositionsAndClose"
          :disabled="!signatureAreas.length"
          size="large">
          Save Positions
        </el-button>
        <el-button 
          v-if="currentStep === 1 && !positionOnlyMode"
          @click="currentStep = 0"
          size="large">
          Back
        </el-button>
        <el-button 
          v-if="currentStep === 1 && !positionOnlyMode"
          type="primary" 
          @click="proceedToSigning"
          :disabled="!document || signatureAreas.length === 0"
          size="large">
          Next: Review & Sign
        </el-button>
        
        <el-button 
          v-if="currentStep === 2 && !positionOnlyMode && !fixedSignaturePositions"
          @click="currentStep = 1"
          size="large">
          Back to Placement
        </el-button>
        <el-button 
          v-if="currentStep === 2 && !positionOnlyMode"
          type="primary" 
          @click="submitSignature"
          :loading="signing"
          :disabled="!allAreasSignedValid"
          size="large">
          <el-icon><DocumentChecked /></el-icon>
          Sign Document
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script>
import { Document, Delete, DocumentChecked, Edit, Close, ZoomIn, ZoomOut, ArrowLeft, ArrowRight, Loading, Warning } from '@element-plus/icons-vue';
import { ElMessage, ElNotification } from 'element-plus';
import { supabase } from '../../supabase';
import { PDFDocument, rgb } from 'pdf-lib';
import VuePdfEmbed from 'vue-pdf-embed';

export default {
  name: 'PdfSignatureModal',
  components: {
    Document,
    Delete,
    DocumentChecked,
    Edit,
    Close,
    ZoomIn,
    ZoomOut,
    ArrowLeft,
    ArrowRight,
    Loading,
    Warning,
    VuePdfEmbed
  },
  props: {
    modelValue: {
      type: Boolean,
      default: false
    },
    document: {
      type: Object,
      required: false,
      default: null,
      validator(value) {
        // Allow null during loading, but validate structure when provided
        return value === null || (
          value && 
          typeof value === 'object' && 
          'download_url' in value &&
          'name' in value
        );
      }
    },
    userEmail: {
      type: String,
      default: ''
    },
    positionOnlyMode: {
      type: Boolean,
      default: false
    },
    fixedSignaturePositions: {
      type: Array,
      default: null
    }
  },
  emits: ['update:modelValue', 'close', 'signed', 'positions-set'],
  data() {
    return {
      signing: false,
      isDrawing: false,
      lastX: 0,
      lastY: 0,
      hasSignature: false,
      currentStep: 0, // 0: review, 1: place signature, 2: sign
      
      // PDF rendering
      numPages: 0,
      currentPage: 1,
      zoomLevel: 1.0,
      pdfPageDimensions: {},
      
      // Signature areas
      signatureAreas: [],
      selectedSignatureArea: null,
      showSignatureDrawer: false,
      
      signerInfo: {
        email: '',
        fullName: ''
      }
    };
  },
  computed: {
    visible: {
      get() {
        return this.modelValue;
      },
      set(value) {
        this.$emit('update:modelValue', value);
      }
    },
    allAreasSignedValid() {
      return this.document &&
             this.signatureAreas.length > 0 && 
             this.signatureAreas.every(area => area.signatureImage) &&
             this.signerInfo.email.trim() && 
             this.signerInfo.fullName.trim();
    }
  },
  mounted() {
    window.addEventListener('resize', this.handleResize);
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.handleResize);
  },
  watch: {
    visible(newVal) {
      if (newVal) {
        this.resetState();
        console.log('Modal opening with:', {
          document: this.document ? this.document.name : 'No document',
          fixedSignaturePositions: this.fixedSignaturePositions,
          positionOnlyMode: this.positionOnlyMode
        });
        // If fixedSignaturePositions is provided, initialize signatureAreas and go to sign step
        if (this.fixedSignaturePositions && this.fixedSignaturePositions.length) {
          // For external users, we need to convert PDF coordinates back to display coordinates
          this.signatureAreas = this.fixedSignaturePositions.map((pos, index) => ({ 
            ...pos, 
            id: pos.id || `fixed-${Date.now()}-${index}`, // Ensure unique ID
            signatureImage: null,
            // Mark as PDF coordinates that need conversion when PDF loads
            isPdfCoordinates: true
          }));
          console.log('Initialized signature areas from fixed positions:', this.signatureAreas);
          // Add detailed coordinate logging
          this.signatureAreas.forEach((area, index) => {
            console.log(`Signature area ${index}:`, {
              id: area.id,
              page: area.page,
              coordinates: { x: area.x, y: area.y, width: area.width, height: area.height },
              hasSignature: !!area.signatureImage,
              isPdfCoordinates: area.isPdfCoordinates
            });
          });
          this.currentStep = 2; // Go directly to sign step
        } else if (this.fixedSignaturePositions) {
          console.warn('fixedSignaturePositions is set but empty:', this.fixedSignaturePositions);
        } else {
          console.log('No fixed signature positions provided');
        }
      }
    },
    userEmail: {
      immediate: true,
      handler(newVal) {
        if (newVal && !this.signerInfo.email) {
          this.signerInfo.email = newVal;
        }
      }
    }
  },
  methods: {
    resetState() {
      this.currentStep = 0;
      this.signatureAreas = [];
      this.selectedSignatureArea = null;
      this.showSignatureDrawer = false;
      this.currentPage = 1;
      this.zoomLevel = 1.0;
      this.pdfPageDimensions = {};
    },

    handleResize() {
      // vue-pdf-embed handles resizing automatically
    },

    async onPdfLoaded(pdf) {
      this.numPages = pdf.numPages;
      console.log(`PDF loaded successfully: ${this.numPages} pages`);
      
      // Store actual PDF page dimensions for coordinate conversion
      this.pdfPageDimensions = {};
      for (let i = 1; i <= this.numPages; i++) {
        try {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.0 });
          this.pdfPageDimensions[i] = {
            width: viewport.width,
            height: viewport.height
          };
        } catch (error) {
          console.warn(`Could not get dimensions for page ${i}:`, error);
        }
      }
      console.log('PDF page dimensions:', this.pdfPageDimensions);
      
      // Convert PDF coordinates to display coordinates for external users
      if (this.fixedSignaturePositions && this.signatureAreas.length > 0) {
        this.convertPdfCoordinatesToDisplay();
      }
    },

    onPageLoaded() {
      console.log(`Page ${this.currentPage} loaded`);
    },

    nextPage() {
      if (this.currentPage < this.numPages) {
        this.currentPage++;
      }
    },

    previousPage() {
      if (this.currentPage > 1) {
        this.currentPage--;
      }
    },

    zoomIn() {
      this.zoomLevel = Math.min(this.zoomLevel * 1.25, 3.0);
    },

    zoomOut() {
      this.zoomLevel = Math.max(this.zoomLevel * 0.8, 0.5);
    },

    handlePdfClick(event) {
      // Only allow adding signature areas if not in fixed mode and in placement step
      if (this.currentStep !== 1 || (this.fixedSignaturePositions && this.fixedSignaturePositions.length)) return;
      
      const pdfElement = event.target;
      const rect = pdfElement.getBoundingClientRect();
      
      // Calculate click position without zoom factor first (use raw coordinates)
      const rawX = event.clientX - rect.left;
      const rawY = event.clientY - rect.top;
      
      // Get the vue-pdf-embed component's actual rendered dimensions
      const pdfContainer = document.querySelector('.pdf-embed');
      const canvas = pdfContainer ? pdfContainer.querySelector('canvas') : null;
      
      let displayedWidth, displayedHeight;
      if (canvas) {
        // Use canvas dimensions if available (most accurate)
        displayedWidth = canvas.offsetWidth;
        displayedHeight = canvas.offsetHeight;
      } else {
        // Fallback to container dimensions
        displayedWidth = rect.width;
        displayedHeight = rect.height;
      }
      
      // Apply zoom factor to position
      const x = rawX / this.zoomLevel;
      const y = rawY / this.zoomLevel;
      
      console.log('Click placement:', {
        rawClick: { x: rawX, y: rawY },
        adjustedClick: { x, y },
        zoom: this.zoomLevel,
        displayed: { width: displayedWidth, height: displayedHeight },
        pdfPageDimensions: this.pdfPageDimensions[this.currentPage]
      });
      
      // Create new signature area with display context
      const signatureArea = {
        id: Date.now(),
        page: this.currentPage,
        x: x - 100, // Center the signature area on click
        y: y - 30,
        width: 200,
        height: 60,
        signatureImage: null,
        // Store display context for accurate coordinate conversion
        displayContext: {
          displayedWidth: displayedWidth,
          displayedHeight: displayedHeight,
          zoomLevel: this.zoomLevel,
          rawDisplayedWidth: rect.width,
          rawDisplayedHeight: rect.height,
          hasCanvas: !!canvas,
          timestamp: Date.now()
        }
      };
      
      this.signatureAreas.push(signatureArea);
    },

    selectSignatureArea(area) {
      console.log('Selecting signature area:', area.id, 'Current signatures:', this.signatureAreas.map(a => ({ id: a.id, hasSig: !!a.signatureImage })));
      this.selectedSignatureArea = area;
      this.showSignatureDrawer = true;
      this.initializeSignatureCanvas();
      
      // If the area already has a signature, load it into the canvas
      if (area.signatureImage) {
        this.$nextTick(() => {
          this.loadExistingSignature(area.signatureImage);
        });
      }
    },

    removeSignatureArea(index) {
      // Only allow removing if not in fixed mode
      if (this.fixedSignaturePositions && this.fixedSignaturePositions.length) return;
      this.signatureAreas.splice(index, 1);
    },

    proceedToSigning() {
      if (this.signatureAreas.length === 0) {
        ElMessage.warning('Please place at least one signature area');
        return;
      }
      this.currentStep = 2;
    },

    initializeSignatureCanvas() {
      this.$nextTick(() => {
        const canvas = this.$refs.signatureCanvas;
        if (!canvas) return;

        const containerWidth = canvas.parentElement ? canvas.parentElement.clientWidth : 500;
        canvas.width = containerWidth;
        canvas.height = 200;

        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        this.hasSignature = false;
      });
    },

    loadExistingSignature(signatureDataURL) {
      const canvas = this.$refs.signatureCanvas;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Clear canvas first
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw the existing signature centered on the canvas
        const aspectRatio = img.width / img.height;
        let drawWidth = canvas.width * 0.8;
        let drawHeight = drawWidth / aspectRatio;
        
        if (drawHeight > canvas.height * 0.8) {
          drawHeight = canvas.height * 0.8;
          drawWidth = drawHeight * aspectRatio;
        }
        
        const x = (canvas.width - drawWidth) / 2;
        const y = (canvas.height - drawHeight) / 2;
        
        ctx.drawImage(img, x, y, drawWidth, drawHeight);
        this.hasSignature = true;
      };
      
      img.src = signatureDataURL;
    },

    getMousePos(e) {
      const canvas = this.$refs.signatureCanvas;
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    },

    getTouchPos(e) {
      const canvas = this.$refs.signatureCanvas;
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    },

    startDrawing(e) {
      this.isDrawing = true;
      const pos = this.getMousePos(e);
      this.lastX = pos.x;
      this.lastY = pos.y;
    },

    draw(e) {
      if (!this.isDrawing) return;

      const canvas = this.$refs.signatureCanvas;
      const ctx = canvas.getContext('2d');
      const pos = this.getMousePos(e);

      ctx.beginPath();
      ctx.moveTo(this.lastX, this.lastY);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();

      this.lastX = pos.x;
      this.lastY = pos.y;
      this.hasSignature = true;
    },

    stopDrawing() {
      this.isDrawing = false;
    },

    handleTouch(e) {
      e.preventDefault();
      
      if (e.type === 'touchstart') {
        this.isDrawing = true;
        const pos = this.getTouchPos(e);
        this.lastX = pos.x;
        this.lastY = pos.y;
      } else if (e.type === 'touchmove' && this.isDrawing) {
        const canvas = this.$refs.signatureCanvas;
        const ctx = canvas.getContext('2d');
        const pos = this.getTouchPos(e);

        ctx.beginPath();
        ctx.moveTo(this.lastX, this.lastY);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();

        this.lastX = pos.x;
        this.lastY = pos.y;
        this.hasSignature = true;
      }
    },

    clearSignature() {
      const canvas = this.$refs.signatureCanvas;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      this.hasSignature = false;
    },

    getSignatureDataURL() {
      const canvas = this.$refs.signatureCanvas;
      return canvas.toDataURL('image/png');
    },

    applySignature() {
      if (!this.hasSignature) {
        ElMessage.warning('Please draw your signature first');
        return;
      }

      if (!this.selectedSignatureArea) {
        ElMessage.error('No signature area selected');
        return;
      }

      const signatureImage = this.getSignatureDataURL();
      
      console.log('Applying signature to area:', this.selectedSignatureArea.id);
      
      // If using fixed signature positions (external user), apply signature to ALL areas
      if (this.fixedSignaturePositions && this.fixedSignaturePositions.length) {
        // Apply signature to all unsigned areas
        this.signatureAreas.forEach((area, index) => {
          if (!area.signatureImage) {
            this.signatureAreas[index].signatureImage = signatureImage;
          }
        });
        console.log('Signature applied to all unsigned areas (external mode)');
      } else {
        // Normal mode: only apply to selected area
        const areaIndex = this.signatureAreas.findIndex(area => area.id === this.selectedSignatureArea.id);
        if (areaIndex !== -1) {
          this.signatureAreas[areaIndex].signatureImage = signatureImage;
          console.log('Signature applied to area at index:', areaIndex);
        } else {
          console.error('Could not find signature area with ID:', this.selectedSignatureArea.id);
        }
      }
      
      this.showSignatureDrawer = false;
      this.selectedSignatureArea = null;
      this.clearSignature();
      
      ElMessage.success('Signature applied to document');
    },

    async createSignedPdf() {
      if (!this.document?.download_url) {
        throw new Error('Document not available for signing');
      }

      try {
        // Fetch the original PDF
        const response = await fetch(this.document.download_url);
        const existingPdfBytes = await response.arrayBuffer();
        
        // Load the PDF with pdf-lib
        const pdfDoc = await PDFDocument.load(existingPdfBytes);
        const pages = pdfDoc.getPages();
        
        // Add signatures to the PDF
        for (const area of this.signatureAreas) {
          if (!area.signatureImage) continue;
          
          const page = pages[area.page - 1];
          if (!page) continue;
          
          // Convert signature image to PDF image
          const signatureImageBytes = this.dataURLToArrayBuffer(area.signatureImage);
          const signatureImage = await pdfDoc.embedPng(signatureImageBytes);
          
          // Get PDF page dimensions (prefer captured dimensions from vue-pdf-embed)
          const pageDimensions = this.pdfPageDimensions[area.page];
          const actualPageWidth = pageDimensions ? pageDimensions.width : page.getSize().width;
          const actualPageHeight = pageDimensions ? pageDimensions.height : page.getSize().height;
          
          // Use stored display context for accurate coordinate conversion
          const displayContext = area.displayContext;
          
          // Handle different coordinate systems
          if (this.fixedSignaturePositions && !displayContext) {
            // For external users with fixed positions - coordinates may have been converted to display
            // We need to convert back to PDF coordinates
            const pageDimensions = this.pdfPageDimensions[area.page];
            if (!pageDimensions) {
              console.warn('No page dimensions for coordinate conversion, using direct coordinates');
              const pdfX = area.x;
              const pdfY = actualPageHeight - area.y - area.height;
              const pdfWidth = area.width;
              const pdfHeight = area.height;
              
              page.drawImage(signatureImage, {
                x: pdfX,
                y: pdfY,
                width: pdfWidth,
                height: pdfHeight,
              });
              continue;
            }
            
            // Get current display dimensions
            const pdfElement = document.querySelector('.pdf-embed canvas') || document.querySelector('.pdf-embed');
            if (!pdfElement) {
              console.warn('Could not find PDF element, using fallback coordinates');
              const pdfX = area.x;
              const pdfY = actualPageHeight - area.y - area.height;
              const pdfWidth = area.width;
              const pdfHeight = area.height;
              
              page.drawImage(signatureImage, {
                x: pdfX,
                y: pdfY,
                width: pdfWidth,
                height: pdfHeight,
              });
              continue;
            }
            
            const displayedWidth = pdfElement.offsetWidth;
            const displayedHeight = pdfElement.offsetHeight;
            
            // Convert display coordinates back to PDF coordinates
            const scaleX = pageDimensions.width / displayedWidth;
            const scaleY = pageDimensions.height / displayedHeight;
            
            const pdfX = area.x * scaleX;
            const pdfY = actualPageHeight - (area.y * scaleY) - (area.height * scaleY);
            const pdfWidth = area.width * scaleX;
            const pdfHeight = area.height * scaleY;
            
            console.log('Converting display coordinates back to PDF for signing:', {
              signatureId: area.id,
              page: area.page,
              display: { x: area.x, y: area.y, width: area.width, height: area.height },
              pdf: { x: pdfX, y: pdfY, width: pdfWidth, height: pdfHeight },
              scales: { x: scaleX, y: scaleY },
              pageDimensions: pageDimensions,
              displayDimensions: { width: displayedWidth, height: displayedHeight }
            });
            
            page.drawImage(signatureImage, {
              x: pdfX,
              y: pdfY,
              width: pdfWidth,
              height: pdfHeight,
            });
            continue;
          }
          
          if (!displayContext) {
            console.warn('No display context found for signature area, using fallback conversion');
            // Fallback conversion if display context is missing
            const pdfX = area.x;
            const pdfY = actualPageHeight - area.y - area.height;
            const pdfWidth = area.width;
            const pdfHeight = area.height;
            
            page.drawImage(signatureImage, {
              x: pdfX,
              y: pdfY,
              width: pdfWidth,
              height: pdfHeight,
            });
            continue;
          }
          
          // Calculate scaling factors using stored display context
          const scaleX = actualPageWidth / (displayContext.displayedWidth / displayContext.zoomLevel);
          const scaleY = actualPageHeight / (displayContext.displayedHeight / displayContext.zoomLevel);
          
          // Convert coordinates from display space to PDF space
          const pdfX = (area.x / displayContext.zoomLevel) * scaleX;
          const pdfY = actualPageHeight - ((area.y / displayContext.zoomLevel) * scaleY) - ((area.height / displayContext.zoomLevel) * scaleY);
          const pdfWidth = (area.width / displayContext.zoomLevel) * scaleX;
          const pdfHeight = (area.height / displayContext.zoomLevel) * scaleY;
          
          console.log('Coordinate conversion for signature:', {
            signatureId: area.id,
            page: area.page,
            original: { x: area.x, y: area.y, width: area.width, height: area.height },
            displayContext: displayContext,
            actualPdfPage: { width: actualPageWidth, height: actualPageHeight },
            scales: { x: scaleX, y: scaleY },
            converted: { x: pdfX, y: pdfY, width: pdfWidth, height: pdfHeight },
            calculation: {
              'pdfX = (area.x / zoom) * scaleX': `(${area.x} / ${displayContext.zoomLevel}) * ${scaleX} = ${pdfX}`,
              'pdfY = pageHeight - ((area.y / zoom) * scaleY) - ((area.height / zoom) * scaleY)': 
                `${actualPageHeight} - ((${area.y} / ${displayContext.zoomLevel}) * ${scaleY}) - ((${area.height} / ${displayContext.zoomLevel}) * ${scaleY}) = ${pdfY}`
            }
          });
          
          // Draw signature on page
          page.drawImage(signatureImage, {
            x: pdfX,
            y: pdfY,
            width: pdfWidth,
            height: pdfHeight,
          });
        }
        
        // Serialize the PDF
        const pdfBytes = await pdfDoc.save();
        return new Uint8Array(pdfBytes);
      } catch (error) {
        console.error('Error creating signed PDF:', error);
        throw error;
      }
    },

    dataURLToArrayBuffer(dataURL) {
      const base64 = dataURL.split(',')[1];
      const binaryString = window.atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer;
    },

    async submitSignature() {
      if (!this.document) {
        ElMessage.error('Document not loaded');
        return;
      }

      try {
        this.signing = true;

        // Create signed PDF
        const signedPdfBytes = await this.createSignedPdf();
        
        // Upload signed PDF to storage
        const fileName = `${this.document.name.split('.')[0]}_signed_${Date.now()}.pdf`;
        const filePath = `task_documents/${this.document.task_id}/signed/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('task-files')
          .upload(filePath, signedPdfBytes, {
            contentType: 'application/pdf'
          });

        if (uploadError) throw uploadError;

        // Get public URL for signed document
        const { data: urlData } = supabase.storage
          .from('task-files')
          .getPublicUrl(filePath);

        // Get client information
        const userAgent = navigator.userAgent;
        let ipAddress = 'unknown';
        try {
          const ipResponse = await fetch('https://api.ipify.org?format=json');
          const ipData = await ipResponse.json();
          ipAddress = ipData.ip;
        } catch (error) {
          console.warn('Could not get IP address:', error);
        }

        // Store signature data
        const signatureData = {
          task_id: this.document.task_id,
          document_id: this.document.id,
          user_email: this.signerInfo.email,
          full_name: this.signerInfo.fullName,
          signature_image: this.signatureAreas[0]?.signatureImage || '', // Store first signature for display
          ip_address: ipAddress,
          user_agent: userAgent,
          signature_date: new Date().toISOString(),
          status: 'completed',
          metadata: {
            signature_areas: this.signatureAreas.map(area => ({
              page: area.page,
              x: area.x,
              y: area.y,
              width: area.width,
              height: area.height
            })),
            signed_pdf_path: filePath
          }
        };

        const { data: signature, error: signatureError } = await supabase
          .from('task_signatures')
          .insert([signatureData])
          .select()
          .single();

        if (signatureError) throw signatureError;

        // Update document status
        const { error: updateError } = await supabase
          .from('task_documents')
          .update({
            signature_status: 'signed',
            signed_by: this.signerInfo.email,
            signed_at: new Date().toISOString(),
            download_url: urlData.publicUrl, // Update to point to signed version
            metadata: {
              ...this.document.metadata,
              original_pdf_path: this.document.file_path,
              signed_pdf_path: filePath
            }
          })
          .eq('id', this.document.id);

        if (updateError) {
          console.warn('Document status update failed:', updateError);
        }

        ElNotification.success({
          title: 'Success',
          message: 'Document signed successfully!'
        });

        this.$emit('signed', signature);
        this.$emit('close');
      } catch (error) {
        console.error('Error signing document:', error);
        ElMessage.error('Failed to sign document: ' + error.message);
      } finally {
        this.signing = false;
      }
    },

    emitPositionsAndClose() {
      // Convert display coordinates to PDF coordinates before emitting
      const positions = this.signatureAreas.map(area => {
        // Get PDF page dimensions
        const pageDimensions = this.pdfPageDimensions[area.page];
        if (!pageDimensions || !area.displayContext) {
          console.warn('Missing dimensions or display context for area:', area.id);
          return {
            page: area.page,
            x: area.x,
            y: area.y,
            width: area.width,
            height: area.height
          };
        }

        // Calculate scaling factors to convert from display to PDF coordinates
        const scaleX = pageDimensions.width / (area.displayContext.displayedWidth / area.displayContext.zoomLevel);
        const scaleY = pageDimensions.height / (area.displayContext.displayedHeight / area.displayContext.zoomLevel);
        
        // Convert coordinates from display space to PDF space
        const pdfX = (area.x / area.displayContext.zoomLevel) * scaleX;
        const pdfY = (area.y / area.displayContext.zoomLevel) * scaleY;
        const pdfWidth = (area.width / area.displayContext.zoomLevel) * scaleX;
        const pdfHeight = (area.height / area.displayContext.zoomLevel) * scaleY;

        console.log('Converting position to PDF coordinates:', {
          areaId: area.id,
          display: { x: area.x, y: area.y, width: area.width, height: area.height },
          pdf: { x: pdfX, y: pdfY, width: pdfWidth, height: pdfHeight },
          scales: { x: scaleX, y: scaleY },
          pageDimensions: pageDimensions,
          displayContext: area.displayContext
        });

        return {
          page: area.page,
          x: pdfX,
          y: pdfY,
          width: pdfWidth,
          height: pdfHeight
        };
      });

      this.$emit('positions-set', positions);
      this.$emit('update:modelValue', false);
    },

    convertPdfCoordinatesToDisplay() {
      console.log('Converting PDF coordinates to display coordinates');
      this.$nextTick(() => {
        // Get the actual displayed PDF dimensions
        const pdfElement = document.querySelector('.pdf-embed canvas') || document.querySelector('.pdf-embed');
        if (!pdfElement) {
          console.warn('Could not find PDF element for coordinate conversion');
          return;
        }
        
        const displayedWidth = pdfElement.offsetWidth;
        const displayedHeight = pdfElement.offsetHeight;
        console.log('PDF display dimensions:', { width: displayedWidth, height: displayedHeight });
        
        this.signatureAreas = this.signatureAreas.map(area => {
          if (!area.isPdfCoordinates) return area;
          
          const pageDimensions = this.pdfPageDimensions[area.page];
          if (!pageDimensions) {
            console.warn('No page dimensions for page:', area.page);
            return area;
          }
          
          // Calculate scale factors
          const scaleX = displayedWidth / pageDimensions.width;
          const scaleY = displayedHeight / pageDimensions.height;
          
          // Convert PDF coordinates to display coordinates
          const displayX = area.x * scaleX;
          const displayY = area.y * scaleY;
          const displayWidth = area.width * scaleX;
          const displayHeight = area.height * scaleY;
          
          console.log(`Converting area ${area.id}:`, {
            pdf: { x: area.x, y: area.y, width: area.width, height: area.height },
            display: { x: displayX, y: displayY, width: displayWidth, height: displayHeight },
            scales: { x: scaleX, y: scaleY },
            pageDimensions
          });
          
          return {
            ...area,
            x: displayX,
            y: displayY,
            width: displayWidth,
            height: displayHeight,
            isPdfCoordinates: false
          };
        });
      });
    }
  }
};
</script>

<style scoped>
.pdf-signature-modal {
  max-width: 1400px;
}

.signature-content {
  display: flex;
  flex-direction: column;
  height: 80vh;
}

.instructions-header {
  margin-bottom: 1rem;
  text-align: center;
}

.instructions-header h3 {
  margin: 0 0 1rem 0;
  color: #2c3e50;
}

.instruction-steps {
  margin-bottom: 1rem;
}

.instruction-text {
  margin: 0;
  color: #666;
  font-size: 0.9rem;
}

.pdf-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
}

.pdf-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  background: #f5f7fa;
  border-bottom: 1px solid #ddd;
}

.pdf-signature-modal {
  margin-top: 2vh !important;
}

.page-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.page-info {
  font-size: 0.9rem;
  color: #666;
  margin: 0 0.5rem;
}

.pdf-viewer {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: auto;
  background: #f8f9fa;
  position: relative;
}

.pdf-viewer.signing-mode {
  cursor: crosshair;
}

.pdf-page-wrapper {
  position: relative;
  transform-origin: center;
  transition: transform 0.2s;
}

.pdf-embed {
  display: block;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  background: white;
}

.signature-overlays {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.signature-area {
  position: absolute;
  border: 2px dashed #409eff;
  background: rgba(64, 158, 255, 0.1);
  border-radius: 4px;
  pointer-events: all;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.signature-area:hover {
  background: rgba(64, 158, 255, 0.2);
}

.signature-area.signed {
  border: 2px solid #67c23a;
  background: rgba(103, 194, 58, 0.1);
}

.signature-area.signed:hover {
  background: rgba(103, 194, 58, 0.2);
}

.signature-area.unsigned {
  border: 2px dashed #409eff;
  background: rgba(64, 158, 255, 0.1);
}

.signature-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #409eff;
  font-size: 0.8rem;
}

.signature-placeholder .el-icon {
  font-size: 1.2rem;
  margin-bottom: 0.25rem;
}

.signature-display {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
}

.signature-image-preview {
  max-width: 100%;
  max-height: 80%;
  object-fit: contain;
  border-radius: 2px;
}

.signature-info {
  position: absolute;
  bottom: 2px;
  right: 4px;
  color: #67c23a;
  font-weight: 600;
  font-size: 0.7rem;
  background: white;
  padding: 1px 4px;
  border-radius: 2px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.remove-area-btn {
  position: absolute;
  top: -10px;
  right: -10px;
  width: 20px;
  height: 20px;
  padding: 0;
  font-size: 0.7rem;
}

.edit-signature-btn {
  position: absolute;
  top: -8px;
  left: -8px;
  width: 18px;
  height: 18px;
  padding: 0;
  font-size: 0.6rem;
  opacity: 0;
  transition: opacity 0.2s;
}

.signature-area:hover .edit-signature-btn {
  opacity: 1;
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
  color: #909399;
  background: #fafafa;
  border: 2px dashed #dcdfe6;
  border-radius: 8px;
}

.loading-state .el-icon,
.error-state .el-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.loading-state p,
.error-state p {
  margin: 0;
  font-size: 1.1rem;
}

.error-state {
  color: #f56c6c;
  border-color: #fbc4c4;
  background: #fef0f0;
}

.signature-drawer {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.signature-pad-container {
  border: 2px solid #ddd;
  border-radius: 8px;
  padding: 1rem;
  background: #fafafa;
}

.signature-canvas {
  width: 100%;
  background: white;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: crosshair;
}

.signature-controls {
  margin-top: 0.5rem;
  text-align: right;
}

.signer-info {
  border-top: 1px solid #eee;
  padding-top: 1rem;
}

.dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

/* Mobile Responsiveness */
@media (max-width: 768px) {
  .signature-content {
    height: 70vh;
  }

  .pdf-controls {
    flex-direction: column;
    gap: 0.5rem;
  }

  .dialog-footer {
    flex-direction: column;
  }

  .dialog-footer .el-button {
    width: 100%;
  }

  /* Prevent step titles from breaking awkwardly and enable horizontal scrolling */
  .instructions-header {
    overflow-x: auto;
  }

  /* Deep selectors so styles apply to Element Plus inner elements */
  .instructions-header :deep(.el-steps--simple) {
    min-width: 480px; /* ensure enough width for three steps */
    overflow-x: auto;
    padding: 10px;
  }

  .instructions-header :deep(.el-step__title) {
    font-size: 0.7rem; /* smaller font on mobile */
    white-space: nowrap; /* keep titles on one line */
    line-height: 1.2;
  }

  /* Reduce padding between steps and shrink icons */
  .instructions-header :deep(.el-steps--simple .el-step) {
    padding: 0 4px; /* tighter spacing */
  }

  .instructions-header :deep(.el-step__icon) {
    width: 22px;
    height: 22px;
    font-size: 12px;
  }
}
</style> 