#!/usr/bin/env bash
# test-fleet.sh — Spin up multiple local domains for testing A2A
#
# Starts four bridge instances on ports 8787-8790, each simulating a different
# domain, sharing the same test private repo. Prints example A2A curl commands.
#
# Usage:
#   ./scripts/test-fleet.sh                        # use temp dir for test repos
#   ./scripts/test-fleet.sh --repo /path/to/brain  # use an existing repo

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE="${NODE:-node}"
BRIDGE="$REPO_ROOT/packages/local-bridge/dist/main.js"

# Use nvm node if available
if [ -f "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  source "$HOME/.nvm/nvm.sh"
  nvm use 20 2>/dev/null || true
fi

CUSTOM_REPO=""
for arg in "$@"; do
  case "$arg" in
    --repo=*) CUSTOM_REPO="${arg#--repo=}" ;;
  esac
done

# ── Build bridge if needed ────────────────────────────────────────────────────

if [ ! -f "$BRIDGE" ]; then
  echo "==> Building bridge…"
  (cd "$REPO_ROOT/packages/local-bridge" && $NODE node_modules/.bin/tsc)
fi

# ── Create test repos ─────────────────────────────────────────────────────────

TMPDIR_BASE="$(mktemp -d)"
trap 'echo ""; echo "==> Cleaning up…"; kill 0 2>/dev/null; rm -rf "$TMPDIR_BASE"' EXIT INT TERM

create_test_repo() {
  local name="$1"
  local dir="$TMPDIR_BASE/$name"

  if [ -n "$CUSTOM_REPO" ]; then
    echo "$CUSTOM_REPO"
    return
  fi

  mkdir -p "$dir/cocapn" "$dir/secrets" "$dir/wiki" "$dir/tasks"

  cat > "$dir/cocapn/config.yml" <<EOF
config:
  mode: local
  port: 0
soul:
  path: cocapn/soul.md
EOF

  cat > "$dir/cocapn/soul.md" <<EOF
# Test Soul — $name

You are a test agent for the $name domain. Keep responses brief.
When asked for structured data, respond with JSON.
EOF

  git -C "$dir" init -q
  git -C "$dir" config user.email "test@cocapn.test"
  git -C "$dir" config user.name "Cocapn Test"
  git -C "$dir" add -A
  git -C "$dir" commit -q -m "init test repo"

  echo "$dir"
}

DOMAINS=("makerlog" "studylog" "activelog" "lifelog")
BASE_PORT=8787
PIDS=()
REPOS=()

echo "==> Setting up test fleet…"
echo ""

for i in "${!DOMAINS[@]}"; do
  domain="${DOMAINS[$i]}"
  port=$((BASE_PORT + i))
  repo="$(create_test_repo "$domain")"
  REPOS+=("$repo")

  echo "    Starting $domain bridge on port $port…"
  $NODE "$BRIDGE" \
    --repo "$repo" \
    --port "$port" \
    --no-auth \
    2>&1 | sed "s/^/[$domain] /" &
  PIDS+=($!)
done

echo ""
echo "==> Fleet running. Ports:"
for i in "${!DOMAINS[@]}"; do
  domain="${DOMAINS[$i]}"
  port=$((BASE_PORT + i))
  echo "    $domain → ws://localhost:$((BASE_PORT + i))"
done

echo ""
echo "==> Example A2A test commands:"
echo ""
echo "    # Send a chat to makerlog:"
echo "    websocat ws://localhost:8787 <<< '{\"type\":\"CHAT\",\"id\":\"1\",\"content\":\"Hello\"}'"
echo ""
echo "    # Test A2A routing (makerlog → studylog):"
echo "    websocat ws://localhost:8787 <<< '{\"type\":\"A2A\",\"id\":\"2\",\"targetDomain\":\"studylog.ai\",\"content\":\"What tasks do I have?\"}'"
echo ""
echo "    # List modules on activelog:"
echo "    websocat ws://localhost:8789 <<< '{\"type\":\"RPC\",\"id\":\"3\",\"method\":\"module/list\"}'"
echo ""
echo "Press Ctrl+C to stop all bridges."
echo ""

# Wait for all bridge processes
wait "${PIDS[@]}"
