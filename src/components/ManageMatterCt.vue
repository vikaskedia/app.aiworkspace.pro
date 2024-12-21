<script>
import { supabase } from '../supabase';
import { ElMessage } from 'element-plus';
import { useMatterStore } from '../store/matter';
import { storeToRefs } from 'pinia';

export default {
  setup() {
    const matterStore = useMatterStore();
    const { currentMatter } = storeToRefs(matterStore);
    return { currentMatter };
  },
  data() {
    return {
      loading: false,
      editingMatter: {
        title: '',
        description: ''
      },
      newShare: {
        email: '',
        access_type: 'view'
      },
      sharedUsers: []
    };
  },
  mounted() {
    if (this.currentMatter) {
      this.editingMatter = {
        title: this.currentMatter.title,
        description: this.currentMatter.description || ''
      };
      this.loadSharedUsers();
    }
  },
  methods: {
    async loadSharedUsers() {
      try {
        const { data: shares, error } = await supabase
          .from('matter_access')
          .select('id, shared_with_user_id, access_type, created_at')
          .eq('matter_id', this.currentMatter.id);

        if (error) throw error;

        // Get user details for each share
        const sharesWithUserInfo = await Promise.all(
          shares.map(async (share) => {
            const { data: userData, error: userError } = await supabase
              .rpc('get_user_info_by_id', {
                user_id: share.shared_with_user_id
              });

            if (userError) throw userError;

            return {
              ...share,
              user: userData[0] // Note: The function returns a table, so we take the first row
            };
          })
        );

        this.sharedUsers = sharesWithUserInfo;
      } catch (error) {
        ElMessage.error('Error loading shared users: ' + error.message);
      }
    },

    async updateMatter() {
      try {
        const { data, error } = await supabase
          .from('matters')
          .update({
            title: this.editingMatter.title,
            description: this.editingMatter.description
          })
          .eq('id', this.currentMatter.id)
          .select()
          .single();

        if (error) throw error;

        this.$store.commit('setCurrentMatter', data);
        ElMessage.success('Matter updated successfully');
      } catch (error) {
        ElMessage.error('Error updating matter: ' + error.message);
      }
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

    async shareMatter() {
      try {
        // Get user ID using the database function
        const { data: userId, error: userError } = await supabase
          .rpc('get_user_id_by_email', {
            email_address: this.newShare.email
          });

        if (userError) throw userError;
        if (!userId) throw new Error('User not found');

        const { data: { user } } = await supabase.auth.getUser();
        
        // Insert the share record
        const { data, error } = await supabase
          .from('matter_access')
          .insert({
            matter_id: this.currentMatter.id,
            shared_with_user_id: userId,
            created_by: user.id,
            access_type: this.newShare.access_type
          })
          .select();

        if (error) throw error;

        // Create notification for the user
        await this.createNotification(
          userId,
          'matter_shared',
          { 
            matter_id: this.currentMatter.id,
            matter_title: this.currentMatter.title,
            access_type: this.newShare.access_type
          }
        );
        
        await this.loadSharedUsers();
        this.dialogVisible = false;
        ElMessage.success('Matter shared successfully');
      } catch (error) {
        ElMessage.error('Error sharing matter: ' + error.message);
      }
    },

    async removeShare(shareId) {
      try {
        const { error } = await supabase
          .from('matter_access')
          .delete()
          .eq('id', shareId);

        if (error) throw error;

        await this.loadSharedUsers();
        ElMessage.success('Access removed successfully');
      } catch (error) {
        ElMessage.error('Error removing access: ' + error.message);
      }
    }
  }
};
</script>

<template>
  <div class="manage-matter">
    <div class="content">
      <h2>Manage Matter</h2>

      <!-- Matter Details Section -->
      <div class="section">
        <h3>Matter Details</h3>
        <el-form :model="editingMatter" label-position="top">
          <el-form-item label="Title" required>
            <el-input v-model="editingMatter.title" />
          </el-form-item>
          
          <el-form-item label="Description">
            <el-input
              v-model="editingMatter.description"
              type="textarea"
              rows="3" />
          </el-form-item>

          <el-form-item>
            <el-button 
              type="primary"
              @click="updateMatter"
              :disabled="!editingMatter.title">
              Save Changes
            </el-button>
          </el-form-item>
        </el-form>
      </div>

      <!-- Share Matter Section -->
      <div class="section">
        <h3>Share Matter</h3>
        <el-form :model="newShare" label-position="top">
          <div class="share-inputs">
            <el-form-item label="Email" required>
              <el-input v-model="newShare.email" placeholder="Enter email address" />
            </el-form-item>
            
            <el-form-item label="Access Type">
              <el-select v-model="newShare.access_type">
                <el-option label="View Access" value="view" />
                <el-option label="Edit Access" value="edit" />
              </el-select>
            </el-form-item>

            <el-button 
              type="primary"
              @click="shareMatter"
              :disabled="!newShare.email">
              Share
            </el-button>
          </div>
        </el-form>

        <!-- Shared Users List -->
        <div class="shared-users">
          <h4>Shared With</h4>
          <el-table :data="sharedUsers">
            <el-table-column label="User" min-width="200">
              <template #default="{ row }">
                {{ row.user.email }}
              </template>
            </el-table-column>
            
            <el-table-column prop="access_type" label="Access" width="120" />
            
            <el-table-column label="Actions" width="100" align="right">
              <template #default="{ row }">
                <el-button 
                  type="danger" 
                  size="small"
                  @click="removeShare(row.id)">
                  Remove
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.manage-matter {
  padding: 2rem;
}

.content {
  max-width: 800px;
  margin: 0 auto;
}

.section {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  margin-bottom: 2rem;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
}

.share-inputs {
  display: grid;
  grid-template-columns: 2fr 1fr auto;
  gap: 1rem;
  align-items: flex-end;
}

.shared-users {
  margin-top: 2rem;
}

h2 {
  margin-bottom: 2rem;
  font-size: 1.8rem;
  font-weight: 500;
}

h3 {
  margin-bottom: 1.5rem;
  font-size: 1.4rem;
  font-weight: 500;
}

h4 {
  margin: 1rem 0;
  font-size: 1.1rem;
  font-weight: 500;
}

@media (max-width: 640px) {
  .manage-matter {
    padding: 1rem;
  }

  .share-inputs {
    grid-template-columns: 1fr;
  }
}
</style> 