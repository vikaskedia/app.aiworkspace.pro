<template>
  <el-dialog
    v-model="visible"
    title="Sign Document"
    width="90%"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    class="pdf-signature-modal">
    
    <div class="signature-content">
      <!-- Document Preview Section -->
      <div class="document-preview">
        <div class="document-header">
          <h3>{{ document.name }}</h3>
          <p class="document-info">
            Please review the document and provide your signature below.
          </p>
        </div>
        
        <!-- PDF Viewer -->
        <div class="pdf-viewer">
          <iframe 
            v-if="document.download_url"
            :src="document.download_url + '#toolbar=0&navpanes=0&scrollbar=0'"
            class="pdf-frame"
            frameborder="0">
          </iframe>
          <div v-else class="pdf-placeholder">
            <el-icon><Document /></el-icon>
            <p>Document not available</p>
          </div>
        </div>
      </div>

      <!-- Signature Section -->
      <div class="signature-section">
        <div class="signature-header">
          <h4>Your Signature</h4>
          <p class="signature-instruction">
            Please sign in the box below. Your signature will be legally binding.
          </p>
        </div>
        
        <!-- Signature Pad -->
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

        <!-- Legal Notice -->
        <div class="legal-notice">
          <el-alert
            type="warning"
            :closable="false"
            show-icon>
            <template #title>
              Legal Notice
            </template>
            By signing this document, you agree that your electronic signature has the same legal effect as a handwritten signature.
          </el-alert>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="$emit('close')" size="large">
          Cancel
        </el-button>
        <el-button 
          type="primary" 
          @click="submitSignature"
          :loading="signing"
          :disabled="!isSignatureValid"
          size="large">
          <el-icon><DocumentChecked /></el-icon>
          Sign Document
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script>
import { Document, Delete, DocumentChecked } from '@element-plus/icons-vue';
import { ElMessage, ElNotification } from 'element-plus';
import { supabase } from '../../supabase';

export default {
  name: 'PdfSignatureModal',
  components: {
    Document,
    Delete,
    DocumentChecked
  },
  props: {
    modelValue: {
      type: Boolean,
      default: false
    },
    document: {
      type: Object,
      required: true
    },
    userEmail: {
      type: String,
      default: ''
    }
  },
  emits: ['update:modelValue', 'close', 'signed'],
  data() {
    return {
      signing: false,
      isDrawing: false,
      lastX: 0,
      lastY: 0,
      hasSignature: false,
      signerInfo: {
        email: this.userEmail || '',
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
    isSignatureValid() {
      return this.hasSignature && 
             this.signerInfo.email.trim() && 
             this.signerInfo.fullName.trim();
    }
  },
  mounted() {
    if (this.visible) {
      this.initializeCanvas();
    }
    window.addEventListener('resize', this.handleResize);
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.handleResize);
  },
  watch: {
    visible(newVal) {
      if (newVal) {
        this.$nextTick(() => {
          this.initializeCanvas();
        });
      }
    }
  },
  methods: {
    handleResize() {
      if (this.visible) {
        this.$nextTick(() => {
          this.initializeCanvas();
        });
      }
    },
    initializeCanvas() {
      const canvas = this.$refs.signatureCanvas;
      if (!canvas) return;

      // Get the container's width
      const container = canvas.parentNode;
      const style = getComputedStyle(container);
      const paddingLeft = parseFloat(style.paddingLeft) || 0;
      const paddingRight = parseFloat(style.paddingRight) || 0;
      const width = container.clientWidth - paddingLeft - paddingRight;

      // Set canvas size
      canvas.width = width;
      canvas.height = 200; // or set to container.clientHeight for dynamic height

      // Reset drawing context
      const ctx = canvas.getContext('2d');
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Clear the canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      this.hasSignature = false;
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

    async submitSignature() {
      try {
        this.signing = true;

        const signatureImage = this.getSignatureDataURL();
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
        const signatureData = {
          task_id: this.document.task_id,
          document_id: this.document.id,
          user_email: this.signerInfo.email,
          full_name: this.signerInfo.fullName, // Save the full name
          signature_image: signatureImage,
          ip_address: ipAddress,
          user_agent: userAgent,
          signature_date: new Date().toISOString(),
          status: 'completed'
        };
        // Insert signature directly with Supabase
        const { data: signature, error: signatureError } = await supabase
          .from('task_signatures')
          .insert([signatureData])
          .select()
          .single();
        if (signatureError) throw signatureError;
        // Update document status to signed
        const { error: updateError } = await supabase
          .from('task_documents')
          .update({
            signature_status: 'signed',
            signed_by: this.signerInfo.email,
            signed_at: new Date().toISOString()
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
    }
  }
};
</script>

<style scoped>
.pdf-signature-modal {
  max-width: 1200px;
}

.signature-content {
  display: grid;
  grid-template-columns: 1fr 400px;
  gap: 2rem;
  min-height: 600px;
}

.document-preview {
  display: flex;
  flex-direction: column;
}

.document-header h3 {
  margin: 0 0 0.5rem 0;
  color: #2c3e50;
}

.document-info {
  margin: 0 0 1rem 0;
  color: #666;
}

.pdf-viewer {
  flex: 1;
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
}

.pdf-frame {
  width: 100%;
  height: 100%;
  min-height: 500px;
}

.pdf-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 500px;
  color: #999;
}

.pdf-placeholder .el-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.signature-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.signature-header h4 {
  margin: 0 0 0.5rem 0;
  color: #2c3e50;
}

.signature-instruction {
  margin: 0;
  color: #666;
  font-size: 0.9rem;
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

.legal-notice {
  margin-top: 1rem;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
}

/* Mobile Responsiveness */
@media (max-width: 768px) {
  .signature-content {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .pdf-frame {
    min-height: 300px;
  }

  .signature-canvas {
    height: 150px;
  }

  .dialog-footer {
    flex-direction: column;
  }

  .dialog-footer .el-button {
    width: 100%;
  }
}
</style> 