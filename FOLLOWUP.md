# Follow-up Refactor Plan (Steps 7-10)

> This is the second half of the v7-prep refactor. Steps 0-6 landed on branch `refactor/v7-cohesion` and ship first. This file tracks Steps 7-10 so they don't get lost.
>
> **Do not start these steps until Steps 0-6 have been in production for at least one release cycle.** The plan's release-gating was deliberate: it lets pixel regressions and consumer-breakage get caught on the low-risk changes before we compound them with high-risk ones.

## How to resume this work

1. Read the original plan file (contains full context, verified findings, risk notes):
   - `/Users/rileyhilliard/.claude/plans/zesty-booping-crown.md`
2. Confirm Steps 0-6 landed and a release went out with them. Check `git log` for commits on `refactor/v7-cohesion` (or wherever they merged to main) and for a `release:` commit afterward.
3. Confirm no fresh bug-fix commits on the subsystems we're about to touch:
   - For Step 9: search `git log --oneline -- packages/vanilla/src/svg-renderer.ts` over the last 2 weeks
   - For Step 10: search `git log --oneline -- packages/engine/src/layout/axes.ts` over the last 2 release cycles. The plan explicitly said "no new axes fixes for ≥2 release cycles" before starting Step 10. Recent axes fix was `a953932` (vertical-overlap-detection, landed 2026-04-06).
4. Create a new branch: `git checkout -b refactor/v7-cohesion-pt2` off main.
5. Ensure Playwright harness is still working — Step 0 set it up under `packages/vanilla/e2e/` (or wherever the Step 0 agent put it). Run it to capture fresh baselines.
6. Execute steps in order. Each step ends with: all tests green, Playwright diff clean, one commit per step.

## Consumer-safety guardrails (critical)

This refactor must not break anyone bumping the library version. Before each step:

- **No public API surface changes.** Run `bun run build` and diff the emitted `.d.ts` files against main. If types changed beyond added helpers, stop.
- **No observable behavior changes.** Playwright screenshot diff must be byte-identical except for ID attributes (gradient/clip-path IDs changed in Step 6).
- **No rendered output drift.** Manual Ladle spot-check: bar (vert + horiz), line multi-series, stacked column, sankey (narrow + long labels), pie with legend, annotated chart, watermarked chart.

## Why these were deferred from the first batch

| Step | Reason deferred |
|------|-----------------|
| 7 (compile.ts pure helpers) | Load-bearing ordering (double legend pass, in-place `computeGridlines` mutation, post-hoc `scales.defaultColor`). Needs conservative helper extraction, not reorganization. Wanted Steps 1-6 (and their characterization tests) green first so the compile snapshot test has a stable oracle. |
| 8 (density filter) | Depends on Step 2 formatter consolidation landing cleanly across bar/column/dot. |
| 9 (svg-renderer.ts split) | 1,392-line file, 11 concerns. Biggest diff of the refactor. HIGH risk. Plan says "do it when codebase is calm" — specifically when axes-fix cadence has cooled. |
| 10 (axes.ts split) | 509-line file received a fix on 2026-04-06 (`a953932`). Plan says wait ≥2 release cycles with no axes fixes before touching. |

---

## Step 7 — Extract pure helpers from compile.ts (preserve ordering)

### Why this is delicate

`packages/engine/src/compile.ts` has three **load-bearing invariants**. Breaking any of them silently regresses layout in ways unit tests may miss:

1. **Double legend pass.** First pass (line ~317) uses `preliminaryArea` to estimate; second pass (line ~343) uses actual `legendArea` after `computeDimensions` returns. This is not accidental — the legend needs dimensions, dimensions need a legend reservation, so we do a cheap estimate then refine.
2. **In-place axes mutation.** `computeGridlines(axes, chartArea)` at line ~420 mutates its first argument. Anything downstream that reads `axes` sees the mutated version.
3. **Post-hoc `scales.defaultColor` assignment.** Line ~408 sets `scales.defaultColor = chartSpec.markDef.fill ?? theme.colors.categorical[0]` **after** `computeScales` returns. Moving this earlier would require threading theme into computeScales, which changes its API.

### What to extract

Only pure computations. Leave the orchestration in compile.ts with comments marking the invariants. Naming suggestion: put helpers in `packages/engine/src/compile/` subfolder so they're colocated but clearly secondary to `compile.ts`.

**Files to create:**

- `packages/engine/src/compile/data-clip.ts`
  - Extract lines ~361-373 (clip-domain data filtering)
  - Pure: `(data, encodings) => filteredData`
  - Add unit test with 2-3 fixtures covering: no clip, x-axis clip, both axes clip

- `packages/engine/src/compile/color-scale-range.ts`
  - Extract lines ~381-404 (theme palette range override)
  - Signature: `(scales, encoding, theme) => void` (still mutates; name and test it in isolation so the mutation is documented)
  - Add unit test covering: no encoding color, explicit palette, theme fallback

