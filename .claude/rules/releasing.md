# Releasing

This project uses [release-please](https://github.com/googleapis/release-please) for automated releases. Never manually bump versions, edit changelogs, or create release commits.

## How it works

1. Push conventional commits to `main` (e.g. `fix:`, `feat:`, `perf:`)
2. release-please creates/updates a release PR with version bumps and changelogs for ALL 6 packages (linked-versions keeps them in sync)
3. Merging that PR triggers release-please again, which auto-creates component tags (e.g. `core-v2.3.3`) and GitHub releases
4. The publish job in the same workflow runs automatically when releases are created, publishing all packages to npm

## What to do when releasing

- Just merge the release-please PR. Everything else is automated.
- If release-please hasn't created a PR, check the workflow run logs.

## Key config details

- `include-component-in-tag: true` is REQUIRED for `linked-versions` to work (without it, `getComponent()` returns empty string and the plugin can't match components)
- `group-pull-request-title-pattern` MUST include `${version}` so release-please can parse its own merged PR titles to determine the last released version. Without it, release-please falls back to tag-based lookup and can compute the wrong version. (The original #1456 bug that prevented `${version}` from resolving was fixed in release-please PR #1760.)
- Publishing is chained directly from the release-please workflow via `releases_created` output, not via tag-triggered workflows (GitHub API-created tags don't fire push events)

## Troubleshooting

- **"untagged, merged release PRs outstanding - aborting"**: A merged release PR still has `autorelease: pending` label. Change it to `autorelease: tagged`.
- **Packages not all bumped**: Check that `include-component-in-tag` is `true` in `release-please-config.json`.

## What NOT to do

- Don't manually edit `package.json` versions, `CHANGELOG.md`, or `.release-please-manifest.json`
- Don't manually create release commits or tags
- Don't push version bump commits directly to main

## Commit conventions

- `fix:` -> patch bump
- `feat:` -> minor bump
- `feat!:` or `BREAKING CHANGE:` -> major bump
- `chore:`, `test:`, `ci:`, `build:` -> hidden (no version bump)

## CI on release merges

CI and deploy-examples skip on release commits (prefix `chore`). The publish job in the release-please workflow handles build/typecheck/test verification.
