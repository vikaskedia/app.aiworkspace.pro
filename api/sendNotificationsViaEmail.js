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
      const userSettingsCache = new Map();
      const userInfoArray = [];
      const processedUserIds = new Set();

      // Fetch notifications
      const fetchStart = performance.now();
      // Original query for reference:
      // const { data: notifications, error } = await supabase
      //   .from('notifications')
      //   .select('*')
      //   .limit(50)
      //   .order('created_at', { ascending: false });

      // Modified query for specific user and type
      const { data: notifications, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', '455ea50c-960c-4f62-b98e-b968e6fe57aa')
        .eq('type', 'matter_shared')
        .limit(2)
        .order('created_at', { ascending: false });
      metrics.fetchNotificationsTime = performance.now() - fetchStart;

      if (error) throw error;

      const processStart = performance.now();
      const processedNotifications = [];

      for (const notification of notifications) {
        let emailEnabled = false;
        let emailSendStatus = 'not_attempted'; // Track email status
        let emailSendMessage = '';
        const userIds = [notification.actor_id, notification.user_id].filter(Boolean);

        for (const userId of userIds) {
          if (!processedUserIds.has(userId)) {
            const { data: userData } = await supabase
              .rpc('get_user_info_by_id', { user_id: userId });

            const { data: userSettings } = await supabase
              .from('user_settings')
              .select('settings')
              .eq('user_id', userId)
              .maybeSingle();

            userInfoArray.push({
              id: userId,
              email: userData?.[0]?.email || 'Unknown',
              emailNotificationsEnabled: userSettings?.settings?.emailNotificationsEnabled ?? false
            });
            
            processedUserIds.add(userId);
          }
        }

        const userInfo = userInfoArray.find(u => u.id === notification.user_id);
        const actorInfo = userInfoArray.find(u => u.id === notification.actor_id);
        emailEnabled = userInfo?.emailNotificationsEnabled ?? false;

        // Send email if notifications are enabled
        if (emailEnabled && userInfo?.email) {
          try {
            const actorEmail = actorInfo?.email || 'Someone';
            let emailText;

            switch (notification.type) {
              case 'task_assigned':
                emailText = `${actorEmail} assigned you a task: ${notification.data.task_title}`;
                break;
              case 'task_created':
                emailText = `${actorEmail} created a new task: ${notification.data.task_title}`;
                break;
              case 'task_updated':
                emailText = `${actorEmail} updated task: ${notification.data.task_title}`;
                break;
              case 'matter_shared':
                emailText = `${actorEmail} shared a matter with you: ${notification.data.matter_title}`;
                break;
              case 'mention':
                emailText = `${notification.data.comment_by} mentioned you in task: ${notification.data.task_title}`;
                break;
              default:
                emailText = 'New notification';
            }

            const emailResponse = await fetch('https://app.associateattorney.ai/api/sendemail', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                to: userInfo.email,
                text: `Hi,\n${emailText}`
              })
            });

            const emailResult = await emailResponse.json();
            
            if (emailResponse.ok) {
              emailSendStatus = 'success';
              emailSendMessage = 'Email sent successfully';
            } else {
              emailSendStatus = 'failed';
              emailSendMessage = `Email send failed: ${emailResult.error || 'Unknown error'}`;
            }
          } catch (error) {
            emailSendStatus = 'error';
            emailSendMessage = `Error sending email: ${error.message}`;
            console.error('Error sending email notification:', error);
          }
        } else {
          emailSendStatus = 'skipped';
          emailSendMessage = emailEnabled ? 'No email address available' : 'Email notifications disabled';
        }

        processedNotifications.push({
          ...notification,
          emailNotificationsEnabled: emailEnabled,
          emailSendStatus,
          emailSendMessage
        });
      }

      metrics.processNotificationsTime = performance.now() - processStart;
      metrics.totalTime = performance.now() - startTime;

      return res.status(200).json({ 
        message: 'Notifications retrieved successfully',
        data: processedNotifications,
        userInfo: userInfoArray,
        metrics: {
          ...metrics,
          totalTimeMs: Math.round(metrics.totalTime),
          fetchTimeMs: Math.round(metrics.fetchNotificationsTime),
          processTimeMs: Math.round(metrics.processNotificationsTime)
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