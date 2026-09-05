-- Canonical team-owned player identities.
--
-- The legacy squad table stored per-user roster rows with local player ids.
-- New match and future GPS data should reference public.team_players.id.

create table if not exists public.team_players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  display_name text not null,
  default_number integer,
  position text,
  status text not null default 'active',
  joined_at date,
  left_at date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_players_display_name_not_blank check (length(btrim(display_name)) > 0),
  constraint team_players_default_number_range check (
    default_number is null or (default_number >= 1 and default_number <= 99)
  ),
  constraint team_players_status_check check (status in ('active', 'inactive', 'left')),
  constraint team_players_left_after_joined check (
    left_at is null or joined_at is null or left_at >= joined_at
  )
);

create index if not exists idx_team_players_team_status
  on public.team_players(team_id, status);

create index if not exists idx_team_players_team_number
  on public.team_players(team_id, default_number)
  where default_number is not null;

create index if not exists idx_team_players_updated_at
  on public.team_players(updated_at);

alter table public.team_players enable row level security;

drop policy if exists "team_players: team read" on public.team_players;
drop policy if exists "team_players: team insert" on public.team_players;
drop policy if exists "team_players: team update" on public.team_players;
drop policy if exists "team_players: admin delete" on public.team_players;

create policy "team_players: team read"
  on public.team_players for select
  using (public.can_access_team(team_id));

create policy "team_players: team insert"
  on public.team_players for insert
  with check (
    public.can_access_team(team_id)
    and (created_by is null or created_by = auth.uid())
  );

create policy "team_players: team update"
  on public.team_players for update
  using (public.can_access_team(team_id))
  with check (public.can_access_team(team_id));

-- Normal lifecycle is status='inactive'/'left'. Hard delete is limited to club
-- admins so historical match references are not casually invalidated.
create policy "team_players: admin delete"
  on public.team_players for delete
  using (
    exists (
      select 1
      from public.teams t
      where t.id = team_players.team_id
        and public.is_club_admin(t.club_id)
    )
  );
