# Hacker Toes 6.0 verification record

This record describes checks actually run against the 6.0 source in the build workspace. Automated tests use temporary data directories; the real host workspace is not altered by the test suite.

## Automated tests

The integration suite contains tests for the following areas:

- Host-configured four-digit join codes, exact format enforcement, wrong/missing code rejection, hashed storage, failed-attempt rate limiting, and reconnection of an already authenticated session.
- Workspace and member authorization, session secrecy, origin checks, moderation, and host-only controls.
- Chat delivery, edits, deletions, channels, private conversations, threads, reactions, pins, polls, tasks, private notes, scheduled messages, and persistence across restarts.
- Authenticated uploads and private file access.
- Soundboard uploads, single-recipient playback, recipient opt-in/mute behavior, mode minimums, 150% Overdrive authorization, remote-volume permission gates, recipient volume ceilings, minigame and monitor opt-ins, recipient-reported output metadata, receiver-initiated sound stop, per-sender/recipient cooldowns (without a recipient-wide rolling quota).
- Teacher Alert targeting, 35-second payload, recipient opt-out, one-active-alert-per-recipient enforcement, unauthorized dismissal rejection, recipient dismissal, and disconnect cleanup.
- One-to-one voice call signalling and audio-relay authorization.
- Loading, authentication, and read-only enforcement for optional built-in starter sounds using a temporary test fixture.
- The compact distribution contains no bundled `ht6-*.wav` starter effects or dangling starter-library index. The compact-assets test was run after repacking and passed.

`node --check server.js`, `node --check internet-server.js`, and `node --check` on the test JavaScript files passed. The React JSX/JavaScript files were parsed successfully with the TypeScript compiler in syntax-only mode. The Windows and macOS launch scripts were reviewed; the POSIX scripts pass `bash -n`.

## Compact ZIP verification

For this update, `node --check` passed for `server.js` and the JavaScript test files, and TypeScript's parser accepted `src/main.jsx` with JSX enabled. The ZIP will be reopened and its CRC integrity checked after packaging. The full integration suite could not run in this workspace because `npm install --no-audit --no-fund` timed out and the project dependencies are not bundled. On the host, run `npm install --no-audit --no-fund` followed by `npm test` to run the complete suite.

## Build limitation

`npm run check` could not complete in the supplied Linux build environment because the uploaded `node_modules` contained Windows-only Rollup/esbuild optional binaries and did not contain the Linux Rollup binary (`@rollup/rollup-linux-x64-gnu`). Installing a Linux-native dependency set was not available in this offline workspace. The distributable therefore excludes `node_modules` and the stale 5.0 `dist` directory. On first launch, the Windows/macOS launcher runs `npm install --no-audit --no-fund` and `npm run build` using dependencies for that computer. A successful production build on the user's Windows host remains to be confirmed.

## Not performed

- No physical two-device browser session was available to verify live microphone capture and end-to-end voice audio. The automated tests check signalling and authorization, not actual microphones, speakers, codecs, or network paths.
- No live multi-device test of remote sound playback was performed. The authenticated upload, event authorization, and playback code paths are covered by tests, but browser audio output still needs a manual check.
- The permanent named Cloudflare Tunnel was not restarted from this workspace. The configuration retains the existing `https://chat.hackertoes.bid` hostname and references the host-only token file.
- Performance at thousands of concurrent users and an independent security audit were not performed.

## Recommended manual acceptance test

1. Start the application on the Windows host using `Start Internet Server.bat`.
2. Open `https://chat.hackertoes.bid` on the host and join as the host. Set and enable a four-digit code in Workspace Settings.
3. Open the same URL on a second browser/device. Confirm the wrong code is rejected and the correct code joins. Refresh the second browser to confirm an existing session reconnects.
4. Select a large batch of audio files; check per-file and overall progress, and verify validation errors are reported.
5. Test Loser, Tuff Lad, and Detention minimums, then raise the slider above each minimum. Enable Overdrive and test a level above 100% at a low device volume.
6. Opt the second device into remote soundboard playback, remote volume control, the stop-sound minigame, and audio monitor sharing. Send a sound only to that recipient. Adjust playback volume from the sender and confirm it respects the recipient's chosen maximum. Check the monitor's browser playback percentage and output label; confirm it does not claim to know system master volume. Catch three targets to stop the sound. Then test receive-disabled and muted states.
7. Call between the two devices. Test microphone permission, mute/unmute, hang-up, and a network disconnect. If direct WebRTC fails across networks, configure TURN using `data/ice-servers.example.json` as described in [TURN-SETUP.md](TURN-SETUP.md).

## Calling and video checks
- Automated call-signalling tests now include a video SDP offer and verify the server safely relays the video media section.
- Microphone permission and device errors must be tested in a real browser because automated server tests cannot open a local microphone.
- Two-device manual test: use current Chrome or Edge on Windows and Chrome/Safari on the second device; open the HTTPS site on both; grant microphone access; call, accept, mute/unmute, enable/disable camera, start/stop screen sharing, then hang up.
- Verify the incoming-call dialog remains open after denying microphone access, then allow the permission and press Retry microphone & accept.


Additional integration tests were added for unlimited repeated sound sends, sender-to-recipient cooldown, Teacher Alert targeting, recipient opt-out, duplicate alert blocking, unauthorized dismissal, and recipient dismissal. They were not executed here because dependency installation did not complete. The 35-second countdown, grey-to-green button state, and responsive styling require manual browser verification.
