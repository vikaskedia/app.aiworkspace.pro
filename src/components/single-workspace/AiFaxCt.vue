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
              accept="application/pdf"
              :limit="1"
              :file-list="fileList"
              multiple="false"
            >
              <div class="upload-content">
                <el-icon class="upload-icon" size="48" color="#4f46e5">
                  <UploadFilled />
                </el-icon>
                <div class="upload-text">
                  <p class="upload-title">Drop file to upload</p>
                  <p class="upload-subtitle">or <em>click to browse</em></p>
                  <p class="upload-formats">PDF (Max 10MB)</p>
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
          <!-- debug panel removed -->
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
            <!-- timezone shown in Date column header -->
            <el-table
              :data="outboundFaxes"
              stripe
              class="fax-table"
              v-loading="loadingOutbound"
              empty-text="No outbound faxes found"
            >
              <el-table-column prop="date" width="120">
                <template #header>
                  Date <span class="tz-abbrev">({{ getTZAbbrev() }})</span>
                </template>
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
              <el-table-column prop="fileName" label="File" min-width="200">
                <template #default="{ row }">
                  <div class="file-cell">
                    <span>{{ row.fileName || '-' }}</span>
                  </div>
                </template>
              </el-table-column>
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
            <!-- timezone shown in Date column header -->
            <el-table
              :data="inboundFaxes"
              stripe
              class="fax-table"
              v-loading="loadingInbound"
              empty-text="No inbound faxes found"
            >
              <el-table-column prop="date" width="120">
                <template #header>
                  Date <span class="tz-abbrev">({{ getTZAbbrev() }})</span>
                </template>
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
import { supabase } from '../../supabase'
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
  // Timezone display control: default to PST/PDT (America/Los_Angeles).
  // Keep provision to switch to user's local timezone by setting to 'local'.
  const displayTimeZone = ref('America/Los_Angeles') // or 'local'
    
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
    
    // Subject is optional — require from, to (formatted) and at least one file
    const isFormValid = computed(() => {
      return faxData.value.from &&
             faxData.value.to &&
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
      // Only allow PDF files
      if (file.raw && file.raw.type !== 'application/pdf') {
        ElMessage.error('Only PDF files are allowed.')
        faxData.value.file = null
        fileList.value = []
        return
      }
      // Always keep only the latest file
      faxData.value.file = file.raw
      fileList.value = [file]
    }
    
    const handleFileRemove = () => {
      faxData.value.file = null
      fileList.value = []
    }
    
    const sendFax = async () => {
      try {
        sending.value = true

        // ensure file exists
        const file = faxData.value.file
        if (!file) {
          ElMessage.error('No file selected')
          sending.value = false
          return
        }

        // convert file to base64 (strip data: prefix)
        const fileToBase64 = (f) => new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            const result = reader.result
            if (typeof result === 'string') {
              // data:<mime>;base64,AAAA
              const idx = result.indexOf('base64,')
              if (idx !== -1) resolve(result.substring(idx + 7))
              else resolve(result)
            } else {
              reject(new Error('Failed to read file as base64'))
            }
          }
          reader.onerror = (e) => reject(e)
          reader.readAsDataURL(f)
        })

        const base64 = await fileToBase64(file)

        // Upload directly to Gitea from the client (note: requires Gitea CORS to allow this)
        const repo = currentWorkspace.value?.git_repo || ''
        if (!repo) {
          ElMessage.error('Workspace git_repo is missing')
          sending.value = false
          return
        }

        const GITEA_HOST = import.meta.env.VITE_GITEA_HOST
        const GITEA_TOKEN = import.meta.env.VITE_GITEA_TOKEN
        const GITEA_USERNAME = 'associateattorney'

        if (!GITEA_HOST || !GITEA_TOKEN) {
          ElMessage.error('Missing Gitea configuration (VITE_GITEA_HOST / VITE_GITEA_TOKEN)')
          sending.value = false
          return
        }


        // Prepare Gitea upload variables
        const giteaUploadPath = `faxes/${Date.now()}_${file.name}`
        const giteaUploadUrl = `${GITEA_HOST}/api/v1/repos/${GITEA_USERNAME}/${repo}/contents/${giteaUploadPath}`
        const giteaUploadPayload = {
          message: `Upload fax attachment: ${file.name}`,
          content: base64,
          branch: 'main'
        }
        const giteaUploadResp = await fetch(
          giteaUploadUrl,
          {
            method: 'POST',
            headers: {
              'Authorization': `token ${GITEA_TOKEN}`,
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache'
            },
            body: JSON.stringify(giteaUploadPayload)
          }
        )

        let giteaUploadResponse
        try {
          giteaUploadResponse = await giteaUploadResp.json()
        } catch (e) {
          giteaUploadResponse = { error: 'invalid json response from Gitea' }
        }



        // show raw Gitea response to user for inspection
        try {
          ElMessageBox.alert(JSON.stringify(giteaUploadResponse, null, 2), 'Gitea response', {
            confirmButtonText: 'Close',
            dangerouslyUseHTMLString: false
          })
        } catch (e) {
          ElMessage.info('Upload done (see console)')
          // eslint-disable-next-line no-console
          console.log('Gitea response:', giteaUploadResponse)
        }

        // Extract and log the downloadable file link (like AiPhoneCt)
        let giteaDownloadUrl = giteaUploadResponse?.content?.download_url
        if (giteaDownloadUrl) {
          // Append token if not present
          if (!giteaDownloadUrl.includes('token=') && GITEA_TOKEN) {
            giteaDownloadUrl += (giteaDownloadUrl.includes('?') ? '&' : '?') + 'token=' + GITEA_TOKEN
          }
          // eslint-disable-next-line no-console
          console.log('%cDownloadable Gitea file link:', 'color: #1976d2; font-weight: bold;') ///////// SR. << Downloadable Gitea file link:
          // eslint-disable-next-line no-console
          console.log(giteaDownloadUrl)
        }
        // proceed with outbound flow
        const cleanToNumber = '+' + getCleanPhoneNumber(faxData.value.to)

        // Insert a record into Supabase `faxes` table so history persists
        let insertedFaxRow = null
        try {
          const dbPayload = {
            workspace_id: currentWorkspace.value?.id || null,
            direction: 'outbound',
            from_number: faxData.value.from || null,
            to_number: cleanToNumber || null,
            subject: faxData.value.subject || null,
            status: giteaUploadResp && giteaUploadResp.ok ? 'Sent' : 'Failed',
            file_url: giteaDownloadUrl || giteaUploadResponse?.content?.download_url || null,
            file_name: file.name,
            gitea_download_url: giteaDownloadUrl || giteaUploadResponse?.content?.download_url || null,
            gitea_response: giteaUploadResponse || null,
            pages: null,
            telnyx_id: null,
            // date and event_time are set server-side (timestamptz defaults to now())
            // store the selected display timezone (default is America/Los_Angeles)
            client_timezone: displayTimeZone.value || ((Intl && Intl.DateTimeFormat) ? Intl.DateTimeFormat().resolvedOptions().timeZone : null),
            status_reason: null,
            metadata: null
          }

          const { data: inserted, error: insertError } = await supabase
            .from('faxes')
            .insert(dbPayload)
            .select()

          if (insertError) {
            // do not stop the UI update if DB insert fails
            // eslint-disable-next-line no-console
            console.error('Failed to insert fax record:', insertError)
            ElMessage.error('Failed to save fax history: ' + (insertError.message || String(insertError)))
          } else {
            insertedFaxRow = Array.isArray(inserted) && inserted.length ? inserted[0] : inserted
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('Error inserting fax record:', e)
          ElMessage.error('Failed to save fax history: ' + (e.message || String(e)))
        }

        const newFax = {
          id: insertedFaxRow?.id || Date.now(),
          date: insertedFaxRow?.date || new Date(),
          to: cleanToNumber,
          from: faxData.value.from,
          subject: faxData.value.subject,
          status: giteaUploadResp && giteaUploadResp.ok ? 'Sent' : 'Failed',
          fileName: file.name,
          gitea: giteaUploadResponse
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

        if (giteaUploadResp && giteaUploadResp.ok) ElMessage.success('File uploaded to Gitea')
        else ElMessage.error('Gitea upload failed')

      } catch (error) {
        ElMessage.error('Failed to send fax: ' + (error.message || error))
      } finally {
        sending.value = false
      }
    }
    
    const loadFaxHistory = async () => {
      try {
        loadingOutbound.value = true
        loadingInbound.value = true

        // If workspace is not available, clear lists
        if (!currentWorkspace.value || !currentWorkspace.value.id) {
          outboundFaxes.value = []
          inboundFaxes.value = []
          return
        }

        // Query faxes from Supabase for the current workspace
        const { data, error } = await supabase
          .from('faxes')
          .select('*')
          .eq('workspace_id', currentWorkspace.value.id)
          .order('date', { ascending: false })

        if (error) throw error

        // Map DB rows to the UI shape expected by the tables
        const rows = data || []

        // Helper: normalize timestamp strings returned by Supabase/Postgres into a strict
        // ISO-like string so `new Date(...)` reliably parses it as the correct UTC instant.
        const parseTimestampToDate = (ts) => {
          if (!ts) return null
          if (ts instanceof Date) return ts
          if (typeof ts === 'number') return new Date(ts)
          let s = String(ts).trim()

          // Make 'YYYY-MM-DD HH:MM:SS...' into 'YYYY-MM-DDTHH:MM:SS...' (ISO-like)
          s = s.replace(/^([0-9]{4}-[0-9]{2}-[0-9]{2})\s+/, '$1T')

          // Normalize timezone offsets.
          // Matches trailing offsets like +00, +0000, +00:00, -0530, etc.
          const tzMatch = s.match(/([+-])(\d{1,4})$/)
          if (tzMatch) {
            const sign = tzMatch[1]
            let digits = tzMatch[2]
            // Ensure digits are at least 2 (hours). Pad if necessary.
            if (digits.length === 1) digits = '0' + digits
            // If digits length is 3 or 4 (e.g. 530 or 0530), split last two as minutes
            let hh = digits.slice(0, 2)
            let mm = digits.length > 2 ? digits.slice(2) : '00'
            if (mm.length === 1) mm = '0' + mm
            const tzNorm = `${sign}${hh}:${mm}`
            s = s.replace(/([+-]\d{1,4})$/, tzNorm)
          }

          // If after normalization there's still no timezone designator (Z or ±hh:mm) append Z
          if (!(/[zZ]$/.test(s) || /[+-]\d{2}:\d{2}$/.test(s))) {
            s = s + 'Z'
          }

          return new Date(s)
        }

        outboundFaxes.value = rows
          .filter(r => r.direction === 'outbound')
          .map(r => ({
            id: r.id,
            date: r.date ? parseTimestampToDate(r.date) : null,
            to: r.to_number,
            from: r.from_number,
            subject: r.subject,
            status: r.status,
            fileName: r.file_name || r.file_url || null,
            gitea: { download_url: r.gitea_download_url || r.file_url || null }
          }))

        inboundFaxes.value = rows
          .filter(r => r.direction === 'inbound')
          .map(r => ({
            id: r.id,
            date: r.date ? parseTimestampToDate(r.date) : null,
            from: r.from_number,
            to: r.to_number,
            subject: r.subject,
            pages: r.pages,
            fileName: r.file_name || r.file_url || null,
            file_url: r.file_url,
            gitea: { download_url: r.gitea_download_url || r.file_url || null }
          }))

        // --- Retain old mock data commented out for reference ---
        /*
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
        */

      } catch (error) {
        ElMessage.error('Failed to load fax history: ' + (error.message || error))
      } finally {
        loadingOutbound.value = false
        loadingInbound.value = false
      }
    }

    
    const viewFax = (fax) => {
      // Prefer explicit downloadable URL from gitea or file_url
      const downloadUrl = (fax && (fax.gitea?.download_url || fax.file_url || fax.gitea?.downloadUrl)) || null

      if (downloadUrl) {
        // open in a new tab/window
        try {
          window.open(downloadUrl, '_blank', 'noopener')
          return
        } catch (e) {
          // Fall through to MessageBox fallback if window.open fails
          // eslint-disable-next-line no-console
          console.error('Failed to open fax URL in new tab', e)
        }
      }

      // If no URL available, show details with an instruction
      const fileName = fax?.fileName || fax?.file_name || 'Attachment'
      ElMessageBox.alert(`No downloadable file URL available for ${fileName}.`, 'View Fax', {
        confirmButtonText: 'Close'
      })
    }
    
    // Detect whether the runtime supports the Intl dateStyle/timeStyle options
    const _supportsDateTimeStyle = (() => {
      try {
        // try to construct a formatter using dateStyle. If it throws, not supported
        // eslint-disable-next-line no-new
        new Intl.DateTimeFormat('en-US', { dateStyle: 'short' })
        return true
      } catch (e) {
        return false
      }
    })()

    // Detect whether the runtime supports timeZoneName option
    const _supportsTimeZoneName = (() => {
      try {
        // eslint-disable-next-line no-new
        new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' })
        return true
      } catch (e) {
        return false
      }
    })()

    const formatDate = (date) => {
      if (!date) return ''
      const d = (date instanceof Date) ? date : new Date(date)

      const formatWithOptions = (opts) => {
        try {
          return new Intl.DateTimeFormat('en-US', opts).format(d)
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('formatDate error:', e)
          // Fallback: try a tolerant toLocaleString path that at least respects timeZone when provided.
          try {
            const fallbackOpts = {}
            if (opts && opts.timeZone) fallbackOpts.timeZone = opts.timeZone
            return d.toLocaleString('en-US', Object.keys(fallbackOpts).length ? fallbackOpts : undefined)
          } catch (e2) {
            // eslint-disable-next-line no-console
            console.error('formatDate fallback error:', e2)
            return d.toLocaleString()
          }
        }
      }

      // Determine timezone to use. If displayTimeZone is explicitly set to a named IANA zone
      // (e.g. 'America/Los_Angeles') use that. If it's 'local' or falsy, omit timeZone to let
      // the runtime use the user's local timezone.
      const tz = (displayTimeZone.value && displayTimeZone.value !== 'local') ? displayTimeZone.value : undefined

      // Debug: log the input instant and timezone decision (helps verify why UI shows IST/other)
      // eslint-disable-next-line no-console
      console.debug('formatDate:', d.toISOString(), 'using tz:', tz || 'local')

      // Build a sanitized options object to avoid passing runtime-unsupported keys
      let sanitizedOpts = {}
      if (_supportsDateTimeStyle) {
        sanitizedOpts.dateStyle = 'short'
        sanitizedOpts.timeStyle = 'short'
      } else {
        sanitizedOpts.year = 'numeric'
        sanitizedOpts.month = '2-digit'
        sanitizedOpts.day = '2-digit'
        sanitizedOpts.hour = '2-digit'
        sanitizedOpts.minute = '2-digit'
      }
      if (_supportsTimeZoneName) sanitizedOpts.timeZoneName = 'short'
      if (tz) sanitizedOpts.timeZone = tz

      // Try formatting; if Intl rejects any option, formatWithOptions will catch and
      // fall back to a tolerant toLocaleString path. Also log the sanitized opts for debugging.
      // eslint-disable-next-line no-console
      console.debug('formatDate opts:', sanitizedOpts)
      return formatWithOptions(sanitizedOpts)
    }
    
    // Return a short timezone abbreviation for the current displayTimeZone (PST/PDT) when possible.
    const getTZAbbrev = () => {
      const tz = displayTimeZone.value && displayTimeZone.value !== 'local' ? displayTimeZone.value : undefined
      try {
        if (tz && _supportsTimeZoneName) {
          const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(new Date())
          const tzPart = parts.find(p => p.type === 'timeZoneName')
          if (tzPart && tzPart.value) return tzPart.value
        }
      } catch (e) {
        // ignore
      }

      // Fallback mapping for America/Los_Angeles
      if (displayTimeZone.value === 'America/Los_Angeles') {
        const now = new Date()
        // Use January and July offsets to detect DST in the environment
        const janOffset = new Date(now.getFullYear(), 0, 1).getTimezoneOffset()
        const julOffset = new Date(now.getFullYear(), 6, 1).getTimezoneOffset()
        const isDST = Math.min(janOffset, julOffset) === now.getTimezoneOffset()
        return isDST ? 'PDT' : 'PST'
      }

      return displayTimeZone.value === 'local' ? Intl.DateTimeFormat().resolvedOptions().timeZone : (displayTimeZone.value || '')
    }

    const getTZLabel = () => {
      if (displayTimeZone.value === 'America/Los_Angeles') {
        const abbrev = getTZAbbrev()
        return `Times shown in Pacific Time (PT) — ${abbrev}`
      }
      if (displayTimeZone.value === 'local' || !displayTimeZone.value) {
        return `Times shown in your local timezone (${Intl.DateTimeFormat().resolvedOptions().timeZone})`
      }
      return `Times shown in ${displayTimeZone.value}`
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

  // no runtime debug
    
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
  getTZLabel,
  getTZAbbrev,
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

.tz-abbrev {
  color: #475569;
  font-weight: 600;
  margin-left: 6px;
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