<template>
  <div class="ai-fax-container">
    <!-- Main Form Section -->
    <div class="fax-form-container">
      <el-card class="fax-form-card" shadow="hover">
        <template #header>
          <div class="form-header">
            <el-icon size="20" color="#4f46e5">
              <Message />
            </el-icon>
            <span class="form-title">Send New Fax</span>
          </div>
        </template>

        <el-form
          ref="faxForm"
          :model="faxData"
          :rules="faxRules"
          label-position="top"
          class="fax-form"
        >
          <div class="form-row">
            <!-- From Field -->
            <div class="form-field">
              <el-form-item label="From" prop="from">
                <el-select
                  v-model="faxData.from"
                  placeholder="Select fax number"
                  size="large"
                  class="from-select"
                  :disabled="!availableFaxNumbers.length"
                >
                  <el-option
                    v-for="faxNumber in availableFaxNumbers"
                    :key="faxNumber.id"
                    :label="`${faxNumber.label} (${formatPhoneDisplay(faxNumber.number)})`"
                    :value="faxNumber.number"
                  >
                    <div class="fax-option">
                      <span class="fax-label">{{ faxNumber.label }}</span>
                      <span class="fax-number">{{ formatPhoneDisplay(faxNumber.number) }}</span>
                    </div>
                  </el-option>
                </el-select>
                <div v-if="!availableFaxNumbers.length" class="no-fax-numbers">
                  <el-alert
                    title="No fax numbers available"
                    description="Please add a fax number in workspace settings first."
                    type="warning"
                    :closable="false"
                    show-icon
                  />
                </div>
              </el-form-item>
            </div>

            <!-- To Field -->
            <div class="form-field">
              <el-form-item label="To" prop="to">
                <el-input
                  v-model="faxData.to"
                  placeholder="+1 (123) 456-7890"
                  size="large"
                  class="to-input"
                  @input="formatToNumber"
                >
                  <template #prefix>
                    <el-icon color="#6b7280">
                      <Phone />
                    </el-icon>
                  </template>
                </el-input>
              </el-form-item>
            </div>
          </div>

          <!-- File Upload -->
          <el-form-item label="Fax Attachment" prop="file">
            <el-upload
              ref="uploadRef"
              class="fax-upload"
              drag
              :auto-upload="false"
              :on-change="handleFileChange"
              :on-remove="handleFileRemove"
              :accept="pdf"
              :limit="1"
              :file-list="fileList"
            >
              <div class="upload-content">
                <el-icon class="upload-icon" size="48" color="#4f46e5">
                  <UploadFilled />
                </el-icon>
                <div class="upload-text">
                  <p class="upload-title">Drop file to upload</p>
                  <p class="upload-subtitle">or <em>click to browse</em></p>
                  <p class="upload-formats">PDF, DOC, DOCX, TXT, PNG, JPG (Max 10MB)</p>
                </div>
              </div>
            </el-upload>
          </el-form-item>

          <!-- Send Button -->
          <div class="form-actions">
            <el-button
              type="primary"
              size="large"
              @click="sendFax"
              :loading="sending"
              :disabled="!isFormValid"
              class="send-button"
            >
              <el-icon v-if="!sending">
                <Promotion />
              </el-icon>
              {{ sending ? 'Sending Fax...' : 'Send Fax' }}
            </el-button>
          </div>
        </el-form>
      </el-card>
    </div>

    <!-- Fax History Section -->
    <div class="fax-history-container">
      <el-tabs type="border-card" class="fax-tabs">
        <el-tab-pane label="Outbound Faxes">
          <template #label>
            <div class="tab-label">
              <el-icon><Upload /></el-icon>
              <span>Outbound Faxes</span>
              <el-badge :value="outboundFaxes.length" class="tab-badge" />
            </div>
          </template>
          
          <div class="fax-table-container">
            <el-table
              :data="outboundFaxes"
              stripe
              class="fax-table"
              v-loading="loadingOutbound"
              empty-text="No outbound faxes found"
            >
              <el-table-column prop="date" label="Date" width="120">
                <template #default="{ row }">
                  <div class="date-cell">
                    <el-icon size="14" color="#6b7280">
                      <Calendar />
                    </el-icon>
                    {{ formatDate(row.date) }}
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="to" label="To" width="150">
                <template #default="{ row }">
                  <div class="phone-cell">
                    {{ formatPhoneDisplay(row.to) }}
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="from" label="From" width="150">
                <template #default="{ row }">
                  <div class="phone-cell">
                    {{ formatPhoneDisplay(row.from) }}
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="subject" label="Subject" min-width="200" />
              <el-table-column prop="status" label="Status" width="120">
                <template #default="{ row }">
                  <el-tag
                    :type="getStatusType(row.status)"
                    size="small"
                    class="status-tag"
                  >
                    {{ row.status }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="Actions" width="100" fixed="right">
                <template #default="{ row }">
                  <el-button
                    type="primary"
                    size="small"
                    text
                    @click="viewFax(row)"
                  >
                    View
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>

        <el-tab-pane label="Inbound Faxes">
          <template #label>
            <div class="tab-label">
              <el-icon><Download /></el-icon>
              <span>Inbound Faxes</span>
              <el-badge :value="inboundFaxes.length" class="tab-badge" />
            </div>
          </template>
          
          <div class="fax-table-container">
            <el-table
              :data="inboundFaxes"
              stripe
              class="fax-table"
              v-loading="loadingInbound"
              empty-text="No inbound faxes found"
            >
              <el-table-column prop="date" label="Date" width="120">
                <template #default="{ row }">
                  <div class="date-cell">
                    <el-icon size="14" color="#6b7280">
                      <Calendar />
                    </el-icon>
                    {{ formatDate(row.date) }}
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="from" label="From" width="150">
                <template #default="{ row }">
                  <div class="phone-cell">
                    {{ formatPhoneDisplay(row.from) }}
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="to" label="To" width="150">
                <template #default="{ row }">
                  <div class="phone-cell">
                    {{ formatPhoneDisplay(row.to) }}
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="subject" label="Subject" min-width="200" />
              <el-table-column prop="pages" label="Pages" width="80" />
              <el-table-column label="Actions" width="100" fixed="right">
                <template #default="{ row }">
                  <el-button
                    type="primary"
                    size="small"
                    text
                    @click="viewFax(row)"
                  >
                    View
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useWorkspaceStore } from '../../store/workspace'
import { storeToRefs } from 'pinia'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Document,
  Message,
  Phone,
  UploadFilled,
  Promotion,
  Upload,
  Download,
  Calendar
} from '@element-plus/icons-vue'

