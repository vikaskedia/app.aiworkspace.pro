<template>
  <div class="case-detail-container">
    <HeaderCt />
    <div class="content" v-if="caseData">
      <div class="case-header">
        <div class="title-section">
          <h1>{{ caseData.title }}</h1>
          <el-tag size="large" :type="getStatusType(caseData.status)">
            {{ caseData.status }}
          </el-tag>
        </div>
        <el-button-group>
          <el-button type="primary" @click="editCase" size="small">
            <el-icon><Edit /></el-icon>
            Edit Case
          </el-button>
          <!-- <el-button type="danger" @click="confirmDelete" size="small">
            <el-icon><Delete /></el-icon>
            Delete Case
          </el-button> -->
        </el-button-group>
      </div>

      <div class="case-info">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="Case Number">
            {{ caseData.case_number }}
          </el-descriptions-item>
          <el-descriptions-item label="Court">
            {{ caseData.court }}
          </el-descriptions-item>
          <el-descriptions-item label="Filed Date">
            {{ formatDate(caseData.filed_date) }}
          </el-descriptions-item>
          <el-descriptions-item label="Created">
            {{ formatDate(caseData.created_at) }}
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <div class="case-description">
        <div class="description-header">
          <h2>Description</h2>
          <el-button 
            v-if="!editingDescription" 
            type="primary"
            size="small"
            @click="startEditingDescription"
          >
            <el-icon><Edit /></el-icon>
            Edit Description
          </el-button>
        </div>
        
        <div class="description-content" v-if="!editingDescription" v-html="caseData.description">
        </div>
        
        <div v-else class="description-editor">
          <TiptapEditor
            v-model="editedDescription"
            placeholder="Enter case description..."
            :autofocus="true"
            :isTaskComment="false"
          />
          <div class="editor-actions">
            <el-button @click="cancelEditDescription">Cancel</el-button>
            <el-button 
              type="primary" 
              @click="saveDescription"
              :loading="savingDescription"
            >
              Save Changes
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <el-dialog
      v-model="showEditDialog"
      title="Edit Case"
      width="500px"
    >
      <el-form :model="editForm" label-position="top">
        <el-form-item label="Title">
          <el-input v-model="editForm.title" />
        </el-form-item>
        <el-form-item label="Case Number">
          <el-input v-model="editForm.case_number" />
        </el-form-item>
        <el-form-item label="Court">
          <el-input v-model="editForm.court" />
        </el-form-item>
        <el-form-item label="Filed Date">
          <el-date-picker v-model="editForm.filed_date" type="date" />
        </el-form-item>
        <el-form-item label="Status">
          <el-select v-model="editForm.status">
            <el-option label="Active" value="active" />
            <el-option label="Pending" value="pending" />
            <el-option label="Closed" value="closed" />
          </el-select>
        </el-form-item>
        <el-form-item label="Description">
          <el-input v-model="editForm.description" type="textarea" rows="4" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditDialog = false">Cancel</el-button>
        <el-button type="primary" @click="saveEdit">Save Changes</el-button>
      </template>
    </el-dialog>

    <!-- Chat Toggle Button -->
    <div class="chat-toggle" @click="toggleChat" :class="{ active: isChatOpen }">
      <el-badge :value="unreadCount" :hidden="unreadCount === 0">
        <el-icon v-if="!isChatOpen"><ChatRound /></el-icon>
        <el-icon v-else><Close /></el-icon>
      </el-badge>
    </div>

    <!-- Floating Chat Box -->
    <div class="chat-popup" :class="{ open: isChatOpen }">
      <div class="chat-header">
        <h3>Case Assistant</h3>
        <el-button type="text" @click="toggleChat">
          <el-icon><Close /></el-icon>
        </el-button>
      </div>

      <div class="chat-messages" ref="chatContainer">
        <div v-for="(message, index) in messages" 
             :key="index" 
             :class="['message', message.type]">
          <div class="message-content">
            <p v-html="message.content"></p>
            <span class="message-time">{{ formatTime(message.timestamp) }}</span>
          </div>
        </div>
      </div>

      <div class="chat-input">
        <el-input
          v-model="newMessage"
          type="textarea"
          :rows="3"
          placeholder="Ask a question about this case..."
          @keyup.enter.ctrl="sendMessage"
        />
        <el-button 
          type="primary" 
          @click="sendMessage" 
          :loading="loading"
          :disabled="!newMessage.trim()"
        >
          Send
        </el-button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Edit, Delete, ChatRound, Close } from '@element-plus/icons-vue';
import HeaderCt from '../HeaderCt.vue';
import TiptapEditor from '../common/TiptapEditor.vue';
import { supabase } from '../../supabase';

