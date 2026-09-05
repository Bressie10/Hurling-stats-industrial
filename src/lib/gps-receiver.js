import { GPS_SAMPLE_CHUNK_SIZE, ingestLocalGpsSample } from './gps-local.js'
import { createGpsUuid, nowMs, timestampToMs, toIsoOrNow } from './gps-core.js'

export const MOCK_GPS_DEFAULT_INTERVAL_MS = 1000

export const MOCK_GPS_DELIVERY_STATUS = Object.freeze({
  DELIVERED: 'delivered',
  BUFFERED: 'buffered',
  STOPPED: 'stopped',
})

const METERS_PER_LATITUDE_DEGREE = 111_320

function toIso(value) {
  return toIsoOrNow(value)
}

function hashSeed(value) {
  const text = String(value ?? 'mock-gps')
  let hash = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function createSeededRandom(seed) {
  let state = hashSeed(seed)
  return () => {
    state = Math.imul(1664525, state) + 1013904223
    return (state >>> 0) / 4294967296
  }
}

function longitudeMetersPerDegree(latitude) {
  const cos = Math.cos((latitude * Math.PI) / 180)
  return Math.max(1, METERS_PER_LATITUDE_DEGREE * Math.abs(cos))
}

function moveLatLon(latitude, longitude, headingDegrees, distanceM) {
  if (!Number.isFinite(distanceM) || distanceM === 0) return { latitude, longitude }
  const radians = (headingDegrees * Math.PI) / 180
  const northM = Math.cos(radians) * distanceM
  const eastM = Math.sin(radians) * distanceM
  return {
    latitude: latitude + northM / METERS_PER_LATITUDE_DEGREE,
    longitude: longitude + eastM / longitudeMetersPerDegree(latitude),
  }
}

function distanceMeters(a, b) {
  const northM = (b.latitude - a.latitude) * METERS_PER_LATITUDE_DEGREE
  const eastM = (b.longitude - a.longitude) * longitudeMetersPerDegree(a.latitude)
  return Math.sqrt(northM * northM + eastM * eastM)
}

function bearingDegrees(a, b) {
  const northM = (b.latitude - a.latitude) * METERS_PER_LATITUDE_DEGREE
  const eastM = (b.longitude - a.longitude) * longitudeMetersPerDegree(a.latitude)
  const degrees = (Math.atan2(eastM, northM) * 180) / Math.PI
  return (degrees + 360) % 360
}

function normalizeRoute(route = []) {
  return route
    .map((point) => ({
      latitude: Number(point.latitude),
      longitude: Number(point.longitude),
    }))
    .filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude))
}

function cloneTelemetry(sample) {
  return { ...sample }
}

export function createLocalGpsIngestionAdapter({ ingest = ingestLocalGpsSample } = {}) {
  return function localGpsIngestionAdapter(telemetry, context = {}) {
    const options = {}
    if (context.receivedAt != null) options.receivedAt = context.receivedAt
    if (context.futureToleranceMs != null) options.futureToleranceMs = context.futureToleranceMs
    return ingest(telemetry, options)
  }
}

// Transport boundary: real receivers should emit the internal telemetry contract
// and subscribe this adapter. The mock implementation below is development-only.
export class GpsTelemetryReceiver {
  constructor({ handlers = [] } = {}) {
    this.handlers = new Set(handlers)
  }

