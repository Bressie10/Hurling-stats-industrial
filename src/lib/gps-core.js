export const GPS_TELEMETRY_REQUIRED_FIELDS = Object.freeze([
  'sessionId',
  'trackerId',
  'trackerStreamId',
  'sequence',
  'capturedAt',
  'latitude',
  'longitude',
])

export const GPS_TELEMETRY_OPTIONAL_FIELDS = Object.freeze([
  'speedMps',
  'accuracyM',
  'batteryPercent',
])

export const GPS_TELEMETRY_UNITS = Object.freeze({
  latitude: 'decimal_degrees',
  longitude: 'decimal_degrees',
  speedMps: 'meters_per_second',
  accuracyM: 'meters',
  batteryPercent: 'percent_0_to_100',
  capturedAt: 'iso_8601_utc_or_epoch_ms',
  sequence: 'integer_starting_at_0_per_tracker_stream',
})

export const GPS_TELEMETRY_CONTRACT = Object.freeze({
  shape: 'internal_receiver_to_local_ingestion',
  requiredFields: GPS_TELEMETRY_REQUIRED_FIELDS,
  optionalFields: GPS_TELEMETRY_OPTIONAL_FIELDS,
  units: GPS_TELEMETRY_UNITS,
  notes: Object.freeze([
    'sessionId, trackerId, and trackerStreamId are stable string IDs.',
    'sequence is scoped to one session/tracker/trackerStreamId tuple.',
    'capturedAt is when the tracker captured the point, not when the app received it.',
    'player identity is resolved from tracker assignment at capturedAt; samples do not carry names.',
  ]),
})

export const GPS_SESSION_STREAM_INVARIANTS = Object.freeze([
  'A new GPS session has a stable sessionId.',
  'A recording stream has a trackerStreamId and starts sequence at 0.',
  'Normal connection loss keeps the same trackerStreamId and sequence continues.',
  'Buffered samples may arrive later and out of order.',
  'A tracker reboot or explicit new recording stream uses a new trackerStreamId and may reset sequence.',
  'A tracker reassignment must not hide a new assignment inside an old stream chunk.',
])

export function nowMs() {
  return Date.now()
}

export function timestampToMs(value) {
  if (value instanceof Date) {
    const ms = value.getTime()
    return Number.isFinite(ms) ? ms : null
  }
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export function toIsoOrNull(value) {
  const ms = timestampToMs(value)
  return ms == null ? null : new Date(ms).toISOString()
}

export function toIsoOrNow(value, fallbackMs = nowMs()) {
  const ms = timestampToMs(value)
  return new Date(ms ?? fallbackMs).toISOString()
}

export function createGpsUuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()

  const bytes = new Uint8Array(16)
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256)
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
