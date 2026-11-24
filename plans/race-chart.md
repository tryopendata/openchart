# Plan: Race charts

Skill: deliver. Profile: deliver. On resume, re-read shared/lane-dag.md before anything else.
plan_graph: /Users/riley/.claude/plugins/cache/claude-essentials/ce/6.0.0/shared/scripts/plan_graph.py
Started: 2026-11-24. Timebox: none. Landing branch: deliver/race-chart.
Gate: `bun run build && bun run typecheck && bun run lint && bun run check:generated && bun run test` (50s). Filtered tests: `bun x vitest run <path>`. Typecheck: `bun run build && bun run typecheck`.
Runner: plain commands. All code, scaffolds included, is written by Codex delegates through foreman (`foreman start <name> --new-worktree --from <base> --setup "bun install --frozen-lockfile" --write --model gpt-6.2-sol`), at the user's request. The orchestrator writes contracts, reviews diffs, runs the gate and merges.
Worktree setup: `bun install --frozen-lockfile`.
Suppressions: biome-ignore, @ts-expect-error, @ts-ignore, .skip(, .only(
Manifests: bun.lock

Design and research: [rfc-race-chart.md](rfc-race-chart.md). Mock: https://claude.ai/artifact/5HZ1vgcfyxkedjXDUDut4F

## Spec

A new top-level spec type, `type: "race"`, plays a ranked top-N leaderboard over a time field for a fixed duration, as a bar, line or table. The mark is one field; changing it keeps everything else. Newsroom developers embed it, social teams export it, agents write it.

In scope:
- `RaceSpec` as RFC section 3, minus the cuts below. Defaults: `top` 10, `duration` = periods × 700ms clamped to 8000–90000, `swap` 400, `rescale` "frame", `gaps` "interpolate", `holdEnd` 1500, `loop` false, `autoplay` "visible", `controls` true, `period` on, `summary` false.
- Rank model of RFC 5.2: 24 samples per period, ties by previous sample's rank then key order, sentinel rank `top`, triangle smoothing of width `swap`.
- Nested-ladder crossfade ticks of RFC 5.4.
- Bar, line (`window: "reveal" | "all"`) and table marks. Bars start at a zero baseline; negative values draw leftward from it (domain `[min(0, visible min), visible max]`).
- Playback clock, controls (play/pause, scrubber, readout, Space and arrow keys), `autoplay: "visible"` via `whenSeen`, reduced motion opening on the final frame with no autoplay.
- Runtime `RaceInstance` API of RFC 7, including `update()` that keeps the playhead across a mark swap.
- Accessible name and description, visually hidden per-period table, polite announcements on pause, seek and step only.
- React, Vue and Svelte `Race` wrappers and `Visualization` dispatch; GIF export by frame-stepping; JSON schema, `llms.txt`, docs page, gallery page, visual baselines at fixed `t`.

Out of scope: MP4 export, per-bar images, log scale, sliding line window, vertical column races, timed captions, `transform` on race specs (validation rejects it with a pre-aggregate message), tooltips and `description` encoding on race items, hover interaction, edit mode, static (server) rendering of races (`renderStatic` throws a clear error for race specs).

Assumptions (user accepted the RFC's recommendations, 2026-11-24): dedicated `type: "race"`; 700ms per period and 400ms swap; line `window` defaults to `reveal`; GIF only.

Error model:
- Spec shape problems are `ValidationError`s from `validateRaceSpec` (same shape and reporting path as other types); `prepareRace` throws the same aggregated validation error as every other compile.
- Data problems found after normalization throw `RaceDataError` (`packages/engine/src/race/errors.ts`) with `code: 'DUPLICATE_KEY_PERIOD' | 'TOO_FEW_PERIODS' | 'NO_VALUES'` and a message naming the key, period, row count and fix. Callers see it unwrapped; nothing catches and defaults.
- Warnings go through `options.onWarn`: non-finite values dropped (one warning with the count), more than 500 keys (rank precompute cost), `top` larger than the key count (clamped), `controls: false` with autoplay on (WCAG 2.2.2).
- Runtime: `seek(t)` clamps to `[0, periodCount - 1]`; non-finite `t` throws `RangeError`. Calls after `destroy()` are no-ops. `update(spec)` prepares the new spec first and throws without touching the mounted race when it fails.
- `renderStatic` and the framework `Visualization` dispatch throw `Error('Race specs render through createRace')` until phase 5 wires the wrappers (unreleased branch states only).

## Contracts (scaffold commit)

The engine splits a race into a size-independent model (data, rank cache, colors, labels; rebuilt only when the spec changes) and a size-dependent layout (plain data, rebuilt on resize, theme, font load and mark swap). Frames and geometry are pure functions of `(model, layout, t)`. Marks plug into a registry on both sides so a new mark adds files without editing the pipeline.

Layout:

    packages/core/src/types/spec.ts          + RaceSpec, RaceEncoding, RaceConfig, RaceMarkType, RaceMarkDef (+ per-mark defs), RaceTableColumn, RaceSpecWithoutData, isRaceSpec; VizSpec and StoredVizSpec gain the race members; isChartSpec excludes type: 'race'
    packages/core/src/types/race.ts          RaceFrame, RaceItem, RaceTick, RacePlayback, per-mark Static and Geometry types, RaceLayout (plain data); shared by engine and vanilla
    packages/core/src/styles/race.css        player and table-row styles

    packages/engine/src/race/types.ts        NormalizedRaceSpec, ResolvedRaceOptions, RaceMatrix, RaceTimelineOptions, RaceSample, RaceSampleItem, RaceTimeline, RaceModel
    packages/engine/src/race/errors.ts       RaceDataError
    packages/engine/src/race/normalize.ts    normalizeRaceSpec: fills defaults; pure
    packages/engine/src/race/matrix.ts       buildRaceMatrix: rows -> dense key x period matrix, period ordering, gap policy; pure
    packages/engine/src/race/rank-smoothing.ts  sampleRanks, smoothRanks: exact sampled ranks and triangle filter; pure arrays
    packages/engine/src/race/timeline.ts     createRaceTimeline: valueAt, rankPos, exactRank, sample(t); owns the rank cache
    packages/engine/src/race/period-labels.ts formatPeriodLabels: period values -> display strings; pure
    packages/engine/src/race/colors.ts       assignRaceColors: stable per-key colors; pure
    packages/engine/src/race/frame.ts        buildRaceFrame: RaceSample + presentation -> RaceFrame; pure
    packages/engine/src/race/ticks.ts        valueTickLadder, periodTickLadder, crossfadeTicks; pure
    packages/engine/src/race/layout-bar.ts   computeBarStatic, barGeometry; pure
    packages/engine/src/race/prepare.ts      prepareRace: validate, normalize, matrix, timeline, colors, labels, formatter -> RaceModel (phase 2)
    packages/engine/src/race/layout.ts       layoutRace: theme, chrome, size, mark static via registry, a11y -> RaceLayout (phase 2)
    packages/engine/src/race/geometry.ts     raceFrameAt, raceGeometryAt: dispatch through the registry (phase 2)
    packages/engine/src/race/marks.ts        RACE_MARKS registry: mark -> { computeStatic(model, base, mark, measureText), geometry } (phase 2 registers bar; phase 4 scaffold adds line, table)
    packages/engine/src/race/layout-line.ts  line static + geometry (phase 4)
    packages/engine/src/race/layout-table.ts table static + geometry (phase 4)
    packages/engine/src/race/a11y.ts         raceA11y: accessible name, description, per-period rows (phase 4; phase 2 scaffold stub returns title-only metadata)
    packages/engine/src/compiler/validation/race.ts  validateRaceSpec

    packages/vanilla/src/race/clock.ts       createRaceClock: playhead, speed, loop, hold; rAF injected
    packages/vanilla/src/race/controls.ts    createRaceControls: play button, scrubber, readout, keyboard
    packages/vanilla/src/race/render-bar.ts  createRaceBarRenderer: keyed SVG writes for RaceBarGeometry
    packages/vanilla/src/race/shell.ts       createRaceShell: root element, SVG with chrome, brand/watermark, theme tokens, dark class, mark host, controls slot (phase 2)
    packages/vanilla/src/race/renderers.ts   RACE_RENDERERS registry: mark -> renderer factory (phase 2 registers bar; phase 4 scaffold adds line, table)
    packages/vanilla/src/race-mount.ts       createRace: lifecycle wiring only (phase 3)
    packages/vanilla/src/race/render-line.ts, render-table.ts, a11y-dom.ts (phase 4); race/export.ts (phase 5)

Registration (scaffold only, no lane edits):
- `core/src/types/index.ts` exports; `core/src/styles/index.css` imports `race.css`; `isChartSpec` gains `&& (spec as Record<string, unknown>).type !== 'race'`.
- `engine/src/compiler/validate.ts`: `isRace` joins the type list so `isChart`/`isLayer` exclude it, dispatch to `validateRaceSpec`, and `collectMarkOptionErrors` skips race specs.
- `engine/src/compile/spec-sugar.ts`: `expandSpecSugar` returns race specs unchanged before `assertMarkOptions` (race marks carry `window`/`columns`, which chart mark options reject).
- `engine/src/compiler/normalize.ts`: race dispatch runs before the `isChartSpec` branch; `engine/src/compiler/types.ts` union.
- `engine/src/compile.ts` + `engine/src/index.ts`: export `prepareRace`, `layoutRace`, `raceFrameAt`, `raceGeometryAt`, `RaceDataError`, `RaceModel`.
- `vanilla/src/index.ts`: export `createRace`, `RaceInstance`, `RaceMountOptions`; `vanilla/src/static-render.ts`: race branch throws the error-model message.
- `react|vue|svelte` `Visualization.*`: race branch throws the error-model message.
- `packages/core/schema/*.json` regenerated (`bun run generate:schema`), so `check:generated` stays green from the scaffold on.
- `examples/src/data/world-gdp-race.ts`: long-format rows `{ country, year, gdp }` (GDP in billions of current US$) for the 20 economies in the mock, 1980–2024, Russia from 1988, `source: 'Source: World Bank, GDP (current US$)'`; exported from the data barrel.
- `scripts/race-frames.ts`: prints the top 5 at t = 0, 8.5 and the last period for that dataset, using `buildRaceMatrix`, `createRaceTimeline`, `formatPeriodLabels` (phase 1 demo).

Signatures (scaffold stubs throw `new Error('not implemented')` unless marked inert):

```ts
// engine/src/race/types.ts
export interface ResolvedRaceOptions {
  top: number; duration?: number; step?: number; swap: number;
  rescale: 'frame' | 'fixed' | { min: number }; gaps: 'interpolate' | 'hold' | 'drop';
  holdEnd: number; loop: boolean; autoplay: 'visible' | boolean; controls: boolean;
  period: false | { format?: string }; summary: 'sum' | false;
}
export interface RaceMatrix {
  periods: Array<{ value: string | number; sortKey: number }>; // sorted ascending; Dates become ISO strings
  keys: string[];          // sorted by String localeCompare 'en'; index order is the final tie-break
  labels: string[];        // display name per key: last non-null label-channel value, else the key
  colorValues: Array<string | null>; // color field value per key (last non-null); null when color is not a field
  values: Float64Array[];  // per key, length = periods.length, NaN = absent
}
export interface RaceTimelineOptions {
  top: number; swapPeriods: number; samplesPerPeriod: number;
  rescale: ResolvedRaceOptions['rescale'];
}
export interface RaceSampleItem { keyIndex: number; value: number; rank: number; rankPos: number; opacity: number; change: number }
export interface RaceSample { t: number; periodIndex: number; items: RaceSampleItem[]; domainMin: number; domainMax: number }
export interface RaceTimeline {
  readonly periodCount: number; readonly keyCount: number; readonly top: number;
  valueAt(keyIndex: number, t: number): number;   // NaN when absent
  rankPos(keyIndex: number, t: number): number;   // smoothed, in [0, top]
  exactRank(keyIndex: number, t: number): number; // 0-based among present keys; Infinity when absent
  sample(t: number): RaceSample;                  // items with rankPos < top, sorted by rankPos
}
export interface RaceModel {
  spec: NormalizedRaceSpec; matrix: RaceMatrix; timeline: RaceTimeline;
  colorSlots: Array<number | string>; periodLabels: string[]; formatValue: (value: number) => string;
  playback: RacePlayback; warnings: string[];
}

// engine/src/race/matrix.ts
/** @throws {RaceDataError} DUPLICATE_KEY_PERIOD, TOO_FEW_PERIODS, NO_VALUES */
export function buildRaceMatrix(rows: DataRow[], encoding: RaceEncoding, gaps: ResolvedRaceOptions['gaps'], warn: (message: string) => void): RaceMatrix;
// engine/src/race/rank-smoothing.ts
export function sampleRanks(values: Float64Array[], periodCount: number, samplesPerPeriod: number, top: number): Float32Array[]; // key index order is the tie-break
export function smoothRanks(raw: Float32Array, halfWidthSamples: number): Float32Array;
// engine/src/race/timeline.ts
export function createRaceTimeline(matrix: RaceMatrix, options: RaceTimelineOptions): RaceTimeline;
// engine/src/race/period-labels.ts
export function formatPeriodLabels(periods: RaceMatrix['periods'], time: EncodingChannel): string[];
// engine/src/race/colors.ts
export function assignRaceColors(matrix: RaceMatrix, timeline: RaceTimeline, colorEncoding: RaceEncoding['color'], keyField: string): Array<number | string>; // palette index or constant
export function resolveRaceColors(slots: Array<number | string>, palette: readonly string[]): string[];
// engine/src/race/frame.ts
export interface RacePresentation { keys: string[]; labels: string[]; colors: string[]; formatValue: (value: number) => string; periods: RaceMatrix['periods']; periodLabels: string[]; summary: boolean; top: number }
export function buildRaceFrame(sample: RaceSample, presentation: RacePresentation): RaceFrame;
// engine/src/race/ticks.ts
export function valueTickLadder(span: number): number[];   // nested: each step divides the next
export function periodTickLadder(): number[];              // [1, 5, 10, 50, 100, 500]
export function crossfadeTicks(domain: [number, number], pxPerUnit: number, ladder: number[], room?: number, fadeFrom?: number): Array<{ value: number; opacity: number }>;
// engine/src/race/layout-bar.ts
export interface BarStaticInput { area: Rect; top: number; maxLabelWidth: number; maxValueLabelWidth: number; fontSize: { name: number; value: number; tick: number }; showPeriod: boolean; showSummary: boolean; hasNegatives: boolean }
export function computeBarStatic(input: BarStaticInput): RaceBarStatic;
export function barGeometry(stat: RaceBarStatic, frame: RaceFrame, formatTick: (value: number) => string): RaceBarGeometry;
// engine/src/race/normalize.ts
export function normalizeRaceSpec(spec: RaceSpec, warnings: string[]): NormalizedRaceSpec;
// engine/src/compiler/validation/race.ts
export function validateRaceSpec(spec: Record<string, unknown>, errors: ValidationError[]): void;
// engine (phase 2)
/** @throws validation error; @throws {RaceDataError} */
export function prepareRace(spec: unknown, options: { onWarn?: (w: CompileWarning) => void }): RaceModel;
export function layoutRace(model: RaceModel, options: CompileOptions & { mark?: RaceMarkDef }): RaceLayout; // mark overrides the spec's (runtime swap)
export function raceFrameAt(model: RaceModel, t: number): RaceFrame;
export function raceGeometryAt(model: RaceModel, layout: RaceLayout, t: number): RaceGeometry;

// vanilla/src/race/clock.ts
export interface RaceFrameScheduler { request(cb: (now: number) => void): number; cancel(id: number): void }
export interface RaceClockState { t: number; playing: boolean; speed: number; ended: boolean }
export interface RaceClockOptions {
  periodCount: number; durationMs: number; holdEndMs: number; loop: boolean;
  onTick: (t: number) => void; onStateChange?: (state: RaceClockState) => void;
  scheduler?: RaceFrameScheduler; // defaults to requestAnimationFrame / cancelAnimationFrame
}
export interface RaceClock {
  play(): void; pause(): void; toggle(): void;
  seek(t: number): void;            // @throws {RangeError} non-finite t
  stepPeriod(delta: 1 | -1): void;
  setSpeed(speed: number): void;    // @throws {RangeError} speed <= 0 or non-finite
  getState(): RaceClockState; destroy(): void;
}
export function createRaceClock(options: RaceClockOptions): RaceClock;
// vanilla/src/race/controls.ts
export interface RaceControlsOptions { periodLabels: string[]; onToggle(): void; onSeek(t: number): void; onStep(delta: 1 | -1): void }
export interface RaceControls { readonly element: HTMLElement; update(state: RaceClockState): void; destroy(): void }
export function createRaceControls(options: RaceControlsOptions): RaceControls;
// vanilla/src/race/render-bar.ts
export interface RaceBarRenderer { draw(geometry: RaceBarGeometry): void; destroy(): void }
export function createRaceBarRenderer(host: SVGGElement, stat: RaceBarStatic, idScope: string): RaceBarRenderer;
```

`core/src/types/race.ts` (scaffold writes these in full; line and table types are declared now from RFC 5.5 so phase 4 adds no shared-type edits):

```ts
export interface RaceItem { key: string; label: string; color: string; value: number; valueLabel: string; rank: number; rankPos: number; opacity: number; change: number }
export interface RaceFrame { t: number; period: { index: number; value: string | number; label: string }; items: RaceItem[]; domain: [number, number]; summary?: { value: number; label: string } }
export interface RaceTick { value: number; label: string; opacity: number; position: number }
export interface RacePlayback { durationMs: number; holdEndMs: number; loop: boolean; autoplay: 'visible' | boolean; controls: boolean }
export interface RaceBarStatic { plot: Rect; clip: Rect; nameX: number; rowHeight: number; barHeight: number; top: number; axisY: number; period: { x: number; y: number; fontSize: number } | null; summary: { x: number; y: number } | null }
export interface RaceBarRow { key: string; color: string; opacity: number; bar: Rect; name: { x: number; y: number; text: string }; value: { x: number; y: number; text: string } }
export interface RaceBarGeometry { mark: 'bar'; rows: RaceBarRow[]; ticks: RaceTick[]; period: { x: number; y: number; fontSize: number; text: string } | null; summary: { x: number; y: number; text: string } | null }
export type RaceGeometry = RaceBarGeometry | RaceLineGeometry | RaceTableGeometry;
interface RaceLayoutBase {
  width: number; height: number; chrome: ResolvedChrome; theme: ResolvedTheme; a11y: A11yMetadata;
  watermark: boolean; periods: string[]; playback: RacePlayback; warnings?: CompileWarning[];
  /** Per-key colors for the active theme, and per-key display labels (truncated to fit). */
  colors: string[]; labels: string[];
  /** Area below chrome where the mark draws. */
  area: Rect;
}
export type RaceLayout =
  | (RaceLayoutBase & { mark: 'bar'; static: RaceBarStatic })
  | (RaceLayoutBase & { mark: 'line'; static: RaceLineStatic })
  | (RaceLayoutBase & { mark: 'table'; static: RaceTableStatic });
```

## Phases

### Phase 1: race core (engine model, bar geometry, player pieces)

Scaffold: 9756b43b
Tag: race-chart-phase-1

Demo: `bun x vitest run packages/engine/src/race packages/engine/src/compiler/validation packages/vanilla/src/race` passes, and `bun scripts/race-frames.ts` prints sensible top-5 rankings for 1980, mid-1988 and 2024.
Test cases (each lane's brief lists its own; summary):
- matrix: long rows pivot; periods sorted for temporal (years, ISO dates, Date), ordinal (first-seen or `sort` array), quantitative; duplicate (key, period) throws DUPLICATE_KEY_PERIOD with the real row count (3 colliding rows say "3 rows"); one period throws TOO_FEW_PERIODS; all values null throws NO_VALUES; non-finite values dropped with one warning; more than 500 keys warns once; gaps interpolate/hold/drop on interior gaps only; leading and trailing absence stays NaN; label channel takes last non-null; numeric keys stringified.
- rank smoothing: sentinel clamp to `top`; ties by previous rank then key order (no flip-flop over 100 samples of equal values); smoothed series starts and ends exactly at raw values; one crossing gives a monotone ramp centred on the crossing sample; two crossings inside one window never reach the other row's slot; halfWidth 0 returns the input.
- timeline: valueAt lerps; a key present only from period 3 is absent before and present at exactly t = 3; a key present at period 0 is visible at t = 0 with rankPos equal to its exact rank; `top` larger than the key count works (all keys visible, none below the fold); a single key works; sample(t) is deterministic (same t twice, and after visiting other t, deep-equal); items sorted by rankPos and only rankPos < top; opacity = clamp(top - rankPos); change compares integer periods; domainMax for frame, fixed and {min}; domainMin = min(0, smallest visible value); negative values rank below positives; t clamped at both ends; 200 keys × 100 periods builds in under 250ms.
- period labels: integer years in temporal fields print as "1995" (never through a millisecond time format); ISO dates use the channel `format` (d3-time-format) or an automatic year/month/day granularity; ordinal and quantitative values print with the channel format or `String`.
- colors: by key in order of first appearance in the top N; color field equal to the key field behaves like no color; a category field shares one color per category; `{ value }` constant; more keys than palette cycles.
- frame: formats values; period carries index, value and label; summary sums values of items with rank < top; label and color per key.
- ticks: ladder nests (every step divides the next); active step is the first with room; finer step fades in proportionally; no tick outside the domain; opacity ≤ 0.01 omitted; opacities change by less than 0.1 between domains 1% apart; negative domains get ticks below zero.
- bar layout: row y = plot.y + rankPos × rowHeight + inset; bar from the zero baseline to the value (negative goes left); name right-aligned at nameX; value label just past the bar end on the outer side; period label and summary only when enabled; tick positions match the scale; narrow widths (< 520) still fit the gutter.
- validation: missing data array; missing time/key/value or field; value not quantitative; mark not bar/line/table; both duration and step; top not an integer ≥ 1; non-positive duration/step; negative swap/holdEnd; bad rescale; bad gaps; transform present; unknown `race` field with did-you-mean.
- normalize: defaults filled; string mark expands to `{ type }`; `animation: false` sets autoplay false; `controls: false` with autoplay on adds a warning.
- clock: advances t at (periodCount-1)/durationMs per ms at speed 1 and 2; holds holdEndMs at the end then stops with ended, or loops to 0; play after ended restarts from 0; seek clamps and fires onTick; seek(NaN) throws RangeError; stepPeriod snaps to the next or previous whole period and pauses; pause leaves no pending frame; destroy cancels; setSpeed(0) throws.
- controls: play button label follows state; scrubber value and aria-valuetext follow t; input on scrubber calls onSeek; Space on the root calls onToggle; ArrowRight/ArrowLeft call onStep and prevent the scrubber's own step; destroy removes listeners and the element.
- bar renderer: one group per key, created on first draw and reused; rows missing from geometry are hidden, not removed; ticks keyed by value, removed when gone; clip-path id uses idScope; no `NaN` ever written to an attribute.

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | packages/engine/src/race/matrix.ts, packages/engine/src/race/rank-smoothing.ts, packages/engine/src/race/timeline.ts, packages/engine/src/race/__tests__/matrix.test.ts, packages/engine/src/race/__tests__/rank-smoothing.test.ts, packages/engine/src/race/__tests__/timeline.test.ts | contracts, plans/rfc-race-chart.md §5 | packages/engine/src/race/__tests__/matrix.test.ts, packages/engine/src/race/__tests__/rank-smoothing.test.ts, packages/engine/src/race/__tests__/timeline.test.ts | gpt-6.2-sol | merged | foreman/race-1a | race model tests pass |
| b | M | packages/engine/src/race/period-labels.ts, packages/engine/src/race/colors.ts, packages/engine/src/race/frame.ts, packages/engine/src/race/ticks.ts, packages/engine/src/race/layout-bar.ts, packages/engine/src/race/__tests__/period-labels.test.ts, packages/engine/src/race/__tests__/colors.test.ts, packages/engine/src/race/__tests__/frame.test.ts, packages/engine/src/race/__tests__/ticks.test.ts, packages/engine/src/race/__tests__/layout-bar.test.ts | contracts, plans/rfc-race-chart.md §5.3-5.5 | packages/engine/src/race/__tests__/period-labels.test.ts, packages/engine/src/race/__tests__/colors.test.ts, packages/engine/src/race/__tests__/frame.test.ts, packages/engine/src/race/__tests__/ticks.test.ts, packages/engine/src/race/__tests__/layout-bar.test.ts | gpt-6.2-sol | merged | foreman/race-1b | presentation tests pass |
| c | M | packages/vanilla/src/race/clock.ts, packages/vanilla/src/race/controls.ts, packages/vanilla/src/race/render-bar.ts, packages/core/src/styles/race.css, packages/vanilla/src/race/__tests__/clock.test.ts, packages/vanilla/src/race/__tests__/controls.test.ts, packages/vanilla/src/race/__tests__/render-bar.test.ts | contracts, packages/vanilla/src/barlist-renderer.ts | packages/vanilla/src/race/__tests__/clock.test.ts, packages/vanilla/src/race/__tests__/controls.test.ts, packages/vanilla/src/race/__tests__/render-bar.test.ts | gpt-6.2-sol | merged | foreman/race-1c | player tests pass |
| d | S | packages/engine/src/race/normalize.ts, packages/engine/src/compiler/validation/race.ts, packages/engine/src/compiler/validation/race-options.ts, packages/engine/src/race/__tests__/normalize.test.ts, packages/engine/src/compiler/validation/__tests__/race.test.ts | contracts, packages/engine/src/compiler/validation/barlist.ts | packages/engine/src/race/__tests__/normalize.test.ts, packages/engine/src/compiler/validation/__tests__/race.test.ts | gpt-6.2-sol | merged | foreman/race-1d | validation tests pass |

Lanes write their own tests from the case list in their brief (deviation from lane-dag's scaffold-owned tests, accepted so each Codex run is self-contained). Landing checks that every listed case has a test and no test was weakened to pass.

#### Lane a brief

- Goal: the race's numeric model. Long rows become a dense matrix; the timeline answers value, smoothed rank position and exact rank for any continuous `t`, and assembles `RaceSample`s.
- Interface: `buildRaceMatrix`, `sampleRanks`, `smoothRanks`, `createRaceTimeline` exactly as in Contracts; `RaceDataError` from `race/errors.ts` (scaffold provides it); types from `race/types.ts`.
- Behavior:
  - Period ordering: `temporal` accepts numbers (years), ISO date strings and `Date`, sorted by time; `sortKey` is the year number for integer years and epoch ms for dates; `value` keeps numbers as given and converts Dates to ISO strings. `ordinal` uses `encoding.time.sort` when it is an array, else first-seen order. `quantitative` sorts numerically.
  - Keys are stringified and sorted by `localeCompare(…, 'en')`; this order is the final tie-break.
  - Duplicate `(key, period)` throws `RaceDataError('DUPLICATE_KEY_PERIOD')` with message `<n> rows have <keyField> = '<key>' and <timeField> = <period>. Aggregate them first so each key has one value per period.` where n is the actual count for the first colliding pair. Fewer than 2 distinct periods throws `TOO_FEW_PERIODS`. No finite value anywhere throws `NO_VALUES`.
  - Null, undefined, NaN or Infinity values are absent; if any non-null value was non-finite, call `warn` once with the count. More than 500 distinct keys calls `warn` once.
  - Gaps: only interior gaps (between a key's first and last finite period) are filled: `interpolate` lerps by period index, `hold` repeats the previous value, `drop` leaves NaN.
  - `valueAt(k, t)`: lerp between floor and ceil periods when both are finite; when either is absent, the value at integer t if that period is finite, else NaN.
  - `sampleRanks`: S samples per period, NS = (P-1)·S+1. At each sample, sort present keys by interpolated value descending; ties by the previous sample's rank, then key index. Raw rank = min(rank, top); absent = top.
  - `smoothRanks`: two passes of a box filter of half-width h via prefix sums, edges padded with the end values, so indices 0 and NS-1 equal the input. h = 0 returns a copy.
  - Timeline: effective top = min(options.top, keyCount) (exposed as `top`); h = round(swapPeriods · S / 4); `rankPos` lerps between smoothed samples. `exactRank` ranks present keys by `valueAt` at t with the same tie-break as the nearest sample. `sample(t)`: clamp t to [0, P-1]; items with rankPos < top - 1e-6 sorted by rankPos; opacity = clamp(top - rankPos, 0, 1); change = exactRank at period floor(t)-1 minus exactRank at floor(t) when both are finite and t ≥ 1, else 0; domainMax per `rescale` (`frame` = max visible value, `fixed` = global max, `{ min }` = max(min, frame max)), never ≤ 0 (fallback 1); domainMin = min(0, smallest visible value) (global smallest for `fixed`).
  - Performance: 200 keys × 100 periods × 24 samples builds in under 250ms in vitest (`performance.now()`).
- Decisions already made: 24 samples per period; triangle filter; sentinel `top`; pure functions; the only cache is the rank arrays built in `createRaceTimeline`.
- Out of scope: colors, formatting, geometry, compile wiring, ms-to-period conversion (callers pass `swapPeriods`), the >`top` clamp warning (phase 2 emits it).
- Done when: the three test files cover every matrix, rank smoothing and timeline case in the Phase 1 test cases and pass; typecheck passes.

#### Lane b brief

- Goal: everything between a `RaceSample` and bar geometry: period labels, per-key colors, the `RaceFrame`, crossfading axis ticks, and the bar layout.
- Interface: `formatPeriodLabels`, `assignRaceColors`, `buildRaceFrame`, `valueTickLadder`, `periodTickLadder`, `crossfadeTicks`, `computeBarStatic`, `barGeometry` as in Contracts. Tests build `RaceMatrix`, `RaceTimeline` (a small fake object) and `RaceSample` values by hand; do not import lane a's implementations.
- Behavior:
  - Period labels: for `temporal`, an integer value in 1000–9999 prints as `String(value)` unless `format` is set, in which case it is first converted to `new Date(Date.UTC(year, 0, 1))`; never pass a bare year to a time formatter as milliseconds. ISO strings parse with UTC semantics; with no `format`, pick `%Y` when every period is Jan 1, `%b %Y` when every period is the 1st of a month, else `%b %-d, %Y`. Ordinal: `String(value)`. Quantitative: the channel `format` through the existing number formatter, else `String`.
  - Colors: when `color` is absent or is `{ field }` equal to `keyField`, assign palette colors to keys in order of first appearance in the top N (scan `timeline.sample(i)` at each integer period, then never-visible keys in key order), cycling the palette. Another field: one color per distinct `colorValues` entry in order of first appearance under the same scan. `{ value }`: every key gets it.
  - Frame: items map to `RaceItem` with key, label, color, value, `formatValue(value)`; `period = { index, value: periods[index].value, label: periodLabels[index] }`; `domain = [domainMin, domainMax]`; `summary` when enabled sums values of items with `rank < top`, labelled with `formatValue`.
  - Ticks: `valueTickLadder(span)` returns 1×10ⁿ and 5×10ⁿ steps from 10^(floor(log10 span) - 2) to the first step ≥ span. `crossfadeTicks`: room default 64, fadeFrom default 40; active = first ladder step whose pixel spacing ≥ room (else the largest); finer = the previous step; w = clamp((finer spacing - fadeFrom) / (room - fadeFrom), 0, 1); multiples of active within the domain get 1 - w, multiples of finer get w, summed and capped at 1; omit opacity ≤ 0.01.
  - Bar static: name gutter = maxLabelWidth + 8 at the left of `area`; value-label space = maxValueLabelWidth + 6 at the right; tick labels take 22px at the top; rowHeight = plot height / top; barHeight = round(rowHeight × 0.74); clip = plot; period label anchored at the plot's lower right with fontSize = clamp(rowHeight × 2.4, 36, 72), only when showPeriod; summary line above it when showSummary.
  - Bar geometry: x scale maps `frame.domain` onto the plot width; per item, y = plot.y + rankPos × rowHeight + (rowHeight - barHeight) / 2; bar spans scale(0) to scale(value); name at (nameX, row centre), right-aligned; value label 6px past the bar's outer end; opacity from the item. Ticks from `crossfadeTicks(frame.domain, plotWidth / span, valueTickLadder(span))` with `position` in px and `label` via `formatTick`.
- Decisions already made: nested ladder (1-2-5 overlaps mid-fade, seen in the mock); period label lower right; geometry is pure.
- Out of scope: line and table geometry, text measurement (widths arrive as numbers), compile wiring.
- Done when: the five test files cover every period-label, colors, frame, ticks and bar-layout case in the Phase 1 test cases and pass; typecheck passes.

#### Lane c brief

- Goal: the browser player pieces, each testable alone: the playback clock, the control strip and the keyed SVG bar renderer.
- Interface: `createRaceClock`, `createRaceControls`, `createRaceBarRenderer` as in Contracts. Use `createSVGElement` from `renderers/svg-dom.ts`. Tests use happy-dom and a fake `RaceFrameScheduler` with manual `now`, never real timers.
- Behavior:
  - Clock: rate = (periodCount - 1) / durationMs periods per ms × speed. The first frame after play only records `now`. At t = P-1 it holds holdEndMs, then sets t = 0 and keeps playing (loop) or pauses with ended = true. `play()` while ended restarts at 0. `seek` clamps, clears ended, fires onTick and onStateChange. `stepPeriod(1)` → min(floor(t) + 1, P-1); `stepPeriod(-1)` → max(ceil(t) - 1, 0); both pause. A frame is requested only while playing; `pause` and `destroy` cancel the pending one. Errors per Contracts.
  - Controls: root `div.oc-race-controls` holding `button.oc-race-play` (aria-label "Play" or "Pause"), `input.oc-race-scrub[type=range]` (min 0, max P-1, step "any", aria-label "Time", aria-valuetext = label of floor(t)), and `span.oc-race-readout`. Space on the root (outside the button, which activates natively) calls onToggle; ArrowLeft/ArrowRight anywhere in the root call onStep(-1/1) and preventDefault. Scrubber `input` calls onSeek(Number(value)).
  - race.css: control strip grid (button, scrubber, readout), 34px round play button with a focus-visible ring, accent-colored range, tabular numerals; `.oc-race-row` with `will-change: transform` for the phase 4 table. Existing `--oc-*` tokens only, inside `@layer oc.components`.
  - Bar renderer: draws into the given `host` group: `<g class="oc-race-axis">`, `<g class="oc-race-rows" clip-path="url(#<idScope>-race-clip)">` with its `<clipPath>` in a local `<defs>`, `<text class="oc-race-period">`, `<text class="oc-race-summary">`. Row group per key (`data-key`), created on first sight, holding `rect`, name `text` (text-anchor end) and value `text`. Keys absent from a geometry get `display="none"`. Tick groups keyed by value (`line` + `text`), removed when absent. Numbers written with at most 2 decimals; non-finite numbers are skipped, never written. `destroy` removes everything it created.
- Decisions already made: rAF only while playing; keyboard on the root; elements keyed so frames never rebuild DOM.
- Out of scope: mounting, compiling, chrome, theme stamping, line and table renderers, export.
- Done when: the three test files cover every clock, controls and bar-renderer case in the Phase 1 test cases and pass; typecheck and lint pass.

#### Lane d brief

- Goal: race specs validate with actionable messages and normalize to `NormalizedRaceSpec` with every default filled.
- Interface: `validateRaceSpec(spec, errors)` (dispatch wired by the scaffold), `normalizeRaceSpec(spec, warnings)` as in Contracts. Follow `validation/barlist.ts` for message shape (`message`, `path` as JSON pointer, `code`, `suggestion`) and `didYouMean` for unknown fields.
- Behavior: errors for a missing `data` array; missing `encoding.time`, `key` or `value`, or a missing `field` on them; `value.type` present and not `quantitative`; `mark` not `bar`/`line`/`table` (string or `{ type }`); unknown mark option for the chosen mark (bar: `cornerRadius`; line: `window`; table: `columns`); `race.duration` and `race.step` both set; `top` not an integer ≥ 1; `duration` or `step` not finite > 0; `swap` or `holdEnd` not finite ≥ 0; `rescale` not `"frame"`, `"fixed"` or `{ min: finite }`; `gaps` not an allowed value; `transform` present ("Race specs don't support transform yet. Aggregate your data to one row per key and period before passing it in."); unknown keys under `race` with a did-you-mean suggestion. Normalize fills the Spec section's defaults except `duration` (left undefined; phase 2 resolves it from the period count), expands a string `mark` to `{ type }` with that mark's option defaults (`window: 'reveal'`), sets `autoplay: false` when `animation === false`, and pushes a warning when `controls` is false while autoplay is not false.
- Decisions already made: Spec section defaults; `transform` rejected in v1.
- Out of scope: data checks (duplicates, period count), which need rows and live in the matrix.
- Done when: both test files have one test per error and default above and pass; typecheck passes.

### Phase 2: race assembly (engine pipeline, vanilla shell)

Tag: race-chart-phase-2
Demo: `bun scripts/race-frames.ts --geometry` prints bar geometry at three t values through `prepareRace` → `layoutRace` → `raceGeometryAt`; shell tests render chrome and a bar frame in happy-dom.
Depends on: phase 1

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | packages/engine/src/race/prepare.ts, packages/engine/src/race/layout.ts, packages/engine/src/race/geometry.ts, packages/engine/src/race/marks.ts, packages/core/src/types/race.ts, packages/engine/src/race/types.ts, packages/engine/src/race/timeline.ts, packages/engine/src/race/layout-bar.ts, packages/engine/src/compiler/validation/race.ts, packages/engine/src/compiler/validation/race-options.ts, packages/engine/src/race/matrix.ts, packages/vanilla/src/race/render-bar.ts, packages/core/src/styles/race.css, packages/core/src/responsive/metrics.ts, packages/core/src/responsive/__tests__/metrics.test.ts, packages/engine/src/compiler/validation/__tests__/race.test.ts, packages/engine/src/race/__tests__/layout-bar.test.ts, packages/engine/src/race/__tests__/timeline.test.ts, packages/vanilla/src/race/__tests__/render-bar.test.ts, packages/engine/src/race/__tests__/prepare.test.ts, packages/engine/src/race/__tests__/layout.test.ts, packages/engine/src/race/__tests__/geometry.test.ts, scripts/race-frames.ts | contracts, packages/engine/src/barlist/compile-barlist.ts | packages/engine/src/race/__tests__/prepare.test.ts, packages/engine/src/race/__tests__/layout.test.ts, packages/engine/src/race/__tests__/geometry.test.ts | gpt-6.2-sol | merged | foreman/race-2a | engine pipeline tests pass, `race-frames.ts --geometry` prints geometry |
| b | M | packages/vanilla/src/race/shell.ts, packages/vanilla/src/race/renderers.ts, packages/vanilla/src/race/__tests__/shell.test.ts, packages/vanilla/src/renderers/chrome.ts | contracts, packages/vanilla/src/barlist-renderer.ts, packages/vanilla/src/barlist-mount.ts | packages/vanilla/src/race/__tests__/shell.test.ts | gpt-6.2-sol | merged | foreman/race-2b | shell tests pass |

Test cases:
- prepare: a valid spec returns a model whose matrix, timeline and labels match the data; an invalid spec throws the same aggregated validation error `compileChart` throws for a bad chart; a duplicate row throws `RaceDataError` unwrapped; warnings reach `onWarn` (non-finite values, > 500 keys, `top` above the key count, `controls: false` with autoplay); duration resolves from `duration`, from `step` × (P - 1), and by default to clamp(P × 700, 8000, 90000); `swap` converts to `swapPeriods` from the resolved duration; `labels.format` and `encoding.value.format` drive `formatValue`; playback carries durationMs, holdEndMs, loop, autoplay (false when `animation: false`), controls.
- layout: area sits below the chrome and inside padding; a 360px and a 1200px width both give a positive plot; long labels widen the name gutter up to 40% of the width, then truncate; dark mode swaps theme and maps palette colors to their dark variants in `layout.colors`; the `mark` option overrides the spec's mark; an unregistered mark throws a clear error naming the mark; the model is not mutated.
- geometry: `raceFrameAt` and `raceGeometryAt` at the same t are deterministic and agree on order and values; t outside the range clamps; geometry uses `layout.colors`; at an integer t the bar for the leader spans to the plot's right edge under `rescale: 'frame'`.
- shell: renders an SVG with the layout's viewBox, role and aria-label; chrome title and source text appear; the brand renders when `watermark` is true and not when false; theme tokens are stamped; `oc-dark` toggles on the root in dark mode; the bar mark host is an SVG `<g>` inside the SVG, the table host an HTML element after it; `controlsSlot` follows the SVG; `destroy()` removes everything the shell created and leaves the container's other children alone; `RACE_RENDERERS.bar` creates a working bar renderer in that host.

#### Lane 2a brief

- Goal: the engine pipeline: spec to `RaceModel` once, model plus size to `RaceLayout`, and model plus layout plus t to geometry, with bar registered in `RACE_MARKS`.
- Interface: `prepareRace`, `layoutRace`, `raceFrameAt`, `raceGeometryAt` and the `RACE_MARKS` entry type as scaffolded. `RaceLayoutBase.colors` and `labels` already exist (phase 1 boundary fixes); this lane may add `measureText?` to it if the brand renderer needs it (match `BarListLayout`).
- Behavior:
  - `prepareRace`: validate and normalize through the shared `compile` from `compiler/index` (as `compileBarList` does), emit warnings through `emitSpecWarnings`, throw on a non-race spec. Then `buildRaceMatrix(data, encoding, race.gaps, warn)`; resolve duration (`step` × (P - 1), else `duration`, else clamp(P × 700, 8000, 90000)); `swapPeriods = swap / (durationMs / (P - 1))`; `createRaceTimeline` with 24 samples per period; warn when `race.top` exceeds the key count; `formatPeriodLabels(matrix.periods, encoding.time)` with `race.period.format` overriding the channel format; `assignRaceColors` into `model.colorSlots` (theme-independent); `formatValue` from `resolveFieldFormatter` with the value channel format, `labels.format` winning, and the matrix's finite values as context.
  - `layoutRace`: merge and resolve the theme (`mergeThemeConfig`, `resolveTheme`, `adaptTheme` for dark mode); `computeChrome` exactly as `compileBarList` does; `area` = the rect below the chrome inside padding with the options' width and height; `colors` = `resolveRaceColors(model.colorSlots, theme.colors.categorical)` for the resolved (light or dark) theme; `labels` = matrix labels truncated with an ellipsis to 40% of the area width using `options.measureText` or `estimateTextWidth`; call the mark's `computeStatic(model, base, mark, measureText)`; `a11y` from `raceA11y(title)`; carry `periods` (the labels), `playback`, `watermark`, warnings.
  - Bar entry in `marks.ts`: `computeStatic` measures `maxLabelWidth` over `layout.labels` and `maxValueLabelWidth` over `formatValue` of the global min and max, then calls `computeBarStatic` with theme font sizes and `showPeriod = race.period !== false`, `showSummary = race.summary === 'sum'`, `hasNegatives` = any finite matrix value below 0; `geometry` calls `barGeometry(stat, frame, model.formatValue)`.
  - `raceFrameAt(model, t)`: `buildRaceFrame(model.timeline.sample(clamped t), presentation)` with `top = model.timeline.top`. `raceGeometryAt` builds the same frame with `layout.colors` and `layout.labels` and dispatches through `RACE_MARKS[layout.mark]`.
- Decisions already made: the rank cache lives only in the model; layout is plain data and never holds functions other than an optional `measureText` (as barlist does); line and table register in phase 4.
- Out of scope: line and table entries, the real accessibility description (phase 4), DOM.
- Done when: the three test files cover every prepare, layout and geometry case above and pass; `bun scripts/race-frames.ts --geometry` prints three geometries.

#### Lane 2b brief

- Goal: the race's DOM frame: the root, the SVG with chrome, brand and theme tokens, the mark host and the controls slot, plus bar registered in `RACE_RENDERERS`.
- Interface: `createRaceShell` and `RaceShell` as scaffolded, with `destroy(): void` added to `RaceShell` (this lane owns `shell.ts`). `RACE_RENDERERS.bar = createRaceBarRenderer`.
- Behavior: root `div.oc-race-root` appended to the container, with `oc-dark` when `layout.theme` is the dark one (follow how `barlist-mount.ts` decides); SVG with `viewBox`, inline pixel height, `role="img"` and `aria-label` from `layout.a11y` (or `aria-hidden` when hidden), class `oc-race`, `stampThemeProperties`; chrome text through `renderChromeElement` the way `barlist-renderer.ts` `renderChrome` does; `renderAttributionBrand` at the bottom anchor; for bar and line marks a `<g class="oc-race-mark">` in the SVG; for table a `div.oc-race-table` after the SVG; `div.oc-race-controls-slot` last. Tests build `RaceLayout` values by hand (phase 2 lane a runs in parallel).
- Decisions already made: one shell per layout; phase 3's mount rebuilds the shell and renderer on relayout.
- Out of scope: playback, controls content, compile calls, line and table renderers.
- Done when: the shell test covers every shell case above and passes.

### Phase 3: bar race in the browser

Tag: race-chart-phase-3
Demo: `bun run dev`, open the `Testing / Race / Bar` story: the GDP race autoplays when scrolled into view, pauses, scrubs, steps with arrow keys, rescales, loops with `loop: true`, survives resize mid-play and theme toggles, and opens on the final frame under reduced motion.
Depends on: phase 2

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | packages/vanilla/src/race-mount.ts, packages/vanilla/src/race/__tests__/race-mount.test.ts, examples/src/testing/race.stories.tsx, packages/engine/src/race/layout-bar.ts, packages/engine/src/race/__tests__/layout-bar.test.ts, packages/vanilla/src/race/render-bar.ts, packages/vanilla/src/race/__tests__/render-bar.test.ts, packages/vanilla/src/race/size.ts, examples/src/__tests__/migration-parity.test.ts | contracts, packages/vanilla/src/barlist-mount.ts, packages/vanilla/src/visibility.ts | packages/vanilla/src/race/__tests__/race-mount.test.ts | gpt-6.2-sol | merged | foreman/race-3a | mount tests pass, story works in a real browser |

Test cases (happy-dom, fake scheduler injected through a test-only seam or `requestAnimationFrame` stub, IntersectionObserver absent so `whenSeen` fires at once unless the test installs a fake):
- mount renders the shell, one row group per visible key and the controls; `controls: false` renders none.
- `autoplay: 'visible'` starts only once seen (fake IntersectionObserver); `true` starts at mount; `false` opens paused at t = 0; `animation: false` and reduced motion open paused on the final frame and never autoplay.
- the clock drives frames: after advancing time, rows reorder and the readout and scrubber follow.
- `seek`, `play`, `pause`, `setSpeed` delegate; `seek(NaN)` throws `RangeError`; `getState()` returns t, playing, speed and the period (index, value, label).
- resize mid-play relayouts without restarting: t keeps advancing from where it was, `playing` stays true, the model is not rebuilt (spy on `prepareRace` via module boundary or count matrix builds).
- `update(spec)` with a different `top` or mark keeps t (clamped to the new period count) and the playing state; `update` with an invalid spec throws and the mounted race keeps playing unchanged.
- dark mode adds `oc-dark`; a theme option palette changes bar fills.
- `destroy()` cancels the clock, the visibility hold and the resize observer, empties what it added, and later calls are no-ops; a second `destroy()` is safe.
- `export('gif')` rejects with a clear "GIF export arrives in a later release" error until phase 5.

#### Lane 3a brief

- Goal: `createRace` wires the pieces into a working embeddable race: prepare once, lay out per size, render through the registries, drive the clock, and expose the `RaceInstance` API.
- Interface: `createRace(container, spec, options?)`, `RaceInstance`, `RaceMountOptions` as scaffolded. Uses `prepareRace`, `layoutRace`, `raceGeometryAt`, `raceFrameAt`, `createRaceShell`, `RACE_RENDERERS`, `createRaceClock`, `createRaceControls`, `whenSeen`, `prefersReducedMotion`, `resolveDarkMode`, `createMeasureText`.
- Behavior:
  - Size: width = `spec.width` ?? container width ?? 640; height = `spec.height` ?? container height when > 0 ?? 520; the SVG gets the height minus the controls strip (44px) when controls show.
  - Fonts and measuring follow `barlist-mount.ts`: a `createMeasureText` for the theme font family, and one relayout after `document.fonts.ready` resolves.
  - Render: layout → shell → renderer (`RACE_RENDERERS[layout.mark]`, clear error if missing) → controls in `shell.controlsSlot` → draw `raceGeometryAt(model, layout, t)`. Relayout (resize, fonts, `update`) destroys the shell, renderer and controls and rebuilds them, then redraws at the current t; the clock and model survive.
  - Clock: `createRaceClock({ periodCount, durationMs, holdEndMs, loop, onTick: draw, onStateChange: controls.update })`. Controls call `clock.toggle`, `clock.seek`, `clock.stepPeriod`.
  - Autoplay: reduced motion or `animation: false` → seek to the last period, no autoplay. Otherwise `'visible'` → `whenSeen(container, play)` (cancel on destroy); `true` → play now; `false` → stay at 0.
  - `update(spec)`: `prepareRace` first; on throw rethrow and leave everything as it was. On success swap the model, clamp t, relayout, keep playing state; rebuild the clock only when period count, duration, hold or loop changed.
  - Resize: a `ResizeObserver` when `autoResize !== false`, coalesced to one relayout per frame; `resize()` relayouts on demand.
  - `export`: return a rejected promise with `Error('GIF export arrives in a later release')` (phase 5 replaces it).
  - `destroy`: idempotent; cancels everything; methods after it are no-ops (`seek(NaN)` still throws `RangeError` first, matching the clock).
  - Story `examples/src/testing/race.stories.tsx` (`Testing / Race`): `Bar` (GDP fixture, chrome title "The world's largest economies", source line, `encoding.value.format` set so values in billions read as "$2.9T"-style dollars rather than the default "2.9k"), `Loop` (`loop: true`, `top: 5`), `Fixed scale` (`rescale: 'fixed'`), `No controls` (`controls: false, autoplay: true`), and `Dark` (dark mode). Each mounts with `createRace` in a `useEffect` with `destroy` on cleanup, following the existing testing stories.
  - Known from lane 2a QA: at 360px the period overlay can cover the last row's value label. Reserve the overlay's box in the bar static (value labels of rows under it stay clear of it, or the overlay sits above the bottom row), with a 360px test.
- Decisions already made: race playback does not use `createEntranceLifecycle`. It is a user-controllable timeline, not a CSS entrance: it needs no resize deferral (frames are pure in t), and pausing, seeking and looping are outside that lifecycle's model. `whenSeen` gives the same play-when-seen hold. Logged as a deviation from the svg-animation rule's "every mount owns one lifecycle".
- Out of scope: line and table marks, a11y announcements and the hidden table (phase 4), framework wrappers and GIF export (phase 5).
- Done when: the mount test covers every case above and passes; the story plays correctly in a real browser (Playwright screenshot at three t values via `seek`, and a resize mid-play).

### Phase 4: line and table marks, mark swap, accessibility

Demo: in the `Testing / Race / Bar` story, `race.update({ ...spec, mark: 'line' })` and `'table'` swap the mark mid-play without losing the playhead; a screen reader reads the description, the per-period hidden table and the pause/seek announcements. (The `Marks` switcher story lands with the gallery in phase 6.)
Depends on: phase 3

Phase 4 base (one short Codex run, committed before the lanes start, so no two lanes touch a shared file):
- `core/src/types/race.ts`: table cells become typed, `RaceTableCell = { column: 'rank'; text: string } | { column: 'change'; direction: 'up' | 'down' | 'same' | 'new'; text: string } | { column: 'name'; text: string; color: string } | { column: 'bar'; x: number; width: number; color: string } | { column: 'value' | 'share'; text: string }`; `RaceTableGeometry.rows[].cells: RaceTableCell[]`; `RaceTableStatic` gains `headerHeight: number`, `fontSize: number` and `labels: Record<RaceTableColumn, string>` (header text). `RaceLineStatic` gains `yAxisX: number`, `labelGutter: number`, `tickFontSize: number`; `RaceLineGeometry.series[].endLabel` gains `value: string` and `RaceLineGeometry` gains `domain: [number, number]` (the monotonic y domain). JSDoc each.
- `engine/src/race/layout-line.ts` and `layout-table.ts`: stub `computeLineStatic`/`lineGeometry` and `computeTableStatic`/`tableGeometry` that throw `Error('not implemented')`; register `line` and `table` in `RACE_MARKS` (marks.ts) through them. `vanilla/src/race/render-line.ts` and `render-table.ts`: stub factories registered in `RACE_RENDERERS`. `engine/src/race/a11y.ts` keeps `raceA11y` but its signature becomes `raceA11y(model: RaceModel): A11yMetadata` (layout.ts passes the model); `vanilla/src/race/a11y-dom.ts` stub exports `createRaceA11y(shell, model)` returning `{ announce(frame), destroy() }`.
- `RaceInstance` gains `on(event: 'period', cb: (period: RaceFrame['period']) => void): () => void` (stub in race-mount: registers and returns an unsubscribe, never fires until lane c). RFC's `seekTo(periodValue)` is dropped from v1: `seek` covers it.
- The registration test (`registration.test.ts`) gains line and table entries and stays locked for the lanes.

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | packages/engine/src/race/layout-line.ts, packages/engine/src/race/__tests__/layout-line.test.ts, packages/vanilla/src/race/render-line.ts, packages/vanilla/src/race/__tests__/render-line.test.ts, scripts/race-frames.ts, packages/core/src/styles/race.css | contracts, layout-bar.ts, render-bar.ts, timeline.ts, matrix.ts | packages/engine/src/race/__tests__/layout-line.test.ts packages/vanilla/src/race/__tests__/render-line.test.ts | gpt-6.2-sol | running | foreman/race-4a | line race renders and swaps in through `update` |
| b | M | packages/engine/src/race/layout-table.ts, packages/engine/src/race/__tests__/layout-table.test.ts, packages/vanilla/src/race/render-table.ts, packages/vanilla/src/race/__tests__/render-table.test.ts, packages/core/src/styles/race-table.css, packages/core/src/styles/index.css | contracts, layout-bar.ts, render-bar.ts, shell.ts, packages/core/src/styles/race.css | packages/engine/src/race/__tests__/layout-table.test.ts packages/vanilla/src/race/__tests__/render-table.test.ts | gpt-6.2-sol | running | foreman/race-4b | table race renders and swaps in through `update` |
| c | M | packages/engine/src/race/a11y.ts, packages/engine/src/race/__tests__/a11y.test.ts, packages/vanilla/src/race/a11y-dom.ts, packages/vanilla/src/race/__tests__/a11y-dom.test.ts, packages/vanilla/src/race-mount.ts, packages/vanilla/src/race/__tests__/race-mount.test.ts | contracts, shell.ts, controls.ts, RFC section 8 | packages/engine/src/race/__tests__/a11y.test.ts packages/vanilla/src/race/__tests__/a11y-dom.test.ts packages/vanilla/src/race/__tests__/race-mount.test.ts | gpt-6.2-sol | running | foreman/race-4c | description, hidden table, live region and `on('period')` work |

Test cases:
- line (4a): `window: 'reveal'` x domain grows from [0, 1] at t = 0 to [0, t] and ends at the full span; `'all'` is fixed; the path holds observed points through `floor(t)` plus the interpolated head at t; a gap (`gaps: 'break'`) yields a `null` that splits the path; y domain never shrinks across increasing t; series are the top-N items plus items that left within the last period, fading; head labels never overlap and stay inside the plot after the push pass (10 crowded series at 360px); renderer draws one path per series with `fill: none`, gaps as separate subpaths, reuses nodes across draws, removes series that left, and destroy removes only its nodes.
- table (4b): row y = rankPos × rowHeight below the header; the rank and change cells change only when `floor(t)` changes (sample t = 3.2 and 3.8 give the same rank text and change direction); a key new to the top N shows `new`; `bar` width is proportional to value with the max at full column width; `share` is value over the sum of all keys in the period, formatted as a percent; default columns drop `bar` below 520px; custom `columns` order is respected; the row moving up draws above the one moving down; the renderer builds an HTML table in the shell's table host with a header row, positions rows by transform, and destroy empties only what it added.
- a11y (4c): `raceA11y` description names the span, the leader at start and end and the biggest climber by rank; the hidden table has one row per period up to 60 periods and is sampled (first, last, evenly spaced) beyond; the live region announces on pause, seek and keyboard step ("1995: United States, Japan, Germany lead") and never during play; `on('period')` fires once per period boundary crossed while playing and on seek, unsubscribe stops it, destroy clears listeners; mark swap via `update` keeps the hidden table and live region.

#### Lane 4a brief

- Goal: the line mark: lines for the ranked series, drawn forward over time, with head labels.
- Interface: `computeLineStatic(model, base, mark, measureText): RaceLineStatic`, `lineGeometry(model, layout, frame): RaceLineGeometry`, `createRaceLineRenderer` (the `RaceRendererFactory<'line'>`), all scaffolded in the phase 4 base.
- Behavior: the plot reserves a right label gutter from the widest `label value` text at display precision (cap so the plot keeps 50% of the width) and a tick band sized from the theme tick font, as bar does. x maps period index to px; `reveal` uses [0, max(1, t)], `all` uses [0, periodCount - 1]. Points come from `model.matrix` values per key (no new interpolation: use `interpolateRaceValue` for the head). The y domain is the running max over [0, t] of every drawn point (min 0, or the running min when negative), rounded with the existing tick ladder so ticks don't snap. Fading series follow `frame.items[].opacity`. Head labels: sort by y, push down to keep `fontSize + 2` spacing, then push up from the plot bottom; name in the series color, value muted. Ticks: y ticks via `crossfadeTicks`, x ticks from the period labels (thin to fit the width, always the first and the playhead's period).
- Decisions already made: no sliding window in v1; no markers on points; lines are 2px, `stroke-linejoin: round`.
- Out of scope: table, a11y, mount changes.
- Done when: the test cases pass and `scripts/race-frames.ts --geometry --mark line` (add the flag) prints sensible geometry for the GDP fixture; QA in the `Testing / Race / Bar` story by calling `update` with `mark: 'line'` from the browser console at 800px and 360px.

#### Lane 4b brief

- Goal: the table mark: an HTML table whose rows slide to their rank as the race plays.
- Interface: `computeTableStatic`, `tableGeometry`, `createRaceTableRenderer`, scaffolded in the phase 4 base; typed `RaceTableCell`s.
- Behavior: rows are `top` tall slots under a header; columns default to `rank, change, name, bar, value, share`, dropping `bar` when `area.width < 520`; widths: rank and change fixed from measured text, name from `layout.labels`, value and share from measured formatted extremes, bar takes the rest. Rank and change derive from `Math.round(rankPos)` at `floor(t)` versus `floor(t) - 1`. The renderer writes cells as text (never `innerHTML`), positions rows with `transform: translateY(...)`, sets row opacity, orders the moving-up row last in DOM, and draws the bar cell as a div with the computed width. Styles in a new `race-table.css` imported by the race styles entry, tabular numerals for numbers, using the theme tokens.
- Decisions already made: table renders in the shell's table host, not SVG; no sorting by clicking headers.
- Out of scope: line, a11y, mount changes.
- Done when: the test cases pass; QA in the browser via `update({ mark: 'table' })` at 800px and 360px, light and dark.

#### Lane 4c brief

- Goal: accessibility and period events: description, hidden per-period table, live announcements, and `on('period')`.
- Interface: `raceA11y(model): A11yMetadata` (engine), `createRaceA11y(shell, model): { announce(frame): void; destroy(): void }` (vanilla), `RaceInstance.on('period', cb)`.
- Behavior: per the test cases and RFC section 8. The hidden table lives in a visually hidden container the shell provides (or that `createRaceA11y` appends to the shell root), built once per model. The live region is `aria-live="polite"`. The mount calls `announce` on pause, seek and keyboard step, fires `period` listeners when `floor(t)` changes and on seek, and recreates `createRaceA11y` only when the model changes. Controls' scrubber keeps `aria-valuetext` (already in controls.ts; verify).
- Decisions already made: announcements never fire during play.
- Out of scope: line and table geometry.
- Done when: the test cases pass; QA with the browser's accessibility tree on the `Testing / Race / Bar` story.

### Phase 5: wrappers and export

Demo: `<Race spec />` renders in React, Vue and Svelte stories and through `<Visualization>`; `race.export('gif')` produces a GIF whose frames match `raceGeometryAt` at the sampled t, capped at 1200 frames.
Depends on: phase 3

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | packages/react/src/Race.tsx, packages/react/src/Visualization.tsx, packages/react/src/index.ts, packages/react/src/__tests__/Race.test.tsx, packages/vue/src/Race.ts, packages/vue/src/Visualization.ts, packages/vue/src/index.ts, packages/vue/src/__tests__/Race.test.ts, packages/svelte/src/Race.svelte, packages/svelte/src/Visualization.svelte, packages/svelte/src/index.ts, packages/svelte/src/__tests__/Race.test.ts | | | gpt-6.2-sol | running | foreman/race-5a | |
| b | M | packages/vanilla/src/race/export.ts, packages/vanilla/src/export-gif.ts, packages/vanilla/src/race/__tests__/export.test.ts, packages/vanilla/src/race-mount.ts, packages/vanilla/src/race/__tests__/race-mount.test.ts | | | gpt-6.2-sol | pending | | |

#### Lane 5a brief

- Goal: `<Race>` components for React, Vue and Svelte, and `type: "race"` routing in each `Visualization`.
- Interface: React `<Race spec theme? darkMode? className? style? autoResize? watermark? onWarn? onPeriod? ref />`, where the ref exposes the `RaceInstance` (via `forwardRef`/`useImperativeHandle` or the pattern the other components use). Vue and Svelte mirror the props and emit or call `period`, and expose the instance the way their `BarList` does.
- Behavior: follow each package's `BarList` wrapper exactly for mount, destroy, theme context, dark mode and StrictMode. A changed `spec` calls `instance.update(spec)`, which keeps the playhead; an invalid spec reports through `onWarn` or rethrows the same way BarList handles compile errors. Changed `theme` or `darkMode` remounts, because `RaceMountOptions` are read once; a remount restores the previous `t` and playing state through `seek`/`play`. `onPeriod` subscribes through `instance.on('period')` and resubscribes when the callback changes, without remounting. Export `Race` and its props type from each package index.
- Decisions already made: no playback props (`playing`, `t`) in v1; callers use the ref.
- Out of scope: GIF export, docs.
- Done when: each package's tests cover mount, spec update keeping t, theme remount restoring t, `onPeriod` firing and unsubscribing, destroy on unmount, and `Visualization` routing a race spec; each package's typecheck passes (svelte-check for Svelte).

#### Lane 5b brief

- Goal: `race.export('gif', { fps? })` returns a GIF of the whole race, frame-stepped from `t = 0` to the end, for the bar and line marks.
- Interface: `exportRaceGIF(view, options)` in `race/export.ts`, called from `RaceInstance.export` in `race-mount.ts`; the instance signature stays `export(format: 'gif', options?: Pick<GIFExportOptions, 'fps'>): Promise<Blob>`. Factor the encoder out of `exportGIF` (dynamic `gifenc` import with the same missing-peer error, one global palette seeded from a settled frame, background fill, `rasterizeSVGToCanvas`) into a shared helper both exporters call; `exportGIF`'s behavior and tests stay unchanged.
- Behavior: render each frame into a detached clone of the race's SVG (chrome, axis, marks; never the HTML controls) through the mark's own renderer drawing `raceGeometryAt(layout, t)`, so a frame matches what the live chart shows at that `t`. fps defaults to 25; when `fps × duration` exceeds 1200 frames, lower the fps so the whole timeline fits in 1200 (never truncate). Hold the final frame for 1.5s. `spec.loop` true loops the GIF forever, otherwise it plays once. Fonts embedded and the theme style block injected the same way `exportGIF` does. The live chart's playhead, playing state and DOM are untouched by an export, including one started mid-playback; a `destroy()` during export rejects the promise.
- Decisions already made: the table mark renders HTML, which the SVG rasterizer can't capture, so `export('gif')` on a table race rejects with `Error('GIF export supports the bar and line marks')` in v1. No dpi or loop options on the instance in v1.
- Out of scope: video formats, PNG/SVG export of a single frame, the table mark.
- Done when: tests cover frame count and fps capping, final-frame hold, loop flag, frame geometry matching `raceGeometryAt` at sampled `t` (assert on the cloned SVG before rasterizing), table rejection, missing-gifenc error, live state untouched, and destroy-during-export; `exportGIF`'s existing tests pass unchanged; a real GIF from the GDP bar story opens and plays in a browser.

### Phase 6: docs, gallery, generated references, baselines

Demo: the gallery has a Race page with all three marks; `bun run check:generated` and `bun run test:visual` pass.
Depends on: phase 4, phase 5

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | examples/src/testing/race.stories.tsx, examples/src/gallery/race.stories.tsx, examples/src/gallery/race.demos.ts, examples/src/gallery/registry.ts, docs/codebase-map.md, scripts/generate-llms.mjs, llms.txt, llms-full.txt, e2e/visual/race.spec.ts, e2e/visual/__screenshots__/ | | | gpt-6.2-sol | pending | | |
| b | M | site/src/content/docs/change-over-time/race.mdx, site/src/demos/change-over-time/, site/src/components/demo/, site/tests/ | site/AGENTS.md, site/src/content/docs/change-over-time/slope-bump.mdx, site/src/content/docs/behavior/motion.mdx, the race stories | site tests and `bun run build` in site/ | gpt-6.2-sol | pending | | race docs page builds with working interactive demos |

#### Lane 6b brief

- Goal: a "Race" page in the Astro docs site (`site/`), under Change over time, with interactive examples, following the existing page patterns (front matter, `<Demo id>` embeds, a "Fields that matter" table, links to related pages).
- Behavior: demos registered the way existing `site/src/demos/change-over-time/*` demos are; teach `Demo` to mount `type: "race"` specs through `createRace` (with destroy on unmount and the docs theme). Examples: the GDP bar race with chrome and a value format; the same race as `mark: "line"` and `mark: "table"`; a looping top-5; a fixed scale; a short section on controls, `autoplay: "visible"`, reduced motion, and the runtime API (`play`, `pause`, `seek`, `update` for mark swap, `on('period')`, GIF export). Prose follows the site's voice (plain, specific, no hype) and states when to choose a race versus a bump chart or a small-multiples line chart.
- Decisions already made: lands after phases 4 and 5, so every mark and export exists; runs as its own Codex lane in parallel with 6a.
- Done when: `bun run build` in `site/` passes with the page, the site's tests pass, and each demo plays in a real browser at desktop and 360px, light and dark.

## Log

- 2026-11-24: user approved the mock's motion quality and the RFC recommendations; plan written.
- 2026-11-24: devils-advocate critique (opus), all eight findings accepted and applied:
  1. A race spec counted as a chart because it has `mark`. The scaffold now excludes race from `isChartSpec`, the validate chart and layer checks, mark-option checks and `expandSpecSugar`, and normalizes race before chart.
  2. Phase 3–5 lanes couldn't reach their demos. Added the engine and vanilla mark registries, gave Visualization and the package indexes to the wrapper lane, and gave llms and the codebase map to phase 6.
  3. No owner for the SVG shell or theme. Added `race/shell.ts`, made `RaceLayout` plain data discriminated by mark, and put `period.value` back on `RaceFrame`.
  4. The rank model was rebuilt on every resize. Split the model (`prepareRace`, built once per spec) from the layout (`layoutRace`, per size); added the >500 keys warning.
  5. Missing edge cases. Added `top` > key count, single key, negatives drawn from a zero baseline, and a key present at period 0. Later-phase briefs are still written while earlier phases run, per lane-dag.
  6. GIF export couldn't reuse `exportGIF`. The export lane now owns `export-gif.ts` so it can factor out the encoder, with a 1200-frame cap.
  7. Period labels had no owner and could print "1970" for a bare year. Added `period-labels.ts` with a test for bare years; added the `controls: false` warning; the duplicate-row message uses the real row count.
  8. The generated schema would go stale before phase 6. The scaffold regenerates it, and `check:generated` is now in the gate.
- 2026-11-24: scaffold 9756b43b (Codex); approved scope additions: examples/src/components/Demo.tsx race case, race-in-layer rejection in validation/layer.ts, spec-sugar and flattenLayers. Lane 1b: RacePresentation gains `top` (summary needs the effective top).
- 2026-11-24: lane 1b decisions: bar clip spans area width and plot height; negative domains inset the scale's left end by the value-label space; undersized areas clamp to non-negative geometry; period ladder [1, 5, 10, 50, 100, 500] so it nests.
- 2026-11-24: lane 1b review: the per-frame negative inset made the scale jump when the visible min crossed zero; replaced by `BarStaticInput.hasNegatives` (decided once per race from the matrix), which shifts `plot.x`. Period labels reuse the matrix's `sortKey` instead of re-parsing.
- 2026-11-24: lane 1a review: entering/exiting keys now pin raw rank to `top` around first/last presence so they enter and leave at the fold; unparseable periods and missing keys warn; mixed year/date periods use epoch-ms sortKeys.
- 2026-11-24: phase 1 boundary review (opus), five findings accepted: colors become theme-independent slots resolved in layout; `RaceLayoutBase` carries `colors` and truncated `labels`; mark registry drops `measure` for `computeStatic(..., measureText)`; race validation checks fields exist in data; interpolation moves to `race/interpolate.ts`.
- 2026-11-24: lane 2a review: mark registry builds layouts from the contract entry only (no private createLayout); `RaceModel.frameColors` (spec-theme colors) back `raceFrameAt`, on-screen colors stay on the layout; onWarn adapter cached per sink. Phase 1 issues found during 2a fixed in the same follow-up: domain covers every emitted value, null label/color encodings are validation errors, `RaceBarStatic.cornerRadius`, value gutters measured at display precision and capped so the plot keeps 40%, tick band sized from the theme.
- 2026-11-24: lanes 2a and 2b both added the same optional `measureText` field to `RaceLayoutBase`; the git auto-merge kept both copies, and the duplicate was removed after the merge. Core `race.ts` is listed only under lane 2a's owned files.
- 2026-11-24: phase 4 base added before the lanes: the scaffolded table cells (`string[]`) could not carry the inline bar, color chip or change arrow, and the line head label lacked a value, so the shared types change once, up front. RFC's `on('period')` was missing from `RaceInstance` and is added (React `onPeriod` in phase 5 needs it); `seekTo` dropped from v1. The `Marks` switcher story moves to phase 6 with the gallery.
- 2026-11-24: user asked for a docs page in the Astro site (`site/`) with interactive examples, landed by a Codex lane once the feature is ready: lane 6b replaces the planned `docs/race.md`. User also asked for a ce:design polish pass on the race UI.
- 2026-11-24: ce:design pass on the race UI (user request): the playback strip was restyled in a separate Codex run (foreman/race-polish, merged into phase 3). Styled scrubber with a played portion, SVG icon button, strip aligned to the chart inset, fixed-width readout.
- 2026-11-24: lane 5b brief written. The table mark renders HTML, so GIF export covers bar and line and rejects for table in v1. 5b takes `race-mount.ts` and its test, so it starts after lane 4c merges.
