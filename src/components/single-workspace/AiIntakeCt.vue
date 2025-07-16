<template>
  <div class="ai-intake-ct">
    <h2>{{ pageTitle }}</h2>

    <!-- Controls -->
    <div class="controls mb-3">
      <el-button type="primary" @click="generateForm" :loading="loading">
        <template #default>
          <span v-if="!loading">New Intake</span>
          <span v-else>Generating…</span>
        </template>
      </el-button>
    </div>

    <el-alert v-if="error" type="error" :title="error" class="mb-3" />

    <!-- Table of existing intakes -->
    <el-table
      v-if="intakes.length"
      :data="intakes"
      border
      style="width: 100%"
      class="mb-4"
    >
     
      
      
      <!-- Dynamic columns for 4th, 5th, 6th fields -->
      <el-table-column
        v-for="col in tableColumnNames.slice(3, 6)"
        :key="col"
        :prop="col"
        :label="col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())"
      />
      <el-table-column
        prop="added_on"
        label="Created"
      >
        <template #default="{ row }">
          {{ formatDate(row.added_on) }}
        </template>
      </el-table-column>
      <el-table-column label="Actions" width="210">
        <template #default="{ row }">
            <el-button size="small" @click="openIntake(row)">Open</el-button>
            <el-button size="small" @click="copyShareLink(row)">Copy Share Link</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- Render generated form with complete UI design -->
    <div v-if="formDefinition && formData.server_side_row_uuid" class="generated-form mt-4">
      <div class="form-header" :style="formHeaderStyle">
        <h3>{{ formDefinition.title || 'Patient Intake Form' }}</h3>
        <p v-if="formDefinition.description" class="form-description">{{ formDefinition.description }}</p>
      </div>

      <el-form 
        :model="formData" 
        label-width="160px"
        :class="formClass"
        :style="formStyle"
      >
        <!-- Hidden fields for server_side_row_uuid and ptuuid -->
        <input type="hidden" v-model="formData.server_side_row_uuid" />
        <!-- <input type="hidden" v-model="formData.ptuuid" /> -->
        
        <template v-for="(section, sectionIndex) in formDefinition.sections" :key="sectionIndex">
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
            :type="formDefinition.submitButton?.style || 'primary'"
            @click="handleSubmit"
            size="large"
          >
            {{ formDefinition.submitButton?.text || 'Submit' }}
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

import { useMatterStore } from '../../store/matter';
import { storeToRefs } from 'pinia';

const matterStore = useMatterStore();
const { currentMatter } = storeToRefs(matterStore);
const workspaceId = currentMatter.value.id;
console.log('workspaceId', workspaceId);

const loading = ref(false);
const error = ref(null);
const formDefinition = ref(null); // The JSON structure for the form
const formData = reactive({}); // The data for the current intake row
const showJson = ref(false);
const currentIntakeRow = ref(null); // The current row from intake_for_ws_19
const pageTitle = ref('');
const intakes = ref([]); // All rows from intake_for_ws_19
const tableColumnNames = ref([]); // Store column names for dynamic table columns

async function fetchFormDesign() {
   // Fetch the design row
   let { data: designRow, error: designErr } = await supabase
      .from('intake_form_design_for_ws')
      .select('*')
      .eq('workspace_id', workspaceId)
      .single();
    if (designErr) throw designErr;
    pageTitle.value = designRow.title;

    const tableColumns = await getTableColumns();
    tableColumnNames.value = tableColumns.map(col => col.column_name); // Set column names
    const tableColumnsString = formatTableColumns(tableColumns);
    //console.log('tableColumnsString', tableColumnsString);

    const userPrompt = `Here is the Postgres table structure for intake_for_ws_${workspaceId}: 
${tableColumnsString}

Generate a complete form definition with UI design, layout, and styling. 
Focus on creating a professional intake form with logical grouping of fields.
return only with valid json strecture. do not include any other text or comments.`;

    // If cache_of_empty_form_html is empty, generate and cache it
    if (!designRow.cache_of_empty_form_html) {
      // const prompt = designRow.prompt_to_generate_dynamic_form;
      const { data: aiData } = await axios.post('https://app.aiworkspace.pro/api/ai-generate-intake-form', {
        userPrompt: userPrompt,
        tableName: 'intake_for_ws_' + workspaceId,
        workspace_id: workspaceId
      });
      if (!aiData.success) throw new Error(aiData.error || 'AI form generation failed');
      // Save to DB
      const { error: updateErr } = await supabase
        .from('intake_form_design_for_ws')
        .update({ cache_of_empty_form_html: aiData.formDefinition })
        .eq('workspace_id', workspaceId);
      if (updateErr) throw updateErr;
      formDefinition.value = aiData.formDefinition;
    } else {
      formDefinition.value = typeof designRow.cache_of_empty_form_html === 'string'
        ? JSON.parse(designRow.cache_of_empty_form_html)
        : designRow.cache_of_empty_form_html;
    }

}


