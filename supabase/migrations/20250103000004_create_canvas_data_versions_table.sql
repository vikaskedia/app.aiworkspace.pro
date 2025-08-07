-- Create canvas_data_versions table for storing historical versions of canvas data
CREATE TABLE IF NOT EXISTS canvas_data_versions (
    id BIGSERIAL PRIMARY KEY,
    canvas_data_id BIGINT NOT NULL REFERENCES canvas_data(id) ON DELETE CASCADE,
    workspace_id BIGINT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    canvas_data JSONB NOT NULL,
    version_number INTEGER NOT NULL,
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    change_description TEXT,
    UNIQUE(canvas_data_id, version_number)
);

COMMENT ON TABLE canvas_data_versions IS 'Stores historical versions of canvas data for version control.
Each version contains:
1. canvas_data_id: Reference to the original canvas_data record
2. workspace_id: The workspace this version belongs to
3. canvas_data: Snapshot of the canvas data at this version
4. version_number: Sequential version number (1, 2, 3, etc.)
5. change_description: Optional description of what changed in this version
6. Standard audit fields (created_by, created_at)';

COMMENT ON COLUMN canvas_data_versions.version_number IS 'Sequential version number starting from 1 for each canvas_data record';

-- Add indexes for better performance
CREATE INDEX idx_canvas_data_versions_canvas_data_id ON canvas_data_versions(canvas_data_id);
CREATE INDEX idx_canvas_data_versions_workspace_id ON canvas_data_versions(workspace_id);
CREATE INDEX idx_canvas_data_versions_created_by ON canvas_data_versions(created_by);
CREATE INDEX idx_canvas_data_versions_version_number ON canvas_data_versions(version_number);

-- Enable RLS (Row Level Security)
ALTER TABLE canvas_data_versions ENABLE ROW LEVEL SECURITY;

-- Policies for canvas_data_versions
CREATE POLICY "Users can view canvas data versions" ON canvas_data_versions
FOR SELECT USING (
  workspace_id IN (
    SELECT workspace_id 
    FROM workspace_access 
    WHERE shared_with_user_id = auth.uid()
  )
);

CREATE POLICY "Users can create canvas data versions" ON canvas_data_versions
FOR INSERT WITH CHECK (
  workspace_id IN (
    SELECT workspace_id 
    FROM workspace_access 
    WHERE shared_with_user_id = auth.uid()
  )
  AND created_by = auth.uid()
);

-- Add version_number column to canvas_data table
ALTER TABLE canvas_data ADD COLUMN IF NOT EXISTS version_number INTEGER DEFAULT 1;

COMMENT ON COLUMN canvas_data.version_number IS 'Current version number of this canvas data record'; 