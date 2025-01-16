<template>
  <div class="consultation-container">
    <HeaderCt />
    
    <div class="content">
      <!-- Question Display -->
      <div class="qa-display">
        <div class="navigation-arrow up" v-if="questionHistory.length > 0" @click="navigateTo(currentIndex - 1)" :class="{ disabled: currentIndex === 0 }">
          <el-icon><ArrowUp /></el-icon>
        </div>

        <div class="question">
          <div class="avatar attorney">A</div>
          <div class="message">
            <template v-if="loading && !currentQuestion">
              <el-skeleton :rows="2" animated />
            </template>
            <template v-else>
              {{ isViewingHistory ? questionHistory[currentIndex].question : currentQuestion }}
            </template>
          </div>
        </div>
        
        <div class="answer">
          <div class="avatar user">
            <el-avatar 
              :size="40"
              :src="user?.user_metadata?.avatar_url"
              :icon="!user?.user_metadata?.avatar_url ? 'UserFilled' : undefined"
            />
          </div>
          <div class="message-container">
            <!-- Current question edit box -->
            <div v-if="!isViewingHistory" class="answer-edit-mode">
              <el-input
                v-model="currentAnswer"
                type="textarea"
                :rows="3"
                placeholder="Type your answer here..."
                :disabled="loading"
                @keyup.enter.ctrl="handleCurrentAnswer"
              />
              <div class="input-actions">
                <span class="hint">
                  <!-- Press Ctrl + Enter to send -->
                  &nbsp;
                </span>
                <div class="button-group">
                  <el-button 
                    type="primary" 
                    @click="handleCurrentAnswer"
                    :loading="loading"
                    :disabled="!currentAnswer.trim()">
                    Submit
                  </el-button>
                </div>
              </div>
            </div>

            <!-- Previous answers display/edit -->
            <template v-else>
              <div v-if="!isEditing" class="answer-display">
                <div class="answer-text">{{ currentAnswer }}</div>
                <button class="edit-button" @click="startEditing">
                  <el-icon><Edit /></el-icon>
                </button>
              </div>
              
              <div v-else class="answer-edit-mode">
                <el-input
                  v-model="currentAnswer"
                  type="textarea"
                  :rows="3"
                  placeholder="Type your answer here..."
                  :disabled="loading"
                  @keyup.enter.ctrl="handleCurrentAnswer"
                />
                <div class="input-actions">
                  <span class="hint">
                    &nbsp;
                  </span>
                  <div class="button-group">
                    <el-button @click="cancelEdit">
                      Cancel
                    </el-button>
                    <el-button 
                      type="primary" 
                      @click="handleCurrentAnswer"
                      :loading="loading"
                      :disabled="!currentAnswer.trim()">
                      Save
                    </el-button>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>

        <div class="navigation-arrow down" v-if="questionHistory.length > 0" @click="navigateTo(currentIndex + 1)" :class="{ disabled: currentIndex >= questionHistory.length || !currentQuestion }">
          <el-icon><ArrowDown /></el-icon>
        </div>

        <div class="question-counter" v-if="questionHistory.length > 0">
          {{ currentIndex + 1 }} of {{ totalQuestions }}
        </div>
      </div>
    </div>

    <!-- Shared Notepad Button -->
    <el-button
      class="notepad-button"
      type="info"
      @click="showNotepad = true">
      Shared Notepad
    </el-button>

    <!-- Shared Notepad Dialog -->
    <el-dialog
      v-model="showNotepad"
      title="Shared Notepad"
      :width="dialogWidth"
      class="notepad-dialog">
      <div class="notepad-content">
        <el-collapse v-model="expandedSections">
          <el-collapse-item 
            v-for="(items, key) in notepadData" 
            :key="key"
            :title="formatSectionTitle(key)"
            :name="key">
            <template #title>
              <div class="section-header">
                <span class="section-title">{{ formatSectionTitle(key) }} ({{ items.length }})</span>
              </div>
            </template>
            <div class="section-content">
              <template v-if="items && items.length > 0">
                <ul class="item-list">
                  <li v-for="(item, index) in items" :key="index">
                    {{ item }}
                  </li>
                </ul>
              </template>
              <div v-else class="empty-section">
                No {{ formatSectionTitle(key).toLowerCase() }} recorded yet
              </div>
            </div>
          </el-collapse-item>
        </el-collapse>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import HeaderCt from '../HeaderCt.vue'
