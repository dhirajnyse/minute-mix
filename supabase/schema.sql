create table if not exists public.play_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  played_at timestamptz not null default now(),
  mode text not null check (mode in ('daily', 'practice', 'duel', 'host')),
  score smallint not null check (score between 0 and 1000),
  correct smallint not null check (correct between 0 and 5),
  seed text not null default '',
  target smallint,
  rounds jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, client_id)
);

alter table public.play_history enable row level security;

grant select, insert, update, delete on table public.play_history to authenticated;

drop policy if exists "Users can read own history" on public.play_history;
create policy "Users can read own history"
on public.play_history for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own history" on public.play_history;
create policy "Users can insert own history"
on public.play_history for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own history" on public.play_history;
create policy "Users can update own history"
on public.play_history for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own history" on public.play_history;
create policy "Users can delete own history"
on public.play_history for delete
to authenticated
using ((select auth.uid()) = user_id);

create index if not exists play_history_user_played_at_idx
on public.play_history (user_id, played_at desc);
