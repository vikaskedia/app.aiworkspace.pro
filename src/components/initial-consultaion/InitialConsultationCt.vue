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
          <div class="avatar attorney">
            <el-avatar 
              :size="40"
              :src="attorneyData?.image_url"
              :icon="!attorneyData?.image_url ? 'UserFilled' : undefined">
            </el-avatar>
          </div>
          <div class="message">
            <template v-if="loading && !currentQuestion">
              <el-skeleton :rows="2" animated />
            </template>
            <template v-else>
              <div v-html="formatText(isViewingHistory ? questionHistory[currentIndex].question : currentQuestion)"></div>
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
                  <el-button 
                    @click="uploadDialogVisible = true"
                    :loading="uploadingFiles"
                    size="small">
                    <el-icon><Upload /></el-icon>
                    Attach Files
                  </el-button>
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
                <div class="answer-text" v-html="formatAnswerText(currentAnswer)"></div>
                <button class="edit-button hover-visible" @click="startEditing">
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
                    <el-button 
                      @click="uploadDialogVisible = true"
                      :loading="uploadingFiles"
                      size="small">
                      <el-icon><Upload /></el-icon>
                      Attach Files
                    </el-button>
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

    <!-- Consultation Complete Dialog |||| SSSSSSRRRRRRRR -->
    <el-dialog
      v-model="isConsultationComplete"
      title="Consultation Complete"
      width="500px">
      <div class="completion-content">
        <p>The initial consultation is complete. Would you like to create a new matter with the following information?</p>
        <div class="summary-section">
          <h4>Summary:</h4>
          <ul>
            <li>Events: {{ notepadData.events.length }}</li>
            <li>Goals: {{ notepadData.goals.length }}</li>
            <li>Tasks: {{ notepadData.tasks.length }}</li>
            <li>Files: {{ filesCount }}</li>
          </ul>
        </div>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="isConsultationComplete = false">Cancel</el-button>
          <el-button
            type="primary"
            :loading="loading"
            @click="handleConsultationComplete">
            Create Workspace
          </el-button>
        </span>
      </template>
    </el-dialog>

    <!-- Upload Dialog -->
    <el-dialog
      v-model="uploadDialogVisible"
      title="Upload Files"
      width="500px">
      <el-upload
        class="upload-area"
        drag
        action="#"
        :auto-upload="false"
        :on-change="(file) => fileList = [...fileList, file]"
        :on-remove="(file) => fileList = fileList.filter(f => f.uid !== file.uid)"
        multiple
        :file-list="fileList">
        <el-icon class="el-icon--upload"><upload-filled /></el-icon>
        <div class="el-upload__text">
          Drop files here or <em>click to upload</em>
        </div>
      </el-upload>

      <template #footer>
        <span class="dialog-footer">
          <el-button @click="uploadDialogVisible = false">Cancel</el-button>
          <el-button
            type="primary"
            @click="handleCurrentAnswer"
            :disabled="!fileList.length"
            :loading="uploadingFiles">
            Upload and Attach
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import HeaderCt from '../HeaderCt.vue'
import { ElMessage } from 'element-plus'
import { Loading, ArrowLeft, Check, ArrowRight, ArrowUp, ArrowDown, Edit, Paperclip, Upload, UploadFilled } from '@element-plus/icons-vue'
import { ElSkeleton } from 'element-plus'
import { supabase } from '../../supabase'
import promptText from './prompt.txt?raw'

const pythonApiBaseUrl = import.meta.env.VITE_PYTHON_API_URL || 'http://localhost:3001'