import { ElMessage } from 'element-plus'
import { Loading, ArrowLeft, Check, ArrowRight, ArrowUp, ArrowDown, Edit } from '@element-plus/icons-vue'
import { ElSkeleton } from 'element-plus'
import { supabase } from '../../supabase'
import promptText from './prompt.txt?raw'

const pythonApiBaseUrl = import.meta.env.VITE_PYTHON_API_URL || 'http://localhost:3001'

export default {
  name: 'InitialConsultationCt',
  components: { 
    HeaderCt,
    Loading,
    ArrowLeft,
    Check,
    ArrowRight,
    ArrowUp,
    ArrowDown,
    Edit,
    ElSkeleton
  },

  setup() {
    const consultationId = ref(null)
    
    const currentQuestion = ref('')
    const userResponse = ref('')
    const loading = ref(false)
    const showNotepad = ref(false)
    const hasPreviousQuestions = ref(false)
    const questionHistory = ref([])
    const editingIndex = ref(null)
    const currentIndex = ref(0)
    const isEditing = ref(false)
    const editedAnswer = ref('')
    const currentAnswer = ref('')
    const isViewingHistory = ref(false)
    const totalQuestions = ref(1)

    const notepadData = ref({
      events: [],
      files: [],
      goals: [],
      tasks: [],
      possibleOutcome: []
    })

    const user = ref(null)

    const userMatters = ref([]);

    const expandedSections = ref(['events', 'files', 'goals', 'tasks', 'possibleOutcome'])

    const dialogWidth = computed(() => {
      const windowWidth = window.innerWidth
      if (windowWidth <= 480) return '90%'
      return Math.min(600, windowWidth * 0.8) + 'px'
    })

    const getSharedMatters = async (userId) => {
      try {
        // Get matters shared with the user
        const { data: sharedMatters, error } = await supabase
          .from('matters')
          .select(`
            *,
            matter_access!inner (
              access_type,
              shared_with_user_id
            ),
            tasks (
              id,
              title,
              description,
              status,
              priority
            )
          `)
          .eq('deleted', false)
          .eq('matter_access.shared_with_user_id', userId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return sharedMatters || [];
      } catch (error) {
        console.error('Error fetching shared matters:', error);
        return [];
      }
    };

    const loadUserMatters = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: sharedMatters, error } = await supabase
          .from('matters')
          .select(`
            *,
            matter_access!inner (
              access_type,
              shared_with_user_id
            ),
            tasks (
              id,
              title,
              description,
              status,
              priority
            )
          `)
          .eq('deleted', false)
          .eq('matter_access.shared_with_user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        userMatters.value = sharedMatters || [];
      } catch (error) {
        console.error('Error fetching shared matters:', error);
        userMatters.value = [];
      }
    };

    const formatSectionTitle = (key) => {
      return key.split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    }

    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      try {
        const date = new Date(dateStr);
        return date.toLocaleDateString();
      } catch (e) {
        return dateStr;
      }
    }

    const sortEvents = (events) => {
      return events.sort((a, b) => {
        const dateA = new Date(a.match(/\[(.*?)\]/)?.[1] || 0);
        const dateB = new Date(b.match(/\[(.*?)\]/)?.[1] || 0);
        return dateA - dateB;
      });
    }

    const updateNotepadData = (newData) => {
      // Sort events chronologically
      if (newData.events) {
        newData.events = sortEvents(newData.events);
      }

      // Merge new data with existing data, removing duplicates
      Object.keys(newData).forEach(key => {
        if (Array.isArray(newData[key])) {
          const existingItems = new Set(notepadData.value[key] || []);
          newData[key].forEach(item => existingItems.add(item));
          notepadData.value[key] = Array.from(existingItems);
        }
      });
    }

    const formatQuestionHistory = (history) => {
      if (!history || history.length === 0) return '';
      
      return '\n\nPrevious Questions and Answers:\n' + 
        history.map(qa => `Q: ${qa.question}\nA: ${qa.answer}`).join('\n\n');
    }

    const preparePrompt = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get system prompt from initial consultant attorney
      const { systemPrompt, attorneyData } = await getInitialConsultantPrompt();
      if (!systemPrompt) {
        throw new Error('No initial consultant system prompt found');
      }

      // Format shared matters information
      const sharedMattersInfo = userMatters.value.length > 0 
        ? `\n\nShared Legal Matters:\n${userMatters.value.map(matter => `
