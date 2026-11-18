# Hacker Toes 6.0 compact distribution

This ZIP omits the optional 1,000-effect generated WAV starter collection and its `data/sound-library-index.json` catalogue to make downloads substantially smaller.

The application still supports:
- User-uploaded sound effects and multiple-file selection.
- Authenticated sound retrieval and remote playback.
- Sound categories, favourites, recent sounds, and playback status.
- The optional built-in library loader if an administrator separately supplies a compatible sound index and its matching audio files.

The existing workspace data and its referenced uploaded sound are retained. The host-only `data/cloudflare-token.txt` file is retained from the supplied 6.0 archive. Treat this ZIP as private.

The optional generator source remains in `tools/generate-starter-sounds.py`; running it intentionally recreates the larger starter pack and index. It is not run by the application or by the startup scripts.
