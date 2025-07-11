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

    <!-- Render generated form with complete UI design -->
    <div v-if="result" class="generated-form mt-4">
      <div class="form-header" :style="formHeaderStyle">
        <h3>{{ result.title || 'Patient Intake Form' }}</h3>
        <p v-if="result.description" class="form-description">{{ result.description }}</p>
      </div>

      <el-form 
        :model="formData" 
        label-width="160px"
        :class="formClass"
        :style="formStyle"
      >
        <template v-for="(section, sectionIndex) in result.sections" :key="sectionIndex">
          <!-- Section Header -->
          <div class="form-section" :style="sectionStyle">
            <h4 v-if="section.title" class="section-title">{{ section.title }}</h4>
            <p v-if="section.description" class="section-description">{{ section.description }}</p>
            
            <!-- Section Fields -->
            <div :class="getSectionLayoutClass(section.layout)">
              <template v-for="field in section.fields" :key="field.name">
                <div :class="getFieldClass(section.layout)">
                  <!-- Checkboxes / booleans rendered differently -->
                  <el-form-item 
                    v-if="isCheckbox(field)" 
                    :label="''"
                    :class="{ 'checkbox-item': true }"
                  >
                    <el-checkbox 
                      v-model="formData[field.name]"
                      :required="field.required"
                    >
                      {{ field.label }}
                    </el-checkbox>
                  </el-form-item>

                  <el-form-item 
                    v-else 
                    :label="field.label"
                    :required="field.required"
                  >
                    <component
                      :is="inputComponent(field)"
                      v-model="formData[field.name]"
                      v-bind="inputProps(field)"
                      :placeholder="field.placeholder"
                      :class="getInputClass(field)"
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
                </div>
              </template>
            </div>
          </div>
        </template>

        <el-form-item class="submit-section">
          <el-button 
            :type="result.submitButton?.style || 'primary'"
            @click="handleSubmit"
            size="large"
          >
            {{ result.submitButton?.text || 'Submit' }}
          </el-button>
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

      // Initialize formData with empty values
      Object.keys(formData).forEach(k => delete formData[k]);
      (result.value.sections || []).forEach(section => {
        (section.fields || []).forEach(field => {
          formData[field.name] = field.type === 'checkbox' || field.type === 'boolean' ? false : '';
        });
      });

      // Persist definition to Supabase
      const { data: insertData, error: insertErr } = await supabase
        .from('intake_forms')
        .insert({
          title: result.value.title || `Intake ${new Date().toLocaleString()}`,
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

  // Setup formData
  Object.keys(formData).forEach(k => delete formData[k]);
  (result.value.sections || []).forEach(section => {
    (section.fields || []).forEach(field => {
      formData[field.name] = field.type === 'checkbox' || field.type === 'boolean' ? false : '';
    });
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

// Styling computed properties
const formHeaderStyle = computed(() => {
  if (!result.value?.styling) return {};
  return {
    backgroundColor: result.value.styling.backgroundColor || '#f8f9fa',
    borderRadius: result.value.styling.borderRadius || '8px',
    padding: result.value.styling.spacing || '16px',
    marginBottom: result.value.styling.spacing || '16px'
  };
});

const formStyle = computed(() => {
  if (!result.value?.styling) return {};
  return {
    '--primary-color': result.value.styling.primaryColor || '#409eff',
    '--border-radius': result.value.styling.borderRadius || '8px',
    '--spacing': result.value.styling.spacing || '16px'
  };
});

const formClass = computed(() => {
  const theme = result.value?.theme || 'modern';
  return `form-${theme}`;
});

const sectionStyle = computed(() => {
  if (!result.value?.styling) return {};
  return {
    marginBottom: result.value.styling.spacing || '16px',
    padding: result.value.styling.spacing || '16px',
    border: `1px solid #e4e7ed`,
    borderRadius: result.value.styling.borderRadius || '8px',
    backgroundColor: '#fff'
  };
});

// Helper functions
function isCheckbox(field) {
  return field.type === 'checkbox' || field.type === 'boolean';
}

function inputComponent(field) {
  switch (field.type) {
    case 'textarea':
      return 'el-input';
    case 'date':
      return 'el-date-picker';
    case 'select':
      return 'el-select';
    case 'file':
      return 'el-upload';
    default:
      return 'el-input';
  }
}

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
  if (field.type === 'email') {
    base.type = 'email';
  }
  if (field.type === 'phone') {
    base.type = 'tel';
  }
  if (field.validation?.pattern) {
    base.pattern = field.validation.pattern;
  }
  return base;
}

function getSectionLayoutClass(layout) {
  switch (layout) {
    case 'two-column':
      return 'section-two-column';
    case 'grid':
      return 'section-grid';
    default:
      return 'section-single-column';
  }
}

function getFieldClass(sectionLayout) {
  switch (sectionLayout) {
    case 'two-column':
      return 'field-half';
    case 'grid':
      return 'field-grid';
    default:
      return 'field-full';
  }
}

function getInputClass(field) {
  const classes = ['form-input'];
  if (field.validation?.pattern) {
    classes.push('has-validation');
  }
  return classes.join(' ');
}

function handleSubmit() {
  console.log('Submitted data:', JSON.parse(JSON.stringify(formData)));
  ElMessage.success('Form submitted! (check console for payload)');
}

onMounted(loadForms);
</script>

<style scoped>
.ai-intake-ct {
  max-width: 1200px;
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

/* Form Header */
.form-header {
  text-align: center;
  margin-bottom: 2rem;
}

.form-header h3 {
  margin: 0 0 0.5rem 0;
  color: #2c3e50;
}

.form-description {
  margin: 0;
  color: #6c757d;
  font-size: 1rem;
}

/* Form Sections */
.form-section {
  margin-bottom: 2rem;
}

.section-title {
  margin: 0 0 1rem 0;
  color: #2c3e50;
  font-size: 1.25rem;
  font-weight: 600;
}

.section-description {
  margin: 0 0 1rem 0;
  color: #6c757d;
  font-size: 0.9rem;
}

/* Layout Classes */
.section-single-column {
  display: block;
}

.section-two-column {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.section-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.field-full {
  width: 100%;
}

.field-half {
  width: 100%;
}

.field-grid {
  width: 100%;
}

/* Form Themes */
.form-modern {
  --primary-color: #409eff;
  --border-radius: 8px;
  --spacing: 16px;
}

.form-professional {
  --primary-color: #2c3e50;
  --border-radius: 4px;
  --spacing: 20px;
}

.form-medical {
  --primary-color: #27ae60;
  --border-radius: 12px;
  --spacing: 18px;
}

.form-minimal {
  --primary-color: #6c757d;
  --border-radius: 2px;
  --spacing: 12px;
}

/* Form Inputs */
.form-input {
  width: 100%;
}

.checkbox-item {
  margin-bottom: 1rem;
}

.checkbox-item .el-checkbox {
  width: 100%;
}

/* Submit Section */
.submit-section {
  text-align: center;
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid #e4e7ed;
}

/* Responsive Design */
@media (max-width: 768px) {
  .section-two-column {
    grid-template-columns: 1fr;
  }
  
  .section-grid {
    grid-template-columns: 1fr;
  }
  
  .ai-intake-ct {
    max-width: 100%;
    padding: 0 1rem;
  }
}

/* Validation Styles */
.has-validation:invalid {
  border-color: #f56c6c;
}

.has-validation:valid {
  border-color: #67c23a;
}
</style>
