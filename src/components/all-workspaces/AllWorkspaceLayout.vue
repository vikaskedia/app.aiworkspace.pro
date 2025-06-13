<template>
  <div class="all-workspaces-layout">
    <HeaderCt />
    <div class="all-workspaces-content">
      <router-view></router-view>
    </div>
  </div>
</template>

<script>
import HeaderCt from '../HeaderCt.vue';
import { supabase } from '../../supabase';

export default {
  name: 'AllWorkspaceLayout',
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
.all-workspaces-layout {
  min-height: 100vh;
  background-color: #f5f7fa;
}

.all-workspaces-content {
  margin: 0 auto;
  padding: 1rem;
}

@media (max-width: 640px) {
  .all-workspaces-content {
    padding: 0.5rem;
  }
}
</style> 