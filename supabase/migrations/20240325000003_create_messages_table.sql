-- Create message status enum
CREATE TYPE message_status AS ENUM ('pending', 'sent', 'delivered', 'failed', 'received');

-- Create message direction enum  
CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    telnyx_message_id VARCHAR(255),
    direction message_direction NOT NULL,
    from_phone_number VARCHAR(20) NOT NULL,
    to_phone_number VARCHAR(20) NOT NULL,
    message_body TEXT NOT NULL,
    status message_status DEFAULT 'pending',
    delivered_at TIMESTAMP WITH TIME ZONE,
    failed_reason TEXT,
    webhook_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_telnyx_id ON messages(telnyx_message_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_messages_status ON messages(status);
CREATE INDEX idx_messages_direction ON messages(direction);

-- Add trigger to update updated_at timestamp
CREATE TRIGGER update_messages_updated_at 
    BEFORE UPDATE ON messages 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 