-- Enforce the free-tier saved-match limit at the database boundary.
--
-- The app enforces this locally before a match is saved. This trigger protects
-- the same rule for direct Supabase writes and background sync upserts.

create or replace function public.has_paid_match_entitlement(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.subscriptions s
    where s.status in ('active', 'trialing')
      and (
        s.user_id = p_user_id
        or exists (
          select 1
          from public.profiles p
          where p.id = p_user_id
            and p.club_id = s.club_id
        )
        or exists (
          select 1
          from public.club_members cm
          where cm.user_id = p_user_id
            and cm.club_id = s.club_id
        )
      )
      and (
        s.plan in ('personal', 'club', 'club_pro')
        or coalesce(coalesce(s.custom_features, '{}'::jsonb)->>'isPro', 'false') = 'true'
        or coalesce(coalesce(s.custom_features, '{}'::jsonb)->>'isClub', 'false') = 'true'
        or coalesce(coalesce(s.custom_features, '{}'::jsonb)->>'isClubPro', 'false') = 'true'
      )
  );
$$;

create or replace function public.enforce_free_match_quota()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  existing_count integer;
begin
  if new.user_id is null then
    return new;
  end if;

  if public.has_paid_match_entitlement(new.user_id) then
    return new;
  end if;

  select count(*)
    into existing_count
    from public.matches m
    where m.user_id = new.user_id
      and m.id <> new.id;

  if existing_count >= 2 then
    raise exception 'Free accounts can save 2 matches'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_free_match_quota on public.matches;

-- AFTER INSERT allows sync upserts to update existing rows without treating the
-- conflict update as a new saved match.
create trigger enforce_free_match_quota
after insert on public.matches
for each row
execute function public.enforce_free_match_quota();

revoke all on function public.has_paid_match_entitlement(uuid) from public;
revoke all on function public.enforce_free_match_quota() from public;
revoke all on function public.has_paid_match_entitlement(uuid) from anon;
revoke all on function public.enforce_free_match_quota() from anon;
revoke all on function public.has_paid_match_entitlement(uuid) from authenticated;
revoke all on function public.enforce_free_match_quota() from authenticated;
