import { createApp } from 'vue'
import './style.css'
import App from './router.vue'
import { createPinia } from 'pinia';
import { useCacheStore } from './store/cache';
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';
import { MP } from './mixpanel';
import { AuthTracking } from './auth-tracking';
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

// Mount the app
rootVueApp.mount('#app')

// Add window error handler
window.onerror = function(message, source, lineno, colno, error) {
  console.error('Window error:', {message, source, lineno, colno, error});
  return false;
};