 -- Add external_user_email column to task_comments table
ALTER TABLE task_comments 
ADD COLUMN IF NOT EXISTS external_user_email VARCHAR(255);

-- Add index for external user email
CREATE INDEX IF NOT EXISTS idx_task_comments_external_user_email 
ON task_comments(external_user_email);

-- Before adding the constraint, we need to handle any existing rows that might violate it
-- First, let's check if there are any rows with NULL user_id that would violate our constraint
-- We have a few options for handling these:

-- Option 1: Update any comments with NULL user_id to have a placeholder external email
-- This preserves the data but marks them as system/legacy comments
UPDATE task_comments 
SET external_user_email = 'system@legacy.local'
WHERE user_id IS NULL AND external_user_email IS NULL;

-- Option 2: If you prefer to delete orphaned comments (uncomment the line below and comment the UPDATE above)
-- DELETE FROM task_comments WHERE user_id IS NULL AND external_user_email IS NULL;

-- Update the constraint to allow either user_id OR external_user_email
-- First, drop the existing constraint if it exists
ALTER TABLE task_comments 
DROP CONSTRAINT IF EXISTS check_comment_author;

-- Add new constraint that requires either user_id OR external_user_email (but not both)
ALTER TABLE task_comments 
ADD CONSTRAINT check_comment_author 
CHECK (
  (user_id IS NOT NULL AND external_user_email IS NULL) OR 
  (user_id IS NULL AND external_user_email IS NOT NULL)
);

-- Add comment for documentation
COMMENT ON COLUMN task_comments.external_user_email IS 'Email of external user who created this comment (for shared task comments)'; 