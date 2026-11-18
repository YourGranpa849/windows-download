# Hacker Toes 6.0 calling setup (Windows, macOS and ChromeOS)

## Windows microphone errors

1. Open the public `https://` Hacker Toes address. Microphone and camera capture require a secure context; `localhost` is also treated as secure, but a LAN address such as `http://192.168.x.x:5050` is not.
2. In Chrome or Edge, select the site controls icon beside the address, set **Microphone** to **Allow**, and reload the page.
3. In Windows, open **Settings → Privacy & security → Microphone**. Turn on **Microphone access** and **Let desktop apps access your microphone**.
4. In **Settings → System → Sound → Input**, choose the intended microphone and use the input test. Close other apps that may be holding the microphone (for example, a meeting or recording app), then retry the incoming call.
5. If the browser still reports an error, read the exact error shown in the incoming-call dialog. `NotFoundError` usually means no input device was exposed; `NotReadableError` means the OS/browser could not open it; `NotAllowedError` means access was denied or blocked by browser/OS policy.

The incoming-call dialog now remains open after a microphone permission failure, so the recipient can fix permissions and retry without asking the caller to call again (provided the call has not timed out).

## Camera

During an active direct WebRTC call, select **Camera**. The browser will request camera permission. The local preview appears in the call video stage. Select **Camera off** to stop the camera track.

## Screen sharing

During an active direct WebRTC call, select **Share screen** and choose a screen, window or tab in the browser's own picker. The browser requires a fresh user action and permission for each capture. Stop sharing with the Hacker Toes button or the browser's sharing indicator.

Hacker Toes shares screen video only; it does not capture or transmit system audio from the shared screen.

## Network limitations

Camera and screen sharing use direct WebRTC media. If the call is using the server audio-relay fallback, video controls are disabled. Some networks block direct peer-to-peer media; configure TURN servers in `data/ice-servers.json` and restart the host. Cloudflare Tunnel carries the web app and signalling, not WebRTC media itself.

## Privacy

Microphone, camera and screen capture begin only after the participant chooses to accept or enable them. The browser displays its own microphone/camera/screen-sharing indicators and screen picker. Hacker Toes does not attempt to access devices without those prompts.
