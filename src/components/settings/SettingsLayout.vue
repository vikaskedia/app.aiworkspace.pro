<template>
  <div class="settings-layout">
    <HeaderCt />
    <div class="settings-content">
      <router-view></router-view>
    </div>
  </div>
</template>

<script>
import HeaderCt from '../HeaderCt.vue';

export default {
  name: 'SettingsLayout',
  components: {
    HeaderCt
  }
}
</script>

<style scoped>
.settings-layout {
  min-height: 100vh;
  background-color: #f5f7fa;
}

.settings-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

@media (max-width: 640px) {
  .settings-content {
    padding: 1rem;
  }
}
</style> 