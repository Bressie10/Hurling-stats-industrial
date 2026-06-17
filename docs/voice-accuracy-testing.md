# Voice Accuracy Field Testing

Last updated: 2026-06-17

Use this before calling live voice logging field-ready. Unit tests and simulator builds only verify the parser path; the release bar is real pitch accuracy with the actual device microphone, local accent/noise conditions, and an installed offline speech model.

## Physical Test Scope

Target v1 field-test voice stats:

- Point
- Goal
- Wide
- Free Won
- Turnover Lost
- Yellow Card

Known limitation for this field test:

- black/red cards
- 45s
- sideline balls

Use tap entry for these. Do not tune parser vocabulary or thresholds for unsupported events until physical-device data has been reviewed.

The current parser accepts full names, surnames where unambiguous, initials for duplicated surnames, jersey numbers, number words such as `eleven` or `fourteen`, and native STT alternatives when the first transcript does not parse.

## Harness

The harness is hidden in production by default. It is visible in dev mode or in a deliberately flagged build:

```sh
PUBLIC_ENABLE_VOICE_TEST=1 npm run dev
```

For native field testing, keep the flag in the environment while building/syncing the app:

```sh
PUBLIC_ENABLE_VOICE_TEST=1 npm run native:android:build
```

Open this route inside the signed-in app after using a flagged build:

```text
/app/voice-test
```

The harness:

- loads the local squad roster
- uses the same native on-device STT wrapper as `LiveVoiceLogger`
- runs transcripts through the same `parseVoiceLog` pipeline
- records native STT or typed transcript samples
- shows the latest transcript, parsed player/stat result, parser status, and network/offline indicator on screen
- provides large Correct, Fixable, and Incorrect buttons for quick one-handed annotation
- stores samples locally in `localStorage`
- exports CSV with transcript, native STT confidence, STT alternatives, recognizer diagnostics, expected result, parsed result, parser confidence, match source, candidates, manual annotation, device label, user agent, network mode, connection type, and ambient condition notes
- summarizes reviewed samples as `% correct first try`, `% correctable`, and `% requiring full re-attempt`

Known limitation shown in the app: black/red cards, 45s, and sideline balls are not currently voice-loggable in v1. Use tap entry for these during field tests.

## Android Sideload Build

Build a debug APK for a physical Android phone:

```sh
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PUBLIC_ENABLE_VOICE_TEST=1
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:/opt/homebrew/bin:$PATH"

npm run native:android:build
```

The APK path is:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Install it on a USB-connected Android phone:

```sh
adb devices
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n ie.pitchnote.app/.MainActivity
```

If `adb devices` shows `unauthorized`, unlock the phone and accept the USB debugging prompt. If no device appears, enable Developer Options and USB debugging on the phone, then reconnect the cable.

## Outdoor Session

1. Build and install the native app on the test phone.
2. Sign in, load or create the squad, then open `/app/voice-test`.
3. Select the expected player and stat before each command.
4. Enter the device model and ambient condition note before the session.
5. Confirm the on-screen network indicator says `Offline / airplane mode` before offline STT samples.
6. Record the same commands you expect to use during a match, from match-day distance and noise levels.
7. Annotate each row:
   - `Correct first try`: parsed player and stat were right.
   - `Correctable`: usable with candidate selection, fix, or undo/fix flow.
   - `Re-attempt`: no useful event could be logged without speaking again.
   - `Bad sample`: exclude the row from summary math.
8. Export CSV after the session and keep the file with the device, OS, venue/noise, and squad notes.

## Android Offline Model Check

The Android plugin sets `RecognizerIntent.EXTRA_PREFER_OFFLINE` for every live voice recognition request. Android does not provide a reliable app-level API to prove that an offline language model is installed before recognition starts, so this must be verified on the target test device:

1. Install or download the device's offline speech recognition language model for English/Ireland or the closest available English locale.
2. Put the device in airplane mode.
3. Open `/app/voice-test` and confirm the on-screen indicator says `Offline / airplane mode`.
4. Record at least 10 commands.
5. If recognition returns `ERROR_NETWORK`, `ERROR_NETWORK_TIMEOUT`, or an availability failure, treat the device as missing offline STT support.

Fallback behavior when offline STT is unavailable:

- no match event is logged
- `LiveVoiceLogger` shows `Offline speech recognition is unavailable on this device.`
- the harness records an `stt_error` sample with the failure reason
- the user must use tap logging or install/download the offline speech model before retesting voice

Do not mark Android voice support as complete until this check passes on a real Android device or emulator image with working speech services and an offline model.
