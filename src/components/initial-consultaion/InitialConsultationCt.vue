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
      width="80%"
      class="notepad-dialog">
      <div class="notepad-content" v-loading="loading">
        <div v-for="(items, key) in notepadData" :key="key" class="section">
          <h4>{{ formatSectionTitle(key) }}</h4>
          <div class="section-content">
            <template v-if="items && items.length > 0">
              <ul>
                <li v-for="(item, index) in items" :key="index">
                  {{ item }}
                </li>
              </ul>
            </template>
            <div v-else class="empty-section">
              No {{ formatSectionTitle(key).toLowerCase() }} recorded yet
            </div>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue'
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

    const handleSubmit = async () => {
      try {
        loading.value = true;
        const { data: { user } } = await supabase.auth.getUser();

        // Get system prompt from initial consultant attorney
        const systemPrompt = await getInitialConsultantPrompt();
        if (!systemPrompt) {
          throw new Error('No initial consultant system prompt found');
        }

        const fullPrompt = systemPrompt + formatQuestionHistory(questionHistory.value);

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

        // Get attorney data and system prompt
        const { systemPrompt, attorneyData } = await getInitialConsultantPrompt();
        if (!systemPrompt) {
          throw new Error('No initial consultant system prompt found');
        }

        // Generate consultation ID if not exists
        if (!consultationId.value) {
          consultationId.value = crypto.randomUUID();
        }

        // Load existing consultation state if any
        await loadConsultationState()

        // Only fetch first question if we don't have any history
        if (questionHistory.value.length === 0) {
          const response = await fetch(`${pythonApiBaseUrl}/gpt/start_consultation`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: user.id,
              consultationId: consultationId.value,
              userData: {
                name: user.user_metadata?.name || 
                      user.user_metadata?.user_name || 
                      user.user_metadata?.full_name ||
                      user.email?.split('@')[0],
                email: user.email,
                phone: user.user_metadata?.phone,
                preferredLanguage: user.user_metadata?.preferred_language,
              },
              attorneyData: {
                name: attorneyData?.name || 'Associate Attorney',
                specialization: attorneyData?.specialization,
                barNumber: attorneyData?.bar_number,
                firmName: attorneyData?.firm_name,
              },
              systemPrompt
            })
          })

          if (!response.ok) throw new Error('Failed to start consultation')
          
          const data = await response.json()
          currentQuestion.value = data.firstQuestion
          notepadData.value = {
              events: [],
              files: [],
              goals: [],
              tasks: [],
              possibleOutcome: []
          }
        }

      } catch (error) {
        ElMessage.error('Error starting consultation: ' + error.message)
      } finally {
        loading.value = false
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
        const { data: { user } } = await supabase.auth.getUser()

        // Get system prompt from initial consultant attorney
        const systemPrompt = await getInitialConsultantPrompt();
        if (!systemPrompt) {
          throw new Error('No initial consultant system prompt found');
        }

        const fullPrompt = systemPrompt + formatQuestionHistory(questionHistory.value);

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
      await initializeConsultation();
      const qaDisplay = document.querySelector('.qa-display')
      if (qaDisplay) {
        qaDisplay.addEventListener('touchstart', handleTouchStart)
        qaDisplay.addEventListener('touchend', handleTouchEnd)
      }
      fetchUser()
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
  border-radius: 16px;
  overflow: hidden;
}

:deep(.el-dialog__header) {
  padding: 24px 32px;
  margin: 0;
  border-bottom: 1px solid var(--el-border-color-light);
  background: linear-gradient(to right, #f8fafc, #f1f5f9);
}

:deep(.el-dialog__title) {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1e293b;
}

:deep(.el-dialog__body) {
  padding: 0;
}

.notepad-content {
  padding: 32px;
  max-height: 70vh;
  overflow-y: auto;
}

.section {
  margin-bottom: 32px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: transform 0.2s ease;
}

.section:hover {
  transform: translateY(-2px);
}

.section h4 {
  font-size: 1.1rem;
  color: #1e293b;
  margin: 0;
  padding: 20px 24px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-content {
  padding: 20px 24px;
  background: #f8fafc;
  border-radius: 0 0 12px 12px;
}

.section-content ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.section-content li {
  padding: 12px 16px;
  margin-bottom: 8px;
  background: white;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
  color: #334155;
  font-size: 0.95rem;
  line-height: 1.5;
  transition: all 0.2s ease;
}

.section-content li:hover {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.empty-section {
  padding: 24px;
  text-align: center;
  color: #64748b;
  font-size: 0.9rem;
  background: white;
  border-radius: 8px;
  border: 1px dashed var(--el-border-color);
}

.notepad-content::-webkit-scrollbar {
  width: 8px;
}

.notepad-content::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 4px;
}

.notepad-content::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}

.notepad-content::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
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

.notepad-dialog {
  .el-dialog__body {
    padding: 20px;
  }
}

.notepad-content {
  max-height: 70vh;
  overflow-y: auto;
}

.section {
  margin-bottom: 2rem;

  &:last-child {
    margin-bottom: 0;
  }

  h4 {
    margin-bottom: 0.75rem;
    color: #303133;
    font-weight: 600;
  }
}

.section-content {
  background: #f5f7fa;
  border-radius: 4px;
  padding: 1rem;
}

.empty-section {
  color: #909399;
  font-style: italic;
  padding: 0.5rem 0;
}

.qa-display {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  position: relative;
}

.question {
  background: #f8fafc;
  border-radius: 12px;
  padding: 1.5rem;
  display: flex;
  gap: 1rem;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.answer {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  display: flex;
  gap: 1rem;
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  font-size: 14px;
}

.avatar.attorney {
  background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
  color: white;
}

/* .avatar.user {
  background: linear-gradient(135deg, #059669 0%, #10b981 100%);
  color: white;
} */

/* Add padding to content to accommodate navigation arrows */
.content {
  padding-top: 2rem;
  padding-bottom: 2rem;
}

.answer-display {
  position: relative;
  padding: 0.5rem;
  min-height: 40px;
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}

.answer-text {
  flex: 1;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
  color: #374151;
}

.edit-button {
  opacity: 0;
  position: absolute;
  right: 0.5rem;
  top: 0.5rem;
  padding: 0.5rem;
  background: transparent;
  border: none;
  cursor: pointer;
  color: #6b7280;
  transition: all 0.2s ease;
  border-radius: 4px;
}

.edit-button:hover {
  background: #f3f4f6;
  color: #4f46e5;
}

.answer-display:hover .edit-button {
  opacity: 1;
}

.answer-edit-mode {
  padding: 0.5rem;
}

.input-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.75rem;
}

.button-group {
  display: flex;
  gap: 0.5rem;
}

.user-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 12px;
}

.avatar.user {
  display: flex;
  align-items: center;
  justify-content: center;
}

:deep(.el-avatar) {
  border: 2px solid rgba(255, 255, 255, 0.6);
  box-sizing: border-box;
}
</style>
