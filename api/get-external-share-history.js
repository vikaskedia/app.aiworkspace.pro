const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { taskId, userId } = req.query;

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

    // Get external share history
    const { data: history, error: historyError } = await supabase
      .from('task_external_shares')
      .select('id, status, access_count, created_at, revoked_at, token')
      .eq('task_id', taskId)
      .eq('shared_by', userId)
      .order('created_at', { ascending: false });

    if (historyError) {
      console.error('Error fetching external share history:', historyError);
      return res.status(500).json({ error: 'Failed to fetch external share history' });
    }

    // Find active link if any
    const activeEntry = history.find(entry => entry.status === 'active');
    let activeLink = '';
    
    if (activeEntry) {
      const baseUrl = process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}` 
        : (process.env.NODE_ENV === 'development' ? 'http://localhost:5173' : 'https://app.aiworkspace.pro');
      
      activeLink = `${baseUrl}/external-task/${activeEntry.id}?token=${activeEntry.token}`;
    }

    res.status(200).json({
      history: history.map(entry => ({
        id: entry.id,
        status: entry.status,
        access_count: entry.access_count,
        created_at: entry.created_at,
        revoked_at: entry.revoked_at
      })),
      activeLink
    });

  } catch (error) {
    console.error('Error getting external share history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}; 