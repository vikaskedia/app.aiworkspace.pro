<script setup>
import { Plus } from '@element-plus/icons-vue';
</script>

<script>
import HeaderCt from './HeaderCt.vue';
import { supabase } from '../supabase';
import { ElMessage, ElMessageBox } from 'element-plus';

export default {
  data: function () {
    return {
      files: [
        {
          id: '1',
          name: 'Contract_Draft_v1.pdf',
          storage_path: 'dummy/path/Contract_Draft_v1.pdf',
          size: 1024000,
          type: 'application/pdf',
          tags: ['contract', 'draft'],
          created_at: '2024-03-15T10:30:00Z'
        },
        {
          id: '2',
          name: 'Legal_Brief_2024.docx',
          storage_path: 'dummy/path/Legal_Brief_2024.docx',
          size: 512000,
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          tags: ['brief', 'important'],
          created_at: '2024-03-14T15:45:00Z'
        },
        {
          id: '3',
          name: 'Evidence_Photo.jpg',
          storage_path: 'dummy/path/Evidence_Photo.jpg',
          size: 2048000,
          type: 'image/jpeg',
          tags: ['evidence', 'photo'],
          created_at: '2024-03-13T09:20:00Z'
        }
      ],
      uploadDialogVisible: false,
      fileList: [],
      tags: [],
      selectedTags: [],
      tagInputVisible: false,
      tagInputValue: '',
      loading: false
    };
  },
  components: { 
    HeaderCt
  },
  created: async function () {
    // await this.loadFiles(); // Uncomment this when switching to real data
  },
  methods: {
    async loadFiles() {
      try {
        this.loading = true;
        const { data: files, error } = await supabase
          .from('files')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        this.files = files;
      } catch (error) {
        ElMessage.error('Error loading files: ' + error.message);
      } finally {
        this.loading = false;
      }
    },

    async handleFileUpload(file) {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user?.id) throw new Error('User not authenticated');

        // Upload file to Supabase Storage
        const fileName = `${Date.now()}-${file.name}`;
        const { data, error } = await supabase.storage
          .from('files')
          .upload(`${userData.user.id}/${fileName}`, file);

        if (error) throw error;

        // Create file record in database
        const { error: dbError } = await supabase
          .from('files')
          .insert([{
            name: file.name,
            storage_path: data.path,
            size: file.size,
            type: file.type,
            tags: this.selectedTags,
            user_id: userData.user.id
          }]);

        if (dbError) throw dbError;

        ElMessage.success('File uploaded successfully');
        this.uploadDialogVisible = false;
        await this.loadFiles();
      } catch (error) {
        ElMessage.error('Upload failed: ' + error.message);
      }
    },

    async deleteFile(file) {
      try {
        // Show confirmation dialog
        await ElMessageBox.confirm(
          `Are you sure you want to delete "${file.name}"?`,
          'Delete File',
          {
            confirmButtonText: 'Delete',
            cancelButtonText: 'Cancel',
            type: 'warning',
          }
        );

        // Delete from storage
        const { error: storageError } = await supabase.storage
          .from('files')
          .remove([file.storage_path]);

        if (storageError) throw storageError;

        // Delete from database
        const { error: dbError } = await supabase
          .from('files')
          .delete()
          .match({ id: file.id });

        if (dbError) throw dbError;

        ElMessage.success('File deleted successfully');
        await this.loadFiles();
      } catch (error) {
        if (error === 'cancel') return; // User cancelled the deletion
        ElMessage.error('Delete failed: ' + error.message);
      }
    },

    showTagInput() {
      this.tagInputVisible = true;
      this.$nextTick(_ => {
        this.$refs.tagInput.focus();
      });
    },

    handleTagInputConfirm() {
      if (this.tagInputValue) {
        this.selectedTags.push(this.tagInputValue);
      }
      this.tagInputVisible = false;
      this.tagInputValue = '';
    }
  }
};
</script>

