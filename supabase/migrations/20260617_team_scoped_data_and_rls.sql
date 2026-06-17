-- Team-scoped local data and tighter membership-aware policies.
--
-- Matches and squad remain user-owned, but they can now be tagged with the
-- active team so one coach's data is separated per team in sync and local IDB.

alter table matches
  add column if not exists team_id uuid references teams(id) on delete set null;

alter table squad
  add column if not exists team_id uuid references teams(id) on delete set null;

-- Match ids are generated locally, so conflict handling must be scoped to the
-- owner in the same way as squad rows.
alter table matches drop constraint if exists matches_pkey;

alter table matches
  add constraint matches_pkey primary key (id, user_id);

create index if not exists idx_matches_user_team
  on matches(user_id, team_id);

create index if not exists idx_squad_user_team
  on squad(user_id, team_id);

create index if not exists idx_team_members_team_user
  on team_members(team_id, user_id);

create index if not exists idx_club_members_club_user
  on club_members(club_id, user_id);

create index if not exists idx_subscriptions_club_status
  on subscriptions(club_id, status);

-- Best-effort backfill for rows created by newer clients before this migration
-- reached production. Legacy personal rows intentionally remain null.
update matches
set team_id = (data->>'teamId')::uuid
where team_id is null
  and data ? 'teamId'
  and (data->>'teamId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

update squad
set team_id = (data->>'teamId')::uuid
where team_id is null
  and data ? 'teamId'
  and (data->>'teamId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

create or replace function public.is_club_admin(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and (
      exists (
        select 1
        from clubs c
        where c.id = p_club_id
          and c.owner_id = auth.uid()
      )
      or exists (
        select 1
        from club_members cm
        where cm.club_id = p_club_id
          and cm.user_id = auth.uid()
          and cm.role in ('owner', 'admin')
      )
    );
$$;

create or replace function public.can_access_team(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from teams t
      where t.id = p_team_id
        and (
          exists (
            select 1
            from team_members tm
            where tm.team_id = t.id
              and tm.user_id = auth.uid()
          )
          or public.is_club_admin(t.club_id)
        )
    );
$$;

create or replace function public.can_start_live_session(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_access_team(p_team_id)
    and exists (
      select 1
      from teams t
      join subscriptions s on s.club_id = t.club_id
      where t.id = p_team_id
        and s.status in ('active', 'trialing')
        and (
          s.plan = 'club_pro'
          or coalesce(s.custom_features->>'isClubPro', 'false') = 'true'
        )
    );
$$;

revoke all on function public.is_club_admin(uuid) from public;
revoke all on function public.can_access_team(uuid) from public;
revoke all on function public.can_start_live_session(uuid) from public;

grant execute on function public.is_club_admin(uuid) to authenticated;
grant execute on function public.can_access_team(uuid) to authenticated;
grant execute on function public.can_start_live_session(uuid) to authenticated;

-- Teams are no longer broadly readable by every authenticated account. Joining
-- by code goes through the security-definer join_team_with_code RPC.
alter table teams enable row level security;

drop policy if exists "teams: authenticated read" on teams;
drop policy if exists "teams: member read" on teams;
drop policy if exists "teams: owner insert" on teams;
drop policy if exists "teams: owner update" on teams;
drop policy if exists "teams: owner delete" on teams;

create policy "teams: member read"
  on teams for select
  using (public.can_access_team(id));

create policy "teams: owner insert"
  on teams for insert
  with check (public.is_club_admin(club_id));

create policy "teams: owner update"
  on teams for update
  using (public.is_club_admin(club_id))
  with check (public.is_club_admin(club_id));

create policy "teams: owner delete"
  on teams for delete
  using (public.is_club_admin(club_id));

-- Live sharing is visible only to team members/club admins and can only be
-- started by a Club Pro account for that team.
alter table live_sessions enable row level security;

drop policy if exists "live_sessions: team member read" on live_sessions;
drop policy if exists "live_sessions: host insert" on live_sessions;
drop policy if exists "live_sessions: host update" on live_sessions;

create policy "live_sessions: team member read"
  on live_sessions for select
  using (
    host_user_id = auth.uid()
    or public.can_access_team(team_id)
  );

create policy "live_sessions: host insert"
  on live_sessions for insert
  with check (
    host_user_id = auth.uid()
    and public.can_start_live_session(team_id)
  );

create policy "live_sessions: host update"
  on live_sessions for update
  using (
    host_user_id = auth.uid()
    and public.can_access_team(team_id)
  )
  with check (
    host_user_id = auth.uid()
    and public.can_access_team(team_id)
  );

-- User-owned data stays private, but team_id must be either personal/null or a
-- team the user can access. This prevents one user from tagging private data
-- onto an arbitrary club/team.
alter table matches enable row level security;

drop policy if exists "matches: own read" on matches;
drop policy if exists "matches: own insert" on matches;
drop policy if exists "matches: own update" on matches;
drop policy if exists "matches: own delete" on matches;

create policy "matches: own read"
  on matches for select
  using (user_id = auth.uid());

create policy "matches: own insert"
  on matches for insert
  with check (
    user_id = auth.uid()
    and (team_id is null or public.can_access_team(team_id))
  );

create policy "matches: own update"
  on matches for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (team_id is null or public.can_access_team(team_id))
  );

create policy "matches: own delete"
  on matches for delete
  using (user_id = auth.uid());

alter table squad enable row level security;

drop policy if exists "squad: own read" on squad;
drop policy if exists "squad: own insert" on squad;
drop policy if exists "squad: own update" on squad;
drop policy if exists "squad: own delete" on squad;

create policy "squad: own read"
  on squad for select
  using (user_id = auth.uid());

create policy "squad: own insert"
  on squad for insert
  with check (
    user_id = auth.uid()
    and (team_id is null or public.can_access_team(team_id))
  );

create policy "squad: own update"
  on squad for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (team_id is null or public.can_access_team(team_id))
  );

create policy "squad: own delete"
  on squad for delete
  using (user_id = auth.uid());
