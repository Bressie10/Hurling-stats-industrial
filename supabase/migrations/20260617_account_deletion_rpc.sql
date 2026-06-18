-- Account deletion RPC used by Settings and the public account deletion flow.
--
-- Authenticated users can only delete their own account. The function runs as a
-- definer so it can remove auth.users and associated private rows consistently.

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
