-- Corrective policy reset for team-scoped data.
--
-- The first team-scope migration drops known policy names. Some environments
-- can still have older policies under different names, so this migration
-- removes every policy on the affected tables before recreating the intended
-- policy set. This must run after 20260617000200_team_scoped_data_and_rls.sql because
-- the recreated match/squad policies reference the team_id columns added there.

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

do $$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('teams', 'live_sessions', 'matches', 'squad')
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  end loop;
end $$;

alter table teams enable row level security;
alter table live_sessions enable row level security;
alter table matches enable row level security;
alter table squad enable row level security;

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
