<template>
  <div class="contacts-container">
    <div class="contacts-header">
      <h1>Contacts</h1>
      <el-button type="primary" @click="dialogVisible = true" :icon="Plus">
        Add Contact
      </el-button>
    </div>

    <!-- Contact Table -->
    <div class="contacts-table" v-loading="loading">
      <el-table 
        :data="contacts" 
        style="width: 100%"
        :empty-text="loading ? 'Loading...' : 'No contacts yet'"
      >
        <el-table-column prop="name" label="Name" min-width="150">
          <template #default="{ row }">
            <div class="contact-name">
              <div class="contact-avatar-name">
                <div class="contact-avatar" v-if="row.profile_picture_url">
                  <img :src="row.profile_picture_url" :alt="row.name" />
                </div>
                <div class="contact-avatar" v-else>
                  <el-icon><User /></el-icon>
                </div>
                <span v-if="!row.editing">{{ row.name }}</span>
                <el-input 
                  v-else 
                  v-model="row.editName" 
                  size="small"
                  @keyup.esc="cancelEdit(row)"
                  ref="editInput"
                />
              </div>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column prop="phone_number" label="Phone Number" min-width="130">
          <template #default="{ row }">
            <div v-if="!row.editing">
              <span v-if="row.phone_number">{{ row.phone_number }}</span>
              <span v-else class="text-muted">-</span>
            </div>
            <el-input 
              v-else 
              v-model="row.editPhone" 
              size="small"
              placeholder="Enter phone number"
              @keyup.esc="cancelEdit(row)"
            />
          </template>
        </el-table-column>

        <el-table-column prop="email" label="Email" min-width="180">
          <template #default="{ row }">
            <div v-if="!row.editing">
              <span v-if="row.email">{{ row.email }}</span>
              <span v-else class="text-muted">-</span>
            </div>
            <el-input 
              v-else 
              v-model="row.editEmail" 
              size="small"
              placeholder="Enter email"
              @keyup.esc="cancelEdit(row)"
            />
          </template>
        </el-table-column>

        <el-table-column prop="company" label="Company" min-width="120">
          <template #default="{ row }">
            <div v-if="!row.editing">
              <span v-if="row.company">{{ row.company }}</span>
              <span v-else class="text-muted">-</span>
            </div>
            <el-input 
              v-else 
              v-model="row.editCompany" 
              size="small"
              placeholder="Enter company"
              @keyup.esc="cancelEdit(row)"
            />
          </template>
        </el-table-column>

        <el-table-column prop="role" label="Role" min-width="100">
          <template #default="{ row }">
            <div v-if="!row.editing">
              <span v-if="row.role">{{ row.role }}</span>
              <span v-else class="text-muted">-</span>
            </div>
            <el-input 
              v-else 
              v-model="row.editRole" 
              size="small"
              placeholder="Enter role"
              @keyup.esc="cancelEdit(row)"
            />
          </template>
        </el-table-column>

        <el-table-column prop="matter_text" label="Workspace" min-width="150">
          <template #default="{ row }">
            <div v-if="!row.editing">
              <span v-if="row.matter_text">{{ row.matter_text }}</span>
              <span v-else class="text-muted">-</span>
            </div>
            <el-input 
              v-else 
              v-model="row.editMatterText" 
              size="small"
              placeholder="Enter workspace"
              @keyup.esc="cancelEdit(row)"
            />
          </template>
        </el-table-column>

        <el-table-column prop="address" label="Address" min-width="200">
          <template #default="{ row }">
            <div v-if="!row.editing">
              <span v-if="row.address" class="address-text">{{ row.address }}</span>
              <span v-else class="text-muted">-</span>
            </div>
            <el-input 
              v-else 
              v-model="row.editAddress" 
              type="textarea"
              :rows="2"
              size="small"
              placeholder="Enter address"
              @keyup.esc="cancelEdit(row)"
            />
          </template>
        </el-table-column>
        
        <el-table-column prop="tags" label="Tags" min-width="150">
          <template #default="{ row }">
            <div v-if="!row.editing">
              <el-tag 
                v-for="tag in row.tags" 
                :key="tag" 
                size="small" 
                type="info"
                class="tag"
              >
                {{ tag }}
              </el-tag>
              <span v-if="!row.tags || row.tags.length === 0" class="text-muted">-</span>
            </div>
            <el-select
              v-else
              v-model="row.editTags"
              multiple
              filterable
              allow-create
              default-first-option
              size="small"
              placeholder="Add tags"
              style="width: 100%"
              @keyup.esc="cancelEdit(row)"
            >
              <el-option
                v-for="tag in availableTags"
                :key="tag"
                :label="tag"
                :value="tag"
              />
            </el-select>
          </template>
        </el-table-column>
        
        <el-table-column label="Actions" width="120" fixed="right">
          <template #default="{ row }">
            <div class="action-buttons">
              <template v-if="!row.editing">
                <el-button 
                  type="primary" 
                  size="small" 
                  :icon="Edit"
                  @click="startEdit(row)"
                  title="Edit"
                >Edit</el-button>
                <el-button 
                  type="danger" 
                  size="small" 
                  :icon="Delete"
                  @click="deleteContact(row)"
                  title="Delete"
                >Delete</el-button>
              </template>
              <template v-else>
                <el-button 
                  type="success" 
                  size="small" 
                  :icon="Check"
                  @click="saveEdit(row)"
                  title="Save"
                >Save</el-button>
                <el-button 
                  type="warning" 
                  size="small" 
                  :icon="Close"
                  @click="cancelEdit(row)"
                  title="Cancel"
                >Cancel</el-button>
              </template>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- Add Contact Dialog -->
    <el-dialog
      v-model="dialogVisible"
      title="Add New Contact"
      width="600px"
    >
      <el-form
        ref="contactFormRef"
        :model="contactForm"
        :rules="contactRules"
        label-width="120px"
      >
        <el-form-item label="Profile Picture">
          <el-upload
            ref="profileUpload"
            :show-file-list="false"
            :before-upload="handleProfilePictureSelect"
            :multiple="false"
            accept="image/*"
            action="#"
            class="profile-upload"
          >
            <div class="profile-upload-area">
              <div v-if="contactForm.profile_picture_url" class="profile-preview">
                <img :src="contactForm.profile_picture_url" alt="Profile" />
              </div>
              <div v-else class="profile-placeholder">
                <el-icon><Plus /></el-icon>
                <span>Upload Profile Picture</span>
              </div>
            </div>
          </el-upload>
          <div v-if="contactForm.profile_picture_url" class="profile-actions">
            <el-button size="small" @click="removeProfilePicture" type="danger" plain>
              Remove
            </el-button>
          </div>
        </el-form-item>

        <el-form-item label="Name" prop="name">
          <el-input 
            v-model="contactForm.name" 
            placeholder="Enter contact name"
            maxlength="100"
            show-word-limit
          />
        </el-form-item>
        
        <el-form-item label="Phone Number" prop="phone_number">
          <el-input 
            v-model="contactForm.phone_number" 
            maxlength="14"
            placeholder="(555) 123-4567"
            @input="onPhoneNumberInput"
            @keydown="onPhoneKeyDown"
          >
            <template #prepend>
              <el-button disabled style="width: 48px;">+1</el-button>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item label="Email">
          <el-input 
            v-model="contactForm.email" 
            placeholder="Enter email address"
            type="email"
            maxlength="255"
          />
        </el-form-item>

        <el-form-item label="Company">
          <el-input 
            v-model="contactForm.company" 
            placeholder="Enter company name"
            maxlength="100"
          />
        </el-form-item>

        <el-form-item label="Role">
          <el-input 
            v-model="contactForm.role" 
            placeholder="Enter job role/title"
            maxlength="100"
          />
        </el-form-item>

        <el-form-item label="Workspace">
          <el-input 
            v-model="contactForm.matter_text" 
            placeholder="Enter workspace description"
            maxlength="200"
          />
        </el-form-item>

        <el-form-item label="Address">
          <el-input 
            v-model="contactForm.address" 
            type="textarea"
            :rows="3"
            placeholder="Enter address"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
        
        <el-form-item label="Tags">
          <el-select
            v-model="contactForm.tags"
            multiple
            filterable
            allow-create
            default-first-option
            placeholder="Add tags"
            style="width: 100%"
          >
            <el-option
              v-for="tag in availableTags"
              :key="tag"
              :label="tag"
              :value="tag"
            />
          </el-select>
        </el-form-item>
      </el-form>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">Cancel</el-button>
          <el-button 
            type="primary" 
            @click="saveContact"
            :loading="saving"
          >
            Save
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { supabase } from '../../supabase';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Edit, Delete, Check, Close, User } from '@element-plus/icons-vue';
import { useWorkspaceStore } from '../../store/workspace';
import { storeToRefs } from 'pinia';
import { updateMatterActivity } from '../../utils/workspaceActivity';

