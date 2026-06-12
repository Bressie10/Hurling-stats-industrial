-- Lock down code-based club/team joining.
-- Direct self-insert policies allowed a user to join if they knew UUIDs.

drop policy if exists "club_members: insert own" on club_members;
drop policy if exists "club_members: owner insert" on club_members;

create policy "club_members: owner insert"
  on club_members for insert
  with check (
    exists (
      select 1
      from clubs c
      where c.id = club_members.club_id
        and c.owner_id = auth.uid()
    )
    or exists (
      select 1
      from club_members cm
      where cm.club_id = club_members.club_id
        and cm.user_id = auth.uid()
        and cm.role in ('owner', 'admin')
    )
  );

drop policy if exists "team_members: self insert" on team_members;

create or replace function public.join_team_with_code(p_code text)
returns table (
  team_id uuid,
  club_id uuid,
  team_name text,
  team_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_team record;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select t.id, t.club_id, t.name, t.code
    into v_team
  from teams t
  where t.code = trim(p_code)
  limit 1;

  if not found then
    return;
  end if;

  insert into club_members (club_id, user_id, role)
  values (v_team.club_id, v_user_id, 'coach')
  on conflict do nothing;

  insert into team_members (club_id, team_id, user_id, role)
  values (v_team.club_id, v_team.id, v_user_id, 'coach')
  on conflict do nothing;

  team_id := v_team.id;
  club_id := v_team.club_id;
  team_name := v_team.name;
  team_code := v_team.code;
  return next;
end;
$$;

create or replace function public.find_club_by_code(p_code text)
returns table (
  club_id uuid,
  club_name text,
  club_code text
)
language sql
security definer
set search_path = public
as $$
  select c.id, c.name, c.code
  from clubs c
  where upper(c.code) = upper(trim(p_code))
  limit 1;
$$;

revoke all on function public.join_team_with_code(text) from public;
grant execute on function public.join_team_with_code(text) to authenticated;

revoke all on function public.find_club_by_code(text) from public;
grant execute on function public.find_club_by_code(text) to authenticated;
