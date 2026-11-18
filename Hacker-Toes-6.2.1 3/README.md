# Hacker Toes 6.0

**Your people. Your network. Your little corner.**

A working, name-only local and internet chat app with 146 features, a Discord-style interface, and dark and light themes. The chat runs in a browser on Mac, Windows, and Chromebook. One Mac or Windows computer runs the host. Local mode needs no cloud service, email address, or account. Internet mode uses a Cloudflare HTTPS tunnel and supports either a private invitation or a host-set four-digit join code.

## From school or another network

Use **Start Internet Server.bat** on your home Windows PC. Share the website address and four-digit code when join-code protection is enabled; otherwise share the private Internet invitation. See [INTERNET-SETUP.md](INTERNET-SETUP.md) for the step-by-step setup and the permanent-address option.

## Start here

### On this Mac

Double-click **Start Hacker Toes.command**. The app opens at **http://localhost:5050**. Pick your display name and join. On first launch, dependencies are installed and the interface is built for your operating system.

The first person who joins through `localhost` on the host computer becomes the host in the app. Join locally before inviting other people. Use the same browser and address to retain that identity.

### On another Mac or Windows computer

1. Extract the entire `Hacker-Toes-6.0.zip` folder. Keep all of its files together.
2. Install [Node.js](https://nodejs.org/) version 22 or newer on the host computer.
3. Double-click **Start Hacker Toes.command** on Mac, or **Start Hacker Toes.bat** on Windows.
4. The first start installs dependencies and builds the interface, so the host needs an internet connection for setup. In local mode, subsequent starts and chatting work without internet. Internet hosting always needs an internet connection.
5. If the firewall asks, allow Node.js on your trusted private network. Do not open or forward the port on your internet router.

On a Mac that does not recognize `.command` files, open Terminal in the extracted folder and run `bash "Start Hacker Toes.command"`. If the operating system asks whether to open a downloaded file, review that prompt yourself.

### Invite a Mac, Windows computer, or Chromebook

1. Connect the device to the same Wi-Fi or wired network as the host.
2. In the app, click **Invite people** or **Invite a friend**.
3. Copy the local network link, or scan its QR code.
4. Open that link in Chrome or another modern browser. Enter a name and, when the host has enabled it, the four-digit join code. Then start chatting.

Only the host installs Node.js. Guests, including Chromebook users, need only a browser. Chromebooks are supported as browser clients; hosting from ChromeOS Linux is not packaged or tested.

Keep the host running and awake. Closing a browser tab does not stop the host. Use **Stop Hacker Toes.command** / **Stop Hacker Toes.bat**, or press **Ctrl+C** in the host terminal, to stop it. Starting it again restores the saved conversations.

## What you can do

- Public channels, private channels, categories, favorites, archive/restore, slow mode, announcements, and unread counts.
- One-to-one and group direct messages, threads, replies, editing, reactions, pins, bookmarks, rich text, spoilers, and mentions.
- Share up to five files per message, up to 20 MB each. Preview images, audio, and video; browse shared files and an image gallery.
- Run live polls, assign shared tasks, set due dates, keep private notes, and schedule messages.
- Search by words, author, channel, dates, attachments, and pins.
- Customize your name, avatar, bio, presence, theme, accent, text size, density, notifications, and clock format.
- Host tools for moderators, timeouts, closing new joins, four-digit join-code settings, history retention, cleanup, exports, and an activity log.
- One-to-one voice calls with call invitations, microphone mute, WebRTC audio, and a server-relayed fallback.
- A remote soundboard with single-recipient playback, bulk file selection, searchable collections, favorites, recent sounds, and per-file upload progress. Recipients can opt into remote browser-playback volume control, a three-hit stop-sound minigame, an audio monitor that reports browser playback percentage plus the browser-reported output device, and Teacher Alerts. There is no per-recipient rolling send quota. A 3-second cooldown remains between sends from the same sender to the same recipient. Teacher Alert is a static red full-screen notice with a 35-second countdown; its acknowledgement button unlocks green when the countdown finishes, while a visible close control remains available at all times. It does not flash or beep. It never reads or changes the computer's master volume. The compact distribution does not bundle the optional 1,000-effect starter WAV collection; users can upload their own sounds.
- Volume modes with minimums of 30%, 40%, and 65%, plus optional Web Audio Overdrive up to 150%.

Click the **?** in the left rail to browse the numbered, searchable guide. The full inventory is also in [FEATURES.md](FEATURES.md).

Live voice calls, optional camera video, and screen sharing are included. Camera and screen sharing require direct WebRTC; networks that block peer connectivity may need a TURN server. Native desktop build scripts and the owner-controlled updater are included; prebuilt signed installers are produced on their respective build platforms or by the included GitHub Actions workflow.

## Good to know

- **Connection privacy.** Internet mode uses HTTPS through Cloudflare and requires either a private invitation link or the host-enabled four-digit join code. Local HTTP is not encrypted and this is not end-to-end encrypted messaging. The host can access the data files on its own computer. Private channels and DMs restrict which guests can see them inside the app.
- **Names are not verified.** Different people can choose the same display name. A browser-generated secret identifies a session; no password is required. Leaving a name session or clearing browser storage loses access to that identity. There is no password recovery.
- **Moderation limits.** Removing a session disconnects it and invalidates that session. A person can join with a fresh browser session unless new joins are paused.
- **Offline behavior.** An already-open tab reconnects automatically. Messages composed while disconnected stay in that browser’s outbox until the host returns. Loading the app from scratch requires the host to be available.
- **Scheduling.** The host sends messages when due; if it was stopped, overdue messages send on the next start. The author must still have permission to post.
- **Browser permissions.** Desktop notifications, clipboard support, and some browser installation features vary on plain LAN HTTP. Copying has a fallback, and chat itself does not need a secure-browser-only feature.
- **Local storage.** Settings, drafts, favorites, saved-message IDs, and the offline outbox stay in your browser. Messages, profiles, tasks, private notes, and files stay on the host.
- **Practical limits.** 500 remembered members, 150 named channels, 2,000 tasks, 4,000 characters per message, 50 scheduled messages per person, and a 1 GB shared chat-file library. Soundboard storage has separate safeguards: 8 MB per sound, up to 500 uploaded sounds per user, 2,000 sounds globally (including built-ins), and 2 GB total sound storage. The optional starter library is not included in this compact distribution; your own uploaded sounds can be renamed, recategorized, or deleted. Multiple selection itself has no fixed frontend file-count cap. This version is intended for small trusted groups, not large public servers.
- **Retention.** Messages are kept indefinitely unless the host chooses automatic retention or deletes them. Automatic retention preserves pinned messages.

## Back up and restore

Stop the host, then copy the entire **data** folder somewhere safe. It contains all history, private conversations, uploads, and identity information. Keep that backup private. To restore, stop the host and replace its `data` folder with the backup, then start it again. Browser session secrets are stored separately in each browser, so retain those browsers if you need to continue using the same identities.

In-app **Export workspace data** downloads only the conversations visible to your current session, plus your notes. It is a readable export, not a full restore backup. File binaries are in `data/uploads` and are not included in that JSON export.

## If another device cannot connect

- Use the LAN address shown by **Invite people**, not `localhost` on the guest device.
- Make sure the host is still running and awake.
- Try another listed address if the host has multiple network adapters or a VPN.
- Allow the host app through the computer’s firewall on private networks.
- Some guest Wi-Fi, school, and workplace networks block devices from talking to each other. A network you control may be needed.
- If port 5050 is in use, stop the other copy or choose a different `PORT` before starting.

## Developer commands

```sh
npm install --no-audit --no-fund
npm run build
npm start
npm stop
npm run internet
npm test
```

Use `PORT`, `HOST`, and `DATA_DIR` environment variables to change the host port, bind address, or data directory. The default listens on all interfaces, port 5050. `npm run dev` serves the interface on Vite’s localhost address and proxies API calls to the running host.

The included integration suite uses independent Socket.IO clients and temporary data. It checks delivery, authorization, private content and file isolation, editing, polls, tasks, notes, moderation, scheduling, persistence, join-code protection, sound permissions, and starter-library behavior. See [TESTING.md](TESTING.md) for the current verification record.

Built with React, Vite, Express, Socket.IO, Lucide icons, QRCode, and Electron for native desktop builds. Run `npm install --no-audit --no-fund` after extracting; npm reconciles the included base lockfile with the desktop dependencies before building. All interface assets are served locally; there are no remote fonts or analytics. References: [Socket.IO server options](https://socket.io/docs/v4/server-options/) and [Express documentation](https://expressjs.com/).

## Four-digit join code

The four-digit join-code feature is included and enforced by the server. On the host account, click the workspace name at the top of the left sidebar, then choose **Manage join code & workspace settings**. Alternatively, open the **Connection** panel from the bottom-left and choose **Set up four-digit join code**. Enter exactly four digits, turn on **Require a join code**, and save. The host-only workspace panel shows whether code protection is currently enabled. Guests see the four-digit field on the join screen and must enter the correct code before a new session is created. Only a salted hash is stored in `data/join-code.json`; the actual code is never returned by the information API. To rotate the code, enter a new four-digit value and save. Existing authenticated sessions can reconnect without re-entering it. New installations start with code protection disabled until the host chooses their own four digits.

## Remote soundboard controls

Recipient opt-in settings for remote browser-volume control, the three-hit stop-sound minigame, and sharing the browser-reported output label are in **Soundboard → Your remote audio permissions**. The recipient can set a local maximum from 30% to 150%. These features only affect Hacker Toes browser playback. They cannot read or change the computer's master volume or system mute. See [AUDIO-CONTROLS.md](AUDIO-CONTROLS.md) for details.

## Soundboard volume modes

The three modes set minimum playback levels, not maximums: Loser starts at 30%, Tuff Lad at 40%, and Detention at 65%. The slider can be raised above the selected minimum. Normal playback tops out at 100%. Enabling Volume Overdrive allows levels up to 150% through Web Audio gain processing when the browser supports it. Amplified sound can be unexpectedly loud or distorted.

## Cloudflare token setup

The project expects a host-only `data/cloudflare-token.txt` file. The ZIP contains an empty placeholder, not a Cloudflare credential. Paste your own tunnel token into that file privately; never put it in frontend code, source files, documentation, or logs. Treat the `data` folder as private and do not share it publicly.

## Voice calling and TURN

Voice calling uses WebRTC for browser-to-browser audio. The host relays signalling and supplies the configured ICE server list. STUN can help peers discover direct paths, but some networks require a TURN relay. To configure one, copy `data/ice-servers.example.json` to `data/ice-servers.json` and replace the example host, username, and credential with values from a TURN provider. Keep that file private. Restart the host after changing it. The Cloudflare Tunnel carries the app and signalling traffic; it is not itself a TURN media relay.


## Remote playback controls

Recipients can opt in to remote volume changes and remote pause/resume for each sound. Only the person who sent that specific sound can use those controls. The sender can stop their own playback, restart the optional stop-sound challenge, and view progress when the recipient has enabled the minigame. The recipient can always stop incoming playback locally. See `AUDIO-CONTROLS.md` for permissions and two-device tests.


## Native desktop applications

Hacker Toes can be packaged as a macOS app and Windows installer with an owner-controlled updater. See [BUILD-DESKTOP.md](BUILD-DESKTOP.md) for local builds, GitHub Releases setup, signing requirements, and update testing.


## Desktop applications (macOS and Windows)

Hacker Toes can be packaged as a native macOS DMG/ZIP or Windows NSIS installer. See [BUILD-DESKTOP.md](BUILD-DESKTOP.md) for requirements, signing, release publishing and the owner-controlled updater. The web launchers remain available.
