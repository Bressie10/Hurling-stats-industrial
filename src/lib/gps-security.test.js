import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const gpsMigration = readFileSync(
  new URL('../../supabase/migrations/20260620_gps_cloud_foundation.sql', import.meta.url),
  'utf8',
)
const gpsHardeningMigration = readFileSync(
  new URL('../../supabase/migrations/20260621_gps_privacy_hardening.sql', import.meta.url),
  'utf8',
)

describe('GPS cloud tenant isolation schema', () => {
  it('scopes GPS read policies to club/team membership instead of UI state', () => {
    expect(gpsMigration).toMatch(
      /create policy "trackers: club member read"[\s\S]*using \(public\.can_access_club\(club_id\)\)/,
    )
    for (const table of [
      'gps_sessions',
      'tracker_player_assignments',
      'gps_samples',
      'gps_latest',
      'gps_player_session_summaries',
    ]) {
      expect(gpsMigration).toMatch(
        new RegExp(
          `create policy "${table}: team read"[\\s\\S]*on public\\.${table} for select[\\s\\S]*using \\(public\\.can_access_team\\(team_id\\)\\)`,
        ),
      )
    }
  })

  it('uses composite foreign keys to block cross-club tracker/session spoofing', () => {
    expect(gpsMigration).toContain('constraint gps_sessions_team_club_fk')
    expect(gpsMigration).toContain('foreign key (team_id, club_id)')
    expect(gpsMigration).toContain('references public.teams(id, club_id)')
    expect(gpsMigration).toContain('constraint tracker_player_assignments_tracker_fk')
    expect(gpsMigration).toContain('foreign key (tracker_id, club_id)')
    expect(gpsMigration).toContain('references public.trackers(id, club_id)')
  })

  it('uses composite foreign keys to block assigning a Team A player into a Team B session', () => {
    expect(gpsMigration).toContain('constraint team_players_id_team_id_key unique (id, team_id)')
    expect(gpsMigration).toContain('constraint tracker_player_assignments_session_fk')
    expect(gpsMigration).toContain('foreign key (session_id, team_id, club_id)')
    expect(gpsMigration).toContain('constraint tracker_player_assignments_team_player_fk')
    expect(gpsMigration).toContain('foreign key (team_player_id, team_id)')
    expect(gpsMigration).toContain('references public.team_players(id, team_id)')
  })

  it('keeps raw GPS samples and latest-state assignment IDs bound to one assignment tenant tuple', () => {
    expect(gpsMigration).toContain('constraint gps_samples_assignment_fk')
    expect(gpsMigration).toContain(
      'foreign key (assignment_id, session_id, tracker_id, team_id, club_id)',
    )
    expect(gpsHardeningMigration).toContain('constraint gps_latest_assignment_fk')
    expect(gpsHardeningMigration).toContain(
      'foreign key (assignment_id, session_id, tracker_id, team_id, club_id)',
    )
  })

  it('does not expose direct authenticated writes to raw GPS history tables', () => {
    expect(gpsMigration).not.toMatch(/gps_samples:[^"]*insert/)
    expect(gpsHardeningMigration).toContain(
      'revoke insert, update, delete on public.gps_samples from anon, authenticated',
    )
    expect(gpsHardeningMigration).toContain(
      'revoke insert, update, delete on public.gps_latest from anon, authenticated',
    )
    expect(gpsHardeningMigration).toContain(
      'revoke insert, update, delete on public.gps_player_session_summaries from anon, authenticated',
    )
  })

  it('updates account deletion so owned GPS rows cannot block team or club removal', () => {
    for (const table of [
      'public.gps_samples',
      'public.gps_latest',
      'public.gps_player_session_summaries',
      'public.tracker_player_assignments',
      'public.gps_sessions',
      'public.trackers',
    ]) {
      expect(gpsHardeningMigration).toContain(`delete from ${table}`)
    }
    expect(gpsHardeningMigration.indexOf('delete from public.gps_samples')).toBeLessThan(
      gpsHardeningMigration.indexOf('delete from public.gps_sessions'),
    )
    expect(gpsHardeningMigration.indexOf('delete from public.gps_sessions')).toBeLessThan(
      gpsHardeningMigration.indexOf('delete from public.teams'),
    )
  })
})
