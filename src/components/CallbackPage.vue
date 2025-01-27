<script>
import { supabase } from '../supabase';

export default {
  async mounted() {
    try {
      // Wait a moment to ensure session is properly established
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const { data, error } = await supabase.auth.getSession();
      
      if (error) throw error;
      
      if (data?.session) {
        // Get the original redirect origin from URL params if available
        const params = new URLSearchParams(window.location.search);
        const redirectOrigin = params.get('redirect_origin') || window.location.origin;
        
        // const getRootDomain = () => {
        //   const hostname = window.location.hostname;
        //   if (hostname === 'localhost') return 'localhost';
        //   return '.' + hostname.split('.').slice(-2).join('.');
        // };

        // // Set cookie with dynamic domain
        // document.cookie = `sb-auth-token=${data.session.access_token}; domain=${getRootDomain()}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
        
        // Ensure localStorage is synced
        //await supabase.auth.setSession(data.session);
        
        // Construct the full redirect URL
        const redirectUrl = `${redirectOrigin}/all-matters`;
        window.location.href = redirectUrl;
      } else {
        // No session found, redirect to login
        this.$router.push('/login');
      }
    } catch (err) {
      console.error('Error processing callback:', err);
      this.$router.push('/login');
    }
  },
};
</script>

<template>
  <div>Processing login...</div>
</template>
