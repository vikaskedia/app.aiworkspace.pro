<!-- 
Architecture description:
All the files are stored in the Gitea server.
The files are stored in the workspace's repository.
-->
<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage, ElButton } from 'element-plus';
const files = ref([]);
const loading = ref(false);
const error = ref(null);

function validateGiteaConfig() {
  const errors = [];
  
  if (!import.meta.env.VITE_GITEA_HOST) {
    errors.push('VITE_GITEA_HOST is not configured');
  }
  
  if (!import.meta.env.VITE_GITEA_TOKEN) {
    errors.push('VITE_GITEA_TOKEN is not configured');
  }
  
  if (errors.length > 0) {
    throw new Error(`Gitea configuration errors: ${errors.join(', ')}`);
  }
}

async function loadFiles() {
  loading.value = true;
  try {
    validateGiteaConfig();
    const giteaToken = import.meta.env.VITE_GITEA_TOKEN;
    const giteaHost = import.meta.env.VITE_GITEA_HOST;
    const apiUrl = `${giteaHost}/api/v1/repos/associateattorney/legal-studio/contents/`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `token ${giteaToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      credentials: 'include',
      mode: 'cors'
    });

    console.log('Response:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      url: response.url
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const contents = await response.json();
    files.value = contents
      .filter(item => item.type === 'file' && item.name !== '.gitkeep')
      .map(file => ({
        id: file.sha,
        name: file.name,
        type: file.type,
        size: file.size,
        download_url: file.download_url
      }));

  } catch (err) {
    console.error('Detailed error:', err);
    error.value = err.message;
    ElMessage.error(`Error loading files: ${err.message}`);
  } finally {
    loading.value = false;
  }
}

// Call loadFiles on component mount
onMounted(() => {
  loadFiles();
});
</script>

<template>
  <div>
    <h1>Debug CORS</h1>
    <el-button 
      type="primary" 
      @click="loadFiles" 
      :loading="loading"
    >
      Reload Files
    </el-button>
    
    <!-- Display files if any -->
    <div v-if="files.length > 0">
      <h3>Files:</h3>
      <ul>
        <li v-for="file in files" :key="file.id">
          {{ file.name }} - {{ file.type }}
        </li>
      </ul>
    </div>
    
    <!-- Display error if any -->
    <div v-if="error" class="error-message">
      {{ error }}
    </div>
  </div>
</template>

<style scoped>
.error-message {
  color: red;
  margin-top: 1rem;
}
</style>
