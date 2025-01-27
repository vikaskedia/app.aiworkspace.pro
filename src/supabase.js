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

// Custom storage implementation
const customStorage = {
  getItem: (key) => {
    // First try to get from localStorage
    const localValue = localStorage.getItem(key);
    if (localValue) return localValue;

    // If not in localStorage, try to get from cookie
    const cookies = document.cookie.split(';');
    const cookie = cookies.find(c => c.trim().startsWith(`${key}=`));
    return cookie ? cookie.split('=')[1] : null;
  },
  setItem: (key, value) => {
    // Set in localStorage
    localStorage.setItem(key, value);
    
    // Also set in cookie for cross-domain access
    const domain = getRootDomain();
    document.cookie = `${key}=${value}; domain=${domain}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
  },
  removeItem: (key) => {
    // Remove from localStorage
    localStorage.removeItem(key);
    
    // Remove from cookie
    const domain = getRootDomain();
    document.cookie = `${key}=; domain=${domain}; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
  }
};

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    db: {
      schema: 'public'
    },
    auth: {
      storageKey: 'sb-auth-token',
      storage: customStorage,
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
