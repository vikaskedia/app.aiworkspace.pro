-- Add column_groups field to portfolio_data table for collapsible column groups
ALTER TABLE portfolio_data 
ADD COLUMN column_groups JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN portfolio_data.column_groups IS 'JSON array defining collapsible column groups structure [{ id: "uuid", name: "Group Name", startCol: 0, endCol: 2 }]';

-- Add index for column_groups for better performance when querying
CREATE INDEX idx_portfolio_data_column_groups ON portfolio_data USING GIN (column_groups); 