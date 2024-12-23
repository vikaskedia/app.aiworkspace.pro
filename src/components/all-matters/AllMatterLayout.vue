<template>
  <div class="all-matters-layout">
    <HeaderCt />
    <div class="all-matters-content">
      <router-view></router-view>
    </div>
  </div>
</template>

<script>
import HeaderCt from '../HeaderCt.vue';

export default {
  name: 'AllMatterLayout',
  components: {
    HeaderCt
  },
  async mounted() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      this.$router.push('/login');
    }
  }
}
</script>

<style scoped>
.all-matters-layout {
  min-height: 100vh;
  background-color: #f5f7fa;
}

.all-matters-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

@media (max-width: 640px) {
  .all-matters-content {
    padding: 1rem;
  }
}
</style> 