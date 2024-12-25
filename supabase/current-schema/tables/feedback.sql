create table feedback_topics (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text not null,
  created_by uuid references auth.users not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

COMMENT ON TABLE feedback_topics IS 'Feedback topics are created by users and can be replied to by anyone who has access to the user feedback system';

create table feedback_replies (
  id uuid default uuid_generate_v4() primary key,
  topic_id uuid references feedback_topics not null,
  content text not null,
  created_by uuid references auth.users not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table feedback_system_admins (
  user_id uuid references auth.users not null primary key,
  granted_by uuid references auth.users not null,
  granted_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add comment explaining the table's purpose
COMMENT ON TABLE feedback_system_admins IS 'Stores users who have administrative access to the feedback system. These users can view and reply to all feedback topics.';

-- Enable RLS
ALTER TABLE feedback_system_admins ENABLE ROW LEVEL SECURITY;

-- Create policy for viewing admins
CREATE POLICY "Anyone can view feedback admins" ON feedback_system_admins
FOR SELECT USING (true);

-- Create policy for adding/removing admins (only existing admins can manage other admins)
CREATE POLICY "Only feedback admins can manage other admins" ON feedback_system_admins
FOR ALL USING (
  auth.uid() IN (
    SELECT user_id FROM feedback_system_admins
  )
);

-- Create index for faster lookups
CREATE INDEX feedback_system_admins_granted_by_idx ON feedback_system_admins(granted_by);

