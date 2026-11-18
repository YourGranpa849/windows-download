# Hacker Toes Desktop Apps (macOS + Windows)

Hacker Toes keeps the existing React/Vite interface and Express/Socket.IO backend. Electron wraps the local app in a native desktop window. The desktop main process starts the local server and stores mutable data outside the installed application bundle.

## What this adds

- macOS `.dmg` and `.zip` builds (Intel x64 and Apple Silicon arm64).
- Windows NSIS `.exe` installer (x64 and arm64).
- A native menu item and **Settings → Updates** page.
- Manual update checks, manual downloads, download progress, and an explicit **Install and restart** action.
- Optional background update checks. Background checks do not download or install anything.
- The owner controls releases by creating a new version tag in the GitHub repository. A workflow creates a draft release and each native runner uploads its installer and updater metadata. The workflow deliberately leaves the release as a draft: the owner reviews the assets and manually presses Publish release. Installed apps cannot see draft releases.
- Existing browser/web hosting scripts remain available.

## Build locally

Use Node.js 22.12 or newer and npm.

### macOS

```bash
npm install
npm run dist:mac
```

The files are written to `release/`. For release publication, use the matching `npm run release:mac` command from a GitHub checkout with `GH_TOKEN` configured. The macOS build produces DMG and ZIP update assets.

### Windows

```powershell
npm install
npm run dist:win
```

The files are written to `release/`.

Build each platform on its own operating system. The project does not claim that a Windows installer can be produced on macOS or vice versa.

## Start a development desktop window

```bash
npm install
npm run desktop
```

This builds the Vite frontend, launches Electron, then starts the local Express server. `npm run desktop:dev` opens Electron without rebuilding the frontend first.

## Owner-controlled updates

The updater uses `electron-updater` and the GitHub Releases provider. `electron-builder` reads the owner/repository from the checked-out Git remote when the release workflow runs. Do not put a GitHub token in the app or its source code.

1. Create a GitHub repository for this project and push the source to it.
2. Keep the repository's `origin` remote pointing at that GitHub repository.
3. Ensure `.github/workflows/release-desktop.yml` is present on the default branch.
4. Set the GitHub Actions workflow permission to allow repository contents to be written (the workflow requests `contents: write`).
5. For a production-quality Windows installer/update, add `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD` repository secrets for your Windows signing certificate.
6. For signed and notarised macOS releases, add `APPLE_CERTIFICATE_P12`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID` repository secrets.
7. Increase `version` in `package.json` for every release (for example, `6.1.1`).
8. Commit and push the change, then create and push a version tag:

```bash
git add package.json
git commit -m "Prepare Hacker Toes 6.1.1"
git push origin main
git tag v6.1.1
git push origin v6.1.1
```

The GitHub Actions workflow creates a draft release, then the Windows and macOS builders publish their own installer files and platform-specific updater metadata (`latest.yml` and `latest-mac.yml`). Once both jobs succeed, the workflow publishes the release. Draft releases are not discoverable by installed clients.

Users open **Settings → Updates**, select **Check for updates**, then **Download update** and **Install and restart**. The app never silently installs or restarts after a background check.

### Signing and notarisation

- macOS automatic updates require a signed application. For public distribution, configure Developer ID signing and notarisation secrets in GitHub Actions. Without those credentials, a macOS build may be produced for testing, but automatic in-place updates are not a completed production path.
- Windows builds without a signing certificate can be installed for testing, but Windows may show reputation warnings. A trusted publisher certificate is recommended for public releases and update signature validation.
- Never commit `.p12`, `.pfx`, passwords, API tokens, or signing credentials.

## Desktop data location

The desktop app stores its working data in Electron's per-user application-data directory, outside the installed app bundle. Open it from **Help → Open desktop app data folder**.

That folder contains:

- `data/workspace.json`
- `data/sounds/` and `data/uploads/`
- `data/join-code.json`
- `data/remote-access.json`
- `data/cloudflare-token.txt`
- `internet.config.json`
- `tools/` (the verified Cloudflare connector, when downloaded)

Updates replace application files but do not replace this user-data directory. Before moving from the browser-hosted build, stop the old server and copy the old project's `data` folder into the desktop app data folder. Do not overwrite the existing `data` folder if it already contains newer messages or uploads; merge/back it up first.

## Internet hosting

On first launch the desktop app copies `internet.config.example.json` into its user-data folder. The app starts locally if a named tunnel is configured but no token has been installed. To enable the named Cloudflare tunnel:

1. Open **Help → Open desktop app data folder**.
2. Put the Cloudflare Tunnel token in `data/cloudflare-token.txt`.
3. Confirm `internet.config.json` uses `mode: "named"`, the correct public URL, and `tokenFile: "data/cloudflare-token.txt"`.
4. Quit and reopen Hacker Toes.

The Cloudflare connector is downloaded to the user-data `tools/` directory and checksum-verified before it is run. If a school/work network blocks the tunnel, ask its network administrator about the documented outbound Cloudflare Tunnel connectivity; the desktop app does not attempt to bypass network restrictions.

## Privacy and permissions

The app uses Electron context isolation, a sandboxed renderer, no Node integration in the web renderer, a narrow preload API, and IPC sender validation. Microphone/camera requests remain user-mediated. Screen sharing displays a native source chooser and never selects a screen or window automatically.

The updater only checks and downloads. It does not change operating-system volume, bypass OS permissions, or install updates without an explicit user action.

## Double-click build helpers

- On macOS, run `Build Desktop App.command` to create the DMG and ZIP installers in `release/`.
- On Windows, run `Build Desktop App.bat` to create the NSIS setup executable in `release/`.

These helpers install dependencies and build for the operating system on which they run. A local unsigned macOS build is useful for testing, but it is not a signed/notarised public release.

## GitHub repository visibility

The built-in GitHub Releases updater expects clients to retrieve release metadata and installers without embedding a personal access token. Use a public release repository for this configuration. Do not put a GitHub token in the app. If the source must remain private, switch to a separately configured update host with a safe public read-only distribution path before shipping.
