-- Create sheet_edit_locks table for per-sheet editing locks
-- This table stores which user is currently editing which sheet

CREATE TABLE IF NOT EXISTS sheet_edit_locks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    spreadsheet_id TEXT NOT NULL,
    sheet_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    workspace_id INTEGER NOT NULL,
    locked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure only one user can lock a specific sheet at a time
    UNIQUE(spreadsheet_id, sheet_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sheet_edit_locks_spreadsheet_id ON sheet_edit_locks(spreadsheet_id);
CREATE INDEX IF NOT EXISTS idx_sheet_edit_locks_user_id ON sheet_edit_locks(user_id);
CREATE INDEX IF NOT EXISTS idx_sheet_edit_locks_workspace_id ON sheet_edit_locks(workspace_id);

-- Enable Row Level Security (RLS)
ALTER TABLE sheet_edit_locks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies

-- Users can view all locks for spreadsheets in their workspace
CREATE POLICY "Users can view sheet locks in their workspace" ON sheet_edit_locks
    FOR SELECT 
    USING (true); -- For now, allow viewing all locks. You may want to restrict this based on workspace membership

-- Users can insert locks for themselves
CREATE POLICY "Users can create their own sheet locks" ON sheet_edit_locks
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own locks
CREATE POLICY "Users can delete their own sheet locks" ON sheet_edit_locks
    FOR DELETE 
    USING (auth.uid() = user_id);

-- Users can update their own locks
CREATE POLICY "Users can update their own sheet locks" ON sheet_edit_locks
    FOR UPDATE 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Add a function to automatically clean up old locks (optional)
-- This can be called periodically to remove stale locks

CREATE OR REPLACE FUNCTION cleanup_stale_sheet_locks()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete locks older than 24 hours (adjust as needed)
    DELETE FROM sheet_edit_locks 
    WHERE locked_at < NOW() - INTERVAL '24 hours';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- You can set up a cron job or call this function periodically to clean up stale locks
-- Example: SELECT cleanup_stale_sheet_locks();

COMMENT ON TABLE sheet_edit_locks IS 'Stores per-sheet editing locks to prevent concurrent editing of the same sheet';
COMMENT ON COLUMN sheet_edit_locks.spreadsheet_id IS 'Identifier of the spreadsheet';
COMMENT ON COLUMN sheet_edit_locks.sheet_id IS 'Identifier of the specific sheet within the spreadsheet';
COMMENT ON COLUMN sheet_edit_locks.user_id IS 'ID of the user who owns the lock';
COMMENT ON COLUMN sheet_edit_locks.user_name IS 'Display name of the user for UI purposes';
COMMENT ON COLUMN sheet_edit_locks.workspace_id IS 'ID of the workspace containing the spreadsheet';
COMMENT ON COLUMN sheet_edit_locks.locked_at IS 'When the lock was acquired';
