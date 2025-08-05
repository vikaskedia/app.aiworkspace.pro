-- Add support for multiple portfolios per workspace
-- Remove the unique constraint on matter_id to allow multiple portfolios per workspace
ALTER TABLE portfolio_data DROP CONSTRAINT IF EXISTS portfolio_data_matter_id_key;

-- Add portfolio_id and portfolio_name columns
ALTER TABLE portfolio_data 
ADD COLUMN IF NOT EXISTS portfolio_id TEXT,
ADD COLUMN IF NOT EXISTS portfolio_name TEXT;

-- Update existing records to have default portfolio information
UPDATE portfolio_data 
SET 
    portfolio_id = 'portfolio_' || id || '_' || extract(epoch from created_at)::text,
    portfolio_name = 'Portfolio 1'
WHERE portfolio_id IS NULL OR portfolio_name IS NULL;

-- Make the new columns NOT NULL after updating existing records
ALTER TABLE portfolio_data 
ALTER COLUMN portfolio_id SET NOT NULL,
ALTER COLUMN portfolio_name SET NOT NULL;

-- Add a unique constraint on the combination of matter_id and portfolio_id
ALTER TABLE portfolio_data 
ADD CONSTRAINT portfolio_data_matter_portfolio_unique 
UNIQUE (matter_id, portfolio_id);

-- Add portfolio_id to portfolio_analysis_results if it doesn't exist
ALTER TABLE portfolio_analysis_results 
ADD COLUMN IF NOT EXISTS portfolio_id TEXT;

-- Update existing analysis results to reference the first portfolio of each workspace
UPDATE portfolio_analysis_results 
SET portfolio_id = (
    SELECT portfolio_id 
    FROM portfolio_data 
    WHERE portfolio_data.matter_id = portfolio_analysis_results.matter_id 
    LIMIT 1
)
WHERE portfolio_id IS NULL;

-- Add index for better performance on portfolio queries
CREATE INDEX IF NOT EXISTS idx_portfolio_data_portfolio_id ON portfolio_data(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_data_matter_portfolio ON portfolio_data(matter_id, portfolio_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_analysis_results_portfolio_id ON portfolio_analysis_results(portfolio_id);

-- Update comments
COMMENT ON TABLE portfolio_data IS 'Stores AI Portfolio Manager spreadsheet data for each workspace/workspace.
Each workspace can have multiple portfolios, each with:
1. portfolio_id: Unique identifier for this portfolio within the workspace
2. portfolio_name: User-friendly name for the portfolio
3. columns: JSON array defining column structure [{ key: "item", label: "Portfolio Item" }]
4. data: JSON array containing row data [{ item: "Stock A", value: "1000", status: "Active" }]
5. system_prompt: Text prompt for AI analysis of the portfolio data
6. column_groups: JSON array defining collapsible column groups [{ id: "uuid", name: "Group Name", startCol: 0, endCol: 2 }]
7. saved_filters: JSON array of saved filter sets for quick application
8. Standard audit fields (created_by, updated_by, created_at, updated_at)';

COMMENT ON COLUMN portfolio_data.portfolio_id IS 'Unique identifier for this portfolio within the workspace';
COMMENT ON COLUMN portfolio_data.portfolio_name IS 'User-friendly name for the portfolio (e.g., "Tech Stocks", "Real Estate")';

COMMENT ON TABLE portfolio_analysis_results IS 'Stores AI analysis results for portfolio data.
Each analysis contains:
1. matter_id: The workspace this analysis belongs to
2. portfolio_id: The specific portfolio this analysis was run on
3. system_prompt: The prompt used for AI analysis
4. spreadsheet_data: Snapshot of the spreadsheet data at time of analysis
5. ai_response: The AI-generated analysis response
6. Standard audit fields (created_by, created_at)';

COMMENT ON COLUMN portfolio_analysis_results.portfolio_id IS 'References the specific portfolio this analysis was run on'; 