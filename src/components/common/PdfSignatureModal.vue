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
        <div v-if="!fixedSignaturePositions" class="instruction-steps">
          <el-steps :active="currentStep" finish-status="success" simple>
            <el-step title="Review Document" />
            <el-step title="Place Signature" />
            <el-step title="Sign & Submit" />
          </el-steps>
        </div>
        <p class="instruction-text">
          <span v-if="!fixedSignaturePositions && currentStep === 0">Review the document below, then click "Next" to place your signature.</span>
          <span v-else-if="!fixedSignaturePositions && currentStep === 1">Click on the document where you want to place your signature.</span>
          <span v-else-if="!fixedSignaturePositions && currentStep === 2 && signatureAreas.some(area => !area.signatureImage)">
            Click on the blue signature areas below to draw your signature. Signed areas will appear in green.
          </span>
          <span v-else-if="!fixedSignaturePositions && currentStep === 2 && signatureAreas.every(area => area.signatureImage)">
            All signature areas completed! Review your signatures and click "Sign Document" to finalize.
          </span>
          <span v-else-if="fixedSignaturePositions && signatureAreas.some(area => !area.signatureImage)">
            Click on the blue signature areas below to add your signature. All signature areas will be signed with the same signature.
          </span>
          <span v-else-if="fixedSignaturePositions && signatureAreas.every(area => area.signatureImage)">
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
          <div class="signature-type-selector">
            <h4>Choose Signature Method</h4>
            <el-radio-group v-model="signatureType" @change="onSignatureTypeChange">
              <el-radio label="draw">Draw Signature</el-radio>
              <el-radio label="auto">Auto-generate from Name</el-radio>
              <el-radio label="upload">Upload Image</el-radio>
            </el-radio-group>
          </div>

          <!-- Draw Signature -->
          <div v-if="signatureType === 'draw'" class="signature-pad-container">
            <h5>Draw Your Signature</h5>
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

          <!-- Auto-generated Signature -->
          <div v-if="signatureType === 'auto'" class="auto-signature-container">
            <h5>Auto-generated Signature</h5>
            <p class="auto-signature-description">
              Choose a signature style and it will be automatically generated based on your full name.
            </p>

            <!-- Style Selection -->
            <div class="signature-style-selector" v-if="signerInfo.fullName">
              <h6>Choose Signature Style:</h6>
              <div class="signature-style-options">
                <div 
                  v-for="style in autoSignatureStyles" 
                  :key="style.id"
                  class="signature-style-option"
                  :class="{ 'selected': selectedAutoSignatureStyle === style.id }"
                  @click="selectSignatureStyle(style.id)">
                  <div class="style-preview">
                    <canvas :ref="`styleCanvas_${style.id}`" class="style-preview-canvas"></canvas>
                  </div>
                  <div class="style-name">{{ style.name }}</div>
                </div>
              </div>
            </div>

            <!-- Selected Style Preview -->
            <div class="auto-signature-preview" v-if="signerInfo.fullName">
              <h6>Your Signature:</h6>
              <canvas ref="autoSignatureCanvas" class="auto-signature-canvas"></canvas>
            </div>
            <p v-else class="auto-signature-placeholder">
              Please enter your full name below to generate signature options.
            </p>
          </div>

          <!-- Upload Signature -->
          <div v-if="signatureType === 'upload'" class="upload-signature-container">
            <h5>Upload Signature Image</h5>
            <p class="upload-signature-description">
              Upload a clear image of your signature (PNG, JPG, or GIF).
            </p>
            <el-upload
              ref="signatureUpload"
              :auto-upload="false"
              :on-change="handleSignatureImageUpload"
              :before-upload="beforeSignatureUpload"
              accept="image/*"
              :limit="1"
              :show-file-list="false">
              <el-button type="primary">
                <el-icon><Upload /></el-icon>
                Choose Image
              </el-button>
            </el-upload>
            <div v-if="uploadedSignatureImage" class="uploaded-signature-preview">
              <img :src="uploadedSignatureImage" alt="Uploaded signature" class="signature-preview-image" />
              <el-button @click="clearUploadedSignature" size="small" type="danger">
                <el-icon><Delete /></el-icon>
                Remove
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
import { Document, Delete, DocumentChecked, Edit, Close, ZoomIn, ZoomOut, ArrowLeft, ArrowRight, Loading, Warning, Upload } from '@element-plus/icons-vue';
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
    VuePdfEmbed,
    Upload
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
      hasDrawnSignature: false,
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
      },
      signatureType: 'draw', // 'draw', 'auto', 'upload'
      uploadedSignatureImage: null,
      autoSignatureText: '',
      selectedAutoSignatureStyle: 'style1',
      autoSignatureStyles: [
        {
          id: 'style1',
          name: 'Classic',
          font: 'bold 32px "Georgia", "Times New Roman", serif',
          style: 'elegant'
        },
        {
          id: 'style2', 
          name: 'Modern',
          font: '300 30px "Segoe UI", "Helvetica Neue", "Arial", sans-serif',
          style: 'clean'
        },
        {
          id: 'style3',
          name: 'Script',
          font: 'italic 34px "Lucida Handwriting", "Brush Script MT", "Lucida Script", cursive',
          style: 'handwritten'
        },
        {
          id: 'style4',
          name: 'Executive',
          font: 'bold 28px "Trebuchet MS", "Helvetica", "Arial", sans-serif',
          style: 'professional'
        },
        {
          id: 'style5',
          name: 'Stylish',
          font: 'italic bold 30px "Palatino", "Book Antiqua", "Georgia", serif',
          style: 'stylish'
        }
      ],
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
    },
    hasSignature() {
      if (this.signatureType === 'draw') {
        return this.hasDrawnSignature;
      } else if (this.signatureType === 'auto') {
        return !!this.signerInfo.fullName;
      } else if (this.signatureType === 'upload') {
        return !!this.uploadedSignatureImage;
      }
      return false;
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
    },
    'signerInfo.fullName'(newVal) {
      if (newVal && this.signatureType === 'auto') {
        this.$nextTick(() => {
          this.generateStylePreviews();
          this.generateAutoSignature();
        });
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
        
        this.hasDrawnSignature = false;
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
        this.hasDrawnSignature = true;
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
      this.hasDrawnSignature = true;
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
      this.hasDrawnSignature = true;
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
        this.hasDrawnSignature = true;
      }
    },

    clearSignature() {
      if (this.signatureType === 'draw') {
        const canvas = this.$refs.signatureCanvas;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        this.hasDrawnSignature = false;
      } else if (this.signatureType === 'auto') {
        const canvas = this.$refs.autoSignatureCanvas;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      } else if (this.signatureType === 'upload') {
        this.uploadedSignatureImage = null;
      }
    },

    getSignatureDataURL() {
      if (this.signatureType === 'draw') {
        const canvas = this.$refs.signatureCanvas;
        return canvas.toDataURL('image/png');
      } else if (this.signatureType === 'auto') {
        const canvas = this.$refs.autoSignatureCanvas;
        return canvas ? canvas.toDataURL('image/png') : null;
      } else if (this.signatureType === 'upload') {
        return this.uploadedSignatureImage;
      }
      return null;
    },

    applySignature() {
      const signatureDataURL = this.getSignatureDataURL();
      
      if (!signatureDataURL) {
        ElMessage.warning('Please create a signature first');
        return;
      }

      if (!this.selectedSignatureArea) {
        ElMessage.error('No signature area selected');
        return;
      }

      console.log('Applying signature to area:', this.selectedSignatureArea.id, 'Type:', this.signatureType);
      
      // If using fixed signature positions (external user), apply signature to ALL areas
      if (this.fixedSignaturePositions && this.fixedSignaturePositions.length) {
        // Apply signature to all unsigned areas
        this.signatureAreas.forEach((area, index) => {
          if (!area.signatureImage) {
            this.signatureAreas[index].signatureImage = signatureDataURL;
          }
        });
        console.log('Signature applied to all unsigned areas (external mode)');
      } else {
        // Normal mode: only apply to selected area
        const areaIndex = this.signatureAreas.findIndex(area => area.id === this.selectedSignatureArea.id);
        if (areaIndex !== -1) {
          this.signatureAreas[areaIndex].signatureImage = signatureDataURL;
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
    },

    onSignatureTypeChange() {
      this.clearSignature();
      this.uploadedSignatureImage = null;
      this.autoSignatureText = '';
    },

    async generateAutoSignature() {
      if (!this.signerInfo.fullName) {
        ElMessage.warning('Please enter your full name to generate an auto-signature.');
        return;
      }

      const canvas = this.$refs.autoSignatureCanvas;
      if (!canvas) return;

      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = 100; // Fixed height for auto-generated signature

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const selectedStyle = this.autoSignatureStyles.find(style => style.id === this.selectedAutoSignatureStyle);
      if (!selectedStyle) {
        console.warn('Selected auto-signature style not found:', this.selectedAutoSignatureStyle);
        return;
      }

      ctx.font = selectedStyle.font;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#000';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const text = this.signerInfo.fullName;
      const x = canvas.width / 2;
      const y = canvas.height / 2;

      // Apply different styling based on style type
      if (selectedStyle.style === 'elegant') {
        // Classic style with underline and subtle shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 2;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.fillText(text, x, y);
        ctx.shadowColor = 'transparent';
        
        // Add elegant underline
        const textWidth = ctx.measureText(text).width;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - textWidth / 2, y + 18);
        ctx.lineTo(x + textWidth / 2, y + 18);
        ctx.stroke();
      } else if (selectedStyle.style === 'handwritten') {
        // Script style with rotation and natural feel
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-0.03); // Slightly more rotation for handwritten feel
        ctx.translate(-x, -y);
        ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
        ctx.shadowBlur = 1;
        ctx.shadowOffsetX = 0.5;
        ctx.shadowOffsetY = 0.5;
        ctx.fillText(text, x, y);
        ctx.restore();
      } else if (selectedStyle.style === 'professional') {
        // Executive style with bold outline
        ctx.fillText(text, x, y);
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#333';
        ctx.strokeText(text, x, y);
      } else if (selectedStyle.style === 'stylish') {
        // Stylish style with gradient and flourish
        const gradient = ctx.createLinearGradient(0, y - 20, 0, y + 20);
        gradient.addColorStop(0, '#2c3e50');
        gradient.addColorStop(1, '#34495e');
        ctx.fillStyle = gradient;
        ctx.fillText(text, x, y);
        
        // Add decorative flourish
        const textWidth = ctx.measureText(text).width;
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        // Left flourish
        ctx.moveTo(x - textWidth / 2 - 15, y + 10);
        ctx.quadraticCurveTo(x - textWidth / 2 - 5, y + 5, x - textWidth / 2, y + 12);
        // Right flourish  
        ctx.moveTo(x + textWidth / 2, y + 12);
        ctx.quadraticCurveTo(x + textWidth / 2 + 5, y + 5, x + textWidth / 2 + 15, y + 10);
        ctx.stroke();
      } else {
        // Clean/modern style with subtle letter spacing
        ctx.letterSpacing = '1px';
        ctx.fillText(text, x, y);
      }
    },

    handleSignatureImageUpload(file) {
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          this.uploadedSignatureImage = e.target.result;
        };
        reader.readAsDataURL(file.raw);
      }
    },

    beforeSignatureUpload(file) {
      const isImage = file.type.startsWith('image/');
      if (!isImage) {
        ElMessage.error('Please upload an image file (PNG, JPG, or GIF)');
        return false;
      }
      const isLt2M = file.size / 1024 / 1024 < 2;
      if (!isLt2M) {
        ElMessage.error('Image must be smaller than 2MB!');
        return false;
      }
      return true;
    },

    clearUploadedSignature() {
      this.uploadedSignatureImage = null;
    },

    selectSignatureStyle(styleId) {
      this.selectedAutoSignatureStyle = styleId;
      this.generateAutoSignature();
    },

    generateStylePreviews() {
      if (!this.signerInfo.fullName) return;

      this.$nextTick(() => {
        this.autoSignatureStyles.forEach(style => {
          const canvasRef = `styleCanvas_${style.id}`;
          const canvas = this.$refs[canvasRef];
          if (!canvas || !canvas.length) return;

          const canvasElement = canvas[0];
          canvasElement.width = 200;
          canvasElement.height = 60;

          const ctx = canvasElement.getContext('2d');
          ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

          ctx.font = style.font;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#000';
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 1;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          const text = this.signerInfo.fullName;
          const x = canvasElement.width / 2;
          const y = canvasElement.height / 2;

          // Scale font size for preview
          const scaledFont = style.font.replace(/\d+px/, '20px');
          ctx.font = scaledFont;

          // Apply styling
          if (style.style === 'elegant') {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
            ctx.shadowBlur = 1;
            ctx.shadowOffsetX = 0.5;
            ctx.shadowOffsetY = 0.5;
            ctx.fillText(text, x, y);
            ctx.shadowColor = 'transparent';
            
            const textWidth = ctx.measureText(text).width;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(x - textWidth / 2, y + 8);
            ctx.lineTo(x + textWidth / 2, y + 8);
            ctx.stroke();
          } else if (style.style === 'handwritten') {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(-0.02);
            ctx.translate(-x, -y);
            ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
            ctx.shadowBlur = 0.5;
            ctx.shadowOffsetX = 0.3;
            ctx.shadowOffsetY = 0.3;
            ctx.fillText(text, x, y);
            ctx.restore();
          } else if (style.style === 'professional') {
            ctx.fillText(text, x, y);
            ctx.lineWidth = 0.8;
            ctx.strokeStyle = '#333';
            ctx.strokeText(text, x, y);
          } else if (style.style === 'stylish') {
            const gradient = ctx.createLinearGradient(0, y - 10, 0, y + 10);
            gradient.addColorStop(0, '#2c3e50');
            gradient.addColorStop(1, '#34495e');
            ctx.fillStyle = gradient;
            ctx.fillText(text, x, y);
            
            // Add mini decorative flourish for preview
            const textWidth = ctx.measureText(text).width;
            ctx.strokeStyle = '#2c3e50';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x - textWidth / 2 - 8, y + 6);
            ctx.quadraticCurveTo(x - textWidth / 2 - 3, y + 3, x - textWidth / 2, y + 7);
            ctx.moveTo(x + textWidth / 2, y + 7);
            ctx.quadraticCurveTo(x + textWidth / 2 + 3, y + 3, x + textWidth / 2 + 8, y + 6);
            ctx.stroke();
          } else {
            ctx.fillText(text, x, y);
          }
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

.signature-type-selector {
  border-bottom: 1px solid #eee;
  padding-bottom: 1rem;
  margin-bottom: 1rem;
}

.signature-type-selector h4 {
  margin-bottom: 0.5rem;
  color: #333;
}

.auto-signature-container,
.upload-signature-container {
  border: 2px dashed #ddd;
  border-radius: 8px;
  padding: 1rem;
  background: #fafafa;
  text-align: center;
}

.auto-signature-container h5,
.upload-signature-container h5 {
  margin-bottom: 0.5rem;
  color: #333;
}

.auto-signature-description,
.upload-signature-description {
  font-size: 0.8rem;
  color: #666;
  margin-bottom: 1rem;
}

.auto-signature-preview,
.uploaded-signature-preview {
  margin-top: 0.5rem;
  margin-bottom: 1rem;
}

.auto-signature-preview {
  margin: 1.5rem 0;
  padding: 1.5rem;
  background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
  border: 2px dashed #dee2e6;
  border-radius: 12px;
  text-align: center;
}

.auto-signature-preview h6 {
  margin-bottom: 1rem;
  color: #2c3e50;
  font-size: 1rem;
  font-weight: 600;
}

.auto-signature-canvas {
  width: 100%;
  max-width: 400px;
  height: 100px;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  background: linear-gradient(135deg, #ffffff 0%, #fafafa 100%);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  margin: 0 auto;
  display: block;
}

.auto-signature-description {
  color: #6c757d;
  font-size: 0.9rem;
  line-height: 1.5;
  margin-bottom: 1rem;
}

.auto-signature-placeholder {
  color: #adb5bd;
  font-style: italic;
  padding: 2rem;
  text-align: center;
  border: 2px dashed #dee2e6;
  border-radius: 8px;
  background: #f8f9fa;
}

.uploaded-signature-preview {
  position: relative;
  display: inline-block;
  margin-top: 1rem;
  text-align: center;
}

.signature-preview-image {
  max-width: 300px;
  max-height: 150px;
  object-fit: contain;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  background: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.signature-type-selector .el-radio-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

@media (min-width: 768px) {
  .signature-type-selector .el-radio-group {
    flex-direction: row;
    gap: 1rem;
  }
}

.signature-style-selector {
  margin: 1rem 0;
  padding: 1rem;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-radius: 12px;
  border: 1px solid #dee2e6;
}

.signature-style-selector h6 {
  margin-bottom: 1rem;
  color: #2c3e50;
  font-size: 1rem;
  font-weight: 600;
  text-align: center;
}

.signature-style-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.signature-style-option {
  border: 2px solid #e9ecef;
  border-radius: 12px;
  padding: 0.75rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  position: relative;
  overflow: hidden;
}

.signature-style-option::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(64, 158, 255, 0.1), transparent);
  transition: left 0.5s;
}

.signature-style-option:hover {
  border-color: #409eff;
  box-shadow: 0 8px 25px rgba(64, 158, 255, 0.15);
  transform: translateY(-2px);
}

.signature-style-option:hover::before {
  left: 100%;
}

.signature-style-option.selected {
  border-color: #409eff;
  background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
  box-shadow: 0 8px 25px rgba(64, 158, 255, 0.25);
  transform: translateY(-1px);
}

.signature-style-option.selected::after {
  content: '✓';
  position: absolute;
  top: 8px;
  right: 8px;
  color: #409eff;
  font-weight: bold;
  font-size: 14px;
}

.style-preview {
  margin-bottom: 0.75rem;
  position: relative;
}

.style-preview-canvas {
  width: 100%;
  height: 45px;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  background: linear-gradient(135deg, #ffffff 0%, #fafafa 100%);
  transition: all 0.3s ease;
}

.signature-style-option:hover .style-preview-canvas {
  border-color: #409eff;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.1);
}

.signature-style-option.selected .style-preview-canvas {
  border-color: #409eff;
  background: linear-gradient(135deg, #f0f8ff 0%, #e6f3ff 100%);
}

.style-name {
  font-size: 0.85rem;
  color: #495057;
  font-weight: 500;
  transition: all 0.3s ease;
}

.signature-style-option:hover .style-name {
  color: #409eff;
}

.signature-style-option.selected .style-name {
  color: #1976d2;
  font-weight: 600;
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

@media (max-width: 768px) {
  .signature-style-options {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }
}

@media (max-width: 480px) {
  .signature-style-options {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
  
  .signature-style-option {
    padding: 0.75rem;
  }
  
  .style-preview-canvas {
    height: 50px;
  }
}
</style> 