- `packages/engine/src/compile/watermark-obstacle.ts`
  - Extract lines ~446-458
  - Pure: `(dims, chrome, axes, theme) => Rect | null`
  - Add unit test covering: no watermark, watermark above axes, watermark overlapping chrome

**Files to modify:**

- `packages/engine/src/compile.ts` — replace inline blocks with helper calls. Line numbers ~317, ~343, ~408, ~420 stay exactly as is. Add a comment block above the orchestration that reads:

```ts
// ORCHESTRATION INVARIANTS — do not reorder without care:
// 1. Legend is computed twice (preliminary + refined) to break a dims/legend dependency cycle.
// 2. computeGridlines mutates `axes` in place.
// 3. scales.defaultColor is set post-computeScales because the resolution needs theme context.
```

### What NOT to extract

- The legend-reservation logic (~310-343). The double-pass dance is the whole point.
- Anything that crosses the three invariants above.

### Verification

- Add an integration test: `packages/engine/src/__tests__/compile-snapshot.test.ts` that compiles 3 representative specs and snapshots the full `ChartLayout`. Pre-refactor snapshot (captured on main before this step) must equal post-refactor snapshot exactly.
- Full Ladle visual check: legend-heavy chart, clipped-domain chart, single-series colored chart, watermarked chart.
- Playwright diff on the same 4 scenarios.

### Revert strategy

Each helper is independent — any one can be reverted alone. The full step revert is trivial since compile.ts retains its exact ordering.

**Risk:** MEDIUM. Mitigation: integration snapshot test is the backstop.

---

## Step 8 — Extract density filter from bar/column/dot/line/pie labels

### What

The density branch is byte-identical across 5 label modules:

```ts
if (density === 'none') return [];
if (density === 'endpoints') {
  return [marks[0], marks[marks.length - 1]].filter(Boolean);
}
```

That's ~5 lines × 5 files = ~25 lines of duplication, pure geometry.

### Files

**New:**
- `packages/engine/src/charts/_shared/density-filter.ts` (~15 lines)
  - Export `filterByDensity<T>(marks: T[], density: LabelDensity): T[]`
  - Handles 'none', 'endpoints', 'all', 'auto' (auto returns marks unchanged — density resolution happens upstream)

**Modify:**
- `packages/engine/src/charts/bar/labels.ts` — replace density branch with call
- `packages/engine/src/charts/column/labels.ts` — same
- `packages/engine/src/charts/dot/labels.ts` — same
- `packages/engine/src/charts/line/labels.ts` — same
- `packages/engine/src/charts/pie/labels.ts` — same

### What NOT to extract

