create table public.faxes (
  id bigserial primary key,
  workspace_id bigint references public.workspaces(id) on delete cascade,
  direction text not null check (direction in ('outbound', 'inbound')),
  date timestamptz not null default now(),

  -- caller/recipient
  from_number text not null,
  to_number text not null,
  subject text,

  -- status & delivery
  status text not null,
  status_reason text,

  -- storage / file access
  file_url text,                     -- public or signed URL used to fetch the file
  file_name text,
  storage_bucket text,               -- e.g. 'faxes'
  storage_path text,                 -- object path inside bucket
  storage_metadata jsonb,            -- upload response (size, contentType, etc.)
  storage_is_public boolean default false,
  signed_url_expires_at timestamptz, -- if a signed URL was generated, its expiry

  -- telnyx / transport
  telnyx_id text,
  connection_id text,
  pages integer,

  -- misc
  client_timezone text,
  metadata jsonb,                    -- arbitrary app metadata

  event_time timestamptz default now(),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index idx_faxes_workspace_id on public.faxes (workspace_id);
create index idx_faxes_direction on public.faxes (direction);
create index if not exists idx_faxes_date on public.faxes (date desc);
create index if not exists idx_faxes_workspace_date on public.faxes (workspace_id, date desc);
create index if not exists idx_faxes_status on public.faxes (status);
create index if not exists idx_faxes_connection_id on public.faxes (connection_id);

-- trigger to keep updated_at in sync
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_update_faxes_updated_at on public.faxes;
create trigger trg_update_faxes_updated_at
before update on public.faxes
for each row
execute procedure public.update_updated_at_column();