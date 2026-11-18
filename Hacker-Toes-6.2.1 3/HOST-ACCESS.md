# Host access and four-digit join code

## First, open the host computer's local address

On the computer running Hacker Toes, use `http://localhost:5050`. Do not use its `10.x.x.x` or other LAN IP address for host setup. In internet mode, a LAN IP is treated as a guest connection and may show the private invitation field.

The Internet Server launcher now opens localhost as soon as the app server is ready, even if the Cloudflare tunnel cannot connect.

## Recover the existing host account

If the owner session is missing, open `http://localhost:5050` on the host computer and choose **Recover host access on this Mac**. This action is only accepted over localhost, and it rebinds the existing owner profile instead of creating a duplicate member. It is refused while that owner has an active connection.

If the workspace has no existing owner, enter a display name and use the normal Join button from localhost; the first local user becomes the owner.

## Set the four-digit code

After entering the workspace as owner:

1. Open the workspace information panel.
2. Choose **Manage join code & workspace settings**.
3. Enter exactly four digits.
4. Turn on **Require a join code**.
5. Save the settings.

New guests will then see a four-digit code field. Existing authenticated sessions can reconnect without entering it again.

## Cloudflare connectivity note

The local server can run even when the internet tunnel is unavailable. A Cloudflare Tunnel connection requires the network to allow Cloudflare tunnel traffic. If the network blocks the documented outbound tunnel connections, ask its administrator to review the block rather than trying to bypass the network controls.