// 1. On page load, fetch the form design and all intakes
async function fetchFormDesignAndIntakes() {
  loading.value = true;
  error.value = null;
  try {
    // Fetch form design
    await fetchFormDesign();

    // Fetch all intakes with short urls
    await fetchIntakes();

  } catch (err) {
    error.value = err.message || 'Failed to load form design or intakes';
    formDefinition.value = null;
  } finally {
    loading.value = false;
  }
}

async function getTableColumns() {
  const { data: tableColumns, error: tableColumnsErr } = await supabase
    .rpc('get_table_columns', { table_name: 'intake_for_ws_' + workspaceId });
  // console.log('tableColumns', tableColumns);
  return tableColumns;
}

function formatTableColumns(tableColumns) {
  // format tablecolumns as string with comma separated values name and data_type
  return tableColumns.map(column => column.column_name + ',' + column.data_type).join(',\n');
}

function copyShareLink(row) {
  // const share_url = `/intake-share/${workspaceId}_${row.server_side_row_uuid}`;
  const short_url = `${window.location.origin}/${row.short_url}`;
  navigator.clipboard.writeText(short_url);
  ElMessage.success('Share link copied!');
}

function generateShortUrl() {
  // generate short url like i/aB3dE9
  const shortUrl = 'i/' + Math.random().toString(36).substring(2, 15);
  return shortUrl;
}

// 2. On 'New Intake' click, create a new row and open the form
async function generateForm() {
  const { data: { user } } = await supabase.auth.getUser();
  loading.value = true;
  error.value = null;
  try {
    // Insert a new row (empty/default)
    const { data: insertData, error: insertErr } = await supabase
      .from('intake_for_ws_' + workspaceId)
      .insert({ added_by: user.id, server_side_row_uuid: crypto.randomUUID()})
      .select()
      .single();
    if (insertErr) throw insertErr;

    const share_url = `/intake-share/${workspaceId}_${insertData.server_side_row_uuid}`;
    const shortUrl = generateShortUrl();
    const { data: shortUrlData, error: shortUrlErr } = await supabase
      .from('intake_short_urls')
      .insert({ short_id: shortUrl, actual_url : share_url, intake_row_uuid: insertData.server_side_row_uuid })
      .select()
      .single();
    if (shortUrlErr) throw shortUrlErr; 
    if (shortUrlData) {
      insertData.short_url = shortUrlData.short_url;
    }
    
    await loadIntakeRow(insertData.server_side_row_uuid);
    await fetchIntakes();
    ElMessage.success('New intake started!');
  } catch (err) {
    error.value = err.message || 'Failed to create new intake row';
  } finally {
    loading.value = false;
  }
}

// Fetch all intakes
async function fetchIntakes() {
  const { data: allIntakes, error: intakesErr } = await supabase
    .from('intake_for_ws_' + workspaceId)
    .select('*')
    .order('added_on', { ascending: false });

    // Fetch all short urls
    const { data: shortUrls, error: shortUrlsErr } = await supabase
      .from('intake_short_urls')
      .select('*')
      .like('actual_url', '/intake-share/' + workspaceId + '_%');
    if (shortUrlsErr) throw shortUrlsErr;
    // shortUrls.value = shortUrls || [];
    // console.log('shortUrls', shortUrls);


    // add short url to each intake if it exists
    allIntakes.forEach(intake => {
      const shortUrl = shortUrls.find(shortUrl => shortUrl.intake_row_uuid === intake.server_side_row_uuid);
      if (shortUrl) {
        intake.short_url = shortUrl.short_id;
      }
    });


  if (!intakesErr) intakes.value = allIntakes || [];
}

