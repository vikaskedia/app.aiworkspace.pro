-- Migration: Add portfolio_id column to ai_portfolio_data table
-- This enables linking spreadsheets to specific portfolios for hierarchical organization

-- Add portfolio_id column to ai_portfolio_data table
ALTER TABLE ai_portfolio_data 
ADD COLUMN IF NOT EXISTS portfolio_id TEXT;

-- Create index on portfolio_id for better query performance
CREATE INDEX IF NOT EXISTS idx_ai_portfolio_data_portfolio_id 
ON ai_portfolio_data(portfolio_id);

-- Add comment to document the purpose of the column
COMMENT ON COLUMN ai_portfolio_data.portfolio_id IS 'Unique identifier linking this spreadsheet to a specific portfolio';

-- Update existing records to have a default portfolio_id
-- First, try to match them with existing portfolio_data records by matter_id
UPDATE ai_portfolio_data 
SET portfolio_id = (
    SELECT portfolio_id 
    FROM portfolio_data 
    WHERE portfolio_data.matter_id = ai_portfolio_data.matter_id 
    ORDER BY created_at ASC 
    LIMIT 1
)
WHERE portfolio_id IS NULL 
AND matter_id IN (SELECT matter_id FROM portfolio_data);

-- For any remaining records without portfolio_id, create a default portfolio ID
UPDATE ai_portfolio_data 
SET portfolio_id = 'portfolio_legacy_' || matter_id || '_' || extract(epoch from created_at)::text 
WHERE portfolio_id IS NULL;

-- Add composite index for efficient queries
CREATE INDEX IF NOT EXISTS idx_ai_portfolio_data_matter_portfolio 
ON ai_portfolio_data(matter_id, portfolio_id);

-- Add index for spreadsheet_id + portfolio_id combination
CREATE INDEX IF NOT EXISTS idx_ai_portfolio_data_spreadsheet_portfolio 
ON ai_portfolio_data(spreadsheet_id, portfolio_id); 