export default {
  name: 'CaseDetailCt',
  components: {
    HeaderCt,
    Edit,
    Delete,
    ChatRound,
    Close,
    TiptapEditor
  },
  setup() {
    const route = useRoute();
    const router = useRouter();
    const pythonApiBaseUrl = import.meta.env.VITE_PYTHON_API_URL || 'http://localhost:3001';
    const caseData = ref(null);
    const showEditDialog = ref(false);
    const editForm = ref({});
    const isChatOpen = ref(false);
    const unreadCount = ref(0);
    const messages = ref([]);
    const newMessage = ref('');
    const loading = ref(false);
    const chatContainer = ref(null);
    const editingDescription = ref(false);
    const editedDescription = ref('');
    const savingDescription = ref(false);

    const loadCase = async () => {
      try {
        const { data, error } = await supabase
          .from('cases')
          .select('*')
          .eq('title', route.params.title)
          .single();

        if (error) throw error;
        if (!data) {
          router.push('/cases');
          ElMessage.error('Case not found');
          return;
        }

        caseData.value = data;
      } catch (error) {
        ElMessage.error('Error loading case: ' + error.message);
      }
    };

    const editCase = () => {
      editForm.value = { ...caseData.value };
      showEditDialog.value = true;
    };

    const saveEdit = async () => {
      try {
        const { error } = await supabase
          .from('cases')
          .update(editForm.value)
          .eq('id', caseData.value.id);

        if (error) throw error;

        showEditDialog.value = false;
        await loadCase();
        ElMessage.success('Case updated successfully');
      } catch (error) {
        ElMessage.error('Error updating case: ' + error.message);
      }
    };

    const confirmDelete = () => {
      ElMessageBox.confirm(
        'Are you sure you want to delete this case?',
        'Warning',
        {
          confirmButtonText: 'Delete',
          cancelButtonText: 'Cancel',
          type: 'warning',
        }
      ).then(() => {
        deleteCase();
      }).catch(() => {});
    };

    const deleteCase = async () => {
      try {
        const { error } = await supabase
          .from('cases')
          .delete()
          .eq('id', caseData.value.id);

        if (error) throw error;

        router.push('/cases');
        ElMessage.success('Case deleted successfully');
      } catch (error) {
        ElMessage.error('Error deleting case: ' + error.message);
      }
    };

    const formatDate = (date) => {
      return new Date(date).toLocaleDateString();
    };

    const getStatusType = (status) => {
      switch (status) {
        case 'active': return 'success';
        case 'pending': return 'warning';
        case 'closed': return 'info';
        default: return '';
      }
    };

    const toggleChat = () => {
      isChatOpen.value = !isChatOpen.value;
      if (isChatOpen.value) {
        unreadCount.value = 0;
      }
    };

    const sendMessage = async () => {
      if (!newMessage.value.trim()) return;
      const { data: { user } } = await supabase.auth.getUser();

      const userMessage = {
        type: 'user',
        content: newMessage.value,
        timestamp: new Date()
      };

      messages.value.push(userMessage);
      const messageToSend = newMessage.value;
      newMessage.value = '';

      // Scroll to bottom
      await nextTick();
      if (chatContainer.value) {
        chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
      }

      loading.value = true;
      try {
        // Prepare context for AI
        const context = `Case Title: ${caseData.value.title}\nCase Number: ${caseData.value.case_number}\nCourt: ${caseData.value.court}\nStatus: ${caseData.value.status}\nDescription: ${caseData.value.description}`;

        const response = await fetch(`${pythonApiBaseUrl}/gpt/start_case_consultation`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: messageToSend ,
            systemPrompt: context,userData: {
                name: user.user_metadata?.name || 
                      user.user_metadata?.user_name || 
                      user.user_metadata?.full_name ||
                      user.email?.split('@')[0],
                email: user.email,
                phone: user.user_metadata?.phone,
                preferredLanguage: user.user_metadata?.preferred_language,
              },
            case_id: caseData.value.id,

          })
        });

        const data = await response.json();
        
        messages.value.push({
          type: 'assistant',
          content: data.response,
          timestamp: new Date()
        });

        if (!isChatOpen.value) {
          unreadCount.value++;
        }

        // Scroll to bottom again after response
        await nextTick();
        if (chatContainer.value) {
          chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
        }
      } catch (error) {
        ElMessage.error('Error getting response: ' + error.message);
      } finally {
        loading.value = false;
      }
    };

    const startEditingDescription = () => {
      editingDescription.value = true;
      editedDescription.value = caseData.value.description || '';
    };

    const cancelEditDescription = () => {
      editingDescription.value = false;
      editedDescription.value = '';
    };

    const saveDescription = async () => {
      try {
        savingDescription.value = true;
        const { error } = await supabase
          .from('cases')
          .update({ description: editedDescription.value })
          .eq('id', caseData.value.id);

        if (error) throw error;

        caseData.value.description = editedDescription.value;
        editingDescription.value = false;
        editedDescription.value = '';
        ElMessage.success('Description updated successfully');
      } catch (error) {
        ElMessage.error('Error updating description: ' + error.message);
      } finally {
        savingDescription.value = false;
      }
    };

    const formatTime = (timestamp) => {
      const date = new Date(timestamp);
      return date.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    };

    onMounted(loadCase);

    return {
      caseData,
      showEditDialog,
      editForm,
      editCase,
      saveEdit,
      confirmDelete,
      formatDate,
      getStatusType,
      isChatOpen,
      unreadCount,
      messages,
      newMessage,
      loading,
      chatContainer,
      toggleChat,
      sendMessage,
      editingDescription,
      editedDescription,
      savingDescription,
      startEditingDescription,
      cancelEditDescription,
      saveDescription,
      pythonApiBaseUrl,
      formatTime,
    };
  }
};
</script>

