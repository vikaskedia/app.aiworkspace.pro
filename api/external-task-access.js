const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { shareId, token } = req.query;

    if (!shareId || !token) {
      return res.status(400).json({ error: 'Share ID and token are required' });
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

    // Get task details
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select(`
        id,
        title,
        description,
        status,
        priority,
        due_date,
        created_at,
        updated_at,
        matter_id,
        matters!inner(title)
      `)
      .eq('id', shareRecord.task_id)
      .single();

    if (taskError || !task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Get task comments (both internal and external)
    const { data: comments, error: commentsError } = await supabase
      .from('task_comments')
      .select(`
        id,
        text,
        created_at,
        user_id,
        external_user_email,
        archived
      `)
      .eq('task_id', shareRecord.task_id)
      .eq('archived', false)
      .order('created_at', { ascending: false });

    if (commentsError) {
      console.error('Error fetching comments:', commentsError);
    }

    // Get user emails for internal comments
    const userIds = comments?.filter(c => c.user_id).map(c => c.user_id) || [];
    let userEmails = {};

    if (userIds.length > 0) {
      const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
      if (!usersError && users) {
        userEmails = users.users.reduce((acc, user) => {
          acc[user.id] = user.email;
          return acc;
        }, {});
      }
    }

    // Add email information to comments
    const enrichedComments = comments?.map(comment => ({
      ...comment,
      created_by_email: comment.user_id ? userEmails[comment.user_id] : null,
      // Determine comment type for display
      comment_type: comment.user_id ? 'internal' : 
                   comment.external_user_email ? 'external' : 'system'
    })) || [];

    // Update access count and last accessed time
    await supabase
      .from('task_external_shares')
      .update({
        access_count: shareRecord.access_count + 1,
        last_accessed_at: new Date().toISOString()
      })
      .eq('id', shareId);

    res.status(200).json({
      task: {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        due_date: task.due_date,
        created_at: task.created_at,
        updated_at: task.updated_at,
        matter_title: task.matters?.title
      },
      comments: enrichedComments,
      shareInfo: {
        shared_at: shareRecord.created_at,
        access_count: shareRecord.access_count + 1
      }
    });

  } catch (error) {
    console.error('Error accessing external task:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}; 