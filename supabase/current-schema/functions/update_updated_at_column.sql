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
