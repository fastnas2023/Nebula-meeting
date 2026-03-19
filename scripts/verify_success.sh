#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLIENT_DIR="$ROOT_DIR/client"
SERVER_DIR="$ROOT_DIR/server"

PLAYWRIGHT_TEST_PATH="${PLAYWRIGHT_TEST_PATH:-tests/fullscreen_sort_persist_record.spec.js}"
PLAYWRIGHT_PROJECT="${PLAYWRIGHT_PROJECT:-chromium}"
SERVER_PORT="${SERVER_PORT:-5002}"

is_port_open() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
    return $?
  fi
  if command -v nc >/dev/null 2>&1; then
    nc -z localhost "$port" >/dev/null 2>&1
    return $?
  fi
  return 1
}

wait_for_port() {
  local port="$1"
  local attempts="${2:-60}"
  local sleep_s="${3:-0.5}"

  for _ in $(seq 1 "$attempts"); do
    if is_port_open "$port"; then
      return 0
    fi
    sleep "$sleep_s"
  done

  return 1
}

port_owner_command() {
  local port="$1"
  if ! command -v lsof >/dev/null 2>&1; then
    echo ""
    return 0
  fi
  lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null | awk 'NR==2 {print $1}'
}

pick_free_port() {
  local preferred="$1"
  if ! is_port_open "$preferred"; then
    echo "$preferred"
    return 0
  fi

  local owner
  owner="$(port_owner_command "$preferred")"
  if [ -n "$owner" ] && [ "$owner" = "node" ]; then
    echo "$preferred"
    return 0
  fi

  for p in 5003 5004 5005 5006 5007 5008 5009; do
    if ! is_port_open "$p"; then
      echo "$p"
      return 0
    fi
  done

  echo "$preferred"
}

echo "[verify] Root: $ROOT_DIR"

echo "[verify] Install server dependencies"
(cd "$SERVER_DIR" && npm ci)

echo "[verify] Install client dependencies"
(cd "$CLIENT_DIR" && npm ci)

echo "[verify] Install Playwright browser ($PLAYWRIGHT_PROJECT)"
(cd "$CLIENT_DIR" && npx playwright install "$PLAYWRIGHT_PROJECT")

SERVER_PORT="$(pick_free_port "$SERVER_PORT")"
export PORT="$SERVER_PORT"
export VITE_SERVER_PORT="$SERVER_PORT"

SERVER_PID=""
if ! is_port_open "$SERVER_PORT"; then
  echo "[verify] Start signaling server on :$SERVER_PORT"
  bash -c "cd \"$SERVER_DIR\" && exec node index.js" &
  SERVER_PID="$!"

  cleanup() {
    if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" >/dev/null 2>&1; then
      kill "$SERVER_PID" >/dev/null 2>&1 || true
      wait "$SERVER_PID" >/dev/null 2>&1 || true
    fi
  }
  trap cleanup EXIT

  if ! wait_for_port "$SERVER_PORT" 60 0.5; then
    echo "[verify] Server did not become ready on :$SERVER_PORT" >&2
    exit 1
  fi
else
  echo "[verify] Port :$SERVER_PORT already in use (owner: $(port_owner_command "$SERVER_PORT"))"
fi

echo "[verify] Run typecheck"
(cd "$CLIENT_DIR" && npm run typecheck)

echo "[verify] Run unit tests"
(cd "$CLIENT_DIR" && npm test)

echo "[verify] Run lint"
(cd "$CLIENT_DIR" && npm run lint)

echo "[verify] Run Playwright: $PLAYWRIGHT_TEST_PATH ($PLAYWRIGHT_PROJECT)"
(cd "$CLIENT_DIR" && npx playwright test "$PLAYWRIGHT_TEST_PATH" --project="$PLAYWRIGHT_PROJECT")

echo "[verify] OK"
