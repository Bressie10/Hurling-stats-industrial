# Store Listing Draft

Last updated: 2026-06-17

## Release Note Draft

PitchNote includes a native voice logging test flow for real-device field validation. Coaches can test on-device speech recognition against their squad roster, review the parsed player/stat result, annotate whether each result was correct, and export a CSV with STT alternatives, confidence, recognizer diagnostics, match source, and ambient conditions for post-session review.

Known limitation: black/red cards, 45s, and sideline balls are not currently voice-loggable in v1. Use tap entry for these. Yellow Card is included in the supported v1 parser when the stat exists in the match schema.

Voice logging is still in field validation and should not be described as field-ready until real-pitch testing passes on physical iOS and Android devices.

## Store Listing Safety Copy

Native iOS and Android builds are companion clients for existing PitchNote accounts. They support signed-in match logging, local storage, cloud sync, and account entitlements. Plan purchases and plan management are handled on the web and are not offered inside native builds.

Live voice logging uses on-device speech recognition for supported match stats and does not send live match commands to a cloud speech or LLM service.
