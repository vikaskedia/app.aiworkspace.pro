import { createRouter, createWebHistory } from "vue-router";
import { supabase } from './supabase';
import DashboardCt from './components/DashboardCt.vue';
import ManageFilesCt from './components/ManageFilesCt.vue';
import LoginPage from './components/LoginPage.vue';
import CallbackPage from './components/CallbackPage.vue';

const routes = [
  { 
    path: '/', 
    name: 'DashboardPage',
    component: DashboardCt,
    meta: { requiresAuth: true }
  },
  {
    path: '/manage-files',
    name: 'ManageFilesPage',
    component: ManageFilesCt,
    meta: { requiresAuth: true }
  },
  {
    path: '/login',
    name: 'LoginPage',
    component: LoginPage,
    meta: { requiresAuth: false }
  },
  {
    path: '/callback',
    name: 'CallbackPage',
    component: CallbackPage,
    meta: { requiresAuth: false }
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes: routes,
});

// Navigation guard
router.beforeEach(async (to, from, next) => {
  const { data: { session } } = await supabase.auth.getSession();
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth);

  if (requiresAuth && !session) {
    next('/login');
  } else if (to.path === '/login' && session) {
    next('/');
  } else {
    next();
  }
});

export default router;
