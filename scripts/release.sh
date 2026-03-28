#!/usr/bin/env bash
# release.sh — Tag release, publish packages, update templates
#
# Usage:
#   ./scripts/release.sh patch    # 0.1.0 → 0.1.1
#   ./scripts/release.sh minor    # 0.1.0 → 0.2.0
#   ./scripts/release.sh major    # 0.1.0 → 1.0.0
#   ./scripts/release.sh 0.3.0    # explicit version

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE="${NODE:-node}"
NPM="${NPM:-npm}"

if [ -f "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  source "$HOME/.nvm/nvm.sh"
  nvm use 20 2>/dev/null || true
fi

BUMP="${1:-}"
if [ -z "$BUMP" ]; then
  echo "Usage: $0 [patch|minor|major|<version>]"
  exit 1
fi

cd "$REPO_ROOT"

# ── Pre-flight checks ─────────────────────────────────────────────────────────

echo "==> Pre-flight checks…"

if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: Working directory is not clean. Commit or stash changes first."
  exit 1
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "ERROR: Must be on main branch to release (current: $CURRENT_BRANCH)"
  exit 1
fi

git fetch origin main --quiet
LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse origin/main)"
if [ "$LOCAL" != "$REMOTE" ]; then
  echo "ERROR: Local main is not up to date with origin/main. Run: git pull"
  exit 1
fi

echo "    ✓ Clean working directory"
echo "    ✓ On main branch"
echo "    ✓ Up to date with origin"

# ── Determine new version ─────────────────────────────────────────────────────

CURRENT_VERSION="$(node -p "require('./packages/local-bridge/package.json').version")"
echo ""
echo "    Current version: $CURRENT_VERSION"

if [[ "$BUMP" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  NEW_VERSION="$BUMP"
else
  # Compute next version using semver logic
  IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"
  case "$BUMP" in
    patch) NEW_VERSION="$MAJOR.$MINOR.$((PATCH + 1))" ;;
    minor) NEW_VERSION="$MAJOR.$((MINOR + 1)).0" ;;
    major) NEW_VERSION="$((MAJOR + 1)).0.0" ;;
    *)
      echo "ERROR: Unknown bump type '$BUMP'. Use patch, minor, major, or x.y.z"
      exit 1
      ;;
  esac
fi

echo "    New version:     $NEW_VERSION"
echo ""
read -r -p "==> Continue with release $NEW_VERSION? [y/N] " confirm
if [[ "$confirm" != [yY] ]]; then
  echo "Aborted."
  exit 0
fi

# ── Run tests ─────────────────────────────────────────────────────────────────

echo ""
echo "==> Running tests…"
(cd "$REPO_ROOT/packages/local-bridge" && $NODE node_modules/.bin/vitest run 2>&1 | tail -5)
echo "    ✓ Tests passed"

echo "==> Typechecking…"
(cd "$REPO_ROOT/packages/local-bridge" && $NODE node_modules/.bin/tsc --noEmit)
echo "    ✓ No type errors"

# ── Bump versions ─────────────────────────────────────────────────────────────

echo ""
echo "==> Bumping versions to $NEW_VERSION…"

PACKAGES=(
  "packages/local-bridge"
  "packages/protocols"
  "packages/ui"
)

for pkg in "${PACKAGES[@]}"; do
  if [ -f "$REPO_ROOT/$pkg/package.json" ]; then
    (cd "$REPO_ROOT/$pkg" && $NPM version "$NEW_VERSION" --no-git-tag-version --quiet)
    echo "    ✓ $pkg"
  fi
done

# Update COCAPN_VERSION constant
SPAWNER="$REPO_ROOT/packages/local-bridge/src/modules/manager.ts"
if grep -q 'COCAPN_VERSION' "$SPAWNER"; then
  sed -i "s/COCAPN_VERSION = \"[0-9.]*\"/COCAPN_VERSION = \"$NEW_VERSION\"/" "$SPAWNER"
  echo "    ✓ COCAPN_VERSION constant updated"
fi

# ── Build ─────────────────────────────────────────────────────────────────────

echo ""
echo "==> Building packages…"
(cd "$REPO_ROOT/packages/local-bridge" && $NODE node_modules/.bin/tsc)
echo "    ✓ local-bridge built"

# ── Commit and tag ────────────────────────────────────────────────────────────

echo ""
echo "==> Committing and tagging…"

git add packages/*/package.json packages/local-bridge/src/modules/manager.ts
git commit -m "chore: release v$NEW_VERSION"
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"

echo "    ✓ Committed: chore: release v$NEW_VERSION"
echo "    ✓ Tagged: v$NEW_VERSION"

# ── Publish ───────────────────────────────────────────────────────────────────

echo ""
echo "==> Publishing packages…"

if [ -f "$REPO_ROOT/packages/local-bridge/package.json" ]; then
  PACKAGE_NAME="$(node -p "require('$REPO_ROOT/packages/local-bridge/package.json').name")"
  if [[ "$PACKAGE_NAME" != *"private"* ]]; then
    (cd "$REPO_ROOT/packages/local-bridge" && $NPM publish --access public)
    echo "    ✓ Published $PACKAGE_NAME@$NEW_VERSION to npm"
  fi
fi

# ── Push ──────────────────────────────────────────────────────────────────────

echo ""
echo "==> Pushing to origin…"
git push origin main
git push origin "v$NEW_VERSION"
echo "    ✓ Pushed main and tag"

# ── GitHub release ────────────────────────────────────────────────────────────

if command -v gh &>/dev/null; then
  echo ""
  echo "==> Creating GitHub release…"
  PREV_TAG="$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo "")"
  if [ -n "$PREV_TAG" ]; then
    CHANGELOG="$(git log "$PREV_TAG"..HEAD --pretty=format:'- %s' | grep -v 'chore: release')"
  else
    CHANGELOG="Initial release"
  fi

  gh release create "v$NEW_VERSION" \
    --title "v$NEW_VERSION" \
    --notes "## Changes

$CHANGELOG

## Install

\`\`\`bash
npm install -g cocapn-bridge@$NEW_VERSION
\`\`\`
"
  echo "    ✓ GitHub release created"
fi

# ── Done ──────────────────────────────────────────────────────────────────────

echo ""
echo "==> Release v$NEW_VERSION complete."
echo ""
echo "    npm: https://www.npmjs.com/package/cocapn-bridge"
echo "    git: git tag v$NEW_VERSION"
echo ""
