import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Custom storage implementation
class CrossDomainLocalStorage {
  constructor() {
    this.iframes = [];
    this.domains = [
      'https://www.associateattorney.ai/forms/storage.html',
      'https://app.associateattorney.ai/storage.html'
    ];
    this.initPromise = this.init();
  }

  async init() {
    return Promise.all(this.domains.map(domain => {
      return new Promise((resolve) => {
        const iframe = document.createElement('iframe');
        iframe.src = domain;
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        
        iframe.onload = () => {
          this.iframes.push(iframe);
          resolve();
        };
      });
    }));
  }

  async setItem(key, value) {
    await this.initPromise;
    
    // Also set in local storage
    localStorage.setItem(key, value);
    
    return Promise.all(this.iframes.map(iframe => {
      return new Promise((resolve) => {
        const handler = (event) => {
          if (event.origin.includes('associateattorney.ai')) {
            if (event.data.type === 'storageConfirmation' && event.data.key === key) {
              window.removeEventListener('message', handler);
              resolve();
            }
          }
        };
        
        window.addEventListener('message', handler);
        
        iframe.contentWindow.postMessage({
          type: 'setStorage',
          key,
          value
        }, '*');
      });
    }));
  }

  async removeItem(key) {
    await this.initPromise;
    
    // Also remove from local storage
    localStorage.removeItem(key);
    
    return Promise.all(this.iframes.map(iframe => {
      return new Promise((resolve) => {
        const handler = (event) => {
          if (event.origin.includes('associateattorney.ai')) {
            if (event.data.type === 'storageConfirmation' && event.data.key === key) {
              window.removeEventListener('message', handler);
              resolve();
            }
          }
        };
        
        window.addEventListener('message', handler);
        
        iframe.contentWindow.postMessage({
          type: 'removeStorage',
          key
        }, '*');
      });
    }));
  }

  getItem(key) {
    // First try local storage
    const localValue = localStorage.getItem(key);
    if (localValue !== null) {
      return localValue;
    }
    
    // If not found locally, try to get from iframes
    if (this.iframes.length > 0) {
      return new Promise((resolve) => {
        const handler = (event) => {
          if (event.origin.includes('associateattorney.ai')) {
            if (event.data.type === 'storageValue' && event.data.key === key) {
              window.removeEventListener('message', handler);
              resolve(event.data.value);
            }
          }
        };
        
        window.addEventListener('message', handler);
        
        this.iframes[0].contentWindow.postMessage({
          type: 'getStorage',
          key
        }, '*');
      });
    }
    
    return null;
  }
}

// Determine which storage implementation to use
const getStorageImplementation = () => {
  if (window.location.hostname.includes('localhost')) {
    return localStorage;
  }
  return new CrossDomainLocalStorage();
};

const storage = getStorageImplementation();

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    db: {
      schema: 'public'
    },
    auth: {
      storageKey: 'sb-auth-token',
      storage: storage,
      autoRefreshToken: true,
      persistSession: true,
      cookieOptions: {
        domain: '.associateattorney.ai',
        path: '/',
        sameSite: 'Lax'
      }
    },
    debug: true
  }
);