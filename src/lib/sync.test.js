import FDBFactory from 'fake-indexeddb/lib/FDBFactory'
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  deleteMatch,
  getDB,
  getOutboxCount,
  loadMatches,
  loadSquad,
  saveMatch,
  saveSquad,
} from './db.js'
import { createRosterPlayer } from './team-players.js'

const { mockSupabase, cloudRows, mutationCalls, mutationErrors } = vi.hoisted(() => ({
  mockSupabase: {
    auth: {
      getSession: vi.fn(),
    },
    from: vi.fn(),
  },
  cloudRows: {
    matches: [],
    team_players: [],
  },
  mutationCalls: {
    deletes: [],
    upserts: [],
  },
  mutationErrors: {
    upsert: {},
  },
}))

vi.mock('./supabase.js', () => ({
  supabase: mockSupabase,
}))

function resetIndexedDb() {
  globalThis.indexedDB = new FDBFactory()
}

function createTableClient(table) {
  function deleteBuilder() {
    const filters = []
    let recorded = false
    const record = (extra = {}) => {
      if (recorded) return
      recorded = true
      mutationCalls.deletes.push({ table, filters: [...filters], ...extra })
    }
    const builder = {
      eq: vi.fn((column, value) => {
        filters.push({ column, value })
        return builder
      }),
      in: vi.fn((column, values) => {
        if (Array.isArray(values)) {
          cloudRows[table] = (cloudRows[table] || []).filter((row) => !values.includes(row.id))
        }
        record({ column, values })
        return Promise.resolve({ error: null })
      }),
      then: (resolve, reject) => {
        record()
        return Promise.resolve({ error: null }).then(resolve, reject)
      },
    }
    return builder
  }

  return {
    select: vi.fn(() => ({
      eq: vi.fn((column, value) =>
        Promise.resolve({
          data: (cloudRows[table] ?? []).filter((row) => String(row[column]) === String(value)),
          error: null,
        }),
      ),
      then: (resolve, reject) =>
        Promise.resolve({ data: cloudRows[table] ?? [], error: null }).then(resolve, reject),
    })),
    delete: vi.fn(deleteBuilder),
    upsert: vi.fn((payload, options) => {
      mutationCalls.upserts.push({ table, payload, options })
      return Promise.resolve({ error: mutationErrors.upsert[table] ?? null })
    }),
  }
}

function cloudMatch(id, updatedAt, overrides = {}) {
  return {
    id: String(id),
    user_id: 'user-a',
    data: {
      date: '2026-06-13',
      opposition: 'Cloud Team',
      venue: 'Home',
      score: { home: { goals: 1, points: 8 }, away: { goals: 0, points: 7 } },
      stats: {},
      events: [],
      customStats: [],
      players: [],
      updated_at: updatedAt,
      ...overrides,
    },
  }
}

function cloudTeamPlayer(id, teamId, updatedAt, overrides = {}) {
  return {
    id,
    team_id: teamId,
    display_name: 'Cloud Player',
    default_number: 7,
    position: 'HF',
    status: 'active',
    updated_at: new Date(updatedAt).toISOString(),
    ...overrides,
  }
}

