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

create table system_admins (
  user_id uuid references auth.users not null primary key,
  granted_by uuid references auth.users not null,
  granted_at timestamp with time zone default timezone('utc'::text, now()) not null
);

COMMENT ON TABLE system_admins IS 'Stores users who have administrative access to the feedback system. These users can view and reply to all feedback topics.';

--Create a View: Define a view that lists all admin users. This view will be used in the policy to avoid recursion.

CREATE OR REPLACE VIEW admin_users AS
SELECT user_id FROM system_admins;

--Create the Policies: Use the view in the policies to check if the user is an admin.

-- Policy for selecting data
CREATE POLICY "Admins can view all entries" ON system_admins 
FOR SELECT 
TO authenticated 
USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- Policy for inserting data
CREATE POLICY "Admins can insert entries" ON system_admins 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() IN (SELECT user_id FROM admin_users));

-- Policy for updating data
CREATE POLICY "Admins can update any entry" ON system_admins 
FOR UPDATE 
TO authenticated 
USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- Policy for deleting data
CREATE POLICY "Admins can delete any entry" ON system_admins 
FOR DELETE 
TO authenticated 
USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- Create index for faster lookups
CREATE INDEX system_admins_granted_by_idx ON system_admins(granted_by);

