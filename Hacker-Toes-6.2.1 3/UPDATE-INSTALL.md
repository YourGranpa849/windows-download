# Installing this update

1. Stop the current Hacker Toes host.
2. Extract this ZIP into a new folder. Do not overwrite your previous folder.
3. Keep a backup of your current `data` folder.
4. To preserve your latest users, chat history, uploaded files, sounds, join-code hash, and Cloudflare credentials, copy your current `data` folder into the new project folder, merging your latest workspace and uploaded sounds. The old `sound-send-limits.json` file is no longer used and can be left behind or deleted.
5. The ZIP includes an empty `data/cloudflare-token.txt` placeholder. Paste your own Cloudflare tunnel token there if the new folder does not have your current token file.
6. Run `Start Internet Server.command` on macOS or `Start Internet Server.bat` on Windows. The launcher installs the lockfile dependencies and builds the frontend.
7. Open the configured HTTPS URL and test with two devices.

## New controls

- Remote sound playback: no per-recipient rolling quota. A 3-second cooldown remains between sends from the same sender to the same recipient.
- Teacher Alert: the sender chooses one online recipient in Soundboard. The recipient sees a static red screen with a 35-second countdown. The Acknowledge button is grey until the countdown ends, then turns green. A close button remains available throughout so the overlay can be dismissed early.
- Teacher Alerts can be disabled by each recipient in Soundboard → Your remote audio permissions.

No alert flashing or beeping is used. Teacher Alert does not change system volume or system settings.


## Remote Control Centre update

Recipients can separately allow remote volume adjustment, pause/resume, the stop-sound minigame, monitor sharing, and Teacher Alerts. Remote volume, pause/resume, and challenge restart are authorized for only the person who initiated that playback. See `REMOTE-CONTROLS.md` for setup and two-device verification.
