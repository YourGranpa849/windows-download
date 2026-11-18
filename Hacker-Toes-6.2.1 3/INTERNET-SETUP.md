# Use your home Windows PC as the server

Your home PC can host Hacker Toes while you chat from a Chromebook, Mac, or Windows computer on another network. Guests use a browser and a name. Guests join using the full private invite link when the join code is disabled. When the host enables the four-digit join code, guests use the stable website address and enter that code on the join screen.

**The home PC must remain powered on, awake, connected to the internet, and running the server. The network you join from must allow the site.** This setup does not bypass school or workplace network restrictions.

## Easy setup: a temporary internet address

1. Copy and extract **Hacker-Toes-6.0.zip** onto your home Windows PC. Extract it completely before starting anything.
2. Install **Node.js 22 or newer** from [nodejs.org](https://nodejs.org/).
3. Double-click **Start Internet Server.bat**. If the ordinary local server is already running, stop it first using **Stop Hacker Toes.bat**.
4. The launcher installs the app’s dependencies and downloads Cloudflare’s official `cloudflared` connector. It checks the published SHA-256 checksum before using the connector. Internet is needed for this setup and for remote chatting.
5. The launcher starts the host and creates an HTTPS address. On the home PC, open **http://localhost:5050**, choose your name, and join. The first local name session becomes the host.
6. Click **Invite people**. If the host has enabled the four-digit code, share the permanent website address and the code separately. If the code is disabled, copy the complete private invite link and keep its `#invite=...` portion intact.
7. At school or another network, open the address shared by the host. When the join code is enabled, enter the four digits; otherwise the invite fragment authorizes entry. No account, email, app installation, or VPN is required on the guest device.

Leave the server window open. Use **Ctrl+C** in that window or **Stop Hacker Toes.bat** to stop the host and tunnel. Stop does not delete your chat history.

Cloudflare Quick Tunnels use a temporary `https://...trycloudflare.com` address. **It changes each time the tunnel starts.** Copy a new link before leaving home if you restart it. Quick Tunnels have no uptime guarantee and are intended for testing/development; a permanent named tunnel is better for regular use. The account-free quick option supports up to 200 in-flight requests and does not support SSE; Hacker Toes uses WebSockets and HTTP polling. [Cloudflare Quick Tunnels documentation](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)

Each different public hostname has separate browser storage. A new quick-tunnel hostname therefore starts a new name session in your browser. Choose the permanent option below if retaining the same remote identity and address matters.

## Regular use: keep the same internet address

For an address such as `https://chat.your-domain.com`, the host needs a Cloudflare account, a domain connected to Cloudflare, and a named Cloudflare Tunnel. Guests still do not need accounts. Domain registration may have a cost; this app does not buy or register a domain.

1. In Cloudflare, create a **remotely managed Cloudflare Tunnel**. Configure a published application/hostname for your chosen chat subdomain.
2. Set that hostname’s origin service to **HTTP**, URL **127.0.0.1:5050**. The browser-to-Cloudflare connection and the Cloudflare-to-connector tunnel use encryption; the final HTTP hop stays on the host computer.
3. Copy the tunnel’s connector token into a new plain-text file named **data/cloudflare-token.txt** inside the app folder. Put only the token in that file. Keep it private. You do not need to paste it into this chat.
4. Copy **internet.config.example.json** to **internet.config.json** and edit `publicUrl` to your real HTTPS hostname. Keep `mode` as `named` and `tokenFile` as `data/cloudflare-token.txt`.
5. Double-click **Start Internet Server.bat**. It uses your named tunnel instead of creating a temporary one.
6. Open the app locally and select **Invite people**. If the four-digit code is enabled, share the website address and code separately. Otherwise, copy the full private invitation. The hostname remains the same across restarts.

Example configuration, with your own hostname substituted:

```json
{
  "mode": "named",
  "publicUrl": "https://chat.your-domain.com",
  "tokenFile": "data/cloudflare-token.txt"
}
```

Use a subdomain dedicated to this chat. Keep the Cloudflare connector token and the app’s `data` folder private. Do not publish `cloudflare-token.txt` in a repository. If you no longer want internet access, stop the Internet Server launcher; start **Start Hacker Toes.bat** for local-only access instead. Local-only mode rejects forwarded internet requests even if a tunnel is accidentally left running.

Cloudflare provides instructions for [creating tunnels](https://developers.cloudflare.com/tunnel/) and [running its connector as a Windows service](https://developers.cloudflare.com/tunnel/features/locally-managed-tunnels/as-a-service/windows/). The supplied launcher runs interactively; it does not silently install a Windows service or change sleep settings. Keep the launcher open, or deliberately configure startup/service management yourself.

## Invitations and privacy

- When the four-digit join code is enabled, new guests must enter that code. A private invite fragment is not required.
- When the four-digit code is disabled, new internet guests must possess the random private invite link. Its `#invite` fragment carries the invite secret; the browser sends it in the join request body and removes it from the address bar after joining.
- Invited members can copy an invitation for other people. Pause new joins in host settings if you want to close entry.
- From the host’s **connection card**, choose **Reset private invite code** to invalidate old invitations. Existing name sessions stay valid; remove individual sessions separately if needed.
- The home PC stores chat data. Cloudflare carries the internet traffic. This is HTTPS transport security, not end-to-end encryption. The host can read its data files.
- A remote guest arriving through the tunnel does not become host merely because the connector runs locally. Host controls and shutdown require the correct role or a separate local control secret.
- No router port forwarding is needed. The app does not change your router, firewall, school network settings, or browser security protections.

## Troubleshooting

**The school device cannot open the link:** Try the same private link from a network that allows the site, such as a personal mobile connection. If it works there, the school network or device policy may block it. Ask the network administrator; this app does not bypass those controls.

**The link worked yesterday but not today:** Check that the home PC is awake and the server window is open. A quick-tunnel restart generates a new hostname. Use a named tunnel for a permanent address.

**The page asks for an invite code:** This happens when the host has not enabled the four-digit join code. Copy the complete private link again, including its `#invite=...` portion. When the four-digit code is enabled, guests enter that code instead.

**It says “local-only host is already running”:** Run **Stop Hacker Toes.bat**, wait a moment, then run **Start Internet Server.bat**.

**Cloudflare cannot connect:** Look at **data/internet-server.log** on the host. The host needs outbound access allowed for Cloudflare Tunnel. If your network permits TCP but blocks the default UDP transport, you can set `TUNNEL_PROTOCOL=http2` before launching; this changes the connector’s transport and does not bypass network authorization. A Cloudflare error due to an existing quick-tunnel configuration may require moving aside your own existing Cloudflare config or using a named tunnel. Do not remove an existing configuration without understanding what uses it.

**The downloaded connector cannot be verified:** Setup stops without running that download. Use the [official Cloudflare downloads page](https://developers.cloudflare.com/tunnel/downloads/), verify the release, and set `CLOUDFLARED_PATH` to your installed connector if you want to manage it yourself.

**Multiple network addresses appear:** Use the **Internet** HTTPS invitation for school. A `192.168.x.x`, `10.x.x.x`, or `172.16–31.x.x` address works only on the home network.

## What was verified

The server and real HTTPS tunnel were tested on the available Mac, using independent chat clients. Windows batch launchers and the Windows connector selection are supplied, but your Windows PC and school network are not accessible from this chat and still need the setup steps above. Detailed test results are in [TESTING.md](TESTING.md).
