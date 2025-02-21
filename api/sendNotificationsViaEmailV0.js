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
        // .eq('type', 'mention')
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
            const timestamp = new Date(notification.created_at).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            });

            let taskUrl;
            if (notification.type.includes('task')) {
              // Fetch matter_id for task-related notifications
              const { data: taskData, error: taskError } = await supabase
                .from('tasks')
                .select('matter_id')
                .eq('id', notification.data.task_id)
                .single();

              if (!taskError && taskData) {
                taskUrl = `https://app.associateattorney.ai/single-matter/${taskData.matter_id}/tasks/${notification.data.task_id}`;
              }
            }
            
            let emailText;
            let emailHtml;

            switch (notification.type) {
              case 'task_assigned':
                emailText = `${actorEmail} assigned you a task: ${notification.data.task_title}\n${timestamp}`;
                emailHtml = `
                  <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <p>Hi,</p>
                    <p><strong>${actorEmail}</strong> assigned you a task:</p>
                    <div style="margin: 15px 0; padding: 10px; background-color: #f5f5f5; border-left: 4px solid #007bff;">
                      ${taskUrl ? `<a href="${taskUrl}" style="color: #333; text-decoration: none;">` : ''}
                        ${notification.data.task_title}
                      ${taskUrl ? '</a>' : ''}
                      <p style="color: #666; font-size: 0.9em; margin-top: 8px;">${timestamp}</p>
                    </div>
                    ${taskUrl ? `
                    <p style="margin-top: 15px;">
                      <a href="${taskUrl}" style="color: #007bff; text-decoration: none;">View Task →</a>
                    </p>
                    ` : ''}
                  </div>`;
                break;
              case 'task_created':
                emailText = `${actorEmail} created a new task: ${notification.data.task_title}\n${timestamp}`;
                emailHtml = `
                  <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <p>Hi,</p>
                    <p><strong>${actorEmail}</strong> created a new task:</p>
                    <div style="margin: 15px 0; padding: 10px; background-color: #f5f5f5; border-left: 4px solid #28a745;">
                      <a href="${taskUrl}" style="color: #333; text-decoration: none;">
                        ${notification.data.task_title}
                      </a>
                      <p style="color: #666; font-size: 0.9em; margin-top: 8px;">${timestamp}</p>
                    </div>
                    <p style="margin-top: 15px;">
                      <a href="${taskUrl}" style="color: #28a745; text-decoration: none;">View Task →</a>
                    </p>
                  </div>`;
                break;
              case 'task_updated':
                emailText = `${actorEmail} updated task: ${notification.data.task_title}\n${timestamp}`;
                emailHtml = `
                  <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <p>Hi,</p>
                    <p><strong>${actorEmail}</strong> updated task:</p>
                    <div style="margin: 15px 0; padding: 10px; background-color: #f5f5f5; border-left: 4px solid #ffc107;">
                      ${notification.data.task_title}
                      <p style="color: #666; font-size: 0.9em; margin-top: 8px;">${timestamp}</p>
                    </div>
                  </div>`;
                break;
              case 'matter_shared':
                emailText = `${actorEmail} shared a matter with you: ${notification.data.matter_title}\n${timestamp}`;
                emailHtml = `
                  <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <p>Hi,</p>
                    <p><strong>${actorEmail}</strong> shared a matter with you:</p>
                    <div style="margin: 15px 0; padding: 10px; background-color: #f5f5f5; border-left: 4px solid #17a2b8;">
                      ${notification.data.matter_title}
                      <p style="color: #666; font-size: 0.9em; margin-top: 8px;">${timestamp}</p>
                    </div>
                  </div>`;
                break;
              case 'mention':
                emailText = `${notification.data.comment_by} mentioned you in task: ${notification.data.task_title}\n${timestamp}`;
                emailHtml = `
                  <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <p>Hi,</p>
                    <p><strong>${notification.data.comment_by}</strong> mentioned you in task:</p>
                    <div style="margin: 15px 0; padding: 10px; background-color: #f5f5f5; border-left: 4px solid #6f42c1;">
                      ${notification.data.task_title}
                      <p style="color: #666; font-size: 0.9em; margin-top: 8px;">${timestamp}</p>
                    </div>
                  </div>`;
                break;
              default:
                emailText = 'New notification';
                emailHtml = `
                  <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <p>Hi,</p>
                    <p>You have a new notification.</p>
                  </div>`;
            }

            const emailResponse = await fetch('https://app.associateattorney.ai/api/sendemail', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                to: userInfo.email,
                text: `Hi,\n${emailText}`,
                html: emailHtml
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