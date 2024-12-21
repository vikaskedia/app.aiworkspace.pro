    CREATE TABLE matter_shares (
      id bigint NOT NULL,
      matter_id bigint,
      shared_with_user_id uuid
      access_type character varying NOT NULL,
      created_by uuid,
      created_at timestamp with time zone NOT NULL,
    );
    
    -- Indexes for matter_shares
    CREATE UNIQUE INDEX matter_shares_pkey ON public.matter_shares USING btree (id)
    CREATE UNIQUE INDEX matter_shares_matter_id_shared_with_user_id_key ON public.matter_shares USING btree (matter_id, shared_with_user_id)
    CREATE INDEX matter_shares_matter_id_idx ON public.matter_shares USING btree (matter_id)
    CREATE INDEX matter_shares_shared_with_user_id_idx ON public.matter_shares USING btree (shared_with_user_id)
    CREATE INDEX matter_shares_created_by_idx ON public.matter_shares USING btree (created_by)
    
    -- RLS for matter_shares
    ALTER TABLE matter_shares ENABLE ROW LEVEL SECURITY;
    
    -- Policies for matter_shares
    CREATE POLICY Users can view matter shares ON matter_shares FOR SELECT USING (((created_by = auth.uid()) OR (shared_with_user_id = auth.uid())));

    -- Create policy to allow users to share matters they own
    CREATE POLICY "Users can share their own matters" 
    ON matter_shares 
    FOR INSERT 
    WITH CHECK (
        matter_id IN (
            SELECT id 
            FROM matters 
            WHERE created_by = auth.uid()
        )
    );

    -- Create policy to allow users to view shares they're involved in
    CREATE POLICY "Users can view their matter shares" 
    ON matter_shares 
    FOR SELECT 
    USING (
        created_by = auth.uid() OR 
        shared_with_user_id = auth.uid()
    );

    CREATE POLICY "Users can view shared matters" 
    ON matters 
    FOR SELECT 
    USING (
      id IN (
        SELECT matter_id 
        FROM matter_shares 
        WHERE shared_with_user_id = auth.uid()
      )
    );  

    -- Add delete policy
    CREATE POLICY "Users can delete their matter shares" 
    ON matter_shares 
    FOR DELETE 
    USING (
        created_by = auth.uid() OR 
        matter_id IN (
            SELECT id 
            FROM matters 
            WHERE created_by = auth.uid()
        )
    );
