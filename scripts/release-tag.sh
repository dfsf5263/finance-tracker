#!/usr/bin/env bash
set -euo pipefail

# ── Release tagging script ──────────────────────────────────
# Automates post-merge release tagging and develop version bump.
#
# Prerequisites:
#   - develop → main merge already completed via PR
#   - Working tree is clean
#   - jq is installed
#
# Usage:
#   bash scripts/release-tag.sh            # normal run
#   bash scripts/release-tag.sh --dry-run  # preview without executing

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "=== DRY RUN — no changes will be made ==="
  echo
fi

run() {
  if $DRY_RUN; then
    echo "[dry-run] $*"
  else
    "$@"
  fi
}

# ── Pre-flight checks ───────────────────────────────────────

if ! command -v jq &>/dev/null; then
  echo "Error: jq is required but not installed." >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Error: working tree is not clean. Commit or stash changes first." >&2
  exit 1
fi

echo "Fetching latest from origin..."
git fetch origin

# ── Verify branches are in sync ─────────────────────────────

LOCAL_MAIN=$(git rev-parse main)
REMOTE_MAIN=$(git rev-parse origin/main)
if [[ "$LOCAL_MAIN" != "$REMOTE_MAIN" ]]; then
  echo "Error: local main ($LOCAL_MAIN) differs from origin/main ($REMOTE_MAIN)." >&2
  echo "Run: git checkout main && git pull" >&2
  exit 1
fi

LOCAL_DEVELOP=$(git rev-parse develop)
REMOTE_DEVELOP=$(git rev-parse origin/develop)
if [[ "$LOCAL_DEVELOP" != "$REMOTE_DEVELOP" ]]; then
  echo "Error: local develop ($LOCAL_DEVELOP) differs from origin/develop ($REMOTE_DEVELOP)." >&2
  echo "Run: git checkout develop && git pull" >&2
  exit 1
fi

# ── Read version from main ──────────────────────────────────

VERSION=$(git show origin/main:package.json | jq -r .version)
TAG="v${VERSION}"

echo
echo "Version on main: ${VERSION}"
echo "Tag to create:   ${TAG}"
echo

# Check if tag already exists
if git rev-parse "$TAG" &>/dev/null; then
  echo "Error: tag ${TAG} already exists." >&2
  exit 1
fi

# ── Confirm ──────────────────────────────────────────────────

read -rp "Create and push tag ${TAG} on main? [y/N] " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
  echo "Aborted."
  exit 0
fi

# ── Tag main ─────────────────────────────────────────────────

echo
echo "Tagging origin/main as ${TAG}..."
run git tag "$TAG" origin/main
run git push origin "$TAG"
echo "✓ Tag ${TAG} pushed"

# ── Merge main into develop ──────────────────────────────────

echo
echo "Merging main into develop..."
run git checkout develop
run git merge main --no-edit
echo "✓ main merged into develop"

# ── Prompt for next version bump ─────────────────────────────

echo
echo "Current version: ${VERSION}"
echo "Select next version bump:"
echo "  1) patch"
echo "  2) minor"
echo "  3) major"
read -rp "Choice [1/2/3]: " BUMP_CHOICE

case "$BUMP_CHOICE" in
  1) BUMP_TYPE="patch" ;;
  2) BUMP_TYPE="minor" ;;
  3) BUMP_TYPE="major" ;;
  *)
    echo "Invalid choice. Aborted." >&2
    exit 1
    ;;
esac

# ── Bump version on develop ─────────────────────────────────

echo
echo "Bumping ${BUMP_TYPE} version..."
if $DRY_RUN; then
  NEXT_VERSION=$(npx --yes semver "$VERSION" -i "$BUMP_TYPE")
  echo "[dry-run] npm version ${BUMP_TYPE} --no-git-tag-version"
  echo "[dry-run] Next version would be: ${NEXT_VERSION}"
else
  npm version "$BUMP_TYPE" --no-git-tag-version
  NEXT_VERSION=$(jq -r .version package.json)
fi

echo "✓ Version bumped to ${NEXT_VERSION}"

# ── npm audit and install ────────────────────────────────────

echo
echo "Running npm audit..."
run npm audit || true

echo
echo "Running npm install..."
run npm install

# ── Commit and push ──────────────────────────────────────────

echo
echo "Committing version bump..."
run git add package.json package-lock.json
run git commit -m "chore: bump version to ${NEXT_VERSION}"
run git push origin develop

echo
echo "✓ Done!"
echo
echo "  Tagged:   ${TAG} on main"
echo "  Develop:  bumped to ${NEXT_VERSION}"
echo
REPO_URL=$(git remote get-url origin | sed 's|.*github.com[:/]||;s|\.git$||')
echo "Check the release workflow: https://github.com/${REPO_URL}/actions/workflows/release.yml"
