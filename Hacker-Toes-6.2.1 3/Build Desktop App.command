#!/bin/bash
cd "$(dirname "$0")" || exit 1
export PATH="$PATH:/usr/local/bin:/opt/homebrew/bin"
printf '\nHACKER TOES — BUILD macOS APP\n\n'
if ! command -v node >/dev/null 2>&1; then
  echo 'Install Node.js 22.12 or newer from https://nodejs.org first.'
  open https://nodejs.org
  read -r -p 'Press Enter to close.'
  exit 1
fi
if ! node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=12)?0:1)'; then
  echo 'Please install Node.js 22.12 or newer.'
  read -r -p 'Press Enter to close.'
  exit 1
fi
npm install --no-audit --no-fund || { read -r -p 'Dependency installation failed. Press Enter to close.'; exit 1; }
npm run dist:mac || { read -r -p 'The macOS app build failed. Press Enter to close.'; exit 1; }
printf '\nBuild finished. Look inside the release folder for the DMG and ZIP.\n'
read -r -p 'Press Enter to close.'
