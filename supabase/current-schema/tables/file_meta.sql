CREATE TABLE file_meta (
      matter_id bigint,
      file_content_id bigint,
      id bigint NOT NULL,
      created_at timestamp with time zone NOT NULL,
      file_name character varying,
      created_by uuid
    );
    
    -- Indexes for file_meta
    CREATE UNIQUE INDEX file_meta_pkey ON public.file_meta USING btree (id)
    CREATE INDEX file_meta_matter_id_idx ON public.file_meta USING btree (matter_id)
    CREATE INDEX file_meta_created_by_idx ON public.file_meta USING btree (created_by)
    
    -- RLS for file_meta
    ALTER TABLE file_meta ENABLE ROW LEVEL SECURITY;
    
    -- Policies for file_meta
    CREATE POLICY "Users can view file metadata" ON file_meta
    FOR SELECT USING (
        matter_id IN (
            SELECT matter_id 
            FROM matter_access 
            WHERE shared_with_user_id = auth.uid()
        )
    );

    CREATE POLICY "Users can update file metadata" ON file_meta
    FOR UPDATE USING (
        matter_id IN (
            SELECT matter_id 
            FROM matter_access 
            WHERE shared_with_user_id = auth.uid() 
            AND access_type = 'edit'
        )
    );

    CREATE POLICY "Users can delete file metadata" ON file_meta
    FOR DELETE USING (
        matter_id IN (
            SELECT matter_id 
            FROM matter_access 
            WHERE shared_with_user_id = auth.uid() 
            AND access_type = 'edit'
        )
    );

    CREATE POLICY "Users can create file metadata" ON file_meta
    FOR INSERT WITH CHECK (
        matter_id IN (
            SELECT matter_id 
            FROM matter_access 
            WHERE shared_with_user_id = auth.uid() 
            AND access_type = 'edit'
        )
    );
    
