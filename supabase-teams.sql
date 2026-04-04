-- ============================================================
-- GAA Stats — Teams + Live Sessions schema
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── Teams ─────────────────────────────────────────────────
create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  club_id uuid references clubs(id) on delete cascade not null,
  name text not null,
  code char(6) unique not null,
  created_at timestamptz default now()
);

-- ── Live sessions (Club Pro real-time sharing) ─────────────
create table if not exists live_sessions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade not null,
  host_user_id uuid references auth.users(id) not null,
  match_data jsonb,
  started_at timestamptz default now(),
  ended_at timestamptz
);

-- ── Add team_id to existing tables ────────────────────────
alter table profiles add column if not exists team_id uuid references teams(id);
alter table club_members add column if not exists team_id uuid references teams(id);

-- ── RLS: teams ────────────────────────────────────────────
alter table teams enable row level security;

drop policy if exists "teams: authenticated read" on teams;
drop policy if exists "teams: owner insert"       on teams;
drop policy if exists "teams: owner update"       on teams;
drop policy if exists "teams: owner delete"       on teams;

-- Any authenticated user can read teams (needed for code lookup at join)
create policy "teams: authenticated read"
  on teams for select
  using (auth.role() = 'authenticated');

create policy "teams: owner insert"
  on teams for insert
  with check (
    exists (select 1 from clubs where clubs.id = teams.club_id and clubs.owner_id = auth.uid())
  );

create policy "teams: owner update"
  on teams for update
  using (
    exists (select 1 from clubs where clubs.id = teams.club_id and clubs.owner_id = auth.uid())
  );

create policy "teams: owner delete"
  on teams for delete
  using (
    exists (select 1 from clubs where clubs.id = teams.club_id and clubs.owner_id = auth.uid())
  );

-- ── RLS: live_sessions ────────────────────────────────────
alter table live_sessions enable row level security;

drop policy if exists "live_sessions: team member read" on live_sessions;
drop policy if exists "live_sessions: host insert"      on live_sessions;
drop policy if exists "live_sessions: host update"      on live_sessions;

create policy "live_sessions: team member read"
  on live_sessions for select
  using (
    exists (
      select 1 from club_members
      where club_members.team_id = live_sessions.team_id
        and club_members.user_id = auth.uid()
    )
    or host_user_id = auth.uid()
  );

create policy "live_sessions: host insert"
  on live_sessions for insert
  with check (auth.uid() = host_user_id);

create policy "live_sessions: host update"
  on live_sessions for update
  using (auth.uid() = host_user_id);

-- ── delete_own_account helper ─────────────────────────────
create or replace function delete_own_account()
returns void
language plpgsql
security definer
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;
