    create table public.notifications (
      id uuid default uuid_generate_v4() primary key,
      user_id uuid references auth.users not null,
      actor_id uuid references auth.users,
      type text not null,
      data jsonb,
      read boolean default false,
      created_at timestamp with time zone default timezone('utc'::text, now()),
      message text
    );

    -- Create index for faster queries
    create index notifications_user_id_idx on public.notifications(user_id);
