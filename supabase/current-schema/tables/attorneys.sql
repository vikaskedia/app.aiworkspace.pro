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


create policy "Only system admins can create attorneys"
  on attorneys for insert
  to authenticated
  with check ((created_by IN ( SELECT system_admins.user_id
   FROM system_admins)) AND (created_by = auth.uid()));

create policy "Only system admins can update an attorney"
  on attorneys for update
  to authenticated
  using (auth.uid() IN ( SELECT system_admins.user_id
   FROM system_admins));

create policy "Only system admins can delete an attorney"
  on attorneys for delete
  to authenticated
  using (auth.uid() IN ( SELECT system_admins.user_id
   FROM system_admins)); 
