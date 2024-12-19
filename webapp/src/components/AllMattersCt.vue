<template>
  <div class="all-matters">
    <HeaderCt />
    <div class="content">
      <div class="coming-soon">
        <h2>Coming Soon</h2>
        <p>The ability to view all matters at once will be available in a future update.</p>
      </div>
    </div>
  </div>
</template>

<script>
import HeaderCt from './HeaderCt.vue';

export default {
  name: 'AllMattersCt',
  components: {
    HeaderCt
  }
};
</script>

<style scoped>
.all-matters {
  min-height: 100vh;
  background-color: #f5f7fa;
}

.content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.coming-soon {
  text-align: center;
  padding: 4rem 2rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
}

.coming-soon h2 {
  color: #303133;
  font-size: 2rem;
  margin-bottom: 1rem;
}

.coming-soon p {
  color: #606266;
  font-size: 1.1rem;
}
</style> 