// SvelteKit service worker — `build`, `files`, and `version` are injected at
// build time, so hashed asset URLs are always current and the cache name
// auto-bumps on every deploy.
import { base, build, files, version } from '$service-worker'
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public'
import {
  getDB,
  getOutboxCount,
  getReadyMutations,
  markMutationDone,
  markMutationFailed,
} from '$lib/db.js'
import {
  BACKGROUND_SYNC_AUTH_KEY,
  BACKGROUND_SYNC_TAG,
  matchToData,
  msToIso,
  normalizePayloadTeamScope,
} from '$lib/sync-payloads.js'
import { sanitizeTeamPlayerUpsertPayload } from '$lib/player-data-privacy.js'
import {
  playerHasDisplayName,
  playerIdentity,
  playerName,
  playerNumber,
} from '$lib/team-players.js'

const CACHE = `gaa-${version}`
const SHELL = `${base || ''}/`

// '/' is the SPA shell (all routes are CSR-only) — cached for offline navigation.
const PRECACHE = [SHELL, ...build, ...files]

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return

  const url = new URL(e.request.url)

  // Network-first for Supabase (auth + data must be fresh)
  if (url.hostname.includes('supabase.co')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)))
    return
  }

  // Network-first for navigations so deploys are picked up immediately;
  // cached shell keeps the app working offline at low-signal grounds.
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match(SHELL)))
    return
  }

  // Cache-first for everything else (build assets are hashed, so stale
  // entries are impossible; fonts and images get runtime-cached on first use)
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached
      return fetch(e.request).then((res) => {
        if (!res || res.status !== 200 || res.type === 'opaque') return res
        const clone = res.clone()
        caches.open(CACHE).then((c) => c.put(e.request, clone))
        return res
      })
    }),
  )
})

self.addEventListener('sync', (e) => {
  if (e.tag !== BACKGROUND_SYNC_TAG) return
  e.waitUntil(handleOutboxBackgroundSync())
})

async function handleOutboxBackgroundSync() {
  const windows = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  })
  const visibleClient = windows.find(
    (client) => client.visibilityState === 'visible' || client.focused,
  )

  if (visibleClient) {
    windows.forEach((client) => client.postMessage({ type: 'PITCHNOTE_DRAIN_OUTBOX' }))
    return
  }

  const status = await drainOutboxFromServiceWorker()
  if (status === 'pending') {
    throw new Error('Background sync outbox still pending.')
  }
}

async function getBackgroundSyncAuth() {
  const db = await getDB()
  const row = await db.get('device_state', BACKGROUND_SYNC_AUTH_KEY)
  const auth = row?.value
  if (!auth?.user_id || !auth?.access_token) return null

  const expiresAtMs = Number(auth.expires_at || 0) * 1000
  if (expiresAtMs && expiresAtMs <= Date.now() + 60000) return null

  return {
    userId: auth.user_id,
    accessToken: auth.access_token,
    supabaseUrl: auth.supabase_url || PUBLIC_SUPABASE_URL,
    supabaseAnonKey: auth.supabase_anon_key || PUBLIC_SUPABASE_ANON_KEY,
  }
}

function restUrl(auth, table, params = {}) {
  const url = new URL(`${String(auth.supabaseUrl || '').replace(/\/$/, '')}/rest/v1/${table}`)
  Object.entries(params).forEach(([key, value]) => {
    if (value != null) url.searchParams.set(key, value)
  })
  return url
}

async function supabaseRest(
  auth,
  table,
  { method = 'GET', params = {}, body = null, prefer = null } = {},
) {
  if (!auth.supabaseUrl || !auth.supabaseAnonKey) {
    throw new Error('Supabase background sync config missing.')
  }

  const headers = {
    apikey: auth.supabaseAnonKey,
    Authorization: `Bearer ${auth.accessToken}`,
  }
  if (body !== null) headers['Content-Type'] = 'application/json'
  if (prefer) headers.Prefer = prefer

  const response = await fetch(restUrl(auth, table, params), {
    method,
    headers,
    body: body === null ? null : JSON.stringify(body),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(detail || `Supabase REST ${method} ${table} failed with ${response.status}`)
  }

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) return response.json()
  return null
}

async function applyMutationFromServiceWorker(auth, mutation) {
  const userId = auth.userId

  if (mutation.op === 'upsert_match') {
    const data = matchToData(mutation.payload)
    await supabaseRest(auth, 'matches', {
      method: 'POST',
      params: { on_conflict: 'id,user_id' },
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: {
        id: String(mutation.payload.id),
        user_id: userId,
        team_id: mutation.team_id ?? data.teamId ?? null,
        data,
      },
    })
    return
  }

  if (mutation.op === 'delete_match') {
    await supabaseRest(auth, 'matches', {
      method: 'DELETE',
      params: {
        id: `eq.${String(mutation.entity_id)}`,
        user_id: `eq.${userId}`,
      },
    })
    return
  }

  if (mutation.op === 'upsert_team_players') {
    const teamScope = normalizePayloadTeamScope(mutation.teamScope ?? mutation.team_id)
    const teamId = mutation.team_id ?? (teamScope === 'personal' ? null : teamScope)
    const players = await sanitizeTeamPlayerUpsertPayload(mutation.payload || [])
    if (!teamId) return

    const rows = players.filter(playerHasDisplayName).map((player) => ({
      id: playerIdentity(player),
      team_id: teamId,
      display_name: playerName(player).trim(),
      default_number: playerNumber(player) ?? null,
      position: player.position ?? null,
      status: player.status || 'active',
      joined_at: player.joined_at ?? null,
      left_at: player.left_at ?? null,
      updated_at: msToIso(player.updated_at),
    }))

    if (rows.length > 0) {
      await supabaseRest(auth, 'team_players', {
        method: 'POST',
        params: { on_conflict: 'id' },
        prefer: 'resolution=merge-duplicates,return=minimal',
        body: rows,
      })
    }
    return
  }

  throw new Error(`Unknown mutation op: ${mutation.op}`)
}

async function drainOutboxFromServiceWorker() {
  const auth = await getBackgroundSyncAuth()
  if (!auth) return 'auth-unavailable'

  while (true) {
    const ready = await getReadyMutations(50)
    if (ready.length === 0) break

    let progressed = false
    for (const mutation of ready) {
      try {
        await applyMutationFromServiceWorker(auth, mutation)
        await markMutationDone(mutation.id)
        progressed = true
      } catch (error) {
        await markMutationFailed(mutation.id, error?.message || String(error))
      }
    }

    if (!progressed) break
  }

  return (await getOutboxCount()) === 0 ? 'empty' : 'pending'
}
