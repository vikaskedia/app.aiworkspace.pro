-- Create canvas_data table for storing JSON Canvas format data
CREATE TABLE IF NOT EXISTS canvas_data (
    id BIGSERIAL PRIMARY KEY,
    workspace_id BIGINT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    canvas_data JSONB NOT NULL DEFAULT '{"nodes": [], "edges": []}'::jsonb,
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    updated_by UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(workspace_id)
);

COMMENT ON TABLE canvas_data IS 'Stores JSON Canvas format data for each workspace.
Each workspace can have one canvas with:
1. canvas_data: JSON object following the JSON Canvas specification with nodes and edges
2. nodes: Array of canvas nodes (drawings, text, shapes, etc.)
3. edges: Array of connections between nodes
4. Standard audit fields (created_by, updated_by, created_at, updated_at)';

COMMENT ON COLUMN canvas_data.canvas_data IS 'JSON object following the JSON Canvas specification from Obsidian.
Format: {
  "nodes": [
    {
      "id": "unique-node-id",
      "type": "drawing|text|shape",
      "x": 100,
      "y": 100,
      "width": 200,
      "height": 100,
      "data": {
        // Node-specific data (path, text, etc.)
      }
    }
  ],
  "edges": [
    {
      "id": "unique-edge-id",
      "fromNode": "node-id-1",
      "toNode": "node-id-2",
      "color": "#666666",
      "width": 1
    }
  ]
}';

-- Add indexes for better performance
CREATE INDEX idx_canvas_data_workspace_id ON canvas_data(workspace_id);
CREATE INDEX idx_canvas_data_created_by ON canvas_data(created_by);
CREATE INDEX idx_canvas_data_updated_by ON canvas_data(updated_by);

-- Enable RLS (Row Level Security)
ALTER TABLE canvas_data ENABLE ROW LEVEL SECURITY;

-- Policies for canvas_data
CREATE POLICY "Users can view canvas data" ON canvas_data
FOR SELECT USING (
  workspace_id IN (
    SELECT workspace_id 
    FROM workspace_access 
    WHERE shared_with_user_id = auth.uid()
  )
);

CREATE POLICY "Users can create canvas data" ON canvas_data
FOR INSERT WITH CHECK (
  workspace_id IN (
    SELECT workspace_id 
    FROM workspace_access 
    WHERE shared_with_user_id = auth.uid()
  )
  AND created_by = auth.uid()
);

CREATE POLICY "Users can update canvas data" ON canvas_data
FOR UPDATE USING (
  workspace_id IN (
    SELECT workspace_access.workspace_id 
    FROM workspace_access 
    WHERE shared_with_user_id = auth.uid()
  )
  AND updated_by = auth.uid()
);

CREATE POLICY "Users can delete canvas data" ON canvas_data
FOR DELETE USING (
  workspace_id IN (
    SELECT workspace_id 
    FROM workspace_access 
    WHERE shared_with_user_id = auth.uid() 
    AND access_type = 'edit'
  )
  AND created_by = auth.uid()
); 