-- Create portfolio_data table for storing AI Portfolio Manager spreadsheet data
CREATE TABLE IF NOT EXISTS portfolio_data (
    id BIGSERIAL PRIMARY KEY,
    matter_id BIGINT NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
    columns JSONB NOT NULL DEFAULT '[]'::jsonb,
    data JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    updated_by UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(matter_id)
);

COMMENT ON TABLE portfolio_data IS 'Stores AI Portfolio Manager spreadsheet data for each matter/workspace.
Each matter can have one portfolio with:
1. columns: JSON array defining column structure [{ key: "item", label: "Portfolio Item" }]
2. data: JSON array containing row data [{ item: "Stock A", value: "1000", status: "Active" }]
3. Standard audit fields (created_by, updated_by, created_at, updated_at)';

-- Add indexes for better performance
CREATE INDEX idx_portfolio_data_matter_id ON portfolio_data(matter_id);
CREATE INDEX idx_portfolio_data_created_by ON portfolio_data(created_by);
CREATE INDEX idx_portfolio_data_updated_by ON portfolio_data(updated_by);

-- Enable RLS (Row Level Security)
ALTER TABLE portfolio_data ENABLE ROW LEVEL SECURITY;

-- Policies for portfolio_data
CREATE POLICY "Users can view portfolio data" ON portfolio_data
FOR SELECT USING (
  matter_id IN (
    SELECT matter_id 
    FROM workspace_access 
    WHERE shared_with_user_id = auth.uid()
  )
);

CREATE POLICY "Users can create portfolio data" ON portfolio_data
FOR INSERT WITH CHECK (
  matter_id IN (
    SELECT matter_id 
    FROM workspace_access 
    WHERE shared_with_user_id = auth.uid() 
    AND access_type = 'edit'
  )
  AND created_by = auth.uid()
);

CREATE POLICY "Users can update portfolio data" ON portfolio_data
FOR UPDATE USING (
  matter_id IN (
    SELECT matter_id 
    FROM workspace_access 
    WHERE shared_with_user_id = auth.uid() 
    AND access_type = 'edit'
  )
);

CREATE POLICY "Users can delete portfolio data" ON portfolio_data
FOR DELETE USING (
  matter_id IN (
    SELECT matter_id 
    FROM workspace_access 
    WHERE shared_with_user_id = auth.uid() 
    AND access_type = 'edit'
  )
);

-- Add trigger to update updated_at timestamp
CREATE TRIGGER update_portfolio_data_updated_at 
    BEFORE UPDATE ON portfolio_data 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 