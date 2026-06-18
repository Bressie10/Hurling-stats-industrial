const DEFAULT_APP_URL = 'https://www.pitchnote.ie'

const nativeOrigins = new Set(['capacitor://localhost', 'ionic://localhost'])

function defaultWebOrigin(): string {
  try {
    return new URL(Deno.env.get('APP_URL') || DEFAULT_APP_URL).origin
  } catch {
    return new URL(DEFAULT_APP_URL).origin
  }
}

function normalizeOrigin(value: string | null | undefined): string | null {
  const origin = String(value || '').trim()
  if (!origin || origin === 'null') return null
  return origin.replace(/\/$/, '')
}

function configuredWebOrigins(): Set<string> {
  const origins = new Set<string>()
  for (const value of [DEFAULT_APP_URL, Deno.env.get('APP_URL')]) {
    try {
      if (value) origins.add(new URL(value).origin)
    } catch {
      // Invalid APP_URL is validated by billing helpers when redirects are created.
    }
  }

  const extraOrigins = String(Deno.env.get('ALLOWED_CORS_ORIGINS') || '')
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean) as string[]
  for (const origin of extraOrigins) origins.add(origin)
  return origins
}

function isLocalWebOrigin(origin: string): boolean {
  try {
    const url = new URL(origin)
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    )
  } catch {
    return false
  }
}

function getAllowedOrigin(req: Request): string {
  const origin = normalizeOrigin(req.headers.get('Origin'))
  if (!origin) return defaultWebOrigin()
  if (nativeOrigins.has(origin) || configuredWebOrigins().has(origin) || isLocalWebOrigin(origin)) {
    return origin
  }
  return defaultWebOrigin()
}

export function getCorsHeaders(req: Request): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': getAllowedOrigin(req),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    Vary: 'Origin',
  }
}
