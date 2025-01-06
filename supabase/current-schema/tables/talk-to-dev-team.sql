-- The menu options will be called "talk to dev team" 
-- The tables instead of being called "feedback" will be called "talktodevteam_topics" and "talktodevteam_replies"

create table talktodevteam_topics (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text not null,
  created_by uuid references auth.users not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
  -- also allow file uploads and files will be stored here in the table.
);

COMMENT ON TABLE talktodevteam_topics IS 'Feedback topics are created by users and can be replied to by anyone who has access to the user feedback system';

create table talktodevteam_replies (
  id uuid default uuid_generate_v4() primary key,
  topic_id uuid references talktodevteam_topics not null,
  content text not null,
  created_by uuid references auth.users not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
  -- also allow file uploads and files will be stored here in the table.
);

create table talktodevteam_system_admins (
  user_id uuid references auth.users not null primary key,
  granted_by uuid references auth.users not null,
  granted_at timestamp with time zone default timezone('utc'::text, now()) not null
);

COMMENT ON TABLE talktodevteam_system_admins IS 'Stores users who have administrative access to the feedback system. These users can view and reply to all feedback topics.';

-- Enable RLS
ALTER TABLE talktodevteam_system_admins ENABLE ROW LEVEL SECURITY;

-- Create policy for viewing admins
CREATE POLICY "Anyone can view feedback admins" ON talktodevteam_system_admins
FOR SELECT USING (true);

CREATE POLICY "Admin management policy" ON talktodevteam_system_admins
FOR ALL USING (
  CASE 
    -- Allow if table is empty (first admin)
    WHEN NOT EXISTS (SELECT 1 FROM talktodevteam_system_admins) THEN true
    -- Otherwise check if user is an admin
    ELSE auth.uid() IN (SELECT user_id FROM talktodevteam_system_admins)
  END
);

-- Create index for faster lookups
CREATE INDEX talktodevteam_system_admins_granted_by_idx ON talktodevteam_system_admins(granted_by);

