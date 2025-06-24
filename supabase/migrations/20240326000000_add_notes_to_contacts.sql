-- Add notes column to contacts table
ALTER TABLE contacts ADD COLUMN notes text DEFAULT '';

-- Update the table comment to include notes field
COMMENT ON TABLE contacts IS 'Contacts associated with matters/workspaces.
Each contact belongs to a specific matter and can have:
1. Name (required)
2. Phone number (optional)
3. Tags (array of text tags for categorization)
4. Notes (text field for additional information)
5. Standard audit fields (created_by, created_at, updated_at)
6. Soft delete capability (archived, archived_by, archived_at)'; 