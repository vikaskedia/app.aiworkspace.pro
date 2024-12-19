<script>
import { ref, onMounted } from 'vue';
import { supabase } from '../supabase';
import { ElMessage } from 'element-plus';
import { useRouter } from 'vue-router';

export default {
  emits: ['matter-selected'],
  setup(props, { emit }) {
    const matters = ref([]);
    const selectedMatter = ref(null);
    const dialogVisible = ref(false);
    const newMatter = ref({
      title: '',
      description: ''
    });
    const router = useRouter();

    const loadMatters = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
          .from('matters')
          .select('*')
          .eq('created_by', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        matters.value = data;
      } catch (error) {
        ElMessage.error('Error loading matters: ' + error.message);
      }
    };

    const createMatter = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
          .from('matters')
          .insert([{
            title: newMatter.value.title,
            description: newMatter.value.description,
            created_by: user.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }])
          .select();

        if (error) throw error;
        
        matters.value.unshift(data[0]);
        dialogVisible.value = false;
        newMatter.value = { title: '', description: '' };
        ElMessage.success('Matter created successfully');
      } catch (error) {
        ElMessage.error('Error creating matter: ' + error.message);
      }
    };

    const handleMatterSelect = (matter) => {
      selectedMatter.value = matter;
      if (matter === null) {
        router.push('/all-matters');
      } else {
        emit('matter-selected', matter);
      }
    };

    onMounted(() => {
      loadMatters();
    });

    return {
      matters,
      selectedMatter,
      dialogVisible,
      newMatter,
      createMatter,
      handleMatterSelect
    };
  }
};
</script>

<template>
  <div class="matter-selector">
    <el-dropdown v-if="matters.length" trigger="click">
      <span class="matter-dropdown-link">
        {{ selectedMatter?.title || 'All Matters' }}
        <el-icon class="el-icon--right"><arrow-down /></el-icon>
      </span>
      
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item @click="handleMatterSelect(null)">
            All Matters
          </el-dropdown-item>
          <el-dropdown-item divided />
          <el-dropdown-item
            v-for="matter in matters"
            :key="matter.id"
            @click="handleMatterSelect(matter)">
            {{ matter.title }}
          </el-dropdown-item>
          <el-dropdown-item divided @click="dialogVisible = true">
            <el-icon><plus /></el-icon> New Matter
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>

    <el-button v-else type="primary" @click="dialogVisible = true">
      Create First Matter
    </el-button>

    <!-- Create Matter Dialog -->
    <el-dialog
      v-model="dialogVisible"
      title="Create New Matter"
      width="500px">
      <el-form :model="newMatter" label-position="top">
        <el-form-item label="Title" required>
          <el-input v-model="newMatter.title" placeholder="Enter matter title" />
        </el-form-item>
        
        <el-form-item label="Description">
          <el-input
            v-model="newMatter.description"
            type="textarea"
            rows="3"
            placeholder="Enter matter description" />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">Cancel</el-button>
          <el-button
            type="primary"
            :disabled="!newMatter.title"
            @click="createMatter">
            Create Matter
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.matter-selector {
  margin-right: 20px;
}

.matter-dropdown-link {
  color: #1a1a1a;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: 8px;
  transition: background-color 0.2s;
}

.matter-dropdown-link:hover {
  background-color: rgba(0, 0, 0, 0.03);
}

/* Style the dropdown icon */
.el-icon--right {
  color: #666;
  font-size: 12px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style> 