export default {
  name: 'AiFaxCt',
  components: {
    Document,
    Message,
    Phone,
    UploadFilled,
    Promotion,
    Upload,
    Download,
    Calendar
  },
  setup() {
    const workspaceStore = useWorkspaceStore()
    const { currentWorkspace } = storeToRefs(workspaceStore)
    
    // Reactive data
    const faxData = ref({
      from: '',
      to: '',
      subject: '',
      file: null
    })
    
    const fileList = ref([])
    const sending = ref(false)
    const loadingOutbound = ref(false)
    const loadingInbound = ref(false)
    const outboundFaxes = ref([])
    const inboundFaxes = ref([])
    const autoReloadInterval = ref(null)
    
    // Form validation rules
    const faxRules = {
      from: [
        { required: true, message: 'Please select a fax number', trigger: 'change' }
      ],
      to: [
        { required: true, message: 'Please enter destination number', trigger: 'blur' },
        { pattern: /^\+1 \(\d{3}\) \d{3}-\d{4}$/, message: 'Invalid phone format', trigger: 'blur' }
      ],
      file: [
        { required: true, message: 'Please select a file to fax', trigger: 'change' }
      ]
    }
    
    // Computed properties
    const availableFaxNumbers = computed(() => {
      return currentWorkspace.value?.fax_numbers || []
    })
    
    const isFormValid = computed(() => {
      return faxData.value.from && 
             faxData.value.to && 
             faxData.value.subject && 
             fileList.value.length > 0 &&
             /^\+1 \(\d{3}\) \d{3}-\d{4}$/.test(faxData.value.to)
    })
    
    // Methods
    const formatToNumber = (value) => {
      // Remove all non-digits
      let cleaned = value.replace(/\D/g, '')
      
      // Limit to 11 digits (1 + 10)
      if (cleaned.length > 11) {
        cleaned = cleaned.substring(0, 11)
      }
      
      // Auto-add country code if not present
      if (cleaned.length === 10) {
        cleaned = '1' + cleaned
      }
      
      // Format as +1 (XXX) XXX-XXXX
      if (cleaned.length >= 1) {
        let formatted = '+1'
        if (cleaned.length > 1) {
          formatted += ' ('
          if (cleaned.length > 4) {
            formatted += cleaned.substring(1, 4) + ') '
            if (cleaned.length > 7) {
              formatted += cleaned.substring(4, 7) + '-' + cleaned.substring(7, 11)
            } else {
              formatted += cleaned.substring(4)
            }
          } else {
            formatted += cleaned.substring(1)
          }
        }
        faxData.value.to = formatted
      }
    }
    
    const formatPhoneDisplay = (phone) => {
      if (!phone) return ''
      const cleaned = phone.replace(/\D/g, '')
      if (cleaned.length === 11) {
        return `+${cleaned.substring(0, 1)} (${cleaned.substring(1, 4)}) ${cleaned.substring(4, 7)}-${cleaned.substring(7)}`
      }
      return phone
    }
    
    const getCleanPhoneNumber = (formatted) => {
      return formatted.replace(/\D/g, '')
    }
    
    const handleFileChange = (file) => {
      faxData.value.file = file.raw
      fileList.value = [file]
    }
    
    const handleFileRemove = () => {
      faxData.value.file = null
      fileList.value = []
    }
    
    const sendFax = async () => {
      try {
        alert('Sending fax...working on it');return;
        sending.value = true
        
        // Convert formatted phone number to clean format
        const cleanToNumber = '+' + getCleanPhoneNumber(faxData.value.to)
        
        // Here you would implement the actual fax sending logic
        // For now, we'll simulate the API call
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        // Add to outbound faxes list (mock data)
        const newFax = {
          id: Date.now(),
          date: new Date(),
          to: cleanToNumber,
          from: faxData.value.from,
          subject: faxData.value.subject,
          status: 'Sent',
          fileName: faxData.value.file.name
        }
        
        outboundFaxes.value.unshift(newFax)
        
        // Reset form
        faxData.value = {
          from: '',
          to: '',
          subject: '',
          file: null
        }
        fileList.value = []
        
        ElMessage.success('Fax sent successfully!')
        
      } catch (error) {
        ElMessage.error('Failed to send fax: ' + error.message)
      } finally {
        sending.value = false
      }
    }
    
    const loadFaxHistory = async () => {
      try {
        loadingOutbound.value = true
        loadingInbound.value = true
        
        // Simulate API calls to load fax history
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Mock data - replace with actual API calls
        outboundFaxes.value = [
          {
            id: 1,
            date: new Date(Date.now() - 24 * 60 * 60 * 1000),
            to: '+12345678901',
            from: '+19876543210',
            subject: 'Legal Document Submission',
            status: 'Sent'
          },
          {
            id: 2,
            date: new Date(Date.now() - 48 * 60 * 60 * 1000),
            to: '+11234567890',
            from: '+19876543210',
            subject: 'Contract Amendment',
            status: 'Failed'
          }
        ]
        
        inboundFaxes.value = [
          {
            id: 1,
            date: new Date(Date.now() - 12 * 60 * 60 * 1000),
            from: '+15551234567',
            to: '+19876543210',
            subject: 'Client Response',
            pages: 3
          }
        ]
        
      } catch (error) {
        ElMessage.error('Failed to load fax history: ' + error.message)
      } finally {
        loadingOutbound.value = false
        loadingInbound.value = false
      }
    }
    
    const viewFax = (fax) => {
      ElMessageBox.alert(`Viewing fax: ${fax.subject}`, 'Fax Details', {
        confirmButtonText: 'Close'
      })
    }
    
    const formatDate = (date) => {
      return new Date(date).toLocaleDateString()
    }
    
    const getStatusType = (status) => {
      switch (status.toLowerCase()) {
        case 'sent': return 'success'
        case 'failed': return 'danger'
        case 'pending': return 'warning'
        default: return 'info'
      }
    }
    
    const setupAutoReload = () => {
      // Auto reload every 15 minutes (900,000 milliseconds)
      autoReloadInterval.value = setInterval(() => {
        loadFaxHistory()
      }, 15 * 60 * 1000)
    }
    
    // Lifecycle hooks
    onMounted(() => {
      loadFaxHistory()
      setupAutoReload()
    })
    
    onUnmounted(() => {
      if (autoReloadInterval.value) {
        clearInterval(autoReloadInterval.value)
      }
    })
    
    return {
      // Data
      faxData,
      fileList,
      sending,
      loadingOutbound,
      loadingInbound,
      outboundFaxes,
      inboundFaxes,
      faxRules,
      
      // Computed
      availableFaxNumbers,
      isFormValid,
      
      // Methods
      formatToNumber,
      formatPhoneDisplay,
      handleFileChange,
      handleFileRemove,
      sendFax,
      viewFax,
      formatDate,
      getStatusType
    }
  }
}
</script>

