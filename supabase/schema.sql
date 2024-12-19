-- this file stores the current schema after all the migrations have been applied

/* 

--------------------- 1/2: Command to generate the scheme from supabase sql editor

SELECT string_agg(table_definition || E'\n\n', '')
FROM (
  SELECT format(
    $fmt$
    ----------- TABLE: %I
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


------------------  2/2: For functions and triggers, add this additional query:

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



    ---------------------- TABLE: events ------------------------------
    CREATE TABLE events (
      end_time timestamp with time zone NOT NULL,
      start_time timestamp with time zone NOT NULL,
      event_type text NOT NULL,
      description text,
      title text NOT NULL,
      id bigint NOT NULL,
      created_at timestamp with time zone,
      created_by uuid,
      matter_id bigint,
      attendees jsonb,
      location text,
      updated_at timestamp with time zone
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
    


    ---------------------- TABLE: file_content ------------------------------
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
    


    ---------------------- TABLE: file_meta ------------------------------
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
    -- No policies
    


    ---------------------- TABLE: folders ------------------------------ 
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
    -- No policies
    


-------------------- TABLE: GOALS --------------------------
    CREATE TABLE goals (
      created_at timestamp with time zone DEFAULT now() NOT NULL,
      updated_at timestamp with time zone DEFAULT now() NOT NULL,
      created_by uuid,
      related_files jsonb,
      matter_id bigint,
      id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      title character varying NOT NULL,
      description text,
      status character varying,
      priority character varying,
      due_date timestamp with time zone
    );
    
    -- Indexes for goals
    CREATE INDEX goals_created_by_idx ON public.goals USING btree (created_by);
    CREATE INDEX goals_status_idx ON public.goals USING btree (status); 
    CREATE INDEX goals_due_date_idx ON public.goals USING btree (due_date);
    CREATE INDEX goals_matter_id_idx ON public.goals USING btree (matter_id);
    
    -- RLS for goals
    ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
    
    -- Policies for goals
    CREATE POLICY "Users can delete their own goals" ON goals FOR DELETE USING (((auth.uid() = created_by) AND (matter_id IN ( SELECT matters.id
   FROM matters
  WHERE (matters.created_by = auth.uid())))));
    CREATE POLICY "Users can update their own goals" ON goals FOR UPDATE USING (((auth.uid() = created_by) AND (matter_id IN ( SELECT matters.id
   FROM matters
  WHERE (matters.created_by = auth.uid())))));
    CREATE POLICY "Users can view their own goals" ON goals FOR SELECT USING (((auth.uid() = created_by) AND (matter_id IN ( SELECT matters.id
   FROM matters
  WHERE (matters.created_by = auth.uid())))));
CREATE POLICY "Users can create goals in their matters" 
ON goals 
FOR INSERT 
WITH CHECK (
  matter_id IN (
    SELECT id 
    FROM matters 
    WHERE created_by = auth.uid()
  )
);    


    -------------------------------  TABLE: matter_shares ------------------------------
    CREATE TABLE matter_shares (
      matter_id bigint,
      id bigint NOT NULL,
      created_at timestamp with time zone NOT NULL,
      created_by uuid,
      access_type character varying NOT NULL,
      shared_with_user_id uuid
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
    


------------------------ Create the matters table ------------------------------
CREATE TABLE matters (
    id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    title character varying NOT NULL,
    description text,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX matters_created_by_idx ON matters USING btree (created_by);

-- Enable Row Level Security
ALTER TABLE matters ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
CREATE POLICY "Users can create matters" 
    ON matters FOR INSERT 
    WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can view their own matters" 
    ON matters FOR SELECT 
    USING (auth.uid() = created_by);

CREATE POLICY "Users can update their own matters" 
    ON matters FOR UPDATE 
    USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own matters" 
    ON matters FOR DELETE 
    USING (auth.uid() = created_by);

-- Create trigger for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_matters_updated_at
    BEFORE UPDATE ON matters
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
    


------------------------------  TABLE: tasks ------------------------------
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
    


    -- Function: get_user_id_by_email
    CREATE OR REPLACE FUNCTION public.get_user_id_by_email(email_address text)
 RETURNS uuid
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id 
  FROM auth.users 
  WHERE email = email_address;
$function$

    
    -- Triggers using get_user_id_by_email
    -- No triggers
    


------------ Function: get_user_info_by_email
    CREATE OR REPLACE FUNCTION public.get_user_info_by_email(email_address text)
 RETURNS TABLE(id uuid, email text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id, email
  FROM auth.users 
  WHERE email = email_address;
$function$

    
    -- Triggers using get_user_info_by_email
    -- No triggers
    

/*

Supabase doesn't allow direct queries to auth.users from the client for security reasons. Instead, you'll need to use the Admin API or create a serverless function/API endpoint to handle this operation.
Here's a more secure approach using Supabase's built-in RLS policies:
Create a new migration to add a function that safely handles user lookup:
*/

    -- Function: get_user_info_by_id
    CREATE OR REPLACE FUNCTION public.get_user_info_by_id(user_id uuid)
 RETURNS TABLE(id uuid, email text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id, email
  FROM auth.users 
  WHERE id = user_id;
$function$

    
    -- Triggers using get_user_info_by_id
    -- No triggers
    


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
    

