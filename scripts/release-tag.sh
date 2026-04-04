#!/usr/bin/env bash
set -euo pipefail

# ── Release tagging script ──────────────────────────────────
# Automates post-merge release tagging and version bump branch creation.
#
# Prerequisites:
#   - Feature branch PR already merged to main
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

resolve_remote_tag_sha() {
  local tag="$1"
  local sha

  sha=$(git ls-remote origin "refs/tags/${tag}^{}" | cut -f1)
  if [[ -n "$sha" ]]; then
    printf '%s\n' "$sha"
    return 0
  fi

  git ls-remote origin "refs/tags/${tag}" | cut -f1
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
run git fetch origin

# ── Verify branches are in sync ─────────────────────────────

LOCAL_MAIN=$(git rev-parse main)
REMOTE_MAIN=$(git rev-parse origin/main)
if [[ "$LOCAL_MAIN" != "$REMOTE_MAIN" ]]; then
  echo "Error: local main ($LOCAL_MAIN) differs from origin/main ($REMOTE_MAIN)." >&2
  echo "Run: git checkout main && git pull" >&2
  exit 1
fi

# ── Read version from main ──────────────────────────────────

VERSION=$(git show origin/main:package.json | jq -r .version)
TAG="v${VERSION}"

# ── Early tag conflict guard ─────────────────────────────────
# Fail fast BEFORE any local changes (merge/version bump) if the
# tag already exists but points to the wrong commit.

if git rev-parse "$TAG" &>/dev/null || git ls-remote --exit-code --tags origin "refs/tags/$TAG" &>/dev/null; then
  EXISTING_TAG_SHA=$(git rev-parse "$TAG^{}" 2>/dev/null || resolve_remote_tag_sha "$TAG")
  MAIN_SHA=$(git rev-parse origin/main)
  if [[ "$EXISTING_TAG_SHA" != "$MAIN_SHA" ]]; then
    echo "Error: tag ${TAG} already exists but points to a different commit." >&2
    echo "  Tag points to:  ${EXISTING_TAG_SHA}" >&2
    echo "  origin/main is: ${MAIN_SHA}" >&2
    exit 1
  fi
fi

# ── Check for outdated dependencies ─────────────────────────

echo
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ ! -f "${SCRIPT_DIR}/check-outdated-deps.sh" ]]; then
  echo "Note: check-outdated-deps.sh not found — skipping dependency freshness check"
elif ! bash "${SCRIPT_DIR}/check-outdated-deps.sh"; then
  if $DRY_RUN; then
    echo "[dry-run] skipping outdated-dep abort prompt"
  else
    read -rp "Proceed anyway? [y/N] " OUTDATED_CONFIRM
    if [[ "$OUTDATED_CONFIRM" != "y" && "$OUTDATED_CONFIRM" != "Y" ]]; then
      echo "Aborted."
      exit 0
    fi
  fi
fi

echo
echo "Version on main: ${VERSION}"
echo "Tag to create:   ${TAG}"
echo

# ── Confirm ──────────────────────────────────────────────────

read -rp "Create tag ${TAG} on main and create version bump branch? [y/N] " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
  echo "Aborted."
  exit 0
fi

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

# ── Bump version on release branch ─────────────────────────

echo
echo "Bumping ${BUMP_TYPE} version..."
if $DRY_RUN; then
  NEXT_VERSION=$(npx --yes semver "$VERSION" -i "$BUMP_TYPE")
  echo "[dry-run] Next version would be: ${NEXT_VERSION}"
  echo "[dry-run] git checkout -b release/version-${NEXT_VERSION} origin/main"
  echo "[dry-run] npm version ${BUMP_TYPE} --no-git-tag-version"
  echo "[dry-run] git commit -m 'chore: bump version to ${NEXT_VERSION}'"
  echo "[dry-run] git push origin release/version-${NEXT_VERSION}"
else
  NEXT_VERSION=$(npx --yes semver "$VERSION" -i "$BUMP_TYPE")
  run git checkout -b "release/version-${NEXT_VERSION}" origin/main
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

# ── Commit and push release branch ──────────────────────────

echo
echo "Committing version bump..."
run git add package.json package-lock.json
run git commit -m "chore: bump version to ${NEXT_VERSION}"
run git push origin "release/version-${NEXT_VERSION}"

# ── Tag main and push everything ─────────────────────────────
# Tag and push happen LAST so nothing is irreversible until all
# local steps (merge + version bump) have succeeded.
# Conflict case was already caught by the early guard above;
# this only handles the idempotent re-run (tag already correct).

echo
LOCAL_TAG_EXISTS=false
REMOTE_TAG_EXISTS=false
if git rev-parse "$TAG" &>/dev/null; then
  LOCAL_TAG_EXISTS=true
fi
if git ls-remote --exit-code --tags origin "refs/tags/$TAG" &>/dev/null; then
  REMOTE_TAG_EXISTS=true
fi

if $REMOTE_TAG_EXISTS; then
  echo "✓ Tag ${TAG} already exists on origin — skipping tag creation and push"
else
  if ! $LOCAL_TAG_EXISTS; then
    echo "Tagging origin/main as ${TAG}..."
    run git tag "$TAG" origin/main
  else
    echo "Local tag ${TAG} exists but is not on origin — pushing it now..."
  fi
fi

if ! $REMOTE_TAG_EXISTS; then
  echo "Pushing tag ${TAG}..."
  run git push origin "$TAG"
fi

echo
echo "✓ Done!"
echo
echo "  Tagged:   ${TAG} on main"
echo "  Bump PR:  release/version-${NEXT_VERSION} → main"
echo
REPO_URL=$(git remote get-url origin | sed 's|.*github.com[:/]||;s|\.git$||')
echo "Check the release workflow: https://github.com/${REPO_URL}/actions/workflows/release.yml"