<style scoped>
.case-detail-container {
  min-height: 100vh;
  background-color: var(--el-bg-color);
}

.content {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.case-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.title-section {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.title-section h1 {
  margin: 0;
  color: var(--el-text-color-primary);
}

.case-info {
  margin-bottom: 2rem;
}

.case-description {
  background-color: var(--el-bg-color-page);
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0,0,0,0.1);
}

.case-description h2 {
  margin: 0 0 1rem 0;
  color: var(--el-text-color-primary);
}

.description-content {
  color: var(--el-text-color-regular);
  line-height: 1.6;
  white-space: pre-wrap;
}

.chat-toggle {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 50%;
  background-color: var(--el-color-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 12px 0 rgba(0,0,0,0.1);
  transition: transform 0.3s ease;
  z-index: 2000;
}

.chat-toggle:hover {
  transform: scale(1.1);
}

.chat-toggle.active {
  background-color: var(--el-color-danger);
}

.chat-popup {
  position: fixed;
  bottom: 6rem;
  right: 2rem;
  width: 380px;
  height: 500px;
  background-color: var(--el-bg-color);
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0,0,0,0.1);
  display: flex;
  flex-direction: column;
  transform: translateY(100%);
  opacity: 0;
  visibility: hidden;
  transition: all 0.3s ease;
  z-index: 1999;
}

.chat-popup.open {
  transform: translateY(0);
  opacity: 1;
  visibility: visible;
}

.chat-header {
  padding: 1rem;
  border-bottom: 1px solid var(--el-border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chat-header h3 {
  margin: 0;
  color: var(--el-text-color-primary);
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  background-color: var(--el-bg-color-page);
}

.message {
  margin-bottom: 1rem;
  max-width: 80%;
}

.message.user {
  margin-left: auto;
}

.message.assistant {
  margin-right: auto;
}

.message-content {
  padding: 0.8rem 1rem;
  border-radius: 8px;
  position: relative;
}

.message.user .message-content {
  background-color: var(--el-color-primary-light-9);
  color: var(--el-text-color-primary);
}

.message.assistant .message-content {
  background-color: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
}

.message-content p {
  margin: 0;
  white-space: pre-wrap;
}

.message-time {
  font-size: 0.75rem;
  color: var(--el-text-color-secondary);
  position: absolute;
  bottom: -1.2rem;
  right: 0;
}

.chat-input {
  padding: 1rem;
  border-top: 1px solid var(--el-border-color);
  background-color: var(--el-bg-color);
}

.chat-input .el-textarea {
  margin-bottom: 0.5rem;
}

@media (max-width: 480px) {
  .chat-popup {
    width: 100%;
    height: 100%;
    bottom: 0;
    right: 0;
  }
  
  .chat-toggle {
    bottom: 1rem;
    right: 1rem;
  }
}

.description-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.description-header h2 {
  margin: 0;
}

.description-content {
  white-space: pre-wrap;
  line-height: 1.6;
  color: var(--el-text-color-regular);
  padding: 1rem;
  background-color: var(--el-fill-color-blank);
  border-radius: 4px;
  min-height: 100px;
}

.description-editor {
  margin-top: 1rem;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  overflow: hidden;
}

.editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  padding: 1rem;
  background-color: var(--el-bg-color);
  border-top: 1px solid var(--el-border-color);
}

.edit-button {
  opacity: 0.8;
  transition: opacity 0.2s;
}

.edit-button:hover {
  opacity: 1;
}
</style> 