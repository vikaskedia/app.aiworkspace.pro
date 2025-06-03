BEGIN;

-- Add ai_subtask_enabled column to matters table
ALTER TABLE matters
ADD COLUMN ai_subtask_enabled boolean DEFAULT true;

-- Add comment for the new column
COMMENT ON COLUMN matters.ai_subtask_enabled IS 'Whether AI subtask suggestions are enabled for this matter';

COMMIT; 