# Hacker Toes 6.0 — expanded feature catalogue

Every item below is implemented in the app. The in-app guide is searchable. Feature counts describe discrete behaviors.

## Home server & internet

1. **Windows internet host** — Start the home server and HTTPS tunnel with a Windows launcher.
2. **Cross-network chat** — Connect from another allowed network using the private internet link.
3. **HTTPS tunnel** — Cloudflare carries internet traffic over HTTPS without router port forwarding.
4. **Private invite links** — New internet guests need a random invitation secret, then only a name.
5. **Invite-code fallback** — Enter the invite code if the link fragment was removed.
6. **Reset invitation secrets** — The host can invalidate old invitations without ending existing sessions.
7. **Temporary internet addresses** — A quick tunnel provides a temporary link without a Cloudflare account.
8. **Permanent address configuration** — Connect a named Cloudflare Tunnel and a domain for a stable address.
9. **Verified connector setup** — The internet launcher verifies the official connector download checksum.
10. **Paired host and tunnel shutdown** — Stopping the internet host also closes its tunnel.

## Getting connected

11. **Name-only entry** — Join with a display name. No email or personal password; internet visitors use a private invite or the host-enabled four-digit join-code screen.
12. **Local network chat** — A Mac or Windows host serves everyone on the same network.
13. **Chromebook access** — Join from Chrome without installing a client.
14. **Remembered identity** — Your browser remembers your name session.
15. **Automatic reconnection** — Reconnect when the host or network returns.
16. **Connection indicator** — See live, reconnecting, and offline states.
17. **Latency check** — Inspect the round-trip connection time.
18. **LAN invitation links** — Copy an address other devices can open.
19. **QR invitations** — Scan the local invitation on another device.
20. **Persistent history** — The host saves messages and settings to disk.
21. **Offline outbox** — Text composed during a disconnect queues on this device.
22. **Manual outbox retry** — Retry or discard pending messages.

## Your identity

23. **Rename yourself** — Change your display name at any time.
24. **Emoji avatars** — Choose an emoji to represent you.
25. **Avatar colors** — Choose your own profile color.
26. **Profile bio** — Add a short introduction.
27. **Presence modes** — Choose online, away, busy, or invisible.
28. **Custom status** — Share what you are up to.
29. **Member profiles** — Open a member card to learn more.
30. **Live member list** — See who is currently around.
31. **Member search** — Find people by display name.
32. **Direct messages** — Start a private conversation with one person.
33. **Group messages** — Chat privately with up to 12 people.

## Channels & spaces

34. **Create public channels** — Make a space everyone can see.
35. **Private channels** — Create a space visible only to selected people.
36. **Private membership** — Add or remove private-channel members.
37. **Channel categories** — Organize channels under custom headings.
38. **Rename channels** — Give a channel a new name.
39. **Channel topics** — Add a description to set the scene.
40. **Archive & restore** — Put a channel away and bring it back later.
41. **Delete channels** — Creators and moderators can remove a channel.
42. **Announcement mode** — Restrict posting to channel managers.
43. **Slow mode** — Set a 5, 10, 30, or 60 second posting interval.
44. **Favorite channels** — Keep favorite spaces at the top.
45. **Mute channels** — Silence notifications from individual spaces.
46. **Unread counts** — See which channels have new messages.
47. **Mark all as read** — Clear unread indicators in one click.
48. **Channel search** — Filter the sidebar by channel name.

## Everyday chat

