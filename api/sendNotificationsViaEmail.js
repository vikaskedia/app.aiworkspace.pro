import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Initialize Supabase client with service_role key
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  if (req.method === 'GET') {
    const startTime = performance.now();
    const metrics = {
      totalTime: 0,
      fetchNotificationsTime: 0,
      processNotificationsTime: 0,
      cacheHits: 0,
      cacheMisses: 0
    };

    try {
      // Cache for user settings
      const userSettingsCache = new Map();

      // Fetch notifications
      const fetchStart = performance.now();
      const { data: notifications, error } = await supabase
        .from('notifications')
        .select('*')
        .limit(50)
        .order('created_at', { ascending: false });
      metrics.fetchNotificationsTime = performance.now() - fetchStart;

      if (error) throw error;

      // Process each notification and check user settings
      const processStart = performance.now();
      const processedNotifications = await Promise.all(
        notifications.map(async (notification) => {
          let emailEnabled = false;

          // Check cache first
          if (userSettingsCache.has(notification.user_id)) {
            emailEnabled = userSettingsCache.get(notification.user_id);
            metrics.cacheHits++;
          } else {
            // Get user settings from database if not in cache
            metrics.cacheMisses++;
            const { data: userSettings } = await supabase
              .from('user_settings')
              .select('settings')
              .eq('user_id', notification.user_id)
              .maybeSingle();

            // Parse settings and cache the result
            emailEnabled = userSettings?.settings?.emailNotificationsEnabled ?? false;
            userSettingsCache.set(notification.user_id, emailEnabled);
          }

          return {
            ...notification,
            emailNotificationsEnabled: emailEnabled
          };
        })
      );
      metrics.processNotificationsTime = performance.now() - processStart;
      metrics.totalTime = performance.now() - startTime;

      return res.status(200).json({ 
        message: 'Notifications retrieved successfully',
        data: processedNotifications,
        metrics: {
          ...metrics,
          totalTimeMs: Math.round(metrics.totalTime),
          fetchTimeMs: Math.round(metrics.fetchNotificationsTime),
          processTimeMs: Math.round(metrics.processNotificationsTime),
          cacheEfficiency: `${metrics.cacheHits}/${metrics.cacheHits + metrics.cacheMisses} hits`
        }
      });
    } catch (error) {
      metrics.totalTime = performance.now() - startTime;
      console.error('Error fetching notifications:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch notifications',
        details: error.message,
        metrics: {
          totalTimeMs: Math.round(metrics.totalTime)
        }
      });
    }
  }
  
  if (req.method === 'POST') {
    return res.status(200).json({ 
      message: 'Hello World from POST method!'
    });
  }

  // Handle unsupported methods
  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ 
    error: `Method ${req.method} Not Allowed` 
  });
}