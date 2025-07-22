-- Add saved_filters column to portfolio_data table for storing filter sets
ALTER TABLE portfolio_data 
ADD COLUMN IF NOT EXISTS saved_filters jsonb DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN portfolio_data.saved_filters IS 'JSON array of saved filter sets for quick application'; 