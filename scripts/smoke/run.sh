#!/bin/sh
# Renders every page for real against a mock backend + fixture data and checks the output.
# No network, no credentials. Usage: sh scripts/smoke/run.sh [outdir]
set -u
cd "$(dirname "$0")/../.."
OUT=${1:-/tmp/smoke}
MOCK_PORT=54399
APP_PORT=3311
mkdir -p "$OUT"
node scripts/smoke/fixtures.mjs "$OUT/db.json" >/dev/null || exit 1
export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:$MOCK_PORT NEXT_PUBLIC_SUPABASE_ANON_KEY=mock-anon NEXT_TELEMETRY_DISABLED=1
node node_modules/next/dist/bin/next build > "$OUT/build.log" 2>&1 || { echo "BUILD FAILED"; tail -25 "$OUT/build.log"; exit 1; }
node scripts/smoke/mock-supabase.mjs "$OUT/db.json" $MOCK_PORT > "$OUT/mock.log" 2>&1 &
MOCK=$!
node node_modules/next/dist/bin/next start -p $APP_PORT > "$OUT/next.log" 2>&1 &
APP=$!
trap 'kill $MOCK $APP 2>/dev/null' EXIT
i=0
until curl -s -o /dev/null "http://127.0.0.1:$APP_PORT/login" || [ $i -ge 60 ]; do i=$((i+1)); sleep 0.5; done
node scripts/smoke/check.mjs "http://127.0.0.1:$APP_PORT" "http://127.0.0.1:$MOCK_PORT" "$OUT"
RC=$?
# SHOTS=1: screenshots of the main pages (needs google-chrome) before the actions change the data
if [ "${SHOTS:-}" = 1 ]; then
  # a page that scrolls sideways at either width fails the run
  node scripts/smoke/shots.mjs "http://127.0.0.1:$APP_PORT" "$OUT/shots" 1440 || RC=1
  node scripts/smoke/shots.mjs "http://127.0.0.1:$APP_PORT" "$OUT/shots" 390 > "$OUT/shots-phone.log" || RC=1
  grep -E "OVERFLOWS|SHOTS FAIL" "$OUT/shots-phone.log"
fi
# server actions (these change the mock's data, so they run after the read-only page checks)
node scripts/smoke/actions.mjs "http://127.0.0.1:$APP_PORT" "http://127.0.0.1:$MOCK_PORT"
RC2=$?
[ $RC -eq 0 ] && RC=$RC2
grep -i -E "error|warn" "$OUT/next.log" | grep -v -i "middleware" | head -15
exit $RC
