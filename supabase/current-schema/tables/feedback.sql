create table feedback_topics (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text not null,
  created_by uuid references auth.users not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table feedback_replies (
  id uuid default uuid_generate_v4() primary key,
  topic_id uuid references feedback_topics not null,
  content text not null,
  created_by uuid references auth.users not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);


COMMENT ON TABLE feedback_topics IS 'Feedback topics are created by users and can be replied to by anyone who has access to the user feedback system';