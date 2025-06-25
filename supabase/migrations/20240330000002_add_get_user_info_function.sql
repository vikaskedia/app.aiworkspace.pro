-- Drop existing function if it exists to avoid return type conflicts
DROP FUNCTION IF EXISTS get_user_info_for_matter(UUID[], BIGINT);

-- Create a function to get user information for team members within the same matter
CREATE FUNCTION get_user_info_for_matter(user_ids UUID[], matter_id_param BIGINT)
RETURNS TABLE (
  user_id UUID,
  email character varying(255),
  display_name TEXT
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only return user info if the requesting user has access to the matter
  IF NOT EXISTS (
    SELECT 1 FROM workspace_access 
    WHERE matter_id = matter_id_param 
    AND shared_with_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: You do not have access to this matter';
  END IF;
  
  -- Return user information for users who also have access to the same matter
  RETURN QUERY
  SELECT 
    au.id as user_id,
    au.email,
    COALESCE(
      SPLIT_PART(au.email::TEXT, '@', 1), -- Cast to TEXT and use email prefix as display name
      'Unknown User'
    )::TEXT as display_name
  FROM auth.users au
  WHERE au.id = ANY(user_ids)
  AND EXISTS (
    -- Only return info for users who have access to the same matter
    SELECT 1 FROM workspace_access wa
    WHERE wa.matter_id = matter_id_param
    AND wa.shared_with_user_id = au.id
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_info_for_matter(UUID[], BIGINT) TO authenticated; 