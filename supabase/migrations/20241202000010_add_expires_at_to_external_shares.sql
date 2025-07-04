-- Add expires_at column to task_external_shares table
ALTER TABLE task_external_shares 
ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '30 days');

-- Create index for better performance on expiration queries
CREATE INDEX idx_task_external_shares_expires_at ON task_external_shares(expires_at);

-- Add comment for documentation
COMMENT ON COLUMN task_external_shares.expires_at IS 'Timestamp when this external share expires (30 days from creation)'; 