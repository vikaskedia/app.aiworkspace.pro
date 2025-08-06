-- Fix message_internal_comments table structure

-- Disable RLS temporarily to avoid policy conflicts
ALTER TABLE message_internal_comments DISABLE ROW LEVEL SECURITY;

-- Drop existing policies manually
DROP POLICY IF EXISTS message_internal_comments_select_policy ON message_internal_comments;
DROP POLICY IF EXISTS message_internal_comments_insert_policy ON message_internal_comments;
DROP POLICY IF EXISTS message_internal_comments_update_policy ON message_internal_comments;

-- Clear existing data since we're changing the data structure
DELETE FROM message_internal_comments;

-- Drop existing foreign key constraint for created_by
ALTER TABLE message_internal_comments DROP CONSTRAINT IF EXISTS message_internal_comments_created_by_fkey;

-- Change created_by column type from BIGINT to UUID
ALTER TABLE message_internal_comments ALTER COLUMN created_by TYPE UUID USING NULL;

-- Add new foreign key constraint to reference auth.users(id)
ALTER TABLE message_internal_comments 
ADD CONSTRAINT message_internal_comments_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Re-enable RLS
ALTER TABLE message_internal_comments ENABLE ROW LEVEL SECURITY;

-- Create updated RLS policies
CREATE POLICY "message_internal_comments_select_policy" ON message_internal_comments
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_access 
      WHERE shared_with_user_id = auth.uid()
    )
  );

CREATE POLICY "message_internal_comments_insert_policy" ON message_internal_comments
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_access 
      WHERE shared_with_user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "message_internal_comments_update_policy" ON message_internal_comments
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_access 
      WHERE shared_with_user_id = auth.uid()
    )
    AND created_by = auth.uid()
  ); 