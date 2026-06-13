import FDBFactory from 'fake-indexeddb/lib/FDBFactory'
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearAllData,
  deleteMatch,
  getDB,
  getLastUserId,
  getOutboxCount,
  getReadyMutations,
  loadMatches,
  loadSquad,
  markMutationDone,
  markMutationFailed,
  saveDraftMatch,
  saveMatch,
  saveSquad,
  setLastUserId,
} from './db.js'

function resetIndexedDb() {
  globalThis.indexedDB = new FDBFactory()
}

describe('IndexedDB outbox', () => {
  beforeEach(() => {
    resetIndexedDb()
  })

  it('stores real matches and enqueues an upsert mutation atomically', async () => {
    await saveMatch({
      id: 101,
      date: '2026-06-13',
      opposition: 'Cork',
      score: { home: { goals: 1, points: 12 }, away: { goals: 0, points: 10 } },
    })

    const matches = await loadMatches()
    const mutations = await getReadyMutations()

    expect(matches).toHaveLength(1)
    expect(matches[0]).toMatchObject({ id: 101, opposition: 'Cork' })
    expect(mutations).toHaveLength(1)
    expect(mutations[0]).toMatchObject({
      op: 'upsert_match',
      entity_id: '101',
      attempts: 0,
      last_error: null,
      next_retry_at: 0,
    })
  })

  it('keeps drafts device-local and out of the sync outbox', async () => {
    await saveDraftMatch({ opposition: 'Draft Team' })
    await saveMatch({ id: 'draft', isDraft: true, opposition: 'Draft Team' })

    expect(await loadMatches()).toEqual([])
    expect(await getOutboxCount()).toBe(0)
  })

  it('enqueues full-squad replacement mutations', async () => {
    await saveSquad([
      { id: 1, name: 'A Player', number: 1, position: 'GK' },
      { id: 2, name: 'B Player', number: 2, position: 'FB' },
    ])

    const squad = await loadSquad()
    const [mutation] = await getReadyMutations()

    expect(squad.map((player) => player.name)).toEqual(['A Player', 'B Player'])
    expect(mutation.op).toBe('upsert_squad')
    expect(mutation.payload).toHaveLength(2)
    expect(mutation.payload.every((player) => typeof player.updated_at === 'number')).toBe(true)
  })

  it('backs off failed mutations without deleting them', async () => {
    await saveMatch({ id: 202, opposition: 'Retry Team' })
    const [mutation] = await getReadyMutations()

    await markMutationFailed(mutation.id, 'network unavailable')

    expect(await getReadyMutations()).toEqual([])
    const db = await getDB()
    const row = await db.get('sync_outbox', mutation.id)
    expect(row.attempts).toBe(1)
    expect(row.last_error).toBe('network unavailable')
    expect(row.next_retry_at).toBeGreaterThan(Date.now())
  })

  it('removes completed mutations', async () => {
    await saveMatch({ id: 303, opposition: 'Done Team' })
    const [mutation] = await getReadyMutations()

    await markMutationDone(mutation.id)

    expect(await getOutboxCount()).toBe(0)
  })

  it('clears entity data, outbox, and device sentinel on full wipe', async () => {
    await saveSquad([{ id: 1, name: 'A Player', number: 1, position: 'GK' }])
    await saveMatch({ id: 404, opposition: 'Old Team' })
    await deleteMatch(404)
    await setLastUserId('user-a')

    await clearAllData()

    expect(await loadSquad()).toEqual([])
    expect(await loadMatches()).toEqual([])
    expect(await getOutboxCount()).toBe(0)
    expect(await getLastUserId()).toBe(null)
  })
})
