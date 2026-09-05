# Local-First GPS Architecture

This document describes the current GPS proof-of-concept infrastructure. It is a
software foundation for future tracker hardware; it does not define the final
radio/wire protocol and it does not implement cloud GPS upload yet.

## Flow

```text
Tracker or mock tracker
-> receiver boundary
-> ingestLocalGpsSample(...)
-> IndexedDB GPS stores
-> local dashboard/view model
-> future trusted cloud sync API/RPC
```

Live GPS does not depend on Supabase Realtime or a cloud write path during a
session. Cloud tables and RLS exist for the future history/sync store.

## Module Responsibilities

- `src/lib/gps-core.js`: shared GPS-only primitives, internal telemetry contract,
  timestamp helpers, UUID helper, and documented stream invariants.
- `src/lib/gps-local.js`: local GPS domain rules and IndexedDB persistence for
  trackers, sessions, assignments, raw chunks, latest state, stream state,
  cleanup candidates, and the GPS sync queue.
- `src/lib/gps-receiver.js`: transport-independent receiver boundary plus
  development-only `MockGpsReceiver` and `MockGpsTracker`.
- `src/lib/gps-dashboard.js`: dashboard/view-model helpers only. It reads local
  GPS state and formats rows/pitch points; it does not ingest telemetry.
- `src/lib/GpsDevDashboard.svelte`: development UI composition and user
  interaction for `/app/gps-dev`.
- `src/lib/db.js`: IndexedDB schema and generic database access.

## Main Entities

- Team player: canonical `team_players` identity. GPS samples never carry player
  names; identity is resolved through assignments.
- Tracker: club-owned reusable device, stored locally in `gps_trackers` and
  cloud-side in `trackers`.
- Session: team-specific GPS recording window, stored in `gps_sessions`.
- Assignment: tracker-to-team-player mapping for a time range, stored in
  `gps_tracker_assignments` locally and `tracker_player_assignments` in Supabase.
- Stream: one continuous tracker recording stream identified by
  `trackerStreamId` locally and `tracker_stream_id` in SQL.
- Sample: raw GPS point in stored units, chunked locally in `gps_sample_chunks`.
- Latest state: rebuildable dashboard cache in `gps_latest`.
- Stream state: local reconnect/gap tracking in `gps_tracker_stream_state`.

JavaScript uses camelCase (`trackerStreamId`, `capturedAt`, `assignedFrom`).
SQL uses snake_case (`tracker_stream_id`, `captured_at`, `assigned_from`).

## Internal Telemetry Contract

Receivers emit one internal telemetry shape into local ingestion:

```js
{
  sessionId,
  trackerId,
  trackerStreamId,
  sequence,
  capturedAt,
  latitude,
  longitude,
  speedMps,
  accuracyM,
  batteryPercent,
}
```

Required fields are `sessionId`, `trackerId`, `trackerStreamId`, `sequence`,
`capturedAt`, `latitude`, and `longitude`. Optional fields are `speedMps`,
`accuracyM`, and `batteryPercent`.

Stored units are decimal degrees for latitude/longitude, meters per second for
speed, meters for accuracy, and percentage `0..100` for battery. `capturedAt` is
the tracker capture time, not the app receive time. `sequence` is scoped to a
single `sessionId` + `trackerId` + `trackerStreamId` tuple and starts at `0` for
a new stream.

## Session And Stream Rules

- A new GPS session has a stable `sessionId`.
- A tracker recording stream has a `trackerStreamId`; sequence starts at `0`.
- Normal connection loss does not create a new stream. The same
  `trackerStreamId` continues and sequence keeps increasing.
- Buffered samples may arrive later and out of order.
- A tracker reboot or explicit new recording stream uses a new
  `trackerStreamId`; sequence may restart at `0`.
- Tracker reassignment must create a clean assignment boundary. A stored raw
  sample chunk cannot mix assignment IDs.
- Active sessions accept samples captured at or after `startedAt`.
- Ended sessions accept buffered samples captured at or before `endedAt`; samples
  captured after `endedAt` are rejected.

## IndexedDB Stores

- `gps_trackers`: local club tracker registry.
- `gps_sessions`: local team GPS session records.
- `gps_tracker_assignments`: tracker/player assignment history.
- `gps_sample_chunks`: raw sample chunks keyed by session/tracker/stream/chunk
  start sequence.
- `gps_latest`: rebuildable latest-state dashboard cache.
- `gps_tracker_stream_state`: last received sequence and missing ranges for
  reconnect handling.
- `gps_sync_queue`: GPS-specific queue for sessions, assignments, chunks, and
  future summaries.

GPS telemetry intentionally does not enter the generic `sync_outbox`. The normal
outbox handles lower-volume match and team-player mutations; GPS chunks need a
separate protocol and retry policy.

## Offline Behavior

An already authenticated coach can continue an active local GPS session if
network connectivity drops. A short offline reopen/recovery foundation exists
through the bounded local GPS auth context in `gps-auth.js`. True cold-start
offline login is not treated as secure because the app cannot prove current
Supabase membership or revocation state without a previous bounded local auth
context.

## Local Cleanup Foundation

Raw GPS remains local while it is needed for an active/offline session or unsynced
recovery. `gps-local.js` exposes cleanup primitives to inspect storage, identify
synced ended raw chunks, and delete only cleanup-eligible raw data. Cleanup is
idempotent and does not delete unsynced telemetry automatically.

## Implemented

- Local session lifecycle.
- Local club tracker registry.
- Tracker/player assignment validation against canonical team players.
- Transport-independent receiver boundary.
- Mock receiver and mock trackers for `/app/gps-dev` and tests.
- Chunked raw telemetry storage.
- Latest-state cache.
- Stream gap tracking for out-of-order/buffered samples.
- GPS-specific sync queue metadata.
- Local cleanup eligibility and synced raw cleanup primitives.
- Supabase GPS schema, composite foreign keys, and RLS for future history reads.

## Deliberately Deferred

- Real BLE, Wi-Fi, ESP-NOW, TCP/UDP, or base-station transport.
- Final tracker wire encoding.
- Cloud GPS upload API/RPC.
- Cloud GPS queue drain.
- Advanced GPS analytics, heatmaps, sprint algorithms, or IMU ingestion.
- Final legal retention policy.
- Final player data export/deletion UI.
- Production encryption/key-management design.
