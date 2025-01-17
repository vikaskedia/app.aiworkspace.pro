<template>
  <div class="layout-container">
    <HeaderCt />
    <div class="topic-details-container">
      <div class="back-button">
        <el-button link @click="$router.push('/talk-to-dev')">
          <el-icon><Back /></el-icon>
          Back to Topics
        </el-button>
      </div>

      <el-card v-if="topic" class="topic-card">
        <template #header>
          <div class="topic-header">
            <div>
              <h2>{{ topic.title }}</h2>
              <span class="topic-author">By: {{ userNames[topic.created_by] }}</span>
            </div>
            <div class="topic-header-actions">
              <el-button 
                v-if="topic.created_by === currentUser?.id"
                link
                @click="editTopic"
              >
                <el-icon><Edit /></el-icon>
              </el-button>
              <span class="topic-date">{{ new Date(topic.created_at).toLocaleDateString() }}</span>
            </div>
          </div>
        </template>

        <div class="topic-description" v-html="topic.description"></div>

        <div class="topic-replies" v-if="replies.length">
          <h4>Replies</h4>
          <div class="reply-list">
            <div v-for="reply in replies" :key="reply.id" class="reply-item">
              <div class="reply-header">
                <span class="reply-author">{{ userNames[reply.created_by] }}</span>
                <div class="reply-actions">
                  <el-button 
                    v-if="reply.created_by === currentUser?.id"
                    link
                    @click="editReply(reply)"
                  >
                    <el-icon><Edit /></el-icon>
                  </el-button>
                  <span class="reply-date">{{ new Date(reply.created_at).toLocaleString() }}</span>
                </div>
              </div>
              <div class="reply-content" v-html="reply.content"></div>
            </div>
          </div>
        </div>

        <div class="reply-input">
          <TiptapEditor
            v-model="newReply"
            placeholder="Write a reply..."
            :height="'200px'"
            :enable-typeahead="false"
          />
          <el-button 
            type="primary" 
            @click="addReply"
            :loading="replyLoading"
            :disabled="!newReply?.trim()"
            style="margin-top: 8px">
            Add Reply
          </el-button>
        </div>
      </el-card>

      <el-dialog
        v-model="showEditDialog"
        title="Edit Topic"
        width="600px">
        <div class="edit-topic-form">
          <el-form label-position="top">
            <el-form-item label="Title">
              <el-input v-model="editedTopic.title" />
            </el-form-item>
            <el-form-item label="Description">
              <TiptapEditor
                v-model="editedTopic.description"
                placeholder="Write your topic description..."
                :height="'400px'"
                :enable-typeahead="false"
              />
            </el-form-item>
          </el-form>
        </div>
        <template #footer>
          <div style="display: flex; justify-content: space-between; width: 100%">
            <el-button 
              type="danger"
              @click="confirmDeleteTopic"
              :loading="loading">
              Delete Topic
            </el-button>
            <el-button 
              type="primary" 
              @click="saveTopic"
              :loading="loading"
              :disabled="!editedTopic.title.trim() || !editedTopic.description.trim()">
              Save Changes
            </el-button>
          </div>
        </template>
      </el-dialog>

      <el-dialog
        v-model="showEditReplyDialog"
        title="Edit Reply"
        width="600px">
        <div class="edit-reply-form">
          <TiptapEditor
            v-model="editedReply.content"
            placeholder="Edit your reply..."
            :height="'300px'"
            :enable-typeahead="false"
          />
        </div>
        <template #footer>
          <el-button link @click="showEditReplyDialog = false">Cancel</el-button>
          <el-button 
            type="primary" 
            @click="saveReply"
            :loading="replyLoading">
            Save Changes
          </el-button>
        </template>
      </el-dialog>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '../../supabase'
import { ElMessage, ElMessageBox } from 'element-plus'
import HeaderCt from '../HeaderCt.vue'
import TiptapEditor from '../common/TiptapEditor.vue'
import { Back, Edit } from '@element-plus/icons-vue'
import axios from 'axios'

