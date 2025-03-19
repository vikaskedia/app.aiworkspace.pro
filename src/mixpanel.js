import mixpanel from 'mixpanel-browser';

// Initialize with your project token
const MIXPANEL_TOKEN = import.meta.env.VITE_MIXPANEL_TOKEN;

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
    mixpanel.identify(id);
  },
  
  alias: (id) => {
    mixpanel.alias(id);
  },
  
  track: (name, props) => {
    mixpanel.track(name, props);
  },
  
  people: {
    set: (props) => {
      mixpanel.people.set(props);
    }
  },
  
  setUserProperties: (userProps) => {
    // Set user properties and profile
    mixpanel.people.set({
      '$email': userProps.email,
      '$name': userProps.name,
      'Account Type': userProps.accountType,
      'Last Login': new Date().toISOString()
    });
  }
};
