-- ============================================================
-- GAA Stats — RLS Policies
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── Enable RLS on all tables ──────────────────────────────
alter table profiles enable row level security;
alter table clubs enable row level security;
alter table club_members enable row level security;
alter table subscriptions enable row level security;
alter table matches enable row level security;
alter table squad enable row level security;

-- ── profiles ─────────────────────────────────────────────
drop policy if exists "profiles: own read"   on profiles;
drop policy if exists "profiles: own insert" on profiles;
drop policy if exists "profiles: own update" on profiles;

create policy "profiles: own read"
  on profiles for select
  using (auth.uid() = id);

create policy "profiles: own insert"
  on profiles for insert
  with check (auth.uid() = id);

create policy "profiles: own update"
  on profiles for update
  using (auth.uid() = id);

-- ── clubs ─────────────────────────────────────────────────
drop policy if exists "clubs: member read"    on clubs;
drop policy if exists "clubs: owner insert"   on clubs;
drop policy if exists "clubs: owner update"   on clubs;
drop policy if exists "clubs: join by code"   on clubs;

-- Owner can read their own club (needed so INSERT...RETURNING works before club_members exists)
create policy "clubs: owner read"
  on clubs for select
  using (owner_id = auth.uid());

-- Members can read their own club
create policy "clubs: member read"
  on clubs for select
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from club_members
      where club_members.club_id = clubs.id
        and club_members.user_id = auth.uid()
    )
  );

-- Anyone authenticated can read a club by code (to validate join)
create policy "clubs: read by code for join"
  on clubs for select
  using (auth.role() = 'authenticated');

-- Owner can insert
create policy "clubs: owner insert"
  on clubs for insert
  with check (auth.uid() = owner_id);

-- Owner can update
create policy "clubs: owner update"
  on clubs for update
  using (auth.uid() = owner_id);

-- ── club_members ──────────────────────────────────────────
drop policy if exists "club_members: read own"     on club_members;
drop policy if exists "club_members: insert own"   on club_members;

create policy "club_members: read own"
  on club_members for select
  using (user_id = auth.uid());

create policy "club_members: insert own"
  on club_members for insert
  with check (user_id = auth.uid());

-- ── subscriptions ─────────────────────────────────────────
drop policy if exists "subscriptions: read own"   on subscriptions;
drop policy if exists "subscriptions: insert own" on subscriptions;
drop policy if exists "subscriptions: read club"  on subscriptions;

-- User can read their own personal subscription
create policy "subscriptions: read own"
  on subscriptions for select
  using (user_id = auth.uid());

-- User can read their club's subscription
create policy "subscriptions: read club"
  on subscriptions for select
  using (
    club_id is not null
    and exists (
      select 1 from club_members
      where club_members.club_id = subscriptions.club_id
        and club_members.user_id = auth.uid()
    )
  );

create policy "subscriptions: insert own"
  on subscriptions for insert
  with check (user_id = auth.uid());

-- ── matches ───────────────────────────────────────────────
drop policy if exists "matches: own read"   on matches;
drop policy if exists "matches: own insert" on matches;
drop policy if exists "matches: own update" on matches;
drop policy if exists "matches: own delete" on matches;

create policy "matches: own read"
  on matches for select
  using (user_id = auth.uid());

create policy "matches: own insert"
  on matches for insert
  with check (user_id = auth.uid());

create policy "matches: own update"
  on matches for update
  using (user_id = auth.uid());

create policy "matches: own delete"
  on matches for delete
  using (user_id = auth.uid());

-- ── squad ─────────────────────────────────────────────────
drop policy if exists "squad: own read"   on squad;
drop policy if exists "squad: own insert" on squad;
drop policy if exists "squad: own update" on squad;
drop policy if exists "squad: own delete" on squad;

create policy "squad: own read"
  on squad for select
  using (user_id = auth.uid());

create policy "squad: own insert"
  on squad for insert
  with check (user_id = auth.uid());

create policy "squad: own update"
  on squad for update
  using (user_id = auth.uid());

create policy "squad: own delete"
  on squad for delete
  using (user_id = auth.uid());