- Matter: ${matter.title}
  Description: ${matter.description || 'No description'}
  Tasks:${matter.tasks?.length ? matter.tasks.map(task => `
    • ${task.title} (${task.priority} priority) - ${task.status}`).join('') : '\n    • No tasks yet'}`).join('\n')}`
        : '\n\nShared Legal Matters: None';

      // Add user information section with shared matters
      const userInfoSection = `Information known about the user:
- Name: ${user.user_metadata?.name || 
         user.user_metadata?.user_name || 
         user.user_metadata?.full_name ||
         user.email?.split('@')[0]}
- Email: ${user.email}
- Phone: ${user.user_metadata?.phone || 'Not provided'}
- Preferred Language: ${user.user_metadata?.preferred_language || 'Not specified'}${sharedMattersInfo}
`;

      const fullPrompt = systemPrompt + '\n\n' + userInfoSection + formatQuestionHistory(questionHistory.value);
      
      return {
        fullPrompt,
        user,
        attorneyData
      };
    };

    const handleSubmit = async () => {
      try {
        loading.value = true;
        const { fullPrompt, user } = await preparePrompt();

        const response = await fetch(`${pythonApiBaseUrl}/gpt/process_consultation`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.id,
            consultationId: consultationId.value,
            currentQuestion: currentQuestion.value,
            answer: currentAnswer.value,
            systemPrompt: fullPrompt,
            previousData: notepadData.value
          })
        });

        if (!response.ok) throw new Error('Failed to process consultation');
        
        const data = await response.json();
        
        // Update notepad data with new information
        updateNotepadData(data);
        
        // Add to history
        questionHistory.value.push({
          question: currentQuestion.value,
          answer: currentAnswer.value
        })

        // Set next question
        currentQuestion.value = data.nextQuestion
        currentAnswer.value = ''
        
        // Update navigation
        currentIndex.value = questionHistory.value.length
        totalQuestions.value = questionHistory.value.length + (data.nextQuestion ? 1 : 0)
        isViewingHistory.value = false

        await saveConsultationState()

      } catch (error) {
        ElMessage.error('Error processing your response: ' + error.message)
      } finally {
        loading.value = false
      }
    }

    const handlePrevious = async () => {
      try {
        loading.value = true;
        const { data: { user } } = await supabase.auth.getUser();

        const response = await fetch(`${pythonApiBaseUrl}/gpt/get_previous_question`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.id,
            consultationId: consultationId.value
          })
        });

        if (!response.ok) throw new Error('Failed to get previous question');
        
        const data = await response.json();
        
        // Update current question and previous answer
        currentQuestion.value = data.question;
        userResponse.value = data.previousAnswer || '';
        
        // Update notepad with previous state
        if (data.notepadData) {
          notepadData.value = data.notepadData;
        }

      } catch (error) {
        ElMessage.error('Error getting previous question: ' + error.message);
      } finally {
        loading.value = false;
      }
    };

    const initializeConsultation = async () => {
      try {
        loading.value = true;
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          throw new Error('User not authenticated');
        }

        // Generate consultation ID if not exists
        if (!consultationId.value) {
          consultationId.value = crypto.randomUUID();
        }

        // Load existing consultation state if any
        await loadConsultationState();

        // Only fetch first question if we don't have any history
        if (questionHistory.value.length === 0) {
          const { fullPrompt, user: userData, attorneyData } = await preparePrompt();

          const response = await fetch(`${pythonApiBaseUrl}/gpt/start_consultation`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: userData.id,
              consultationId: consultationId.value,
              userData: {
                name: userData.user_metadata?.name || 
                      userData.user_metadata?.user_name || 
                      userData.user_metadata?.full_name ||
                      userData.email?.split('@')[0],
                email: userData.email,
                phone: userData.user_metadata?.phone,
                preferredLanguage: userData.user_metadata?.preferred_language,
              },
              attorneyData: {
                name: attorneyData?.name || 'Associate Attorney',
                specialization: attorneyData?.specialization,
                barNumber: attorneyData?.bar_number,
                firmName: attorneyData?.firm_name,
              },
              systemPrompt: fullPrompt
            })
          });

          if (!response.ok) throw new Error('Failed to start consultation');
          
          const data = await response.json();
          currentQuestion.value = data.firstQuestion;
          notepadData.value = {
            events: [],
            files: [],
            goals: [],
            tasks: [],
            possibleOutcome: []
          };
        }

      } catch (error) {
        ElMessage.error('Error starting consultation: ' + error.message);
      } finally {
        loading.value = false;
      }
    };

    const startEditing = () => {
      isEditing.value = true
    }

    const cancelEdit = () => {
      isEditing.value = false
      if (isViewingHistory.value) {
        currentAnswer.value = questionHistory.value[currentIndex.value].answer
      }
    }

    const handleEdit = async () => {
      try {
        loading.value = true
        const { fullPrompt, user } = await preparePrompt();

        const response = await fetch(`${pythonApiBaseUrl}/gpt/process_consultation`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.id,
            consultationId: consultationId.value,
            currentQuestion: questionHistory.value[currentIndex.value].question,
            answer: currentAnswer.value,
            systemPrompt: fullPrompt,
            editIndex: currentIndex.value
          })
        })

        if (!response.ok) throw new Error('Failed to process consultation')
        
        const data = await response.json()
        
        // Update notepad data
        notepadData.value = data.notepadData
        
        // Update history
        questionHistory.value[currentIndex.value].answer = currentAnswer.value
        
        // Remove subsequent questions if editing previous answer
        if (currentIndex.value < questionHistory.value.length - 1) {
          questionHistory.value = questionHistory.value.slice(0, currentIndex.value + 1)
          totalQuestions.value = questionHistory.value.length + 1
        }
        
        // Set next question if provided
        if (data.nextQuestion) {
          currentQuestion.value = data.nextQuestion
          isViewingHistory.value = false
          currentAnswer.value = ''
        }

        await saveConsultationState()

      } catch (error) {
        ElMessage.error('Error processing your edit: ' + error.message)
      } finally {
        loading.value = false
      }
    }

    const navigateTo = (index) => {
      if (index >= 0 && index <= questionHistory.value.length) {
        currentIndex.value = index
        isViewingHistory.value = index < questionHistory.value.length
        if (isViewingHistory.value) {
          currentAnswer.value = questionHistory.value[index].answer
        } else {
          currentAnswer.value = ''
        }
      }
    }

    const handleCurrentAnswer = async () => {
      if (isViewingHistory.value) {
        await handleEdit()
      } else {
        await handleSubmit()
      }
      isEditing.value = false
    }

    let touchStartY = 0
    let touchEndY = 0

    const handleTouchStart = (event) => {
      touchStartY = event.touches[0].clientY
    }

    const handleTouchEnd = (event) => {
      touchEndY = event.changedTouches[0].clientY
      const diffY = touchEndY - touchStartY

      // Minimum swipe distance of 50px
      if (Math.abs(diffY) > 50) {
        if (diffY > 0 && currentIndex.value > 0) {
          // Swipe down - go to previous
          navigateTo(currentIndex.value - 1)
        } else if (diffY < 0 && currentIndex.value < questionHistory.value.length && currentQuestion.value) {
          // Swipe up - go to next
          navigateTo(currentIndex.value + 1)
        }
      }
    }

    const saveConsultationState = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        
        // Prepare the Q&A data
        const interviewData = {
          questions: questionHistory.value.map(qa => ({
            question: qa.question,
            answer: qa.answer
          })),
          currentQuestion: currentQuestion.value
        }

        // Update consultation record
        const { error } = await supabase
          .from('initial_consultation')
          .upsert({
            id: consultationId.value,
            user_id: user.id,
            json_of_interview_qna: interviewData,
            plan_accepted_by_user_json: notepadData.value,
            updated_at: new Date().toISOString()
          })

        if (error) throw error
      } catch (error) {
        console.error('Error saving consultation state:', error)
        ElMessage.error('Failed to save consultation state')
      }
    }

    const loadConsultationState = async () => {
      try {
        loading.value = true
        const { data: { user } } = await supabase.auth.getUser()

        // Get most recent consultation for this user
        const { data, error } = await supabase
          .from('initial_consultation')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)

        if (error) throw error

        if (data && data.length > 0) {
          const consultation = data[0]
          consultationId.value = consultation.id

          // Restore Q&A history
          const interviewData = consultation.json_of_interview_qna
          questionHistory.value = interviewData.questions || []
          currentQuestion.value = interviewData.currentQuestion
          currentIndex.value = questionHistory.value.length

          // Restore notepad data
          if (consultation.plan_accepted_by_user_json) {
            notepadData.value = consultation.plan_accepted_by_user_json
          }

          totalQuestions.value = questionHistory.value.length + (currentQuestion.value ? 1 : 0)
        } else {
          // No existing consultation found - generate new ID
          consultationId.value = crypto.randomUUID()
        }
      } catch (error) {
        console.error('Error loading consultation state:', error)
        ElMessage.error('Failed to load consultation state')
      } finally {
        loading.value = false
      }
    }

    const fetchUser = async () => {
      try {
        const { data: { user: userData } } = await supabase.auth.getUser()
        user.value = userData
      } catch (error) {
        console.error('Error fetching user:', error)
      }
    }

    const getInitialConsultantPrompt = async () => {
      try {
        const { data: attorney, error } = await supabase
          .from('attorneys')
          .select('*')
          .eq('is_initial_consultant', true)
          .single();

        if (error) throw error;
        return {
          systemPrompt: attorney?.system_prompt || '',
          attorneyData: attorney || null
        };
      } catch (error) {
        console.error('Error fetching initial consultant prompt:', error);
        ElMessage.error('Error loading consultation system');
        return {
          systemPrompt: '',
          attorneyData: null
        };
      }
    }

    onMounted(async () => {
      await Promise.all([
        initializeConsultation(),
        loadUserMatters()
      ]);
      const qaDisplay = document.querySelector('.qa-display');
      if (qaDisplay) {
        qaDisplay.addEventListener('touchstart', handleTouchStart);
        qaDisplay.addEventListener('touchend', handleTouchEnd);
      }
      fetchUser();
    });

    onUnmounted(() => {
      const qaDisplay = document.querySelector('.qa-display')
      if (qaDisplay) {
        qaDisplay.removeEventListener('touchstart', handleTouchStart)
        qaDisplay.removeEventListener('touchend', handleTouchEnd)
      }
    });

    return {
      consultationId,
      currentQuestion,
      userResponse,
      loading,
      showNotepad,
      notepadData,
      hasPreviousQuestions,
      handleSubmit,
      handlePrevious,
      formatSectionTitle,
      questionHistory,
      editingIndex,
      startEditing,
      cancelEdit,
      handleEdit,
      currentIndex,
      navigateTo,
      isEditing,
      editedAnswer,
      currentAnswer,
      isViewingHistory,
      totalQuestions,
      handleCurrentAnswer,
      handleTouchStart,
      handleTouchEnd,
      saveConsultationState,
      loadConsultationState,
      user,
      userMatters,
      loadUserMatters,
      expandedSections,
      dialogWidth
    }
  }
}
</script>

