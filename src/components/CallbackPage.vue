<script>
import { supabase } from '../supabase';

export default {
  async mounted() {
    const { data, error } = await supabase.auth.getSession();
    if (data?.session) {
      console.log('User session:', data.session);
      // Get the original redirect origin from URL params if available
      const params = new URLSearchParams(window.location.search);
      const redirectOrigin = params.get('redirect_origin') || window.location.origin;
      
      // Construct the full redirect URL
      const redirectUrl = `${redirectOrigin}/all-matters`;
      window.location.href = redirectUrl;
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
