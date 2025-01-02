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
        INNER JOIN matter_access ON matters.id = matter_access.matter_id
        WHERE matter_access.shared_with_user_id = user_uuid
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