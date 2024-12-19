import { createRouter, createWebHistory } from "vue-router";
import { supabase } from './supabase';
import DashboardCt from './components/DashboardCt.vue';
import ManageFilesCt from './components/ManageFilesCt.vue';
import LoginPage from './components/LoginPage.vue';
import CallbackPage from './components/CallbackPage.vue';
import GoalsCt from './components/GoalsCt.vue';
import TasksCt from './components/TasksCt.vue';
import EventsCt from './components/EventsCt.vue';
import PlanCt from './components/PlanCt.vue';

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
  },
  {
    path: '/goals',
    name: 'GoalsPage',
    component: GoalsCt,
    meta: { requiresAuth: true }
  },
  {
    path: '/tasks',
    name: 'TasksPage',
    component: TasksCt,
    meta: { requiresAuth: true }
  },
  {
    path: '/events',
    name: 'EventsPage',
    component: EventsCt,
    meta: { requiresAuth: true }
  },
  {
    path: '/plan',
    name: 'PlanPage',
    component: PlanCt,
    meta: { requiresAuth: true }
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
