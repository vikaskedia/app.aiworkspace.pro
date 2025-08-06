<template>
    <div class="communications-container">
      <div class="header">
        <h2>Communications</h2>
        <el-button type="primary" @click="refreshEmails">
          <el-icon><Refresh /></el-icon>
          Refresh
        </el-button>
      </div>
  
      <!-- Filter Section -->
      <div class="filter-section">
        <el-form :inline="true" :model="filters" class="filter-form">
          <el-form-item label="From">
            <el-input
              v-model="filters.from"
              placeholder="Search by sender"
              clearable
              @input="applyFilters"
            />
          </el-form-item>
          <!-- <el-form-item label="Subject">
            <el-input
              v-model="filters.subject"
              placeholder="Search by subject"
              clearable
              @input="applyFilters"
            />
          </el-form-item> -->
          <!-- <el-form-item label="Date Range">
            <el-date-picker
              v-model="filters.dateRange"
              type="daterange"
              range-separator="To"
              start-placeholder="Start date"
              end-placeholder="End date"
              :shortcuts="dateShortcuts"
              @change="applyFilters"
            />
          </el-form-item> -->
          <!-- <el-form-item>
            <el-button type="primary" @click="applyFilters">
              <el-icon><Search /></el-icon>
              Search
            </el-button>
            <el-button @click="resetFilters">
              <el-icon><Refresh /></el-icon>
              Reset
            </el-button>
          </el-form-item> -->
        </el-form>
      </div>
  
      <el-table
        v-loading="loading"
        :data="filteredEmails"
        style="width: 100%"
        :default-sort="{ prop: 'received_date', order: 'descending' }"
      >
        <el-table-column prop="from_address" label="From" min-width="200">
          <template #default="{ row }">
            <div class="email-cell">
              <span class="email-address">{{ row.from_address }}</span>
            </div>
          </template>
        </el-table-column>
  
        <el-table-column prop="subject" label="Subject" min-width="300">
          <template #default="{ row }">
            <div class="email-cell">
              <span class="subject">{{ row.subject }}</span>
            </div>
          </template>
        </el-table-column>
  
        <el-table-column prop="received_date" label="Date" width="180">
          <template #default="{ row }">
            {{ formatDate(row.received_date) }}
          </template>
        </el-table-column>
  
        <el-table-column label="Actions" width="120">
          <template #default="{ row }">
            <el-button
              type="primary"
              link
              @click="viewEmail(row)"
            >
              View
            </el-button>
          </template>
        </el-table-column>
      </el-table>
  
      <!-- Email Detail Dialog -->
      <el-dialog
        v-model="dialogVisible"
        title="Email Details"
        width="70%"
        class="email-dialog"
      >
        <div v-if="selectedEmail" class="email-details">
          <div class="email-header">
            <h3>{{ selectedEmail.subject }}</h3>
            <div class="email-meta">
              <p><strong>From:</strong> {{ selectedEmail.from_address }}</p>
              <p><strong>To:</strong> {{ selectedEmail.to_address }}</p>
              <p v-if="selectedEmail.cc"><strong>CC:</strong> {{ selectedEmail.cc }}</p>
              <p v-if="selectedEmail.bcc"><strong>BCC:</strong> {{ selectedEmail.bcc }}</p>
              <p><strong>Date:</strong> {{ formatDate(selectedEmail.received_date) }}</p>
            </div>
          </div>
          <div class="email-content" v-html="selectedEmail.html_content || selectedEmail.text_content"></div>
          
          <!-- Attachments Section -->
          <div v-if="selectedEmail.attachments && selectedEmail.attachments.length > 0" class="attachments-section">
            <h4>Attachments</h4>
            <div class="attachments-list">
              <div v-for="attachment in selectedEmail.attachments" :key="attachment.filename" class="attachment-item">
                <el-link 
                  :href="attachment.url" 
                  target="_blank" 
                  type="primary"
                  class="attachment-link"
                >
                  <el-icon><Document /></el-icon>
                  {{ attachment.filename }}
                  <span class="attachment-size">({{ formatFileSize(attachment.size) }})</span>
                </el-link>
              </div>
            </div>
          </div>
        </div>
      </el-dialog>
    </div>
  </template>
  
  <script setup>
  import { ref, onMounted, computed } from 'vue'
  import { createClient } from '@supabase/supabase-js'
  import { ElMessage } from 'element-plus'
  import { Refresh, Document, Search } from '@element-plus/icons-vue'
  import dayjs from 'dayjs'
  import { useWorkspaceStore } from '../../store/workspace';
  import { storeToRefs } from 'pinia';
  
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  const supabase = createClient(supabaseUrl, supabaseKey)

  const workspaceStore = useWorkspaceStore();
  const { currentWorkspace } = storeToRefs(workspaceStore);
  
  const emails = ref([])
  const loading = ref(false)
  const dialogVisible = ref(false)
  const selectedEmail = ref(null)
  
  const filters = ref({
    from: '',
    subject: '',
    dateRange: []
  })
  
  /* const dateShortcuts = [
    {
      text: 'Last week',
      value: () => {
        const end = new Date()
        const start = new Date()
        start.setTime(start.getTime() - 3600 * 1000 * 24 * 7)
        return [start, end]
      },
    },
    {
      text: 'Last month',
      value: () => {
        const end = new Date()
        const start = new Date()
        start.setTime(start.getTime() - 3600 * 1000 * 24 * 30)
        return [start, end]
      },
    },
    {
      text: 'Last 3 months',
      value: () => {
        const end = new Date()
        const start = new Date()
        start.setTime(start.getTime() - 3600 * 1000 * 24 * 90)
        return [start, end]
      },
    },
  ] */
  
  const filteredEmails = computed(() => {
    return emails.value.filter(email => {
      const fromMatch = !filters.value.from || 
        email.from_address.toLowerCase().includes(filters.value.from.toLowerCase())
      
      const subjectMatch = !filters.value.subject || 
        email.subject.toLowerCase().includes(filters.value.subject.toLowerCase())
      
      const dateMatch = !filters.value.dateRange || !filters.value.dateRange[0] || !filters.value.dateRange[1] ||
        (new Date(email.received_date) >= filters.value.dateRange[0] && 
         new Date(email.received_date) <= filters.value.dateRange[1])
      
      return fromMatch && subjectMatch && dateMatch
    })
  })
  
  const applyFilters = () => {
    // The filtering is handled automatically by the computed property
  }
  
  /* const resetFilters = () => {
    filters.value = {
      from: '',
      subject: '',
      dateRange: []
    }
  } */
  
  const fetchEmails = async () => {
    loading.value = true
    try {
      var namespace = currentWorkspace.value.git_repo+"@westviewlegal.com"
      const { data, error } = await supabase
        .from('emails')
        .select('*')
        .or(`cc.ilike.%${namespace}%,to_address.ilike.%${namespace}%`)
        .order('received_date', { ascending: false })
  
      if (error) throw error
      emails.value = data
    } catch (error) {
      console.error('Error fetching emails:', error)
      ElMessage.error('Failed to fetch emails')
    } finally {
      loading.value = false
    }
  }
  
  const refreshEmails = () => {
    fetchEmails()
  }
  
  const viewEmail = (email) => {
    selectedEmail.value = email
    dialogVisible.value = true
  }
  
  const formatDate = (date) => {
    return dayjs(date).format('MMM D, YYYY h:mm A')
  }
  
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
  
  onMounted(() => {
    fetchEmails()
  })
  </script>
  
  <style scoped>
  .communications-container {
    padding: 20px;
  }
  
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }
  
  .email-cell {
    display: flex;
    flex-direction: column;
  }
  
  .email-address {
    color: #606266;
  }
  
  .subject {
    font-weight: 500;
  }
  
  .email-details {
    padding: 20px;
  }
  
  .email-header {
    margin-bottom: 20px;
    padding-bottom: 20px;
    border-bottom: 1px solid #ebeef5;
  }
  
  .email-meta {
    color: #606266;
    font-size: 14px;
  }
  
  .email-meta p {
    margin: 5px 0;
  }
  
  .email-content {
    line-height: 1.6;
    white-space: pre-wrap;
  }
  
  :deep(.el-dialog__body) {
    padding: 0;
  }

  .attachments-section {
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid #ebeef5;
  }

  .attachments-section h4 {
    margin: 0 0 15px 0;
    color: #606266;
  }

  .attachments-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .attachment-item {
    display: flex;
    align-items: center;
  }

  .attachment-link {
    display: flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
  }

  .attachment-size {
    color: #909399;
    font-size: 0.9em;
  }

  :deep(.el-icon) {
    margin-right: 4px;
  }

  .filter-section {
    margin-bottom: 20px;
    padding: 15px;
    background-color: #f5f7fa;
    border-radius: 4px;
  }

  .filter-form {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: flex-start;
  }

  :deep(.el-form--inline .el-form-item) {
    margin-right: 0;
    margin-bottom: 10px;
  }

  :deep(.el-date-editor--daterange) {
    width: 300px;
  }

  @media (max-width: 768px) {
    .filter-form {
      flex-direction: column;
    }
    
    :deep(.el-form--inline .el-form-item) {
      margin-right: 0;
      width: 100%;
    }
    
    :deep(.el-date-editor--daterange) {
      width: 100%;
    }
  }
  </style> 