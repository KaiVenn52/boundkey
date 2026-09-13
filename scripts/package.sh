#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
rm -f boundkey-submission.zip
zip -qr boundkey-submission.zip . -x 'node_modules/*' '.git/*' 'boundkey-submission.zip' '*.DS_Store'
echo "$ROOT/boundkey-submission.zip"
