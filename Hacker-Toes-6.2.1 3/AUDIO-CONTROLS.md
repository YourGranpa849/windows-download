# Remote soundboard controls

Hacker Toes remote audio controls affect only the sound playing inside the recipient's browser. They do not read or change Windows, macOS, or ChromeOS master volume, mute state, or hardware settings.

## Recipient setup

Open **Soundboard** and choose the settings you want to share:

- **Allow sender to adjust this sound's browser volume**: permits only the person who sent the current sound to change its browser playback gain while it is playing.
- **Allow sender to pause and resume playback**: permits only that same sender to pause or resume the current sound. The recipient can always stop their own incoming playback.
- **Enable the stop-sound minigame**: shows the optional 3×3 challenge. Catch the highlighted tile three times to stop the current sound. The sender can restart the challenge and see hit progress, but cannot play the recipient's game for them. There is no emergency-stop button in the game overlay. The recipient's normal Soundboard receive/mute controls remain available.
- **Share playback percentage and output-device label**: lets the sender see the current Hacker Toes browser playback percentage and the output-device label the browser reports.
- **My maximum remote playback volume**: sets a recipient-side ceiling from 30% to 150%. The server enforces it even if a sender attempts to request a higher value.

All these sharing and control settings are off by default, except the receive setting which defaults to on. The local maximum defaults to 100%.

## Sender behavior

The sender must pick one online recipient. Only the person who initiated a particular playback can control that playback; unrelated members cannot take over its controls. If the recipient has opted into remote volume control, a playback slider appears. If they have opted into pause/resume control, Pause or Resume appears while the sound is active. Stop is available to the sender and to the recipient who is hearing the sound. The slider's range is constrained by the selected mode's minimum, the sender's Overdrive setting, and the recipient's maximum. The server checks these permissions and limits for every change.

## Audio monitor limitations

The monitor shows **browser playback gain**, not the computer's overall volume. It may show the selected/default output label when the browser exposes that device name. If the browser hides device labels, the monitor displays a generic default-output description.

Web pages cannot read or change the operating-system master volume or reliably detect whether the computer is muted. The monitor explicitly reports that system master volume is unavailable rather than guessing.

## Testing

For a two-device check, enable the recipient options above on device B, then send a sound from device A. Adjust its level from A, pause and resume from A, restart the challenge from A, and confirm A receives the challenge hit progress from B. Check that an unrelated third account cannot control the playback. Confirm A receives the reported browser playback percentage and output label. Catch three highlighted tiles on B to stop playback. Also test with each recipient option disabled to confirm the corresponding feature is unavailable.
