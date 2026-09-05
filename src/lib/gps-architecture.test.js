import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  GPS_SESSION_STREAM_INVARIANTS,
  GPS_TELEMETRY_CONTRACT,
  GPS_TELEMETRY_OPTIONAL_FIELDS,
  GPS_TELEMETRY_REQUIRED_FIELDS,
} from './gps-core.js'

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

describe('GPS architecture boundaries', () => {
  it('documents one internal receiver-to-ingestion telemetry contract', () => {
    expect(GPS_TELEMETRY_CONTRACT.shape).toBe('internal_receiver_to_local_ingestion')
    expect(GPS_TELEMETRY_REQUIRED_FIELDS).toEqual([
      'sessionId',
      'trackerId',
      'trackerStreamId',
      'sequence',
      'capturedAt',
      'latitude',
      'longitude',
    ])
    expect(GPS_TELEMETRY_OPTIONAL_FIELDS).toEqual(['speedMps', 'accuracyM', 'batteryPercent'])
    expect(GPS_TELEMETRY_CONTRACT.units.speedMps).toBe('meters_per_second')
    expect(GPS_TELEMETRY_CONTRACT.notes.join(' ')).toContain('samples do not carry names')
  })

  it('documents foundational stream invariants for future receiver work', () => {
    expect(GPS_SESSION_STREAM_INVARIANTS).toEqual(
      expect.arrayContaining([
        expect.stringContaining('stable sessionId'),
        expect.stringContaining('starts sequence at 0'),
        expect.stringContaining('connection loss keeps the same trackerStreamId'),
        expect.stringContaining('new trackerStreamId and may reset sequence'),
      ]),
    )
  })

  it('keeps the receiver path wired through local GPS ingestion', () => {
    const receiver = source('./gps-receiver.js')

    expect(receiver).toContain('ingestLocalGpsSample')
    expect(receiver).toContain('createLocalGpsIngestionAdapter')
    expect(receiver).toContain('handlers: [createLocalGpsIngestionAdapter({ ingest })]')
  })

  it('keeps dashboard and dev UI out of raw ingestion and Supabase paths', () => {
    const dashboard = source('./gps-dashboard.js')
    const devDashboard = source('./GpsDevDashboard.svelte')

    expect(dashboard).toContain('loadLocalGpsDashboardState')
    expect(dashboard).not.toContain('ingestLocalGpsSample')
    expect(dashboard).not.toContain('supabase')
    expect(devDashboard).toContain('loadLocalGpsDashboardState')
    expect(devDashboard).toContain('createMockGpsReceiver')
    expect(devDashboard).not.toContain('ingestLocalGpsSample')
    expect(devDashboard).not.toContain('getDB')
    expect(devDashboard).not.toContain('supabase')
  })

  it('keeps high-volume GPS data out of the generic stats sync outbox', () => {
    const local = source('./gps-local.js')
    const db = source('./db.js')
    const sync = source('./sync.js')
    const serviceWorker = readFileSync(new URL('../service-worker.js', import.meta.url), 'utf8')

    expect(local).toContain("const GPS_SYNC_QUEUE_STORE = 'gps_sync_queue'")
    expect(local).not.toContain('sync_outbox')
    expect(db).toContain('gps_sync_queue')
    expect(db).toContain('sync_outbox')
    expect(sync).not.toContain('gps_sync_queue')
    expect(serviceWorker).not.toContain('gps_sync_queue')
  })
})
