create table attorneys (
  id bigint primary key generated always as identity,
  name text not null,
  image_url text,
  video_url text,
  system_prompt text not null,
  specialty text not null,
  jurisdiction text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by uuid references auth.users(id) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table attorneys enable row level security;

-- Policies
create policy "Attorneys are viewable by authenticated users"
  on attorneys for select
  to authenticated
  using (true);

create policy "Attorneys are insertable by authenticated users"
  on attorneys for insert
  to authenticated
  with check (auth.uid() = created_by);

create policy "Attorneys are updatable by creator"
  on attorneys for update
  to authenticated
  using (auth.uid() = created_by);

create policy "Attorneys are deletable by creator"
  on attorneys for delete
  to authenticated
  using (auth.uid() = created_by); 