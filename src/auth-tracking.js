import { MP } from './mixpanel';
import { supabase } from './supabase';

export const AuthTracking = {
  // Track authentication state changes
  setupAuthListener() {
    supabase.auth.onAuthStateChange((event, session) => {
      switch (event) {
        case 'SIGNED_IN':
          if (session?.user) {
            MP.identify(session.user.id);
            MP.track('Authentication State Changed', {
              event: 'SIGNED_IN',
              provider: session.user.app_metadata.provider,
              email: session.user.email
            });
          }
          break;

        case 'SIGNED_OUT':
          MP.track('Authentication State Changed', {
            event: 'SIGNED_OUT'
          });
          break;

        case 'TOKEN_REFRESHED':
          MP.track('Authentication State Changed', {
            event: 'TOKEN_REFRESHED'
          });
          break;

        case 'USER_UPDATED':
          if (session?.user) {
            MP.track('User Profile Updated', {
              email: session.user.email,
              updatedAt: new Date().toISOString()
            });
          }
          break;

        case 'USER_DELETED':
          MP.track('User Account Deleted');
          break;

        case 'PASSWORD_RECOVERY':
          MP.track('Password Recovery Initiated');
          break;
      }
    });
  },

  // Track failed authentication attempts
  trackFailedAuth(error, method) {
    MP.track('Authentication Failed', {
      method,
      error: error.message,
      errorCode: error.status || error.code,
      timestamp: new Date().toISOString()
    });
  },

  // Track user session details
  async trackSessionDetails() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      MP.track('Session Details', {
        provider: session.user.app_metadata.provider,
        lastActivityAt: new Date().toISOString(),
        userMetadata: session.user.user_metadata,
        expiresAt: session.expires_at
      });
    }
  }
};