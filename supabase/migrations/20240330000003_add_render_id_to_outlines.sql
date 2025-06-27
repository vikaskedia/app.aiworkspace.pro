-- Add render_id column to outlines table to prevent cross-tab overwrites
ALTER TABLE outlines ADD COLUMN render_id text;

-- Update existing outlines with a default render_id
UPDATE outlines 
SET render_id = 'default_' || id::text || '_' || extract(epoch from now())::text
WHERE render_id IS NULL;

-- Add index for render_id for better performance
CREATE INDEX outlines_render_id_idx ON outlines(render_id); 