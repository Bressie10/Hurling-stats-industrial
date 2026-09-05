import FDBFactory from 'fake-indexeddb/lib/FDBFactory'
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearAllData,
  countFinishedMatches,
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
import { createRosterPlayer, isUuid } from './team-players.js'

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

  it('counts finished matches across every local team scope for account quotas', async () => {
    const teamScope = '00000000-0000-4000-8000-000000000001'
    await saveDraftMatch({ opposition: 'Draft Team' })
    await saveMatch({ id: 101, opposition: 'Personal Match' })
    await saveMatch({ id: 102, opposition: 'Team Match' }, { teamScope })

    expect(await loadMatches()).toMatchObject([{ id: 101, opposition: 'Personal Match' }])
    expect(await loadMatches({ teamScope })).toMatchObject([{ id: 102, opposition: 'Team Match' }])
    expect(await countFinishedMatches()).toBe(2)
  })

  it('stores team players with stable UUID identities and enqueues team-player sync', async () => {
    const teamScope = '00000000-0000-4000-8000-000000000001'
    await saveSquad(
      [
        createRosterPlayer({ name: 'A Player', number: 1, position: 'GK' }),
        createRosterPlayer({ name: 'B Player', number: 2, position: 'FB' }),
      ],
      { teamScope },
    )

    const squad = await loadSquad({ teamScope })
    const [mutation] = await getReadyMutations()

    expect(squad.map((player) => player.name)).toEqual(['A Player', 'B Player'])
    expect(squad.every((player) => isUuid(player.id))).toBe(true)
    expect(mutation.op).toBe('upsert_team_players')
    expect(mutation.team_id).toBe(teamScope)
    expect(mutation.payload).toHaveLength(2)
    expect(mutation.payload.every((player) => typeof player.updated_at === 'number')).toBe(true)
  })

  it('allows duplicate player names because identity is the UUID', async () => {
    const teamScope = '00000000-0000-4000-8000-000000000001'
    const first = createRosterPlayer({ name: 'John Murphy', number: 10, position: 'HF' })
    const second = createRosterPlayer({ name: 'John Murphy', number: 11, position: 'HF' })

    await saveSquad([first, second], { teamScope })

    const squad = await loadSquad({ teamScope })
    expect(squad.map((player) => player.name)).toEqual(['John Murphy', 'John Murphy'])
    expect(new Set(squad.map((player) => player.id)).size).toBe(2)
  })

  it('keeps player identity stable when name or jersey number changes', async () => {
    const teamScope = '00000000-0000-4000-8000-000000000001'
    const player = createRosterPlayer({ name: 'Old Name', number: 7, position: 'MF' })

    await saveSquad([player], { teamScope })
    await saveSquad([{ ...player, name: 'New Name', number: 12 }], { teamScope })

    await expect(loadSquad({ teamScope })).resolves.toMatchObject([
      { id: player.id, name: 'New Name', number: 12 },
    ])
  })

  it('keeps team rosters separated by active team scope', async () => {
    const teamA = '00000000-0000-4000-8000-000000000001'
    const teamB = '00000000-0000-4000-8000-000000000002'

    await saveSquad([createRosterPlayer({ name: 'Team A Player', number: 1 })], {
      teamScope: teamA,
    })
    await saveSquad([createRosterPlayer({ name: 'Team B Player', number: 1 })], {
      teamScope: teamB,
    })

    await expect(loadSquad({ teamScope: teamA })).resolves.toMatchObject([
      { name: 'Team A Player' },
    ])
    await expect(loadSquad({ teamScope: teamB })).resolves.toMatchObject([
      { name: 'Team B Player' },
    ])
  })

  it('syncs removed players as inactive instead of deleting their identity', async () => {
    const teamScope = '00000000-0000-4000-8000-000000000001'
    const player = createRosterPlayer({ name: 'Leaving Player', number: 5 })
    await saveSquad([player], { teamScope })
    await markMutationDone((await getReadyMutations())[0].id)

    await saveSquad([], { teamScope })
    const [mutation] = await getReadyMutations()

    expect(await loadSquad({ teamScope })).toEqual([])
    expect(mutation.payload).toMatchObject([{ id: player.id, status: 'inactive' }])
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
