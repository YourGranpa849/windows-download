# Permanent Hacker Toes address

This project is configured to advertise `https://chat.hackertoes.bid/` in Internet mode.

The permanent hostname works only when the Cloudflare named tunnel whose token is stored in
`data/cloudflare-token.txt` has a Public Hostname / route configured for:

- Hostname: `chat.hackertoes.bid`
- Service: `http://127.0.0.1:5050`

The DNS record for `chat.hackertoes.bid` must be attached to that same Cloudflare tunnel.
The supplied `internet.config.json` selects named-tunnel mode and points at the existing
token file. It does not create the Cloudflare DNS route or tunnel for you.

If the hostname is not already attached to that tunnel, configure it once in the Cloudflare
Zero Trust dashboard, then restart with `Start Internet Server.bat`. The app's Invite dialog
will then copy the permanent address instead of a changing quick-tunnel hostname.

Keep `data/cloudflare-token.txt` private. Never upload it or share it in screenshots.