// Open an intake row in the form
async function openIntake(row) {
  await loadIntakeRow(row.server_side_row_uuid);
}

// 3. Load the row data for a given UUID
async function loadIntakeRow(uuid) {
  const { data: row, error: rowErr } = await supabase
    .from('intake_for_ws_' + workspaceId)
    .select('*')
    .eq('server_side_row_uuid', uuid)
    .single();
  if (rowErr) {
    error.value = rowErr.message;
    return;
  }
  currentIntakeRow.value = row;
  // Populate formData including hidden fields
  Object.keys(formData).forEach(k => delete formData[k]);
  
  // Set hidden fields
  formData.server_side_row_uuid = row.server_side_row_uuid;
  // formData.ptuuid = row.ptuuid;
  
  // Populate form fields from definition
  (formDefinition.value.sections || []).forEach(section => {
    (section.fields || []).forEach(field => {
      formData[field.name] = row[field.name] ?? (field.type === 'checkbox' || field.type === 'boolean' ? false : '');
    });
  });
}

// 4. On submit, update the row in intake_for_ws_19
async function handleSubmit() {
  if (!formData.server_side_row_uuid) return;
  loading.value = true;
  try {
    const updateObj = {};
    
    // Include all form fields including hidden ones
    updateObj.server_side_row_uuid = formData.server_side_row_uuid;
    // updateObj.ptuuid = formData.ptuuid;
    
    (formDefinition.value.sections || []).forEach(section => {
      (section.fields || []).forEach(field => {
        updateObj[field.name] = formData[field.name];
      });
    });

    // if field is empty then set it null
    Object.keys(updateObj).forEach(key => {
      if (updateObj[key] === '') {
        updateObj[key] = null;
      }
    });
    
    const { error: updateErr } = await supabase
      .from('intake_for_ws_' + workspaceId)
      .update(updateObj)
      .eq('server_side_row_uuid', formData.server_side_row_uuid);
    if (updateErr) throw updateErr;
    await fetchIntakes();
    ElMessage.success('Form submitted!');
  } catch (err) {
    error.value = err.message || 'Failed to submit form';
  } finally {
    loading.value = false;
  }
}

const formattedResult = computed({
  get: () => (formDefinition.value ? JSON.stringify(formDefinition.value, null, 2) : ''),
  set: () => {}
});

// Styling computed properties
const formHeaderStyle = computed(() => {
  if (!formDefinition.value?.styling) return {};
  return {
    backgroundColor: formDefinition.value.styling.backgroundColor || '#f8f9fa',
    borderRadius: formDefinition.value.styling.borderRadius || '8px',
    padding: formDefinition.value.styling.spacing || '16px',
    marginBottom: formDefinition.value.styling.spacing || '16px'
  };
});

const formStyle = computed(() => {
  if (!formDefinition.value?.styling) return {};
  return {
    '--primary-color': formDefinition.value.styling.primaryColor || '#409eff',
    '--border-radius': formDefinition.value.styling.borderRadius || '8px',
    '--spacing': formDefinition.value.styling.spacing || '16px'
  };
});

const formClass = computed(() => {
  const theme = formDefinition.value?.theme || 'modern';
  return `form-${theme}`;
});

const sectionStyle = computed(() => {
  if (!formDefinition.value?.styling) return {};
  return {
    marginBottom: formDefinition.value.styling.spacing || '16px',
    padding: formDefinition.value.styling.spacing || '16px',
    border: `1px solid #e4e7ed`,
    borderRadius: formDefinition.value.styling.borderRadius || '8px',
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

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); // You can customize the format if needed
}

onMounted(fetchFormDesignAndIntakes);
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
