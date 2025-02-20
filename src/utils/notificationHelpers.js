import { supabase } from '../supabase';

/**
 * Sends email notifications for various task-related events
 * @param {string} notificationType - Type of notification
 * @param {string} taskId - ID of the task
 */
export const emailNotification = async (notificationType, taskId) => {
  try {
    // Get logged in user details
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('No authenticated user found');
    }
    
    if (notificationType === 'task_assigned') {
      // Get task details
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (taskError || !taskData) {
        throw new Error(`Failed to fetch task data: ${taskError?.message || 'Task not found'}`);
      }

      // Collect all relevant user IDs
      const userIds = new Set([
        taskData.created_by,
        taskData.assignee
      ]);

      // Get starred users
      const { data: starredUsers } = await supabase
        .from('task_stars')
        .select('user_id')
        .eq('task_id', taskId);

      starredUsers?.forEach(su => userIds.add(su.user_id));

      // Get user info and notification preferences for all users
      const userDetails = {};
      for (const userId of userIds) {
        if (userId) {
          // Get user info
          const { data: userData } = await supabase
            .rpc('get_user_info_by_id', { user_id: userId });
          
          // Get notification settings
          const { data: userSettings } = await supabase
            .from('user_settings')
            .select('settings')
            .eq('user_id', userId)
            .maybeSingle();
            
          // Parse the JSONB settings field
          let emailEnabled = false;
          let notificationTypes = ['task_assignments', 'task_updates'];
          
          if (userSettings?.settings) {
            try {
              // Handle both string and object cases
              const settings = typeof userSettings.settings === 'string' 
                ? JSON.parse(userSettings.settings) 
                : userSettings.settings;
              
              emailEnabled = settings.emailNotificationsEnabled ?? false;
              notificationTypes = settings.notificationTypes || notificationTypes;
            } catch (e) {
              console.error(`Error parsing settings for user ${userId}:`, e);
            }
          }
          
          userDetails[userId] = {
            email: userData?.[0]?.email || 'Unknown',
            emailNotificationsEnabled: emailEnabled,
            notificationTypes
          };
          
          // console.log(`User ${userId} raw settings:`, userSettings?.settings);
          // console.log(`User ${userId} parsed emailEnabled:`, emailEnabled);
        }
      }
      
      const notificationDetails = {
        taskInfo: {
          id: taskData.id,
          title: taskData.title,
          status: taskData.status
        },
        actors: {
          assignedBy: {
            email: userDetails[user.id]?.email || 'Unknown',
            emailNotificationsEnabled: userDetails[user.id]?.emailNotificationsEnabled ?? false
          },
          assignedTo: taskData.assignee ? {
            email: userDetails[taskData.assignee]?.email || 'Unknown',
            emailNotificationsEnabled: userDetails[taskData.assignee]?.emailNotificationsEnabled ?? false
          } : null,
          taskCreator: {
            email: userDetails[taskData.created_by]?.email || 'Unknown',
            emailNotificationsEnabled: userDetails[taskData.created_by]?.emailNotificationsEnabled ?? false
          }
        },
        stakeholders: {
          starredBy: starredUsers?.map(su => ({
            email: userDetails[su.user_id]?.email || 'Unknown',
            emailNotificationsEnabled: userDetails[su.user_id]?.emailNotificationsEnabled ?? false
          })) || []
        },
        metadata: {
          type: 'task_assigned',
          timestamp: new Date().toISOString()
        }
      };

      console.log('Task Assignment Notification Details:', notificationDetails);

      const emailEnabledUsers = new Set();

      // Process assignedBy
      if (notificationDetails.actors.assignedBy.emailNotificationsEnabled) {
        emailEnabledUsers.add(notificationDetails.actors.assignedBy.email);
      }

      // Process assignedTo
      if (notificationDetails.actors.assignedTo?.emailNotificationsEnabled) {
        emailEnabledUsers.add(notificationDetails.actors.assignedTo.email);
      }

      // Process taskCreator
      if (notificationDetails.actors.taskCreator.emailNotificationsEnabled) {
        emailEnabledUsers.add(notificationDetails.actors.taskCreator.email);
      }

      // Process starredBy users
      notificationDetails.stakeholders.starredBy.forEach(user => {
        if (user.emailNotificationsEnabled) {
          emailEnabledUsers.add(user.email);
        }
      });

      // Convert Set to Array of objects
      const emailNotificationRecipients = Array.from(emailEnabledUsers).map(email => ({
        email,
        emailNotificationsEnabled: true
      }));

      console.log('Email Notification Recipients:', emailNotificationRecipients);
    } else {
      // Default notification logging
      console.log('EmailNotification:', {
        notificationType,
        taskId,
        actorId: user.id,
        actorEmail: user.email,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error processing notification:', error.message);
  }
}; 
