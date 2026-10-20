#!/usr/bin/env bash
# Runs the Spin Off regression suite: every tests/*.test.js (browser tests,
# need Playwright + Chromium) and tests/*.test.mjs (plain Node tests).
# Exits non-zero if any test fails. Usage: bash tests/run.sh
# Playwright is found through $PW, or the global npm install if PW is unset.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -z "${PW:-}" ]; then
  PW="$(npm root -g 2>/dev/null)/playwright"
  [ -d "$PW" ] || PW=playwright
fi
export PW
shopt -s nullglob
files=(tests/*.test.mjs tests/*.test.js)
[ ${#files[@]} -gt 0 ] || { echo "no test files found" >&2; exit 1; }
# One file at a time so browser tests do not compete for the CPU.
node --test --test-concurrency=1 --test-reporter=spec "${files[@]}"
