<template>
  <div class="layout-container">
    <HeaderCt />
    <div class="talktodev-container">
      <div class="action-buttons">
        <div class="spacer"></div>
        <el-button type="primary" @click="showNewTopicDialog = true">
          <el-icon><ChatLineSquare /></el-icon>
          Create New Topic
        </el-button>
        <el-button 
          v-if="isAdmin"
          type="success" 
          @click="showAdminDialog = true">
          <el-icon><UserFilled /></el-icon>
          Manage Admins
        </el-button>
      </div>

      <!-- Add this new dialog -->
      <el-dialog
        v-model="showAdminDialog"
        title="Manage System Admins"
        width="600px"
      >
        <div class="admin-management">
          <div class="current-admins">
            <h4>Current Admins</h4>
            <el-table :data="systemAdmins" style="width: 100%">
              <el-table-column prop="email" label="Email" />
              <el-table-column prop="granted_at" label="Granted At">
                <template #default="scope">
                  {{ new Date(scope.row.granted_at).toLocaleDateString() }}
                </template>
              </el-table-column>
              <el-table-column align="right" width="70">
                <template #default="scope">
                  <el-button
                    type="danger"
                    link
                    :disabled="scope.row.id === currentUser?.id"
                    @click="removeAdmin(scope.row)"
                  >
                    <el-icon><Delete /></el-icon>
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>

          <div class="add-admin-section">
            <h4>Add New Admin</h4>
            <el-select
              v-model="selectedUsers"
              multiple
              filterable
              remote
              :remote-method="searchUsers"
              :loading="searchLoading"
              placeholder="Search users by email"
              style="width: 100%"
            >
              <el-option
                v-for="user in searchResults"
                :key="user.id"
                :label="user.email"
                :value="user.id"
              />
            </el-select>
            <el-button 
              type="primary" 
              @click="addAdmins" 
              :disabled="!selectedUsers.length"
              :loading="loading"
              style="margin-top: 16px"
            >
              Add Selected Users as Admins
            </el-button>
          </div>
        </div>
      </el-dialog>

      <!-- New Topic Dialog -->
      <el-dialog
        v-model="showNewTopicDialog"
        title="Create New Topic"
        width="700px"
        class="new-topic-dialog"
      >
        <div class="new-topic-form">
          <el-form :model="newTopic" label-position="top">
            <el-form-item label="Title" required>
              <el-input v-model="newTopic.title" placeholder="Enter topic title" />
            </el-form-item>
            <el-form-item label="Description" required class="description-item">
              <TiptapEditor
                v-model="newTopic.description"
                placeholder="Write a description..."
                :task-title="newTopic.title || 'New Topic'"
                :shared-users="[]"
              />
            </el-form-item>
          </el-form>
        </div>
        <template #footer>
          <el-button link @click="showNewTopicDialog = false">Cancel</el-button>
          <el-button
            type="primary"
            @click="createTopic"
            :loading="loading"
            :disabled="!newTopic.title.trim() || !newTopic.description.trim()"
          >
            Create Topic
          </el-button>
        </template>
      </el-dialog>

      <!-- Edit Topic Dialog -->
      <el-dialog
        v-model="showEditTopicDialog"
        title="Edit Topic"
        width="700px"
        class="new-topic-dialog"
      >
        <div class="new-topic-form">
          <el-form :model="editingTopic" label-position="top">
            <el-form-item label="Title" required>
              <el-input v-model="editingTopic.title" placeholder="Enter topic title" />
            </el-form-item>
            <el-form-item label="Description" required class="description-item">
              <TiptapEditor
                v-model="editingTopic.description"
                placeholder="Write a description..."
                :task-title="editingTopic.title || 'Edit Topic'"
                :shared-users="[]"
              />
            </el-form-item>
          </el-form>
        </div>
        <template #footer>
          <el-button link @click="showEditTopicDialog = false">Cancel</el-button>
          <el-button
            type="primary"
            @click="saveTopicEdit"
            :loading="loading"
            :disabled="!editingTopic.title.trim() || !editingTopic.description.trim()"
          >
            Save Changes
          </el-button>
        </template>
      </el-dialog>

      <!-- Topics List -->
      <div class="topics-list">
        <el-card v-for="topic in topics" :key="topic.id" class="topic-card">
          <div class="topic-header">
            <div class="topic-title-section">
              <router-link :to="`/talk-to-dev/${topic.id}`" class="topic-title">
                <h3>{{ topic.title }}</h3>
              </router-link>
              <span class="topic-replies-count">
                {{ topicReplies[topic.id]?.length || 0 }} {{ topicReplies[topic.id]?.length === 1 ? 'reply' : 'replies' }}
              </span>
            </div>
            <div class="topic-meta">
              <span class="topic-author">By: {{ userNames[topic.created_by] }}</span>
              <span class="topic-date">{{ new Date(topic.created_at).toLocaleDateString() }}</span>
            </div>
          </div>
        </el-card>
      </div>

      <!-- Dialogs remain the same -->
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue'
import { supabase } from '../../supabase'
import { ElMessage } from 'element-plus'
import HeaderCt from '../HeaderCt.vue'
import TiptapEditor from '../common/TiptapEditor.vue'
import { Edit, ChatLineSquare, UserFilled, Delete } from '@element-plus/icons-vue'

