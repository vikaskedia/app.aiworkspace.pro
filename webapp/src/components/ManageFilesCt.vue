<script setup>
import { Plus } from '@element-plus/icons-vue';
</script>

<script>
import HeaderCt from './HeaderCt.vue';
import { supabase } from '../supabase';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useMatterStore } from '../store/matter';
import { storeToRefs } from 'pinia';

export default {
  components: { 
    HeaderCt
  },
  setup() {
    const matterStore = useMatterStore();
    const { currentMatter } = storeToRefs(matterStore);
    return { currentMatter };
  },
  data: function () {
    return {
      files: [],
      uploadDialogVisible: false,
      fileList: [],
      tags: [],
      selectedTags: [],
      tagInputVisible: false,
      tagInputValue: '',
      loading: false
    };
  },
  watch: {
    currentMatter: {
      handler(newMatter) {
        if (newMatter) {
          this.loadFiles();
        } else {
          this.files = [];
        }
      },
      immediate: true
    }
  },
  methods: {
    async loadFiles() {
      if (!this.currentMatter) return;
      
      try {
        this.loading = true;
        const { data: files, error } = await supabase
          .from('files')
          .select('*')
          .eq('matter_id', this.currentMatter.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        this.files = files;
      } catch (error) {
        ElMessage.error('Error loading files: ' + error.message);
      } finally {
        this.loading = false;
      }
    },

    async handleUpload(file) {
      if (!this.currentMatter) {
        ElMessage.warning('Please select a matter first');
        return false;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        const fileExt = file.name.split('.').pop();
        const filePath = `${this.currentMatter.id}/${user.id}/${Date.now()}.${fileExt}`;

        // Upload file to storage
        const { error: uploadError } = await supabase.storage
          .from('files')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Create file record in database
        const { data, error: dbError } = await supabase
          .from('files')
          .insert([{
            name: file.name,
            storage_path: filePath,
            size: file.size,
            type: file.type,
            tags: this.selectedTags,
            matter_id: this.currentMatter.id,
            created_by: user.id
          }])
          .select()
          .single();

        if (dbError) throw dbError;

        this.files.unshift(data);
        ElMessage.success('File uploaded successfully');
      } catch (error) {
        ElMessage.error('Error uploading file: ' + error.message);
        return false;
      }
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
