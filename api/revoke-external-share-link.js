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
    const { taskId, userId, entryId } = req.body;

    if (!taskId || !userId) {
      return res.status(400).json({ error: 'Task ID and user ID are required' });
    }

    // Verify the user has access to the task
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('*, matters!inner(id, title)')
      .eq('id', taskId)
      .single();

    if (taskError || !task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check if user has access to the matter or is the task creator
    const { data: access, error: accessError } = await supabase
      .from('workspace_access')
      .select('access_type')
      .eq('matter_id', task.matter_id)
      .eq('shared_with_user_id', userId)
      .single();

    if (accessError && accessError.code !== 'PGRST116') {
      return res.status(500).json({ error: 'Error checking access' });
    }

    if (!access && task.created_by !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let updateQuery = supabase
      .from('task_external_shares')
      .update({ status: 'revoked', revoked_at: new Date().toISOString() })
      .eq('task_id', taskId)
      .eq('shared_by', userId);

    // If entryId is provided, revoke specific share, otherwise revoke all active shares for this task
    if (entryId) {
      updateQuery = updateQuery.eq('id', entryId);
    } else {
      updateQuery = updateQuery.eq('status', 'active');
    }

    const { error: revokeError } = await updateQuery;

    if (revokeError) {
      console.error('Error revoking external share link:', revokeError);
      return res.status(500).json({ error: 'Failed to revoke external share link' });
    }

    res.status(200).json({ 
      success: true, 
      message: entryId ? 'Specific external share link revoked' : 'All external share links revoked' 
    });

  } catch (error) {
    console.error('Error revoking external share link:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}; 