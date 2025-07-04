 -- Add external_user_email column to task_comments table
ALTER TABLE task_comments 
ADD COLUMN IF NOT EXISTS external_user_email VARCHAR(255);

-- Add index for external user email
CREATE INDEX IF NOT EXISTS idx_task_comments_external_user_email 
ON task_comments(external_user_email);

-- Update the constraint to allow either created_by OR external_user_email
-- First, drop the existing constraint if it exists
ALTER TABLE task_comments 
DROP CONSTRAINT IF EXISTS check_comment_author;

-- Add new constraint that requires either created_by OR external_user_email (but not both)
ALTER TABLE task_comments 
ADD CONSTRAINT check_comment_author 
CHECK (
  (created_by IS NOT NULL AND external_user_email IS NULL) OR 
  (created_by IS NULL AND external_user_email IS NOT NULL)
);

-- Add comment for documentation
COMMENT ON COLUMN task_comments.external_user_email IS 'Email of external user who created this comment (for shared task comments)'; 