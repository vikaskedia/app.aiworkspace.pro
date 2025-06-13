import { createRouter, createWebHistory } from "vue-router";
import { supabase } from './supabase';
import { useMatterStore } from './store/matter';
import DashboardCt from './components/single-matter/DashboardCt.vue';
import ManageFilesCt from './components/single-matter/FilesCt.vue';
import GoalsCt from './components/single-matter/GoalsCt.vue';
import TasksCt from './components/single-matter/TasksCt.vue';
import EventsCt from './components/single-matter/EventsCt.vue';
import LoginPage from './components/LoginPage.vue';
import SignupPage from './components/SignupPage.vue';
import CallbackPage from './components/CallbackPage.vue';
import MatterLayout from './components/single-matter/MatterLayout.vue';
import OutlineCt from './components/single-matter/OutlineCt.vue';
// import DetailedTaskViewCt from './components/single-matter/DetailedTaskViewCt.vue';
// import AllActivityLogCt from './components/all-matters/AllActivityLogCt.vue';
import DebugCors from './components/DebugCors.vue';
import InitialConsultationCt from './components/initial-consultaion/InitialConsultationCt.vue';
import DetailedEventViewCt from './components/single-matter/DetailedEventViewCt.vue';


const routes = [
  {
    path: '/all-workspace',
    component: () => import('./components/all-matters/AllMatterLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'AllMattersRoot',
        meta: { requiresAuth: true },
        redirect: '/all-workspace/dashboard'
      },
      {
        path: 'dashboard',
        name: 'AllMattersDashboard',
        component: () => import('./components/all-matters/AllMattersDashboardCt.vue')
      },
      {
        path: 'tasks',
        name: 'AllTasksPage',
        component: () => import('./components/all-matters/AllTasksCt.vue'),
        children: [
          {
            path: 'saved-filters/:filterId',
            component: () => import('./components/all-matters/AllTasksCt.vue')
          }
        ]
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
      },
      {
        path: 'settings',
        name: 'AllMatterSettingsPage',
        component: () => import('./components/all-matters/AllMatterSettingsCt.vue')
      },
       {
        path: 'activity-log',
        name: 'AllActivityLogPage',
        component: () => import('./components/all-matters/AllActivityLogCt.vue')
        }
        
    ]
  },
  { 
    path: '/single-workspace/:matterId?',
    component: MatterLayout,
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        redirect: to => `/single-workspace/${to.params.matterId}/dashboard`
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
        component: () => import('./components/single-matter/DetailedTaskViewCt.vue')
      },
      {
        path: 'events',
        name: 'EventsPage',
        component: EventsCt
      },
      {
        path: 'events/:id',
        name: 'DetailedEventView',
        component: DetailedEventViewCt
      },
      {
        path: 'files',
        name: 'ManageFilesPage',
        component: ManageFilesCt
      },
      {
        path: 'outlines',
        name: 'OutlinesPage',
        component: OutlineCt
      },
      {
        path: 'settings',
        name: 'SingleMatterSettingsPage',
        component: () => import('./components/single-matter/MatterSettingsCt.vue')
      },
      {
        path: 'communications',
        name: 'CommunicationsPage',
        component: () => import('./components/single-matter/CommunicationsCt.vue')
      },
      {
        path: 'ai_phone',
        name: 'AiPhonePage',
        component: () => import('./components/single-matter/AiPhoneCt.vue')
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
    path: '/signup',
    name: 'SignupPage',
    component: SignupPage,
    meta: { requiresAuth: false }
  },
  {
    path: '/debug-cors',
    name: 'DebugCors',
    component: DebugCors,
    meta: { requiresAuth: false }
  },
  {
    path: '/callback',
    name: 'CallbackPage',
    component: CallbackPage,
    meta: { requiresAuth: false }
  },
  {
    path: '/talk-to-dev',
    name: 'TalkToDev',
    component: () => import('./components/talk-to-dev/TalkToDevSystem.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/talk-to-dev/:id',
    name: 'TopicDetails',
    component: () => import('./components/talk-to-dev/TalkToDevTopicDetails.vue')
  }, 
  {
    path: '/ai-attorney',
    name: 'AIAttorney',
    component: () => import('./components/AIAttorneyCt.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/initial-consultation',
    name: 'InitialConsultation',
    component: InitialConsultationCt,
    meta: { requiresAuth: true }
  },
  {
    path: '/terms-of-service',
    name: 'TermsOfService',
    component: () => import('./components/legal/TermsOfService.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/privacy-policy',
    name: 'PrivacyPolicy', 
    component: () => import('./components/legal/PrivacyPolicy.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/referral-system',
    name: 'ReferralSystem',
    component: () => import('./components/referral-system/ReferralSystemCt.vue')
  },
  {
      path: '/cases',
      name: 'Cases',
      component: () => import('./components/cases/CasesCt.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/case/:title',
      name: 'CaseDetail',
      component: () => import('./components/cases/CaseDetailCt.vue'),
      meta: { requiresAuth: true }
    },
  {
    path: '/settings/email-notifications',
    component: () => import('./components/all-matters/AllMatterLayout.vue'),
    children: [
      {
        path: '',
        name: 'EmailNotifications',
        component: () => import('./components/settings/EmailNotificationsCt.vue'),
        meta: {
          requiresAuth: true
        }
      }
    ]
  },
  {
    path: '/billing',
    component: () => import('./components/all-matters/AllMatterLayout.vue'),
    children: [
      {
        path: '',
        name: 'Billing',
        component: () => import('./components/BillingCt.vue'),
        meta: {
          requiresAuth: true
        }
      }
    ]
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

  // If authenticated, check matter count and handle redirects
  if (session && to.path !== '/initial-consultation') {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Handle referral completion if exists
      const referrerId = localStorage.getItem('referrerId');
      const referralCode = localStorage.getItem('referralCode');

      // // Get root domain dynamically
      // const getRootDomain = () => {
      //   const hostname = window.location.hostname;
      //   if (hostname === 'localhost') return 'localhost';
      //   return '.' + hostname.split('.').slice(-2).join('.');
      // };

      // // Set cookie with dynamic domain
      // document.cookie = `sb-auth-token=${session.access_token}; domain=${getRootDomain()}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;      

      if (referrerId && referralCode) {
        // Update the pending referral
        const { error: updateError } = await supabase
          .from('referrals')
          .update({
            referred_email: user.email,
            status: 'Active',
            reward_amount: 0.00
          })
          .eq('referrer_id', referrerId)
          .eq('status', 'Pending')
          .eq('referred_email', 'pending');

        if (updateError) {
          console.error('Error updating referral:', updateError);
        }

        // Clean up localStorage
        localStorage.removeItem('referrerId');
        localStorage.removeItem('referralCode');
      }

      const { data: matters, error } = await supabase
        .from('matters')
        .select(`
          *,
         workspace_access!inner (
            access_type,
            shared_with_user_id
          )
        `)
        .eq('archived', false)
        .eq('workspace_access.shared_with_user_id', user.id);

      if (error) throw error;

      // Handle the 3 scenarios
      /*if (matters.length === 0) {
        next('/initial-consultation');
        return;
      } else if (matters.length === 1 && to.path === '/') {
        next(`/single-matter/${matters[0].id}/dashboard`);
        return;
      } else if (matters.length > 1 && to.path === '/') {
        next('/all-matters/dashboard');
        return;
      }*/
    } catch (error) {
      console.error('Error checking matters:', error);
    }
  }

  // Handle root path
  if (to.path === '/') {
    next(session ? '/all-workspace' : '/login');
    return;
  }

  // Rest of your existing navigation guard code
  if (to.path.startsWith('/single-workspace/') && (!to.params.matterId || to.params.matterId === '')) {
    next('/all-workspace');
    return;
  }

  // Clear matter context when navigating to all-matters routes
  if (to.path.startsWith('/all-workspace')) {
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
