-- Create conversation_read_status table
CREATE TABLE IF NOT EXISTS public.conversation_read_status (
  id serial NOT NULL,
  conversation_id uuid NOT NULL,
  user_id uuid NOT NULL,
  matter_id integer NOT NULL,
  last_read_at timestamp with time zone NULL DEFAULT now(),
  is_read boolean NULL DEFAULT false,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),
  CONSTRAINT conversation_read_status_pkey PRIMARY KEY (id),
  CONSTRAINT conversation_read_status_conversation_id_user_id_key UNIQUE (conversation_id, user_id),
  CONSTRAINT conversation_read_status_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE,
  CONSTRAINT conversation_read_status_matter_id_fkey FOREIGN KEY (matter_id) REFERENCES matters (id) ON DELETE CASCADE,
  CONSTRAINT conversation_read_status_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_conversation_read_status_conversation_id ON public.conversation_read_status USING btree (conversation_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_conversation_read_status_user_id ON public.conversation_read_status USING btree (user_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_conversation_read_status_matter_id ON public.conversation_read_status USING btree (matter_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_conversation_read_status_user_matter ON public.conversation_read_status USING btree (user_id, matter_id) TABLESPACE pg_default;

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_conversation_read_status_updated_at BEFORE
UPDATE ON conversation_read_status FOR EACH row
EXECUTE FUNCTION update_updated_at_column();

-- Add RLS (Row Level Security)
ALTER TABLE conversation_read_status ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own conversation read status" ON conversation_read_status
FOR SELECT USING (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 
    FROM workspace_access wa
    WHERE wa.shared_with_user_id = auth.uid()
    AND wa.matter_id = conversation_read_status.matter_id
  )
);

CREATE POLICY "Users can insert their own conversation read status" ON conversation_read_status
FOR INSERT WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 
    FROM workspace_access wa
    WHERE wa.shared_with_user_id = auth.uid()
    AND wa.matter_id = conversation_read_status.matter_id
    AND wa.access_type = 'edit'
  )
);

CREATE POLICY "Users can update their own conversation read status" ON conversation_read_status
FOR UPDATE USING (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 
    FROM workspace_access wa
    WHERE wa.shared_with_user_id = auth.uid()
    AND wa.matter_id = conversation_read_status.matter_id
    AND wa.access_type = 'edit'
  )
);

CREATE POLICY "Users can delete their own conversation read status" ON conversation_read_status
FOR DELETE USING (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 
    FROM workspace_access wa
    WHERE wa.shared_with_user_id = auth.uid()
    AND wa.matter_id = conversation_read_status.matter_id
    AND wa.access_type = 'edit'
  )
);

-- Add comments for documentation
COMMENT ON TABLE conversation_read_status IS 'Tracks individual user read status for conversations in multi-user workspaces';
COMMENT ON COLUMN conversation_read_status.conversation_id IS 'Reference to the conversation';
COMMENT ON COLUMN conversation_read_status.user_id IS 'Reference to the user';
COMMENT ON COLUMN conversation_read_status.matter_id IS 'Reference to the matter/workspace';
COMMENT ON COLUMN conversation_read_status.last_read_at IS 'Timestamp when user last read this conversation';
COMMENT ON COLUMN conversation_read_status.is_read IS 'Boolean flag indicating if conversation is read by user'; 