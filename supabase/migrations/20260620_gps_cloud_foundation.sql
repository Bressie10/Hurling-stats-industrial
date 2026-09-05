-- Local-first GPS cloud foundation.
--
-- Supabase is the long-term sync/history store for GPS data, not the critical
-- live-session path. Raw telemetry reaches these tables later through a trusted
-- GPS sync API/RPC after being captured locally.

-- Supporting uniqueness for composite foreign keys.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'teams_id_club_id_key'
      and conrelid = 'public.teams'::regclass
  ) then
    alter table public.teams
      add constraint teams_id_club_id_key unique (id, club_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'team_players_id_team_id_key'
      and conrelid = 'public.team_players'::regclass
  ) then
    alter table public.team_players
      add constraint team_players_id_team_id_key unique (id, team_id);
  end if;
end $$;

create or replace function public.can_access_club(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and (
      public.is_club_admin(p_club_id)
      or exists (
        select 1
        from club_members cm
        where cm.club_id = p_club_id
          and cm.user_id = auth.uid()
      )
      or exists (
        select 1
        from team_members tm
        where tm.club_id = p_club_id
          and tm.user_id = auth.uid()
      )
    );
$$;

revoke all on function public.can_access_club(uuid) from public;
grant execute on function public.can_access_club(uuid) to authenticated;

create table if not exists public.trackers (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete restrict,
  serial_number text not null,
  label text,
  hardware_model text,
  firmware_version text,
  status text not null default 'active',
  credential_key_id text,
  credential_public_key text,
  credential_algorithm text,
  credential_rotated_at timestamptz,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trackers_serial_not_blank check (length(btrim(serial_number)) > 0),
  constraint trackers_status_check check (status in ('active', 'maintenance', 'revoked', 'lost')),
  constraint trackers_revoked_status_check check (
    revoked_at is null or status in ('revoked', 'lost')
  ),
  constraint trackers_club_serial_key unique (club_id, serial_number),
  constraint trackers_id_club_id_key unique (id, club_id)
);

create index if not exists idx_trackers_club_status
  on public.trackers(club_id, status);

create index if not exists idx_trackers_last_seen
  on public.trackers(last_seen_at);

create table if not exists public.gps_sessions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete restrict,
  team_id uuid not null,
  created_by uuid references auth.users(id) on delete set null,
  local_source_id uuid,
  session_type text not null,
  name text,
  status text not null default 'planned',
  started_at timestamptz,
  ended_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gps_sessions_team_club_fk
    foreign key (team_id, club_id)
    references public.teams(id, club_id)
    on delete restrict,
  constraint gps_sessions_id_team_club_key unique (id, team_id, club_id),
  constraint gps_sessions_type_check check (session_type in ('training', 'match')),
  constraint gps_sessions_status_check check (status in ('planned', 'active', 'ended', 'cancelled')),
  constraint gps_sessions_name_not_blank check (name is null or length(btrim(name)) > 0),
  constraint gps_sessions_started_before_ended check (
    ended_at is null or started_at is null or ended_at >= started_at
  ),
  constraint gps_sessions_status_timestamp_check check (
    (status <> 'active' or started_at is not null)
    and (status <> 'ended' or (started_at is not null and ended_at is not null))
    and (status <> 'cancelled' or cancelled_at is not null)
  ),
  constraint gps_sessions_terminal_exclusive_check check (
    not (ended_at is not null and cancelled_at is not null)
  )
);

create index if not exists idx_gps_sessions_team_started
  on public.gps_sessions(team_id, started_at desc);

create index if not exists idx_gps_sessions_club_started
  on public.gps_sessions(club_id, started_at desc);

create index if not exists idx_gps_sessions_status
  on public.gps_sessions(status);

create table if not exists public.tracker_player_assignments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  club_id uuid not null,
  team_id uuid not null,
  tracker_id uuid not null,
  team_player_id uuid,
  assigned_from timestamptz not null,
  assigned_to timestamptz,
  status text not null default 'active',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tracker_player_assignments_session_fk
    foreign key (session_id, team_id, club_id)
    references public.gps_sessions(id, team_id, club_id)
    on delete cascade,
  constraint tracker_player_assignments_tracker_fk
    foreign key (tracker_id, club_id)
    references public.trackers(id, club_id)
    on delete restrict,
  constraint tracker_player_assignments_team_player_fk
    foreign key (team_player_id, team_id)
    references public.team_players(id, team_id)
    on delete restrict,
  constraint tracker_player_assignments_id_session_tracker_team_club_key
    unique (id, session_id, tracker_id, team_id, club_id),
  constraint tracker_player_assignments_status_check check (status in ('active', 'ended', 'cancelled')),
  constraint tracker_player_assignments_time_check check (
    assigned_to is null or assigned_to > assigned_from
  )
);

create unique index if not exists idx_tracker_assignment_one_open_tracker
  on public.tracker_player_assignments(session_id, tracker_id)
  where assigned_to is null and status = 'active';