<style scoped>
.consultation-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  padding: 2rem 1rem;
}

.content {
  max-width: 800px;
  margin: 2rem auto 0 auto;
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
  padding: 2rem;
}

.conversation-history {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.history-item, .current-question {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.question, .answer, .answer-input {
  display: flex;
  gap: 1rem;
  padding: 1rem;
}

.question {
  background-color: #f9fafb;
}

.answer {
  background-color: white;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  flex-shrink: 0;
}

.avatar.attorney {
  background-color: #626aef;
  color: white;
  border-radius: 50%;
}

/* .avatar.user {
  background-color: #10b981;
  color: white;
} */

.message {
  padding: 0.5rem;
  line-height: 1.5;
  flex: 1;
}

.message-container {
  flex: 1;
}

.input-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.input-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.5rem;
}

.hint {
  color: #6b7280;
  font-size: 0.875rem;
}

.edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.editable {
  position: relative;
}

.editable::before {
  content: '';
  position: absolute;
  left: -1rem;
  top: 0;
  bottom: 0;
  width: 3px;
  background-color: #626aef;
  border-radius: 4px;
}

.notepad-button {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  padding: 1rem 1.5rem;
  border-radius: 12px;
  background: white;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  transition: all 0.2s ease;
  border: 1px solid rgba(0, 0, 0, 0.05);
  color: var(--el-text-color-primary);
}

.notepad-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.12);
}

