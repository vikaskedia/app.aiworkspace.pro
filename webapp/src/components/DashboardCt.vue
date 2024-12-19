<template>
  <div class="dashboard-container">
    <HeaderCt />
    <div class="dashboard-content">
      <router-view></router-view>
    </div>
  </div>
</template>

<script>
import HeaderCt from './HeaderCt.vue';

export default {
  name: 'DashboardCt',
  components: {
    HeaderCt
  }
};
</script>

<style scoped>
.dashboard-container {
  min-height: 100vh;
  background-color: #f5f7fa;
}

.dashboard-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}
</style>