export default {
  name: 'TalkToDevSystem',
  components: {
    HeaderCt,
    TiptapEditor,
    Edit,
    ChatLineSquare,
    UserFilled,
    Delete
  },
  setup() {
    const topics = ref([])
    const replies = ref([])
    const loading = ref(false)
    const showNewTopicDialog = ref(false)
    const showTopicDialog = ref(false)
    const selectedTopic = ref(null)
    const newTopic = ref({ title: '', description: '' })
    const newReply = ref('')
    const userEmails = ref({})
    const showAdminDialog = ref(false)
    const selectedUsers = ref([])
    const searchLoading = ref(false)
    const searchResults = ref([])
    const systemAdmins = ref([])
    const currentUser = ref(null)
    const showEditTopicDialog = ref(false)
    const editingTopic = ref({ id: null, title: '', description: '' })
    const topicReplies = ref({})
    const replyLoading = ref({})
    const newReplies = ref({})
    const userNames = ref({})

    const isAdmin = computed(() => {
      return systemAdmins.value.some(admin => admin.id === currentUser.value?.id)
    })

    const getUserDisplayName = (userData) => {
      if (!userData) return '';
      return userData.user_metadata?.name || 
             userData.user_metadata?.user_name || 
             userData.user_metadata?.full_name ||
             userData.email?.split('@')[0];
    }

    const loadUserNames = async (userIds) => {
      try {
        for (const userId of userIds) {
          if (!userNames.value[userId]) {
            const { data } = await supabase
              .rpc('get_user_info_by_id', { user_id: userId })
            if (data?.[0]) {
              userNames.value[userId] = getUserDisplayName(data[0])
            }
          }
        }
      } catch (error) {
        console.error('Error loading user names:', error)
      }
    }

    const loadTopics = async () => {
      try {
        loading.value = true
        const { data, error } = await supabase
          .from('talktodevteam_topics')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) throw error
        topics.value = data
        
        // Load user names and replies for each topic
        for (const topic of data) {
          await loadReplies(topic.id)
          if (!userNames.value[topic.created_by]) {
            const { data: userData } = await supabase
              .rpc('get_user_info_by_id', {
                user_id: topic.created_by
              })
            if (userData?.[0]) {
              userNames.value[topic.created_by] = getUserDisplayName(userData[0])
            }
          }
        }
      } catch (error) {
        ElMessage.error('Error loading topics: ' + error.message)
      } finally {
        loading.value = false
      }
    }

    const createTopic = async () => {
      if (!newTopic.value.title.trim() || !newTopic.value.description.trim()) {
        ElMessage.warning('Please fill in all required fields')
        return
      }

      try {
        loading.value = true
        const { data: { user } } = await supabase.auth.getUser()
        
        const { error } = await supabase
          .from('talktodevteam_topics')  // Updated table name
          .insert({
            title: newTopic.value.title,
            description: newTopic.value.description,
            created_by: user.id
          })

        if (error) throw error

        showNewTopicDialog.value = false
        newTopic.value = { title: '', description: '' }
        await loadTopics()
        ElMessage.success('Topic created successfully')
      } catch (error) {
        ElMessage.error('Error creating topic: ' + error.message)
      } finally {
        loading.value = false
      }
    }

    const loadReplies = async (topicId) => {
      try {
        const { data: replies, error } = await supabase
          .from('talktodevteam_replies')
          .select('*')
          .eq('topic_id', topicId)
          .order('created_at', { ascending: false })

        if (error) throw error

        // Load user names for reply authors
        for (const reply of replies) {
          if (!userNames.value[reply.created_by]) {
            const { data: userData } = await supabase
              .rpc('get_user_info_by_id', {
                user_id: reply.created_by
              })
            if (userData?.[0]) {
              userNames.value[reply.created_by] = getUserDisplayName(userData[0])
            }
          }
        }

        topicReplies.value[topicId] = replies
      } catch (error) {
        ElMessage.error('Error loading replies: ' + error.message)
      }
    }

    const addReply = async (topic) => {
      if (!newReplies.value[topic.id]?.trim()) return

      try {
        replyLoading.value[topic.id] = true
        const { data: { user } } = await supabase.auth.getUser()
        
        const { error } = await supabase
          .from('talktodevteam_replies')
          .insert({
            topic_id: topic.id,
            content: newReplies.value[topic.id].trim(),
            created_by: user.id
          })

        if (error) throw error

        newReplies.value[topic.id] = ''
        await loadReplies(topic.id)
        ElMessage.success('Reply added successfully')
      } catch (error) {
        ElMessage.error('Error adding reply: ' + error.message)
      } finally {
        replyLoading.value[topic.id] = false
      }
    }

    const viewTopic = async (topic) => {
      selectedTopic.value = topic
      showTopicDialog.value = true
      await loadReplies(topic.id)
    }

    const loadSystemAdmins = async () => {
      try {
        // First get all admins
        const { data: admins, error: adminsError } = await supabase
          .from('talktodevteam_system_admins')
          .select('*')
          .order('granted_at', { ascending: false })

        if (adminsError) throw adminsError

        // Then get user details for each admin
        const adminsWithDetails = await Promise.all(
          admins.map(async (admin) => {
            const { data: userData } = await supabase
              .rpc('get_user_info_by_id', {
                user_id: admin.user_id
              })
            return {
              id: admin.user_id,
              email: userData?.[0]?.email,
              granted_at: admin.granted_at
            }
          })
        )

        systemAdmins.value = adminsWithDetails
      } catch (error) {
        console.error('Error loading system admins:', error)
        ElMessage.error('Error loading system admins')
      }
    }

    const searchUsers = async (query) => {
      if (query.length < 2) return
      
      try {
        searchLoading.value = true
        const { data, error } = await supabase.rpc('get_all_users')

        if (error) throw error
        
        // Filter users client-side based on email
        const filteredUsers = data.filter(user => 
          user.email.toLowerCase().includes(query.toLowerCase()) &&
          !systemAdmins.value.some(admin => admin.id === user.id)
        )
        
        searchResults.value = filteredUsers
      } catch (error) {
        console.error('Error searching users:', error)
        ElMessage.error('Error searching users')
      } finally {
        searchLoading.value = false
      }
    }

    const addAdmins = async () => {
      try {
        loading.value = true
        const { data: { user } } = await supabase.auth.getUser()
        
        const adminsToAdd = selectedUsers.value.map(userId => ({
          user_id: userId,
          granted_by: user.id
        }))

        const { error } = await supabase
          .from('talktodevteam_system_admins')
          .insert(adminsToAdd)

        if (error) throw error

        ElMessage.success('Admins added successfully')
        selectedUsers.value = []
        await loadSystemAdmins()
      } catch (error) {
        console.error('Error adding admins:', error)
        ElMessage.error('Error adding admins')
      } finally {
        loading.value = false
      }
    }

    const editTopic = (topic) => {
      editingTopic.value = { ...topic }
      showEditTopicDialog.value = true
    }

    const saveTopicEdit = async () => {
      if (!editingTopic.value.title.trim() || !editingTopic.value.description.trim()) {
        ElMessage.warning('Please fill in all required fields')
        return
      }

      try {
        loading.value = true
        const { error } = await supabase
          .from('talktodevteam_topics')
          .update({
            title: editingTopic.value.title,
            description: editingTopic.value.description
          })
          .eq('id', editingTopic.value.id)

        if (error) throw error

        showEditTopicDialog.value = false
        await loadTopics()
        ElMessage.success('Topic updated successfully')
      } catch (error) {
        ElMessage.error('Error updating topic: ' + error.message)
      } finally {
        loading.value = false
      }
    }

    const removeAdmin = async (admin) => {
      try {
        loading.value = true
        const { error } = await supabase
          .from('talktodevteam_system_admins')
          .delete()
          .eq('user_id', admin.id)

        if (error) throw error

        ElMessage.success('Admin removed successfully')
        await loadSystemAdmins()
      } catch (error) {
        console.error('Error removing admin:', error)
        ElMessage.error('Error removing admin')
      } finally {
        loading.value = false
      }
    }

    // Rest of the setup function remains the same
    
    onMounted(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      currentUser.value = user
      await loadTopics()
      await loadSystemAdmins()
      
      // Get all unique user IDs from topics and replies
      const userIds = new Set()
      topics.value.forEach(topic => {
        userIds.add(topic.created_by)
      })
      Object.values(topicReplies.value).flat().forEach(reply => {
        userIds.add(reply.created_by)
      })
      
      // Load names for all users
      await loadUserNames(Array.from(userIds))
    })

    return {
      topics,
      replies,
      loading,
      showNewTopicDialog,
      showTopicDialog,
      selectedTopic,
      newTopic,
      newReply,
      userEmails,
      showAdminDialog,
      selectedUsers,
      searchLoading,
      searchResults,
      systemAdmins,
      currentUser,
      showEditTopicDialog,
      editingTopic,
      createTopic,
      addReply,
      viewTopic,
      searchUsers,
      addAdmins,
      editTopic,
      saveTopicEdit,
      isAdmin,
      topicReplies,
      replyLoading,
      newReplies,
      addReply,
      userNames,
      removeAdmin
    }
  }
}
</script>

