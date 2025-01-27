import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Get the root domain for cookies
const getRootDomain = () => {
  const hostname = window.location.hostname;
  if (hostname === 'localhost') return 'localhost';
  // For production domains, ensure we include the dot prefix
  return hostname.includes('associateattorney.ai') ? `.${hostname.split('.').slice(-2).join('.')}` : hostname;
};

console.log('Root Domain:', getRootDomain());

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    db: {
      schema: 'public'
    },
    auth: {
      storageKey: 'sb-auth-token',
      storage: localStorage,
      autoRefreshToken: true,
      persistSession: true,
      cookieOptions: {
        domain: getRootDomain(),
        path: '/',
        sameSite: 'Lax'
      }
    },
    debug: true
  }
);
