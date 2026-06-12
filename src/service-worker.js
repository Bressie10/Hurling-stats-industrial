// SvelteKit service worker — `build`, `files`, and `version` are injected at
// build time, so hashed asset URLs are always current and the cache name
// auto-bumps on every deploy.
import { base, build, files, version } from '$service-worker'

const CACHE = `gaa-${version}`
const SHELL = `${base || ''}/`

// '/' is the SPA shell (all routes are CSR-only) — cached for offline navigation.
const PRECACHE = [SHELL, ...build, ...files]

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
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
  // cached shell keeps the app working offline at GAA grounds.
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
    })
  )
})
