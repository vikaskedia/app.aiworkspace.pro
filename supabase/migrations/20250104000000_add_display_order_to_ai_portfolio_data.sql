-- Migration: Add display_order column to ai_portfolio_data table
-- This enables custom ordering of spreadsheets within portfolios

-- Add display_order column to ai_portfolio_data table
ALTER TABLE ai_portfolio_data 
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Create index on display_order for better query performance
CREATE INDEX IF NOT EXISTS idx_ai_portfolio_data_display_order 
ON ai_portfolio_data(display_order);

-- Create composite index for portfolio_id + display_order for efficient ordering within portfolios
CREATE INDEX IF NOT EXISTS idx_ai_portfolio_data_portfolio_display_order 
ON ai_portfolio_data(portfolio_id, display_order);

-- Update existing records to have default display_order based on created_at
-- This ensures backward compatibility while giving existing spreadsheets an order
WITH ordered_spreadsheets AS (
    SELECT 
        id,
        ROW_NUMBER() OVER (PARTITION BY portfolio_id ORDER BY created_at ASC) as row_num
    FROM ai_portfolio_data 
    WHERE display_order = 0 OR display_order IS NULL
)
UPDATE ai_portfolio_data 
SET display_order = ordered_spreadsheets.row_num
FROM ordered_spreadsheets
WHERE ai_portfolio_data.id = ordered_spreadsheets.id;

-- Add comment to document the purpose of the column
COMMENT ON COLUMN ai_portfolio_data.display_order IS 'Integer value determining the display order of spreadsheets within a portfolio. Lower values appear first.';