.notepad-dialog {
  :deep(.el-dialog) {
    max-width: 600px;
    margin: 0 auto;
  }

  :deep(.el-dialog__body) {
    padding: 0;
  }
  
  :deep(.el-dialog__header) {
    padding: 12px 16px;
    margin: 0;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }
}

@media (max-width: 480px) {
  .notepad-dialog {
    :deep(.el-dialog) {
      width: 90% !important;
      margin: 10vh auto;
    }
  }
}

.notepad-content {
  max-height: 70vh;
  overflow-y: auto;
}

:deep(.el-collapse) {
  border: none;
}

:deep(.el-collapse-item__header) {
  padding: 8px 12px;
  font-size: 14px;
  border: none;
  height: auto;
}

:deep(.el-collapse-item__arrow) {
  margin-right: 8px;
}

:deep(.el-collapse-item__content) {
  padding: 0;
  border-top: 1px solid var(--el-border-color-lighter);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.section-title {
  font-weight: 600;
  color: var(--el-text-color-primary);
  line-height: normal;
  font-size: 13px;
}
.section-content {
    padding-left: 20px;
}
.item-count {
  font-size: 12px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  padding: 1px 8px;
  border-radius: 10px;
  font-weight: normal;
}

.item-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.item-list li {
  padding: 0 12px;
  font-size: 13px;
  line-height: 1.4;
}

.item-list li:last-child {
  border-bottom: none;
}

.empty-section {
  padding: 0 12px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  font-style: italic;
}

.loading-container {
  text-align: center;
  padding: 2rem;
  color: #909399;
}

.navigation-controls {
  display: none;
}

.qa-display {
  display: flex;
  flex-direction: column;
  position: relative;
  gap: 1.5rem;
}

.navigation-arrow {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: white;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #4f46e5;
  z-index: 10;
}

.navigation-arrow.up {
  top: -20px;
}

.navigation-arrow.down {
  bottom: -20px;
}

.navigation-arrow:not(.disabled):hover {
  transform: translateX(-50%) translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  background: #4f46e5;
  color: white;
}

.navigation-arrow.disabled {
  background: #f1f5f9;
  color: #94a3b8;
  cursor: not-allowed;
}

.question-counter {
  position: absolute;
  right: 1rem;
  top: -1.5rem;
  font-size: 0.875rem;
  color: #64748b;
  font-weight: 500;
}

@media (max-width: 640px) {
  .consultation-container {
    padding: 1rem 0.5rem;
  }
  
  .content {
    padding: 1.5rem 1rem;
  }
  
  .question, .answer {
    padding: 1rem;
  }
  
  .notepad-button {
    bottom: 1rem;
    right: 1rem;
    padding: 0.75rem 1rem;
  }
}
</style>
