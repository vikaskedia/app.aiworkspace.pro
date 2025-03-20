import mixpanel from 'mixpanel-browser';

// Initialize with your project token
const MIXPANEL_TOKEN = import.meta.env.VITE_MIXPANEL_TOKEN;

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

// Configure Mixpanel
mixpanel.init(MIXPANEL_TOKEN, {
  debug: import.meta.env.DEV,
  persistence: 'localStorage',
  api_host: 'https://api-js.mixpanel.com',
  ignore_dnt: false,
  autocapture: true
});

// Helper functions for tracking
export const MP = {
  identify: (id) => {
    if (shouldBypassTracking(id)) return;
    mixpanel.identify(id);
  },
  
  alias: (id) => {
    if (shouldBypassTracking(id)) return;
    mixpanel.alias(id);
  },
  
  track: (name, props) => {
    // Check both user ID and email in props
    if (props?.userId && shouldBypassTracking(props.userId)) return;
    if (props?.email && shouldBypassTracking(props.email)) return;
    mixpanel.track(name, props);
  },
  
  people: {
    set: (props) => {
      if (props?.$email && shouldBypassTracking(props.$email)) return;
      mixpanel.people.set(props);
    }
  },
  
  setUserProperties: (userProps) => {
    if (shouldBypassTracking(userProps.email)) return;
    mixpanel.people.set({
      '$email': userProps.email,
      '$name': userProps.name,
      'Account Type': userProps.accountType,
      'Last Login': new Date().toISOString()
    });
  }
};
