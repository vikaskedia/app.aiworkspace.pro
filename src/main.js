import { createApp } from 'vue'
import './style.css'
import App from './router.vue'
import { createPinia } from 'pinia';
import { useCacheStore } from './store/cache';
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';
import { MP } from './mixpanel';
import { AuthTracking } from './auth-tracking';

const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);
const rootVueApp = createApp(App);
rootVueApp.use(pinia);

// Initialize cache store
const cacheStore = useCacheStore();
cacheStore.checkVersion();

import router from "./routes";
rootVueApp.use(router);

import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
rootVueApp.use(ElementPlus);

/**
 * Install vue3 cookie
 */
import VueCookies from "vue3-cookies";
rootVueApp.use(VueCookies);

/**
 * Event bus
 * Ref: https://stackoverflow.com/questions/63471824/vue-js-3-event-bus
 * Where is the event bus is used?
 *  When the active tab changes in the change page then the Ct is informed that the active tab has changed so that it can
 *  set its own caret position correctly.
 * To search places where it has been used search in vscode for the word "emitter"
 */
import mitt from "mitt";
const emitter = mitt();
rootVueApp.config.globalProperties.emitter = emitter;

// set base url
rootVueApp.config.globalProperties.baseUrlForApiCall = '';

if (!import.meta.env.VITE_GITEA_HOST) {
  console.error('VITE_GITEA_HOST environment variable is not set');
}

if (!import.meta.env.VITE_GITEA_TOKEN) {
  console.error('VITE_GITEA_TOKEN environment variable is not set');
}

// Add to global properties
rootVueApp.config.globalProperties.$mp = MP;

// Initialize auth tracking
AuthTracking.setupAuthListener();

rootVueApp.mount('#app')