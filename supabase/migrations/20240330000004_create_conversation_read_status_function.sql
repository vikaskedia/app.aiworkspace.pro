-- Function to get conversation unread counts for a specific user
CREATE OR REPLACE FUNCTION get_conversation_unread_counts_for_user(
  user_id_param UUID,
  workspace_id_param INTEGER
)
RETURNS TABLE (
  conversation_id UUID,
  unread_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as conversation_id,
    COALESCE(
      (SELECT COUNT(*) 
       FROM messages m 
       WHERE m.conversation_id = c.id 
       AND m.created_at > COALESCE(crs.last_read_at, '1970-01-01'::timestamp)
       AND m.direction = 'inbound'), 
      0
    ) as unread_count
  FROM conversations c
  LEFT JOIN conversation_read_status crs 
    ON c.id = crs.conversation_id 
    AND crs.user_id = user_id_param
  WHERE c.workspace_id = workspace_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_conversation_unread_counts_for_user(UUID, INTEGER) TO authenticated;

-- Function to mark conversation as read for a specific user
CREATE OR REPLACE FUNCTION mark_conversation_as_read_for_user(
  conversation_id_param UUID,
  user_id_param UUID,
  workspace_id_param INTEGER
)
RETURNS VOID AS $$
BEGIN
  -- Insert or update the read status
  INSERT INTO conversation_read_status (
    conversation_id, 
    user_id, 
    workspace_id, 
    last_read_at, 
    is_read
  ) VALUES (
    conversation_id_param,
    user_id_param,
    workspace_id_param,
    NOW(),
    true
  )
  ON CONFLICT (conversation_id, user_id)
  DO UPDATE SET
    last_read_at = NOW(),
    is_read = true,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION mark_conversation_as_read_for_user(UUID, UUID, INTEGER) TO authenticated; 