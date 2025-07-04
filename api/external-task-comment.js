const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { shareId, token, comment, userEmail } = req.body;

    if (!shareId || !token || !comment || !userEmail) {
      return res.status(400).json({ error: 'Share ID, token, comment, and user email are required' });
    }

    // Verify the external share link
    const { data: shareRecord, error: shareError } = await supabase
      .from('task_external_shares')
      .select('*')
      .eq('id', shareId)
      .eq('token', token)
      .eq('status', 'active')
      .single();

    if (shareError || !shareRecord) {
      return res.status(404).json({ error: 'Invalid or expired share link' });
    }

    // Verify the task exists
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('id, title, matter_id')
      .eq('id', shareRecord.task_id)
      .single();

    if (taskError || !task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Create the comment record
    const { data: newComment, error: commentError } = await supabase
      .from('task_comments')
      .insert({
        task_id: shareRecord.task_id,
        text: comment.trim(),
        external_user_email: userEmail,
        created_at: new Date().toISOString(),
        archived: false
      })
      .select()
      .single();

    if (commentError) {
      console.error('Error creating comment:', commentError);
      return res.status(500).json({ error: 'Failed to create comment' });
    }

    // Update the share record with the user who commented
    await supabase
      .from('task_external_shares')
      .update({
        accessed_by_email: userEmail,
        last_accessed_at: new Date().toISOString()
      })
      .eq('id', shareId);

    // Create a notification for the task creator and matter members
    try {
      // Get task creator and matter members
      const { data: taskData } = await supabase
        .from('tasks')
        .select('created_by, matter_id')
        .eq('id', shareRecord.task_id)
        .single();

      if (taskData) {
        // Get all users with access to this matter
        const { data: matterUsers, error: matterUsersError } = await supabase
          .from('workspace_access')
          .select('shared_with_user_id')
          .eq('matter_id', taskData.matter_id);

        if (!matterUsersError && matterUsers) {
          const userIds = new Set([taskData.created_by, ...matterUsers.map(u => u.shared_with_user_id)]);
          
          // Create notifications for all relevant users
          const notifications = Array.from(userIds).map(userId => ({
            user_id: userId,
            type: 'external_task_comment',
            data: {
              task_id: shareRecord.task_id,
              task_title: task.title,
              comment_preview: comment.substring(0, 100) + (comment.length > 100 ? '...' : ''),
              external_user_email: userEmail
            },
            read: false,
            created_at: new Date().toISOString()
          }));

          await supabase
            .from('notifications')
            .insert(notifications);
        }
      }
    } catch (notificationError) {
      console.error('Error creating notifications:', notificationError);
      // Don't fail the request if notifications fail
    }

    res.status(201).json({
      success: true,
      comment: {
        id: newComment.id,
        text: newComment.text,
        created_at: newComment.created_at,
        external_user_email: newComment.external_user_email,
        archived: false
      }
    });

  } catch (error) {
    console.error('Error adding external comment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}; 