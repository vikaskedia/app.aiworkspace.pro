<script>
import { supabase } from '../supabase';

export default {
  async mounted() {
    const { data, error } = await supabase.auth.getSession();
    if (data?.session) {
      console.log('User session:', data.session);
      this.$router.push('/all-matters');
    } else if (error) {
      console.error('Error fetching session:', error.message);
      this.$router.push('/login');
    }
  },
};
</script>

<template>
  <div>Processing login...</div>
</template>
