<script>
import { supabase } from '../../supabase';
import { ElMessage } from 'element-plus';
import { FullScreen, Close, Folder, Document } from '@element-plus/icons-vue';
import { ref } from 'vue';
import EditableTable from './EditableTable.vue'
import RichTextEditor from '../common/RichTextEditor.vue';
import TiptapEditor from '../common/TiptapEditor.vue'

export default {
  components: {
    FullScreen,
    Close,
    Folder,
    EditableTable,
    RichTextEditor,
    TiptapEditor,
    Document
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
  emits: ['update:visible'],
  data() {
    return {
      comments: [],
      newComment: '',
      loading: false,
      userEmails: {},
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
    }
  },
  watch: {
    visible: {
      handler(newVal) {
        if (newVal && this.task) {
          this.loadComments();
          this.setupRealtimeSubscription();
        } else {
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
      
      // Replace markdown file links with custom file links
      return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, fileName, fileUrl) => {
        return `<a class="file-link" href="${fileUrl}" target="_blank" title="Click to view file">
          ${fileName}
        </a>`;
      });
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
          if (!this.userEmails[comment.user_id] && comment.user_id) {
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

        // Check for @aiAttorney mention
        const aiMentionRegex = /@aiAttorney\s*(.*?)(?=@|$)/gi;
        const aiMentions = this.newComment.match(aiMentionRegex);

        // First post the user's comment as is
        const { data, error } = await supabase
          .from('task_comments')
          .insert({
            task_id: this.task.id,
            user_id: user.id,
            content: this.newComment.trim()
          })
          .select();

        if (error) throw error;

        // If there are AI mentions, get responses and post them as separate comments
        if (aiMentions) {
          for (const mention of aiMentions) {
            const prompt = mention.replace('@aiAttorney', '').trim();
            const aiResponse = await this.getAIResponse(prompt);
            
            // Post AI response as a separate comment
            await this.postAIResponse(aiResponse);
          }
        }

        // Handle other mentions notifications...
        const mentionRegex = /<span data-mention[^>]*data-id="([^"]+)"[^>]*>@([^<]+)<\/span>/g;
        const mentions = [...this.newComment.matchAll(mentionRegex)];
        
        for (const mention of mentions) {
          const userId = mention[1];
          if (userId && userId !== user.id) {
            await this.createNotification(
              userId,
              'mention',
              { 
                task_id: this.task.id, 
                task_title: this.task.title,
                comment_by: user.email
              }
            );
          }
        }

        this.newComment = '';
        await this.loadComments();
        ElMessage.success('Comment added successfully');
      } catch (error) {
        ElMessage.error('Error adding comment: ' + error.message);
      } finally {
        this.loading = false;
      }
    },

    async postAIResponse(response) {
      try {
        const { error } = await supabase
          .from('task_comments')
          .insert({
            task_id: this.task.id,
            user_id: null,  // Using null for system/AI user
            content: response,
            type: 'ai_response',
            metadata: {
              is_ai: true,
              ai_name: 'AI Attorney'
            }
          });

        if (error) throw error;
      } catch (error) {
        console.error('Error posting AI response:', error);
        ElMessage.error('Error posting AI response');
      }
    },

    async getAIResponse(prompt) {
      try {
        // Get comment history for context
        const commentsHistory = this.comments.map(comment => {
          const timestamp = comment.updated_at || comment.created_at;
          const formattedDate = new Date(timestamp).toLocaleString();
          return `[${formattedDate}] ${this.userEmails[comment.user_id]}: ${comment.content}`;
        }).join('\n\n');

        // Create system prompt
        const systemPrompt = `You are an AI legal assistant helping with a task titled "${this.task.title}". ${
          this.task.description 
            ? `The task description is: ${this.task.description}\n\n`
            : ''
        }

Comment History:
${commentsHistory}

Please provide assistance based on this context, the comment history, and the user's prompt.`;

        const response = await fetch(`${this.pythonApiBaseUrl}/gpt/get_ai_response`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt,
            systemPrompt,
            taskId: this.task.id,
            matterId: this.task.matter_id
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
                if (!this.userEmails[payload.new.user_id] && payload.new.user_id) {
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
        
        // First get the matter's git repo
        const { data: matter, error: matterError } = await supabase
          .from('matters')
          .select('git_repo')
          .eq('id', this.task.matter_id)
          .single();

        if (matterError) {
          throw new Error('Failed to fetch matter details');
        }

        if (!matter?.git_repo) {
          throw new Error('No git repository found for this matter');
        }

        const path = this.currentSelectorFolder?.path || '';
        const response = await fetch(
          `${giteaHost}/api/v1/repos/associateattorney/${matter.git_repo}/contents/${path}`,
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
      
      // First handle user mentions with el-tag
      text = text.replace(/@\[([^\]]+)\]\(([^)]+)\)/g, 
        '<el-tag size="small" type="info" class="mention-tag">@$1</el-tag>'
      );
      
      // Then handle regular markdown links
      text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, 
        '<a href="$2" target="_blank" class="file-link">$1</a>'
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
          return `[${formattedDate}] ${this.userEmails[comment.user_id]}: ${comment.content}`;
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
            matterId: this.task.matter_id,
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
          .from('matter_access')
          .select('shared_with_user_id')
          .eq('matter_id', this.task.matter_id);

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
    }
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
  mounted() {
    this.handleClickOutside = (event) => {
      if (event.target.classList.contains('edited-marker')) {
        const commentId = event.target.dataset.commentId;
        if (this.expandedCommentHistories.has(commentId)) {
          this.expandedCommentHistories.delete(commentId);
        } else {
          this.expandedCommentHistories.add(commentId);
        }
        // Force update
        this.$forceUpdate();
      }
    };
    document.addEventListener('click', this.handleClickOutside);
    window.addEventListener('resize', this.handleResize);
    this.loadSharedUsers();
  }
};
</script>

<template>
  <el-drawer
    :model-value="visible"
    @update:model-value="$emit('update:visible', $event)"
    :title="`Comments - ${task.title}`"
    direction="rtl"
    :size="drawerSize">
    <template #header>
      <div style="display: flex; align-items: center; gap: 8px;">
        <span>Comments - {{ task.title }}</span>
        <div style="margin-left: auto; display: flex; gap: 8px;">
          <el-button
            type="primary"
            link
            @click="$router.push({
              name: 'SingleTaskPage',
              params: {
                matterId: task.matter_id,
                taskId: task.id
              }
            })"
            style="padding: 0">
            <el-icon><FullScreen /></el-icon>
          </el-button>

        </div>
      </div>
    </template>
    <div class="comments-container">
      <!-- Description section -->
      <div class="description-section">
        <div v-if="task.description" class="task-description">
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

      <!-- Comments section -->
      <div class="comments-section">
        <div class="comment-list">
          <div v-for="comment in comments" :key="comment.id" :class="['comment-item', { 'ai-response': comment.type === 'ai_response' }]">
            <div :class="['comment-content', comment.type === 'activity' ? 'activity' : '']">
              <div class="comment-header">
                <div class="comment-author-info">
                  <div class="author-avatar">
                    {{ comment.type === 'ai_response' ? 'AI' : userEmails[comment.user_id]?.charAt(0).toUpperCase() }}
                  </div>
                  <div class="author-details">
                    <span class="comment-author">
                      {{ comment.type === 'ai_response' ? 'AI Attorney' : userEmails[comment.user_id] }}
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

<style>
.comments-container {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 120px); /* Account for header and padding */
  overflow: hidden;
}

.description-section {
  flex-shrink: 0;
  max-height: none; /* Remove the max-height constraint */
  overflow-y: visible; /* Remove scroll */
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.el-drawer__header {
  margin-bottom: 0px !important;
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
</style>