# Releasing

This document describes the release process for Finance Tracker, including how Docker image tagging works and how to cut a new release.

## Tag Strategy

| Trigger | Docker Tags | GitHub Release |
|---|---|---|
| Push to `main` | `:nightly`, `:nightly-YYYYMMDD`, `:nightly-sha-<commit>` | No |
| Push `v*` tag | `:latest`, `:<version>`, `:sha-<commit>` | Yes (commit-subject synopsis + auto-generated notes) |

- **`:nightly`** — always points to the latest `main` build. Overwritten on every merge.
- **`:nightly-YYYYMMDD`** — date-stamped nightly for traceability (e.g., `:nightly-20260317`).
- **`:nightly-sha-<commit>`** — commit-pinned nightly for exact reproducibility.
- **`:latest`** — always points to the most recent stable release. Only moves on tag pushes.
- **`:<version>`** — immutable version tag matching `package.json` (e.g., `:0.2.0`). Cannot be overwritten.
- **`:sha-<commit>`** — commit-pinned release image.

## Cutting a Release

### 1. Bump the version

Update the version in `package.json`:

```bash
# Edit package.json, changing version from e.g. "0.1.0" to "0.2.0"
```

### 2. Open a feature branch PR

Work on a feature branch off `main`, then open a PR and squash-merge it to `main`. This triggers a nightly build — the new code is now available at `:nightly`.

### 3. Create and push a Git tag

```bash
git tag v0.2.0
git push origin v0.2.0
```

The tag name **must** match the pattern `v*` and the numeric portion must match the version in `package.json`.

### 4. Verify

The tag push triggers the Release workflow, which will:

1. Verify the version tag doesn't already exist in GHCR (immutability check)
2. Build multi-arch images (amd64 + arm64)
3. Create the multi-arch manifest tagged as `:latest`, `:0.2.0`, and `:sha-<commit>`
4. Create a GitHub Release at `github.com/dfsf5263/finance-tracker/releases/tag/v0.2.0` with auto-generated release notes
  plus a synopsis section built from the subject line of each commit since the previous tag

Check the [Actions tab](https://github.com/dfsf5263/finance-tracker/actions/workflows/release.yml) to confirm the workflow succeeded.

### Using the release script

After your feature branch PR is merged to main, run the release script to automate tagging and version bump branch creation:

```bash
bash scripts/release-tag.sh            # normal run
bash scripts/release-tag.sh --dry-run  # preview without executing
```

The script will:

1. Verify branches are clean and in sync with origin
2. Tag main with the version from `package.json` and push the tag
3. Prompt for the next version bump (major / minor / patch)
4. Create a `release/version-X.Y.Z` branch off main with the bumped version
5. Run `npm audit` and `npm install`
6. Commit and push the release branch — open the PR to merge it to main

## What Triggers What

```
main branch push
  └─ Release workflow (nightly)
       ├─ Build amd64 image
       ├─ Build arm64 image
       └─ Publish manifest → :nightly, :nightly-YYYYMMDD, :nightly-sha-xxx

v* tag push
  └─ Release workflow (release)
       ├─ Immutability check (fails if version tag exists)
       ├─ Build amd64 image
       ├─ Build arm64 image
       ├─ Publish manifest → :latest, :X.Y.Z, :sha-xxx
       └─ Create GitHub Release with commit-subject synopsis + auto-generated notes
```

## Version Immutability

Once a version tag (e.g., `:0.2.0`) is published to GHCR, it cannot be overwritten. If you push a `v*` tag and the version in `package.json` already exists in the registry, the workflow will fail with:

```
::error::Image tag 0.2.0 already exists in GHCR. Bump the version in package.json before tagging.
```

To fix this, bump the version in `package.json`, merge, and push a new tag.

## For Self-Hosters

Users who deploy Finance Tracker should use **`:latest`** or a specific version tag (e.g., `:0.2.0`). These are stable, tested releases.

```bash
# Pin to a specific version (recommended)
docker pull ghcr.io/dfsf5263/finance-tracker:0.2.0

# Always get the latest stable release
docker pull ghcr.io/dfsf5263/finance-tracker:latest

# Use the nightly build (latest from main, may be unstable)
docker pull ghcr.io/dfsf5263/finance-tracker:nightly
```

To update a running Docker Compose deployment:

```bash
docker compose pull
docker compose up -d
```
