-- GPS privacy/security hardening.
--
-- This migration keeps the local-first GPS architecture intact while tightening
-- future cloud writers and account deletion around the GPS tables.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'gps_latest_assignment_fk'
      and conrelid = 'public.gps_latest'::regclass
  ) then
    alter table public.gps_latest
      add constraint gps_latest_assignment_fk
      foreign key (assignment_id, session_id, tracker_id, team_id, club_id)
      references public.tracker_player_assignments(id, session_id, tracker_id, team_id, club_id)
      on delete cascade;
  end if;
end $$;

revoke insert, update, delete on public.gps_samples from anon, authenticated;
revoke insert, update, delete on public.gps_latest from anon, authenticated;
revoke insert, update, delete on public.gps_player_session_summaries from anon, authenticated;

comment on constraint gps_latest_assignment_fk on public.gps_latest is
  'Prevents latest-state rows from spoofing an assignment UUID that does not belong to the same session, tracker, team, and club.';

comment on table public.tracker_player_assignments is
  'Player GPS identity join table. Future export/deletion/anonymisation should start from team_player_id here rather than player names.';

comment on table public.gps_player_session_summaries is
  'Derived GPS facts keyed by stable team_player_id. Do not cascade player deletion until a policy chooses hard delete versus anonymisation/retention.';

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if coalesce(auth.role(), '') <> 'authenticated' then
    raise exception 'Authentication required';
  end if;

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if to_regclass('public.teams') is not null and to_regclass('public.clubs') is not null then
    if to_regclass('public.gps_samples') is not null then
      execute '
        delete from public.gps_samples gs
        using public.teams t, public.clubs c
        where gs.team_id = t.id
          and t.club_id = c.id
          and c.owner_id = $1
      ' using v_user_id;
    end if;

    if to_regclass('public.gps_latest') is not null then
      execute '
        delete from public.gps_latest gl
        using public.teams t, public.clubs c
        where gl.team_id = t.id
          and t.club_id = c.id
          and c.owner_id = $1
      ' using v_user_id;
    end if;

    if to_regclass('public.gps_player_session_summaries') is not null then
      execute '
        delete from public.gps_player_session_summaries gpss
        using public.teams t, public.clubs c
        where gpss.team_id = t.id
          and t.club_id = c.id
          and c.owner_id = $1
      ' using v_user_id;
    end if;

    if to_regclass('public.tracker_player_assignments') is not null then
      execute '
        delete from public.tracker_player_assignments tpa
        using public.teams t, public.clubs c
        where tpa.team_id = t.id
          and t.club_id = c.id
          and c.owner_id = $1
      ' using v_user_id;
    end if;

    if to_regclass('public.gps_sessions') is not null then
      execute '
        delete from public.gps_sessions gs
        using public.teams t, public.clubs c
        where gs.team_id = t.id
          and t.club_id = c.id
          and c.owner_id = $1
      ' using v_user_id;
    end if;
  end if;

  if to_regclass('public.trackers') is not null and to_regclass('public.clubs') is not null then
    execute '
      delete from public.trackers tr
      using public.clubs c
      where tr.club_id = c.id
        and c.owner_id = $1
    ' using v_user_id;
  end if;

  if to_regclass('public.live_sessions') is not null then
    execute 'delete from public.live_sessions where host_user_id = $1'
      using v_user_id;

    if to_regclass('public.teams') is not null and to_regclass('public.clubs') is not null then
      execute '
        delete from public.live_sessions ls
        using public.teams t, public.clubs c
        where ls.team_id = t.id
          and t.club_id = c.id
          and c.owner_id = $1
      ' using v_user_id;
    end if;
  end if;

  if to_regclass('public.matches') is not null then
    execute 'delete from public.matches where user_id = $1'
      using v_user_id;
  end if;

  if to_regclass('public.squad') is not null then
    execute 'delete from public.squad where user_id = $1'
      using v_user_id;
  end if;

  if to_regclass('public.team_members') is not null then
    execute 'delete from public.team_members where user_id = $1'
      using v_user_id;

    if to_regclass('public.teams') is not null and to_regclass('public.clubs') is not null then
      execute '
        delete from public.team_members tm
        using public.teams t, public.clubs c
        where tm.team_id = t.id
          and t.club_id = c.id
          and c.owner_id = $1
      ' using v_user_id;
    end if;
  end if;

  if to_regclass('public.club_members') is not null then
    execute 'delete from public.club_members where user_id = $1'
      using v_user_id;

    if to_regclass('public.clubs') is not null then
      execute '
        delete from public.club_members cm
        using public.clubs c
        where cm.club_id = c.id
          and c.owner_id = $1
      ' using v_user_id;
    end if;
  end if;

  if to_regclass('public.subscriptions') is not null then
    execute 'delete from public.subscriptions where user_id = $1'
      using v_user_id;

    if to_regclass('public.clubs') is not null then
      execute '
        delete from public.subscriptions s
        using public.clubs c
        where s.club_id = c.id
          and c.owner_id = $1
      ' using v_user_id;
    end if;
  end if;

  if to_regclass('public.profiles') is not null then
    execute 'delete from public.profiles where id = $1'
      using v_user_id;
  end if;

  if to_regclass('public.teams') is not null and to_regclass('public.clubs') is not null then
    execute '
      delete from public.teams t
      using public.clubs c
      where t.club_id = c.id
        and c.owner_id = $1
    ' using v_user_id;
  end if;

  if to_regclass('public.clubs') is not null then
    execute 'delete from public.clubs where owner_id = $1'
      using v_user_id;
  end if;

  delete from auth.users
  where id = v_user_id;
end;
$$;

revoke all on function public.delete_own_account() from public;
revoke all on function public.delete_own_account() from anon;
grant execute on function public.delete_own_account() to authenticated;
