import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Get the root domain for cookies
const getRootDomain = () => {
  const hostname = window.location.hostname;
  if (hostname === 'localhost') return 'localhost';
  
  // For production domains
  if (hostname.includes('associateattorney.ai')) {
    // If we're on a subdomain, we need both cookies
    if (hostname.split('.').length > 2) {
      return [
        hostname,  // For subdomain (e.g., app.associateattorney.ai)
        `.${hostname.split('.').slice(-2).join('.')}` // For main domain (.associateattorney.ai)
      ];
    }
    // If we're on main domain, just set for main domain
    return `.${hostname}`;
  }
  
  return hostname;
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
    // Always set in localStorage
    localStorage.setItem(key, value);
    
    // Set cookie(s) based on domain
    const domains = Array.isArray(getRootDomain()) ? getRootDomain() : [getRootDomain()];
    
    // For auth token, ensure it's set in main domain's localStorage
    if (key === 'sb-auth-token' && window.location.hostname.includes('associateattorney.ai')) {
      const mainDomain = 'https://www.associateattorney.ai';
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = `${mainDomain}/storage.html`;
      
      iframe.onload = () => {
        iframe.contentWindow.postMessage({
          type: 'setStorage',
          key: 'sb-auth-token',
          value
        }, mainDomain);
        setTimeout(() => document.body.removeChild(iframe), 100);
      };
      
      document.body.appendChild(iframe);
    }
    
    domains.forEach(domain => {
      document.cookie = `${key}=${value}; domain=${domain}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax${domain !== 'localhost' ? '; Secure' : ''}`;
    });
  },
  removeItem: (key) => {
    // Remove from localStorage
    localStorage.removeItem(key);
    
    // Remove cookie(s) based on domain
    const domains = Array.isArray(getRootDomain()) ? getRootDomain() : [getRootDomain()];
    
    // For auth token, ensure it's removed from main domain's localStorage
    if (key === 'sb-auth-token' && window.location.hostname.includes('associateattorney.ai')) {
      const mainDomain = 'https://www.associateattorney.ai';
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = `${mainDomain}/storage.html`;
      
      iframe.onload = () => {
        iframe.contentWindow.postMessage({
          type: 'removeStorage',
          key: 'sb-auth-token'
        }, mainDomain);
        setTimeout(() => document.body.removeChild(iframe), 100);
      };
      
      document.body.appendChild(iframe);
    }
    
    domains.forEach(domain => {
      document.cookie = `${key}=; domain=${domain}; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
    });
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
        domain: Array.isArray(getRootDomain()) ? getRootDomain()[0] : getRootDomain(),
        path: '/',
        sameSite: 'Lax'
      }
    },
    debug: true
  }
);
