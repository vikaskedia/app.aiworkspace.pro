-- Create ai_portfolio_settings table for storing user view mode preferences
CREATE TABLE IF NOT EXISTS ai_portfolio_settings (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    matter_id BIGINT REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
    portfolio_id TEXT NOT NULL,
    view_mode BOOLEAN NOT NULL DEFAULT true, -- false = edit mode, true = readonly mode (default)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, matter_id, portfolio_id)
);

COMMENT ON TABLE ai_portfolio_settings IS 'Stores user-specific view mode preferences for AI Portfolio Manager.
Each record represents a user''s preference for a specific portfolio within a workspace:
1. user_id: The user who owns this preference
2. matter_id: The workspace/matter this preference applies to
3. portfolio_id: The specific portfolio/tab this preference applies to
4. view_mode: false = edit mode, true = readonly mode (default when no preference exists)
5. Standard audit fields (created_at, updated_at)';

COMMENT ON COLUMN ai_portfolio_settings.view_mode IS 'View mode preference: false = edit mode (user can edit), true = readonly mode (user cannot edit). Defaults to readonly mode when no preference is saved.';

-- Add indexes for better performance
CREATE INDEX idx_ai_portfolio_settings_user_id ON ai_portfolio_settings(user_id);
CREATE INDEX idx_ai_portfolio_settings_matter_id ON ai_portfolio_settings(matter_id);
CREATE INDEX idx_ai_portfolio_settings_portfolio_id ON ai_portfolio_settings(portfolio_id);
CREATE INDEX idx_ai_portfolio_settings_composite ON ai_portfolio_settings(user_id, matter_id, portfolio_id);

-- Enable RLS (Row Level Security)
ALTER TABLE ai_portfolio_settings ENABLE ROW LEVEL SECURITY;

-- Policies for ai_portfolio_settings
CREATE POLICY "Users can view their own portfolio settings" ON ai_portfolio_settings
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own portfolio settings" ON ai_portfolio_settings
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own portfolio settings" ON ai_portfolio_settings
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own portfolio settings" ON ai_portfolio_settings
FOR DELETE USING (auth.uid() = user_id);

-- Add trigger to update updated_at column
CREATE OR REPLACE FUNCTION update_ai_portfolio_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ai_portfolio_settings_updated_at
    BEFORE UPDATE ON ai_portfolio_settings
    FOR EACH ROW
    EXECUTE PROCEDURE update_ai_portfolio_settings_updated_at(); 