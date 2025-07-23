-- Migration: Add spreadsheet_id column to ai_portfolio_data table
-- This enables support for multiple independent spreadsheets on the same page

-- Add spreadsheet_id column to ai_portfolio_data table
ALTER TABLE ai_portfolio_data 
ADD COLUMN IF NOT EXISTS spreadsheet_id TEXT;

-- Create index on spreadsheet_id for better query performance
CREATE INDEX IF NOT EXISTS idx_ai_portfolio_data_spreadsheet_id 
ON ai_portfolio_data(spreadsheet_id);

-- Update existing records to have a default spreadsheet_id if they don't have one
UPDATE ai_portfolio_data 
SET spreadsheet_id = 'sheet_default_' || id::text 
WHERE spreadsheet_id IS NULL;

-- Add comment to document the purpose of the column
COMMENT ON COLUMN ai_portfolio_data.spreadsheet_id IS 'Unique identifier for each spreadsheet instance to support multiple spreadsheets on the same page';

-- Update the RLS policies to include spreadsheet_id if they exist
-- Note: This assumes RLS policies exist, if not, this will just be ignored
DO $$
BEGIN
    -- Update SELECT policy if it exists
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'ai_portfolio_data' 
        AND policyname = 'Users can view their own portfolio data'
    ) THEN
        DROP POLICY "Users can view their own portfolio data" ON ai_portfolio_data;
        CREATE POLICY "Users can view their own portfolio data" ON ai_portfolio_data
            FOR SELECT USING (auth.uid() = user_id);
    END IF;

    -- Update INSERT policy if it exists
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'ai_portfolio_data' 
        AND policyname = 'Users can insert their own portfolio data'
    ) THEN
        DROP POLICY "Users can insert their own portfolio data" ON ai_portfolio_data;
        CREATE POLICY "Users can insert their own portfolio data" ON ai_portfolio_data
            FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;

    -- Update UPDATE policy if it exists
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'ai_portfolio_data' 
        AND policyname = 'Users can update their own portfolio data'
    ) THEN
        DROP POLICY "Users can update their own portfolio data" ON ai_portfolio_data;
        CREATE POLICY "Users can update their own portfolio data" ON ai_portfolio_data
            FOR UPDATE USING (auth.uid() = user_id);
    END IF;

    -- Update DELETE policy if it exists
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'ai_portfolio_data' 
        AND policyname = 'Users can delete their own portfolio data'
    ) THEN
        DROP POLICY "Users can delete their own portfolio data" ON ai_portfolio_data;
        CREATE POLICY "Users can delete their own portfolio data" ON ai_portfolio_data
            FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$; 