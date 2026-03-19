---
applyTo: ".github/workflows/**"
---

# GitHub Actions — Workflow Standards

## Action Versions

Always use the latest major version of every GitHub Action. Do not downgrade or pin to older
major versions unless there is a documented compatibility reason.

Current versions in use — keep these in sync across all workflows:

| Action | Version |
|--------|---------|
| `actions/checkout` | `@v6` |
| `actions/setup-node` | `@v6` |
| `actions/upload-artifact` | `@v6` |
| `docker/login-action` | `@v4` |
| `docker/setup-buildx-action` | `@v4` |
| `docker/build-push-action` | `@v7` |
| `github/codeql-action/*` | `@v4` |
| `codecov/codecov-action` | `@v5` |
| `softprops/action-gh-release` | `@v2` |
| `zaproxy/action-baseline` | `@v0.13.0` |

When adding a new action, check the action's GitHub releases page to confirm the latest
major version and use it consistently across all workflow files.

## General Conventions

- Use `ubuntu-latest` for all standard jobs; use `ubuntu-24.04-arm` for arm64 image builds.
- Do not use `npx <package>` for CI utilities unless the package is listed in `devDependencies`.
  Prefer shell built-ins, tools pre-installed on runners, or pinned package installs.
- Prefer `actions/upload-artifact@v6` (not the internal `artifact_name` param on third-party
  actions, which may use older versions internally).
- Always add `if: always()` to artifact upload steps so reports are preserved even on failure.
