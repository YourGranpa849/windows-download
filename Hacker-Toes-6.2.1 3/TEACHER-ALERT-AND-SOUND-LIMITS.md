# Teacher Alert and sound-send limits

## Remote sound cooldown

- No per-recipient rolling sound-send quota.
- 3-second cooldown between sends from the same sender to the same recipient.
- The cooldown is enforced by the server; changing the browser does not bypass it.
- This is separate from audio upload limits.

## Teacher Alert

- Sender chooses one online recipient in the Remote Soundboard panel and clicks Send Teacher Alert.
- The recipient can turn off Teacher Alerts in their own soundboard permissions.
- The recipient sees a static red full-screen Teacher Alert with a 35-second countdown. No flashing and no beeping.
- The grey Acknowledge button turns green and becomes active when the countdown reaches zero.
- A visible close button remains available at all times so the notice can be dismissed early. This is intentional: the overlay does not lock someone out of their device or app.
- At most one active alert is shown per recipient; the recipient has a 35-second alert cooldown.


## Where the sender button appears

The **Send Teacher Alert** button is positioned immediately below the recipient selector in the Remote Soundboard send panel, before the volume controls. Select one online recipient to enable it.