export default {
  name: 'ContactsCt',
  components: {
    Plus,
    Edit,
    Delete,
    Check,
    Close,
    User
  },
  setup() {
    const workspaceStore = useWorkspaceStore();
    const { currentWorkspace } = storeToRefs(workspaceStore);
    
    return { currentWorkspace };
  },
  data() {
    return {
      contacts: [],
      loading: false,
      saving: false,
      dialogVisible: false,
      contactForm: {
        name: '',
        phone_number: '',
        email: '',
        company: '',
        role: '',
        matter_text: '',
        address: '',
        tags: [],
        profile_picture_url: null,
        profile_picture_file: null
      },
      contactRules: {
        name: [
          { required: true, message: 'Name is required', trigger: 'blur' },
          { min: 1, max: 100, message: 'Name must be between 1 and 100 characters', trigger: 'blur' }
        ],
        phone_number: [
          { required: true, message: 'Phone number is required', trigger: 'blur' }
        ]
      },
      subscription: null
    };
  },
  computed: {
    availableTags() {
      const allTags = new Set();
      this.contacts.forEach(contact => {
        if (contact.tags) {
          contact.tags.forEach(tag => allTags.add(tag));
        }
      });
      return Array.from(allTags).sort();
    }
  },
  watch: {
    currentWorkspace: {
      handler(newMatter, oldMatter) {
        if (newMatter) {
          this.loadContacts();
          if (!oldMatter) {
            this.setupRealtimeSubscription();
          }
        } else {
          if (this.subscription) {
            this.subscription.unsubscribe();
          }
          this.contacts = [];
        }
      },
      immediate: true
    }
  },
  beforeUnmount() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  },
  methods: {
    async loadContacts() {
      if (!this.currentWorkspace) return;

      try {
        this.loading = true;
        const { data: contacts, error } = await supabase
          .from('contacts')
          .select('*')
          .eq('matter_id', this.currentWorkspace.id)
          .eq('archived', false)
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        // Add editing state to each contact
        this.contacts = contacts.map(contact => ({
          ...contact,
          editing: false,
          editName: contact.name,
          editPhone: contact.phone_number || '',
          editEmail: contact.email || '',
          editCompany: contact.company || '',
          editRole: contact.role || '',
          editMatterText: contact.matter_text || '',
          editAddress: contact.address || '',
          editTags: contact.tags || []
        }));
      } catch (error) {
        ElMessage.error('Error loading contacts: ' + error.message);
      } finally {
        this.loading = false;
      }
    },

    setupRealtimeSubscription() {
      if (!this.currentWorkspace) return;

      this.subscription = supabase
        .channel('contacts_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'contacts',
            filter: `matter_id=eq.${this.currentWorkspace.id}`
          },
          () => {
            this.loadContacts();
          }
        )
        .subscribe();
    },

    async handleProfilePictureSelect(file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        ElMessage.error('Please select an image file');
        return false;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        ElMessage.error('Image file is too large. Maximum allowed size is 5MB.');
        return false;
      }

      // Store the file for later upload
      this.contactForm.profile_picture_file = file;
      
      // Create a preview URL
      const reader = new FileReader();
      reader.onload = (e) => {
        this.contactForm.profile_picture_url = e.target.result;
      };
      reader.readAsDataURL(file);

      return false; // Prevent automatic upload
    },

    removeProfilePicture() {
      this.contactForm.profile_picture_url = null;
      this.contactForm.profile_picture_file = null;
    },

    async uploadProfilePicture() {
      if (!this.contactForm.profile_picture_file) {
        return null;
      }

      try {
        const giteaToken = import.meta.env.VITE_GITEA_TOKEN;
        const giteaHost = import.meta.env.VITE_GITEA_HOST;

        // Create unique filename
        const timestamp = Date.now();
        const fileExtension = this.contactForm.profile_picture_file.name.split('.').pop();
        const uniqueName = `profile_${timestamp}.${fileExtension}`;
        const uploadPath = `contacts/profiles/${uniqueName}`;

        // Convert file to base64
        const base64Content = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
          };
          reader.readAsDataURL(this.contactForm.profile_picture_file);
        });

        // Upload to Gitea
        const response = await fetch(
          `${giteaHost}/api/v1/repos/associateattorney/${this.currentWorkspace.git_repo}/contents/${uploadPath}`,
          {
            method: 'POST',
            headers: {
              'Authorization': `token ${giteaToken}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Cache-Control': 'no-cache'
            },
            body: JSON.stringify({
              message: `Upload profile picture: ${this.contactForm.profile_picture_file.name}`,
              content: base64Content,
              branch: 'main'
            })
          }
        );

        if (!response.ok) {
          throw new Error('Failed to upload profile picture to Gitea');
        }

        const giteaData = await response.json();
        return this.getAuthenticatedDownloadUrl(giteaData.content.download_url);
      } catch (error) {
        console.error('Error uploading profile picture:', error);
        throw new Error('Failed to upload profile picture: ' + error.message);
      }
    },

    getAuthenticatedDownloadUrl(downloadUrl) {
      if (!downloadUrl) return '';
      try {
        const url = new URL(downloadUrl);
        url.searchParams.set('token', import.meta.env.VITE_GITEA_TOKEN);
        return url.toString();
      } catch (error) {
        console.error('Error creating authenticated URL:', error);
        return downloadUrl;
      }
    },

    async saveContact() {
      if (!this.currentWorkspace) {
        ElMessage.warning('Please select a workspace first');
        return;
      }

      try {
        await this.$refs.contactFormRef.validate();
        this.saving = true;
        
        const { data: { user } } = await supabase.auth.getUser();
        
        // Verify workspace access
        const { data: accessCheck, error: accessError } = await supabase
          .from('workspace_access')
          .select('access_type')
          .eq('matter_id', this.currentWorkspace.id)
          .eq('shared_with_user_id', user.id)
          .eq('access_type', 'edit')
          .single();

        if (accessError || !accessCheck) {
          throw new Error('You do not have edit access to this workspace');
        }

        // Upload profile picture if selected
        let profilePictureUrl = null;
        if (this.contactForm.profile_picture_file) {
          profilePictureUrl = await this.uploadProfilePicture();
        }

        // Remove all non-digit characters and save only the last 10 digits
        const digits = this.contactForm.phone_number.replace(/\D/g, '');
        const phone_number = digits.slice(-10);

        const contactData = {
          name: this.contactForm.name.trim(),
          phone_number: phone_number,
          email: this.contactForm.email.trim() || null,
          company: this.contactForm.company.trim() || null,
          role: this.contactForm.role.trim() || null,
          matter_text: this.contactForm.matter_text.trim() || null,
          address: this.contactForm.address.trim() || null,
          profile_picture_url: profilePictureUrl,
          tags: this.contactForm.tags,
          matter_id: this.currentWorkspace.id,
          created_by: user.id
        };

        const { data, error } = await supabase
          .from('contacts')
          .insert([contactData])
          .select()
          .single();

        if (error) throw error;
        
        // Update local state
        this.contacts.unshift({
          ...data,
          editing: false,
          editName: data.name,
          editPhone: data.phone_number || '',
          editEmail: data.email || '',
          editCompany: data.company || '',
          editRole: data.role || '',
          editMatterText: data.matter_text || '',
          editAddress: data.address || '',
          editTags: data.tags || []
        });
        
        // Update workspace activity
        await updateMatterActivity(this.currentWorkspace.id);
        
        this.dialogVisible = false;
        this.resetForm();
        ElMessage.success('Contact created successfully');
      } catch (error) {
        console.error('Error saving contact:', error);
        ElMessage.error('Error saving contact: ' + error.message);
      } finally {
        this.saving = false;
      }
    },

    startEdit(contact) {
      contact.editing = true;
      contact.editName = contact.name;
      contact.editPhone = contact.phone_number || '';
      contact.editEmail = contact.email || '';
      contact.editCompany = contact.company || '';
      contact.editRole = contact.role || '';
      contact.editMatterText = contact.matter_text || '';
      contact.editAddress = contact.address || '';
      contact.editTags = contact.tags || [];
      
      // Focus on the name input after a short delay
      this.$nextTick(() => {
        const editInput = this.$refs.editInput;
        if (editInput && editInput[0]) {
          editInput[0].focus();
        }
      });
    },

    async saveEdit(contact) {
      try {
        // Validate name
        if (!contact.editName.trim()) {
          ElMessage.error('Name is required');
          return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        
        // Remove all non-digit characters and save only the last 10 digits
        const digits = contact.editPhone.replace(/\D/g, '');
        const phone_number = digits.slice(-10);

        const { error } = await supabase
          .from('contacts')
          .update({
            name: contact.editName.trim(),
            phone_number: phone_number,
            email: contact.editEmail.trim() || null,
            company: contact.editCompany.trim() || null,
            role: contact.editRole.trim() || null,
            matter_text: contact.editMatterText.trim() || null,
            address: contact.editAddress.trim() || null,
            tags: contact.editTags,
            updated_at: new Date().toISOString()
          })
          .eq('id', contact.id);

        if (error) throw error;
        
        // Update local state
        contact.name = contact.editName.trim();
        contact.phone_number = phone_number;
        contact.email = contact.editEmail.trim() || null;
        contact.company = contact.editCompany.trim() || null;
        contact.role = contact.editRole.trim() || null;
        contact.matter_text = contact.editMatterText.trim() || null;
        contact.address = contact.editAddress.trim() || null;
        contact.tags = contact.editTags;
        contact.editing = false;
        
        // Update workspace activity
        await updateMatterActivity(this.currentWorkspace.id);
        
        ElMessage.success('Contact updated successfully');
      } catch (error) {
        console.error('Error updating contact:', error);
        ElMessage.error('Error updating contact: ' + error.message);
      }
    },

    cancelEdit(contact) {
      contact.editing = false;
      contact.editName = contact.name;
      contact.editPhone = contact.phone_number || '';
      contact.editEmail = contact.email || '';
      contact.editCompany = contact.company || '';
      contact.editRole = contact.role || '';
      contact.editMatterText = contact.matter_text || '';
      contact.editAddress = contact.address || '';
      contact.editTags = contact.tags || [];
    },

    async deleteContact(contact) {
      try {
        await ElMessageBox.confirm(
          `Are you sure you want to delete "${contact.name}"? This action cannot be undone.`,
          'Delete Contact',
          {
            confirmButtonText: 'Delete',
            cancelButtonText: 'Cancel',
            type: 'warning'
          }
        );

        const { error } = await supabase
          .from('contacts')
          .delete()
          .eq('id', contact.id);

        if (error) throw error;
        
        // Remove from local state
        this.contacts = this.contacts.filter(c => c.id !== contact.id);
        
        // Update workspace activity
        await updateMatterActivity(this.currentWorkspace.id);
        
        ElMessage.success('Contact deleted successfully');
      } catch (error) {
        if (error !== 'cancel') {
          console.error('Error deleting contact:', error);
          ElMessage.error('Error deleting contact: ' + error.message);
        }
      }
    },

    resetForm() {
      this.contactForm = {
        name: '',
        phone_number: '',
        email: '',
        company: '',
        role: '',
        matter_text: '',
        address: '',
        tags: [],
        profile_picture_url: null,
        profile_picture_file: null
      };
      this.$refs.contactFormRef?.resetFields();
    },

    formatDate(dateString) {
      return new Date(dateString).toLocaleDateString();
    },

    onPhoneKeyDown(event) {
      // Allow backspace to work normally on formatting characters
      if (event.key === 'Backspace') {
        const input = event.target;
        const cursorPos = input.selectionStart;
        const value = input.value;
        
        // If cursor is at a formatting character, move it past it
        if (cursorPos > 0) {
          const charAtCursor = value[cursorPos - 1];
          if (charAtCursor === '(' || charAtCursor === ')' || charAtCursor === ' ' || charAtCursor === '-') {
            // Prevent default and manually handle
            event.preventDefault();
            // Remove the digit before the formatting character
            const beforeFormat = value.substring(0, cursorPos - 2);
            const afterCursor = value.substring(cursorPos);
            const newValue = beforeFormat + afterCursor;
            this.contactForm.phone_number = this.formatPhoneNumber(newValue);
            return;
          }
        }
      }
    },
    formatPhoneNumber(value) {
      // Extract only digits
      const digits = value.replace(/\D/g, '');
      const limited = digits.substring(0, 10);
      
      if (limited.length === 0) return '';
      if (limited.length <= 3) return `(${limited}`;
      if (limited.length <= 6) return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
      return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
    },
    onPhoneNumberInput(value) {
      this.contactForm.phone_number = this.formatPhoneNumber(value);
    },
  }
};
</script>

<style scoped>
.contacts-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.contacts-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.contacts-header h1 {
  margin: 0;
  color: #2c3e50;
}

.contacts-table {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.contact-name {
  font-weight: 500;
}

.contact-avatar-name {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.contact-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #1976d2;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}

.contact-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.contact-avatar .el-icon {
  font-size: 16px;
}

.address-text {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
  max-height: 2.6em;
}

.text-muted {
  color: #999;
  font-style: italic;
}

.tag {
  margin-right: 0.25rem;
  margin-bottom: 0.25rem;
}

.action-buttons {
  display: flex;
  justify-content: center;
}

/* Profile Picture Upload Styles */
.profile-upload {
  width: 100%;
}

.profile-upload-area {
  width: 100%;
  height: 120px;
  border: 2px dashed #d9d9d9;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.3s;
}

.profile-upload-area:hover {
  border-color: #409eff;
}

.profile-preview {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.profile-preview img {
  max-width: 100%;
  max-height: 100%;
  object-fit: cover;
  border-radius: 6px;
}

.profile-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  color: #999;
}

.profile-placeholder .el-icon {
  font-size: 2rem;
}

.profile-actions {
  margin-top: 0.5rem;
  text-align: center;
}

@media (max-width: 768px) {
  .contacts-container {
    padding: 1rem;
  }
  
  .contacts-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
  
  .action-buttons {
    flex-direction: column;
    gap: 0.25rem;
  }

  .contact-avatar-name {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
}
</style> 