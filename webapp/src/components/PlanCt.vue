<script>
import { useMatterStore } from '../store/matter';
import { storeToRefs } from 'pinia';

export default {
  setup() {
    const matterStore = useMatterStore();
    const { currentMatter } = storeToRefs(matterStore);
    return { currentMatter };
  }
};
</script>

<template>
  <div class="plan-container">
    <div class="content">
      <h2>Plan</h2>
      <p>Coming soon...</p>
    </div>
  </div>
</template>

<style scoped>
.plan-container {
  min-height: 100vh;
  background-color: #f5f7fa;
}

.content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

h2 {
  color: #303133;
  margin-bottom: 1rem;
}
</style> 