create unique index if not exists idx_tracker_assignment_one_open_player
  on public.tracker_player_assignments(session_id, team_player_id)
  where team_player_id is not null and assigned_to is null and status = 'active';

create index if not exists idx_tracker_assignments_session
  on public.tracker_player_assignments(session_id);

create index if not exists idx_tracker_assignments_tracker_time
  on public.tracker_player_assignments(tracker_id, assigned_from);

create index if not exists idx_tracker_assignments_player_time
  on public.tracker_player_assignments(team_player_id, assigned_from)
  where team_player_id is not null;

create table if not exists public.gps_samples (
  session_id uuid not null,
  club_id uuid not null,
  team_id uuid not null,
  tracker_id uuid not null,
  tracker_stream_id uuid not null,
  assignment_id uuid not null,
  sequence bigint not null,
  captured_at timestamptz not null,
  received_at timestamptz not null default now(),
  latitude double precision not null,
  longitude double precision not null,
  speed_mps double precision,
  accuracy_m double precision,
  primary key (session_id, tracker_id, tracker_stream_id, sequence),
  constraint gps_samples_session_fk
    foreign key (session_id, team_id, club_id)
    references public.gps_sessions(id, team_id, club_id)
    on delete cascade,
  constraint gps_samples_tracker_fk
    foreign key (tracker_id, club_id)
    references public.trackers(id, club_id)
    on delete restrict,
  constraint gps_samples_assignment_fk
    foreign key (assignment_id, session_id, tracker_id, team_id, club_id)
    references public.tracker_player_assignments(id, session_id, tracker_id, team_id, club_id)
    on delete cascade,
  constraint gps_samples_sequence_check check (sequence >= 0),
  constraint gps_samples_latitude_check check (latitude >= -90 and latitude <= 90),
  constraint gps_samples_longitude_check check (longitude >= -180 and longitude <= 180),
  constraint gps_samples_speed_check check (speed_mps is null or speed_mps >= 0),
  constraint gps_samples_accuracy_check check (accuracy_m is null or accuracy_m >= 0)
);

create index if not exists idx_gps_samples_session_captured
  on public.gps_samples(session_id, captured_at);

create index if not exists idx_gps_samples_assignment_captured
  on public.gps_samples(assignment_id, captured_at);

create index if not exists idx_gps_samples_tracker_captured
  on public.gps_samples(tracker_id, captured_at);

create table if not exists public.gps_latest (
  session_id uuid not null,
  club_id uuid not null,
  team_id uuid not null,
  tracker_id uuid not null,
  tracker_stream_id uuid,
  assignment_id uuid,
  team_player_id uuid,
  sequence bigint,
  captured_at timestamptz,
  latitude double precision,
  longitude double precision,
  speed_mps double precision,
  accuracy_m double precision,
  battery_percent smallint,
  connection_status text not null default 'unknown',
  updated_at timestamptz not null default now(),
  primary key (session_id, tracker_id),
  constraint gps_latest_session_fk
    foreign key (session_id, team_id, club_id)
    references public.gps_sessions(id, team_id, club_id)
    on delete cascade,
  constraint gps_latest_tracker_fk
    foreign key (tracker_id, club_id)
    references public.trackers(id, club_id)
    on delete restrict,
  constraint gps_latest_team_player_fk
    foreign key (team_player_id, team_id)
    references public.team_players(id, team_id)
    on delete restrict,
  constraint gps_latest_sequence_check check (sequence is null or sequence >= 0),
  constraint gps_latest_latitude_check check (latitude is null or (latitude >= -90 and latitude <= 90)),
  constraint gps_latest_longitude_check check (longitude is null or (longitude >= -180 and longitude <= 180)),
  constraint gps_latest_speed_check check (speed_mps is null or speed_mps >= 0),
  constraint gps_latest_accuracy_check check (accuracy_m is null or accuracy_m >= 0),
  constraint gps_latest_battery_check check (
    battery_percent is null or (battery_percent >= 0 and battery_percent <= 100)
  ),
  constraint gps_latest_connection_status_check check (
    connection_status in ('unknown', 'connected', 'stale', 'offline')
  )
);

create index if not exists idx_gps_latest_session_updated
  on public.gps_latest(session_id, updated_at desc);

