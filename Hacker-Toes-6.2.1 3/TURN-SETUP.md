# Voice calling network setup

Hacker Toes voice calling uses WebRTC peer-to-peer audio. STUN servers are included by the server.
Some networks (carrier-grade NAT, restrictive school/work Wi-Fi, or firewalls) require a TURN
relay. Cloudflare Tunnel carries the web app and Socket.IO signalling; it does not relay WebRTC
UDP media.

To add TURN, create `data/ice-servers.json` on the host (do not commit credentials):

```json
[
  {
    "urls": ["turn:YOUR-TURN-HOST:3478", "turns:YOUR-TURN-HOST:5349"],
    "username": "YOUR-TEMPORARY-USERNAME",
    "credential": "YOUR-TEMPORARY-CREDENTIAL"
  }
]
```

Use credentials from a TURN provider or your own coturn server. Prefer short-lived TURN
credentials where supported. Restart Hacker Toes after changing the file. Never publish
this file or include real TURN credentials in a project ZIP.

Both callers need microphone permission. The site must be served over HTTPS (your public
Cloudflare hostname qualifies) or localhost. If direct WebRTC fails, the UI explains that
TURN may be required rather than silently switching to a non-WebRTC audio transport.
