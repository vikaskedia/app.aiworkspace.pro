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
      created_by bigint
    );
    
    -- Indexes for file_content
    CREATE UNIQUE INDEX files_pkey ON public.file_content USING btree (id)
    
    -- RLS for file_content
    -- No RLS enabled
    
    -- Policies for file_content
    -- No policies
    


    -- Table: file_meta
    CREATE TABLE file_meta (
      file_content_id bigint,
      id bigint NOT NULL,
      created_at timestamp with time zone NOT NULL,
      file_name character varying
    );
    
    -- Indexes for file_meta
    CREATE UNIQUE INDEX file_meta_pkey ON public.file_meta USING btree (id)
    
    -- RLS for file_meta
    ALTER TABLE file_meta ENABLE ROW LEVEL SECURITY;
    
    -- Policies for file_meta
    -- No policies
    


    -- Table: folders
    CREATE TABLE folders (
      created_at timestamp with time zone NOT NULL,
      created_by bigint,
      folder_name character varying,
      parent_folder_id bigint,
      file_meta_ids json,
      id bigint NOT NULL
    );
    
    -- Indexes for folders
    CREATE UNIQUE INDEX folders_pkey ON public.folders USING btree (id)
    
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
    


