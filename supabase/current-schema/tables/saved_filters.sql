create table saved_filters (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  filter_name text not null,
  filters jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add RLS policies
alter table saved_filters enable row level security;

create policy "Users can manage their own filters"
  on saved_filters
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);