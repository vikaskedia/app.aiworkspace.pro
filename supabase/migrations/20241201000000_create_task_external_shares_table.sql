-- Create table for external task shares
CREATE TABLE task_external_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  shared_by UUID NOT NULL,
  token VARCHAR(64) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  access_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMP WITH TIME ZONE,
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  accessed_by_email VARCHAR(255),
  UNIQUE(task_id, token)
);

-- Create indexes for better performance
CREATE INDEX idx_task_external_shares_task_id ON task_external_shares(task_id);
CREATE INDEX idx_task_external_shares_token ON task_external_shares(token);
CREATE INDEX idx_task_external_shares_shared_by ON task_external_shares(shared_by);
CREATE INDEX idx_task_external_shares_status ON task_external_shares(status);

-- Add RLS (Row Level Security) policies
ALTER TABLE task_external_shares ENABLE ROW LEVEL SECURITY;

-- Policy for users to view external shares they created
CREATE POLICY "Users can view external shares they created" ON task_external_shares
  FOR SELECT
  USING (shared_by = auth.uid());

-- Policy for users to insert external shares for tasks they have access to
CREATE POLICY "Users can create external shares for accessible tasks" ON task_external_shares
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks t
      LEFT JOIN workspace_access wa ON t.matter_id = wa.matter_id
      WHERE t.id = task_id 
      AND (t.created_by = auth.uid() OR wa.shared_with_user_id = auth.uid())
    )
  );

-- Policy for users to update external shares they created
CREATE POLICY "Users can update external shares they created" ON task_external_shares
  FOR UPDATE
  USING (shared_by = auth.uid());

-- Add comments for documentation
COMMENT ON TABLE task_external_shares IS 'Stores external sharing links for tasks with tokens for anonymous access';
COMMENT ON COLUMN task_external_shares.id IS 'Unique identifier for the external share';
COMMENT ON COLUMN task_external_shares.task_id IS 'Reference to the shared task';
COMMENT ON COLUMN task_external_shares.shared_by IS 'UUID of the user who created the share';
COMMENT ON COLUMN task_external_shares.token IS 'Unique token for accessing the shared task';
COMMENT ON COLUMN task_external_shares.status IS 'Status of the share (active or revoked)';
COMMENT ON COLUMN task_external_shares.access_count IS 'Number of times this link has been accessed';
COMMENT ON COLUMN task_external_shares.accessed_by_email IS 'Email of the last external user who accessed this share'; 