CREATE TABLE phone_text_message_actions (
  id BIGSERIAL PRIMARY KEY,
  matter_id BIGINT NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
  action_name TEXT NOT NULL,
  post_url TEXT NOT NULL,
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
); 