create table if not exists public.gps_player_session_summaries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  club_id uuid not null,
  team_id uuid not null,
  team_player_id uuid,
  total_distance_m double precision,
  max_speed_mps double precision,
  average_speed_mps double precision,
  moving_time_seconds integer,
  sprint_count integer,
  sample_count integer not null default 0,
  first_sample_at timestamptz,
  last_sample_at timestamptz,
  algorithm_version text not null,
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gps_player_session_summaries_session_fk
    foreign key (session_id, team_id, club_id)
    references public.gps_sessions(id, team_id, club_id)
    on delete cascade,
  constraint gps_player_session_summaries_team_player_fk
    foreign key (team_player_id, team_id)
    references public.team_players(id, team_id)
    on delete restrict,
  constraint gps_player_session_summaries_algorithm_not_blank check (
    length(btrim(algorithm_version)) > 0
  ),
  constraint gps_player_session_summaries_distance_check check (
    total_distance_m is null or total_distance_m >= 0
  ),
  constraint gps_player_session_summaries_max_speed_check check (
    max_speed_mps is null or max_speed_mps >= 0
  ),
  constraint gps_player_session_summaries_average_speed_check check (
    average_speed_mps is null or average_speed_mps >= 0
  ),
  constraint gps_player_session_summaries_moving_time_check check (
    moving_time_seconds is null or moving_time_seconds >= 0
  ),
  constraint gps_player_session_summaries_sprint_count_check check (
    sprint_count is null or sprint_count >= 0
  ),
  constraint gps_player_session_summaries_sample_count_check check (sample_count >= 0),
  constraint gps_player_session_summaries_sample_time_check check (
    last_sample_at is null or first_sample_at is null or last_sample_at >= first_sample_at
  )
);

create unique index if not exists idx_gps_player_session_summaries_player
  on public.gps_player_session_summaries(session_id, team_player_id)
  where team_player_id is not null;

create index if not exists idx_gps_player_session_summaries_session
  on public.gps_player_session_summaries(session_id);

create index if not exists idx_gps_player_session_summaries_player_computed
  on public.gps_player_session_summaries(team_player_id, computed_at desc)
  where team_player_id is not null;

comment on table public.gps_samples is
  'Append-only raw GPS telemetry synced from local-first receiver storage. Contains no repeated player names, emails, club names, medical data, or tracker secrets.';

comment on table public.gps_latest is
  'Rebuildable latest-state cache for dashboards. Source-of-truth telemetry is gps_samples plus tracker_player_assignments.';

comment on column public.trackers.credential_public_key is
  'Public credential material only. Do not store plaintext tracker secrets.';

alter table public.trackers enable row level security;
alter table public.gps_sessions enable row level security;
alter table public.tracker_player_assignments enable row level security;
alter table public.gps_samples enable row level security;
alter table public.gps_latest enable row level security;
alter table public.gps_player_session_summaries enable row level security;

drop policy if exists "trackers: club member read" on public.trackers;
drop policy if exists "trackers: club admin insert" on public.trackers;
drop policy if exists "trackers: club admin update" on public.trackers;
drop policy if exists "trackers: club admin delete" on public.trackers;

create policy "trackers: club member read"
  on public.trackers for select
  using (public.can_access_club(club_id));

create policy "trackers: club admin insert"
  on public.trackers for insert
  with check (
    public.is_club_admin(club_id)
    and (created_by is null or created_by = auth.uid())
  );

create policy "trackers: club admin update"
  on public.trackers for update
  using (public.is_club_admin(club_id))
  with check (public.is_club_admin(club_id));

create policy "trackers: club admin delete"
  on public.trackers for delete
  using (public.is_club_admin(club_id));

drop policy if exists "gps_sessions: team read" on public.gps_sessions;
drop policy if exists "gps_sessions: team insert" on public.gps_sessions;
drop policy if exists "gps_sessions: team update" on public.gps_sessions;
drop policy if exists "gps_sessions: club admin delete" on public.gps_sessions;

create policy "gps_sessions: team read"
  on public.gps_sessions for select
  using (public.can_access_team(team_id));

create policy "gps_sessions: team insert"
  on public.gps_sessions for insert
  with check (
    public.can_access_team(team_id)
    and (created_by is null or created_by = auth.uid())
  );

create policy "gps_sessions: team update"
  on public.gps_sessions for update
  using (public.can_access_team(team_id))
  with check (public.can_access_team(team_id));

create policy "gps_sessions: club admin delete"
  on public.gps_sessions for delete
  using (public.is_club_admin(club_id));

drop policy if exists "tracker_player_assignments: team read" on public.tracker_player_assignments;
drop policy if exists "tracker_player_assignments: team insert" on public.tracker_player_assignments;
drop policy if exists "tracker_player_assignments: team update" on public.tracker_player_assignments;

create policy "tracker_player_assignments: team read"
  on public.tracker_player_assignments for select
  using (public.can_access_team(team_id));

create policy "tracker_player_assignments: team insert"
  on public.tracker_player_assignments for insert
  with check (
    public.can_access_team(team_id)
    and (created_by is null or created_by = auth.uid())
  );

create policy "tracker_player_assignments: team update"
  on public.tracker_player_assignments for update
  using (public.can_access_team(team_id))
  with check (public.can_access_team(team_id));

drop policy if exists "gps_samples: team read" on public.gps_samples;

create policy "gps_samples: team read"
  on public.gps_samples for select
  using (public.can_access_team(team_id));

drop policy if exists "gps_latest: team read" on public.gps_latest;

create policy "gps_latest: team read"
  on public.gps_latest for select
  using (public.can_access_team(team_id));

drop policy if exists "gps_player_session_summaries: team read" on public.gps_player_session_summaries;

create policy "gps_player_session_summaries: team read"
  on public.gps_player_session_summaries for select
  using (public.can_access_team(team_id));
