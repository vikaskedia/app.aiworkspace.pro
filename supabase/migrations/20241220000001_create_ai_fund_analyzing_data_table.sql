-- Create ai_fund_analyzing_data table for AI Fund Analyst OpenAI responses
CREATE TABLE IF NOT EXISTS ai_fund_analyzing_data (
    id BIGSERIAL PRIMARY KEY,
    matter_id BIGINT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    strategy VARCHAR(100) NOT NULL,
    prompt TEXT NOT NULL,
    openai_response TEXT,
    report_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    error_message TEXT,
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ai_fund_analyzing_data_matter_id ON ai_fund_analyzing_data(matter_id);
CREATE INDEX IF NOT EXISTS idx_ai_fund_analyzing_data_created_by ON ai_fund_analyzing_data(created_by);
CREATE INDEX IF NOT EXISTS idx_ai_fund_analyzing_data_strategy ON ai_fund_analyzing_data(strategy);
CREATE INDEX IF NOT EXISTS idx_ai_fund_analyzing_data_status ON ai_fund_analyzing_data(status);
CREATE INDEX IF NOT EXISTS idx_ai_fund_analyzing_data_created_at ON ai_fund_analyzing_data(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_fund_analyzing_data_report_datetime ON ai_fund_analyzing_data(report_datetime DESC);

-- Enable RLS
ALTER TABLE ai_fund_analyzing_data ENABLE ROW LEVEL SECURITY;

-- Policies for ai_fund_analyzing_data
CREATE POLICY "Users can view ai fund analyzing data" ON ai_fund_analyzing_data
FOR SELECT USING (
    matter_id IN (
        SELECT matter_id 
        FROM workspace_access 
        WHERE shared_with_user_id = auth.uid()
    )
);

CREATE POLICY "Users can create ai fund analyzing data" ON ai_fund_analyzing_data
FOR INSERT WITH CHECK (
    matter_id IN (
        SELECT matter_id 
        FROM workspace_access 
        WHERE shared_with_user_id = auth.uid() 
        AND access_type = 'edit'
    )
);

CREATE POLICY "Users can update ai fund analyzing data" ON ai_fund_analyzing_data
FOR UPDATE USING (
    matter_id IN (
        SELECT matter_id 
        FROM workspace_access 
        WHERE shared_with_user_id = auth.uid() 
        AND access_type = 'edit'
    )
);

CREATE POLICY "Users can delete ai fund analyzing data" ON ai_fund_analyzing_data
FOR DELETE USING (
    matter_id IN (
        SELECT matter_id 
        FROM workspace_access 
        WHERE shared_with_user_id = auth.uid() 
        AND access_type = 'edit'
    )
);

-- Add trigger to update updated_at timestamp
CREATE TRIGGER handle_updated_at 
  BEFORE UPDATE ON ai_fund_analyzing_data
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment for documentation
COMMENT ON TABLE ai_fund_analyzing_data IS 'AI Fund Analyst data with OpenAI responses.
Each record represents an AI analysis request and response for fund analysis.
Includes the user prompt, OpenAI response, and status tracking.';

COMMENT ON COLUMN ai_fund_analyzing_data.matter_id IS 'References the workspace/workspace this analysis belongs to';
COMMENT ON COLUMN ai_fund_analyzing_data.strategy IS 'The analysis strategy selected by the user';
COMMENT ON COLUMN ai_fund_analyzing_data.prompt IS 'The user input prompt sent to OpenAI';
COMMENT ON COLUMN ai_fund_analyzing_data.openai_response IS 'The response received from OpenAI API';
COMMENT ON COLUMN ai_fund_analyzing_data.report_datetime IS 'When the user requested the report to be generated';
COMMENT ON COLUMN ai_fund_analyzing_data.status IS 'Processing status: pending, completed, failed';
COMMENT ON COLUMN ai_fund_analyzing_data.error_message IS 'Error message if the OpenAI request failed'; 