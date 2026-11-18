# Desktop release checklist

- [ ] Bump `package.json` version.
- [ ] Run `npm install` and commit the updated lockfile.
- [ ] Run `npm test`.
- [ ] Run `npm run check`.
- [ ] Build the Windows installer on Windows (`npm run dist:win`).
- [ ] Build the macOS DMG/ZIP on macOS (`npm run dist:mac`).
- [ ] Configure and verify Windows code signing.
- [ ] Configure and verify Apple Developer ID signing and notarisation.
- [ ] Confirm the release artifacts include `latest.yml` and `latest-mac.yml` plus platform installers/update ZIPs.
- [ ] Create a published GitHub Release by pushing a `vX.Y.Z` tag.
- [ ] Test update discovery, download, and user-confirmed install from the previous installed version on both platforms.
- [ ] Back up and verify user data is unchanged after update.
