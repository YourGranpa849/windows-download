# Remote Control Centre

Remote playback controls are tied to one playback session. Only the user who started that specific sound (`play.from`) can send remote volume, pause/resume, and challenge-restart commands. A different member cannot take over or stop someone else's playback.

## Recipient permissions

Open **Soundboard → Your remote audio permissions** and enable only the controls you want to share:

- **Allow sender to adjust this sound's browser volume**: grants browser gain control to the sender of the current sound. The recipient's maximum playback volume remains enforced by the server.
- **Allow sender to pause and resume playback**: grants pause/resume control for the current sound to its sender.
- **Enable the stop-sound minigame**: displays the 3×3 target game. The sender can restart the challenge and see hit progress; the recipient plays it locally.
- **Share playback percentage and output-device label**: shares the browser playback percentage and the output-device label when the browser exposes it.
- **Allow Teacher Alerts**: permits individually addressed Teacher Alerts from another member.

These permissions are separate. Turning one off removes that control for active playback as well as future playback. The recipient can always mute or disable soundboard reception locally.

## Sender controls

After sending a sound to one online recipient, the sender's **Remote Control Centre** panel shows available controls:

- **Volume** appears when remote volume permission is enabled.
- **Pause / Resume** appears when remote transport permission is enabled.
- **Stop** ends the current sound. The recipient can also stop their own received sound.
- **Restart challenge** appears when the recipient has enabled the minigame. The sender sees the recipient's current hit count.
- **Remote Audio Monitor** appears when monitor sharing is enabled.
- **Teacher Alert** remains available as an individual send action next to the selected recipient.

The browser application cannot read or change the recipient computer's operating-system master volume, mute state, or hardware volume keys.

## Two-device test

1. Sign in on device A and device B as different members.
2. On B, open Soundboard and enable remote volume, pause/resume, minigame, and monitor sharing.
3. On A, select B, choose a sound, and send it.
4. Confirm A sees Remote Control Centre with volume, Pause, Stop, challenge progress/restart, and monitor status as allowed.
5. Pause and resume from A and confirm the audio on B pauses and resumes.
6. Restart the minigame from A; tap targets on B and confirm A's hit counter updates.
7. Sign in as a third member C and attempt the same socket commands against that playback. They must be rejected.
8. Turn remote pause/resume off on B and confirm A immediately loses that control.
9. Try Teacher Alert with B's Allow Teacher Alerts setting enabled and disabled.


## Windows master-volume control

This is separate from remote soundboard playback volume. A recipient using the installed Windows or macOS desktop app can opt in under Soundboard → Your Remote Audio Permissions. When enabled, a member can select that person in the soundboard and use Remote System Volume to read, set (0–100%), mute, or unmute Windows or macOS master volume. Permission can be disabled by the recipient at any time. Web-only sessions cannot execute the operating-system action. On macOS, the app uses the system output-volume controls; on Windows, it uses the Windows audio endpoint controls.
