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
4. Creates per-package git tags via GitHub API (`core-vX.Y.Z`, `engine-vX.Y.Z`, etc.) so they get verified signatures
5. Pushes the commit to origin

Tags are created **before** the push on purpose. The push is what triggers the
Release workflow, and its final step (`gh release create --verify-tag`) needs the
tags to already exist. Tagging afterwards races that step, which is how v8.0.0
ended up publishing to npm and then failing the workflow.

The `release:` commit prefix triggers the Release workflow, which builds, tests, publishes to npm, and creates a GitHub release.

## Prerelease versions

Any version containing a `-` (e.g. `8.1.0-rc.1`) publishes under the npm `next`
dist-tag instead of `latest`, so a bare `npm install` never picks up a release
candidate. Install them explicitly:

```bash
npm install @opendata-ai/openchart-react@next
```

## Dry run

Add `--dry-run` to preview the release without touching anything:

```bash
node scripts/release.mjs minor --dry-run
```

It prints the version bump and the generated changelog entry, then stops. No
files are written, no commit is created, nothing is tagged or pushed. Your
working tree is unchanged.

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
