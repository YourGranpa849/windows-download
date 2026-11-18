#!/bin/bash
cd "$(dirname "$0")" || exit 1
export PATH="$PATH:/usr/local/bin:/opt/homebrew/bin"
if ! command -v node >/dev/null 2>&1; then
  printf 'Install Node.js 22.12 or newer at https://nodejs.org, then try again.\n'
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
  npm install --no-audit --no-fund || exit 1
fi
npm run build || exit 1
node internet-server.js
read -r -p 'Press Enter to close.'
