const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { taskId, userId } = req.body;

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

    // Check if user has access to the matter
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

    // Generate a unique token
    const token = crypto.randomBytes(32).toString('hex');
    const shareId = crypto.randomUUID();

    // Create external share record
    const { data: shareRecord, error: shareError } = await supabase
      .from('task_external_shares')
      .insert({
        id: shareId,
        task_id: taskId,
        shared_by: userId,
        token: token,
        status: 'active',
        access_count: 0,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (shareError) {
      console.error('Error creating share record:', shareError);
      return res.status(500).json({ error: 'Failed to create share record' });
    }

    // Generate the external share link
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : (process.env.NODE_ENV === 'development' ? 'http://localhost:5173' : 'https://app.aiworkspace.pro');
    
    const externalShareLink = `${baseUrl}/external-task/${shareId}?token=${token}`;

    res.status(200).json({
      id: shareId,
      externalShareLink,
      token
    });

  } catch (error) {
    console.error('Error generating external share link:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}; 