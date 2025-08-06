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
      const MAX_RETRIES = 24;
      const MAX_AGE_HOURS = 24;

      // Get notifications that haven't been processed or failed
      const { data: notifications, error: notifError } = await supabase
        .from('notifications')
        .select('*')
        .in('email_status', ['not_attempted', 'failed'])
        .lt('retry_count', MAX_RETRIES)
        .gt('created_at', new Date(Date.now() - MAX_AGE_HOURS * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: true });

      if (notifError) throw notifError;

      const processStart = performance.now();
      const processedNotifications = [];

      for (const notification of notifications) {
        // First update status to processing
        await supabase
          .from('notifications')
          .update({
            email_status: 'processing',
            last_email_attempt: new Date().toISOString()
          })
          .eq('id', notification.id);

        // Check user settings
        const { data: userSettings } = await supabase
          .from('user_settings')
          .select('settings')
          .eq('user_id', notification.user_id)
          .maybeSingle();

        const emailEnabled = userSettings?.settings?.emailNotificationsEnabled ?? false;

        // Update notification with email enabled status
        await supabase
          .from('notifications')
          .update({
            email_enabled: emailEnabled,
            email_status: emailEnabled ? 'pending' : 'disabled',
            email_message: emailEnabled ? 'Preparing to send email' : 'Email notifications disabled for user',
            last_email_attempt: new Date().toISOString()
          })
          .eq('id', notification.id);

        if (emailEnabled) {
          try {
            const { data: userInfo, error: userError } = await supabase
              .rpc('get_user_info_by_id', { user_id: notification.user_id });

            const { data: actorInfo, error: actorError } = await supabase
              .rpc('get_user_info_by_id', { user_id: notification.actor_id });

            // Safely access actor email
            const actorEmail = actorInfo?.[0]?.email || 'Someone';

            const emailText = `${actorEmail} ${notification.type.replace('_', ' ')}: ${notification.data.task_title}\n${new Date(notification.created_at).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            })}`;

            let emailHtml;
            let taskUrl;

            if (notification.type.includes('task')) {
              // Fetch workspace_id for task-related notifications
              const { data: taskData, error: taskError } = await supabase
                .from('tasks')
                .select('workspace_id')
                .eq('id', notification.data.task_id)
                .single();

              if (!taskError && taskData) {
                taskUrl = `https://app.aiworkspace.pro/single-workspace/${taskData.workspace_id}/tasks/${notification.data.task_id}`;
              }
            }

            switch (notification.type) {
              case 'task_assigned':
                emailHtml = `
                  <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <p>Hi,</p>
                    <p><strong>${actorInfo[0].email}</strong> assigned you a task:</p>
                    <div style="margin: 15px 0; padding: 10px; background-color: #f5f5f5; border-left: 4px solid #007bff;">
                      ${taskUrl ? `<a href="${taskUrl}" style="color: #333; text-decoration: none;">` : ''}
                        ${notification.data.task_title}
                      ${taskUrl ? '</a>' : ''}
                      <p style="color: #666; font-size: 0.9em; margin-top: 8px;">${new Date(notification.created_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                      })}</p>
                    </div>
                    ${taskUrl ? `
                    <p style="margin-top: 15px;">
                      <a href="${taskUrl}" style="color: #007bff; text-decoration: none;">View Task →</a>
                    </p>
                    ` : ''}
                  </div>`;
                break;
              case 'task_created':
                emailHtml = `
                  <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <p>Hi,</p>
                    <p><strong>${actorInfo[0].email}</strong> created a new task:</p>
                    <div style="margin: 15px 0; padding: 10px; background-color: #f5f5f5; border-left: 4px solid #28a745;">
                      <a href="${taskUrl}" style="color: #333; text-decoration: none;">
                        ${notification.data.task_title}
                      </a>
                      <p style="color: #666; font-size: 0.9em; margin-top: 8px;">${new Date(notification.created_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                      })}</p>
                    </div>
                    <p style="margin-top: 15px;">
                      <a href="${taskUrl}" style="color: #28a745; text-decoration: none;">View Task →</a>
                    </p>
                  </div>`;
                break;
              case 'task_updated':
                emailHtml = `
                  <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <p>Hi,</p>
                    <p><strong>${actorInfo[0].email}</strong> updated task:</p>
                    <div style="margin: 15px 0; padding: 10px; background-color: #f5f5f5; border-left: 4px solid #ffc107;">
                      ${taskUrl ? `<a href="${taskUrl}" style="color: #333; text-decoration: none;">` : ''}
                        ${notification.data.task_title}
                      ${taskUrl ? '</a>' : ''}
                      <p style="color: #666; font-size: 0.9em; margin-top: 8px;">${new Date(notification.created_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                      })}</p>
                    </div>
                    ${taskUrl ? `
                    <p style="margin-top: 15px;">
                      <a href="${taskUrl}" style="color: #ffc107; text-decoration: none;">View Task →</a>
                    </p>
                    ` : ''}
                  </div>`;
                break;
              case 'workspace_shared':
                emailHtml = `
                  <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <p>Hi,</p>
                    <p><strong>${actorInfo[0].email}</strong> shared a workspace with you:</p>
                    <div style="margin: 15px 0; padding: 10px; background-color: #f5f5f5; border-left: 4px solid #17a2b8;">
                      ${notification.data.workspace_title}
                      <p style="color: #666; font-size: 0.9em; margin-top: 8px;">${new Date(notification.created_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                      })}</p>
                    </div>
                  </div>`;
                break;
              case 'mention':
                emailHtml = `
                  <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <p>Hi,</p>
                    <p><strong>${notification.data.comment_by}</strong> mentioned you in task:</p>
                    <div style="margin: 15px 0; padding: 10px; background-color: #f5f5f5; border-left: 4px solid #6f42c1;">
                      ${taskUrl ? `<a href="${taskUrl}" style="color: #333; text-decoration: none;">` : ''}
                        ${notification.data.task_title}
                      ${taskUrl ? '</a>' : ''}
                      <p style="color: #666; font-size: 0.9em; margin-top: 8px;">${new Date(notification.created_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                      })}</p>
                    </div>
                    ${taskUrl ? `
                    <p style="margin-top: 15px;">
                      <a href="${taskUrl}" style="color: #6f42c1; text-decoration: none;">View Task →</a>
                    </p>
                    ` : ''}
                  </div>`;
                break;
              default:
                emailHtml = `
                  <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <p>Hi,</p>
                    <p>You have a new notification.</p>
                  </div>`;
            }

            const emailResponse = await fetch('https://app.aiworkspace.pro/api/sendemail', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to: userInfo[0].email,
                text: emailText,
                html: emailHtml
              })
            });

            const emailResult = await emailResponse.json();

            // Update notification based on email send result
            await supabase
              .from('notifications')
              .update({
                email_status: emailResponse.ok ? 'success' : 'failed',
                email_message: emailResponse.ok 
                  ? 'Email sent successfully' 
                  : `Failed to send: ${emailResult.error || 'Unknown error'}`,
                retry_count: (notification.retry_count || 0) + 1,
                last_email_attempt: new Date().toISOString()
              })
              .eq('id', notification.id);

            processedNotifications.push({
              ...notification,
              emailNotificationsEnabled: emailEnabled,
              emailSendStatus: emailResponse.ok ? 'success' : 'failed',
              emailSendMessage: emailResponse.ok ? 'Email sent successfully' : `Failed to send: ${emailResult.error || 'Unknown error'}`
            });
          } catch (error) {
            await supabase
              .from('notifications')
              .update({
                email_status: 'failed',
                email_message: `Error: ${error.message}`,
                retry_count: (notification.retry_count || 0) + 1,
                last_email_attempt: new Date().toISOString()
              })
              .eq('id', notification.id);
          }
        }
      }

      metrics.processNotificationsTime = performance.now() - processStart;
      metrics.totalTime = performance.now() - startTime;

      return res.status(200).json({ 
        message: 'Notifications retrieved successfully',
        rawNotifications: notifications,
        processedNotifications: processedNotifications,
        metrics: {
          ...metrics,
          totalTimeMs: Math.round(metrics.totalTime),
          fetchTimeMs: Math.round(metrics.fetchNotificationsTime),
          processTimeMs: Math.round(metrics.processNotificationsTime),
          notificationsCount: notifications?.length || 0
        }
      });
    } catch (error) {
      metrics.totalTime = performance.now() - startTime;
      console.error('Error processing notifications:', error);
      return res.status(500).json({ 
        error: 'Failed to process notifications',
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