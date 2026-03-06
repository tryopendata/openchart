# Releasing

This project uses [release-please](https://github.com/googleapis/release-please) for automated releases. Never manually bump versions, edit changelogs, or create release commits.

## How it works

1. Push conventional commits to `main` (e.g. `fix:`, `feat:`, `perf:`)
2. release-please automatically creates/updates a release PR with version bumps and changelogs
3. Merging that PR creates a git tag (`v*.*.*`)
4. The `publish.yml` workflow triggers on that tag and publishes all packages to npm

## What to do when releasing

- Just merge the release-please PR. That's it.
- If release-please hasn't created a PR yet, check the workflow run logs for errors.
- Common issue: `autorelease: pending` label stuck on an old PR. Fix by changing it to `autorelease: tagged`.

## What NOT to do

- Don't manually edit `package.json` versions, `CHANGELOG.md`, or `.release-please-manifest.json`
- Don't manually create release commits or tags
- Don't push version bump commits directly to main

## Commit conventions matter

release-please only bumps versions for commits with recognized prefixes:
- `fix:` → patch bump
- `feat:` → minor bump
- `feat!:` or `BREAKING CHANGE:` → major bump
- `chore:`, `test:`, `ci:`, `build:` → hidden (no version bump on their own)

If a commit uses `chore:` when it should be `fix:`, release-please won't include it in the release.
