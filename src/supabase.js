import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Custom storage implementation
class CrossDomainLocalStorage {
  constructor() {
    this.iframe = null;
    this.initPromise = this.init();
  }

  async init() {
    return new Promise((resolve) => {
      // Create iframe pointing to storage bridge
      this.iframe = document.createElement('iframe');
      this.iframe.src = 'https://www.associateattorney.ai/storage.html';
      this.iframe.style.display = 'none';
      document.body.appendChild(this.iframe);

      // Wait for iframe to load
      this.iframe.onload = () => resolve();
    });
  }

  async setItem(key, value) {
    await this.initPromise;
    return new Promise((resolve) => {
      const handler = (event) => {
        if (event.origin.includes('associateattorney.ai')) {
          if (event.data.type === 'storageConfirmation') {
            window.removeEventListener('message', handler);
            resolve();
          }
        }
      };
      
      window.addEventListener('message', handler);
      
      this.iframe.contentWindow.postMessage({
        type: 'setStorage',
        key,
        value
      }, '*');
    });
  }

  async removeItem(key) {
    await this.initPromise;
    return new Promise((resolve) => {
      const handler = (event) => {
        if (event.origin.includes('associateattorney.ai')) {
          if (event.data.type === 'storageConfirmation') {
            window.removeEventListener('message', handler);
            resolve();
          }
        }
      };
      
      window.addEventListener('message', handler);
      
      this.iframe.contentWindow.postMessage({
        type: 'removeStorage',
        key
      }, '*');
    });
  }

  getItem(key) {
    return localStorage.getItem(key);
  }
}

const crossDomainStorage = new CrossDomainLocalStorage();

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    db: {
      schema: 'public'
    },
    auth: {
      storageKey: 'sb-auth-token',
      storage: crossDomainStorage,
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