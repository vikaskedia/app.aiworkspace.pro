    CREATE TABLE tasks (
      title text NOT NULL,
      description text,
      status text NOT NULL,
      priority text NOT NULL,
      assignee uuid,
      due_date timestamp with time zone,
      matter_id bigint,
      created_by uuid,
      created_at timestamp with time zone,
      updated_at timestamp with time zone,
      id bigint NOT NULL
    );
    
    -- Indexes for tasks
    CREATE UNIQUE INDEX tasks_pkey ON public.tasks USING btree (id)
    CREATE INDEX tasks_matter_id_idx ON public.tasks USING btree (matter_id)
    CREATE INDEX tasks_created_by_idx ON public.tasks USING btree (created_by)
    CREATE INDEX tasks_assignee_idx ON public.tasks USING btree (assignee)
    
    -- RLS for tasks
    ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
    
    -- Policies for tasks
    CREATE POLICY "Users can view tasks" ON tasks
    FOR SELECT USING (
      matter_id IN (
        SELECT id FROM matters WHERE created_by = auth.uid()
        UNION
        SELECT matter_id FROM matter_shares WHERE shared_with_user_id = auth.uid()
      )
    );

    CREATE POLICY "Users can update tasks" ON tasks
    FOR UPDATE USING (
      matter_id IN (
        SELECT id FROM matters WHERE created_by = auth.uid()
        UNION
        SELECT matter_id FROM matter_shares 
        WHERE shared_with_user_id = auth.uid() AND access_type = 'edit'
      )
    );

    CREATE POLICY "Users can delete tasks" ON tasks
    FOR DELETE USING (
      matter_id IN (
        SELECT id FROM matters WHERE created_by = auth.uid()
        UNION
        SELECT matter_id FROM matter_shares 
        WHERE shared_with_user_id = auth.uid() AND access_type = 'edit'
      )
    );

    CREATE POLICY "Users can create tasks" ON tasks
    FOR INSERT WITH CHECK (
      matter_id IN (
        SELECT id FROM matters WHERE created_by = auth.uid()
        UNION
        SELECT matter_id FROM matter_shares 
        WHERE shared_with_user_id = auth.uid() AND access_type = 'edit'
      )
    );
