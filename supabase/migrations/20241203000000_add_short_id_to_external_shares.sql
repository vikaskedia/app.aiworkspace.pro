-- Add short_id column to task_external_shares table for URL shortening
ALTER TABLE task_external_shares
ADD COLUMN short_id VARCHAR(8) UNIQUE;

-- Create index for better performance on short_id lookups
CREATE INDEX idx_task_external_shares_short_id ON task_external_shares(short_id);

-- Add comment for documentation
COMMENT ON COLUMN task_external_shares.short_id IS 'Short identifier used for creating short URLs (e.g., /share-task/abc123)'; 