import { createRouter, createWebHistory } from "vue-router";
import { supabase } from './supabase';
import { useMatterStore } from './store/workspace';
import DashboardCt from './components/single-workspace/DashboardCt.vue';
import ManageFilesCt from './components/single-workspace/FilesCt.vue';
import GoalsCt from './components/single-workspace/GoalsCt.vue';
import TasksCt from './components/single-workspace/TasksCt.vue';
import EventsCt from './components/single-workspace/EventsCt.vue';
import ContactsCt from './components/single-workspace/ContactsCt.vue';
import LoginPage from './components/LoginPage.vue';
import SignupPage from './components/SignupPage.vue';
import CallbackPage from './components/CallbackPage.vue';
import WorkspaceLayout from './components/single-workspace/WorkspaceLayout.vue';
import OutlineCt from './components/single-workspace/OutlineCt.vue';
// import DetailedTaskViewCt from './components/single-workspace/DetailedTaskViewCt.vue';
// import AllActivityLogCt from './components/all-workspaces/AllActivityLogCt.vue';
import DebugCors from './components/DebugCors.vue';
import InitialConsultationCt from './components/initial-consultaion/InitialConsultationCt.vue';
import DetailedEventViewCt from './components/single-workspace/DetailedEventViewCt.vue';


const routes = [
  {
    path: '/all-workspace',
    component: () => import('./components/all-workspaces/AllWorkspaceLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'AllWorkspacesRoot',
        meta: { requiresAuth: true },
        redirect: '/all-workspace/dashboard'
      },
      {
        path: 'dashboard',
        name: 'AllWorkspacesDashboard',
        component: () => import('./components/all-workspaces/AllWorkspacesDashboardCt.vue')
      },
      {
        path: 'tasks',
        name: 'AllTasksPage',
        component: () => import('./components/all-workspaces/AllTasksCt.vue'),
        children: [
          {
            path: 'saved-filters/:filterId',
            component: () => import('./components/all-workspaces/AllTasksCt.vue')
          }
        ]
      },
      {
        path: 'goals',
        name: 'AllGoalsPage',
        component: () => import('./components/all-workspaces/AllGoalsCt.vue')
      },
      {
        path: 'events',
        name: 'AllEventsPage',
        component: () => import('./components/all-workspaces/AllEventsCt.vue')
      },
      {
        path: 'files',
        name: 'AllFilesPage',
        component: () => import('./components/all-workspaces/AllFilesCt.vue')
      },
      {
        path: 'contacts',
        name: 'AllContactsPage',
        component: () => import('./components/all-workspaces/AllContactsCt.vue')
      },
      {
        path: 'settings',
        name: 'AllMatterSettingsPage',
        component: () => import('./components/all-workspaces/AllWorkspaceSettingsCt.vue')
      },
       {
        path: 'activity-log',
        name: 'AllActivityLogPage',
        component: () => import('./components/all-workspaces/AllActivityLogCt.vue')
        }
        
    ]
  },
  { 
    path: '/single-workspace/:workspaceId?',
    component: WorkspaceLayout,
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        redirect: to => `/single-workspace/${to.params.workspaceId}/dashboard`
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
        component: () => import('./components/single-workspace/DetailedTaskViewCt.vue')
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
        component: () => import('./components/single-workspace/WorkspaceSettingsCt.vue')
      },
      {
        path: 'communications',
        name: 'CommunicationsPage',
        component: () => import('./components/single-workspace/CommunicationsCt.vue')
      },
      {
        path: 'ai_phone/:phoneId?',
        name: 'AiPhonePage',
        component: () => import('./components/single-workspace/AiPhoneCt.vue'),
        props: route => ({
          phoneId: route.params.phoneId,
          conversationId: route.query.conversation,
          selectedTag: route.query.tag,
          searchQuery: route.query.search,
          showUntagged: route.query.untagged === 'true',
          chatSearchQuery: route.query.chat_search
        })
      },
      {
        path: 'ai_intake',
        name: 'AiIntakePage',
        component: () => import('./components/single-workspace/AiIntakeCt.vue')
      },
      {
        path: 'ai_fax',
        name: 'AiFaxPage',
        component: () => import('./components/single-workspace/AiFaxCt.vue')
      },
      {
        path: 'ai_portfolio',
        name: 'AiPortfolioPage',
        component: () => import('./components/single-workspace/AiPortfolioManagerCt.vue')
      },
      {
        path: 'ai_portfolio/:portfolioId/spreadsheet/:spreadsheetId/history/:historyId',
        name: 'AiPortfolioSpreadsheetHistoryPage',
        component: () => import('./components/single-workspace/AiPortfolioManagerCt.vue'),
        props: route => ({
          portfolioId: route.params.portfolioId,
          spreadsheetId: route.params.spreadsheetId,
          historyId: route.params.historyId,
          showHistory: true
        })
      },
      {
        path: 'ai_fund_analyst',
        name: 'AiFundAnalystPage',
        component: () => import('./components/single-workspace/AiFundAnalystCt.vue')
      },
      {
        path: 'contacts',
        name: 'ContactsPage',
        component: ContactsCt
      },
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
    path: '/external-task/:shareId',
    name: 'ExternalTaskView',
    component: () => import('./components/ExternalTaskView.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/intake-share/:shareId', 
    name: 'IntakeShareView',
    component: () => import('./components/IntakeShareView.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/i/:shortId',
    name: 'IntakeShareViewShort',
    component: () => import('./components/IntakeShareShortView.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/intake-process/:name',
    name: 'IntakeProcess',
    component: () => import('./components/IntakeProcessCt.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/short-link/:shortId',
    name: 'ShareTaskRedirect',
    component: () => import('./components/ShareTaskRedirect.vue'),
    meta: { requiresAuth: false }
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
    component: () => import('./components/all-workspaces/AllWorkspaceLayout.vue'),
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
    component: () => import('./components/all-workspaces/AllWorkspaceLayout.vue'),
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

  // If authenticated, check workspace count and handle redirects
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

      const { data: workspaces, error } = await supabase
        .from('workspaces')
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
      /*if (workspaces.length === 0) {
        next('/initial-consultation');
        return;
      } else if (workspaces.length === 1 && to.path === '/') {
        next(`/single-workspace/${workspaces[0].id}/dashboard`);
        return;
      } else if (workspaces.length > 1 && to.path === '/') {
        next('/all-workspaces/dashboard');
        return;
      }*/
    } catch (error) {
      console.error('Error checking workspaces:', error);
    }
  }

  // Handle root path
  if (to.path === '/') {
    next(session ? '/all-workspace' : '/login');
    return;
  }

  // Rest of your existing navigation guard code
  if (to.path.startsWith('/single-workspace/') && (!to.params.workspaceId || to.params.workspaceId === '')) {
    next('/all-workspace');
    return;
  }

  // Clear workspace context when navigating to all-workspaces routes
  if (to.path.startsWith('/all-workspace')) {
    const matterStore = useMatterStore();
    matterStore.setCurrentMatter(null);
  }

  // Handle workspace context
  if (session && to.params.workspaceId) {
    const matterStore = useMatterStore();
    try {
      await matterStore.loadWorkspaces();
      const workspace = matterStore.workspaces.find(m => m.id === parseInt(to.params.workspaceId));
      // Only set as current if workspace exists and user has access
      if (workspace && workspace.hasAccess) {
        matterStore.setCurrentMatter(workspace);
      } else if (to.params.workspaceId) {
        // If workspace doesn't exist or user has no access, redirect to all workspaces
        next('/all-workspace');
        return;
      }
    } catch (error) {
      console.error('Error loading workspace:', error);
    }
  }

  next();
});

export default router;
