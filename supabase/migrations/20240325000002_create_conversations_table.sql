-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    from_phone_number VARCHAR(20) NOT NULL,
    to_phone_number VARCHAR(20) NOT NULL,
    contact_name VARCHAR(255),
    last_message_at TIMESTAMP WITH TIME ZONE,
    last_message_preview TEXT,
    unread_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_conversations_workspace_id ON conversations(workspace_id);
CREATE INDEX idx_conversations_phone_numbers ON conversations(from_phone_number, to_phone_number);
CREATE INDEX idx_conversations_last_message_at ON conversations(last_message_at DESC);

-- Create unique constraint for phone number pair per workspace
CREATE UNIQUE INDEX idx_conversations_unique_phones_per_matter 
ON conversations(workspace_id, from_phone_number, to_phone_number);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_conversations_updated_at 
    BEFORE UPDATE ON conversations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 