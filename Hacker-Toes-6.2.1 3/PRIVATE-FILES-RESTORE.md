# Restore private local configuration after extracting

This project archive deliberately does not contain secret credentials.

## Cloudflare Tunnel token

If `internet.config.json` is set to `mode: "named"`, copy your existing private token file from your previous project into this project's `data` folder as:

`data/cloudflare-token.txt`

Do not paste the token into chat, source code, screenshots, or documentation. The internet launcher expects that private file when using a named tunnel.

## Internet invitation key

`data/remote-access.json` is not included because it contains a private invitation key. The server automatically generates a fresh key on first start in internet mode. After starting, use **Invite people** in Hacker Toes to copy a new invitation link. If the four-digit join code is enabled, share the website URL plus the four digits instead.