export default {
  name: 'TalkToDevTopicDetails',
  components: {
    HeaderCt,
    TiptapEditor,
    Back,
    Edit
  },
  setup() {
    const route = useRoute()
    const router = useRouter()
    const topic = ref(null)
    const replies = ref([])
    const loading = ref(false)
    const replyLoading = ref(false)
    const newReply = ref('')
    const userEmails = ref({})
    const currentUser = ref(null)
    const showEditDialog = ref(false)
    const editedTopic = ref({ title: '', description: '' })
    const showEditReplyDialog = ref(false)
    const editedReply = ref({ id: null, content: '' })
    const userNames = ref({})

    const getUserDisplayName = (userData) => {
      if (!userData) return '';
      return userData.user_metadata?.name || 
             userData.user_metadata?.user_name || 
             userData.user_metadata?.full_name ||
             userData.email?.split('@')[0];
    }

    const loadTopic = async () => {
      try {
        loading.value = true
        const { data, error } = await supabase
          .from('talktodevteam_topics')
          .select('*')
          .eq('id', route.params.id)
          .single()

        if (error) throw error
        topic.value = data

        // Load topic creator's name
        if (!userNames.value[data.created_by]) {
          const { data: userData } = await supabase
            .rpc('get_user_info_by_id', {
              user_id: data.created_by
            })
          if (userData?.[0]) {
            userNames.value[data.created_by] = getUserDisplayName(userData[0])
          }
        }

        await loadReplies()
      } catch (error) {
        ElMessage.error('Error loading topic: ' + error.message)
        router.push('/talk-to-dev')
      } finally {
        loading.value = false
      }
    }

    const loadReplies = async () => {
      try {
        const { data: repliesData, error } = await supabase
          .from('talktodevteam_replies')
          .select('*')
          .eq('topic_id', route.params.id)
          .order('created_at', { ascending: false })

        if (error) throw error

        // Load user names for reply authors
        for (const reply of repliesData) {
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

        replies.value = repliesData
      } catch (error) {
        ElMessage.error('Error loading replies: ' + error.message)
      }
    }

    const addReply = async () => {
      if (!newReply.value.trim()) return

      try {
        replyLoading.value = true
        const { data: { user } } = await supabase.auth.getUser()
        
        const { error } = await supabase
          .from('talktodevteam_replies')
          .insert({
            topic_id: route.params.id,
            content: newReply.value.trim(),
            created_by: user.id
          })

        if (error) throw error

        newReply.value = ''
        await loadReplies()
        ElMessage.success('Reply added successfully')
      } catch (error) {
        ElMessage.error('Error adding reply: ' + error.message)
      } finally {
        replyLoading.value = false
      }
    }

    const editTopic = () => {
      editedTopic.value = {
        title: topic.value.title,
        description: topic.value.description
      }
      showEditDialog.value = true
    }

    const saveTopic = async () => {
      try {
        loading.value = true
        const { error } = await supabase
          .from('talktodevteam_topics')
          .update({
            title: editedTopic.value.title,
            description: editedTopic.value.description
          })
          .eq('id', route.params.id)

        if (error) throw error

        topic.value.title = editedTopic.value.title
        topic.value.description = editedTopic.value.description
        
        showEditDialog.value = false
        ElMessage.success('Topic updated successfully')
      } catch (error) {
        ElMessage.error('Error updating topic: ' + error.message)
      } finally {
        loading.value = false
      }
    }

    const editReply = (reply) => {
      editedReply.value = {
        id: reply.id,
        content: reply.content
      }
      showEditReplyDialog.value = true
    }

    const saveReply = async () => {
      try {
        replyLoading.value = true
        const { error } = await supabase
          .from('talktodevteam_replies')
          .update({ content: editedReply.value.content })
          .eq('id', editedReply.value.id)

        if (error) throw error

        showEditReplyDialog.value = false
        await loadReplies()
        ElMessage.success('Reply updated successfully')
      } catch (error) {
        ElMessage.error('Error updating reply: ' + error.message)
      } finally {
        replyLoading.value = false
      }
    }

    const confirmDeleteTopic = () => {
      ElMessageBox.confirm(
        'Are you sure you want to delete this topic? This action cannot be undone.',
        'Delete Topic',
        {
          confirmButtonText: 'Delete',
          cancelButtonText: 'Cancel',
          type: 'warning'
        }
      )
      .then(() => {
        deleteTopic()
      })
      .catch(() => {})
    }

    const deleteTopic = async () => {
      try {
        loading.value = true
        
        // Get file paths from topic content
        const fileUrls = topic.value.description.match(/href="[^"]+"/g) || []
        const giteaFiles = fileUrls
          .map(url => url.match(/href="([^"]+)"/)[1])
          .filter(url => url.includes('gitea'))
        
        // Delete files from Gitea
        if (giteaFiles.length) {
          const deletePromises = giteaFiles.map(async (fileUrl) => {
            try {
              await axios.delete(fileUrl, {
                headers: {
                  Authorization: `Bearer ${process.env.VUE_APP_GITEA_TOKEN}`
                }
              })
            } catch (error) {
              console.error('Error deleting file from Gitea:', error)
            }
          })
          await Promise.all(deletePromises)
        }

        // Delete topic
        const { error } = await supabase
          .from('talktodevteam_topics')
          .delete()
          .eq('id', route.params.id)

        if (error) throw error

        router.push('/talk-to-dev')
        ElMessage.success('Topic deleted successfully')
      } catch (error) {
        ElMessage.error('Error deleting topic: ' + error.message)
      } finally {
        loading.value = false
      }
    }

    onMounted(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      currentUser.value = user
      await loadTopic()
    })

    return {
      topic,
      replies,
      loading,
      replyLoading,
      newReply,
      userEmails,
      currentUser,
      addReply,
      editTopic,
      saveTopic,
      showEditDialog,
      editedTopic,
      showEditReplyDialog,
      editedReply,
      editReply,
      saveReply,
      userNames,
      confirmDeleteTopic,
      deleteTopic
    }
  }
}
</script>

<style scoped>
.topic-details-container {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.back-button {
  margin-bottom: 20px;
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

.topic-description {
  padding: 16px;
  background-color: var(--el-fill-color-light);
  border-radius: 8px;
  margin-bottom: 16px;
}

.topic-replies {
  margin-top: 24px;
}

.reply-list {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.reply-item {
  background-color: var(--el-fill-color-lighter);
  padding: 16px;
  border-radius: 8px;
}

.reply-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 0.9em;
  color: var(--el-text-color-secondary);
}

.reply-author {
  font-weight: 500;
}

.reply-content {
  padding: 12px;
  background-color: var(--el-fill-color-light);
  border-radius: 4px;
}

.reply-input {
  margin-top: 24px;
}

.reply-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.topic-author {
  font-size: 0.9em;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
  display: block;
}
</style> 