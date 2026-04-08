-- ============================================================
-- Two-tier role model: club-level roles + team_members junction
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. Create team_members table ─────────────────────────
create table if not exists team_members (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid references clubs(id)      on delete cascade not null,
  team_id    uuid references teams(id)      on delete cascade not null,
  user_id    uuid references auth.users(id) on delete cascade not null,
  role       text not null default 'coach',  -- 'coach' | 'player'
  created_at timestamptz default now(),
  unique(team_id, user_id)
);

-- ── 2. Migrate existing team assignments ─────────────────
-- Anyone who had a team_id on club_members gets a team_members row.
-- ON CONFLICT DO NOTHING is safe to re-run.
insert into team_members (club_id, team_id, user_id, role)
select club_id, team_id, user_id, 'coach'
from   club_members
where  team_id is not null
on conflict do nothing;

-- ── 3. Rename 'member' role → 'coach' on club_members ────
update club_members set role = 'coach' where role = 'member';

-- ── 4. Drop team_id from club_members and profiles ───────
alter table club_members drop column if exists team_id;
alter table profiles     drop column if exists team_id;

-- ── 5. RLS: team_members ─────────────────────────────────
alter table team_members enable row level security;

drop policy if exists "team_members: read own"       on team_members;
drop policy if exists "team_members: owner read"     on team_members;
drop policy if exists "team_members: self insert"    on team_members;
drop policy if exists "team_members: owner insert"   on team_members;
drop policy if exists "team_members: delete"         on team_members;

-- Users can read their own memberships
create policy "team_members: read own"
  on team_members for select
  using (user_id = auth.uid());

-- Club owners/admins can read all memberships in their club
create policy "team_members: owner read"
  on team_members for select
  using (
    exists (
      select 1 from club_members
      where club_members.club_id = team_members.club_id
        and club_members.user_id = auth.uid()
        and club_members.role in ('owner', 'admin')
    )
  );

-- Users can join a team themselves (code-based self-join)
create policy "team_members: self insert"
  on team_members for insert
  with check (user_id = auth.uid());

-- Club owners/admins can add anyone to a team in their club
create policy "team_members: owner insert"
  on team_members for insert
  with check (
    exists (
      select 1 from club_members
      where club_members.club_id = team_members.club_id
        and club_members.user_id = auth.uid()
        and club_members.role in ('owner', 'admin')
    )
  );

-- Users can leave a team; owners/admins can remove anyone
create policy "team_members: delete"
  on team_members for delete
  using (
    user_id = auth.uid()
    or exists (
      select 1 from club_members
      where club_members.club_id = team_members.club_id
        and club_members.user_id = auth.uid()
        and club_members.role in ('owner', 'admin')
    )
  );

-- ── 6. Update live_sessions RLS ──────────────────────────
-- Old policy used club_members.team_id (now removed).
-- New policy checks team_members + club owner branch.

drop policy if exists "live_sessions: team member read" on live_sessions;

create policy "live_sessions: team member read"
  on live_sessions for select
  using (
    -- Host always sees their own session
    host_user_id = auth.uid()
    -- Team members see sessions for their teams
    or exists (
      select 1 from team_members
      where team_members.team_id = live_sessions.team_id
        and team_members.user_id = auth.uid()
    )
    -- Club owners/admins see all sessions across all their teams
    or exists (
      select 1 from club_members cm
      join   teams t on t.club_id = cm.club_id
      where  t.id = live_sessions.team_id
        and  cm.user_id = auth.uid()
        and  cm.role in ('owner', 'admin')
    )
  );

-- ── 7. Update club_members RLS ───────────────────────────
-- Owners need to read all club_members (not just their own row)
-- so they can display membership lists and manage teams.

drop policy if exists "club_members: read own"   on club_members;
drop policy if exists "club_members: insert own" on club_members;

-- Users can always read their own row
create policy "club_members: read own"
  on club_members for select
  using (user_id = auth.uid());

-- Club owners/admins can read all members in their club
create policy "club_members: owner read"
  on club_members for select
  using (
    exists (
      select 1 from club_members cm2
      where cm2.club_id = club_members.club_id
        and cm2.user_id = auth.uid()
        and cm2.role in ('owner', 'admin')
    )
  );

-- Users can insert their own membership (self-join flow)
create policy "club_members: insert own"
  on club_members for insert
  with check (user_id = auth.uid());
