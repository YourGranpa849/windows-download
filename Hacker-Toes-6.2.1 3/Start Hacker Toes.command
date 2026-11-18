#!/bin/bash
cd "$(dirname "$0")" || exit 1
export PATH="$PATH:/usr/local/bin:/opt/homebrew/bin"
printf '\n  HACKER TOES 6.0\n  Your local hangout is getting ready.\n\n'
if ! command -v node >/dev/null 2>&1; then
  printf 'Install Node.js 22.12 or newer from https://nodejs.org, then open this file again.\n'
  open https://nodejs.org
  read -r -p 'Press Enter to close.'
  exit 1
fi
if ! node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=12)?0:1)'; then
  printf 'Please update Node.js to version 22.12 or newer at https://nodejs.org.\n'
  read -r -p 'Press Enter to close.'
  exit 1
fi
if [ ! -d node_modules ]; then
  printf 'Installing the app files. Internet is needed only for this first setup.\n'
  npm install --no-audit --no-fund || { read -r -p 'Setup did not finish. Press Enter to close.'; exit 1; }
fi
npm run build || { read -r -p 'The app could not be built. Press Enter to close.'; exit 1; }
OPEN_BROWSER=1 node server.js
if [ "$?" -ne 0 ]; then
  read -r -p 'Press Enter to close.'
fi
