<script>
import HeaderCt from './HeaderCt.vue';

export default {
  components: { 
    HeaderCt
  }
};
</script>

<template>
  <div class="tasks-container">
    <HeaderCt />
    <div class="content">
      <h2>Tasks</h2>
      <p>Coming soon...</p>
    </div>
  </div>
</template>

<style scoped>
.tasks-container {
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