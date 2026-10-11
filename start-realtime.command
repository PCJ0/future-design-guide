#!/bin/sh
cd "$(dirname "$0")" || exit 1
if command -v node >/dev/null 2>&1; then
  LAB_NODE="$(command -v node)"
else
  LAB_NODE="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
fi
if [ ! -x "$LAB_NODE" ]; then
  echo 'Please install Node.js 22 or newer from https://nodejs.org/'
  exit 1
fi
open 'http://localhost:5173'
exec "$LAB_NODE" scripts/dev-server.mjs
