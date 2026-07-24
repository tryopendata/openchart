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

`playwright.config.ts` at the repo root spawns the Ladle dev server on port 61000, then two specs screenshot the canonical story set: `e2e/visual/stories.spec.ts` (60 desktop entries) and `e2e/visual/stories-mobile.spec.ts` (12 entries at a mobile viewport). Both go through the shared harness in `e2e/visual/capture.ts`. Baselines live in `e2e/visual/__screenshots__/<spec>-snapshots/` and are committed to git.

Before each screenshot the harness disables animations via an injected stylesheet and hides the Ladle dev overlays, then waits for fonts to settle, so timing and layout are deterministic.

## Canvas mark mode stories

The injected stylesheet kills CSS animations. It cannot touch the JS scheduler that drives the canvas entrance, so any baseline-captured story rendering points on canvas must set `animation: false` in its spec, or the screenshot lands mid-entrance at a nondeterministic alpha.

Do NOT reach for `emulateMedia({ reducedMotion: 'reduce' })` instead: `reduced-motion.css` carries rules that would shift the existing baselines.

Interactive-only canvas stories (the year-toggle morph demo) are deliberately left out of the baseline set for the same reason.

## Platform-locked baselines

Baseline PNGs are committed per-platform (`-chromium-darwin.png`, `-chromium-linux.png`, etc.). Font rendering and antialiasing differ across operating systems, so a baseline captured on macOS won't match pixel-for-pixel on Linux. If you're on a platform without committed baselines, run `bun run test:visual:update` to generate your own — they'll land alongside the existing ones rather than replacing them.

## Updating baselines

```bash
bun run test:visual:update
```

Only do this when you've visually confirmed the new output is intentional. Commit the updated `.png` files alongside the source change that caused the diff.

## First-time setup on a new machine

```bash
bun run test:visual:setup   # installs Chromium (~150MB)
```
