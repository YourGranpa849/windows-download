# Hacker Toes 6.0 asset notes

## Optional starter sound collection

The optional starter sound collection consists of 1,000 original procedural audio effects generated specifically for Hacker Toes 6.0. They are not ripped from games, films, music libraries, social-media clips, or other commercial recordings.

The effects are arranged in ten collections: Arcade, Comedy, Interface, Sci-Fi, Impacts, Alarms, Transitions, Percussion, Ambience, and Signals. Each file is a five-second, 44.1 kHz, stereo, 16-bit WAV. The original generation script is `tools/generate-starter-sounds.py`; it uses Python 3 and NumPy.

**The optional WAV files and their index are not included in this compact ZIP.** This is intentional: the application runs without them, and users can upload their own sounds. The server only adds built-in effects when a matching index and audio files are present.

Built-in sounds, when supplied, are read-only from the application. A user can upload, rename, recategorize, and delete their own sounds subject to the server's storage safeguards.

## Application dependencies

Third-party JavaScript dependencies and their exact versions/ranges are listed in `package.json` and locked in `package-lock.json`. Install them with `npm install --no-audit --no-fund`. Their respective licenses remain with their publishers. No third-party music or commercial sound recording is bundled.
