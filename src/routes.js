import { createRouter, createWebHistory } from "vue-router";
import { supabase } from './supabase';
import { useMatterStore } from './store/matter';
import DashboardCt from './components/matter/DashboardCt.vue';
import ManageFilesCt from './components/matter/ManageFilesCt.vue';
import GoalsCt from './components/matter/GoalsCt.vue';
import TasksCt from './components/matter/TasksCt.vue';
import EventsCt from './components/matter/EventsCt.vue';
import LoginPage from './components/LoginPage.vue';
import CallbackPage from './components/CallbackPage.vue';

const routes = [
  {
    path: '/all-matters',
    name: 'AllMattersPage',
    component: () => import('./components/AllMattersCt.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: 'tasks',
        name: 'AllTasksPage',
        component: () => import('./components/AllTasksCt.vue')
      },
      {
        path: 'goals',
        name: 'AllGoalsPage',
        component: () => import('./components/AllGoalsCt.vue')
      },
      {
        path: 'events',
        name: 'AllEventsPage',
        component: () => import('./components/AllEventsCt.vue')
      },
      {
        path: 'files',
        name: 'AllFilesPage',
        component: () => import('./components/AllFilesCt.vue')
      }
    ]
  },
  { 
    path: '/matter/:matterId?', 
    name: 'DashboardPage',
    component: DashboardCt,
    meta: { requiresAuth: true },
    children: [
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
        path: 'manage',
        name: 'ManageMatterPage',
        component: () => import('./components/matter/ManageMatterCt.vue')
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
    path: '/',
    redirect: '/all-matters'
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

// Navigation guard
router.beforeEach(async (to, from, next) => {
  const { data: { session } } = await supabase.auth.getSession();
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth);

  if (requiresAuth && !session) {
    next('/login');
    return;
  }

  if (to.path === '/login' && session) {
    next('/all-matters');
    return;
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