  subscribe(handler) {
    if (typeof handler !== 'function') {
      throw new TypeError('GPS telemetry handler must be a function.')
    }
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  async emitTelemetry(telemetry, context = {}) {
    const results = []
    for (const handler of this.handlers) {
      results.push(await handler(telemetry, context))
    }
    return {
      telemetry,
      context,
      results,
      ingestion: results[0] ?? null,
    }
  }
}

export class MockGpsTracker {
  constructor({
    trackerId,
    sessionId,
    trackerStreamId = createGpsUuid(),
    sequence = 0,
    latitude = 53.3498,
    longitude = -6.2603,
    speedMps = 0,
    accuracyM = 3,
    batteryPercent = null,
    headingDegrees = 90,
    connected = true,
    route = [],
    routeIndex = 0,
    noiseM = 0,
    seed = trackerId,
  } = {}) {
    if (!trackerId) throw new TypeError('trackerId is required for a mock GPS tracker.')
    if (!sessionId) throw new TypeError('sessionId is required for a mock GPS tracker.')

    this.trackerId = String(trackerId)
    this.sessionId = String(sessionId)
    this.trackerStreamId = String(trackerStreamId)
    this.sequence = Number(sequence) || 0
    this.latitude = Number(latitude)
    this.longitude = Number(longitude)
    this.speedMps = Number(speedMps) || 0
    this.accuracyM = accuracyM == null ? null : Number(accuracyM)
    this.batteryPercent = batteryPercent == null ? null : Number(batteryPercent)
    this.headingDegrees = Number(headingDegrees) || 0
    this.connected = connected !== false
    this.route = normalizeRoute(route)
    this.routeIndex = Math.max(0, Number(routeIndex) || 0)
    this.noiseM = Math.max(0, Number(noiseM) || 0)
    this.random = createSeededRandom(seed)
    this.buffer = []
    this.history = new Map()
  }

  snapshot() {
    return {
      trackerId: this.trackerId,
      sessionId: this.sessionId,
      trackerStreamId: this.trackerStreamId,
      sequence: this.sequence,
      latitude: this.latitude,
      longitude: this.longitude,
      speedMps: this.speedMps,
      accuracyM: this.accuracyM,
      batteryPercent: this.batteryPercent,
      connected: this.connected,
      bufferedCount: this.buffer.length,
    }
  }

  setConnected(connected) {
    this.connected = Boolean(connected)
    return this.snapshot()
  }

  setSpeed(speedMps) {
    const speed = Number(speedMps)
    if (!Number.isFinite(speed) || speed < 0) throw new TypeError('Mock GPS speed must be >= 0.')
    this.speedMps = speed
    return this.snapshot()
  }

  setRoute(route, { routeIndex = 0 } = {}) {
    this.route = normalizeRoute(route)
    this.routeIndex = Math.max(0, Number(routeIndex) || 0)
    return this.snapshot()
  }

  restartStream({ trackerStreamId = createGpsUuid(), resetSequence = true } = {}) {
    this.trackerStreamId = String(trackerStreamId)
    if (resetSequence) this.sequence = 0
    this.buffer = []
    return this.snapshot()
  }

  generateSample({ capturedAt = nowMs(), stepSeconds = 1, overrides = {} } = {}) {
    const sequence = Number.isInteger(overrides.sequence) ? overrides.sequence : this.sequence
    this.sequence = Math.max(this.sequence, sequence + 1)

    const noisy = this._noisyPosition()
    const sample = {
      sessionId: String(overrides.sessionId ?? this.sessionId),
      trackerId: String(overrides.trackerId ?? this.trackerId),
      trackerStreamId: String(overrides.trackerStreamId ?? this.trackerStreamId),
      sequence,
      capturedAt: toIso(overrides.capturedAt ?? capturedAt),
      latitude: Number(overrides.latitude ?? noisy.latitude),
      longitude: Number(overrides.longitude ?? noisy.longitude),
      speedMps: overrides.speedMps ?? this.speedMps,
      accuracyM: overrides.accuracyM ?? this.accuracyM,
      batteryPercent: overrides.batteryPercent ?? this.batteryPercent,
    }

    this.history.set(`${sample.trackerStreamId}:${sample.sequence}`, cloneTelemetry(sample))
    this._advancePosition(stepSeconds)
    return sample
  }

  getGeneratedSample(sequence, trackerStreamId = this.trackerStreamId) {
    const sample = this.history.get(`${trackerStreamId}:${sequence}`)
    return sample ? cloneTelemetry(sample) : null
  }

  bufferSample(sample) {
    this.buffer.push(cloneTelemetry(sample))
    return this.buffer.length
  }

  drainBufferedSamples({ order = 'fifo' } = {}) {
    const samples = [...this.buffer]
    this.buffer = []
    if (order === 'lifo') return samples.reverse()
    if (Array.isArray(order)) return order.map((index) => samples[index]).filter(Boolean)
    return samples
  }

