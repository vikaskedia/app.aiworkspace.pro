<template>
  <div class="intake-process-view">
    <div v-if="loading" class="loading-container">
      <el-loading :loading="true" text="Loading intake form..." />
    </div>

    <div v-else-if="error" class="error-container">
      <el-alert type="error" :title="error" show-icon />
    </div>

    <div v-else-if="formDefinition && !submitted" class="form-container">
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


        <div class="form-section">
          <h4 class="section-title">Signature</h4>

         <!-- Signature Pad -->
         <el-form-item label=" "  >
          <div class="signature-pad-container">
            <VueSignaturePad
            ref="signaturePadRef"
            width="300px"
            height="120px"
            :options="{ penColor: 'black', backgroundColor: 'rgba(255,255,255,1)' }"
            style="border: 1px solid #ccc;"
          />
          </div>
          
          <el-button @click.prevent="signaturePadRef && signaturePadRef.clearSignature()" style="margin-top: 8px;">Clear</el-button>
        </el-form-item>
        </div>


        <el-form-item>
          <el-button type="primary" @click="handleSubmit" :loading="submitting">
            {{ submitting ? 'Submitting...' : 'Submit Form' }}
          </el-button>
        </el-form-item>
      </el-form>
    </div>

    <div v-if="submitted" class="success-section">
      <el-card class="success-card">
        <div v-html="success_message"></div>
      </el-card>
    </div>

  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { supabase } from '../supabase.js';
import { useRoute } from 'vue-router';

const route = useRoute();
const loading = ref(true);
const error = ref(null);
const formDefinition = ref(null);
const formTitle = ref('');
const formData = reactive({});
const submitting = ref(false);
const submitted = ref(false);
const signaturePadRef = ref(null);
const success_message = ref('');

const workspace_id = ref(null);

async function loadIntakeForm() {
  try {
    const form_name = route.params.name;
    console.log('form_name', form_name);
    // Load the form design for workspace 19
    const { data: designData, error: designError } = await supabase
      .from('intake_form_design_for_ws')
      .select('*')
      .eq('form_name', form_name)
      .single();
    if (designError || !designData) {
      error.value = 'Intake form design not found';
      return;
    }
    formDefinition.value = designData.cache_of_empty_form_html;
    formTitle.value = designData.title;
    workspace_id.value = designData.workspace_id; 
    success_message.value = designData.success_message;
    // Populate formData with empty values
    (formDefinition.value.sections || []).forEach(section => {
      (section.fields || []).forEach(field => {
        formData[field.name] = field.type === 'checkbox' || field.type === 'boolean' ? false : '';
      });
    });
    formData.server_side_row_uuid = '';
    formData.signature = '';
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
    // Get signature data
    if (signaturePadRef.value) {
      const signature = signaturePadRef.value.saveSignature();
      formData.signature = signature.data;
    }
    const updateObj = {};
    (formDefinition.value.sections || []).forEach(section => {
      (section.fields || []).forEach(field => {
        updateObj[field.name] = formData[field.name];
      });
    });
    updateObj.signature = formData.signature;

    updateObj.server_side_row_uuid = crypto.randomUUID();

    // if field is empty then set it null
    Object.keys(updateObj).forEach(key => {
      if (updateObj[key] === '') {
        updateObj[key] = null;
      }
    });


    // Insert new row into intake_for_ws_19
    const { error: insertErr } = await supabase
      .from('intake_for_ws_' + workspace_id.value)
      .insert([updateObj]);
    if (insertErr) throw insertErr;


    const share_url = `/intake-share/${workspace_id.value}_${updateObj.server_side_row_uuid}`;
    const shortUrl = generateShortUrl();
    const { data: shortUrlData, error: shortUrlErr } = await supabase
      .from('intake_short_urls')
      .insert({ short_id: shortUrl, actual_url : share_url, intake_row_uuid: updateObj.server_side_row_uuid })
      .select()
      .single();
    if (shortUrlErr) throw shortUrlErr; 
    if (shortUrlData) {
      updateObj.short_url = shortUrlData.short_url;
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

function generateShortUrl() {
  // generate short url like i/aB3dE9
  const shortUrl = 'i/' + Math.random().toString(36).substring(2, 15);
  return shortUrl;
}

const formHeaderStyle = {};

onMounted(loadIntakeForm);
</script>

<style scoped>
.intake-process-view {
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
  .intake-process-view {
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

.success-section {
  margin-top: 2rem;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 350px;
}
.success-card {
  max-width: 480px;
  width: 100%;
  padding: 32px 24px 24px 24px;
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.08);
  background: #fff;
  text-align: center;
}
.success-icon-container {
  margin-bottom: 12px;
}
.success-title {
  font-weight: 700;
  color: #2c3e50;
  margin-bottom: 10px;
  font-size: 1.5rem;
}
.success-message {
  font-size: 1.1rem;
  color: #333;
  margin-bottom: 18px;
}
.contact-info {
  margin: 18px 0 10px 0;
}
.contact-title {
  font-weight: 600;
  margin-bottom: 6px;
  color: #444;
}
.contact-details {
  font-size: 1rem;
  color: #222;
}
.contact-details a {
  color: #409EFF;
  text-decoration: none;
}
.contact-details a:hover {
  text-decoration: underline;
}
.contact-note {
  color: #888;
  font-size: 0.95rem;
  display: block;
  margin-top: 4px;
}
.action-area {
  margin-top: 18px;
}
</style> 