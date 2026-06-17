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

const { mockSupabase, cloudRows, mutationCalls, mutationErrors } = vi.hoisted(() => ({
  mockSupabase: {
    auth: {
      getSession: vi.fn(),
    },
    from: vi.fn(),
  },
  cloudRows: {
    matches: [],
    squad: [],
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
      eq: vi.fn(() => Promise.resolve({ data: cloudRows[table] ?? [], error: null })),
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

function cloudSquad(localId, updatedAt, overrides = {}) {
  return {
    id: `user-a:${localId}`,
    user_id: 'user-a',
    data: {
      local_id: localId,
      name: 'Cloud Player',
      number: localId,
      position: 'HF',
      updated_at: updatedAt,
      ...overrides,
    },
  }
}

describe('Supabase sync merge', () => {
  beforeEach(() => {
    resetIndexedDb()
    vi.resetModules()
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
    mockSupabase.from.mockImplementation(createTableClient)
    cloudRows.matches = []
    cloudRows.squad = []
    mutationCalls.deletes = []
    mutationCalls.upserts = []
    mutationErrors.upsert = {}
  })

  it('restores cloud matches and squad into an empty local database', async () => {
    cloudRows.matches = [cloudMatch('1001', 2000, { opposition: 'Restored Match' })]
    cloudRows.squad = [cloudSquad(7, 2000, { name: 'Restored Player' })]
    const { syncFromSupabase } = await import('./sync.js')

    await expect(syncFromSupabase('user-a')).resolves.toBe(true)

    expect(await loadMatches()).toMatchObject([
      { id: 1001, opposition: 'Restored Match', updated_at: 2000 },
    ])
    expect(await loadSquad()).toMatchObject([{ id: 7, name: 'Restored Player', updated_at: 2000 }])
  })

  it('does not overwrite newer local match and squad data with stale cloud rows', async () => {
    const db = await getDB()
    await db.put('matches', {
      id: 22,
      opposition: 'New Local Match',
      score: {},
      stats: {},
      events: [],
      updated_at: 5000,
    })
    await db.put('squad', {
      id: 3,
      name: 'New Local Player',
      number: 3,
      position: 'FB',
      updated_at: 5000,
    })
    cloudRows.matches = [cloudMatch('22', 1000, { opposition: 'Stale Cloud Match' })]
    cloudRows.squad = [cloudSquad(3, 1000, { name: 'Stale Cloud Player' })]
    const { syncFromSupabase } = await import('./sync.js')

    await expect(syncFromSupabase('user-a')).resolves.toBe(true)

    expect(await loadMatches()).toMatchObject([{ id: 22, opposition: 'New Local Match' }])
    expect(await loadSquad()).toMatchObject([{ id: 3, name: 'New Local Player' }])
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

  it('syncs an emptied squad by deleting remote squad rows in the same scope', async () => {
    cloudRows.squad = [
      cloudSquad(7, 2000, { name: 'Remove One' }),
      cloudSquad(8, 2000, { name: 'Remove Two' }),
    ]
    await saveSquad([])
    const { syncToSupabase } = await import('./sync.js')

    await expect(syncToSupabase('user-a')).resolves.toBe(true)

    expect(mutationCalls.upserts).toHaveLength(0)
    expect(mutationCalls.deletes).toContainEqual({
      table: 'squad',
      filters: [{ column: 'user_id', value: 'user-a' }],
      column: 'id',
      values: ['user-a:7', 'user-a:8'],
    })
    expect(await loadSquad()).toEqual([])
  })
})
