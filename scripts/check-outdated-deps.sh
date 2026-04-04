#!/usr/bin/env bash
set -euo pipefail

# ── Check for outdated npm dependencies ────────────────────
# Compares installed versions against the absolute latest on npm.
#
# Exit codes:
#   0 — all dependencies are on their latest versions
#   1 — one or more dependencies are behind their latest version
#
# Usage:
#   bash scripts/check-outdated-deps.sh

if ! command -v jq &>/dev/null; then
  echo "Error: jq is required but not installed." >&2
  exit 1
fi

echo "Checking for outdated dependencies..."
OUTDATED_JSON=$(npm outdated --json 2>/dev/null || true)

# Filter to packages where current != latest (absolute latest, not semver "wanted")
OUTDATED_PKGS=$(echo "$OUTDATED_JSON" | jq -r '
  to_entries
  | map(select(.value.current != .value.latest))
  | .[]
  | [.key, .value.current, .value.latest]
  | @tsv
')

if [[ -n "$OUTDATED_PKGS" ]]; then
  echo
  echo "Warning: the following dependencies are not on their latest versions:"
  echo
  { printf "  Package\tCurrent\tLatest\n"; echo "$OUTDATED_PKGS" | while IFS=$'\t' read -r pkg current latest; do printf "  %s\t%s\t%s\n" "$pkg" "$current" "$latest"; done; } | column -t -s $'\t'
  echo
  exit 1
else
  echo "✓ All dependencies are on their latest versions"
fi
