create table public.faxes (
  id bigserial primary key,
  workspace_id bigint references public.workspaces(id) on delete cascade,
  direction text not null check (direction in ('outbound', 'inbound')),
  date timestamptz not null default now(),
  from_number text not null,
  to_number text not null,
  subject text,
  status text not null,
  file_url text,
  file_name text,
  gitea_download_url text,
  gitea_response jsonb,
  pages integer,
  telnyx_id text,
  event_time timestamptz default now(),
  client_timezone text,
  status_reason text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_faxes_workspace_id on public.faxes (workspace_id);
create index idx_faxes_direction on public.faxes (direction);
create index IF NOT EXISTS idx_faxes_date on public.faxes (date desc);
create index IF NOT EXISTS idx_faxes_workspace_date on public.faxes (workspace_id, date desc);
create index IF NOT EXISTS idx_faxes_status on public.faxes (status);

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