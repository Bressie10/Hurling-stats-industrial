import { env } from '$env/dynamic/public'

export function apiUrl(path) {
  const cleanPath = String(path || '').startsWith('/') ? String(path || '') : `/${path || ''}`
  const base = String(env.PUBLIC_API_BASE_URL || '').trim().replace(/\/$/, '')
  return base ? `${base}${cleanPath}` : cleanPath
}
