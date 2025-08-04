-- Create table for internal message comments
CREATE TABLE message_internal_comments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  message_id TEXT NOT NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  matter_id BIGINT REFERENCES workspaces(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  archived BOOLEAN DEFAULT FALSE
);

-- Create indexes for better performance
CREATE INDEX idx_message_internal_comments_message_id ON message_internal_comments(message_id);
CREATE INDEX idx_message_internal_comments_conversation_id ON message_internal_comments(conversation_id);
CREATE INDEX idx_message_internal_comments_matter_id ON message_internal_comments(matter_id);
CREATE INDEX idx_message_internal_comments_created_by ON message_internal_comments(created_by);
CREATE INDEX idx_message_internal_comments_archived ON message_internal_comments(archived);

-- Add RLS (Row Level Security)
ALTER TABLE message_internal_comments ENABLE ROW LEVEL SECURITY;

-- Create policy for internal comments - only attorneys with access to the workspace can view/edit
CREATE POLICY "message_internal_comments_select_policy" ON message_internal_comments
  FOR SELECT USING (
    matter_id IN (
      SELECT matter_id FROM workspace_access 
      WHERE shared_with_user_id = auth.uid()
    )
  );

CREATE POLICY "message_internal_comments_insert_policy" ON message_internal_comments
  FOR INSERT WITH CHECK (
    matter_id IN (
      SELECT matter_id FROM workspace_access 
      WHERE shared_with_user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "message_internal_comments_update_policy" ON message_internal_comments
  FOR UPDATE USING (
    matter_id IN (
      SELECT matter_id FROM workspace_access 
      WHERE shared_with_user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

-- Add trigger for updated_at
CREATE TRIGGER update_message_internal_comments_updated_at
  BEFORE UPDATE ON message_internal_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments to the table and columns
COMMENT ON TABLE message_internal_comments IS 'Internal comments on SMS/phone messages - visible only to team members';
COMMENT ON COLUMN message_internal_comments.message_id IS 'ID of the message being commented on';
COMMENT ON COLUMN message_internal_comments.conversation_id IS 'ID of the conversation this comment belongs to';
COMMENT ON COLUMN message_internal_comments.matter_id IS 'ID of the workspace this comment belongs to';
COMMENT ON COLUMN message_internal_comments.content IS 'The internal comment content';
COMMENT ON COLUMN message_internal_comments.created_by IS 'ID of the attorney who created the comment';
COMMENT ON COLUMN message_internal_comments.archived IS 'Whether this comment is archived/deleted'; 