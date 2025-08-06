-- RLS policies for external task sharing

-- First, drop existing conflicting policies if they exist
DROP POLICY IF EXISTS "Users can view external shares they created" ON task_external_shares;
DROP POLICY IF EXISTS "Users can create external shares for accessible tasks" ON task_external_shares;
DROP POLICY IF EXISTS "Users can update external shares they created" ON task_external_shares;

-- Enable RLS on task_external_shares table if not already enabled
ALTER TABLE task_external_shares ENABLE ROW LEVEL SECURITY;

-- Policy for users to read their own external shares
CREATE POLICY "Users can view their own external shares" ON task_external_shares
  FOR SELECT USING (
    shared_by = auth.uid()
  );

-- Policy for users to create external shares for their own tasks
CREATE POLICY "Users can create external shares for their tasks" ON task_external_shares
  FOR INSERT WITH CHECK (
    shared_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM tasks 
      WHERE tasks.id = task_external_shares.task_id 
      AND (
        tasks.assignee = auth.uid() OR 
        tasks.created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM workspace_access 
          WHERE workspace_access.workspace_id = tasks.workspace_id 
          AND workspace_access.shared_with_user_id = auth.uid()
        )
      )
    )
  );

-- Policy for users to update their own external shares
CREATE POLICY "Users can update their own external shares" ON task_external_shares
  FOR UPDATE USING (
    shared_by = auth.uid()
  );

-- Policy for users to delete their own external shares
CREATE POLICY "Users can delete their own external shares" ON task_external_shares
  FOR DELETE USING (
    shared_by = auth.uid()
  );

-- Policy for anonymous access to external shares (for validation)
CREATE POLICY "Anonymous users can read active external shares for validation" ON task_external_shares
  FOR SELECT USING (
    status = 'active' AND 
    expires_at > NOW()
  );

-- Enable anonymous access to tasks through external shares
CREATE POLICY "Anonymous users can read tasks through external shares" ON tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM task_external_shares 
      WHERE task_external_shares.task_id = tasks.id 
      AND task_external_shares.status = 'active' 
      AND task_external_shares.expires_at > NOW()
    )
  );

-- Enable anonymous access to task comments for external sharing
CREATE POLICY "Anonymous users can read task comments through external shares" ON task_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM task_external_shares 
      WHERE task_external_shares.task_id = task_comments.task_id 
      AND task_external_shares.status = 'active' 
      AND task_external_shares.expires_at > NOW()
    )
  );

-- Allow external users to insert comments
CREATE POLICY "External users can add comments to shared tasks" ON task_comments
  FOR INSERT WITH CHECK (
    external_user_email IS NOT NULL AND
    user_id IS NULL AND
    EXISTS (
      SELECT 1 FROM task_external_shares 
      WHERE task_external_shares.task_id = task_comments.task_id 
      AND task_external_shares.status = 'active' 
      AND task_external_shares.expires_at > NOW()
    )
  );

-- Allow reading workspaces through external task shares
CREATE POLICY "Anonymous users can read workspace info through external shares" ON workspaces
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tasks 
      JOIN task_external_shares ON task_external_shares.task_id = tasks.id
      WHERE tasks.workspace_id = workspaces.id 
      AND task_external_shares.status = 'active' 
      AND task_external_shares.expires_at > NOW()
    )
  ); 