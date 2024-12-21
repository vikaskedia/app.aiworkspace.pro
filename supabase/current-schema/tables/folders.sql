CREATE TABLE folders (
      id bigint NOT NULL,
      matter_id bigint,
      created_at timestamp with time zone NOT NULL,
      created_by uuid,
      folder_name character varying,
      parent_folder_id bigint,
      file_meta_ids json
    );
    
    -- Indexes for folders
    CREATE UNIQUE INDEX folders_pkey ON public.folders USING btree (id)
    CREATE INDEX folders_matter_id_idx ON public.folders USING btree (matter_id)
    
    -- RLS for folders
    ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
    
    -- Policies for folders
    CREATE POLICY "Users can view folders" ON folders
    FOR SELECT USING (
        matter_id IN (
            SELECT matter_id 
            FROM matter_access 
            WHERE shared_with_user_id = auth.uid()
        )
    );

    CREATE POLICY "Users can update folders" ON folders
    FOR UPDATE USING (
        matter_id IN (
            SELECT matter_id 
            FROM matter_access 
            WHERE shared_with_user_id = auth.uid() 
            AND access_type = 'edit'
        )
    );

    CREATE POLICY "Users can delete folders" ON folders
    FOR DELETE USING (
        matter_id IN (
            SELECT matter_id 
            FROM matter_access 
            WHERE shared_with_user_id = auth.uid() 
            AND access_type = 'edit'
        )
    );

    CREATE POLICY "Users can create folders" ON folders
    FOR INSERT WITH CHECK (
        matter_id IN (
            SELECT matter_id 
            FROM matter_access 
            WHERE shared_with_user_id = auth.uid() 
            AND access_type = 'edit'
        )
    );
    