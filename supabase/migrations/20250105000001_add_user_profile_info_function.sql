-- Migration: Add function to get complete user profile information including avatars
-- This enables custom user icons in task status cells

-- Create function to get user information with profile picture URLs
CREATE OR REPLACE FUNCTION get_user_full_info_by_id(user_id UUID)
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  username TEXT,
  avatar_url TEXT,
  profile_icon_url TEXT
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Return complete user information including both avatar URLs
  RETURN QUERY
  SELECT 
    au.id,
    au.email::TEXT,
    COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', '')::TEXT as full_name,
    COALESCE(au.raw_user_meta_data->>'user_name', au.raw_user_meta_data->>'username', SPLIT_PART(au.email::TEXT, '@', 1))::TEXT as username,
    COALESCE(au.raw_user_meta_data->>'avatar_url', '')::TEXT as avatar_url,
    COALESCE(au.raw_user_meta_data->>'profile_icon_url', '')::TEXT as profile_icon_url
  FROM auth.users au
  WHERE au.id = user_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_full_info_by_id(UUID) TO authenticated;

-- Add comment to document the function
COMMENT ON FUNCTION get_user_full_info_by_id(UUID) IS 'Returns complete user profile information including both avatar_url (large profile picture) and profile_icon_url (small icon for UI elements like task status cells)';