  _noisyPosition() {
    if (!this.noiseM) return { latitude: this.latitude, longitude: this.longitude }
    const angle = this.random() * Math.PI * 2
    const distance = this.random() * this.noiseM
    return moveLatLon(this.latitude, this.longitude, (angle * 180) / Math.PI, distance)
  }

  _advancePosition(stepSeconds) {
    const distanceM = this.speedMps * Math.max(0, Number(stepSeconds) || 0)
    if (!distanceM) return

    if (this.route.length > 0) {
      this._advanceAlongRoute(distanceM)
      return
    }

    const next = moveLatLon(this.latitude, this.longitude, this.headingDegrees, distanceM)
    this.latitude = next.latitude
    this.longitude = next.longitude
  }

  _advanceAlongRoute(distanceM) {
    let remaining = distanceM
    while (remaining > 0 && this.routeIndex < this.route.length) {
      const current = { latitude: this.latitude, longitude: this.longitude }
      const target = this.route[this.routeIndex]
      const distanceToTarget = distanceMeters(current, target)
      if (distanceToTarget <= remaining) {
        this.latitude = target.latitude
        this.longitude = target.longitude
        this.routeIndex += 1
        remaining -= distanceToTarget
      } else {
        const heading = bearingDegrees(current, target)
        const next = moveLatLon(this.latitude, this.longitude, heading, remaining)
        this.latitude = next.latitude
        this.longitude = next.longitude
        remaining = 0
      }
    }
  }
}

export class MockGpsReceiver {
  constructor({
    receiver = null,
    ingest = ingestLocalGpsSample,
    intervalMs = MOCK_GPS_DEFAULT_INTERVAL_MS,
    clock = nowMs,
  } = {}) {
    this.receiver =
      receiver ||
      new GpsTelemetryReceiver({
        handlers: [createLocalGpsIngestionAdapter({ ingest })],
      })
    this.intervalMs = intervalMs
    this.clock = clock
    this.trackers = new Map()
    this.timers = new Map()
  }

  createMockTracker(config = {}) {
    const tracker = new MockGpsTracker(config)
    this.trackers.set(tracker.trackerId, tracker)
    return tracker
  }

  getMockTracker(trackerId) {
    return this.trackers.get(String(trackerId)) || null
  }

  getMockTrackerSnapshots() {
    return [...this.trackers.values()].map((tracker) => ({
      ...tracker.snapshot(),
      running: this.timers.has(tracker.trackerId),
    }))
  }

  isMockTrackerRunning(trackerId) {
    return this.timers.has(String(trackerId))
  }

  requireMockTracker(trackerId) {
    const tracker = this.getMockTracker(trackerId)
    if (!tracker) throw new Error(`Mock GPS tracker not found: ${trackerId}`)
    return tracker
  }

  startMockTracker(trackerId, { intervalMs = this.intervalMs } = {}) {
    this.stopMockTracker(trackerId)
    const tracker = this.requireMockTracker(trackerId)
    const timer = setInterval(() => {
      void this.tickTracker(tracker.trackerId)
    }, intervalMs)
    this.timers.set(tracker.trackerId, timer)
    return tracker.snapshot()
  }

  stopMockTracker(trackerId) {
    const key = String(trackerId)
    const timer = this.timers.get(key)
    if (timer) clearInterval(timer)
    this.timers.delete(key)
    return this.getMockTracker(key)?.snapshot() ?? null
  }

  stopAllMockTrackers() {
    for (const trackerId of this.timers.keys()) this.stopMockTracker(trackerId)
  }

  disconnectMockTracker(trackerId) {
    return this.requireMockTracker(trackerId).setConnected(false)
  }

  async reconnectMockTracker(trackerId, { deliverBuffered = true, ...options } = {}) {
    const tracker = this.requireMockTracker(trackerId)
    tracker.setConnected(true)
    if (!deliverBuffered) return []
    return this.flushBufferedTrackerSamples(trackerId, options)
  }

  setMockTrackerSpeed(trackerId, speedMps) {
    return this.requireMockTracker(trackerId).setSpeed(speedMps)
  }

