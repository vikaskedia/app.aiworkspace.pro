<template>
  <div class="ai-intake-ct">
    <h2>Patient Intake Forms</h2>

    <!-- Controls -->
    <div class="controls mb-3">
      <el-button type="primary" @click="generateForm" :loading="loading">
        <template #default>
          <span v-if="!loading">New Intake</span>
          <span v-else>Generating…</span>
        </template>
      </el-button>

      <el-input v-model="search" placeholder="Search…" class="ml-2" clearable />
    </div>

    <el-alert v-if="error" type="error" :title="error" class="mb-3" />

    <!-- Table of existing intakes -->
    <el-table
      v-if="forms.length"
      :data="filteredForms"
      border
      style="width: 100%"
      class="mb-4"
    >
      <el-table-column prop="title" label="Title" sortable />
      <el-table-column prop="table_name" label="Table" width="180" sortable />
      <el-table-column prop="created_at" label="Created" sortable />
      <el-table-column label="Actions" width="220">
        <template #default="{ row }">
          <el-button size="small" @click="loadForm(row)">Open</el-button>
          <el-button size="small" @click="copyShareLink(row)" type="primary">Copy Link</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- Render generated form -->
    <div v-if="result" class="generated-form mt-4">
      <h3>Patient Intake <span v-if="currentTitle">({{ currentTitle }})</span></h3>

      <el-form :model="formData" label-width="160px">
        <template v-for="field in result" :key="field.name">
          <!-- Checkboxes / booleans rendered differently -->
          <el-form-item v-if="isCheckbox(field)" :label="''">
            <el-checkbox v-model="formData[field.name]">{{ field.label }}</el-checkbox>
          </el-form-item>

          <el-form-item v-else :label="field.label">
            <component
              :is="inputComponent(field)"
              v-model="formData[field.name]"
              v-bind="inputProps(field)"
            >
              <!-- Options for select -->
              <template v-if="field.type === 'select'" #default>
                <el-option
                  v-for="opt in field.options || []"
                  :key="opt"
                  :label="opt"
                  :value="opt"
                />
              </template>
            </component>
          </el-form-item>
        </template>

        <el-form-item>
          <el-button type="primary" @click="handleSubmit">Submit</el-button>
        </el-form-item>
      </el-form>

      <!-- Debug toggle -->
      <el-button type="text" @click="showJson = !showJson">
        {{ showJson ? 'Hide' : 'Show' }} JSON Definition
      </el-button>
      <el-input
        v-if="showJson"
        type="textarea"
        :rows="15"
        v-model="formattedResult"
        readonly
        autosize
        class="mt-3"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';
import { supabase } from '../../supabase.js';

const loading = ref(false);
const error = ref(null);
const result = ref(null);
const formData = reactive({});
const showJson = ref(false);
const forms = ref([]);
const search = ref('');
const currentTitle = ref('');

async function generateForm() {
  loading.value = true;
  error.value = null;
  result.value = null;
  try {
    const { data } = await axios.post('https://app.aiworkspace.pro/api/ai-generate-intake-form', {
      tableName: 'sc_patient_intake'
    });
    if (data.success) {
      result.value = data.formDefinition;

      // Initialise formData with empty values
      Object.keys(formData).forEach(k => delete formData[k]);
      (result.value || []).forEach(f => {
        formData[f.name] = f.type === 'checkbox' || f.type === 'boolean' ? false : '';
      });

      // Persist definition to Supabase
      const { data: insertData, error: insertErr } = await supabase
        .from('intake_forms')
        .insert({
          title: `Intake ${new Date().toLocaleString()}`,
          table_name: 'sc_patient_intake',
          definition: result.value
        })
        .select()
        .single();

      if (insertErr) {
        console.error(insertErr);
      } else {
        forms.value.unshift(insertData);
        currentTitle.value = insertData.title;
      }

      ElMessage.success('Form generated & saved!');
    } else {
      error.value = data.error || 'Unknown error';
    }
  } catch (err) {
    error.value = err.response?.data?.error || err.message;
  } finally {
    loading.value = false;
  }
}

async function loadForms() {
  const { data, error: loadErr } = await supabase
    .from('intake_forms')
    .select('*')
    .order('created_at', { ascending: false });
  if (!loadErr && data) forms.value = data;
}

function copyShareLink(row) {
  const link = `${window.location.origin}/intake-share/${row.share_uuid}`;
  navigator.clipboard.writeText(link);
  ElMessage.success('Share link copied!');
}

function loadForm(row) {
  currentTitle.value = row.title || '';
  result.value = row.definition;

  // setup formData
  Object.keys(formData).forEach(k => delete formData[k]);
  (result.value || []).forEach(f => {
    formData[f.name] = f.type === 'checkbox' || f.type === 'boolean' ? false : '';
  });
}

const filteredForms = computed(() => {
  if (!search.value) return forms.value;
  const q = search.value.toLowerCase();
  return forms.value.filter(f =>
    (f.title || '').toLowerCase().includes(q) ||
    (f.table_name || '').toLowerCase().includes(q)
  );
});

const formattedResult = computed({
  get: () => (result.value ? JSON.stringify(result.value, null, 2) : ''),
  set: () => {}
});

// Helper: determine if field is checkbox/boolean
function isCheckbox(field) {
  return field.type === 'checkbox' || field.type === 'boolean';
}

// Helper: map field type to Element-Plus component name
function inputComponent(field) {
  switch (field.type) {
    case 'textarea':
      return 'el-input';
    case 'date':
      return 'el-date-picker';
    case 'select':
      return 'el-select';
    default:
      return 'el-input';
  }
}

// Helper: extra props per input component
function inputProps(field) {
  const base = {};
  if (field.type === 'textarea') {
    base.type = 'textarea';
    base.autosize = { minRows: 2, maxRows: 6 };
  }
  if (field.type === 'number') {
    base.type = 'number';
  }
  if (field.type === 'date') {
    base.type = 'date';
    base.placeholder = 'Select date';
  }
  return base;
}

function handleSubmit() {
  console.log('Submitted data:', JSON.parse(JSON.stringify(formData)));
  ElMessage.success('Form submitted! (check console for payload)');
}

onMounted(loadForms);
</script>

<style scoped>
.ai-intake-ct {
  max-width: 900px;
  margin: 0 auto;
}
.result textarea {
  font-family: monospace;
}
.mb-3 {
  margin-bottom: 1rem;
}
.mt-3 {
  margin-top: 1rem;
}
.mt-4 {
  margin-top: 1.5rem;
}
.controls {
  display: flex;
  align-items: center;
}
.controls .ml-2 {
  margin-left: 0.75rem;
  flex: 1;
}
.generated-form {
  margin-top: 1.5rem;
}
</style>