<style scoped>


.fax-header {
  text-align: center;
  margin-bottom: 2rem;
  padding: 2rem 0;
}

.header-icon {
  margin-bottom: 1rem;
}

.header-title {
  font-size: 2.5rem;
  font-weight: 700;
  color: white;
  margin: 0 0 0.5rem 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.header-subtitle {
  font-size: 1.1rem;
  color: rgba(255, 255, 255, 0.9);
  margin: 0;
}

.fax-form-container {
  max-width: 800px;
  margin: 0 auto 3rem auto;
}

.fax-form-card {
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  border: none;
}

.fax-form-card :deep(.el-card__header) {
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
  border: none;
  padding: 1.5rem 2rem;
}

.form-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.form-title {
  color: white;
  font-size: 1.25rem;
  font-weight: 600;
}

.fax-form {
  padding: 2rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  margin-bottom: 1.5rem;
}

.form-field {
  min-width: 0;
}

.fax-option {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.fax-label {
  font-weight: 600;
  color: #374151;
}

.fax-number {
  font-size: 0.875rem;
  color: #6b7280;
}

.no-fax-numbers {
  margin-top: 0.5rem;
}

.from-select,
.to-input,
.subject-input {
  width: 100%;
}

.from-select :deep(.el-input__wrapper),
.to-input :deep(.el-input__wrapper),
.subject-input :deep(.el-input__wrapper) {
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.from-select :deep(.el-input__wrapper):focus,
.to-input :deep(.el-input__wrapper):focus,
.subject-input :deep(.el-input__wrapper):focus {
  box-shadow: 0 8px 15px -3px rgba(79, 70, 229, 0.2);
}

.fax-upload {
  width: 100%;
}

.fax-upload :deep(.el-upload) {
  width: 100%;
}

.fax-upload :deep(.el-upload-dragger) {
  width: 100%;
  height: 200px;
  border-radius: 16px;
  border: 2px dashed #c2c2c2;
  background: #fafafa;
  transition: all 0.3s ease;
}

.fax-upload :deep(.el-upload-dragger):hover {
  border-color: #4f46e5;
  background: #f8faff;
}

.upload-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 1rem;
}

.upload-icon {
  margin-bottom: 0.5rem;
}

.upload-text {
  text-align: center;
}

.upload-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #374151;
  margin: 0 0 0.25rem 0;
}

.upload-subtitle {
  font-size: 1rem;
  color: #6b7280;
  margin: 0 0 0.5rem 0;
}

.upload-formats {
  font-size: 0.875rem;
  color: #9ca3af;
  margin: 0;
}

.form-actions {
  text-align: center;
  padding-top: 1rem;
}

.send-button {
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
  border: none;
  border-radius: 12px;
  padding: 12px 32px;
  font-size: 1.1rem;
  font-weight: 600;
  box-shadow: 0 8px 15px -3px rgba(79, 70, 229, 0.3);
  transition: all 0.3s ease;
}

.send-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 20px -3px rgba(79, 70, 229, 0.4);
}

.fax-history-container {
  max-width: 1200px;
  margin: 0 auto;
}

.fax-tabs {
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  border: none;
}

.fax-tabs :deep(.el-tabs__header) {
  margin: 0;
  background: white;
}

.fax-tabs :deep(.el-tabs__nav) {
  border: none;
}

.tab-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.tab-badge {
  margin-left: 0.5rem;
}

.fax-table-container {
  padding: 1.5rem;
}

.fax-table {
  border-radius: 8px;
  overflow: hidden;
}

.fax-table :deep(.el-table__header) {
  background: #f8fafc;
}

.fax-table :deep(.el-table__header th) {
  background: #f8fafc;
  color: #374151;
  font-weight: 600;
  border: none;
}

.fax-table :deep(.el-table__body tr) {
  transition: background-color 0.3s ease;
}

.fax-table :deep(.el-table__body tr:hover) {
  background: #f8faff;
}

.date-cell,
.phone-cell {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-tag {
  font-weight: 600;
}

@media (max-width: 768px) {
  .ai-fax-container {
    padding: 1rem;
  }
  
  .header-title {
    font-size: 2rem;
  }
  
  .form-row {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  
  .fax-form {
    padding: 1.5rem;
  }
}
</style>