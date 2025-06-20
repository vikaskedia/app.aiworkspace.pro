import mixpanel from 'mixpanel-browser';

// Initialize with your project token
const MIXPANEL_TOKEN = import.meta.env.VITE_MIXPANEL_TOKEN;

let isMixpanelInitialized = false;

// Defensive check for SSR and token
if (typeof window !== 'undefined' && MIXPANEL_TOKEN) {
  mixpanel.init(MIXPANEL_TOKEN, {
    debug: import.meta.env.DEV,
    persistence: 'localStorage',
    api_host: 'https://api-js.mixpanel.com',
    ignore_dnt: false,
    autocapture: true
  });
  isMixpanelInitialized = true;
} else if (!MIXPANEL_TOKEN) {
  console.warn('Mixpanel token is not defined. Analytics will be disabled.');
}

// Test user patterns to bypass
const TEST_USER_PATTERNS = [
  'soumen+040225@grmtech.com',
  /^soumen\+.+@grmtech\.com$/  // Matches dynamic test emails like soumen+timestamp@grmtech.com
];

// Helper function to check if user should be bypassed
const shouldBypassTracking = (userIdentifier) => {
  if (!userIdentifier) return false;
  
  return TEST_USER_PATTERNS.some(pattern => {
    if (typeof pattern === 'string') {
      return userIdentifier === pattern;
    }
    return pattern.test(userIdentifier);
  });
};

// Helper functions for tracking
// Note: opt_out_tracking() is used for test users to prevent all tracking.
// opt_in_tracking() is used for normal users to ensure tracking is enabled.
export const MP = {
  identify: (id) => {
    if (!isMixpanelInitialized) return;
    const isTestUser = shouldBypassTracking(id);
    const currentlyOptedOut = mixpanel.has_opted_out_tracking();
    
    // Only change opt status if needed
    if (isTestUser && !currentlyOptedOut) {
      mixpanel.opt_out_tracking();
    } else if (!isTestUser && currentlyOptedOut) {
      mixpanel.opt_in_tracking();
    }

    if (!isTestUser) {
      mixpanel.identify(id);
    }
  },
  
  alias: (id) => {
    if (!isMixpanelInitialized) return;
    if (shouldBypassTracking(id)) {
      mixpanel.opt_out_tracking();
      return;
    }
    mixpanel.opt_in_tracking();
    mixpanel.alias(id);
  },
  
  track: (name, props) => {
    if (!isMixpanelInitialized) return;
    if (mixpanel.has_opted_out_tracking()) return;
    mixpanel.track(name, props);
  },
  
  people: {
    set: (props) => {
      if (!isMixpanelInitialized) return;
      if (mixpanel.has_opted_out_tracking()) return;
      mixpanel.people.set(props);
    }
  },
  
  setUserProperties: (userProps) => {
    if (!isMixpanelInitialized) return;
    if (mixpanel.has_opted_out_tracking()) return;
    mixpanel.people.set({
      '$email': userProps.email,
      '$name': userProps.name,
      'Account Type': userProps.accountType,
      'Last Login': new Date().toISOString()
    });
  }
};
