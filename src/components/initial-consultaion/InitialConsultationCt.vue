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
          <div class="avatar attorney">AI</div>
          <div class="message">
            {{ isViewingHistory ? questionHistory[currentIndex].question : currentQuestion }}
          </div>
        </div>
        
        <div class="answer">
          <div class="avatar user">U</div>
          <div class="message-container">
            <el-input
              v-model="currentAnswer"
              type="textarea"
              :rows="3"
              placeholder="Type your answer here..."
              :disabled="loading"
              @keyup.enter.ctrl="handleCurrentAnswer"
            />
            <div class="input-actions">
              <span class="hint">Press Ctrl + Enter to send</span>
              <div class="button-group">
                <el-button 
                  v-if="isViewingHistory"
                  @click="cancelEdit">
                  Cancel
                </el-button>
                <el-button 
                  type="primary" 
                  @click="handleCurrentAnswer"
                  :loading="loading"
                  :disabled="!currentAnswer.trim()">
                  {{ isViewingHistory ? 'Save & Regenerate' : 'Send' }}
                </el-button>
              </div>
            </div>
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
      @click="showNotepad = true"
      icon="Notebook">
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
import { Loading, ArrowLeft, Check, Notebook, ArrowRight, ArrowUp, ArrowDown } from '@element-plus/icons-vue'
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
    Notebook,
    ArrowRight,
    ArrowUp,
    ArrowDown
  },

  setup() {
    const consultationId = ref(null)
    
    const currentQuestion = ref('What legal matter brings you here today?')
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

    const handleSubmit = async () => {
      try {
        loading.value = true;
        const { data: { user } } = await supabase.auth.getUser();

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
            systemPrompt: promptText,
            previousData: notepadData.value // Send existing data for context
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

        const response = await fetch(`${pythonApiBaseUrl}/gpt/start_consultation`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.id,
            consultationId: consultationId.value
          })
        });

        if (!response.ok) throw new Error('Failed to start consultation');
        
        const data = await response.json();
        currentQuestion.value = data.firstQuestion;

      } catch (error) {
        ElMessage.error('Error starting consultation: ' + error.message);
      } finally {
        loading.value = false;
      }
    };

    const startEditing = () => {
      editedAnswer.value = questionHistory.value[currentIndex.value].answer
      isEditing.value = true
    }

    const cancelEdit = () => {
      isViewingHistory.value = false
      currentAnswer.value = ''
      currentIndex.value = questionHistory.value.length - 1
    }

    const handleEdit = async () => {
      try {
        loading.value = true
        const { data: { user } } = await supabase.auth.getUser()

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
            systemPrompt: promptText,
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

    onMounted(async () => {
      await initializeConsultation();
      const qaDisplay = document.querySelector('.qa-display')
      if (qaDisplay) {
        qaDisplay.addEventListener('touchstart', handleTouchStart)
        qaDisplay.addEventListener('touchend', handleTouchEnd)
      }
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
      handleTouchEnd
    }
  }
}
</script>

<style scoped>
.consultation-container {
  min-height: 100vh;
  background-color: #f5f7fa;
}

.content {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
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
}

.avatar.user {
  background-color: #10b981;
  color: white;
}

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
  z-index: 100;
}

.notepad-content {
  padding: 1rem;
}

.section {
  margin-bottom: 2rem;
}

.section h4 {
  margin-bottom: 0.5rem;
  color: #303133;
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

.loading-container {
  text-align: center;
  padding: 2rem;
  color: #909399;
}

.navigation-controls {
  display: none;
}

.navigation-arrow {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0.5rem;
  cursor: pointer;
  color: #626aef;
  transition: all 0.2s ease;
}

.navigation-arrow.disabled {
  color: #c0c4cc;
  cursor: not-allowed;
}

.navigation-arrow:not(.disabled):hover {
  color: #4318ff;
  transform: scale(1.1);
}

.navigation-arrow.up {
  margin-bottom: 0.5rem;
}

.navigation-arrow.down {
  margin-top: 0.5rem;
}

.question-counter {
  text-align: center;
  color: #606266;
  font-size: 0.9rem;
  margin-top: 0.5rem;
}

@media (max-width: 640px) {
  .qa-display {
    position: relative;
    touch-action: none;
  }

  .navigation-arrow {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(255, 255, 255, 0.9);
    border-radius: 50%;
    width: 40px;
    height: 40px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  .navigation-arrow.up {
    top: -20px;
  }

  .navigation-arrow.down {
    bottom: -20px;
  }

  .navigation-arrow:not(.disabled):hover {
    transform: translateX(-50%);
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
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1rem;

  ul {
    list-style-type: none;
    padding: 0;
    margin: 0;

    li {
      padding: 0.5rem 0;
      border-bottom: 1px solid rgba(0,0,0,0.05);

      &:last-child {
        border-bottom: none;
      }
    }
  }
}

.empty-section {
  color: #909399;
  font-style: italic;
  padding: 0.5rem 0;
}
</style>
