-- Add group_key to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS group_key TEXT;

-- Create group_conversations table
CREATE TABLE IF NOT EXISTS group_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_key TEXT UNIQUE NOT NULL,
    participants TEXT[],
    last_message_at TIMESTAMP,
    last_message_preview TEXT,
    matter_id int8,
    created_at TIMESTAMP DEFAULT now()
); 