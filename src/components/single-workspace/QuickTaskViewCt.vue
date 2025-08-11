<script>
import { supabase } from '../../supabase';
import { ElMessage } from 'element-plus';
import { FullScreen, Close, Folder, Document, Edit, Star, StarFilled, ArrowDown, Remove } from '@element-plus/icons-vue';
import { ref } from 'vue';
import EditableTable from './EditableTable.vue'
import RichTextEditor from '../common/RichTextEditor.vue';
import TiptapEditor from '../common/TiptapEditor.vue';
import { updateWorkspaceActivity } from '../../utils/workspaceActivity';

export default {
  components: {
    FullScreen,
    Close,
    Folder,
    EditableTable,
    RichTextEditor,
    TiptapEditor,
    Document,
    Edit,
    Star,
    StarFilled,
    ArrowDown,
    Remove
  },
  props: {
    task: {
      type: Object,
      required: true
    },
    visible: {
      type: Boolean,
      required: true
    }
  },
  emits: ['update:visible', 'update:task', 'status-updated', 'priority-updated', 'due-date-updated', 'assignee-updated', 'task-updated'],
  data() {
    return {
      comments: [],
      newComment: '',
      loading: false,
      assigneeEmail: '',
      statusValue: '',
      priorityValue: '',
      dueDateValue: null,
      subscription: null,
      files: [],
      folders: [],
      showFileSelector: false,
      mentionIndex: -1,
      fileSearchQuery: '',
      editingCommentId: null,
      editingCommentText: '',
      currentUser: null,
      expandedCommentHistories: new Set(),
      currentSelectorFolder: null,
      selectorBreadcrumbs: [],
      showAIDialog: false,
      aiPrompt: '',
      aiLoading: false,
      pythonApiBaseUrl: import.meta.env.VITE_PYTHON_API_URL  || 'http://localhost:3001',
      showTypeahead: false,
      typeaheadSuggestions: [],
      typeaheadSelectedIndex: -1,
      typeaheadTimer: null,
      tableContent: '',
      tableInsertPosition: null,
      showUserMentions: false,
      userSuggestions: [],
      sharedUsers: [],
      selectedUserIndex: -1,
      isDescriptionExpanded: false,
      isCommentBoxExpanded: false,
      isEditingTitle: false,
      editingTitle: '',
      localTask: null,
      tempDueDate: null,
      isEditingDescription: false,
      editingDescription: '',
      userEmails: {},
      currentWorkspace: null,
    };
  },
  computed: {
    filteredFiles() {
      const items = [...this.folders, ...this.files];
      if (!this.fileSearchQuery) return items;
      const query = this.fileSearchQuery.toLowerCase();
      return items.filter(item => 
        item.name.toLowerCase().includes(query)
      );
    },
    drawerSize() {
      // Get viewport width
      const width = window.innerWidth;
      if (width <= 480) {
        return '100%';
      } else if (width <= 768) {
        return '75%';
      } else if (width <= 1024) {
        return '50%';
      } else {
        return '35%';
      }
    },
    isTaskStarred() {
      return this.task?.task_stars?.some(star => star.user_id === this.currentUser?.id) || false;
    }
  },
  watch: {
    visible: {
      async handler(newVal) {
        if (newVal && this.task) {
          try {
            // Load latest task data
            const { data: taskData, error } = await supabase
              .from('tasks')
              .select('*')
              .eq('id', this.task.id)
              .single();

            if (error) throw error;
            // Update local task data
            this.$emit('update:task', { ...this.task, ...taskData });

            // Fetch assignee email
            if (taskData.assignee) {
              const { data: userData, error: userError } = await supabase
                .rpc('get_user_info_by_id', {
                  user_id: taskData.assignee
                });
              if (!userError && userData?.[0]) {
                this.assigneeEmail = userData[0].email;
              } else {
                this.assigneeEmail = '';
              }
            } else {
              this.assigneeEmail = '';
            }

            // Set local status, priority, due date
            this.statusValue = taskData.status || '';
            this.priorityValue = taskData.priority || '';
            this.dueDateValue = taskData.due_date || null;

            // Load comments and setup realtime subscription
            await this.loadComments();
            this.setupRealtimeSubscription();
          } catch (error) {
            console.error('Error loading task data:', error);
            ElMessage.error('Error loading task data');
          }
        } else {
          // Drawer closed: clear all local variables
          this.assigneeEmail = '';
          this.statusValue = '';
          this.priorityValue = '';
          this.dueDateValue = null;
          if (this.subscription) {
            this.subscription.unsubscribe();
          }
        }
      },
      immediate: true
    },
    task: {
      handler(newTask) {
        if (newTask && this.visible) {
          this.loadComments();
          this.setupRealtimeSubscription();
        }
      },
      immediate: true
    }
  },
  methods: {

    formatCommentContent(text) {
      if (!text) return '';
      
      const giteaHost = import.meta.env.VITE_GITEA_HOST;
      const giteaToken = import.meta.env.VITE_GITEA_TOKEN;
      
      // Replace markdown file links with authenticated file links
      return text.split('\n').map(line => line.trim()).join('<br>').replace(
        /\[([^\]]+)\]\(([^)]+)\)/g, 
        (match, fileName, fileUrl) => {
          let authenticatedUrl = fileUrl;
          
          // Only modify URLs that match the Gitea host
          if (fileUrl.startsWith(giteaHost)) {
            try {
              const url = new URL(fileUrl);
              
              // Remove any existing token parameter
              url.searchParams.delete('token');
              
              // Add token as a single query parameter
              url.searchParams.set('token', giteaToken);
              
              // Add cache busting parameter
              url.searchParams.set('t', Date.now().toString());
              
              // Remove any duplicate question marks that might have been added
              authenticatedUrl = url.toString().replace('??', '?');
            } catch (error) {
              console.error('Error creating authenticated URL:', error);
            }
          }

          return `<a class="file-link" href="${authenticatedUrl}" target="_blank" title="Click to view file">
            ${fileName}
          </a>`;
        }
      );
    },
    async loadComments() {
      try {
        this.loading = true;
        const { data: comments, error } = await supabase
          .from('task_comments')
          .select('*')
          .eq('task_id', this.task.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Load user emails for each comment
        for (const comment of comments) {
          if (comment.user_id && !this.userEmails[comment.user_id]) {
            const { data: userData } = await supabase
              .rpc('get_user_info_by_id', {
                user_id: comment.user_id
              });
            if (userData?.[0]) {
              this.userEmails[comment.user_id] = userData[0].email;
            }
          }
        }

        this.comments = comments;
      } catch (error) {
        ElMessage.error('Error loading comments: ' + error.message);
      } finally {
        this.loading = false;
      }
    },

    async addComment() {
      if (!this.newComment.trim()) return;

      try {
        this.loading = true;
        const { data: { user } } = await supabase.auth.getUser();

        // First post the user's comment
        const { data, error } = await supabase
          .from('task_comments')
          .insert({
            task_id: this.task.id,
            user_id: user.id,
            content: this.newComment.trim(),
            workspace_id: this.task.workspace_id
          })
          .select();

        if (error) throw error;

        // Handle AI Attorney mentions
        const aiMentionRegex = /<span data-mention[^>]*data-id="([^"]+)"[^>]*>@([^<]+)<\/span>/g;
        const mentions = [...this.newComment.matchAll(aiMentionRegex)];

        for (const mention of mentions) {
          const mentionId = mention[1];
          const mentionName = mention[2];
          
          if (mentionId === 'aiAttorney') {
            // Handle default AI Attorney
            const prompt = this.newComment.replace(mention[0], '').trim();
            const aiResponse = await this.getAIResponse(prompt);
            await this.postAIResponse(aiResponse);
          } else if (!mentionId.includes('-')) { // Check if it's a UUID (user) or number (AI attorney)
            // Handle specific AI Attorney
            try {
              const { data: attorney } = await supabase
                .from('attorneys')
                .select('system_prompt')
                .eq('id', mentionId)
                .single();

              if (attorney) {
                const prompt = this.newComment.replace(mention[0], '').trim();
                const aiResponse = await this.getAIResponse(prompt, attorney.system_prompt);
                await this.postAIResponse(aiResponse, mentionName);
              }
            } catch (error) {
              console.error('Error getting attorney:', error);
            }
          } else {
            // Handle user mentions
            await this.createNotification(
              mentionId,
              'mention',
              { 
                task_id: this.task.id, 
                task_title: this.task.title,
                comment_by: user.email
              }
            );
          }
        }

        // Update workspace activity
        await updateWorkspaceActivity(this.task.workspace_id);

        this.newComment = '';
        await this.loadComments();
        ElMessage.success('Comment added successfully');
      } catch (error) {
        ElMessage.error('Error adding comment: ' + error.message);
      } finally {
        this.loading = false;
      }
    },

    async postAIResponse(response, attorneyName = null) {
      try {
        const { error } = await supabase
          .from('task_comments')
          .insert({
            task_id: this.task.id,
            user_id: null,
            content: response,
            type: 'ai_response',
            workspace_id: this.task.workspace_id,
            metadata: {
              is_ai: true,
              ai_name: attorneyName || 'AI Attorney'
            }
          });

        if (error) throw error;
      } catch (error) {
        console.error('Error posting AI response:', error);
        ElMessage.error('Error posting AI response');
      }
    },

    async getAIResponse(prompt, customSystemPrompt = null) {
      try {
        const commentsHistory = this.comments.map(comment => {
          const timestamp = comment.updated_at || comment.created_at;
          const formattedDate = new Date(timestamp).toLocaleString();
          return `[${formattedDate}] ${this.assigneeEmail}: ${comment.content}`;
        }).join('\n\n');

        const taskContext = `Task Title: "${this.task.title}"
        ${this.task.description ? `\nTask Description: ${this.task.description}` : ''}`;

        const systemPrompt = customSystemPrompt || `You are an AI legal assistant helping with the following task:`;

        const response = await fetch(`${this.pythonApiBaseUrl}/gpt/get_ai_response`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt,
            systemPrompt: systemPrompt + `\n\n${taskContext}` + `\n\nComment History:\n${commentsHistory}`,
            taskId: this.task.id,
            workspaceId: this.task.workspace_id
          })
        });

        if (!response.ok) {
          throw new Error('Failed to get AI response');
        }

        const data = await response.json();
        return data.response;
      } catch (error) {
        console.error('Error getting AI response:', error);
        return 'Sorry, I encountered an error while processing your request.';
      }
    },

    setupRealtimeSubscription() {
      if (this.subscription) {
        this.subscription.unsubscribe();
      }
      
      this.subscription = supabase
        .channel('task-comments-changes')
        .on('postgres_changes', 
          { 
            event: '*',
            schema: 'public',
            table: 'task_comments',
            filter: `task_id=eq.${this.task.id}`
          },
          async (payload) => {
            switch (payload.eventType) {
              case 'INSERT':
                // Load user email for new comment if not already cached
                if (payload.new.user_id && !this.userEmails[payload.new.user_id]) {
                  const { data: userData } = await supabase
                    .rpc('get_user_info_by_id', {
                      user_id: payload.new.user_id
                    });
                  if (userData?.[0]) {
                    this.userEmails[payload.new.user_id] = userData[0].email;
                  }
                }
                // Add new comment to the beginning of the list
                this.comments.unshift(payload.new);
                break;
              
              case 'UPDATE':
                const updateIndex = this.comments.findIndex(comment => comment.id === payload.new.id);
                if (updateIndex !== -1) {
                  this.comments[updateIndex] = payload.new;
                }
                break;
              
              case 'DELETE':
                const deleteIndex = this.comments.findIndex(comment => comment.id === payload.old.id);
                if (deleteIndex !== -1) {
                  this.comments.splice(deleteIndex, 1);
                }
                break;
            }
          }
        )
        .subscribe();
    },

    async loadFiles() {
      try {
        const giteaToken = import.meta.env.VITE_GITEA_TOKEN;
        const giteaHost = import.meta.env.VITE_GITEA_HOST;
        
        // First get the workspace's git repo
        const { data: workspace, error: workspaceError } = await supabase
          .from('workspaces')
          .select('git_repo')
          .eq('id', this.task.workspace_id)
          .single();

        if (workspaceError) {
          throw new Error('Failed to fetch workspace details');
        }

        if (!workspace?.git_repo) {
          throw new Error('No git repository found for this workspace');
        }

        const path = this.currentSelectorFolder?.path || '';
        const response = await fetch(
          `${giteaHost}/api/v1/repos/associateattorney/${workspace.git_repo}/contents/${path}`,
          {
            headers: {
              'Authorization': `token ${giteaToken}`,
              'Accept': 'application/json',
              'Authorization': `token ${giteaToken}`,
              'Accept': 'application/json',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache'
            }
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch files');
        }

        const contents = await response.json();
        
        // Separate files and folders
        this.folders = contents
          .filter(item => item.type === 'dir')
          .map(folder => ({
            id: folder.sha,
            name: folder.name,
            path: folder.path,
            type: 'dir'
          }));

        this.files = contents
          .filter(item => item.type === 'file' && item.name !== '.gitkeep')
          .map(file => ({
            id: file.sha,
            name: file.name,
            path: file.path,
            type: 'file',
            download_url: file.download_url
          }));

      } catch (error) {
        ElMessage.error('Error loading files: ' + error.message);
        this.files = [];
        this.folders = [];
      }
    },

    handleInput(event) {
      const text = event.target.value;
      const cursorPos = event.target.selectionStart;
      
      // Get the current word being typed
      const textBeforeCursor = text.slice(0, cursorPos);
      const currentWordMatch = textBeforeCursor.match(/\S+$/);
      const currentWord = currentWordMatch ? currentWordMatch[0] : '';

      if (currentWord.length >= 2) {
        // Clear any existing timer
        if (this.typeaheadTimer) {
          clearTimeout(this.typeaheadTimer);
        }
        
        // Set a new timer to avoid too many API calls
        this.typeaheadTimer = setTimeout(() => {
          this.getTypeaheadSuggestions(text, cursorPos);
        }, 300);
      } else {
        this.showTypeahead = false;
      }
    },

    selectFile(file) {
      const beforeMention = this.newComment.slice(0, this.mentionIndex - 6); // Remove '@files'
      const afterMention = this.newComment.slice(this.mentionIndex);
      this.newComment = `${beforeMention}[${file.name}](${file.download_url})${afterMention}`;
      this.showFileSelector = false;
      this.fileSearchQuery = '';
    },

    formatMarkdownLinks(text) {
      if (!text) return '';
      
      const giteaHost = import.meta.env.VITE_GITEA_HOST;
      const giteaToken = import.meta.env.VITE_GITEA_TOKEN;
      
      // First handle user mentions with el-tag
      text = text.replace(/@\[([^\]]+)\]\(([^)]+)\)/g, 
        '<el-tag size="small" type="info" class="mention-tag">@$1</el-tag>'
      );
      
      // Then handle regular markdown links with authentication for Gitea URLs
      text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, 
        (match, fileName, fileUrl) => {
          let authenticatedUrl = fileUrl;
          
          // Only modify URLs that match the Gitea host
          if (fileUrl.startsWith(giteaHost)) {
            try {
              const url = new URL(fileUrl);
              
              // Remove any existing token parameter
              url.searchParams.delete('token');
              
              // Add token as a single query parameter
              url.searchParams.set('token', giteaToken);
              
              // Add cache busting parameter
              url.searchParams.set('t', Date.now().toString());
              
              // Remove any duplicate question marks
              authenticatedUrl = url.toString().replace('??', '?');
            } catch (error) {
              console.error('Error creating authenticated URL:', error);
            }
          }

          return `<a href="${authenticatedUrl}" target="_blank" class="file-link">${fileName}</a>`;
        }
      );
      
      return text;
    },

    formatTables(text) {
      // Split text into lines
      const lines = text.split('\n');
      let inTable = false;
      let tableHTML = '';
      let result = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Check if line is part of a table
        if (line.trim().startsWith('|')) {
          if (!inTable) {
            inTable = true;
            tableHTML = '<div class="markdown-table-wrapper"><table class="markdown-table">';
          }
          
          // Convert the line to table row
          const cells = line.split('|').filter(cell => cell.trim() !== '');
          const isHeader = line.includes('---');
          
          if (!isHeader) {
            tableHTML += '<tr>';
            cells.forEach(cell => {
              // First row should be header unless it contains dashes
              const tag = !tableHTML.includes('<tr>') && !lines[i + 1]?.includes('---') ? 'th' : 'td';
              tableHTML += `<${tag}>${cell.trim()}</${tag}>`;
            });
            tableHTML += '</tr>';
          }
        } else if (inTable) {
          inTable = false;
          tableHTML += '</table></div>';
          result.push(tableHTML);
          result.push(line);
        } else {
          result.push(line);
        }
      }
      
      // Close any open table at the end of text
      if (inTable) {
        tableHTML += '</table></div>';
        result.push(tableHTML);
      }
      
      return result.join('\n');
    },

    startEditing(comment) {
      // Don't allow editing of activity type comments
      if (comment.type === 'activity') {
        ElMessage.warning('System-generated activity comments cannot be edited');
        return;
      }

      // Only allow editing of own comments
      if (comment.user_id !== this.currentUser?.id) {
        ElMessage.warning('You can only edit your own comments');
        return;
      }
      
      this.editingCommentId = comment.id;
      this.editingCommentText = comment.content;
    },

    async saveEdit(comment) {
      try {
        this.loading = true;
        const { data: { user } } = await supabase.auth.getUser();

        // Prepare edit history entry
        const historyEntry = {
          previous_content: comment.content,
          edited_at: new Date().toISOString(),
          edited_by: user.id
        };

        // Update comment with new content and history
        const { error } = await supabase
          .from('task_comments')
          .update({
            content: this.editingCommentText.trim(),
            comment_edit_history: comment.comment_edit_history 
              ? [...comment.comment_edit_history, historyEntry]
              : [historyEntry],
            updated_at: new Date().toISOString()
          })
          .eq('id', comment.id);

        if (error) throw error;

        this.editingCommentId = null;
        this.editingCommentText = '';
        await this.loadComments();
        ElMessage.success('Comment updated successfully');
      } catch (error) {
        ElMessage.error('Error updating comment: ' + error.message);
      } finally {
        this.loading = false;
      }
    },

    cancelEdit() {
      this.editingCommentId = null;
      this.editingCommentText = '';
    },

    toggleHistory(commentId) {
      if (this.expandedCommentHistories.has(commentId)) {
        this.expandedCommentHistories.delete(commentId);
      } else {
        this.expandedCommentHistories.add(commentId);
      }
    },

    async navigateSelectorFolder(folder) {
      try {
        if (!folder) {
          // Reset to root
          this.currentSelectorFolder = null;
          this.selectorBreadcrumbs = [];
        } else {
          // Find if folder exists in current breadcrumbs
          const existingIndex = this.selectorBreadcrumbs.findIndex(f => f.id === folder.id);
          
          if (existingIndex >= 0) {
            // Clicking a folder in breadcrumbs - truncate to that point
            this.selectorBreadcrumbs = this.selectorBreadcrumbs.slice(0, existingIndex + 1);
          } else {
            // New folder - add to breadcrumbs
            this.selectorBreadcrumbs.push(folder);
          }
          this.currentSelectorFolder = folder;
        }

        await this.loadFiles();
      } catch (error) {
        ElMessage.error('Error navigating to folder: ' + error.message);
        this.currentSelectorFolder = null;
        this.selectorBreadcrumbs = [];
      }
    },

    async submitAIPrompt() {
      try {
        this.aiLoading = true;
        
        // Get file contents from comments
        const fileContents = [];
        
        // Format comments history
        const commentsHistory = this.comments.map(comment => {
          const timestamp = comment.updated_at || comment.created_at;
          const formattedDate = new Date(timestamp).toLocaleString();
          return `[${formattedDate}] ${this.assigneeEmail}: ${comment.content}`;
        }).join('\n\n');
        
        // Create a system prompt that includes task context, comments history, and files
        const systemPrompt = `You are an AI legal assistant helping with a task titled "${this.task.title}". ${
          this.task.description 
            ? `The task description is: ${this.task.description}\n\n`
            : ''
        }

Comment History:
${commentsHistory}

Please provide assistance based on this context, the comment history, the available files, and the user's prompt.`;

        const response = await fetch(`${this.pythonApiBaseUrl}/gpt/get_ai_response`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: this.aiPrompt,
            systemPrompt: systemPrompt,
            taskId: this.task.id,
            workspaceId: this.task.workspace_id,
            files: fileContents
          })
        });

        if (!response.ok) {
          throw new Error('Failed to get AI response');
        }

        const data = await response.json();

        // Set the AI response in the comment box
        this.newComment = `${data.response}`;

        this.showAIDialog = false;
        this.aiPrompt = '';
        ElMessage.success('AI response received successfully');
      } catch (error) {
        ElMessage.error('Error getting AI response: ' + error.message);
      } finally {
        this.aiLoading = false;
      }
    },

    async getFileContentsFromComments() {
      const fileUrls = new Set();
      const fileContents = [];

      // Extract all file URLs from comments
      for (const comment of this.comments) {
        const matches = comment.content.match(/\[([^\]]+)\]\(([^)]+)\)/g);
        if (matches) {
          matches.forEach(match => {
            const url = match.match(/\(([^)]+)\)/)[1];
            const fileName = match.match(/\[([^\]]+)\]/)[1];
            fileUrls.add({ url, fileName });
          });
        }
      }

      // Fetch content for each unique file
      for (const { url, fileName } of fileUrls) {
        try {
          const fileType = this.getFileType(fileName);
          let content;

          if (fileType === 'text/plain') {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to fetch ${url}`);
            content = await response.text();
          } else if (fileType.startsWith('image/') || fileType === 'application/pdf') {
            // Call our new endpoint for image and PDF processing
            const response = await fetch(`${this.pythonApiBaseUrl}/gpt/extract_file_content`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                url,
                fileType: fileType
              })
            });

            if (!response.ok) throw new Error(`Failed to process ${fileName}`);
            const data = await response.json();
            content = data.content;
          } else {
            content = `[File: ${fileName} (${fileType})]`;
          }

          fileContents.push({
            url,
            fileName,
            type: fileType,
            content
          });
        } catch (error) {
          console.error(`Error fetching file content: ${error}`);
          fileContents.push({
            url,
            fileName,
            type: this.getFileType(fileName),
            content: `[Error processing file: ${error.message}]`
          });
        }
      }

      return fileContents;
    },

    getFileType(filename) {
      const ext = filename.split('.').pop()?.toLowerCase();
      const mimeTypes = {
        pdf: 'application/pdf',
        doc: 'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        txt: 'text/plain',
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif'
      };
      return mimeTypes[ext] || 'application/octet-stream';
    },

    async getTypeaheadSuggestions(text, cursorPosition) {
      try {
        console.log('Getting typeahead suggestions for:', {
          text,
          cursorPosition
        });

        const response = await fetch(`${this.pythonApiBaseUrl}/gpt/get_typeahead_suggestions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text,
            cursorPosition,
            systemPrompt: `Task context: ${this.task.title}. ${this.task.description || ''}`
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to get suggestions: ${errorText}`);
        }
        
        const data = await response.json();
        console.log('Received suggestions:', data);
        
        if (data.suggestions?.length) {
          this.typeaheadSuggestions = data.suggestions;
          this.showTypeahead = true;
          this.typeaheadSelectedIndex = -1;
        } else {
          this.showTypeahead = false;
        }
      } catch (error) {
        console.error('Error getting suggestions:', error);
        this.showTypeahead = false;
      }
    },

    handleTypeaheadNavigation(event) {
      if (!this.showUserMentions) return;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          this.selectedUserIndex = Math.min(
            (this.selectedUserIndex + 1),
            this.userSuggestions.length - 1
          );
          break;
        case 'ArrowUp':
          event.preventDefault();
          this.selectedUserIndex = Math.max(this.selectedUserIndex - 1, 0);
          break;
        case 'Enter':
        case 'Tab':
          event.preventDefault();
          if (this.selectedUserIndex >= 0) {
            this.selectUser(this.userSuggestions[this.selectedUserIndex]);
          }
          break;
        case 'Escape':
          this.showUserMentions = false;
          break;
      }
    },

    applySuggestion(suggestion) {
      const textarea = document.querySelector('.comment-textarea');
      const cursorPos = textarea.selectionStart;
      const textBeforeCursor = this.newComment.slice(0, cursorPos);
      const textAfterCursor = this.newComment.slice(cursorPos);
      
      // Find the last word before cursor
      const words = textBeforeCursor.split(' ');
      const lastWord = words[words.length - 1];
      
      // Replace the incomplete word with the suggestion
      words[words.length - 1] = suggestion;
      this.newComment = words.join(' ') + textAfterCursor;
      
      // Reset typeahead
      this.showTypeahead = false;
      this.typeaheadSuggestions = [];
      
      // Set cursor position after the inserted suggestion
      this.$nextTick(() => {
        const newPos = cursorPos - lastWord.length + suggestion.length;
        textarea.setSelectionRange(newPos, newPos);
        textarea.focus();
      });
    },

    handleResize() {
      // Force update to recalculate drawer size
      this.$forceUpdate();
    },

    async loadSharedUsers() {
      try {
        const { data: users, error } = await supabase
          .from('workspace_access')
          .select('shared_with_user_id')
          .eq('workspace_id', this.task.workspace_id);

        if (error) throw error;

        // Get user details for each shared user
        const userDetails = await Promise.all(
          users.map(async (user) => {
            // Skip if shared_with_user_id is null
            if (!user.shared_with_user_id) {
              return null;
            }
            
            const { data } = await supabase
              .rpc('get_user_info_by_id', {
                user_id: user.shared_with_user_id
              });
            return {
              id: user.shared_with_user_id,
              email: data?.[0]?.email,
              fullName: data?.[0]?.full_name || data?.[0]?.email.split('@')[0],
              username: data?.[0]?.username || data?.[0]?.email.split('@')[0]
            };
          })
        );

        this.sharedUsers = userDetails.filter(Boolean);
      } catch (error) {
        console.error('Error loading shared users:', error);
      }
    },

    async showUserSuggestions(query) {
      if (!this.sharedUsers.length) {
        await this.loadSharedUsers();
      }

      const normalizedQuery = query.toLowerCase();
      this.userSuggestions = this.sharedUsers.filter(user =>
        user.fullName?.toLowerCase().includes(normalizedQuery) ||
        user.username?.toLowerCase().includes(normalizedQuery) ||
        user.email.toLowerCase().includes(normalizedQuery)
      );

      this.showUserMentions = true;
      this.selectedUserIndex = -1;
    },

    selectUser(user) {
      // Get the current text and cursor position
      const cleanText = this.newComment.replace(/<[^>]*>/g, '');
      const textBeforeCursor = cleanText.slice(0, this.mentionIndex);
      const textAfterCursor = cleanText.slice(this.mentionIndex);
      
      // Find the last @ symbol and remove everything after it up to the cursor
      const lastAtIndex = textBeforeCursor.lastIndexOf('@');
      const newTextBeforeCursor = textBeforeCursor.slice(0, lastAtIndex);
      
      // Create the mention tag
      const displayName = user.fullName || user.username;
      const mentionTag = `@[${displayName}](${user.id})`;
      
      // Combine the text
      this.newComment = `${newTextBeforeCursor}${mentionTag} ${textAfterCursor}`;
      this.showUserMentions = false;
      
      // Focus back on the editor and set cursor position
      this.$nextTick(() => {
        const editor = document.querySelector('.comment-textarea');
        if (editor) {
          editor.focus();
          
          // Create a new text node with a space after the mention
          const textNode = document.createTextNode(' ');
          
          // Find the last text node in the editor
          let lastTextNode = null;
          const walk = document.createTreeWalker(
            editor,
            NodeFilter.SHOW_TEXT,
            null,
            false
          );
          
          while (walk.nextNode()) {
            lastTextNode = walk.currentNode;
          }
          
          // If we found the last text node, insert our new text node after it
          if (lastTextNode && lastTextNode.parentNode) {
            lastTextNode.parentNode.insertBefore(textNode, lastTextNode.nextSibling);
            
            // Create and set the selection range
            const range = document.createRange();
            const selection = window.getSelection();
            
            range.setStart(textNode, 1); // Position after the space
            range.collapse(true);
            
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }
      });
    },

    async createNotification(userId, type, data) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        const { error } = await supabase
          .from('notifications')
          .insert([{
            user_id: userId,
            actor_id: user.id,
            type,
            data,
            read: false
          }]);

        if (error) throw error;
      } catch (error) {
        console.error('Error creating notification:', error);
      }
    },

    getCursorPosition(range) {
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(range.startContainer.parentElement);
      preCaretRange.setEnd(range.startContainer, range.startOffset);
      return preCaretRange.toString().length;
    },

    startTitleEdit() {
      this.editingTitle = this.task.title;
      this.isEditingTitle = true;
      this.$nextTick(() => {
        this.$refs.titleInput.focus();
      });
    },

    async saveTitleEdit() {
      if (!this.editingTitle.trim() || this.editingTitle === this.task.title) {
        this.cancelTitleEdit();
        return;
      }

      try {
        // Prepare edit history entries for title 
        const historyEntries = [];
        if (this.task.title !== this.editingTitle) {
            historyEntries.push({
              field_name: 'title',
              previous_value: this.task.title,
              edited_at: new Date().toISOString(),
              edited_by: this.currentUser.id
          });
        }
      
        const updateData = {
          title: this.editingTitle,
          updated_at: new Date().toISOString()
        };

        // If there are history entries, add them to the update
        if (historyEntries.length > 0) { 
          updateData.edit_history = this.task.edit_history 
              ? [...this.task.edit_history, ...historyEntries]
              : historyEntries;
        }

        const { data, error } = await supabase
            .from('tasks')
            .update(updateData)
            .eq('id', this.task.id)
            .select();

        if (error) throw error;

        // Update the local task object with the new data
        this.$emit('update:task', { ...this.task, ...data });
        
        // Emit task-updated event to trigger cache reload
        this.$emit('task-updated', {
          taskId: this.task.id,
          field: 'title',
          value: this.editingTitle,
          requiresReload: true
        });
        
        // Create activity log for title change
        /*
        const { data: { user } } = await supabase.auth.getUser();
        await supabase
          .from('task_comments')
          .insert({
            task_id: this.task.id,
            user_id: user.id,
            content: `Updated title from "${this.task.title}" to "${this.editingTitle}"`,
            type: 'activity',
            workspace_id: this.task.workspace_id,
            metadata: {
              action: 'update',
              changes: {
                title: {
                  from: this.task.title,
                  to: this.editingTitle
                }
              }
            }
          });
          */

        // Update local task title
        this.task.title = this.editingTitle;
        
        // Update workspace activity
        await updateWorkspaceActivity(this.task.workspace_id);
        
        this.isEditingTitle = false;
        ElMessage.success('Task title updated successfully');
      } catch (error) {
        console.error('Error updating task title:', error);
        ElMessage.error('Failed to update task title');
      }
    },

    cancelTitleEdit() {
      this.isEditingTitle = false;
      this.editingTitle = this.task.title;
    },

    async toggleTaskStar() {
      try {
        const isStarred = this.isTaskStarred;

        if (isStarred) {
          // Remove star
          const { error } = await supabase
            .from('task_stars')
            .delete()
            .eq('task_id', this.task.id)
            .eq('user_id', this.currentUser.id);

          if (error) throw error;
          this.task.task_stars = this.task.task_stars.filter(star => star.user_id !== this.currentUser.id);
        } else {
          // Add star
          const { data, error } = await supabase
            .from('task_stars')
            .insert({
              task_id: this.task.id,
              user_id: this.currentUser.id,
              workspace_id: this.task.workspace_id
            })
            .select();

          if (error) throw error;
          this.task.task_stars = [...(this.task.task_stars || []), data[0]];
        }

        // Update workspace activity
        await updateWorkspaceActivity(this.task.workspace_id);

        // Emit update event
        this.$emit('update:task', this.task);
        ElMessage.success(`Task ${isStarred ? 'unstarred' : 'starred'} successfully`);
      } catch (error) {
        ElMessage.error('Error toggling star: ' + error.message);
      }
    },

    handleStatusChange: async function (status) {
      try {
        const { data, error } = await supabase
          .from('tasks')
          .update({ status })
          .eq('id', this.task.id)
          .select()
          .single()

        if (error) throw error

        // Update local task data
        this.statusValue = status;
        this.$emit('update:task', { ...this.task, status })
        
        // Emit events to update parent components
        this.$emit('status-updated', { taskId: this.task.id, status })
        
        // Update workspace activity
        await updateWorkspaceActivity(this.task.workspace_id);
        
        ElMessage.success('Status updated successfully')
      } catch (error) {
        console.error('Error updating status:', error)
        ElMessage.error('Failed to update status')
      }
    },

    getPriorityType(priority) {
      switch (priority?.toLowerCase()) {
        case 'high':
          return 'danger';
        case 'medium':
          return 'warning';
        case 'low':
          return 'success';
        default:
          return 'info';
      }
    },

    async handlePriorityChange(priority) {
      try {
        const { data, error } = await supabase
          .from('tasks')
          .update({ priority })
          .eq('id', this.task.id)
          .select()
          .single()

        if (error) throw error

        // Update local task data
        this.priorityValue = priority;
        this.$emit('update:task', { ...this.task, priority })
        
        // Emit events to update parent components
        this.$emit('priority-updated', { taskId: this.task.id, priority })
        
        // Update workspace activity
        await updateWorkspaceActivity(this.task.workspace_id);
        
        ElMessage.success('Priority updated successfully')
      } catch (error) {
        console.error('Error updating priority:', error)
        ElMessage.error('Failed to update priority')
      }
    },

    getDueDateType(task) {
      if (!task?.due_date) return 'info';
      const dueDate = new Date(task.due_date);
      const today = new Date();
      
      if (dueDate < today && task.status !== 'completed') return 'danger';
      if (dueDate.toDateString() === today.toDateString()) return 'warning';
      return 'info';
    },

    async handleDueDateChange(value) {
      if (value === 'clear') {
        this.tempDueDate = null;
      }
      
      try {
        const updatedTask = {
          ...this.task,
          due_date: this.tempDueDate
        };
        
        const { error } = await supabase
          .from('tasks')
          .update({ due_date: this.tempDueDate })
          .eq('id', this.task.id);

        if (error) throw error;
        
        // Update local task data
        this.dueDateValue = this.tempDueDate;
        this.$emit('update:task', updatedTask);
        
        // Emit due-date-updated event
        this.$emit('due-date-updated', {
          taskId: this.task.id,
          due_date: this.tempDueDate
        });
        
        // Update workspace activity
        await updateWorkspaceActivity(this.task.workspace_id);
        
        ElMessage.success('Due date updated successfully');
      } catch (error) {
        ElMessage.error('Error updating due date: ' + error.message);
      }
    },

    startDescriptionEdit() {
      this.isEditingDescription = true;
      this.editingDescription = this.task.description || '';
    },

    async saveDescriptionEdit() {
      try {
        const { data, error } = await supabase
          .from('tasks')
          .update({ 
            description: this.editingDescription,
            updated_at: new Date().toISOString()
          })
          .eq('id', this.task.id)
          .select()
          .single();

        if (error) throw error;

        // Update local task data
        this.$emit('update:task', { ...this.task, ...data });
        
        // Update workspace activity
        await updateWorkspaceActivity(this.task.workspace_id);
        
        this.isEditingDescription = false;
        ElMessage.success('Description updated successfully');
      } catch (error) {
        console.error('Error updating description:', error);
        ElMessage.error('Failed to update description');
      }
    },

    cancelDescriptionEdit() {
      this.isEditingDescription = false;
      this.editingDescription = '';
    },

    async handleAssigneeChange(userId) {
      try {
        const { data, error } = await supabase
          .from('tasks')
          .update({ 
            assignee: userId,
            updated_at: new Date().toISOString()
          })
          .eq('id', this.task.id)
          .select()
          .single();

        if (error) throw error;

        // Fetch the latest task data
        const { data: freshTask, error: fetchError } = await supabase
          .from('tasks')
          .select('*')
          .eq('id', this.task.id)
          .single();

        if (fetchError) throw fetchError;

        // Update assigneeEmail for the new assignee
        if (userId) {
          const { data: userData, error: userError } = await supabase
            .rpc('get_user_info_by_id', {
              user_id: userId
            });
          if (!userError && userData?.[0]) {
            this.assigneeEmail = userData[0].email;
          } else {
            this.assigneeEmail = '';
          }
        } else {
          this.assigneeEmail = '';
        }

        // Emit the updated task
        this.$emit('update:task', { ...this.task, ...freshTask });

        // Emit task-updated event for reordering
        this.$emit('task-updated', {
          taskId: this.task.id,
          field: 'assignee',
          value: userId,
          requiresReorder: true
        });

        // Update workspace activity
        await updateWorkspaceActivity(this.task.workspace_id);

        ElMessage.success('Assignee updated successfully');
      } catch (error) {
        console.error('Error updating assignee:', error);
        ElMessage.error('Failed to update assignee');
      }
    },

    async loadTaskDetails() {
      try {
        this.loading = true;
        
        // Load task details
        const { data: taskData, error: taskError } = await supabase
          .from('tasks')
          .select(`
            *,
            workspace:workspace_id (title),
            task_stars (user_id),
            task_hours_logs (time_taken)
          `)
          .eq('id', this.task.id)
          .single();

        if (taskError) throw taskError;

        // Load assignee email if exists
        if (taskData.assignee) {
          const { data: userData, error: userError } = await supabase
            .rpc('get_user_info_by_id', {
              user_id: taskData.assignee
            });
          
          if (userError) throw userError;
          
          if (userData?.[0]) {
            this.assigneeEmail = userData[0].email;
          } else {
            this.assigneeEmail = '';
          }
        } else {
          this.assigneeEmail = '';
        }

        // Update task data
        this.$emit('update:task', { ...this.task, ...taskData });

      } catch (error) {
        console.error('Error loading task details:', error);
        ElMessage.error('Failed to load task details');
      } finally {
        this.loading = false;
      }
    },
  },
  beforeUnmount() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    document.removeEventListener('click', this.handleClickOutside);
    window.removeEventListener('resize', this.handleResize);
  },
  async created() {
    const { data: { user } } = await supabase.auth.getUser();
    this.currentUser = user;
  },
  async mounted() {
    this.handleClickOutside = (event) => {
      if (event.target.classList.contains('edited-marker')) {
        const commentId = event.target.dataset.commentId;
        if (this.expandedCommentHistories.has(commentId)) {
          this.expandedCommentHistories.delete(commentId);
        } else {
          this.expandedCommentHistories.add(commentId);
        }
        this.$forceUpdate();
      }
    };
    document.addEventListener('click', this.handleClickOutside);
    window.addEventListener('resize', this.handleResize);
    
    await Promise.all([
      this.loadSharedUsers(),
      this.loadTaskDetails()
    ]);
  }
};
</script>

<template>
  <el-drawer
    :model-value="visible"
    @update:model-value="$emit('update:visible', $event)"
    :title="false"
    direction="rtl"
    :size="drawerSize"
    class="quick-task-view"
  >
    <template #header>
      <div class="drawer-header">
        <div class="title-section">
          <div class="title-wrapper">
            <div class="star-container">
              <el-icon 
                class="star-icon"
                :class="{ 'starred': isTaskStarred }"
                @click.stop="toggleTaskStar"
              >
                <Star v-if="!isTaskStarred" />
                <StarFilled v-else />
              </el-icon>
            </div>
            
            <h2 
              v-if="!isEditingTitle" 
              @click="startTitleEdit"
              class="editable-title"
            >
              {{ task?.title }}
              <el-icon class="edit-icon"><Edit /></el-icon>
            </h2>
            
            <div v-else class="title-edit-wrapper">
              <el-input
                v-model="editingTitle"
                ref="titleInput"
                size="large"
                @keyup.enter="saveTitleEdit"
                @keyup.esc="cancelTitleEdit"
              />
              <div class="title-edit-actions">
                <el-button @click="cancelTitleEdit">Cancel</el-button>
                <el-button 
                  type="primary" 
                  @click="saveTitleEdit" 
                  size="small"
                  :disabled="!editingTitle.trim() || editingTitle === task?.title"
                >
                  Save
                </el-button>
              </div>
            </div>
          </div>
        </div>
        <div class="drawer-header-actions">
          <el-button
            type="primary"
            link
            @click="$router.push({
              name: 'SingleTaskPage',
              params: {
                workspaceId: task.workspace_id,
                taskId: task.id
              }
            })"
          >
            <el-icon><FullScreen /></el-icon>
          </el-button>
        </div>
      </div>
    </template>

    <!-- Compact Metadata Section -->
    <div class="task-metadata-compact">
      <div class="metadata-row">
        <div class="status-priority-group">
          <span class="status-label">Status:</span>
          <el-dropdown trigger="click" @command="handleStatusChange">
            <el-tag :type="statusValue === 'completed' ? 'success' : statusValue === 'in_progress' ? 'warning' : statusValue === 'awaiting_external' || statusValue === 'awaiting_internal' ? 'info' : statusValue === 'not_started' ? 'info' : 'info'" size="small" class="status-tag clickable">
              {{ statusValue ? statusValue.replace('_', ' ').charAt(0).toUpperCase() + statusValue.slice(1).replace('_', ' ') : 'New' }}
              <el-icon class="el-icon--right" :size="12"><ArrowDown /></el-icon>
            </el-tag>
            <template #dropdown>
              <el-dropdown-menu class="compact-dropdown">
                <el-dropdown-item command="not_started"><el-tag size="small" type="info" class="option-tag">Not Started</el-tag></el-dropdown-item>
                <el-dropdown-item command="in_progress"><el-tag size="small" type="warning" class="option-tag">In Progress</el-tag></el-dropdown-item>
                <el-dropdown-item command="not_needed_anymore"><el-tag size="small" type="warning" class="option-tag">Not needed anymore</el-tag></el-dropdown-item>
                <el-dropdown-item command="awaiting_external"><el-tag size="small" type="info" class="option-tag">Awaiting External</el-tag></el-dropdown-item>
                <el-dropdown-item command="awaiting_internal"><el-tag size="small" type="info" class="option-tag">Awaiting Internal</el-tag></el-dropdown-item>
                <el-dropdown-item command="completed"><el-tag size="small" type="success" class="option-tag">Completed</el-tag></el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <span class="priority-label">Priority:</span>
          <el-dropdown @command="handlePriorityChange" trigger="click">
            <el-tag :type="getPriorityType(priorityValue)" size="small" class="priority-tag">{{ priorityValue || 'No priority' }}<el-icon class="el-icon--right"><ArrowDown /></el-icon></el-tag>
            <template #dropdown>
              <el-dropdown-menu class="compact-dropdown">
                <el-dropdown-item command="high"><el-tag size="small" type="danger" class="option-tag">High</el-tag></el-dropdown-item>
                <el-dropdown-item command="medium"><el-tag size="small" type="warning" class="option-tag">Medium</el-tag></el-dropdown-item>
                <el-dropdown-item command="low"><el-tag size="small" type="success" class="option-tag">Low</el-tag></el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
      <div class="metadata-row">
        <div class="duedate-assignee-group">
          <span class="due-date-label">Due Date:</span>
          <el-dropdown @command="handleDueDateChange" trigger="click">
            <el-tag :type="getDueDateType(task)" size="small" class="due-date-tag">{{ task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date' }}<el-icon class="el-icon--right"><ArrowDown /></el-icon></el-tag>
            <template #dropdown>
              <el-dropdown-menu class="compact-dropdown">
                <el-dropdown-item>
                  <el-date-picker v-model="dueDateValue" type="date" placeholder="Select due date" style="width: 200px" size="small" @change="handleDueDateChange" />
                </el-dropdown-item>
                <el-dropdown-item divided command="clear">Clear due date</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <span class="assignee-label">Assigned To:</span>
          <el-dropdown @command="handleAssigneeChange" trigger="click">
            <el-tag type="info" size="small" class="assignee-tag">{{ assigneeEmail || 'Unassigned' }}<el-icon class="el-icon--right"><ArrowDown /></el-icon></el-tag>
            <template #dropdown>
              <el-dropdown-menu class="compact-dropdown">
                <el-dropdown-item v-for="user in sharedUsers" :key="user.id" :command="user.id">
                  <div class="user-option"><el-avatar :size="24">{{ user.email.charAt(0).toUpperCase() }}</el-avatar>{{ user.email }}</div>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </div>
    <el-divider style="margin: 8px 0;" />

    <div class="comments-container">
      <!-- Description Header -->
      <div class="section-header">
        <div class="section-title">
          <span>Description</span>
          <el-button 
            v-if="!isEditingDescription" 
            link 
            @click="startDescriptionEdit"
          >
            <el-icon><Edit /></el-icon>
            Edit
          </el-button>
        </div>
      </div>

      <!-- Description section -->
      <div class="description-section">
        <div v-if="isEditingDescription" class="description-edit">
          <TiptapEditor
            v-model="editingDescription"
            placeholder="Add a description..."
            :autofocus="true"
            :isTaskComment="false"
            :isTaskRelated="true"
            :sharedUsers="sharedUsers"
            :taskId="String(task.id)"
            :taskTitle="task.title"
            :enable-typeahead="false"
          />
          <div class="description-edit-actions">
            <el-button @click="cancelDescriptionEdit">Cancel</el-button>
            <el-button 
              type="primary" 
              @click="saveDescriptionEdit"
              :disabled="!editingDescription.trim() || editingDescription === task?.description"
            >
              Save
            </el-button>
          </div>
        </div>
        <div v-else-if="task.description" class="task-description">
          <div 
            :class="['description-content', { 'collapsed': !isDescriptionExpanded }]" 
            v-html="formatCommentContent(task.description)">
          </div>
          <div class="description-toggle">
            <el-button 
              link 
              type="primary" 
              @click="isDescriptionExpanded = !isDescriptionExpanded">
              {{ isDescriptionExpanded ? 'Show Less' : 'Show More' }}
            </el-button>
          </div>
        </div>
      </div>

      <!-- Comments Header -->
      <div class="section-header" style="margin-bottom: 10px;">
        <div class="section-title">
          <span>Comments</span>
        </div>
      </div>

      <!-- Comments section -->
      <div class="comments-section">
        <div class="comment-list">
          <div v-for="comment in comments" :key="comment.id" :class="['comment-item', { 'ai-response': comment.type === 'ai_response' }]">
            <div :class="['comment-content', comment.type === 'activity' ? 'activity' : '']">
              <div class="comment-header">
                <div class="comment-author-info">
                  <div class="author-avatar">
                    {{ comment.type === 'ai_response' ? comment.metadata?.ai_name?.charAt(0).toUpperCase() || 'AI' : userEmails[comment.user_id]?.charAt(0).toUpperCase() }}
                  </div>
                  <div class="author-details">
                    <span class="comment-author">
                      {{ comment.type === 'ai_response' ? comment.metadata?.ai_name || 'AI Attorney' : userEmails[comment.user_id] }}
                    </span>
                    <span class="comment-date">
                      {{ comment.updated_at 
                        ? new Date(comment.updated_at).toLocaleString(undefined, { 
                            year: 'numeric', 
                            month: 'numeric', 
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        : new Date(comment.created_at).toLocaleString(undefined, {
                            year: 'numeric',
                            month: 'numeric',
                            day: 'numeric', 
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                      }}
                      <span 
                        v-if="comment.comment_edit_history?.length" 
                        class="edited-marker"
                        :data-comment-id="comment.id"
                        @click="toggleHistory(comment.id)"
                      >(edited {{ comment.comment_edit_history.length }} times)</span>
                    </span>
                  </div>
                </div>
                <el-button 
                  v-if="comment.user_id === currentUser?.id && comment.type !== 'activity'"
                  link
                  type="primary"
                  @click="startEditing(comment)"
                >
                  Edit
                </el-button>
              </div>
              <div v-if="editingCommentId === comment.id" class="comment-edit">
                <RichTextEditor
                  v-model="editingCommentText"
                  :rows="3"
                />
                <div class="edit-actions">
                  <el-button @click="cancelEdit">Cancel</el-button>
                  <el-button 
                    type="primary"
                    @click="saveEdit(comment)"
                    :disabled="!editingCommentText.trim()"
                  >
                    Save
                  </el-button>
                </div>
              </div>
              <div v-else class="comment-text">
                <span v-html="formatMarkdownLinks(comment.content)"></span>
              </div>
              <div v-if="expandedCommentHistories.has(comment.id)" class="edit-history">
                <div v-for="(historyEntry, index) in comment.comment_edit_history" :key="index" class="edit-history-entry">
                  <div class="edit-history-header">Version {{ index + 1 }}:</div>
                  <div class="previous-content" v-html="formatMarkdownLinks(historyEntry.previous_content)"></div>
                  <div class="edit-metadata">
                    Edited by {{ userEmails[historyEntry.edited_by] }}
                    on {{ new Date(historyEntry.edited_at).toLocaleString() }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <el-dialog
        v-model="showFileSelector"
        title="Select File"
        width="500px">
        <div class="file-selector-header">
          <el-breadcrumb separator="/">
            <el-breadcrumb-item 
              @click="navigateSelectorFolder(null)"
              :class="{ clickable: currentSelectorFolder }">
              Root
            </el-breadcrumb-item>
            <el-breadcrumb-item 
              v-for="folder in selectorBreadcrumbs" 
              :key="folder.id"
              @click="navigateSelectorFolder(folder)"
              :class="{ clickable: folder.id !== currentSelectorFolder?.id }">
              {{ folder.name }}
            </el-breadcrumb-item>
          </el-breadcrumb>
        </div>

        <el-input
          v-model="fileSearchQuery"
          placeholder="Search files..."
          clearable
          :type="'string'"
          style="margin-bottom: 1rem;" />
        
        <el-scrollbar height="300px">
          <div class="file-list">
            <div
              v-for="item in filteredFiles"
              :key="item.id"
              class="file-item"
              @click="item.type === 'dir' ? navigateSelectorFolder(item) : selectFile(item)">
              <el-icon v-if="item.type === 'dir'" class="folder-icon">
                <Folder />
              </el-icon>
              {{ item.name }}
            </div>
          </div>
        </el-scrollbar>
      </el-dialog>

      <div class="comment-input">
        <TiptapEditor
          v-model="newComment"
          placeholder="Write a comment..."
          @keyup.ctrl.enter="addComment" 
          :shared-users="sharedUsers"
          :task-title="task.title || 'New Task'"
          :task-id="String(task.id)"
          :isTaskComment="true"
          :enable-typeahead="false"
        />
        
        <el-button
          type="primary"
          :disabled="!newComment.trim()"
          @click="addComment"
          style="margin-top: 10px">
          Add Comment
        </el-button>
      </div>
      
    </div>

    <el-dialog
      v-model="showAIDialog"
      title="Ask AI Attorney"
      width="500px">
      <el-input
        v-model="aiPrompt"
        type="textarea"
        :rows="4"
        placeholder="What would you like to ask the AI attorney about this task?"
        :disabled="aiLoading"
      />
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showAIDialog = false" :disabled="aiLoading">Cancel</el-button>
          <el-button
            type="primary"
            @click="submitAIPrompt"
            :loading="aiLoading"
            :disabled="!aiPrompt.trim()">
            Submit
          </el-button>
        </span>
      </template>
    </el-dialog>
  </el-drawer>
</template>

<style scoped>
.comments-container {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 175px); /* Account for header and padding */
  overflow: hidden;
}

.comments-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.comments-title {
  font-size: 16px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.header-actions {
  display: flex;
  gap: 8px;
}

.description-section {
  flex-shrink: 0;
  max-height: none; /* Remove the max-height constraint */
  overflow-y: visible; /* Remove scroll */
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.comments-section {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.task-description {
  background-color: var(--el-color-info-light-9);
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.description-content {
  word-break: break-word;
  transition: max-height 0.3s ease-out;
  overflow: hidden;
}

.description-content.collapsed {
  max-height: 100px; /* Adjust this value based on your needs */
  position: relative;
  overflow: hidden;
}

.description-content.collapsed::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 40px;
  background: linear-gradient(transparent, var(--el-color-info-light-9));
  pointer-events: none;
}

div.description-content>p>a {
  color: #409EFF;
  text-decoration: none;
}
.description-content:deep(a) {
  color: #409EFF;
  text-decoration: none;
}

.description-toggle {
  display: flex;
  justify-content: center;
  margin-top: 8px;
  padding-top: 4px;
  border-top: 1px solid var(--el-border-color-lighter);
}

/* Add custom scrollbar styles for better visibility */
.description-section::-webkit-scrollbar,
.comments-section::-webkit-scrollbar {
  width: 6px;
}

.description-section::-webkit-scrollbar-track,
.comments-section::-webkit-scrollbar-track {
  background: #f5f7fa;
  border-radius: 3px;
}

.description-section::-webkit-scrollbar-thumb,
.comments-section::-webkit-scrollbar-thumb {
  background: #dcdfe6;
  border-radius: 3px;
}

.description-section::-webkit-scrollbar-thumb:hover,
.comments-section::-webkit-scrollbar-thumb:hover {
  background: #c0c4cc;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .description-section {
    max-height: 30vh;
  }
}

@media (max-width: 480px) {
  .description-section,
  .comments-section {
    padding: 12px;
  }
}

.comment-item {
  margin-bottom: 1.5rem;
}

.comment-content {
  background-color: #f5f7fa;
  padding: 16px;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.comment-content.activity {
  background-color: #f0f9ff;
  font-style: italic;
  font-size: 0.95em;
  border-left: 3px solid var(--el-color-primary-light-5);
}

.comment-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.comment-author-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.author-avatar {
  width: 32px;
  height: 32px;
  background-color: var(--el-color-primary);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  font-size: 14px;
}

.author-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.comment-author {
  font-weight: 500;
  color: var(--el-color-primary);
  font-size: 0.95em;
}

.comment-date {
  color: #909399;
  font-size: 0.85em;
}

.comment-text {
  line-height: 1.5;
  color: #303133;
  white-space: pre-wrap;
}

div.comment-text>span>p>a {
  color: #409EFF;
  text-decoration: none;
}
.comment-text>span:deep(a) {
  color: #409EFF;
  text-decoration: none;
}

.edited-marker {
  color: #909399;
  font-size: 0.9em;
  margin-left: 4px;
  cursor: pointer;
}

.edited-marker:hover {
  color: var(--el-color-primary);
}

.edit-history {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.edit-history-entry {
  background-color: white;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 8px;
}

.edit-history-header {
  font-weight: 500;
  color: #606266;
  margin-bottom: 8px;
}

.previous-content {
  color: #606266;
  background-color: #f5f7fa;
  padding: 8px;
  border-radius: 4px;
  margin-bottom: 8px;
}

.edit-metadata {
  font-size: 0.85em;
  color: #909399;
}

.comment-edit {
  margin-top: 12px;
}

.edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

/* Add these styles for user mentions */
.user-mentions {
  position: absolute;
  bottom: 100%;
  left: 0;
  width: 100%;
  max-height: 200px;
  overflow-y: auto;
  background: white;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  z-index: 100;
}

.mention-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.mention-item:hover,
.mention-item.selected {
  background-color: var(--el-color-primary-light-9);
}

.mention-item-avatar {
  width: 28px;
  height: 28px;
  background-color: var(--el-color-primary);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 500;
}

.mention-item-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mention-item-name {
  font-weight: 500;
  font-size: 0.9em;
}

.mention-item-hint {
  color: #909399;
  font-size: 0.8em;
}

/* Add this to ensure proper positioning */
.comment-input {
  position: relative;
}
.file-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--el-color-primary);
  text-decoration: none;
}

.file-link:hover {
  text-decoration: none;
}

.file-link .file-icon {
  font-size: 14px;
}
.ai-response {
  background-color: var(--el-color-success-light-9);
  border-left: 3px solid var(--el-color-success);
}

.ai-response .author-avatar {
  background-color: var(--el-color-success) !important;
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  width: 100%;
}

.title-section {
  flex: 1;
  min-width: 0;
  margin-right: 16px;
}

.title-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
}

.editable-title {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}

.edit-icon {
  opacity: 0;
  transition: opacity 0.2s;
}

.editable-title:hover .edit-icon {
  opacity: 1;
}

.drawer-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 100%;
}

.drawer-header-actions .el-button {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  width: 32px;
  padding: 8px;
}

.title-edit-wrapper {
  flex: 1;
  min-width: 0;
}

.title-edit-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 8px;
}

.task-metadata-compact {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px 12px 0 12px;
}
.metadata-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 2px;
}
.status-priority-group, .duedate-assignee-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.status-label, .priority-label, .due-date-label, .assignee-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-right: 2px;
}
.status-tag, .priority-tag, .due-date-tag, .assignee-tag {
  min-width: 90px;
  padding: 2px 8px;
  font-size: 13px;
  height: 22px;
  margin-right: 4px;
}
@media (max-width: 768px) {
  .task-metadata-compact { padding: 2px 4px 0 4px; }
  .metadata-row { gap: 6px; }
  .status-tag, .priority-tag, .due-date-tag, .assignee-tag { min-width: 70px; font-size: 12px; }
}
.drawer-header { padding-bottom: 4px !important; margin-bottom: 0 !important; }
.el-divider { margin: 8px 0 !important; }
.comments-container { padding-top: 0 !important; }
</style>

<style>
.quick-task-view .el-drawer__header {
  margin-bottom: 0px !important;
}
</style>