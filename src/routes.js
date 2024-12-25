import { createRouter, createWebHistory } from "vue-router";
import { supabase } from './supabase';
import { useMatterStore } from './store/matter';
import DashboardCt from './components/matter/DashboardCt.vue';
import ManageFilesCt from './components/matter/FilesCt.vue';
import GoalsCt from './components/matter/GoalsCt.vue';
import TasksCt from './components/matter/TasksCt.vue';
import EventsCt from './components/matter/EventsCt.vue';
import LoginPage from './components/LoginPage.vue';
import CallbackPage from './components/CallbackPage.vue';
import MatterLayout from './components/matter/MatterLayout.vue';
import SingleTaskCt from './components/matter/SingleTaskCt.vue';
import UserSettingsCt from './components/UserSettingsCt.vue';

const routes = [
  {
    path: '/all-matters',
    component: () => import('./components/all-matters/AllMatterLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'AllMattersRoot',
        meta: { requiresAuth: true },
        redirect: '/all-matters/dashboard'
      },
      {
        path: 'dashboard',
        name: 'AllMattersDashboard',
        component: () => import('./components/all-matters/AllMattersDashboardCt.vue')
      },
      {
        path: 'tasks',
        name: 'AllTasksPage',
        component: () => import('./components/all-matters/AllTasksCt.vue')
      },
      {
        path: 'goals',
        name: 'AllGoalsPage',
        component: () => import('./components/all-matters/AllGoalsCt.vue')
      },
      {
        path: 'events',
        name: 'AllEventsPage',
        component: () => import('./components/all-matters/AllEventsCt.vue')
      },
      {
        path: 'files',
        name: 'AllFilesPage',
        component: () => import('./components/all-matters/AllFilesCt.vue')
      }
    ]
  },
  { 
    path: '/matter/:matterId?', 
    component: MatterLayout,
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        redirect: to => `/matter/${to.params.matterId}/dashboard`
      },
      {
        path: 'dashboard',
        name: 'DashboardPage',
        component: DashboardCt
      },
      {
        path: 'goals',
        name: 'GoalsPage',
        component: GoalsCt
      },
      {
        path: 'tasks',
        name: 'TasksPage',
        component: TasksCt
      },
      {
        path: 'tasks/:taskId',
        name: 'SingleTaskPage',
        component: () => import('./components/matter/SingleTaskCt.vue')
      },
      {
        path: 'events',
        name: 'EventsPage',
        component: EventsCt
      },
      {
        path: 'files',
        name: 'ManageFilesPage',
        component: ManageFilesCt
      },
      {
        path: 'settings',
        name: 'MatterSettingsPage',
        component: () => import('./components/matter/MatterSettingsCt.vue')
      }
    ]
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
    path: '/settings',
    name: 'UserSettings',
    component: UserSettingsCt,
    meta: { requiresAuth: true }
  },
  {
    path: '/',
    redirect: '/login'
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

// Navigation guard
router.beforeEach(async (to, from, next) => {
  // Get session status first
  const { data: { session } } = await supabase.auth.getSession();
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth);

  // If no session and route requires auth, redirect to login
  if (requiresAuth && !session) {
    next('/login');
    return;
  }

  // Handle root path
  if (to.path === '/') {
    next(session ? '/all-matters' : '/login');
    return;
  }

  // Handle invalid matter routes
  if (to.path.startsWith('/matter/') && (!to.params.matterId || to.params.matterId === '')) {
    next('/all-matters');
    return;
  }

  // Redirect from login if already authenticated
  if (to.path === '/login' && session) {
    next('/all-matters');
    return;
  }

  // Clear matter context when navigating to all-matters routes
  if (to.path.startsWith('/all-matters')) {
    const matterStore = useMatterStore();
    matterStore.setCurrentMatter(null);
  }

  // Handle matter context
  if (session && to.params.matterId) {
    const matterStore = useMatterStore();
    try {
      await matterStore.loadMatters();
      const matter = matterStore.matters.find(m => m.id === parseInt(to.params.matterId));
      if (matter) {
        matterStore.setCurrentMatter(matter);
      }
    } catch (error) {
      console.error('Error loading matter:', error);
    }
  }

  next();
});

export default router;
