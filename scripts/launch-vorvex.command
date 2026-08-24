#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -d node_modules ]; then npm ci; fi
if [ ! -f .next/BUILD_ID ]; then npm run build; fi
open http://127.0.0.1:3000 2>/dev/null || true
exec npm run founder:start
