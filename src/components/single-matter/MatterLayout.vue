<template>
  <div class="matter-layout">
    <HeaderCt />
    <div class="matter-content">
      <router-view></router-view>
    </div>
  </div>
</template>

<script>
import HeaderCt from '../HeaderCt.vue';

export default {
  name: 'MatterLayout',
  components: {
    HeaderCt
  }
}
</script>

<style scoped>
.matter-layout {
  min-height: 100vh;
  background-color: #f5f7fa;
}

.matter-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

@media (max-width: 640px) {
  .matter-content {
    padding: 1rem;
  }
}
</style>