49. **Real-time messages** — Messages arrive without refreshing.
50. **Multiline composer** — Use Shift+Enter for a new line.
51. **Per-channel drafts** — Return to unfinished messages.
52. **Message character count** — See your progress toward the 4,000 character limit.
53. **Edit messages** — Fix your own messages after sending.
54. **Delete messages** — Remove your own messages.
55. **Edit indicators** — See when a message has been changed.
56. **Quoted replies** — Reply with a link back to the original.
57. **Thread conversations** — Keep replies in a focused side panel.
58. **Jump to message** — Follow replies, search results, and saved messages.
59. **Day separators** — Browse history grouped by date.
60. **Typing indicators** — See when someone is writing.
61. **Bold & italic** — Add emphasis with **bold** and *italic*.
62. **Strikethrough** — Cross out text with ~~strikethrough~~.
63. **Inline code** — Use backticks for short code snippets.
64. **Code blocks** — Use three backticks for multiline code.
65. **Block quotes** — Start a line with > to quote text.
66. **Clickable links** — Open http and https links from messages.
67. **Spoiler text** — Hide text inside ||double bars||.
68. **Member mentions** — Insert a member mention from the composer.
69. **Everyone mentions** — Use @everyone to notify the whole channel.
70. **Emoji picker** — Add emoji without leaving your message.
71. **Emoji reactions** — Add or remove reactions on any message.
72. **Reaction attribution** — Hover a reaction to see who reacted.
73. **Pin messages** — Keep useful messages easy to find.
74. **Pinned-message view** — Browse all pins in the current channel.
75. **Personal saved messages** — Bookmark messages privately on this device.
76. **Saved-message library** — Return to your bookmarked conversations.
77. **Copy message text** — Copy a message to the clipboard.
78. **Copy message links** — Share a direct link to a message.

## Find & share

79. **Workspace search** — Search message text across your visible channels.
80. **Author filter** — Search messages from a specific member.
81. **Channel filter** — Limit search to a specific conversation.
82. **Attachment filter** — Find messages that include shared files.
83. **Pinned filter** — Search only pinned messages.
84. **Date filters** — Search between two calendar dates.
85. **File uploads** — Share files up to 20 MB each.
86. **Multiple attachments** — Send up to five files in one message.
87. **Drag & drop** — Drop files onto the conversation to attach them.
88. **Paste images** — Paste a copied image into the composer.
89. **Image previews** — View images directly in the chat.
90. **Image lightbox** — Open an image in a larger viewer.
91. **Audio playback** — Play supported audio files in the conversation.
92. **Video playback** — Play supported videos in the conversation.
93. **File downloads** — Save shared files to your device.
94. **File library** — Browse and search a channel’s shared files.
95. **Media gallery** — Browse shared images as a grid.

## Make things together

96. **Single-choice polls** — Ask a question with up to eight options.
97. **Multiple-choice polls** — Allow people to pick several options.
98. **Live poll results** — See vote totals update immediately.
99. **Close & reopen polls** — Control when your poll accepts votes.
100. **Poll directory** — Browse the polls in a channel.
101. **Shared channel tasks** — Add tasks for the group.
102. **Task assignments** — Assign a task to a workspace member.
103. **Task due dates** — Give a shared task a due date.
104. **Task completion** — Check off and reopen tasks.
105. **Task filters** — View open, completed, or assigned-to-you tasks.
106. **Task deletion** — Remove tasks you created.
107. **Private notepad** — Keep personal notes saved on the host.
108. **Download notes** — Export your notepad as a text file.
109. **Scheduled messages** — Schedule a message up to seven days ahead while the host runs.
110. **Manage scheduled messages** — Review and cancel upcoming messages.
111. **Slash-command menu** — Discover commands while typing /.
112. **Action messages** — Use /me to narrate an action.
113. **Dice & coin commands** — Use /roll or /flip for a quick decision.
114. **Text-expression commands** — Send /shrug or /tableflip.

## Make it yours

115. **Dark & light themes** — Switch between two complete color schemes.
116. **Accent colors** — Choose lime, violet, sky, or coral accents.
117. **Font sizing** — Adjust chat text from 13 to 19 pixels.
118. **Compact layout** — Fit more conversation on screen.
119. **Clock format** — Choose 12-hour or 24-hour timestamps.
120. **Reduced motion** — Disable interface animations.
121. **Avatar visibility** — Hide message avatars for a simpler view.
122. **Media visibility** — Hide inline media previews.
123. **Member-panel toggle** — Make more room for your conversation.
124. **Responsive navigation** — Use the channel drawer on smaller screens.
125. **Sound notifications** — Play a soft tone for incoming messages.
126. **Desktop notifications** — Enable notifications where the browser permits them.
127. **Mentions inbox** — Collect messages that mention you.
128. **Do not disturb** — Busy status suppresses notification sounds and popups.
129. **Quick switcher** — Press Ctrl/Cmd+K to jump to a channel.
130. **Keyboard shortcuts** — Navigate, search, edit, and dismiss using the keyboard.
131. **Fullscreen mode** — Use the browser’s full-screen presentation.
132. **Reset appearance** — Restore the default look and preferences.

