import { MP } from './mixpanel';
import { supabase } from './supabase';
import { setSessionCookie, clearSessionCookie, syncCookiesToLocalStorage, clearLocalStorageTokens, ACCESS_COOKIE, REFRESH_COOKIE } from './utils/authRedirect';

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
            
            // Set cross-subdomain cookies for session sharing
            if (session.access_token) {
              setSessionCookie(ACCESS_COOKIE, session.access_token);
            }
            if (session.refresh_token) {
              setSessionCookie(REFRESH_COOKIE, session.refresh_token);
            }
            syncCookiesToLocalStorage();
          }
          break;

        case 'SIGNED_OUT':
          MP.track('Authentication State Changed', {
            event: 'SIGNED_OUT'
          });
          
          // Clear cross-subdomain cookies and localStorage
          clearSessionCookie(ACCESS_COOKIE);
          clearSessionCookie(REFRESH_COOKIE);
          clearLocalStorageTokens();
          break;

        case 'TOKEN_REFRESHED':
          MP.track('Authentication State Changed', {
            event: 'TOKEN_REFRESHED'
          });
          
          // Update cross-subdomain cookies with refreshed tokens
          if (session?.access_token) {
            setSessionCookie(ACCESS_COOKIE, session.access_token);
          }
          if (session?.refresh_token) {
            setSessionCookie(REFRESH_COOKIE, session.refresh_token);
          }
          syncCookiesToLocalStorage();
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