describe('Supabase sync merge', () => {
  beforeEach(() => {
    resetIndexedDb()
    vi.resetModules()
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
    mockSupabase.from.mockImplementation(createTableClient)
    cloudRows.matches = []
    cloudRows.team_players = []
    mutationCalls.deletes = []
    mutationCalls.upserts = []
    mutationErrors.upsert = {}
  })

  it('restores cloud matches and shared team players into an empty local database', async () => {
    const teamScope = '00000000-0000-4000-8000-000000000001'
    const playerId = '00000000-0000-4000-8000-000000000101'
    cloudRows.matches = [cloudMatch('1001', 2000, { opposition: 'Restored Match' })]
    cloudRows.team_players = [
      cloudTeamPlayer(playerId, teamScope, 2000, { display_name: 'Restored Player' }),
    ]
    const { syncFromSupabase } = await import('./sync.js')

    await expect(syncFromSupabase('user-a')).resolves.toBe(true)

    expect(await loadMatches()).toMatchObject([
      { id: 1001, opposition: 'Restored Match', updated_at: 2000 },
    ])
    expect(await loadSquad({ teamScope })).toMatchObject([
      { id: playerId, name: 'Restored Player', updated_at: 2000 },
    ])
  })

  it('does not overwrite newer local match and team-player data with stale cloud rows', async () => {
    const teamScope = '00000000-0000-4000-8000-000000000001'
    const playerId = '00000000-0000-4000-8000-000000000103'
    const db = await getDB()
    await db.put('matches', {
      id: 22,
      opposition: 'New Local Match',
      score: {},
      stats: {},
      events: [],
      updated_at: 5000,
    })
    await db.put('team_players_by_team', {
      id: playerId,
      team_player_id: playerId,
      name: 'New Local Player',
      display_name: 'New Local Player',
      number: 3,
      default_number: 3,
      position: 'FB',
      status: 'active',
      teamScope,
      teamId: teamScope,
      updated_at: 5000,
    })
    cloudRows.matches = [cloudMatch('22', 1000, { opposition: 'Stale Cloud Match' })]
    cloudRows.team_players = [
      cloudTeamPlayer(playerId, teamScope, 1000, { display_name: 'Stale Cloud Player' }),
    ]
    const { syncFromSupabase } = await import('./sync.js')

    await expect(syncFromSupabase('user-a')).resolves.toBe(true)

    expect(await loadMatches()).toMatchObject([{ id: 22, opposition: 'New Local Match' }])
    expect(await loadSquad({ teamScope })).toMatchObject([
      { id: playerId, name: 'New Local Player' },
    ])
  })

  it('does not overwrite newer local team-scoped matches with stale cloud rows', async () => {
    const teamScope = '00000000-0000-4000-8000-000000000001'
    const db = await getDB()
    await db.put('matches', {
      id: 88,
      teamScope,
      teamId: teamScope,
      opposition: 'New Team Match',
      score: {},
      stats: {},
      events: [],
      updated_at: 5000,
    })
    cloudRows.matches = [
      cloudMatch('88', 1000, {
        opposition: 'Stale Team Cloud Match',
        teamScope,
        teamId: teamScope,
      }),
    ]
    const { syncFromSupabase } = await import('./sync.js')

    await expect(syncFromSupabase('user-a')).resolves.toBe(true)

    expect(await loadMatches({ teamScope })).toMatchObject([
      { id: 88, opposition: 'New Team Match' },
    ])
  })

  it('skips cloud matches that have a pending local delete mutation', async () => {
    await deleteMatch(33)
    cloudRows.matches = [cloudMatch('33', 9000, { opposition: 'Deleted Cloud Match' })]
    const { syncFromSupabase } = await import('./sync.js')

    await expect(syncFromSupabase('user-a')).resolves.toBe(true)

    expect(await loadMatches()).toEqual([])
  })

  it('keeps numeric local match ids when merging newer cloud data', async () => {
    const db = await getDB()
    await db.put('matches', {
      id: 44,
      opposition: 'Old Local Match',
      score: {},
      stats: {},
      events: [],
      updated_at: 1000,
    })
    cloudRows.matches = [cloudMatch('44', 4000, { opposition: 'New Cloud Match' })]
    const { syncFromSupabase } = await import('./sync.js')

    await expect(syncFromSupabase('user-a')).resolves.toBe(true)

    expect(await loadMatches()).toMatchObject([
      { id: 44, opposition: 'New Cloud Match', updated_at: 4000 },
    ])
  })

  it('drains successful outbox mutations before pulling cloud data', async () => {
    await saveMatch({
      id: 55,
      date: '2026-06-13',
      opposition: 'Queued Match',
      score: {},
      stats: {},
      events: [],
    })
    const { syncToSupabase } = await import('./sync.js')

    await expect(syncToSupabase('user-a')).resolves.toBe(true)

    expect(await getOutboxCount()).toBe(0)
    expect(mutationCalls.upserts).toHaveLength(1)
    expect(mutationCalls.upserts[0]).toMatchObject({
      table: 'matches',
      options: { onConflict: 'id,user_id' },
    })
    expect(mutationCalls.upserts[0].payload).toMatchObject({
      id: '55',
      user_id: 'user-a',
      data: { opposition: 'Queued Match' },
    })
  })

  it('syncs a removed player by marking the canonical player inactive', async () => {
    const teamScope = '00000000-0000-4000-8000-000000000001'
    const player = createRosterPlayer({ name: 'Remove One', number: 7 })
    await saveSquad([player], { teamScope })
    const db = await getDB()
    await db.clear('sync_outbox')
    await saveSquad([], { teamScope })
    const { syncToSupabase } = await import('./sync.js')

    await expect(syncToSupabase('user-a')).resolves.toBe(true)

    expect(mutationCalls.deletes).toHaveLength(0)
    expect(mutationCalls.upserts).toContainEqual({
      table: 'team_players',
      options: { onConflict: 'id' },
      payload: [
        expect.objectContaining({
          id: player.id,
          team_id: teamScope,
          display_name: 'Remove One',
          status: 'inactive',
        }),
      ],
    })
    expect(await loadSquad({ teamScope })).toEqual([])
  })

  it('lets different users pull the same shared team player ids for one team', async () => {
    const teamScope = '00000000-0000-4000-8000-000000000001'
    const playerId = '00000000-0000-4000-8000-000000000201'
    cloudRows.team_players = [
      cloudTeamPlayer(playerId, teamScope, 2000, { display_name: 'Shared Player' }),
    ]
    const { syncFromSupabase } = await import('./sync.js')

    await expect(syncFromSupabase('coach-a')).resolves.toBe(true)
    const coachASquad = await loadSquad({ teamScope })
    await (await getDB()).clear('team_players_by_team')
    await expect(syncFromSupabase('coach-b')).resolves.toBe(true)
    const coachBSquad = await loadSquad({ teamScope })

    expect(coachASquad).toMatchObject([{ id: playerId, name: 'Shared Player' }])
    expect(coachBSquad).toMatchObject([{ id: playerId, name: 'Shared Player' }])
  })
})