## Host tools & portability

133. **Workspace name & description** — The host can customize the hangout.
134. **Pause new joins** — Close the door to new LAN guests.
135. **Moderator roles** — The host can promote trusted members.
136. **Member timeouts** — Pause a member’s posting for ten minutes.
137. **Remove members** — End a member’s current name session.
138. **Moderation log** — Review recent host and moderator actions.
139. **History retention** — Automatically expire unpinned messages after 7, 30, or 90 days.
140. **Clear channel history** — The host can clear a channel after confirmation.
141. **Unused-file cleanup** — Remove orphaned uploads older than an hour.
142. **Export conversation** — Download the current conversation as readable text.
143. **Export workspace data** — Download all data visible to your session as JSON.
144. **Mac launcher** — Start the host with a double-clickable command file.
145. **Windows launcher** — Start the host with a Windows batch file.
146. **Searchable feature guide** — Explore every feature from inside the app.


## Hacker Toes 6.0 additions

- Four-digit numeric join code, set and rotated by the host in Workspace Settings. The backend stores a salted scrypt hash, never the plaintext code. New join attempts are rate-limited; existing authenticated sessions can reconnect.
- Soundboard multiple-file selection without an arbitrary frontend count limit. Files upload sequentially with per-file byte progress and an overall batch indicator.
- Searchable sound collections, favorites, and recently played sounds.
- Safety limits remain at the backend: 8 MB per sound, 500 sounds per user, 2,000 sounds globally, and 2 GB total sound storage.
- Volume modes set minimums: Loser 30%, Tuff Lad 40%, Detention 65%. Users can raise volume above the floor.
- Optional Web Audio Overdrive up to 150%, with a warning and a dynamics compressor in the received-audio path.
- Recipient-opt-in remote volume control for the current sound only, bounded by a recipient-selected local maximum and the sender's selected mode/Overdrive ceiling.
- Recipient-opt-in remote pause/resume for the current sound; only the sender who initiated that playback can use its controls.
- Sender-side stop-challenge restart and live hit-progress monitor, available only when the recipient enables the minigame.
- Optional three-hit stop-sound minigame for recipients who enable it; no emergency-stop button is displayed in the game overlay, while the recipient's soundboard mute/receive controls remain available.
- Optional Remote Audio Monitor sharing browser playback percentage and the browser-reported output-device label. The web app cannot read or change the operating-system master volume, and the monitor states that limitation explicitly.
- Responsive dark interface refinements across the welcome, workspace, modal, soundboard, and calling surfaces.

- The compact distribution intentionally omits the optional 1,000-effect starter WAV collection to reduce download size. The server still supports optional built-in sound indexes when supplied separately; user-uploaded effects remain editable by their owner and moderators.

## Calling improvements
- More specific microphone error guidance for Windows and browsers.
- Incoming call remains available for retry after microphone permission/device errors.
- Direct WebRTC calls negotiate a video transceiver for camera and screen video.
- Camera and screen sharing are opt-in controls during an active direct WebRTC call.
- Screen sharing uses the browser's native source picker and can be stopped from the app or browser controls.


## Sound-send limits and Teacher Alert

- There is no per-recipient rolling sound-send quota. A 3-second cooldown remains between sends from the same sender to the same recipient.
- A sender must wait 3 seconds before sending another sound to the same recipient. Both controls are enforced by the server.
- Teacher Alerts are targeted to one online recipient and can be disabled by each recipient.
- The alert is a static red full-screen notice with a 35-second countdown and a grey acknowledgement button that turns green when the countdown ends.
- The recipient can dismiss it at any time using the visible close button; it does not trap the recipient or flash/beep.


## Remote Windows system volume

Windows desktop users can explicitly opt in to remote master-volume control from the soundboard permissions. Other members can then read the current Windows master volume, set it from 0–100%, and mute/unmute it for that user. The recipient must be online in the installed Windows desktop app. Browser-only sessions and macOS/Linux clients do not expose operating-system volume control. Each request is permission-checked and rate-limited by the server.
