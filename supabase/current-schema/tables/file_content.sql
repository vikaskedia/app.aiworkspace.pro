CREATE TABLE file_content (
      id bigint NOT NULL,
      created_at date,
      file_content jsonb,
      created_by uuid,
      matter_id bigint
    );
    
    -- Indexes for file_content
    CREATE UNIQUE INDEX files_pkey ON public.file_content USING btree (id)
    CREATE INDEX file_content_matter_id_idx ON public.file_content USING btree (matter_id)
    
    -- RLS for file_content
    -- No RLS enabled
    
    -- Policies for file_content
    -- No policies
    
    -- Enable RLS for file_content
    ALTER TABLE file_content ENABLE ROW LEVEL SECURITY;

    -- Policies for file_content
    CREATE POLICY "Users can view file content" ON file_content
    FOR SELECT USING (
        matter_id IN (
            SELECT matter_id 
            FROM matter_access 
            WHERE shared_with_user_id = auth.uid()
        )
    );

    CREATE POLICY "Users can update file content" ON file_content
    FOR UPDATE USING (
        matter_id IN (
            SELECT matter_id 
            FROM matter_access 
            WHERE shared_with_user_id = auth.uid() 
            AND access_type = 'edit'
        )
    );

    CREATE POLICY "Users can delete file content" ON file_content
    FOR DELETE USING (
        matter_id IN (
            SELECT matter_id 
            FROM matter_access 
            WHERE shared_with_user_id = auth.uid() 
            AND access_type = 'edit'
        )
    );

    CREATE POLICY "Users can create file content" ON file_content
    FOR INSERT WITH CHECK (
        matter_id IN (
            SELECT matter_id 
            FROM matter_access 
            WHERE shared_with_user_id = auth.uid() 
            AND access_type = 'edit'
        )
    );
    
