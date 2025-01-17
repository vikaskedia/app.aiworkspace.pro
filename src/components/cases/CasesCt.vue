<template>
  <div class="cases-container">
    <HeaderCt />
    <div class="content">
      <div class="actions">
        <el-button type="primary" @click="showCreateDialog = true" size="small">
          <el-icon><Plus /></el-icon>
          Create New Case
        </el-button>
      </div>

      <div class="cases-grid">
        <el-card v-for="legalCase in cases" :key="legalCase.id" class="case-card" shadow="hover">
          <div class="case-header">
            <h3>{{ legalCase.title }}</h3>
            <el-tag size="small" :type="getStatusType(legalCase.status)">
              {{ legalCase.status }}
            </el-tag>
          </div>

          <div class="case-details">
            <p><strong>Case Number:</strong> {{ legalCase.case_number }}</p>
            <p><strong>Court:</strong> {{ legalCase.court }}</p>
            <p><strong>Filed Date:</strong> {{ formatDate(legalCase.filed_date) }}</p>
            <p class="case-description">{{ legalCase.description }}</p>
          </div>

          <div class="case-actions">
            <el-button-group>
              <el-button type="primary" @click="viewCase(legalCase)" size="small">
                View Details
              </el-button>
              <el-button type="warning" @click="editCase(legalCase)" size="small">
                <el-icon><Edit /></el-icon>
              </el-button>
            </el-button-group>
          </div>
        </el-card>
      </div>
    </div>

    <!-- Create/Edit Case Dialog -->
    <el-dialog
      v-model="showCreateDialog"
      :title="editingCase ? 'Edit Case' : 'Create New Case'"
      width="500px"
    >
      <el-form :model="caseForm" label-position="top">
        <el-form-item label="Title">
          <el-input v-model="caseForm.title" />
        </el-form-item>
        <el-form-item label="Case Number">
          <el-input v-model="caseForm.case_number" />
        </el-form-item>
        <el-form-item label="Court">
          <el-input v-model="caseForm.court" />
        </el-form-item>
        <el-form-item label="Filed Date">
          <el-date-picker v-model="caseForm.filed_date" type="date" />
        </el-form-item>
        <el-form-item label="Status">
          <el-select v-model="caseForm.status">
            <el-option label="Active" value="active" />
            <el-option label="Pending" value="pending" />
            <el-option label="Closed" value="closed" />
          </el-select>
        </el-form-item>
        <el-form-item label="Description">
          <el-input v-model="caseForm.description" type="textarea" rows="4" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">Cancel</el-button>
        <el-button type="primary" @click="saveCase">Save</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Plus, Edit } from '@element-plus/icons-vue';
import HeaderCt from '../HeaderCt.vue';
import { supabase } from '../../supabase';
import { Editor, EditorContent } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';

export default {
  name: 'CasesCt',
  components: {
    HeaderCt,
    Plus,
    Edit,
    EditorContent
  },
  setup() {
    const router = useRouter();
    const cases = ref([]);
    const showCreateDialog = ref(false);
    const editingCase = ref(null);
    const caseForm = ref({
      title: '',
      case_number: '',
      court: '',
      filed_date: null,
      status: 'active',
      description: ''
    });

    const loadCases = async () => {
      try {
        const { data, error } = await supabase
          .from('cases')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        cases.value = data;
      } catch (error) {
        ElMessage.error('Error loading cases: ' + error.message);
      }
    };

    const saveCase = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const caseData = {
          ...caseForm.value,
          user_id: user.id
        };

        if (editingCase.value) {
          const { error } = await supabase
            .from('cases')
            .update(caseData)
            .eq('id', editingCase.value.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('cases')
            .insert([caseData]);
          if (error) throw error;
        }

        showCreateDialog.value = false;
        editingCase.value = null;
        await loadCases();
        ElMessage.success(`Case ${editingCase.value ? 'updated' : 'created'} successfully`);
      } catch (error) {
        ElMessage.error('Error saving case: ' + error.message);
      }
    };

    const editCase = (legalCase) => {
      editingCase.value = legalCase;
      caseForm.value = { ...legalCase };
      showCreateDialog.value = true;
    };

    const viewCase = (legalCase) => {
      router.push(`/case/${encodeURIComponent(legalCase.title)}`);
    };

    const formatDate = (date) => {
      return new Date(date).toLocaleDateString();
    };

    const getStatusType = (status) => {
      switch (status) {
        case 'active': return 'success';
        case 'pending': return 'warning';
        case 'closed': return 'info';
        default: return '';
      }
    };

    onMounted(loadCases);

    return {
      cases,
      showCreateDialog,
      editingCase,
      caseForm,
      saveCase,
      editCase,
      viewCase,
      formatDate,
      getStatusType
    };
  }
};
</script>

<style scoped>
.cases-container {
  min-height: 100vh;
  background-color: var(--el-bg-color);
}

.content {
  padding: 2rem;
}

.actions {
  margin-bottom: 2rem;
}

.cases-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 2rem;
}

.case-card {
  height: 100%;
}

.case-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.case-header h3 {
  margin: 0;
  color: var(--el-text-color-primary);
}

.case-details {
  margin: 1rem 0;
}

.case-details p {
  margin: 0.5rem 0;
  color: var(--el-text-color-regular);
}

.case-description {
  margin-top: 1rem;
  color: var(--el-text-color-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.case-actions {
  margin-top: 1.5rem;
}
</style> 