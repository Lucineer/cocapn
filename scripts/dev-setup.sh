#!/usr/bin/env bash
# dev-setup.sh — Install dependencies, link packages, start bridge in dev mode
#
# Usage:
#   ./scripts/dev-setup.sh                    # install + link + typecheck
#   ./scripts/dev-setup.sh --start            # also start bridge in dev mode
#   ./scripts/dev-setup.sh --start --no-auth  # start bridge without auth

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE="${NODE:-node}"
NPM="${NPM:-npm}"

# Use nvm node if available
if [ -f "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  source "$HOME/.nvm/nvm.sh"
  if nvm use 20 2>/dev/null; then
    NODE="node"
    NPM="npm"
  fi
fi

START=false
NO_AUTH=""
PRIVATE_REPO=""
PUBLIC_REPO=""

for arg in "$@"; do
  case "$arg" in
    --start)      START=true ;;
    --no-auth)    NO_AUTH="--no-auth" ;;
    --repo=*)     PRIVATE_REPO="${arg#--repo=}" ;;
    --public=*)   PUBLIC_REPO="${arg#--public=}" ;;
  esac
done

echo "==> Cocapn dev setup"
echo "    Node: $($NODE --version)"
echo "    Repo: $REPO_ROOT"
echo ""

# ── 1. Install root dependencies ─────────────────────────────────────────────

echo "==> Installing root dependencies…"
cd "$REPO_ROOT"
$NPM install --prefer-offline 2>/dev/null || $NPM install

# ── 2. Install package dependencies ──────────────────────────────────────────

PACKAGES=(
  "packages/protocols"
  "packages/local-bridge"
  "packages/ui"
)

for pkg in "${PACKAGES[@]}"; do
  if [ -d "$REPO_ROOT/$pkg" ] && [ -f "$REPO_ROOT/$pkg/package.json" ]; then
    echo "==> Installing $pkg…"
    (cd "$REPO_ROOT/$pkg" && $NPM install --prefer-offline 2>/dev/null || $NPM install)
  fi
done

# ── 3. Build protocols (shared types) ────────────────────────────────────────

if [ -d "$REPO_ROOT/packages/protocols" ]; then
  echo "==> Building packages/protocols…"
  (cd "$REPO_ROOT/packages/protocols" && $NPM run build 2>/dev/null || true)
fi

# ── 4. Typecheck local-bridge ────────────────────────────────────────────────

echo "==> Typechecking packages/local-bridge…"
(cd "$REPO_ROOT/packages/local-bridge" && $NODE node_modules/.bin/tsc --noEmit)
echo "    ✓ No type errors"

# ── 5. Run tests ─────────────────────────────────────────────────────────────

echo "==> Running local-bridge tests…"
(cd "$REPO_ROOT/packages/local-bridge" && $NODE node_modules/.bin/vitest run --reporter=verbose 2>&1 | tail -20)

# ── 6. Start bridge in dev mode ───────────────────────────────────────────────

if [ "$START" = true ]; then
  if [ -z "$PRIVATE_REPO" ]; then
    # Default: look for a brain repo next to this one
    PARENT="$(dirname "$REPO_ROOT")"
    if [ -f "$PARENT/brain/cocapn/config.yml" ]; then
      PRIVATE_REPO="$PARENT/brain"
    elif [ -f "$HOME/brain/cocapn/config.yml" ]; then
      PRIVATE_REPO="$HOME/brain"
    else
      echo ""
      echo "ERROR: No private repo found. Specify with --repo=/path/to/brain"
      echo "       or run: cocapn-bridge init"
      exit 1
    fi
  fi

  if [ -z "$PUBLIC_REPO" ]; then
    PUBLIC_REPO="$PRIVATE_REPO"
  fi

  echo ""
  echo "==> Starting bridge in dev mode…"
  echo "    Private repo: $PRIVATE_REPO"
  echo "    Public repo:  $PUBLIC_REPO"
  echo "    Auth:         ${NO_AUTH:-(enabled)}"
  echo ""

  cd "$REPO_ROOT/packages/local-bridge"
  exec $NODE --watch dist/main.js \
    --repo "$PRIVATE_REPO" \
    --public "$PUBLIC_REPO" \
    $NO_AUTH
fi

echo ""
echo "==> Dev setup complete."
echo ""
echo "    To start the bridge:"
echo "      ./scripts/dev-setup.sh --start --repo=/path/to/brain"
echo ""
echo "    To run tests in watch mode:"
echo "      cd packages/local-bridge && npm run test:watch"
