#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo '== protocol tests =='
node --test packages/protocol/test/*.test.js

echo '== deterministic judge demo =='
node apps/agent-bridge/src/demo.js >/tmp/boundkey-demo.out
grep -q 'Permission proof: VALID' /tmp/boundkey-demo.out
grep -q '50-byte voucher | signature ✓' /tmp/boundkey-demo.out
grep -q 'BLOCKED (cap-exceeded)' /tmp/boundkey-demo.out
grep -q 'BLOCKED (wrong-payee)' /tmp/boundkey-demo.out

echo '== bridge HTTP smoke =='
node apps/agent-bridge/src/server.js >/tmp/boundkey-bridge.log 2>&1 &
PID=$!
trap 'kill "$PID" 2>/dev/null || true' EXIT
sleep 0.35
curl -fsS http://127.0.0.1:8787/health | grep -q 'BoundKey'
RESPONSE="$(curl -fsS -X POST http://127.0.0.1:8787/requests -H 'content-type: application/json' -d '{"agentName":"Codex","maxSpend":0.25}')"
node -e 'const x=JSON.parse(process.argv[1]); if(!x.deepLink.startsWith("boundkey://authorize") || x.proofValid!==true) process.exit(1)' "$RESPONSE"
kill "$PID" 2>/dev/null || true
trap - EXIT

echo '== competition files =='
for file in \
  apps/mobile/app/index.tsx \
  apps/mobile/src/lib/paymentChannel.ts \
  apps/agent-bridge/src/mobile-mpp-opener.ts \
  apps/demo-merchant/src/server.ts \
  docs/SECURITY.md \
  docs/LIVE_DEMO.md \
  submission/SUBMISSION.md \
  submission/WIN_STRATEGY.md \
  demo-web/index.html; do
  test -s "$file"
done

if grep -RIn --exclude='*.zip' -E 'AgentPass|agentpass' README.md apps packages docs submission demo-web >/tmp/boundkey-old-brand.txt; then
  cat /tmp/boundkey-old-brand.txt
  echo 'FAIL: old brand remains'
  exit 1
fi

echo 'PASS: BoundKey repository-level competition checks succeeded.'
