# Plan: playback charts (animated bubbles, time-lapse maps, population pyramids)

Skill: sprint. Profile: sprint. On resume, re-read shared/lane-dag.md before anything else.
plan_graph: /Users/riley/.claude/plugins/cache/claude-essentials/ce/6.0.4/shared/scripts/plan_graph.py
Started: 1795592448 (2026-11-25). Timebox: none. Landing branch: sprint/playback (worktree /Users/riley/Projects/.openchart-worktrees/sprint-playback). Done: 2026-11-25, merged to main and released as 9.2.0.
Gate: `bun run build && bun run test && bun run typecheck && bun run lint && bun run check:generated` (see Log for timing). Filtered tests: `bunx vitest run <path-or-dir>` from the repo root. Typecheck: `bun run --filter '@opendata-ai/openchart-<pkg>' typecheck` per touched package.
Runner: plain commands.
Worktree setup: `bun install --frozen-lockfile && bun run build`. Packages resolve each other through `dist/`, so after editing `packages/core` run `bun run --filter '@opendata-ai/openchart-core' build` before engine or vanilla tests (and engine's build before vanilla tests when engine changed).
Suppressions: biome-ignore, @ts-expect-error, @ts-ignore, it.skip, describe.skip, it.only, describe.only, test.skip, test.only
Manifests: bun.lock

Source RFC: `plans/rfc-playback-charts.md` (copied into this branch). The RFC is the spec. Section numbers below refer to it.

## Spec

`encoding.time` on point, circle and bar charts, geo maps (fills and the points layer) and tile maps turns them into playback charts driven by a shared `playback` block, using the race's clock, controls, accessibility and GIF export pulled into a shared layer. Mirrored bars (`mark: { type: "bar", mirror: true }`) add static and animated population pyramids. Readers are newsroom developers embedding interactives, social teams exporting clips, and agents writing specs.

In scope: everything in the RFC sections 2 to 6.1, including docs and blog posts.
Decisions from the grill (2026-11-25):
- Pyramid demo data: a trimmed UN World Population Prospects fixture (Japan, 5-year age groups by sex, 1950 to 2100) in `examples/src/data/`, downloaded from population.un.org (user approved).
- After the merge: release 9.2.0 with `node scripts/release.mjs minor` and a reviewed root CHANGELOG entry, then push main (Cloudflare deploys the site on push).
- Instance API: `chart.playback.play()` (RFC open question 2, option recommended).
- The race accepts a top-level `playback` block for its timing fields as well as `race` (RFC open question 1). Setting the same field in both is a validation error.
- Landing branch `sprint/playback`; no timebox.
Assumptions (defaulted, user can override): `mirror` as a bar mark option (RFC Q3); trails off by default (Q4); auto-placed annotations fixed against the final period (Q5).
Out of scope: the RFC's v1 non-goals (line/area with time, canvas during playback, time-proportional spacing, hover trails, reference-year outline, map camera moves during playback, MP4, faceted playback).
Error model: spec problems go through `validateSpec` as errors (thrown from compile as the existing validation error) or warnings (returned in the compile result's warnings and logged by mounts as today). Data problems found while building the matrix throw `PlaybackDataError` with a `code` (`DUPLICATE_KEY_PERIOD`, `TOO_FEW_PERIODS`, `NO_VALUES`); `RaceDataError` extends it. For charts and maps, fewer than two periods is a warning and a static render (RFC 4.4), so only the race throws `TOO_FEW_PERIODS`/`NO_VALUES`. Runtime: `seek` clamps, calls after `destroy()` are no-ops, `update()` with an invalid spec throws and leaves the current playback untouched, a failed GIF export rejects with the existing export error types.

## Contracts (scaffold commit)

Core types (`packages/core/src/types/spec.ts`, `encoding.ts`, exported from `types/index.ts` and the package index):

    PlaybackConfig { duration?, step?, gaps?, holdEnd?, loop?, autoplay?, controls?,
                     period?: false | { format?: string; position?: 'auto' | 'center' | 'top-right' | 'bottom-left' },
                     labels?: string[], trails?: boolean | string[] }
    PlaybackTimingConfig = Pick<PlaybackConfig, 'duration'|'step'|'gaps'|'holdEnd'|'loop'|'autoplay'|'controls'|'period'>
    ChartSpec.playback?: PlaybackConfig; GeoMapSpec.playback?; TileMapSpec.playback?; RaceSpec.playback?: PlaybackTimingConfig
    BarEncoding.time?, PointEncoding.time?, CircleEncoding.time?: EncodingChannel (type temporal | ordinal | quantitative)
    MARK_ENCODING_RULES bar/point/circle: time: optional('temporal','ordinal','quantitative')
    Bar mark def: mirror?: boolean
    GeoMapEncoding.time?, TileMapEncoding.time?, GeoMapPointsLayer.time?: EncodingChannel

Layout (new modules; existing race modules keep their race-only logic):

    packages/engine/src/playback/
      index.ts           re-exports; wiring only
      errors.ts          PlaybackDataError (code, message)
      periods.ts         readPeriod, orderPeriods (moved from race/matrix.ts; adds ordinal sort "descending")
      matrix.ts          buildPlaybackMatrix: keys x periods x channels Float64Arrays, static per-key fields, gap fill, log-aware fill
      interpolate.ts     interpolatePlaybackValue (moved from race/interpolate.ts), plus log-space variant
      options.ts         resolvePlayback(block, periodCount): timing defaults shared with the race
      period-labels.ts   formatPeriodLabels (moved from race/period-labels.ts)
    packages/engine/src/compiler/validation/playback.ts   validatePlaybackBlock(blockName, value): shared timing-field checks
    packages/vanilla/src/playback/
      types.ts           PlaybackController (play, pause, seek, setSpeed, getState, on), PlaybackState
      clock.ts           createPlaybackClock (moved from race/clock.ts)
      controls.ts        createPlaybackControls({ classPrefix, ... }) (moved from race/controls.ts)
      announcer.ts       createPlaybackAnnouncer({ host, describe(t) }): live region + announce-on-pause/seek/step
      export-gif.ts      exportPlaybackGIF({ svg, draw(t), durationMs, holdEndMs, styleSelectors, paletteSeed }, options)
      session.ts         createPlaybackSession(): clock + controls + announcer + whenSeen autoplay + reduced-motion stepping
    packages/core/src/styles/playback.css   control rules with .oc-race-* and .oc-playback-* selectors

Phase 2+ modules (stubbed in their phase scaffold): `engine/src/playback/{freeze,chart-playback,map-playback,trails}.ts`, `engine/src/charts/bar/mirror.ts`, `engine/src/compiler/validation/{time,mirror}.ts`, `vanilla/src/playback/{chart-frames,map-frames,tooltip}.ts`.

## Phases

### Phase 1: shared playback layer (MVP)

Scaffold: 6bff02f330447e07fbf3c8633fe05030f5d73861
Tag: playback-phase-1
Demo: `bun run dev`, open the race stories: unchanged. A race spec with `playback: { duration: 12000, loop: true }` instead of `race.duration` plays for 12s and loops.
Test cases:
- Every existing race unit test, race e2e spec and race visual baseline passes with no assertion changes (moved tests change import paths only).
- `buildPlaybackMatrix` with channels x and y: one Float64Array per key per channel, NaN for absent cells; static fields take the last non-null value in time.
- Gap fill per channel: interpolate (linear), hold, drop; leading and trailing gaps never filled.
- Log channel: interpolate fills geometrically (1 and 100 around a one-period gap give 10); values <= 0 become absent and are counted in the result's `nonPositiveCounts[channel]`.
- `interpolatePlaybackValue` log variant: midpoint of 1 and 100 is 10; NaN neighbour returns NaN.
- `orderPeriods` with ordinal `sort: "descending"` reverses first-seen order; sort arrays still win.
- `PlaybackDataError` carries `code`; `new RaceDataError(...) instanceof PlaybackDataError`.
- `resolvePlayback`: defaults (holdEnd 1500, loop false, autoplay "visible", controls true, gaps "interpolate"); duration defaults to periods x 700 clamped to 8000..90000; step gives duration = step x (periods - 1) (match the race's current rule exactly).
- Race with `playback.duration` behaves like `race.duration`; `race.duration` and `playback.duration` together is an error at `/playback/duration` naming both; `playback.labels` or `playback.trails` on a race is an error.
- `validatePlaybackBlock('playback', ...)`: unknown key error path `/playback/<key>` and message "Unknown playback option"; the race's own messages are unchanged.
- `createPlaybackControls({ classPrefix: 'oc-playback' })` emits `oc-playback-*` classes; with `oc-race` the DOM is identical to today's race controls.
- `createPlaybackAnnouncer` announces `describe(t)` on pause, seek and step only, never during play.
- `exportPlaybackGIF` calls `draw(t)` once per frame at `fps` over `durationMs + holdEndMs` and honors `loop`, `dpi`, `backgroundColor`.
- `createPlaybackSession`: autoplay "visible" starts when seen; reduced motion forces no autoplay and opens on the final period; destroy stops the clock.

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | packages/engine/src/playback/, packages/engine/src/race/matrix.ts, packages/engine/src/race/interpolate.ts, packages/engine/src/race/period-labels.ts, packages/engine/src/race/errors.ts, packages/engine/src/race/normalize.ts, packages/engine/src/race/types.ts, packages/engine/src/race/timeline.ts, packages/engine/src/race/prepare.ts, packages/engine/src/race/__tests__/, packages/engine/src/compiler/validation/race-options.ts, packages/engine/src/compiler/validation/playback.ts, packages/engine/src/compiler/validation/__tests__/ | contracts, RFC 4.1 | packages/engine/src/playback/__tests__/ | opus | merged | sprint/playback-1a | engine playback + race tests pass |
| b | M | packages/vanilla/src/playback/types.ts, packages/vanilla/src/playback/period-events.ts, packages/vanilla/src/playback/clock.ts, packages/vanilla/src/playback/controls.ts, packages/vanilla/src/playback/session.ts, packages/vanilla/src/playback/session-clock.ts, packages/vanilla/src/playback/session-view.ts, packages/vanilla/src/race/__tests__/race-playback.test.ts, packages/vanilla/src/race/clock.ts, packages/vanilla/src/race/controls.ts, packages/vanilla/src/race/size.ts, packages/vanilla/src/race/shell.ts, packages/vanilla/src/race/__tests__/clock.test.ts, packages/vanilla/src/race/__tests__/controls.test.ts, packages/vanilla/src/race-mount.ts, packages/core/src/styles/playback.css, packages/core/src/styles/race.css, packages/core/src/styles/index.css | contracts, RFC 4.1 | packages/vanilla/src/playback/__tests__/clock.test.ts, packages/vanilla/src/playback/__tests__/controls.test.ts, packages/vanilla/src/playback/__tests__/session.test.ts | opus | merged | sprint/playback-1b | session, clock, controls and race mount tests pass |
| c | M | packages/vanilla/src/playback/announcer.ts, packages/vanilla/src/playback/export-gif.ts, packages/vanilla/src/playback/frame-styles.ts, packages/vanilla/src/playback/__tests__/export-gif-limits.test.ts, packages/vanilla/src/race/a11y-dom.ts, packages/vanilla/src/race/export.ts, packages/vanilla/src/race/__tests__/a11y-dom.test.ts, packages/vanilla/src/race/__tests__/export.test.ts | contracts, RFC 4.1 | packages/vanilla/src/playback/__tests__/announcer.test.ts, packages/vanilla/src/playback/__tests__/export-gif.test.ts | opus | merged | sprint/playback-1c | announcer and GIF tests pass |

#### Lane a brief

- Goal: move the race's period, matrix, interpolation, label and error code into `packages/engine/src/playback/` and generalize the matrix to several channels; have the race consume it with byte-identical output; let the race accept a `playback` block.
- Scaffold notes: the scaffold's signatures win over this brief where they differ (`buildPlaybackMatrix(rows, options, gaps, warn)` with `requireTwoPeriods` and `noun` options; `resolvePlayback(block, periodCount, blockName)`). The race's 500-key warning must stay byte-identical: if `noun` can't reproduce it, keep the race's text in `buildRaceMatrix`. Keys order in the matrix follows the scaffold tests; `buildRaceMatrix` must keep the race's current key order if it differs. The five tests in `engine/src/race/__tests__/playback-block.test.ts` are yours to make pass (read-only).
- Interface: implement the stubs in `engine/src/playback/*.ts` and `compiler/validation/playback.ts` exactly as typed in the scaffold. `race/matrix.ts` keeps `buildRaceMatrix` as a thin wrapper over `buildPlaybackMatrix` with one channel (value), so race callers don't change. `race/interpolate.ts` and `race/period-labels.ts` re-export from playback or are removed with their imports updated (your choice; keep it the smaller diff). `RaceDataError extends PlaybackDataError`.
- Behavior: the test-case list for phase 1, engine items. The race's 500-key warning text and every race validation message stay byte-identical (existing tests pin them). The shared validator takes the block name for paths and messages. A race spec merges `playback` timing fields under its `race` fields in `normalizeRaceSpec`; the same field in both is an error at `/playback/<field>`: "Spec error: <field> is set in both race and playback". `playback.labels`/`playback.trails` on a race: error at `/playback/<field>`, "Spec error: playback.<field> applies to point and circle charts only".
- Decisions already made: log-space fill and interpolation use exp(lerp(log a, log b)); values <= 0 on a log channel are absent; channels are named strings chosen by the caller with a per-channel `log` flag.
- Out of scope: freeze, chart or map playback compiles, vanilla anything.
- Done when: `bunx vitest run packages/engine/src/playback packages/engine/src/race packages/engine/src/compiler/validation` passes and `bun run --filter '@opendata-ai/openchart-engine' typecheck` passes.

#### Lane b brief

- Goal: move the race's clock and controls into `packages/vanilla/src/playback/`, add `createPlaybackSession`, and rewire `race-mount.ts` onto it with byte-identical race DOM and pixels. Lane c owns the announcer and GIF export split; `race-mount.ts` keeps calling `createRaceA11y` and `exportRaceGIF` with their current signatures.
- Interface: implement `vanilla/src/playback/{types,clock,controls,announcer,export-gif,session}.ts` as typed in the scaffold. The race keeps `createRaceA11y` (leaders, hidden table) built on the announcer with `describe(t)` wrapping `raceA11yLeaders`, and `exportRaceGIF` as a wrapper over `exportPlaybackGIF` passing `dpi: 1`, its hold and `.oc-race-*` style selectors as defaults. `RaceInstance` keeps every method; its controller methods come from the session.
- Behavior: the test-case list for phase 1, vanilla items (RFC 4.1 bullets). Control CSS moves to `core/src/styles/playback.css` with each selector listing both prefixes, imported where `race.css` is imported today; `race.css` keeps race-only rules.
- Scaffold notes: the scaffold's session signature wins (`createPlaybackSession({ container, timing, periodLabels, periodAt, draw, describe?, classPrefix?, animate?, initialState?, scheduler?, reducedMotion?, whenSeen? })` returning the controller plus `attach`, `controlsElement`, `retime`, `getClockState`, `destroy`). The session calls `createPlaybackAnnouncer` (lane c implements it); until lane c lands it throws, so make the session construct the announcer only when `attach` gets an announcer host, and keep the race's a11y on `createRaceA11y` in this lane.
- Decisions already made: class prefix is a parameter, default `oc-playback`; the race passes `oc-race`. Reduced-motion stepping and whenSeen autoplay move into the session unchanged.
- Out of scope: chart or map mounts, `ChartInstance.playback` (stays null this phase).
- Done when: `bunx vitest run packages/vanilla/src/playback/__tests__/clock.test.ts packages/vanilla/src/playback/__tests__/controls.test.ts packages/vanilla/src/playback/__tests__/session.test.ts packages/vanilla/src/race packages/vanilla/src/__tests__/font-race.test.ts` passes (announcer and export-gif tests belong to lane c and may still fail) and `bun run --filter '@opendata-ai/openchart-vanilla' typecheck` passes.

#### Lane c brief

- Goal: split the generic parts out of `race/a11y-dom.ts` and `race/export.ts` into `vanilla/src/playback/announcer.ts` and `vanilla/src/playback/export-gif.ts`, keeping `createRaceA11y` and `exportRaceGIF` signatures and output byte-identical.
- Interface: implement `createPlaybackAnnouncer` and `exportPlaybackGIF` as typed in the scaffold (it deviates from the plan: `exportPlaybackGIF` takes `draw(t, frame)` and `periodCount` and draws on an SVG clone; the announcer is `notify(cause, state)` with `attach`/`destroy`). `createRaceA11y` builds on the announcer with `describe(t)` wrapping `raceA11yLeaders`; leaders logic and the hidden table stay in `race/a11y-dom.ts`. `exportRaceGIF` wraps `exportPlaybackGIF` passing `dpi: 1`, the race hold and `.oc-race-*` style selectors as defaults.
- Behavior: the phase 1 test cases for the announcer and GIF export (fps, dpi, loop, embedFonts, backgroundColor, theme; durationMs replaces the playback duration and the hold is added after it).
- Out of scope: clock, controls, session, race-mount.
- Done when: `bunx vitest run packages/vanilla/src/playback/__tests__/announcer.test.ts packages/vanilla/src/playback/__tests__/export-gif.test.ts packages/vanilla/src/race/__tests__/a11y-dom.test.ts packages/vanilla/src/race/__tests__/export.test.ts packages/vanilla/src/race/__tests__/race-mount.test.ts` passes and the vanilla typecheck passes.

Landing check for phase 1 (orchestrator): full gate plus `bunx playwright test --project=visual --grep race` and the race e2e specs; the demo story (`examples/src/testing/race.stories.tsx` gains a `playback`-block story) is written inline at landing.

### Phase 2: bubble scatter playback

Scaffold: 9dc5884d901f22da4c784d87a9781cad6a50c5c8
Tag: playback-phase-2
Demo: `bun run dev`, story "Testing / Playback / Wealth and health" (written inline at landing from `wealthHealthHistory`): plays 1960 to 2023 on a log x axis with region colors, scrubs, steps by keyboard, exports a GIF; axes and legend never move.
Depends on: phase 1

Phases 2 and 3 run concurrently. Both scaffolds land on the landing branch before either starts and own the shared wiring: the hooks in `packages/engine/src/compiler/validation/chart.ts` (calls into `validation/time.ts` and `validation/mirror.ts`), in `packages/engine/src/compile.ts` / `compile/chart.ts` (time specs route to `compile-chart-time.ts`; mirror routes axes and legend to `charts/bar/mirror.ts`), and in `vanilla/src/mount.ts` only where a stub call is needed. No lane edits those hook lines.

Contracts (phase 2 scaffold):

    engine/src/playback/freeze.ts        buildEnvelopeSpec(spec, matrix) -> ChartSpec; freezeChartFrame(spec, options, matrix) -> FrozenChartFrame
                                         FrozenChartFrame { layout: ChartLayout (marks empty), scales: ResolvedScales, chartArea: Rect,
                                         labelPlan?: BarLabelPlan, theme: ResolvedTheme, pointOpacity: number, formatters: Record<field, (v:number)=>string> }
    engine/src/playback/chart-playback.ts compileChartPlayback(spec, options) -> ChartPlayback
                                         ChartPlayback { frame, base: ChartLayout, periods: PlaybackPeriod[], periodLabels: string[],
                                         timing: ResolvedPlayback, keys: string[], warnings: string[],
                                         marksAt(t): FrameMark[]  // one per base key, base order
                                         trailsAt(t): TrailPath[]; observedAt(key, t): ObservedValues | null; describe(t): string }
                                         FrameMark { key: string; mark: Mark; presence: number /* 0..1 fade multiplier */ }
                                         ObservedValues { periodLabel: string; filled: boolean; values: Record<field, string> }
    engine/src/playback/trails.ts        trailsAt(matrix, frame, keys, t) -> TrailPath[]  // TrailPath { key, points: Point[], head: Point }
    engine/src/compile-chart-time.ts     compileTimeChart(spec, options) -> ChartLayout  // base layout with marks at the final period; compileChart calls it for time specs
    engine/src/compiler/validation/time.ts validateTimeEncoding(spec, errors)  // RFC 2.7 errors; warnings are produced by compileChartPlayback
    vanilla/src/playback/chart-frames.ts createChartFrameWriter(svg, playback) -> { draw(t): void; destroy(): void }  // matches [data-key], never data-mark-id
    vanilla/src/playback/tooltip.ts      playbackTooltip(playback, key, t) -> TooltipContent
    vanilla/src/playback/chart-session.ts mountChartPlayback({ container, svg, playback, darkMode, reducedMotion?, whenSeen? }) -> { controller: PlaybackController; draw(t); destroy() }
    vanilla/src/chart-sizing.ts          createChartSizer(container, { reservedHeight? })

Test cases (phase 2 scaffold writes them):
- Spike (lane a, first): frozen non-mark layout identical object for t = 0, 0.5, 1; `marksAt(p)` at integer p equals `compileChart` point geometry for that period's rows compiled with the envelope's scales; 200-key `marksAt` under 2ms (median of 50 runs, generous CI factor documented).
- Axes: x domain from the envelope with nice rounding (log axis ticks at powers of ten), y domain the same for every t; an authored `scale.domain` still wins.
- Ordinal color: a region absent in some periods keeps every other region's color.
- Opacity: fixture whose key count crosses 200 between periods keeps one opacity.
- Trendline: off by default with time; authored trendline is a validation error.
- Gaps: interpolate fills interior gaps (no fade); drop fades out and in; log channel fills geometrically; values <= 0 on log x warn with a count.
- Enter/exit: key absent after period i fades over the first half of (i, i+1); key first seen at i+1 fades in over the second half; presence is a pure function of t.
- Text: formatter resolved once over all values (same SI suffix and precision every frame).
- Labels: `playback.labels` keys always carry a label; no other point labels.
- Trails: `trails: ['A']` gives A's path through observed period positions up to t plus the head at the current position; `true` above 30 keys warns.
- Public compile: `compileChart` on a time spec returns marks for the final period only (one mark per key present there); `renderStaticSVG` with `t` picks that frame.
- Validation: time on line/area/arc errors naming point, circle, bar; time without key on point/circle errors; duplicate key+period errors; time with facet / layer / youDrawIt errors; aggregate that drops the time field errors; fewer than two periods warns and renders static.
- Warnings: >1000 marks per period, irregular temporal spacing, <50ms per period, matrix > 2,000,000 cells.
- Frame writer: writes cx/cy/r/opacity for each `[data-key]` element from `marksAt(t)`; unknown keys ignored; never touches elements without data-key.
- Tooltip: nearest period's observed values labelled with the period; gap-filled period says so.
- Session: controls strip below the SVG; reduced motion opens on the final period with no autoplay; `animation: false` same; edit gesture pauses.
- Sizer: `reservedHeight` subtracts from explicit-height hosts; auto-height latch holds with the strip present.
- Mount: `chart.playback` non-null for a time spec and null otherwise; listeners survive a compatible `update()`; incompatible update resets to start; `update()` adding time creates the controller, removing it returns null; canvas renderer request on a time spec warns and renders SVG; `export('csv')` returns every period; entrance animation off.

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | L | packages/engine/src/playback/freeze.ts, packages/engine/src/playback/chart-playback.ts, packages/engine/src/playback/frame-sampler.ts, packages/engine/src/playback/chart-warnings.ts, packages/engine/src/playback/__tests__/chart-playback-warnings.test.ts, packages/engine/src/compile-chart-time.ts, packages/engine/src/charts/scatter/ | contracts, RFC 3, 4.2, Code seams | packages/engine/src/playback/__tests__/freeze.test.ts, packages/engine/src/playback/__tests__/chart-playback.test.ts, packages/engine/src/__tests__/compile-chart-time.test.ts | opus | merged | sprint/playback-2a | spike + engine chart playback tests pass |
| b | M | packages/engine/src/compiler/validation/time.ts, packages/engine/src/playback/trails.ts, packages/engine/src/compile/spec-sugar.ts, packages/engine/src/compile/__tests__/playback-warnings.test.ts | contracts, RFC 2.7 | packages/engine/src/compiler/validation/__tests__/time.test.ts, packages/engine/src/playback/__tests__/trails.test.ts, packages/engine/src/compile/__tests__/playback-warnings.test.ts | sonnet | merged | sprint/playback-2b | validation and trails tests pass |
| c | M | packages/vanilla/src/playback/chart-frames.ts, packages/vanilla/src/playback/tooltip.ts | contracts | packages/vanilla/src/playback/__tests__/chart-frames.test.ts, packages/vanilla/src/playback/__tests__/tooltip.test.ts | sonnet | merged | sprint/playback-2c | frame writer and tooltip tests pass |
| d | L | packages/vanilla/src/__tests__/mount-playback-compiles.test.ts, packages/vanilla/src/playback/chart-session.ts, packages/vanilla/src/playback/chart-playback-host.ts, packages/vanilla/src/playback/chart-tooltips.ts, packages/vanilla/src/playback/chart-update.ts, packages/vanilla/src/playback/controller-relay.ts, packages/vanilla/src/playback/frame-layout.ts, packages/vanilla/src/playback/playback-compiler.ts, packages/vanilla/src/playback/series-hiding.ts, packages/vanilla/src/playback/chart-trails.ts, packages/vanilla/src/playback/__tests__/chart-trails.test.ts, packages/vanilla/src/playback/session.ts, packages/vanilla/src/playback/session-clock.ts, packages/vanilla/src/__tests__/mount-playback-rfc.test.ts, packages/vanilla/src/chart-sizing.ts, packages/vanilla/src/mount.ts, packages/vanilla/src/mount-types.ts | contracts, RFC 4.4, Code seams | packages/vanilla/src/playback/__tests__/chart-session.test.ts, packages/vanilla/src/__tests__/chart-sizing-reserved.test.ts, packages/vanilla/src/__tests__/mount-playback.test.ts | opus | merged | sprint/playback-2d | session and sizer tests pass; mount tests pass after a and c land |
| e | M | packages/engine/src/playback/overlays.ts, packages/engine/src/playback/__tests__/overlays.test.ts, packages/engine/src/charts/scatter/playback-labels.ts, packages/engine/src/playback/chart-playback.ts, packages/engine/src/playback/chart-types.ts, packages/engine/src/compile-chart-time.ts, packages/vanilla/src/playback/chart-frames.ts, packages/vanilla/src/playback/__tests__/chart-frames-overlays.test.ts | contracts, RFC 2.6 | packages/engine/src/playback/__tests__/overlays.test.ts, packages/vanilla/src/playback/__tests__/chart-frames-overlays.test.ts | opus | merged | sprint/playback-2e | period label and playback.labels drawn live and in static renders |

### Phase 3: static mirrored bars

Scaffold: 9dc5884d901f22da4c784d87a9781cad6a50c5c8
Tag: playback-phase-3
Demo: story "Testing / Pyramid / Japan 2025" (static, from `japanPopulation` filtered to 2025): men left, women right, ages in the center gutter, absolute-value ticks both sides.
Depends on: phase 1

Contracts (phase 3 scaffold): `engine/src/charts/bar/mirror.ts` exports `mirrorGeometry(chartArea, categoryLabels, measureText, theme) -> { gutter: {start, end}, left: {start, end}, right: {start, end} }`, `computeMirrorMarks(spec, scales, chartArea, ...)` (ChartRenderer shape; returns rects plus text marks for category labels in the gutter and the two half labels) and `mirrorAxisTicks(scales.x, geometry) -> AxisTick[]`; `compiler/validation/mirror.ts` exports `validateMirror(spec, errors)`. Scaffold hooks: renderer key `bar-mirror` registered and chosen when `mark.mirror`; `computeAxes` uses `mirrorAxisTicks` and hides the y axis when mirrored; legend suppressed when mirrored; stack default resolves to none when mirrored.

Test cases: first color value left, second right (by color sort, else first seen); one symmetric domain [0, max]; ticks on both halves with absolute labels and 0 at each inner edge; gutter width from the widest category label; category labels centered in the gutter; half labels above the plot; no legend; value labels outside on the outer end; errors: color field without exactly two values, vertical bars, authored `stack` (any value) with mirror; mirror without color errors.

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | packages/engine/src/charts/bar/mirror.ts, packages/engine/src/compiler/validation/mirror.ts, packages/engine/src/charts/bar/label-plan.ts, packages/engine/src/layout/plan.ts, packages/engine/src/charts/bar/mirror-labels.ts, packages/engine/src/charts/bar/__tests__/mirror-layout.test.ts | contracts, RFC 2.4 | packages/engine/src/charts/bar/__tests__/mirror.test.ts, packages/engine/src/compiler/validation/__tests__/mirror.test.ts, packages/engine/src/charts/bar/__tests__/mirror-layout.test.ts | opus | merged | sprint/playback-3a | mirror tests pass |

### Phase 4: time-lapse maps and the animated pyramid

Demo: unemployment tile map and choropleth playing through 2020; Japan pyramid 1950 to 2100.
Depends on: phase 2, phase 3

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | L | packages/engine/src/playback/map-playback.ts, packages/vanilla/src/playback/map-frames.ts, packages/vanilla/src/map-mount.ts, packages/vanilla/src/tilemap-mount.ts, packages/engine/src/geo/compile-geo-map.ts, packages/engine/src/compiler/validation/geo-time.ts, examples/src/testing/map-playback.stories.tsx, examples/src/data/insured-unemployment-2020.ts, packages/engine/src/tilemap/compile-tilemap.ts, packages/engine/src/compiler/validation/geo-map.ts, packages/engine/src/compiler/validation/tilemap.ts, packages/vanilla/src/map-renderer.ts, packages/vanilla/src/tilemap-renderer.ts, packages/engine/src/playback/__tests__/map-playback.test.ts, packages/vanilla/src/playback/__tests__/map-frames.test.ts, packages/vanilla/src/__tests__/map-playback-mount.test.ts, packages/engine/src/playback/index.ts, packages/engine/src/playback/map-geo.ts, packages/engine/src/playback/map-period-placement.ts, packages/engine/src/playback/map-run.ts, packages/engine/src/playback/map-series.ts, packages/engine/src/playback/map-tile.ts, packages/engine/src/playback/map-types.ts, packages/vanilla/src/playback/map-adapters.ts, packages/vanilla/src/playback/map-overlays.ts, packages/vanilla/src/playback/map-playback-host.ts, packages/vanilla/src/playback/map-session.ts | contracts, RFC 3.3 | packages/engine/src/playback/__tests__/map-playback.test.ts, packages/vanilla/src/playback/__tests__/map-frames.test.ts | opus | merged | sprint/playback-4a | map playback tests pass |
| b | M | packages/engine/src/playback/bar-playback.ts, examples/src/testing/pyramid-playback.stories.tsx, examples/src/data/japan-population.ts, packages/engine/src/playback/chart-warnings.ts, packages/engine/src/playback/__tests__/chart-playback-warnings.test.ts, packages/engine/src/playback/__tests__/bar-playback.test.ts, packages/engine/src/charts/bar/mirror.ts, packages/engine/src/playback/freeze.ts, packages/engine/src/charts/bar/__tests__/mirror-layout.test.ts, packages/engine/src/playback/__tests__/freeze.test.ts | contracts | packages/engine/src/playback/__tests__/bar-playback.test.ts | opus | merged | sprint/playback-4b | pyramid playback tests pass |

### Phase 5: wrappers, docs, blog, gallery, baselines

Demo: site dev server shows the new docs pages, blog posts and gallery entries.
Depends on: phase 4

| Lane | Size | Owns files | Reads | Tests | Model | Status | Branch | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| a | M | packages/react/src/, packages/vue/src/, packages/svelte/src/ | contracts | | sonnet | merged | sprint/playback-5a | wrapper ref tests pass |
| b | M | site/src/content/docs/ | RFC 6.1 | | opus | pending | | docs pages build |
| c | M | site/src/content/blog/ | RFC 6.1 | | opus | pending | | posts build |

## Log

- 2026-11-25: grill settled (see Spec). Gate timing: test 61s, typecheck 4s (incremental), lint 1s, build ~25s.
- Plan critique (sonnet): split vanilla lane into b and c (applied); scaffold must give lane b typed signatures (scaffold agent writes them); demo had no owner (now inline at landing); phase 2/3 shared wiring files (moved to scaffolds); extra test cases sent to the scaffold (RangeError on step overflow, DUPLICATE_KEY_PERIOD, conflict under playback name, warning noun, embedFonts/theme).
- Demo data fixtures written inline from OpenData (worldbank x3, dol/weekly-claims) and the UN WPP 2024 CSV: examples/src/data/{wealth-health-history,insured-unemployment-2020,japan-population}.ts.

- 2026-11-25: final review in two parts (engine/core, vanilla/wrappers), 14 findings, all accepted. Engine fixes (sprint/playback-rf-engine): trails on non-quantitative axes rejected, mirror side count after transforms, row/column facets rejected, floor(t) for map label and describe, static fades on every mark type, playback-without-time warning on maps, bar noun in describe, one bar identity key and one duplicate-cell check, negative duration clamp, collision-aware name labels. Vanilla fixes (sprint/playback-rf-vanilla): listener isolation and deferred catch-up, memoized frame layout, bar tooltip titles from values, map GIF timing, mirror-only clip widening, shared update rules. Lane 5d found live bars never moved during playback (geometry written on the keyed <g>); fixed with chart-bar-frames.ts. 5d: gallery entries plus six fixed-t baselines. Tagged playback-phase-4, playback-phase-5, playback-final.

## Code seams for phases 2-4 (mapped 2026-11-25, packages/ paths)

- `compileChart` engine/src/compile.ts:75 -> `compileChartInternal` compile/chart.ts:97 (prepareChartSpec prepare.ts:72 -> validate/normalize compiler/index.ts:27 -> theme -> facet branch ~140 -> `layoutSingleChart` :200). Scales: `computeChartScales` chart.ts:341 (compile/chart-scales.ts:12). Axes :368, gridlines :413, marks `computeChartMarks` :416 (def :659; `getChartRenderer(resolveRendererKey(...))` :675-690). Time hook: envelope at top of `compileChartInternal`; frozen scales replace the `computeChartScales` result at :341.
- `ChartRenderer` charts/registry.ts:33 `(spec, scales, chartArea, strategy, theme, containerWidth, labelPlan?, measureText?) => Mark[]`. `computeScatterMarks` scatter/compute.ts:94; `computeBarMarks` bar/compute.ts:103.
- Validation: `validateSpec` compiler/validate.ts:317, chart branch :279 -> `validateChartSpec(spec, errors)` validation/chart.ts:31 (hooks after `validateFrame` :33). No warnings channel in validation: warnings come from `normalizeSpec(spec, warnings)` / `prepareChartSpec` (prepare.ts:94) and `emitSpecWarnings` compile/spec-sugar.ts:984. Time warnings go in normalize/prepare.
- Mark keys: PointMark layout.ts:526 / RectMark :404 `key?`; scatter keys compute.ts:212-225 (`encoding.key` or `${cat}|${x}`, dedupeKeys); bar `stampBarKeys` bar/compute.ts:~258 `${series}|${cat}`.
- vanilla mount.ts: `createChart` :116, sizer :166, `render()` :275-660 (SVG :349 `renderChartSVG`, tooltips :359-413 incl. voronoi :392 and keyboard :402), update :666, doUpdate :681, resize :781, destroy :850, instance :930.
- Geo: `compileGeoMap` geo/compile-geo-map.ts:239; ClassScale local :453/:468 (`classScaleForChannel`), fills in `buildQuantitativeMarks` :~2458 (`fill` :2495, `binIndex` :2496); layout keeps no ClassScale. Vanilla map-renderer.ts:238-245 `data-key`, `data-bin-index`; points `data-point-key` :313.
- Tile map: `compileTileMap` tilemap/compile-tilemap.ts:133, no ClassScale (opacity scale :282, fill :318, categorical :534, tile mark :746); vanilla tilemap-renderer.ts uses `data-state` :118, no data-key.
- Axis ticks: layout/axes/ticks.ts `continuousTicks` :207, `categoricalTicks` :323; `computeAxes` layout/axes.ts:501 (y ticks :751-773, x :559-565).
- Stories: examples/src/testing/race.stories.tsx pattern (useRef host, useVizTheme/useVizDarkMode, createRace in useEffect, window.__race); gallery examples/src/gallery/race.stories.tsx.
- 1/c lane review: 5 findings, all accepted and sent back to the lane (hold clamp, race error text, periodCount/duration validation, announce reuses the mount's frame, style snapshot split to playback/frame-styles.ts). Accepted lane choices 1-5 and 7 as reported; choice 6 reversed by finding 2.
- 1/a lane review: 4 findings. Accepted 1 (duration/step split across blocks), 3 (overflow error names the source block), 4 (non-positive count only for matrix rows); sent back. Finding 2 (ordinal descending now reverses race periods) kept as intended behavior per RFC 3.1; documented in CHANGELOG and RaceEncoding.time JSDoc at landing. Lane choices 1-5 accepted.
- 1/b lane review: 4 findings, all accepted and sent back (period emit deferred until the new view is in the DOM; session.start() after first render; `subject` option keeps "Race ..." RangeError text; session.ts split into period-events.ts + types.ts). Lane choice "animation:false never autoplays" confirmed unchanged for the race.
- Landing: 1a and 1c merged; race validation hook commit 2b399d35; descending JSDoc + PlaybackBlock story b789c123. Phase 2+3 scaffold being written on sprint/playback-scaffold-23 (from 02309950), merges after phase-1 tag. CHANGELOG must mention: ordinal `sort: "descending"` now reverses race periods.
- Phase 2+3 scaffold merged (9dc5884d901f22da4c784d87a9781cad6a50c5c8). 12 new test files fail, nothing else. Scaffold choices accepted: shared types in playback/chart-types.ts, hasTimeEncoding in playback/time-spec.ts, time routing in public compileChart, frameCapture out-param, mirror ticks via dataContext.mirrorXTicks, validateChartSpec context {inLayer}, CompileOptions.playbackT. Gaps assigned: mirror left-gutter + value-label plan reservation -> 3/a (owns widened, writes mirror-layout.test.ts); canvas refusal warning -> 2/d; 'playback without time' warning -> 2/b (spec-sugar.ts, playback-warnings.test.ts); 'controls:false with autoplay' warning -> 2/a (in compileChartPlayback warnings); 'bar sorted by value' warning -> 4/b. RFC 2.2 example fixed to mark point (circle is a dot plot and rejects quantitative y); docs must use point.
- 2026-11-25: 2/d and 2/e merged; trails added to frame layout/export (ff895f01); overlaysAt made required (39bdd11c). Phase 4 runs without a scaffold: bar time specs already go through compileChartPlayback, and nothing else in phase 4 consumes the map contract. 4/a Owns widened to the tilemap compile, map/tilemap validation and renderers; 4/b owns chart-warnings for the bar-sorted-by-value warning.
- 2026-11-25: gap found on the landing render: no lane owned the period label (RFC 2.6 `period`) and point `label` fields are never rendered by vanilla, so playback.labels drew nothing. Lane 2/e added (base 5b42b7cccaf3b8b8f84fca9b3a1628cf66d4eddf) with a separate overlaysAt(t) contract so 2/d's marksAt use is untouched.
- 2026-11-25: 2/e lane review: 8 findings, all accepted, sent to fix lane 2/f (sprint/playback-2f from 0355cce1): inert overlays (tooltip/emphasis), overlays in layoutAtPlayhead/export, periodInk on non-opaque backgrounds, label side fixed per run, plain bars resolve auto as center (pyramid only when mirror), shared paint-order helper, comment cleanup, stale/missing tests. Period label switched to floor(t) to match controls (3e980aa7). Phases 2 and 3 tagged at 3e980aa7. 5/a merged (0355cce1). Docs wave 1 (5b1) and blog wave 1 (5c1) dispatched for bubble/playback pages; maps/pyramid docs and posts wait for phase 4.
- 2026-11-25: 4/b merged (pyramid tests/story, mirror side order from scale.domain, stacked envelope per category's tallest period, warnFrozenValueSort). 2/f merged (391c5402). 2/f round 2: overlay-plan.ts split, exported label-key helpers, and 4/b's three outside-file bugs (non-key mirror marks kept in base, measureText threaded, warning hook).
- 2026-11-25: docs wave 1 merged. Gaps from it -> lane 2/g (sprint/playback-2g): chart playback GIF export (was still the entrance GIF), mobile trails check, catalog-pages, labels/trails JSDoc says point only. CSV export kept as spec.data (existing behavior for every chart; long-format rows already). Docs wave 2 must add playback GIFs to output/export once 2/g lands.
- 2026-11-25: 4/a merged and reviewed (12 findings, all accepted) -> fix lane 4/c (sprint/playback-4c from 24e2fdb0), plus smaller map period label. Live region printed visibly (announcer had no sr-only) fixed 4f8cac4e. Blog wave 1 merged; tier-1 labels for the three new datasets 24e2fdb0. Docs wave 2 (5b2) and blog wave 2 (5c2) dispatched from 4f8cac4e. Pending for 2/g round 2: static output (renderStaticSVG/compileChart) should draw trails when playback.trails is set; post 1 GIF paragraph and post 2 "trails are live-only" sentence need updating once GIFs and static trails land. Pre-existing facet bugs seen by blog lane (not playback): facet panels don't share size/color scales; x tick labels misplaced in a second facet column (layout/axes.ts ~395-402); default trendline per panel.
