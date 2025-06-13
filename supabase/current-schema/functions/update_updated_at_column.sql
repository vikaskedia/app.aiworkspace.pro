CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';



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

    -- Function: get_assignees_for_accessible_matters
    CREATE OR REPLACE FUNCTION get_assignees_for_accessible_matters(user_uuid uuid)
    RETURNS TABLE (
      id uuid,
      email text
    ) AS $$
    BEGIN
      RETURN QUERY
      WITH accessible_matters AS (
        SELECT DISTINCT matters.id AS matter_id
        FROM matters
        INNER JOINworkspace_access ON matters.id =workspace_access.matter_id
        WHEREworkspace_access.shared_with_user_id = user_uuid
          AND matters.deleted = false
      ),
      assignees AS (
        SELECT DISTINCT tasks.assignee
        FROM tasks
        WHERE tasks.matter_id IN (SELECT matter_id FROM accessible_matters)
          AND tasks.assignee IS NOT NULL
          AND tasks.deleted = false
      )
      SELECT DISTINCT auth_users.id, auth_users.email::text
      FROM auth.users auth_users
      WHERE auth_users.id IN (SELECT assignee FROM assignees)
      ORDER BY auth_users.email::text;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION get_task_total_hours(task_id BIGINT)
RETURNS NUMERIC AS $$
BEGIN
    RETURN COALESCE(
        (SELECT SUM(hours)
         FROM task_hours_logs
         WHERE task_id = $1),
        0
    );
END;
$$ LANGUAGE plpgsql;

-- First drop any existing versions of the function
DROP FUNCTION IF EXISTS get_recent_tasks_with_activity(uuid);
DROP FUNCTION IF EXISTS get_recent_tasks_with_activity(bigint);

-- Create the correct version
CREATE OR REPLACE FUNCTION get_recent_tasks_with_activity(p_matter_id bigint)
RETURNS TABLE (
    id bigint,
    title text,
    description text,
    status text,
    priority text,
    assignee uuid,
    due_date timestamp with time zone,
    matter_id bigint,
    created_by uuid,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent_task_id bigint,
    deleted boolean,
    deleted_by uuid,
    deleted_at timestamp with time zone,
    edit_history jsonb,
    log_hours bigint,
    latest_activity_time timestamp with time zone
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.title,
        t.description,
        t.status,
        t.priority,
        t.assignee,
        t.due_date,
        t.matter_id,
        t.created_by,
        t.created_at,
        t.updated_at,
        t.parent_task_id,
        t.deleted,
        t.deleted_by,
        t.deleted_at,
        t.edit_history,
        COALESCE(CAST(SUM(EXTRACT(EPOCH FROM thl.time_taken)/3600) AS bigint), 0) as log_hours,
        GREATEST(
            t.created_at, 
            COALESCE(MAX(c.created_at), t.created_at),
            COALESCE(MAX(thl.created_at), t.created_at),
            COALESCE(t.updated_at, t.created_at)
        ) as latest_activity_time
    FROM tasks t
    LEFT JOIN task_comments c ON t.id = c.task_id AND NOT c.archived
    LEFT JOIN task_hours_logs thl ON t.id = thl.task_id
    WHERE t.matter_id = p_matter_id
    AND t.deleted = false
    GROUP BY 
        t.id, t.title, t.description, t.status, t.priority, t.assignee,
        t.due_date, t.matter_id, t.created_by, t.created_at, t.updated_at,
        t.parent_task_id, t.deleted, t.deleted_by, t.deleted_at,
        t.edit_history
    ORDER BY latest_activity_time DESC
    LIMIT 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;