-- Migration: Add collaborative editing constraint to prevent multiple editors
-- This ensures only one user can be in edit mode (view_mode = false) for the same portfolio at once

-- Add a unique partial index to enforce only one editor per portfolio
-- This prevents race conditions at the database level
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_portfolio_settings_single_editor 
ON ai_portfolio_settings (matter_id, portfolio_id) 
WHERE view_mode = false;

-- Add comment explaining the constraint
COMMENT ON INDEX idx_ai_portfolio_settings_single_editor IS 'Ensures only one user can edit (view_mode = false) the same portfolio at a time within a workspace'; 