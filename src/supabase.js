import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

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
        domain: '.aiworkspace.pro',
        path: '/',
        sameSite: 'Lax',
        secure: window.location.protocol === 'https:'
      }
    },
    debug: true
  }
);