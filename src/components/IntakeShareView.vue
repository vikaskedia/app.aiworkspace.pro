<template>
  <div class="intake-share-view">
    <div v-if="loading" class="loading-container">
      <el-loading :loading="true" text="Loading intake form..." />
    </div>

    <div v-else-if="error" class="error-container">
      <el-alert type="error" :title="error" show-icon />
    </div>

    <div v-else-if="formDefinition" class="form-container">
      <div class="form-header">
        <h2>{{ formTitle || 'Patient Intake Form' }}</h2>
        <p class="form-description">Please fill out the form below to submit your information.</p>
      </div>

      <el-form :model="formData" label-width="160px" @submit.prevent="handleSubmit">
        <template v-for="field in formDefinition" :key="field.name">
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
          <el-button type="primary" @click="handleSubmit" :loading="submitting">
            {{ submitting ? 'Submitting...' : 'Submit Form' }}
          </el-button>
        </el-form-item>
      </el-form>

      <div v-if="submitted" class="success-message">
        <el-alert type="success" title="Form submitted successfully!" show-icon />
      </div>
    </div>

    <div v-else class="not-found">
      <el-alert type="warning" title="Intake form not found" description="The requested intake form could not be found or may have expired." show-icon />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { supabase } from '../supabase.js';

const route = useRoute();
const loading = ref(true);
const error = ref(null);
const formDefinition = ref(null);
const formTitle = ref('');
const formData = reactive({});
const submitting = ref(false);
const submitted = ref(false);

async function loadIntakeForm() {
  const shareId = route.params.shareId;
  
  try {
    // Load the intake form by share_uuid
    const { data, error: loadError } = await supabase
      .from('intake_forms')
      .select('*')
      .eq('share_uuid', shareId)
      .single();

    if (loadError) {
      error.value = 'Intake form not found';
      return;
    }

    if (data) {
      formDefinition.value = data.definition;
      formTitle.value = data.title;

      // Initialize formData with empty values
      Object.keys(formData).forEach(k => delete formData[k]);
      (formDefinition.value || []).forEach(f => {
        formData[f.name] = f.type === 'checkbox' || f.type === 'boolean' ? false : '';
      });
    }
  } catch (err) {
    error.value = 'Error loading intake form';
    console.error('Error loading intake form:', err);
  } finally {
    loading.value = false;
  }
}

async function handleSubmit() {
  submitting.value = true;
  
  try {
    // Submit the form data to your API or database
    const { data, error: submitError } = await supabase
      .from('sc_patient_intake')
      .insert({
        ...formData,
        submitted_at: new Date().toISOString(),
        share_id: route.params.shareId
      });

    if (submitError) {
      ElMessage.error('Error submitting form');
      console.error('Submit error:', submitError);
      return;
    }

    submitted.value = true;
    ElMessage.success('Form submitted successfully!');
  } catch (err) {
    ElMessage.error('Error submitting form');
    console.error('Submit error:', err);
  } finally {
    submitting.value = false;
  }
}

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

onMounted(loadIntakeForm);
</script>

<style scoped>
.intake-share-view {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

.loading-container,
.error-container,
.not-found {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

.form-container {
  background: white;
  border-radius: 8px;
  padding: 2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.form-header {
  text-align: center;
  margin-bottom: 2rem;
}

.form-header h2 {
  margin-bottom: 0.5rem;
  color: #333;
}

.form-description {
  color: #666;
  margin: 0;
}

.success-message {
  margin-top: 2rem;
}

/* Responsive design */
@media (max-width: 768px) {
  .intake-share-view {
    padding: 1rem;
  }
  
  .form-container {
    padding: 1rem;
  }
}
</style> 