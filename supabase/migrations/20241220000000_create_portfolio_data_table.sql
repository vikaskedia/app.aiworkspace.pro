-- Create portfolio_data table for storing AI Portfolio Manager spreadsheet data
CREATE TABLE IF NOT EXISTS portfolio_data (
    id BIGSERIAL PRIMARY KEY,
    matter_id BIGINT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    columns JSONB NOT NULL DEFAULT '[]'::jsonb,
    data JSONB NOT NULL DEFAULT '[]'::jsonb,
    system_prompt TEXT DEFAULT '',
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    updated_by UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(matter_id)
);

COMMENT ON TABLE portfolio_data IS 'Stores AI Portfolio Manager spreadsheet data for each matter/workspace.
Each workspace can have one portfolio with:
1. columns: JSON array defining column structure [{ key: "item", label: "Portfolio Item" }]
2. data: JSON array containing row data [{ item: "Stock A", value: "1000", status: "Active" }]
3. system_prompt: Text prompt for AI analysis of the portfolio data
4. Standard audit fields (created_by, updated_by, created_at, updated_at)';

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

-- Create portfolio_analysis_results table for storing AI analysis results
CREATE TABLE IF NOT EXISTS portfolio_analysis_results (
    id BIGSERIAL PRIMARY KEY,
    matter_id BIGINT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    system_prompt TEXT NOT NULL,
    spreadsheet_data JSONB NOT NULL,
    ai_response TEXT NOT NULL,
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE portfolio_analysis_results IS 'Stores AI analysis results for portfolio data.
Each analysis contains:
1. system_prompt: The prompt used for AI analysis
2. spreadsheet_data: Snapshot of the spreadsheet data at time of analysis
3. ai_response: The AI-generated analysis response
4. Standard audit fields (created_by, created_at)';

-- Add indexes for portfolio_analysis_results
CREATE INDEX idx_portfolio_analysis_results_matter_id ON portfolio_analysis_results(matter_id);
CREATE INDEX idx_portfolio_analysis_results_created_by ON portfolio_analysis_results(created_by);
CREATE INDEX idx_portfolio_analysis_results_created_at ON portfolio_analysis_results(created_at DESC);

-- Enable RLS for portfolio_analysis_results
ALTER TABLE portfolio_analysis_results ENABLE ROW LEVEL SECURITY;

-- Policies for portfolio_analysis_results
CREATE POLICY "Users can view analysis results" ON portfolio_analysis_results
FOR SELECT USING (
  matter_id IN (
    SELECT matter_id 
    FROM workspace_access 
    WHERE shared_with_user_id = auth.uid()
  )
);

CREATE POLICY "Users can create analysis results" ON portfolio_analysis_results
FOR INSERT WITH CHECK (
  matter_id IN (
    SELECT matter_id 
    FROM workspace_access 
    WHERE shared_with_user_id = auth.uid() 
    AND access_type = 'edit'
  )
  AND created_by = auth.uid()
);

CREATE POLICY "Users can delete analysis results" ON portfolio_analysis_results
FOR DELETE USING (
  matter_id IN (
    SELECT matter_id 
    FROM workspace_access 
    WHERE shared_with_user_id = auth.uid() 
    AND access_type = 'edit'
  )
); 