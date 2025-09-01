import { createApp } from 'vue'
import './style.css'
import './components/single-workspace/excalidraw-custom.css'
import App from './router.vue'
import { createPinia } from 'pinia';
import { useCacheStore } from './store/cache';
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';
import { MP } from './mixpanel';
import { AuthTracking } from './auth-tracking';
import { restoreCrossSubdomainSession } from './plugins/crossSubdomainAuth';
import router from "./routes";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import VueCookies from "vue3-cookies";
import mitt from "mitt";
import VueSignaturePad from "vue-signature-pad";

// Create the app instance
const rootVueApp = createApp(App);

// Error handling
rootVueApp.config.errorHandler = (err, vm, info) => {
  console.error('Global error:', err);
  console.error('Error info:', info);
};

// Setup Pinia
const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);
rootVueApp.use(pinia);

// Initialize cache store
const cacheStore = useCacheStore();
cacheStore.checkVersion();

// Router setup
rootVueApp.use(router);

// Element Plus setup
rootVueApp.use(ElementPlus);

// Register VueSignaturePad globally
rootVueApp.use(VueSignaturePad);

// Cookie setup
rootVueApp.use(VueCookies);

// Event bus setup
const emitter = mitt();
rootVueApp.config.globalProperties.emitter = emitter;

// Base URL setup
rootVueApp.config.globalProperties.baseUrlForApiCall = '';

// Environment checks
if (!import.meta.env.VITE_GITEA_HOST) {
  console.warn('VITE_GITEA_HOST environment variable is not set');
}

if (!import.meta.env.VITE_GITEA_TOKEN) {
  console.warn('VITE_GITEA_TOKEN environment variable is not set');
}

// Mixpanel setup
rootVueApp.config.globalProperties.$mp = MP;

// Auth tracking setup
AuthTracking.setupAuthListener();

// Restore cross-subdomain session before mounting
restoreCrossSubdomainSession().then(() => {
  // Mount the app after session restoration
  rootVueApp.mount('#app')
}).catch((error) => {
  console.error('Failed to restore cross-subdomain session:', error);
  // Mount the app anyway
  rootVueApp.mount('#app')
});

// Add window error handler
window.onerror = function(message, source, lineno, colno, error) {
  // Suppress common ResizeObserver warnings that don't affect functionality
  if (message && message.includes('ResizeObserver loop completed with undelivered notifications')) {
    return true; // Suppress this error
  }
  console.error('Window error:', {message, source, lineno, colno, error});
  return false;
};

// Suppress ResizeObserver errors specifically
const resizeObserverErrorHandler = (e) => {
  if (e.message && e.message.includes('ResizeObserver loop completed with undelivered notifications')) {
    e.stopImmediatePropagation();
  }
};

window.addEventListener('error', resizeObserverErrorHandler);