- Value extraction (differs: bar uses `parseDisplayNumber`, others don't)
- Aria-label parsing (differs per chart)
- Collision resolution invocation (differs)
- LABEL_FONT_SIZE (11 in bar/dot, 10 in column)

### Verification

- Existing per-chart label tests (`labels.test.ts` in each chart dir) cover this — they should all pass unchanged.
- Ladle: label-heavy stories at all four density settings for each chart type.

### Risk

LOW. Narrow scope, well-tested surface.

---

## Step 9 — Split svg-renderer.ts into per-concern modules

### Why this is the biggest diff

`packages/vanilla/src/svg-renderer.ts` is 1,392 lines holding 11 distinct concerns:

1. SVG root + viewBox setup
2. Chrome (title, subtitle, source, byline)
3. Axes rendering (ticks, labels, gridlines)
4. Marks dispatch (bar, line, area, arc, point)
5. Annotation rendering
6. Legend rendering
7. Text wrap utility (already extracted in Step 3 — can cross-reference)
8. Clip-path generation
9. Brand/watermark overlay
10. Interactive zones (hit areas, focus rings)
11. Animation class wiring

### Target structure

```
packages/vanilla/src/renderers/
├── chrome.ts       — renderChrome(root, layout, theme)
├── axes.ts         — renderAxes(root, layout, theme)
├── marks.ts        — renderMarks(root, layout, theme)  (dispatches to sub-renderers by mark type)
├── annotations.ts  — renderAnnotations(root, layout, theme)
├── legend.ts       — renderLegend(root, layout, theme)
├── brand.ts        — renderBrand(root, layout, theme)
└── svg-dom.ts      — shared element helpers (createSvgElement, setAttrs, etc.)

packages/vanilla/src/svg-renderer.ts  (shrinks to ~200 lines of orchestration)
```

### Execution plan

**This should be 7 separate PRs, not one.** The plan explicitly says so. Each PR:
1. Extracts one concern into its own file
2. svg-renderer.ts imports from the new file
3. Full test suite + Playwright diff must pass
4. Merge, wait for at least one day of CI stability, proceed

**Suggested order** (least entangled first):
1. `svg-dom.ts` (helpers) — no consumers, just utility
2. `brand.ts` (self-contained watermark overlay)
3. `chrome.ts` (reads layout, writes DOM; well-scoped)
4. `legend.ts` (complex but well-bounded)
5. `annotations.ts`
6. `axes.ts` (most intricate — gridlines/ticks interplay with layout)
7. `marks.ts` (biggest — dispatches across mark types)

### Verification (per extraction)

- `bun run test` all packages green
- `bun run typecheck` green
- `bun run lint` green
- `bun run build` successful
- Playwright screenshot diff across fixed representative set:
  - bar (vertical)
  - bar (horizontal + gradient)
  - line (multi-series)
  - stacked column
  - sankey (narrow width + long labels)
  - pie with legend
  - annotated chart
  - watermarked chart
- Byte-identical except for ID attributes

### What NOT to do

- Do not attempt this in one giant PR. Plan says: "one PR per extracted file, not one giant PR."
- Do not change any rendering logic. Pure mechanical extraction only.
- Do not reorganize the mount.ts / sankey-mount.ts callsites. They call `render(svg, layout)` — keep that API.

### Risk

HIGH. Mitigation: per-file PRs with Playwright diff, and one week of CI stability after each before proceeding.

---

## Step 10 — Extract axes.ts into ticks + thinning modules

### Why deferred

`packages/engine/src/layout/axes.ts` is 509 lines and received a fix on 2026-04-06 (`a953932 fix(engine): use vertical overlap detection for y-axis tick thinning`). Refactoring during active bug-fix cadence risks:
- Merge conflicts with incoming fixes
- Confused bug attribution ("was this regression mine or the refactor's?")

**Do not start Step 10 until 2 release cycles pass with no axes fixes.** Check: `git log --oneline --since="6 weeks ago" -- packages/engine/src/layout/axes.ts` — if non-release commits exist, wait longer.

### Target structure

```
packages/engine/src/layout/axes/
├── ticks.ts        — tick generation from scale
├── thinning.ts     — overlap detection + density thinning
└── index.ts        — re-exports

packages/engine/src/layout/axes.ts  (orchestration only, ~200 lines)
```

### Files

- `packages/engine/src/layout/axes/ticks.ts` (new):
  - Export `generateTicks(scale, axisConfig, dims) => Tick[]`
  - Pure: takes scale + config, returns tick positions + labels + formatters

- `packages/engine/src/layout/axes/thinning.ts` (new):
  - Export `thinOverlappingTicks(ticks, axis, measureText) => Tick[]`
  - The fix from `a953932` lives here — vertical overlap detection for y-axis

- `packages/engine/src/layout/axes.ts` (modified):
  - Orchestrates: generate → thin → place → format
  - ~200 lines

### Verification

**Pre-refactor test audit required.** The existing `packages/engine/src/layout/__tests__/axes.test.ts` may reach into axes.ts internals. Before splitting:

1. Audit every test in `axes.test.ts` — does it call the public `computeAxes` API, or does it reach into helpers?
2. If any test imports internals, refactor the test to use `computeAxes` first. Commit that refactor.
3. Only then proceed with the file split.

Post-refactor:
- `bun run test` all packages green (especially `axes.test.ts`)
- Playwright diff on: bar with dense y-axis, column with log scale, line with time axis, mixed-density x-axis
- The `a953932` fix scenario: tall chart with many y-axis labels where vertical overlap was the original bug — must still thin correctly

### Risk

MEDIUM-HIGH. Mitigation: test audit first, then split, then visual diff.

---

## Critical files (reference)

- `packages/engine/src/compile.ts` — load-bearing ordering, see Step 7 invariants
- `packages/engine/src/layout/axes.ts` — see Step 10 notes
- `packages/vanilla/src/svg-renderer.ts` — see Step 9 extraction order
- `packages/engine/src/charts/{bar,column,dot,line,pie}/labels.ts` — Step 8 touches all five

## Things explicitly deferred / not doing (do not reopen)

These were evaluated and rejected in the original plan. Don't revisit them as part of this follow-up:

- O(n²) annotation collision resolver (`annotations/collisions.ts`) — n<20 typical, complexity cost isn't worth it
- Single-pass label re-insertion in bar/labels.ts — already O(n), readable
- Merging line/pie into the shared label helper — different semantics (series name vs. category vs. value). Forcing them together produces an unprincipled switch
- Memoizing compile() output — no measured perf problem
- Breaking mount.ts into smaller files — most of that file is interaction wiring (keyboard, selection, text edit, tooltip), each already a separately-imported module. Splitting the orchestrator just moves code around
- Relocating watermark-obstacle logic to a "brand" module — the intersection with chrome/axes/theme is intrinsic, not accidental

## Done criteria

- All 4 steps (7, 8, 9, 10) landed on main
- Zero public API surface changes (verified by diffing emitted .d.ts files)
- Zero Playwright screenshot diffs (except gradient/clip-path IDs from Step 6)
- All 1,800+ tests green
- One release cut with all changes (`release: openchart vX.Y.Z`)
- Delete this FOLLOWUP.md file after the release lands
