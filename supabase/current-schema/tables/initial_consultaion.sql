-- Create initial-consultation table
create table initial_consultation (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) not null,
  workspace_id bigint references workspaces(id),
  json_of_interview_qna jsonb not null default '{}',
  plan_accepted_by_user_json jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add RLS policies
alter table initial_consultation enable row level security;

-- Allow users to view their own consultations
create policy "Users can view own consultations"
  on initial_consultation for select
  using (auth.uid() = user_id);

-- Allow users to insert their own consultations
create policy "Users can insert own consultations"
  on initial_consultation for insert
  with check (auth.uid() = user_id);

-- Allow users to update their own consultations
create policy "Users can update own consultations"
  on initial_consultation for update
  using (auth.uid() = user_id);

-- Create updated_at trigger using existing function
CREATE TRIGGER handle_updated_at 
  BEFORE UPDATE ON initial_consultation
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();