# Releasing

Releases are cut manually using `scripts/release.mjs`. All 6 packages are always released together at the same version.

## How to release

```bash
node scripts/release.mjs patch    # 6.13.1 -> 6.13.2
node scripts/release.mjs minor    # 6.13.1 -> 6.14.0
node scripts/release.mjs major    # 6.13.1 -> 7.0.0
node scripts/release.mjs 6.15.0   # explicit version
```

The script:
1. Bumps `version` in all 6 `packages/*/package.json` files
2. Updates `CHANGELOG.md` in each package from conventional commits
3. Commits as `release: openchart vX.Y.Z`
4. Creates per-package git tags (`core-vX.Y.Z`, `engine-vX.Y.Z`, etc.)
5. Pushes the commit and tags to origin

The `core-v*` tag push triggers the Release workflow, which builds, tests, publishes to npm, and creates a GitHub release.

## Dry run

Add `--dry-run` to skip the push step:

```bash
node scripts/release.mjs minor --dry-run
```

## What NOT to do

- Don't edit `package.json` versions by hand
- Don't create release tags manually
- Don't push tags without the release commit

## CI on release commits

CI and deploy-examples skip on release commits (prefix `release:`). The Release workflow handles build/typecheck/test verification before publishing.

## Choosing bump type

- `patch` for bug fixes only
- `minor` for new features (backwards compatible)
- `major` for breaking changes
