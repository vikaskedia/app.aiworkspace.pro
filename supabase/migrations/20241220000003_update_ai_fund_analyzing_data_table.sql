-- Remove LLM-related fields from ai_fund_analyzing_data table
-- These fields are now in the ai_fund_analysis_results table

-- Remove columns that are now in ai_fund_analysis_results
ALTER TABLE ai_fund_analyzing_data DROP COLUMN IF EXISTS openai_response;
ALTER TABLE ai_fund_analyzing_data DROP COLUMN IF EXISTS status;
ALTER TABLE ai_fund_analyzing_data DROP COLUMN IF EXISTS error_message;

-- Update table comment to reflect the new structure
COMMENT ON TABLE ai_fund_analyzing_data IS 'AI Fund Analyst analysis requests.
Each record represents a strategy and prompt combination.
LLM responses are stored in the ai_fund_analysis_results table.';

-- Update column comments
COMMENT ON COLUMN ai_fund_analyzing_data.matter_id IS 'References the workspace/workspace this analysis belongs to';
COMMENT ON COLUMN ai_fund_analyzing_data.strategy IS 'The analysis strategy selected by the user';
COMMENT ON COLUMN ai_fund_analyzing_data.prompt IS 'The user input prompt for analysis';
COMMENT ON COLUMN ai_fund_analyzing_data.report_datetime IS 'When the user requested the report to be generated'; 