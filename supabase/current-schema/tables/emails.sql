create table if not exists public.emails (
    id uuid default gen_random_uuid() primary key,
    from_address text,
    to_address text,
    cc text,
    bcc text,
    subject text,
    text_content text,
    html_content text,
    received_date timestamp with time zone,
    created_at timestamp with time zone default now(),
    processed boolean default false,
    attachments jsonb default '[]'::jsonb
);

-- Add RLS policies
alter table public.emails enable row level security;

create policy "Enable insert access for all users"
    on public.emails for insert
    to authenticated
    with check (true);

create policy "Enable select access for all users"
    on public.emails for select
    to authenticated
    using (true);