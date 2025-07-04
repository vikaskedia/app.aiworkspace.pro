-- Alternative migration: More flexible approach for external user email support
-- This migration is safer for existing data

-- Add external_user_email column to task_comments table if it doesn't exist
ALTER TABLE task_comments 
ADD COLUMN IF NOT EXISTS external_user_email VARCHAR(255);

-- Add index for external user email
CREATE INDEX IF NOT EXISTS idx_task_comments_external_user_email 
ON task_comments(external_user_email);

-- Instead of a strict constraint, let's use a more flexible approach
-- We'll allow:
-- 1. Internal comments: user_id IS NOT NULL AND external_user_email IS NULL
-- 2. External comments: user_id IS NULL AND external_user_email IS NOT NULL  
-- 3. System/Legacy comments: user_id IS NULL AND external_user_email IS NULL (for backwards compatibility)

-- Drop any existing constraint
ALTER TABLE task_comments 
DROP CONSTRAINT IF EXISTS check_comment_author;

-- Add a more flexible constraint that allows system comments
-- This constraint only enforces that we don't have BOTH user_id AND external_user_email set
ALTER TABLE task_comments 
ADD CONSTRAINT check_comment_author_not_both 
CHECK (NOT (user_id IS NOT NULL AND external_user_email IS NOT NULL));

-- Add a comment explaining the column usage
COMMENT ON COLUMN task_comments.external_user_email IS 'Email of external user who created this comment (for shared task comments). NULL for internal comments.';

-- Add a comment explaining the constraint
COMMENT ON CONSTRAINT check_comment_author_not_both ON task_comments IS 'Ensures a comment is not attributed to both an internal user and external user simultaneously'; 