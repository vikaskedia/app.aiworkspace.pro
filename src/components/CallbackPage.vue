<script>
import { supabase } from '../supabase';
import { MP } from '../mixpanel';
import { setSessionCookie, syncCookiesToLocalStorage, getPostLoginBase, ACCESS_COOKIE, REFRESH_COOKIE } from '../utils/authRedirect';

export default {
  async mounted() {
    try {
      // Wait a moment to ensure session is properly established
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const { data, error } = await supabase.auth.getSession();
      
      if (error) throw error;
      
      if (data?.session) {
        const user = data.session.user;
        
        MP.identify(user.id);
        MP.track('OAuth Login Complete', {
          provider: user.app_metadata.provider,
          userId: user.id,
          email: user.email
        });
        MP.setUserProperties({
          email: user.email,
          name: user.user_metadata?.full_name,
          accountType: user.app_metadata.provider,
          lastLoginAt: new Date().toISOString()
        });
        
        // Set cross-subdomain cookies for session sharing
        if (data.session.access_token) {
          setSessionCookie(ACCESS_COOKIE, data.session.access_token);
        }
        if (data.session.refresh_token) {
          setSessionCookie(REFRESH_COOKIE, data.session.refresh_token);
        }
        syncCookiesToLocalStorage();
        
        // Get the post-login redirect URL
        const redirectUrl = getPostLoginBase();
        
        // If it's a relative URL, construct the full URL
        if (redirectUrl.startsWith('/')) {
          const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
          const baseUrl = isLocal 
            ? 'http://localhost/login' 
            : `https://all-ws-dashboard.aiworkspace.pro/all-workspace/dashboard`;
          console.log('[callback] redirecting to:', `${baseUrl}${redirectUrl}`, { isLocal, hostname: window.location.hostname });
          window.location.href = `${baseUrl}${redirectUrl}`;
        } else {
          console.log('[callback] redirecting to absolute URL:', redirectUrl);
          window.location.href = redirectUrl;
        }
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
