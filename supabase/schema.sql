-- this file stores the current schema after all the migrations have been applied

/* Command to generate the scheme from supabase sql editor
SELECT string_agg(table_definition || E'\n\n', '')
FROM (
  SELECT format(
    $fmt$
    -- Table: %I
    CREATE TABLE %I (
      %s
    );
    
    -- Indexes for %I
    %s
    
    -- RLS for %I
    %s
    
    -- Policies for %I
    %s
    $fmt$,
    t.table_name,
    t.table_name,
    string_agg(
      format('%I %s%s%s',
        c.column_name,
        c.data_type,
        CASE WHEN c.character_maximum_length IS NOT NULL 
          THEN '(' || c.character_maximum_length || ')'
          ELSE ''
        END,
        CASE WHEN c.is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END
      ),
      E',\n      '
    ),
    t.table_name,
    COALESCE((
      SELECT string_agg(indexdef, E'\n    ')
      FROM pg_indexes
      WHERE tablename = t.table_name
        AND schemaname = 'public'
    ), '-- No indexes'),
    t.table_name,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE tablename = t.table_name 
          AND rowsecurity = true
      )
      THEN 'ALTER TABLE ' || t.table_name || ' ENABLE ROW LEVEL SECURITY;'
      ELSE '-- No RLS enabled'
    END,
    t.table_name,
    COALESCE((
      SELECT string_agg(
        'CREATE POLICY ' || polname || ' ON ' || t.table_name || 
        ' FOR ' || 
        CASE 
          WHEN polcmd = 'r' THEN 'SELECT'
          WHEN polcmd = 'w' THEN 'UPDATE'
          WHEN polcmd = 'a' THEN 'INSERT'
          WHEN polcmd = 'd' THEN 'DELETE'
        END ||
        ' USING (' || pg_get_expr(polqual, polrelid) || ');',
        E'\n    '
      )
      FROM pg_policy
      WHERE polrelid = (SELECT oid FROM pg_class WHERE relname = t.table_name)
    ), '-- No policies')
  ) as table_definition
  FROM information_schema.tables t
  JOIN information_schema.columns c ON c.table_name = t.table_name
  WHERE t.table_schema = 'public'
  GROUP BY t.table_name
) subq;


--  For functions and triggers, add this additional query:

SELECT string_agg(function_definition || E'\n\n', '')
FROM (
  SELECT format(
    $fmt$
    -- Function: %I
    %s
    
    -- Triggers using %I
    %s
    $fmt$,
    p.proname,
    pg_get_functiondef(p.oid),
    p.proname,
    COALESCE((
      SELECT string_agg(
        'CREATE TRIGGER ' || t.tgname || 
        ' BEFORE UPDATE ON ' || c.relname ||
        ' FOR EACH ROW EXECUTE FUNCTION ' || p.proname || '();',
        E'\n    '
      )
      FROM pg_trigger t
      JOIN pg_class c ON t.tgrelid = c.oid
      WHERE t.tgfoid = p.oid
    ), '-- No triggers')
  ) as function_definition
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
) subq;

*/


    -- Table: events
    CREATE TABLE events (
      start_time timestamp with time zone NOT NULL,
      description text,
      title text NOT NULL,
      id bigint NOT NULL,
      updated_at timestamp with time zone,
      created_at timestamp with time zone,
      created_by uuid,
      matter_id bigint,
      attendees jsonb,
      location text,
      end_time timestamp with time zone NOT NULL,
      event_type text NOT NULL
    );
    
    -- Indexes for events
    CREATE UNIQUE INDEX events_pkey ON public.events USING btree (id)
    CREATE INDEX events_matter_id_idx ON public.events USING btree (matter_id)
    CREATE INDEX events_created_by_idx ON public.events USING btree (created_by)
    CREATE INDEX events_start_time_idx ON public.events USING btree (start_time)
    
    -- RLS for events
    ALTER TABLE events ENABLE ROW LEVEL SECURITY;
    
    -- Policies for events
    CREATE POLICY Users can delete events in their matters ON events FOR DELETE USING ((matter_id IN ( SELECT matters.id
   FROM matters
  WHERE (matters.created_by = auth.uid()))));
    CREATE POLICY Users can update events in their matters ON events FOR UPDATE USING ((matter_id IN ( SELECT matters.id
   FROM matters
  WHERE (matters.created_by = auth.uid()))));
    CREATE POLICY Users can view events in their matters ON events FOR SELECT USING ((matter_id IN ( SELECT matters.id
   FROM matters
  WHERE (matters.created_by = auth.uid()))));
    


    -- Table: file_content
    CREATE TABLE file_content (
      id bigint NOT NULL,
      created_at date,
      file_content jsonb,
      created_by uuid REFERENCES auth.users(id),
      matter_id bigint REFERENCES matters(id) ON DELETE CASCADE
    );
    
    -- Indexes for file_content
    CREATE UNIQUE INDEX files_pkey ON public.file_content USING btree (id);
    CREATE INDEX file_content_matter_id_idx ON file_content(matter_id);
    
    -- RLS for file_content
    -- No RLS enabled
    
    -- Policies for file_content
    -- No policies
    


    -- Table: file_meta
    CREATE TABLE file_meta (
      file_content_id bigint,
      id bigint NOT NULL,
      created_at timestamp with time zone NOT NULL,
      file_name character varying,
      created_by uuid REFERENCES auth.users(id),
      matter_id bigint REFERENCES matters(id) ON DELETE CASCADE
    );
    
    -- Indexes for file_meta
    CREATE UNIQUE INDEX file_meta_pkey ON public.file_meta USING btree (id);
    CREATE INDEX file_meta_matter_id_idx ON file_meta(matter_id);
    CREATE INDEX file_meta_created_by_idx ON file_meta(created_by);
    
    -- RLS for file_meta
    ALTER TABLE file_meta ENABLE ROW LEVEL SECURITY;
    
    -- Policies for file_meta
    -- No policies
    


    -- Table: folders
    CREATE TABLE folders (
      created_at timestamp with time zone NOT NULL,
      created_by uuid REFERENCES auth.users(id),
      folder_name character varying,
      parent_folder_id bigint,
      file_meta_ids json,
      id bigint NOT NULL,
      matter_id bigint REFERENCES matters(id) ON DELETE CASCADE
    );
    
    -- Indexes for folders
    CREATE UNIQUE INDEX folders_pkey ON public.folders USING btree (id);
    CREATE INDEX folders_matter_id_idx ON folders(matter_id);
    
    -- RLS for folders
    ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
    
    -- Policies for folders
    -- No policies
    


    -- Table: goals
    CREATE TABLE goals (
      created_at timestamp with time zone NOT NULL,
      updated_at timestamp with time zone NOT NULL,
      created_by uuid,
      related_files jsonb,
      matter_id bigint,
      due_date timestamp with time zone,
      priority character varying,
      status character varying,
      description text,
      title character varying NOT NULL,
      id bigint NOT NULL
    );
    
    -- Indexes for goals
    CREATE UNIQUE INDEX goals_pkey ON public.goals USING btree (id)
    CREATE INDEX goals_created_by_idx ON public.goals USING btree (created_by)
    CREATE INDEX goals_status_idx ON public.goals USING btree (status)
    CREATE INDEX goals_due_date_idx ON public.goals USING btree (due_date)
    CREATE INDEX goals_matter_id_idx ON public.goals USING btree (matter_id)
    
    -- RLS for goals
    ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
    
    -- Policies for goals
    CREATE POLICY Users can delete their own goals ON goals FOR DELETE USING (((auth.uid() = created_by) AND (matter_id IN ( SELECT matters.id
   FROM matters
  WHERE (matters.created_by = auth.uid())))));
    CREATE POLICY Users can update their own goals ON goals FOR UPDATE USING (((auth.uid() = created_by) AND (matter_id IN ( SELECT matters.id
   FROM matters
  WHERE (matters.created_by = auth.uid())))));
    CREATE POLICY Users can view their own goals ON goals FOR SELECT USING (((auth.uid() = created_by) AND (matter_id IN ( SELECT matters.id
   FROM matters
  WHERE (matters.created_by = auth.uid())))));
    


    -- Table: matters
    CREATE TABLE matters (
      created_by uuid,
      updated_at timestamp with time zone NOT NULL,
      created_at timestamp with time zone NOT NULL,
      description text,
      title character varying NOT NULL,
      id bigint NOT NULL
    );
    
    -- Indexes for matters
    CREATE UNIQUE INDEX matters_pkey ON public.matters USING btree (id)
    CREATE INDEX matters_created_by_idx ON public.matters USING btree (created_by)
    
    -- RLS for matters
    ALTER TABLE matters ENABLE ROW LEVEL SECURITY;
    
    -- Policies for matters
    CREATE POLICY Users can delete their own matters ON matters FOR DELETE USING ((auth.uid() = created_by));
    CREATE POLICY Users can update their own matters ON matters FOR UPDATE USING ((auth.uid() = created_by));
    CREATE POLICY Users can view their own matters ON matters FOR SELECT USING ((auth.uid() = created_by));


    -- Table: matter_shares
    CREATE TABLE matter_shares (
    id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    matter_id bigint REFERENCES matters(id) ON DELETE CASCADE,
    shared_with_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    access_type varchar NOT NULL CHECK (access_type IN ('view', 'edit')),
    created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE(matter_id, shared_with_user_id)
    );

    -- Create indexes
    CREATE INDEX matter_shares_matter_id_idx ON matter_shares(matter_id);
    CREATE INDEX matter_shares_shared_with_user_id_idx ON matter_shares(shared_with_user_id);
    CREATE INDEX matter_shares_created_by_idx ON matter_shares(created_by);

    -- Enable RLS
    ALTER TABLE matter_shares ENABLE ROW LEVEL SECURITY;

    -- Create policies
    CREATE POLICY "Users can view shares for their matters"
        ON matter_shares FOR SELECT
        USING (
            matter_id IN (
                SELECT id FROM matters WHERE created_by = auth.uid()
            )
            OR
            shared_with_user_id = auth.uid()
        );

    CREATE POLICY "Matter owners can manage shares"
        ON matter_shares FOR ALL
        USING (
            matter_id IN (
                SELECT id FROM matters WHERE created_by = auth.uid()
            )
        ); 



    -- Table: tasks
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
    CREATE POLICY Users can delete tasks in their matters ON tasks FOR DELETE USING ((matter_id IN ( SELECT matters.id
   FROM matters
  WHERE (matters.created_by = auth.uid()))));
    CREATE POLICY Users can update tasks in their matters ON tasks FOR UPDATE USING ((matter_id IN ( SELECT matters.id
   FROM matters
  WHERE (matters.created_by = auth.uid()))));
    CREATE POLICY Users can view tasks in their matters ON tasks FOR SELECT USING ((matter_id IN ( SELECT matters.id
   FROM matters
  WHERE (matters.created_by = auth.uid()))));
    

-- Functions and Triggers

    -- Function: update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$

    
    -- Triggers using update_updated_at_column
    CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    CREATE TRIGGER update_goals_updated_at BEFORE UPDATE ON goals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    CREATE TRIGGER update_matters_updated_at BEFORE UPDATE ON matters FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    