const USERS_TO_BYPASS_AI_INTERACTION = [
  'soumen+040225@grmtech.com',
  // 'suvankar@grmtech.com'
]
const PREDEFINED_QUESTIONS = [
  {
    firstQuestion: "Dummy Question no 1",
    testScriptAnswer: "Dummy Answer no 1",

    // question: "Dummy Question no 1",
    // answer: "Dummy Answer no 1",
    // analysis: {
    //   events: [],
    //   goals: [],
    //   tasks: [],
    //   possibleOutcome: []
    // }
  },
  {
    events: [],
    files: [],
    goals: [],
    tasks: [],
    interviewQnA: {
      answer: "Dummy Question no 1",
      question: "Dummy Answer no 1",
    },
    nextQuestion: "Dummy Question no 2",
    possibleOutcome: [],
    testScriptAnswer: "Dummy Answer no 2"

    // question: "Dummy Question no 2",
    // answer: "Dummy Answer no 2",
    // analysis: {
    //   events: [],
    //   // files:[],
    //   goals: ["Resolve the contract dispute and recover unpaid invoices"],
    //   tasks: ["Gather detailed information about the contract and unpaid invoices"],
    //   possibleOutcome: ["Successful resolution of the contract dispute and recovery of the unpaid invoices"],
    //   interviewQnA: {
    //     answer: "I'm dealing with a contract dispute with my business partner regarding unpaid invoices.",
    //     question: "Hello Suvankar Roy,\n\nWelcome to AI Associate Attorney!\n\nMy name is Julian, and I am here to assist you with your legal needs. At our firm, we prioritize providing expert and personalized legal services to our clients.\n\nTo better understand how we can help you, could you please provide some details about your legal matter? Rest assured, all information you share with us will be treated with the utmost confidentiality.\n\nLooking forward to hearing from you soon.\n\nBest regards,\nJulian"
    //   }
    // }
  },
  {
    events: [],
    files: [],
    goals: [],
    tasks: [],
    interviewQnA: {
      answer: "Dummy Question no 2",
      question: "Dummy Answer no 2",
    },
    nextQuestion: "Dummy Question no 3",
    possibleOutcome: [],
    testScriptAnswer: "Dummy Answer no 3"
  }, 
  {
    events: [],
    files: [],
    goals: [],
    tasks: [],
    interviewQnA: {
      answer: "Dummy Question no 3",
      question: "Dummy Answer no 3",
    },
    nextQuestion: "Dummy Question no 4",
    possibleOutcome: [],
    testScriptAnswer: "Dummy Answer no 4"
  },
  {
    events: [],
    files: [],
    goals: [],
    tasks: [],
    interviewQnA: {
      answer: "Dummy Question no 4",
      question: "Dummy Answer no 4",
    },
    nextQuestion: "Dummy Question no 5",
    possibleOutcome: [],
    testScriptAnswer: "Dummy Answer no 5"
  },
  {
    events: [],
    files: [],
    goals: [],
    tasks: [],
    interviewQnA: {
      answer: "Dummy Question no 5",
      question: "Dummy Answer no 5",
    },
    nextQuestion: "Dummy Question no 6",
    possibleOutcome: [],
    testScriptAnswer: "Dummy Answer no 6"
  },
  {
    events: [],
    files: [],
    goals: [],
    tasks: [],
    interviewQnA: {
      answer: "Dummy Question no 6",
      question: "Dummy Answer no 6",
    },
    nextQuestion: "Dummy Question no 7",
    possibleOutcome: [],
    testScriptAnswer: "Dummy Answer no 7"
  },
  {
    events: [],
    files: [],
    goals: [],
    tasks: [],
    interviewQnA: {
      answer: "Dummy Question no 7",
      question: "Dummy Answer no 7",
    },
    nextQuestion: "Dummy Question no 8",
    possibleOutcome: [],
    testScriptAnswer: "Dummy Answer no 8"
  },
  {
    events: [],
    files: [],
    goals: [],
    tasks: [],
    interviewQnA: {
      answer: "Dummy Question no 8",
      question: "Dummy Answer no 8",
    },
    nextQuestion: "Dummy Question no 9",
    possibleOutcome: [],
    testScriptAnswer: "Dummy Answer no 9"
  },
  // {
  //   events: [
  //     "[2/6/2025] Accident involving relative in San Francisco, California",
  //     "[2/6/2025] Windshield broke, relative got a cut in hand",
  //     "[2/6/2025] Dog came in front of the car, dog owner jumped to save the dog, relative braked suddenly, car hit a lamppost",
  //     "[2/8/2025] Relative attempted to contact insurance company but received no acknowledgment or response",
  //     "[2/8/2025] Client agreed to seek assistance in contacting the insurance company and follow up on the claim"
  //   ],
  //   files: [],
  //   goals: [
  //     "Help client's relative with legal issues related to the car accident",
  //     "Ensure fair compensation for any injuries or damages",
  //     "Assist with insurance claims and legal proceedings",
  //     "Ensure timely and appropriate medical care for the injuries"
  //   ],
  //   tasks: [
  //     "Gather more details about the accident",
  //     "Gather police report and any other documents related to the accident",
  //     "Seek medical attention for the cut on the hand",
  //     "Document the details of the accident and injuries",
  //     "Seek immediate medical attention for the cut on the hand",
  //     "Report the accident to the police and obtain a police report",
  //     "Follow up with the insurance company to ensure the accident is properly reported"
  //   ],
  //   interviewQnA: {
  //     answer: "Dummy Question no 9",
  //     question: "Dummy Answer no 9",
  //   },
  //   nextQuestion: "Dummy Question no 10",
  //   possibleOutcome: [],
  //   // possibleOutcome: [
  //   //   "Provide legal representation and guidance to client's relative",
  //   //   "Ensure fair compensation for any injuries or damages",
  //   //   "Assist with insurance claims and legal proceedings",
  //   //   "Ensure timely and appropriate medical care for the injuries"
  //   // ],
  //   testScriptAnswer: "Dummy Answer no 10"
  // },
  {
    events: [
      "[2/6/2025] dummy event 1",
      "[2/6/2025] dummy event 2"
    ],
    files: [],
    goals: [
      "dummy goal 1",
      "dummy goal 2"
    ],
    tasks: [
      "dummy task 1",
      "dummy task 2"
    ],
    interviewQnA: {
      answer: "Dummy Question no 9",
      question: "Dummy Answer no 9",
    },
    nextQuestion: "Dummy Question no 10",
    possibleOutcome: [],
    // possibleOutcome: [
    //   "Provide legal representation and guidance to client's relative",
    //   "Ensure fair compensation for any injuries or damages",
    //   "Assist with insurance claims and legal proceedings",
    //   "Ensure timely and appropriate medical care for the injuries"
    // ],
    testScriptAnswer: "Dummy Answer no 10"
  }
];


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
    ElSkeleton,
    Paperclip,
    Upload,
    UploadFilled
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

    const attorneyData = ref(null)

    const filesCount = ref(0)

    const isConsultationComplete = ref(false)

    const attachments = ref([])
    const uploadingFiles = ref(false)

    const uploadDialogVisible = ref(false)
    const fileList = ref([])

    const handleConsultationComplete = async () => { ///// SSSSSSRRRRRRRR actual function creating matter and goals and tasks and events etc.
      console.log('L646: handleConsultationComplete');
      try {
        loading.value = true
        const { data: { user } } = await supabase.auth.getUser()
        const giteaToken = import.meta.env.VITE_GITEA_TOKEN
        const giteaHost = import.meta.env.VITE_GITEA_HOST

        // Generate repo names
        const userRepoName = user.email.replace('@', '-').toLowerCase()
        const matterRepoName = `matter-${Date.now()}`
        const emailStorage = `${Date.now()}@associateattorney.ai`

        // Create matter repository in Gitea first
        await fetch(`${giteaHost}/api/v1/org/associateattorney/repos`, {
          method: 'POST',
          headers: {
            'Authorization': `token ${giteaToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          },
          body: JSON.stringify({
            name: matterRepoName,
            description: `Repository for matter ${matterRepoName}`,
            private: true,
            auto_init: true,
            trust_model: 'collaborator'
          })
        })


        // Create new matter in Supabase
        const { data: matter, error: matterError } = await supabase
          .from('workspaces')
          .insert([{
            title: 'Legal Consultation Workspace',
            description: `Initial consultation conducted on ${new Date().toLocaleDateString()}`,
            created_by: user.id,
            archived: false,
            git_repo: matterRepoName,
            email_storage: emailStorage
          }])
          .select()
          .single()

        if (matterError) throw matterError

        // Helper function for base64 encoding
        const toBase64 = (str) => {
          return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
            function toSolidBytes(match, p1) {
              return String.fromCharCode('0x' + p1)
            }))
        }


        // Check if the user's consultation repo exists
        const repoCheckResponse = await fetch(
          `${giteaHost}/api/v1/repos/associateattorney/${userRepoName}`,
          {
            headers: {
              'Authorization': `token ${giteaToken}`,
              'Accept': 'application/json',
              'Cache-Control': 'no-cache'
            }
          }
        )

        if (repoCheckResponse.ok) {

          // Get files from user's consultation repo
          const filesResponse = await fetch(
            `${giteaHost}/api/v1/repos/associateattorney/${userRepoName}/contents/`,
            {
              headers: {
                'Authorization': `token ${giteaToken}`,
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
              }
            }
          )

          if (filesResponse.ok) {
            const files = await filesResponse.json()
            // Copy each file to the new matter repo
            if(files.length > 0) {
              for (const file of files) {
                if (file.type === 'file') {
                  // Get file content
                const contentResponse = await fetch(file.download_url, {
                  headers: {
                    'Authorization': `token ${giteaToken}`,
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                  }
                })
                const content = await contentResponse.text()
                
                // Safely convert content to base64
                const base64Content = toBase64(content)

                // Upload to new matter repo
                  await fetch(
                    `${giteaHost}/api/v1/repos/associateattorney/${matterRepoName}/contents/initial-consultation/${file.name}`,
                    {
                      method: 'POST',
                      headers: {
                        'Authorization': `token ${giteaToken}`,
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'Cache-Control': 'no-cache'
                      },
                      body: JSON.stringify({
                        message: `Copy consultation file ${file.name}`,
                        content: base64Content,
                        branch: 'main'
                      })
                    }
                  )
                }
              }
            }
          }
        }
        // Create goals from notepadData
        if (notepadData.value.goals.length > 0) {
          const goals = notepadData.value.goals.map(goal => ({
            title: goal,
            matter_id: matter.id,
            created_by: user.id,
            status: 'in_progress',
            priority: 'medium'
          }))
          await supabase.from('goals').insert(goals)
        }

        // Create tasks from notepadData
        if (notepadData.value.tasks.length > 0) {
          const tasks = notepadData.value.tasks.map(task => ({
            title: task,
            matter_id: matter.id,
            created_by: user.id,
            status: 'not_started',
            priority: 'medium'
          }))
          await supabase.from('tasks').insert(tasks)
        }

        // Create events from notepadData
        if (notepadData.value.events.length > 0) {
          const startTime = new Date()
          const endTime = new Date(startTime)
          endTime.setDate(endTime.getDate() + 7)

          const events = notepadData.value.events.map(event => ({
            title: event,
            matter_id: matter.id,
            created_by: user.id,
            start_time: startTime,
            end_time: endTime,
            event_type: 'initial-consultation'
          }))
          await supabase.from('events').insert(events)
        }

        // Save consultation data
        await supabase
          .from('initial_consultation')
          .insert([{
            user_id: user.id,
            matter_id: matter.id,
            json_of_interview_qna: JSON.stringify(questionHistory.value),
            plan_accepted_by_user_json: JSON.stringify({
              goals: notepadData.value.goals,
              tasks: notepadData.value.tasks,
              events: notepadData.value.events
            })
          }])

        ElMessage.success('Workspace created successfully')
        // Redirect to the new matter
        window.location.href = `/single-workspace/${matter.id}/dashboard`

      } catch (error) {
        ElMessage.error('Error creating matter: ' + error.message)
      } finally {
        loading.value = false
      }
    }

    const getSharedMatters = async (userId) => {
      console.log('L837: getSharedMatters');
      try {
        // Get workspaces shared with the user
        const { data: sharedMatters, error } = await supabase
          .from('workspaces')
          .select(`
            *,
           workspace_access!inner (
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
          .eq('archived', false)
          .eq('workspace_access.shared_with_user_id', userId);

        if (error) throw error;

        // Get the latest activity for each matter and sort
        const workspacesWithActivity = await Promise.all(
          (sharedMatters || []).map(async (matter) => {
            const { data: activities } = await supabase
              .from('workspace_activities')
              .select('updated_at')
              .eq('matter_id', matter.id)
              .order('updated_at', { ascending: false })
              .limit(1);

            return {
              ...matter,
              latest_activity: activities?.[0]?.updated_at || matter.created_at
            };
          })
        );

        // Sort by latest activity
        workspacesWithActivity.sort((a, b) => {
          const dateA = new Date(a.latest_activity);
          const dateB = new Date(b.latest_activity);
          return dateB - dateA; // Most recent first
        });

        return workspacesWithActivity;
      } catch (error) {
        console.error('Error fetching shared workspaces:', error);
        return [];
      }
    };

    const loadUserMatters = async () => {
      console.log('L869: loadUserMatters');
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: sharedMatters, error } = await supabase
          .from('workspaces')
          .select(`
            *,
           workspace_access!inner (
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
          .eq('archived', false)
          .eq('workspace_access.shared_with_user_id', user.id);

        if (error) throw error;

        // Get the latest activity for each matter and sort
        const workspacesWithActivity = await Promise.all(
          (sharedMatters || []).map(async (matter) => {
            const { data: activities } = await supabase
              .from('workspace_activities')
              .select('updated_at')
              .eq('matter_id', matter.id)
              .order('updated_at', { ascending: false })
              .limit(1);

            return {
              ...matter,
              latest_activity: activities?.[0]?.updated_at || matter.created_at
            };
          })
        );

        // Sort by latest activity
        workspacesWithActivity.sort((a, b) => {
          const dateA = new Date(a.latest_activity);
          const dateB = new Date(b.latest_activity);
          return dateB - dateA; // Most recent first
        });

        userMatters.value = workspacesWithActivity;
      } catch (error) {
        console.error('Error fetching shared workspaces:', error);
        userMatters.value = [];
      }
    };

    const formatSectionTitle = (key) => {
      console.log('L901: formatSectionTitle');
      return key.split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    }

    const formatDate = (dateStr) => {
      console.log('L908: formatDate');
      if (!dateStr) return '';
      try {
        const date = new Date(dateStr);
        return date.toLocaleDateString();
      } catch (e) {
        return dateStr;
      }
    }

    const sortEvents = (events) => {
      console.log('L919: sortEvents');
      return events.sort((a, b) => {
        const dateA = new Date(a.match(/\[(.*?)\]/)?.[1] || 0);
        const dateB = new Date(b.match(/\[(.*?)\]/)?.[1] || 0);
        return dateA - dateB;
      });
    }

    const updateNotepadData = (newData) => {
      console.log('L928: updateNotepadData');
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
      console.log('L942: notepadData', notepadData.value);//////// SSSSRRRRR 
    }

    const formatQuestionHistory = (history) => {
      console.log('L945: formatQuestionHistory'); 
      if (!history || history.length === 0) return '';
      
      let formattedHistory = '\n\nPrevious Questions and Answers:\n' + 
        history.map(qa => `Q: ${qa.question}\nA: ${qa.answer}`).join('\n\n');

      // Add shared notepad history section
      formattedHistory += '\n\nShared Notepad History:\n';
      
      // Format each section of the notepad
      Object.entries(notepadData.value).forEach(([section, items]) => {
        if (items && items.length > 0) {
          formattedHistory += `\n${formatSectionTitle(section)}:\n`;
          items.forEach(item => {
            formattedHistory += `- ${item}\n`;
          });
        }
      });

      return formattedHistory;
    }

    const preparePrompt = async () => {
      console.log('L968: preparePrompt');
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get system prompt from initial consultant attorney
      const { systemPrompt, attorneyData } = await getInitialConsultantPrompt();
      if (!systemPrompt) {
        throw new Error('No initial consultant system prompt found');
      }

      // Format shared workspaces information
      const sharedMattersInfo = userMatters.value.length > 0 
        ? `\n\nShared Legal Workspaces:\n${userMatters.value.map(matter => `
- Workspace: ${matter.title}
  Description: ${matter.description || 'No description'}
  Tasks:${matter.tasks?.length ? matter.tasks.map(task => `
    • ${task.title} (${task.priority} priority) - ${task.status}`).join('') : '\n    • No tasks yet'}`).join('\n')}`
        : '\n\nShared Legal Workspaces: None';

      // Add user information section with shared workspaces
      const userInfoSection = `Information known about the user:
- Name: ${user.user_metadata?.name || 
         user.user_metadata?.user_name || 
         user.user_metadata?.full_name ||
         user.email?.split('@')[0]}
- Email: ${user.email}
- Phone: ${user.user_metadata?.phone || 'Not provided'}
- Preferred Language: ${user.user_metadata?.preferred_language || 'Not specified'}${sharedMattersInfo}
`;

      const fullPrompt = systemPrompt + '\n\n' + userInfoSection + formatQuestionHistory(questionHistory.value) + 
        '\n\nIMPORTANT: This consultation is limited to a maximum of 10 questions. Please plan your questions accordingly to gather all necessary information within this limit.';
      
      return {
        fullPrompt,
        user,
        attorneyData
      };
    };
    console.log('questionHistory', questionHistory.value);
    console.log('is consultation complete', isConsultationComplete);

    const handleSubmit = async () => {
      console.log('L1010: handleSubmit');
      try {
        loading.value = true
        const { fullPrompt, user } = await preparePrompt()

        if (USERS_TO_BYPASS_AI_INTERACTION.includes(user.email)) {
          // Store current Q&A in history
          questionHistory.value.push({
            question: currentQuestion.value,
            answer: currentAnswer.value
          })

          currentIndex.value = questionHistory.value.length - 1
          
          // Get next predefined question
          if (currentIndex.value < PREDEFINED_QUESTIONS.length - 1) {
            const nextPredefined = PREDEFINED_QUESTIONS[currentIndex.value + 1]
            currentQuestion.value = nextPredefined.nextQuestion || ''
            
            // Update notepad with predefined data
            notepadData.value = {
              events: [...(notepadData.value.events || []), ...(nextPredefined.events || [])],
              files: [...(notepadData.value.files || []), ...(nextPredefined.files || [])],
              goals: [...(notepadData.value.goals || []), ...(nextPredefined.goals || [])],
              tasks: [...(notepadData.value.tasks || []), ...(nextPredefined.tasks || [])],
              possibleOutcome: [...(notepadData.value.possibleOutcome || []), ...(nextPredefined.possibleOutcome || [])]
            }
          }

          currentAnswer.value = ''
          totalQuestions.value = Math.min(questionHistory.value.length + (currentQuestion.value ? 1 : 0), 10)
          isViewingHistory.value = false
          
          await saveConsultationState()
          return
        }

        // Original API call logic for non-bypass users
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
            previousData: notepadData.value,
            isLastQuestion: questionHistory.value.length >= 9 // Signal last question
          })
        })

        if (!response.ok) throw new Error('Failed to process consultation')
        
        const data = await response.json()
        console.log('SR: handleSubmit ==== ', data)
        
        // Update notepad data
        updateNotepadData(data) /////// SSSSRRRRR
        
        // Add to history
        questionHistory.value.push({
          question: currentQuestion.value,
          answer: currentAnswer.value
        })

        console.log('questionHistory', questionHistory.value);

        // Set next question if not complete
        if (questionHistory.value.length < 10) {
          currentQuestion.value = data.nextQuestion
          currentAnswer.value = ''
        } else {
          currentQuestion.value = ''
          ElMessage({
            message: 'Consultation complete! Would you like to create a matter with the collected information?',
            type: 'success',
            duration: 0,
            showClose: true
          })
        }
        
        // Update navigation
        currentIndex.value = questionHistory.value.length
        totalQuestions.value = Math.min(questionHistory.value.length + (data.nextQuestion ? 1 : 0), 10)
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

        if (USERS_TO_BYPASS_AI_INTERACTION.includes(user.email)) {
          // For bypass users, get previous question from predefined set
          if (currentIndex.value > 0) {
            const prevIndex = currentIndex.value - 1;
            currentQuestion.value = PREDEFINED_QUESTIONS[prevIndex]?.interviewQnA?.question || '';
            currentAnswer.value = questionHistory.value[prevIndex]?.answer || '';
            
            // Update notepad with predefined data
            notepadData.value = {
              events: PREDEFINED_QUESTIONS[prevIndex]?.events || [],
              files: PREDEFINED_QUESTIONS[prevIndex]?.files || [],
              goals: PREDEFINED_QUESTIONS[prevIndex]?.goals || [],
              tasks: PREDEFINED_QUESTIONS[prevIndex]?.tasks || [],
              possibleOutcome: PREDEFINED_QUESTIONS[prevIndex]?.possibleOutcome || []
            };
            return;
          }
        }

        // Original API call logic for non-bypass users
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
        currentAnswer.value = data.previousAnswer || '';
        
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
      console.log('L1154: initializeConsultation');
      try {
        loading.value = true;
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          throw new Error('User not authenticated');
        }

        // Get initial consultant data first
        const { systemPrompt, attorneyData: attorney } = await getInitialConsultantPrompt();
        attorneyData.value = attorney; // Set attorney data immediately

        // Generate consultation ID if not exists
        if (!consultationId.value) {
          consultationId.value = crypto.randomUUID();
        }

        // Load existing consultation state if any
        await loadConsultationState();

        // Only fetch first question if we don't have any history
        if (questionHistory.value.length === 0) {
          const { fullPrompt } = await preparePrompt();

          if (USERS_TO_BYPASS_AI_INTERACTION.includes(user.email)) {
            // Use first predefined question for bypass users
            const firstPredefined = PREDEFINED_QUESTIONS[0];
            currentQuestion.value = firstPredefined.firstQuestion || '';
            
            // Initialize notepad data
            notepadData.value = {
              events: firstPredefined.events || [],
              files: firstPredefined.files || [],
              goals: firstPredefined.goals || [],
              tasks: firstPredefined.tasks || [],
              possibleOutcome: firstPredefined.possibleOutcome || []
            };
            return;
          }

          // For non-bypass users, proceed with normal API call
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
                name: attorney?.name || 'Associate Attorney',
                specialization: attorney?.specialization,
                barNumber: attorney?.bar_number,
                firmName: attorney?.firm_name || 'AI Associate Attorney'
              },
              systemPrompt: fullPrompt
            })
          });

          if (!response.ok) throw new Error('Failed to start consultation');
          const data = await response.json();
          console.log('SR: initializeConsultation ==== ', data);
          currentQuestion.value = data.firstQuestion;//////// SSSSRRRRR
          notepadData.value = {
            events: [],
            files: [],
            goals: [],
            tasks: [],
            possibleOutcome: []
          };
          console.log('L1168: notepadData', notepadData.value);//////// SSSSRRRRR 
        }

      } catch (error) {
        ElMessage.error('Error starting consultation: ' + error.message);
      } finally {
        loading.value = false;
      }
    };

    const startEditing = () => {
      console.log('L1235: startEditing');
      isEditing.value = true
    }

    const cancelEdit = () => {
      console.log('L1240: cancelEdit');
      isEditing.value = false
      if (isViewingHistory.value) {
        currentAnswer.value = questionHistory.value[currentIndex.value].answer
      }
    }

    const handleEdit = async () => {
      console.log('L1248: handleEdit');
      try {
        loading.value = true
        const { fullPrompt, user } = await preparePrompt();

        if (USERS_TO_BYPASS_AI_INTERACTION.includes(user.email)) {
          // Update history
          questionHistory.value[currentIndex.value].answer = currentAnswer.value

          // Get predefined data for this question index
          const predefinedData = PREDEFINED_QUESTIONS[currentIndex.value] || {
            events: [],
            files: [],
            goals: [],
            tasks: [],
            possibleOutcome: []
          }

          // Update notepad with predefined data
          notepadData.value = {
            events: [...(notepadData.value.events || []), ...(predefinedData.events || [])],
            files: [...(notepadData.value.files || []), ...(predefinedData.files || [])],
            goals: [...(notepadData.value.goals || []), ...(predefinedData.goals || [])],
            tasks: [...(notepadData.value.tasks || []), ...(predefinedData.tasks || [])],
            possibleOutcome: [...(notepadData.value.possibleOutcome || []), ...(predefinedData.possibleOutcome || [])]
          }

          if (currentIndex.value < questionHistory.value.length - 1) {
            questionHistory.value = questionHistory.value.slice(0, currentIndex.value + 1)
            totalQuestions.value = questionHistory.value.length + 1
            currentQuestion.value = PREDEFINED_QUESTIONS[currentIndex.value + 1]?.nextQuestion || ''
          }

          isEditing.value = false
          await saveConsultationState()
          return
        }

        // Original API call logic for non-bypass users
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
        console.log('SR: handleEdit ==== ', data);
        
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
      console.log('L1337: navigateTo');
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
      console.log('L1350: handleCurrentAnswer');
      if (!currentAnswer.value.trim() && !fileList.value.length) return

      try {
        loading.value = true
        
        // Upload any attachments first
        const uploadedFiles = await uploadAttachments()
        
        // Add file links to the answer if files were uploaded
        let finalAnswer = currentAnswer.value
        if (uploadedFiles?.length) {
          const fileLinks = uploadedFiles.map(file => 
            `[${file.name}](${file.url}){:target="_blank"}`
          ).join('<br>')
          finalAnswer += '<div class="file-attachments">Attached files:<br>' + fileLinks + '</div>'
        }

        // Update the current answer with file links
        currentAnswer.value = finalAnswer

        if (isViewingHistory.value) {
          await handleEdit()
        } else {
          await handleSubmit()
        }
        
      } catch (error) {
        ElMessage.error('Error processing answer: ' + error.message)
      } finally {
        loading.value = false
      }
    }

    let touchStartY = 0
    let touchEndY = 0

    const handleTouchStart = (event) => {
      console.log('L1388: handleTouchStart');
      touchStartY = event.touches[0].clientY
    }

    const handleTouchEnd = (event) => {
      console.log('L1393: handleTouchEnd');
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
      console.log('L1410: saveConsultationState');
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
      console.log('L1442: loadConsultationState');
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
          currentIndex.value = questionHistory.value.length

          // For bypass users, get next question from predefined set
          if (USERS_TO_BYPASS_AI_INTERACTION.includes(user.email)) {
            currentQuestion.value = PREDEFINED_QUESTIONS[currentIndex.value]?.nextQuestion || ''
          } else {
            currentQuestion.value = interviewData.currentQuestion
          }

          // Restore notepad data
          if (consultation.plan_accepted_by_user_json) {
            notepadData.value = consultation.plan_accepted_by_user_json
          }

          totalQuestions.value = questionHistory.value.length + (currentQuestion.value ? 1 : 0)
        } else {
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
      console.log('L1491: fetchUser');
      try {
        const { data: { user: userData } } = await supabase.auth.getUser()
        user.value = userData
      } catch (error) {
        console.error('Error fetching user:', error)
      }
    }

    const getInitialConsultantPrompt = async () => {
      console.log('L1501: getInitialConsultantPrompt');
      try {
        const { data: attorney, error } = await supabase
          .from('attorneys')
          .select('*')
          .eq('is_initial_consultant', true)
          .single();

        //console.log('attorney', attorney);
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

    const formatText = (text) => {
      if (!text) return '';
      return text.split('\n').map(line => line.trim()).join('<br>');
    }

    const handleFileChange = (file) => {
      attachments.value = [file]
    }

    const handleFileSelect = (files) => {
      fileList.value = files
    }

    const uploadAttachments = async () => {
      if (!fileList.value.length) return null

      try {
        uploadingFiles.value = true
        const { data: { user } } = await supabase.auth.getUser()
        const giteaToken = import.meta.env.VITE_GITEA_TOKEN
        const giteaHost = import.meta.env.VITE_GITEA_HOST
        
        // Create repo name from user's email
        const repoName = user.email.replace('@', '-').toLowerCase()
        
        // Try to create the repository, if it fails with 409 (already exists), that's fine
        await fetch(
          `${giteaHost}/api/v1/org/associateattorney/repos`,
          {
            method: 'POST',
            headers: {
              'Authorization': `token ${giteaToken}`,
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache'
            },
            body: JSON.stringify({
              name: repoName,
              description: `Repository for ${user.email}`,
              private: true,
              auto_init: true,
              trust_model: 'collaborator'
            })
          }
        ).catch(error => {
          // Ignore 409 errors (repo already exists)
          if (!error.message.includes('409')) {
            throw error
          }
        })

        const timestamp = Date.now()
        const uploadedFiles = []

        // Upload files sequentially instead of in parallel
        for (const fileInfo of fileList.value) {
          try {
            const file = fileInfo.raw
            const timestampedFileName = `${timestamp}-${file.name}`
            
            const base64Content = await new Promise((resolve) => {
              const reader = new FileReader()
              reader.onloadend = () => {
                const base64 = reader.result.split(',')[1]
                resolve(base64)
              }
              reader.readAsDataURL(file)
            })

            // Upload to the repository (whether it was just created or already existed)
            const response = await fetch(
              `${giteaHost}/api/v1/repos/associateattorney/${repoName}/contents/${timestampedFileName}`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `token ${giteaToken}`,
                  'Accept': 'application/json',
                  'Content-Type': 'application/json',
                  'Cache-Control': 'no-cache'
                },
                body: JSON.stringify({
                  message: `Upload consultation attachment ${timestampedFileName}`,
                  content: base64Content,
                  branch: 'main'
                })
              }
            )

            if (!response.ok) {
              throw new Error(`Failed to upload file ${file.name}`)
            }
            
            const data = await response.json()
            uploadedFiles.push({
              name: file.name,
              url: data.content.download_url
            })
          } catch (error) {
            ElMessage.warning(`Failed to upload ${fileInfo.raw.name}: ${error.message}`)
            // Continue with next file instead of stopping completely
            continue
          }
        }

        if (uploadedFiles.length === 0) {
          throw new Error('No files were uploaded successfully')
        }

        return uploadedFiles

      } catch (error) {
        ElMessage.error('Error uploading attachments: ' + error.message)
        return null
      } finally {
        uploadingFiles.value = false
        fileList.value = []
        uploadDialogVisible.value = false
      }
    }

    // Update the formatAnswerText method to preserve the div structure
    const formatAnswerText = (text) => {
      console.log('L1647: formatAnswerText');
      if (!text) return ''
      
      // Replace markdown links with HTML links while preserving div structure
      let formattedText = text.replace(
        /\[([^\]]+)\]\(([^)]+)\)(?:{:target="_blank"})?/g, 
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
      )
      
      // Ensure the div structure is preserved
      if (formattedText.includes('class="file-attachments"')) {
        return formattedText
      }
      
      return formattedText
    }

    const getRepoFilesCount = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        const giteaToken = import.meta.env.VITE_GITEA_TOKEN
        const giteaHost = import.meta.env.VITE_GITEA_HOST
        const userRepoName = user.email.replace('@', '-').toLowerCase()

        const filesResponse = await fetch(
          `${giteaHost}/api/v1/repos/associateattorney/${userRepoName}/contents/`,
          {
            headers: {
              'Authorization': `token ${giteaToken}`,
              'Accept': 'application/json',
              'Cache-Control': 'no-cache'
            }
          }
        )

        if (!filesResponse.ok) return 0
        const files = await filesResponse.json()
        return files.filter(file => file.type === 'file').length
      } catch (error) {
        console.error('Error getting files count:', error)
        return 0
      }
    }

    const checkConsultationComplete = async () => {
      console.log('L1692: checkConsultationComplete');
      const { data: { user } } = await supabase.auth.getUser()

      // For bypass users, check predefined questions length
      if (USERS_TO_BYPASS_AI_INTERACTION.includes(user.email) && 
          currentIndex.value >= PREDEFINED_QUESTIONS.length) {
        filesCount.value = await getRepoFilesCount()
        isConsultationComplete.value = true
        return
      }

      // Original logic remains unchanged
      if (questionHistory.value.length >= 10 && 
          questionHistory.value.every(qa => qa.answer && qa.answer.trim())) {
        filesCount.value = await getRepoFilesCount()
        isConsultationComplete.value = true
      } else {
        isConsultationComplete.value = false
      }
    }

    watch(questionHistory, () => {
      checkConsultationComplete()
    }, { deep: true })

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
      dialogWidth,
      formatText,
      attorneyData,
      isConsultationComplete,
      handleConsultationComplete,
      attachments,
      uploadingFiles,
      handleFileChange,
      uploadAttachments,
      formatAnswerText,
      uploadDialogVisible,
      fileList,
      handleFileSelect,
      getRepoFilesCount,
      filesCount
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
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 10px;
}

.avatar.attorney :deep(.el-avatar) {
  background-color: #626aef;
  color: white;
}

/* .avatar.user {
  background-color: #10b981;
  color: white;
} */

.message {
  padding: 0.5rem;
  line-height: 1.5;
  flex: 1;
  white-space: pre-line;
}

.message :deep(br) {
  margin-bottom: 0.5em;
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

.answer-display {
  position: relative;
  padding: 8px;
}

.answer-display:hover .hover-visible {
  opacity: 1;
}

.hover-visible {
  opacity: 0;
  transition: opacity 0.2s ease;
}

.edit-button {
  position: absolute;
  top: 8px;
  right: 8px;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  color: #909399;
}

.edit-button:hover {
  background-color: #f5f7fa;
  color: var(--el-color-primary);
}

.completion-content {
  padding: 20px 0;
}

.summary-section {
  margin-top: 20px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
}

.summary-section h4 {
  margin: 0 0 10px 0;
  color: #606266;
}

.summary-section ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.summary-section li {
  margin: 5px 0;
  color: #606266;
}

.upload-inline {
  display: inline-block;
  margin-right: 10px;
}

.upload-inline :deep(.el-upload-list) {
  position: relative;
  left: 0;
  background: white;
  padding: 8px;
  border-radius: 4px;
  box-shadow: 0 2px 12px 0 rgba(0,0,0,0.1);
  display: none; /* Hide by default */
}

.upload-inline :deep(.el-upload-list:not(:empty)) {
  display: block; /* Show only when there are items */
}

.answer-text :deep(a) {
  color: var(--el-color-primary);
  text-decoration: none;
}

.answer-text :deep(a:hover) {
  text-decoration: underline;
}

.upload-area {
  width: 100%;
}

:deep(.el-upload-dragger) {
  width: 100%;
  height: 200px;
}

:deep(.el-upload__text) {
  margin-top: 16px;
}

:deep(.el-icon--upload) {
  font-size: 48px;
  margin-bottom: 8px;
}
</style>
