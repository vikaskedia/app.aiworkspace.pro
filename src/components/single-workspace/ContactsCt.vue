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
        <el-table-column prop="name" label="Name" min-width="200">
          <template #default="{ row }">
            <div class="contact-name">
              <span v-if="!row.editing">{{ row.name }}</span>
              <el-input 
                v-else 
                v-model="row.editName" 
                size="small"
                @keyup.esc="cancelEdit(row)"
                ref="editInput"
              />
            </div>
          </template>
        </el-table-column>
        
        <el-table-column prop="phone_number" label="Phone Number" min-width="150">
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
        
        <el-table-column prop="tags" label="Tags" min-width="200">
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
      width="500px"
    >
      <el-form
        ref="contactFormRef"
        :model="contactForm"
        :rules="contactRules"
        label-width="116px"
      >
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
import { Plus, Edit, Delete, Check, Close } from '@element-plus/icons-vue';
import { useMatterStore } from '../../store/matter';
import { storeToRefs } from 'pinia';
import { updateMatterActivity } from '../../utils/matterActivity';

export default {
  name: 'ContactsCt',
  components: {
    Plus,
    Edit,
    Delete,
    Check,
    Close
  },
  setup() {
    const matterStore = useMatterStore();
    const { currentMatter } = storeToRefs(matterStore);
    
    return { currentMatter };
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
        tags: []
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
    currentMatter: {
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
      if (!this.currentMatter) return;

      try {
        this.loading = true;
        const { data: contacts, error } = await supabase
          .from('contacts')
          .select('*')
          .eq('matter_id', this.currentMatter.id)
          .eq('archived', false)
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        // Add editing state to each contact
        this.contacts = contacts.map(contact => ({
          ...contact,
          editing: false,
          editName: contact.name,
          editPhone: contact.phone_number || '',
          editTags: contact.tags || []
        }));
      } catch (error) {
        ElMessage.error('Error loading contacts: ' + error.message);
      } finally {
        this.loading = false;
      }
    },

    setupRealtimeSubscription() {
      if (!this.currentMatter) return;

      this.subscription = supabase
        .channel('contacts_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'contacts',
            filter: `matter_id=eq.${this.currentMatter.id}`
          },
          () => {
            this.loadContacts();
          }
        )
        .subscribe();
    },

    async saveContact() {
      if (!this.currentMatter) {
        ElMessage.warning('Please select a matter first');
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
          .eq('matter_id', this.currentMatter.id)
          .eq('shared_with_user_id', user.id)
          .eq('access_type', 'edit')
          .single();

        if (accessError || !accessCheck) {
          throw new Error('You do not have edit access to this matter');
        }

        const contactData = {
          name: this.contactForm.name.trim(),
          phone_number: this.contactForm.phone_number.trim() || null,
          tags: this.contactForm.tags,
          matter_id: this.currentMatter.id,
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
          editTags: data.tags || []
        });
        
        // Update matter activity
        await updateMatterActivity(this.currentMatter.id);
        
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
        
        const { error } = await supabase
          .from('contacts')
          .update({
            name: contact.editName.trim(),
            phone_number: contact.editPhone.trim() || null,
            tags: contact.editTags,
            updated_at: new Date().toISOString()
          })
          .eq('id', contact.id);

        if (error) throw error;
        
        // Update local state
        contact.name = contact.editName.trim();
        contact.phone_number = contact.editPhone.trim() || null;
        contact.tags = contact.editTags;
        contact.editing = false;
        
        // Update matter activity
        await updateMatterActivity(this.currentMatter.id);
        
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
        
        // Update matter activity
        await updateMatterActivity(this.currentMatter.id);
        
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
        tags: []
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
            this.newMessageForm.to = this.formatPhoneNumber(newValue);
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
}
</style> 