<template>
  <div class="manage-files">
    <HeaderCt />
    
    <div class="content">
      <div class="header">
        <h2>Manage Files</h2>
        <el-button type="primary" @click="uploadDialogVisible = true" size="small" :icon="Plus">
          Upload Files
        </el-button>
      </div>

      <el-table
        v-loading="loading"
        :data="files"
        style="width: 100%"
        :default-sort="{ prop: 'created_at', order: 'descending' }">
        
        <el-table-column 
          prop="name" 
          label="File Name"
          min-width="120" />
          
        <el-table-column 
          prop="type" 
          label="Type" 
          width="120"
          :show-overflow-tooltip="true" />
          
        <el-table-column 
          prop="size" 
          label="Size" 
          width="90">
          <template #default="scope">
            {{ Math.round(scope.row.size / 1024) }} KB
          </template>
        </el-table-column>
        
        <el-table-column 
          prop="tags" 
          label="Tags" 
          width="200"
          :show-overflow-tooltip="true">
          <template #default="scope">
            <el-tag
              v-for="tag in scope.row.tags"
              :key="tag"
              size="small"
              style="margin: 2px">
              {{ tag }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column 
          label="Actions" 
          width="90"
          fixed="right">
          <template #default="scope">
            <el-button
              type="danger"
              size="small"
              @click="deleteFile(scope.row)">
              Delete
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

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
        :on-change="(file) => fileList = [file]"
        :file-list="fileList">
        <el-icon class="el-icon--upload"><upload-filled /></el-icon>
        <div class="el-upload__text">
          Drop file here or <em>click to upload</em>
        </div>
      </el-upload>

      <div class="tags-section">
        <h4>Add Tags</h4>
        <div class="tags-input">
          <el-tag
            v-for="tag in selectedTags"
            :key="tag"
            closable
            @close="selectedTags.splice(selectedTags.indexOf(tag), 1)">
            {{ tag }}
          </el-tag>
          <el-input
            v-if="tagInputVisible"
            ref="tagInput"
            v-model="tagInputValue"
            size="small"
            style="width: 100px"
            @keyup.enter="handleTagInputConfirm"
            @blur="handleTagInputConfirm"
          />
          <el-button v-else size="small" @click="showTagInput">
            + New Tag
          </el-button>
        </div>
      </div>

      <template #footer>
        <span class="dialog-footer">
          <el-button @click="uploadDialogVisible = false">Cancel</el-button>
          <el-button
            type="primary"
            @click="handleFileUpload(fileList[0].raw)"
            :disabled="!fileList.length">
            Upload
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.manage-files {
  min-height: 100vh;
  background-color: #f5f7fa;
  font-family: 'Roboto', sans-serif;
}

.content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.header h2 {
  margin: 0;
  font-size: 1.7rem;
  font-weight: 500;
  color: #303133;
}

/* Add responsive padding for mobile */
@media (max-width: 640px) {
  .content {
    padding: 1rem;
  }
  
  .header {
    flex-direction: row;
    gap: 1rem;
    align-items: center;
  }
  
  .header h2 {
    font-size: 1.4rem;
    flex: 1;
  }
  
  /* Make upload button full width on mobile */
  .header .el-button {
    width: auto;
    white-space: nowrap;
  }
  
  /* Adjust table for mobile */
  :deep(.el-table) {
    font-size: 0.9rem;
  }
  
  /* Hide less important columns on mobile */
  :deep(.el-table .cell) {
    padding: 8px;
  }
  
  /* Adjust upload dialog for mobile */
  :deep(.el-dialog) {
    width: 90% !important;
    margin: 0 auto;
  }
  
  /* Make tags wrap better on mobile */
  .tags-input {
    gap: 0.25rem;
  }
  
  /* Adjust tag input sizing */
  :deep(.el-input) {
    width: 80px !important;
  }
  
  /* Make dialog buttons stack on mobile */
  .dialog-footer {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .dialog-footer .el-button {
    width: 100%;
  }
}

/* Adjust table column widths for better mobile display */
@media (max-width: 480px) {
  :deep(.el-table) {
    /* Allow horizontal scroll for table */
    display: block;
    overflow-x: auto;
    white-space: nowrap;
  }
  
  /* Ensure minimum width for action buttons */
  :deep(.el-button--small) {
    min-width: 60px;
  }
}
</style>
