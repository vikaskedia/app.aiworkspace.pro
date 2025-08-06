-- Create ai_fund_analysis_results table for storing LLM responses
CREATE TABLE IF NOT EXISTS ai_fund_analysis_results (
    id BIGSERIAL PRIMARY KEY,
    analysis_id BIGINT NOT NULL REFERENCES ai_fund_analyzing_data(id) ON DELETE CASCADE,
    openai_response TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ai_fund_analysis_results_analysis_id ON ai_fund_analysis_results(analysis_id);
CREATE INDEX IF NOT EXISTS idx_ai_fund_analysis_results_status ON ai_fund_analysis_results(status);
CREATE INDEX IF NOT EXISTS idx_ai_fund_analysis_results_created_at ON ai_fund_analysis_results(created_at DESC);

-- Enable RLS
ALTER TABLE ai_fund_analysis_results ENABLE ROW LEVEL SECURITY;

-- Policies for ai_fund_analysis_results
CREATE POLICY "Users can view ai fund analysis results" ON ai_fund_analysis_results
FOR SELECT USING (
    analysis_id IN (
        SELECT id FROM ai_fund_analyzing_data 
        WHERE workspace_id IN (
            SELECT workspace_id 
            FROM workspace_access 
            WHERE shared_with_user_id = auth.uid()
        )
    )
);

CREATE POLICY "Users can create ai fund analysis results" ON ai_fund_analysis_results
FOR INSERT WITH CHECK (
    analysis_id IN (
        SELECT id FROM ai_fund_analyzing_data 
        WHERE workspace_id IN (
            SELECT workspace_id 
            FROM workspace_access 
            WHERE shared_with_user_id = auth.uid() 
            AND access_type = 'edit'
        )
    )
);

CREATE POLICY "Users can update ai fund analysis results" ON ai_fund_analysis_results
FOR UPDATE USING (
    analysis_id IN (
        SELECT id FROM ai_fund_analyzing_data 
        WHERE workspace_id IN (
            SELECT workspace_id 
            FROM workspace_access 
            WHERE shared_with_user_id = auth.uid() 
            AND access_type = 'edit'
        )
    )
);

CREATE POLICY "Users can delete ai fund analysis results" ON ai_fund_analysis_results
FOR DELETE USING (
    analysis_id IN (
        SELECT id FROM ai_fund_analyzing_data 
        WHERE workspace_id IN (
            SELECT workspace_id 
            FROM workspace_access 
            WHERE shared_with_user_id = auth.uid() 
            AND access_type = 'edit'
        )
    )
);

-- Add trigger to update updated_at timestamp
CREATE TRIGGER handle_updated_at 
  BEFORE UPDATE ON ai_fund_analysis_results
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment for documentation
COMMENT ON TABLE ai_fund_analysis_results IS 'LLM analysis results linked to ai_fund_analyzing_data.
Each record represents an LLM response attempt for a specific analysis request.
Multiple results can exist for one analysis (retry scenarios).';

COMMENT ON COLUMN ai_fund_analysis_results.analysis_id IS 'Foreign key to ai_fund_analyzing_data table';
COMMENT ON COLUMN ai_fund_analysis_results.openai_response IS 'The response received from OpenAI API';
COMMENT ON COLUMN ai_fund_analysis_results.status IS 'Processing status: pending, completed, failed';
COMMENT ON COLUMN ai_fund_analysis_results.error_message IS 'Error message if the OpenAI request failed'; 