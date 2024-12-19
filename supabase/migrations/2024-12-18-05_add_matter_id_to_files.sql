ALTER TABLE files
ADD COLUMN matter_id bigint REFERENCES matters(id) ON DELETE CASCADE;

CREATE INDEX files_matter_id_idx ON files(matter_id);

-- Update RLS policies
DROP POLICY IF EXISTS "Users can view their own files" ON files;
CREATE POLICY "Users can view their own files" 
    ON files FOR SELECT 
    USING (
        auth.uid() = created_by AND
        matter_id IN (
            SELECT id FROM matters WHERE created_by = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert their own files" ON files;
CREATE POLICY "Users can insert their own files" 
    ON files FOR INSERT 
    WITH CHECK (
        auth.uid() = created_by AND
        matter_id IN (
            SELECT id FROM matters WHERE created_by = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete their own files" ON files;
CREATE POLICY "Users can delete their own files" 
    ON files FOR DELETE 
    USING (
        auth.uid() = created_by AND
        matter_id IN (
            SELECT id FROM matters WHERE created_by = auth.uid()
        )
    );

-- Update storage policies
CREATE POLICY "Users can upload files to their matters"
    ON storage.objects FOR INSERT
    WITH CHECK (
        auth.uid()::text = (storage.foldername())[2]::text AND
        (storage.foldername())[1] IN (
            SELECT id::text FROM matters WHERE created_by = auth.uid()
        )
    ); 