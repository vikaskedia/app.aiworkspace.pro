<template>
  <div class="intake-share-view">
    <div v-if="loading" class="loading-container">
      <el-loading :loading="true" text="Loading intake form..." />
    </div>

    <div v-else-if="error" class="error-container">
      <el-alert type="error" :title="error" show-icon />
    </div>

    <div v-else-if="formDefinition" class="form-container">
      <div class="form-header" :style="formHeaderStyle">
        <h2>{{ formTitle || 'Patient Intake Form' }}</h2>
        <p v-if="formDefinition.description" class="form-description">{{ formDefinition.description }}</p>
      </div>

      <el-form :model="formData" label-width="160px" @submit.prevent="handleSubmit">


        <!-- Hidden fields for server_side_row_uuid and ptuuid -->
        <input type="hidden" v-model="formData.server_side_row_uuid" />
        <!-- <input type="hidden" v-model="formData.ptuuid" /> -->

        <template v-for="(section, sectionIndex) in formDefinition.sections" :key="sectionIndex">
          <!-- Section Header -->
          <div class="form-section">
            <h4 v-if="section.title" class="section-title">{{ section.title }}</h4>
            <p v-if="section.description" class="section-description">{{ section.description }}</p>
            
            <!-- Section Fields -->
            <div :class="getSectionLayoutClass(section.layout)">
              <template v-for="field in section.fields" :key="field.name">
                <div :class="getFieldClass(section.layout)">
                  <!-- Checkboxes / booleans rendered differently -->
                  <el-form-item v-if="isCheckbox(field)" :label="''" class="checkbox-item">
                    <el-checkbox v-model="formData[field.name]" :required="field.required">
                      {{ field.label }}
                    </el-checkbox>
                  </el-form-item>

                  <el-form-item v-else :label="field.label" :required="field.required">
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
import { ref, reactive, onMounted, computed, onUnmounted } from 'vue';
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
const realtimeSubscription = ref(null);

async function loadIntakeForm() {
  // const workspaceId = route.params.workspaceId;
  const formId = route.params.shareId;
  const workspaceId = formId.split('_')[0];
  const shareId = formId.split('_')[1];
  
  try {
    const { data: designData, error: designError } = await supabase
      .from('intake_form_design_for_ws')
      .select('*')
      .eq('workspace_id', workspaceId)
      .single();
      const pageTitle = designData.title;

    if (designError) {
      error.value = 'Intake form design not found';
      return;
    }

    if (designData) {
      console.log('designData', designData);
      formDefinition.value = designData.cache_of_empty_form_html;
      formTitle.value = pageTitle;
      console.log('formDefinition', formDefinition.value);
    }

    // Load the intake form by share_uuid
    const { data, error: loadError } = await supabase
      .from('intake_for_ws_' + workspaceId)
      .select('*')
      .eq('server_side_row_uuid', shareId)
      .single();

    if (loadError) {
      error.value = 'Intake form not found';
      return;
    }

    if (data) {
      populateFormData(data);
    }

    // Set up real-time subscription
    setupRealtimeSubscription(workspaceId, shareId);
  } catch (err) {
    error.value = 'Error loading intake form';
    console.error('Error loading intake form:', err);
  } finally {
    loading.value = false;
  }
}

// Populate form data from row
function populateFormData(data) {
  // Clear previous formData
  Object.keys(formData).forEach(k => delete formData[k]);
  
  // Populate formData with values from the row
  (formDefinition.value.sections || []).forEach(section => {
    (section.fields || []).forEach(field => {
      formData[field.name] = data[field.name] ?? (field.type === 'checkbox' || field.type === 'boolean' ? false : '');
    });
  });
  
  // Also set hidden fields if needed
  formData.server_side_row_uuid = data.server_side_row_uuid;
  //formData.ptuuid = data.ptuuid;
}

// Set up real-time subscription
function setupRealtimeSubscription(workspaceId, shareId) {
  // Clean up existing subscription
  if (realtimeSubscription.value) {
    supabase.removeChannel(realtimeSubscription.value);
  }

  // Create new subscription
  realtimeSubscription.value = supabase
    .channel(`intake-form-${shareId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: `intake_for_ws_${workspaceId}`,
        filter: `server_side_row_uuid=eq.${shareId}`
      },
      (payload) => {
        console.log('Real-time update received:', payload);
        if (payload.new) {
          populateFormData(payload.new);
          ElMessage.info('Form data updated from another session');
        }
      }
    )
    .subscribe();
}

// Clean up subscription on component unmount
onUnmounted(() => {
  if (realtimeSubscription.value) {
    supabase.removeChannel(realtimeSubscription.value);
  }
});

async function handleSubmit() {
  const workspaceId = route.params.workspaceId;
  const serverSideRowUuid = route.params.shareId;
  submitting.value = true;
  
  try {
    const updateObj = {};
    
    // Include all form fields including hidden ones
    updateObj.server_side_row_uuid = formData.server_side_row_uuid;
    //updateObj.ptuuid = formData.ptuuid;
    
    (formDefinition.value.sections || []).forEach(section => {
      (section.fields || []).forEach(field => {
        updateObj[field.name] = formData[field.name];
      });
    });

    // if dob is not set then set it null
    if (!formData.dob) {
      updateObj.dob = null;
    }
    if (!formData.cvv_code) {
      updateObj.cvv_code = null;
    }
    if (!formData.credit_card_number) {
      updateObj.credit_card_number = null;
    }
    
    const { error: updateErr } = await supabase
      .from('intake_for_ws_' + workspaceId)
      .update(updateObj)
      .eq('server_side_row_uuid', formData.server_side_row_uuid);
    if (updateErr) throw updateErr;

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
  if (field.validation?.pattern) {
    base.pattern = field.validation.pattern;
  }
  return base;
}

// Helper: get section layout class
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

// Helper: get field class based on section layout
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

// Helper: get input class
function getInputClass(field) {
  const classes = ['form-input'];
  if (field.validation?.pattern) {
    classes.push('has-validation');
  }
  return classes.join(' ');
}

// Computed: form header style
const formHeaderStyle = computed(() => {
  if (!formDefinition.value?.styling) return {};
  return {
    backgroundColor: formDefinition.value.styling.backgroundColor || '#f8f9fa',
    borderRadius: formDefinition.value.styling.borderRadius || '8px',
    padding: formDefinition.value.styling.spacing || '16px',
    marginBottom: formDefinition.value.styling.spacing || '16px'
  };
});

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

/* Form Sections */
.form-section {
  margin-bottom: 2rem;
  padding: 1rem;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  background-color: #fff;
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

/* Validation Styles */
.has-validation:invalid {
  border-color: #f56c6c;
}

.has-validation:valid {
  border-color: #67c23a;
}

/* Responsive design */
@media (max-width: 768px) {
  .intake-share-view {
    padding: 1rem;
  }
  
  .form-container {
    padding: 1rem;
  }
  
  .section-two-column {
    grid-template-columns: 1fr;
  }
  
  .section-grid {
    grid-template-columns: 1fr;
  }
}
</style> 