  restartMockTrackerStream(trackerId, options = {}) {
    return this.requireMockTracker(trackerId).restartStream(options)
  }

  generateTrackerSample(trackerId, options = {}) {
    return this.requireMockTracker(trackerId).generateSample({
      capturedAt: options.capturedAt ?? this.clock(),
      stepSeconds: options.stepSeconds ?? this.intervalMs / 1000,
      overrides: options.overrides || {},
    })
  }

  async deliverTelemetry(telemetry, options = {}) {
    const context = {
      source: 'mock',
      receivedAt: options.receivedAt ?? telemetry.capturedAt,
      futureToleranceMs: options.futureToleranceMs,
    }
    const receiverResult = await this.receiver.emitTelemetry(cloneTelemetry(telemetry), context)
    return {
      status: MOCK_GPS_DELIVERY_STATUS.DELIVERED,
      telemetry: cloneTelemetry(telemetry),
      ingestion: receiverResult.ingestion,
      receiverResult,
    }
  }

  async tickTracker(trackerId, options = {}) {
    const tracker = this.requireMockTracker(trackerId)
    const telemetry = tracker.generateSample({
      capturedAt: options.capturedAt ?? this.clock(),
      stepSeconds: options.stepSeconds ?? this.intervalMs / 1000,
      overrides: options.overrides || {},
    })

    if (!tracker.connected) {
      tracker.bufferSample(telemetry)
      return {
        status: MOCK_GPS_DELIVERY_STATUS.BUFFERED,
        telemetry,
        ingestion: null,
      }
    }

    return this.deliverTelemetry(telemetry, options)
  }

  async tickAll(options = {}) {
    const results = []
    for (const trackerId of options.trackerIds || this.trackers.keys()) {
      results.push(await this.tickTracker(trackerId, options))
    }
    return results
  }

  async runAcceleratedTicks(
    count,
    { startAt = this.clock(), stepMs = this.intervalMs, ...options } = {},
  ) {
    const results = []
    const startMs = timestampToMs(startAt) ?? this.clock()
    for (let tick = 0; tick < count; tick += 1) {
      const capturedAt = new Date(startMs + tick * stepMs).toISOString()
      results.push(
        ...(await this.tickAll({
          ...options,
          capturedAt,
          receivedAt: options.receivedAt ?? capturedAt,
          stepSeconds: stepMs / 1000,
        })),
      )
    }
    return results
  }

  async flushBufferedTrackerSamples(trackerId, options = {}) {
    const tracker = this.requireMockTracker(trackerId)
    const samples = tracker.drainBufferedSamples({ order: options.order })
    const results = []
    for (const sample of samples) {
      results.push(
        await this.deliverTelemetry(sample, {
          ...options,
          receivedAt: options.receivedAt ?? sample.capturedAt,
        }),
      )
    }
    return results
  }

  async resendTrackerSample(trackerId, sequence, options = {}) {
    const tracker = this.requireMockTracker(trackerId)
    const sample = tracker.getGeneratedSample(sequence, options.trackerStreamId)
    if (!sample) throw new Error(`Mock GPS sample not found for sequence ${sequence}.`)
    return this.deliverTelemetry(sample, options)
  }
}

export function createMockGpsReceiver(options = {}) {
  return new MockGpsReceiver(options)
}

export function estimateMockGpsSimulation({
  trackerCount = 1,
  durationSeconds = 0,
  sampleIntervalMs = MOCK_GPS_DEFAULT_INTERVAL_MS,
  chunkSize = GPS_SAMPLE_CHUNK_SIZE,
} = {}) {
  const trackers = Math.max(0, Number(trackerCount) || 0)
  const interval = Math.max(1, Number(sampleIntervalMs) || MOCK_GPS_DEFAULT_INTERVAL_MS)
  const samplesPerTracker = Math.ceil((Math.max(0, Number(durationSeconds) || 0) * 1000) / interval)
  const totalSamples = trackers * samplesPerTracker
  return {
    trackerCount: trackers,
    samplesPerTracker,
    totalSamples,
    chunkCount: trackers * Math.ceil(samplesPerTracker / chunkSize),
    latestStateCount: trackers,
    streamStateCount: trackers,
  }
}
