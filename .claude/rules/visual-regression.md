# Visual Regression Testing

Playwright screenshot diff is the pixel-level safety net for refactors that must not change rendered output. It complements the visual-verification rule (which is for actively iterating on chart design).

## When to run

Run `bun run test:visual` when:

- Refactoring engine, vanilla, or react source code where you want zero visible change
- Changing shared CSS in `packages/core/src/styles/`
- Before opening a PR that touches rendering code
- After merging main into a refactor branch, to confirm no drift snuck in

Don't rely on it for:

- New chart features (the baseline won't exist yet — regenerate with `test:visual:update`)
- Deliberate design changes (update baselines after visually verifying the new output is correct)

## How it works

`playwright.config.ts` at the repo root spawns the Ladle dev server on port 61000, then `e2e/visual/stories.spec.ts` screenshots 8 canonical stories. Baselines live in `e2e/visual/__screenshots__/` and are committed to git.

Before each screenshot, the spec strips generated SVG IDs (gradient/clipPath) since those change per mount. Animations are disabled via an injected stylesheet so timing is deterministic.

## Updating baselines

```bash
bun run test:visual:update
```

Only do this when you've visually confirmed the new output is intentional. Commit the updated `.png` files alongside the source change that caused the diff.

## First-time setup on a new machine

```bash
bun run test:visual:setup   # installs Chromium (~150MB)
```
