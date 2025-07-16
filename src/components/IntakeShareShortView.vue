<template>
  <div class="redirecting-container">
    <el-alert type="info" :title="redirectMessage" show-icon />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { supabase } from '../supabase.js';

const route = useRoute();
const router = useRouter();
const redirectMessage = ref('Redirecting to intake form...');

onMounted(async () => {
  const shortId = route.params.shortId;
  console.log('shortId', shortId);
  try {
    const { data, error } = await supabase
      .from('intake_short_urls')
      .select('actual_url')
      .eq('short_id', 'i/'+shortId)
      .single();
    if (error || !data) {
      redirectMessage.value = 'Short link not found or expired.';
      return;
    }
    // Show the actual URL in the message for clarity
    redirectMessage.value = `Redirecting to ${data.actual_url} ...`;
    // Wait a short moment for the user to see the message
    setTimeout(() => {
      window.location.href = data.actual_url;
    }, 1200);
  } catch (err) {
    redirectMessage.value = 'Error looking up short link.';
  }
});
</script>

<style scoped>
.redirecting-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}
</style> 