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
| `zaproxy/action-baseline` | `@v0.15.0` |
| `semgrep` (pip) | `==1.156.0` |

When adding a new action, check the action's GitHub releases page to confirm the latest
major version and use it consistently across all workflow files.

## General Conventions

- Use `ubuntu-latest` for all standard jobs; use `ubuntu-24.04-arm` for arm64 image builds.
- Do not use `npx <package>` for CI utilities unless the package is listed in `devDependencies`.
  Prefer shell built-ins, tools pre-installed on runners, or pinned package installs.
- Always pin `pip install` to an exact version (e.g. `pip install semgrep==1.156.0`) to keep
  workflows reproducible.
- Prefer `actions/upload-artifact@v6` for explicit artifact uploads. For `zaproxy/action-baseline`,
  use the latest action version and its `artifact_name` input rather than layering a second upload
  step on top.
- Always add `if: always()` to artifact upload steps so reports are preserved even on failure.