<style scoped>
.layout-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.talktodev-container {
  padding: 5px 20px;
  flex: 1;
  margin-top: 5px; /* Reduced from 64px */
}

.action-buttons {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
  justify-content: flex-end;
}

.spacer {
  flex: 1;
}

:deep(.el-button .el-icon) {
  margin-right: 8px;
}

.admin-management {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.current-admins {
  margin-bottom: 20px;
}

.add-admin-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.new-topic-form {
  padding: 20px;
}

.topic-description {
  padding: 16px;
  background-color: var(--el-fill-color-light);
  border-radius: 8px;
  margin-bottom: 16px;

  :deep(p) {
    margin: 0.5em 0;
    line-height: 1.5;
  }

  :deep(ul, ol) {
    padding-left: 20px;
  }

  :deep(blockquote) {
    border-left: 3px solid var(--el-border-color-darker);
    padding-left: 1rem;
    color: var(--el-text-color-regular);
  }

  :deep(code) {
    background-color: var(--el-fill-color-lighter);
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
    font-family: monospace;
  }
}

.topic-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.topic-header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.topic-date {
  color: var(--el-text-color-secondary);
  font-size: 0.9em;
}

.topic-replies {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.reply-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 16px;
}

.reply-item {
  background-color: var(--el-fill-color-lighter);
  padding: 12px;
  border-radius: 8px;
}

.reply-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 0.9em;
  color: var(--el-text-color-secondary);
}

.reply-author {
  font-weight: 500;
}

.reply-date {
  color: var(--el-text-color-secondary);
  font-size: 0.9em;
}

.reply-content {
  padding: 8px;
  background-color: var(--el-fill-color-light);
  border-radius: 4px;
}

.reply-input {
  margin-top: 16px;
}

.topic-title {
  text-decoration: none;
  color: var(--el-text-color-primary);
}

.topic-title:hover {
  color: var(--el-color-primary);
}

.topic-meta {
  display: flex;
  gap: 16px;
  color: var(--el-text-color-secondary);
  font-size: 0.9em;
}

.topic-card {
  margin-bottom: 16px;
}

.topic-replies-count {
  color: var(--el-text-color-secondary);
  font-size: 0.9em;
}

.topic-title-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.topic-replies-count {
  color: var(--el-text-color-secondary);
  font-size: 0.9em;
  margin-left: 2px;
}
</style> 