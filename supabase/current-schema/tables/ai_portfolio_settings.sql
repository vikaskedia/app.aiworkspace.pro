-- AI Portfolio Settings table for storing user view mode preferences
create table ai_portfolio_settings (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  matter_id bigint references workspaces(id) on delete cascade not null,
  portfolio_id text not null,
  view_mode boolean not null default true, -- false = edit mode, true = readonly mode (default)
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, matter_id, portfolio_id)
);

comment on table ai_portfolio_settings is 'Stores user-specific view mode preferences for AI Portfolio Manager.
Each record represents a user''s preference for a specific portfolio within a workspace:
1. user_id: The user who owns this preference
2. matter_id: The workspace/matter this preference applies to
3. portfolio_id: The specific portfolio/tab this preference applies to
4. view_mode: false = edit mode, true = readonly mode (default when no preference exists)
5. Standard audit fields (created_at, updated_at)';

comment on column ai_portfolio_settings.view_mode is 'View mode preference: false = edit mode (user can edit), true = readonly mode (user cannot edit). Defaults to readonly mode when no preference is saved.';

-- Add indexes for better performance
create index idx_ai_portfolio_settings_user_id on ai_portfolio_settings(user_id);
create index idx_ai_portfolio_settings_matter_id on ai_portfolio_settings(matter_id);
create index idx_ai_portfolio_settings_portfolio_id on ai_portfolio_settings(portfolio_id);
create index idx_ai_portfolio_settings_composite on ai_portfolio_settings(user_id, matter_id, portfolio_id);

-- Enable RLS (Row Level Security)
alter table ai_portfolio_settings enable row level security;

-- Policies for ai_portfolio_settings
create policy "Users can view their own portfolio settings" on ai_portfolio_settings
  for select using (auth.uid() = user_id);

create policy "Users can create their own portfolio settings" on ai_portfolio_settings
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own portfolio settings" on ai_portfolio_settings
  for update using (auth.uid() = user_id);

create policy "Users can delete their own portfolio settings" on ai_portfolio_settings
  for delete using (auth.uid() = user_id); 