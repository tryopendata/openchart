# Releasing

This project uses [release-please](https://github.com/googleapis/release-please) for automated releases. Never manually bump versions, edit changelogs, or create release commits.

## How it works

1. Push conventional commits to `main` (e.g. `fix:`, `feat:`, `perf:`)
2. release-please automatically creates/updates a release PR with version bumps and changelogs
3. Merging that PR triggers release-please again, which creates a git tag and GitHub release
4. The `publish.yml` workflow triggers on the tag and publishes all packages to npm

## What to do when releasing

- Just merge the release-please PR. That's it.
- If release-please hasn't created a PR, check the workflow run logs for errors.

## Troubleshooting

- **"untagged, merged release PRs outstanding - aborting"**: A merged release PR still has the `autorelease: pending` label. Change it to `autorelease: tagged` on the stuck PR.
- **PR title missing version**: The `group-pull-request-title-pattern` in `release-please-config.json` must NOT use `${version}` - it's a known bug (#1456) where version can't resolve for linked-versions groups. The current config uses a static title pattern instead.
- **Packages not all bumped**: The `linked-versions` plugin should sync all 6 packages. If some are skipped, check that the plugin's `preconfigure` step ran (look for "Replacing strategy for path" in logs).

## What NOT to do

- Don't manually edit `package.json` versions, `CHANGELOG.md`, or `.release-please-manifest.json`
- Don't manually create release commits or tags
- Don't push version bump commits directly to main
- Don't use `${version}` in `group-pull-request-title-pattern` (known bug with linked-versions)

## Commit conventions matter

release-please only bumps versions for commits with recognized prefixes:
- `fix:` -> patch bump
- `feat:` -> minor bump
- `feat!:` or `BREAKING CHANGE:` -> major bump
- `chore:`, `test:`, `ci:`, `build:` -> hidden (no version bump on their own)

If a commit uses `chore:` when it should be `fix:`, release-please won't include it in the release.

## CI behavior on release merges

CI and deploy-examples skip on release commits (prefix `chore: release`). The publish workflow already runs build/typecheck/test. Release-please still runs to create tags and GitHub releases.
