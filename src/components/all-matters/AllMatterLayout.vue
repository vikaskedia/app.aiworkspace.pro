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
import { supabase } from '../../supabase';

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
  margin: 0 auto;
  padding: 2rem;
  padding-top: 1rem;
  padding-bottom: 1rem;
}

@media (max-width: 640px) {
  .all-matters-content {
    padding: 1rem;
    padding-top: 0.5rem;
    padding-bottom: 0.5rem;
  }
}
</style> 