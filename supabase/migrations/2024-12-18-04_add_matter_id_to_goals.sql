ALTER TABLE goals
ADD COLUMN matter_id bigint REFERENCES matters(id) ON DELETE CASCADE;

CREATE INDEX goals_matter_id_idx ON goals(matter_id);

-- Update RLS policies to include matter_id check
DROP POLICY IF EXISTS "Users can view their own goals" ON goals;
CREATE POLICY "Users can view their own goals" 
    ON goals FOR SELECT 
    USING (
        auth.uid() = created_by AND
        matter_id IN (
            SELECT id FROM matters WHERE created_by = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert their own goals" ON goals;
CREATE POLICY "Users can insert their own goals" 
    ON goals FOR INSERT 
    WITH CHECK (
        auth.uid() = created_by AND
        matter_id IN (
            SELECT id FROM matters WHERE created_by = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update their own goals" ON goals;
CREATE POLICY "Users can update their own goals" 
    ON goals FOR UPDATE 
    USING (
        auth.uid() = created_by AND
        matter_id IN (
            SELECT id FROM matters WHERE created_by = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete their own goals" ON goals;
CREATE POLICY "Users can delete their own goals" 
    ON goals FOR DELETE 
    USING (
        auth.uid() = created_by AND
        matter_id IN (
            SELECT id FROM matters WHERE created_by = auth.uid()
        )
    ); 