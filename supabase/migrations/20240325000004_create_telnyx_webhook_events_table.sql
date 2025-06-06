-- Create telnyx_webhook_events table for logging and debugging
CREATE TABLE IF NOT EXISTS telnyx_webhook_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    message_id VARCHAR(255),
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_telnyx_events_event_type ON telnyx_webhook_events(event_type);
CREATE INDEX idx_telnyx_events_message_id ON telnyx_webhook_events(message_id);
CREATE INDEX idx_telnyx_events_processed ON telnyx_webhook_events(processed);
CREATE INDEX idx_telnyx_events_created_at ON telnyx_webhook_events(created_at DESC); 