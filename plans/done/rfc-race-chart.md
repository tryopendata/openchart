# RFC: Race charts (animated rankings over time)

Status: draft for review. Design mock: https://claude.ai/artifact/5HZ1vgcfyxkedjXDUDut4F
Date: 2026-11-24

## 1. Problem

The "bar chart race" is one of the most shared chart forms on social platforms: the largest companies on the S&P 500 from 1980 to 2026, the most-used programming languages since 2004, the biggest economies since 1960. A leaderboard of the top N items plays out over a fixed span, typically 15 to 60 seconds, and re-sorts smoothly as items overtake each other. The same story is told three ways: as bars that slide past each other, as lines that draw forward in time with labels at their heads, and as a table whose rows move up and down.

OpenChart can't make one today. The closest tool is `exportSpecSequence` with a timer calling `chart.update()` per period, which gives one eased tween per period, a stop-start rhythm, order that only changes at period boundaries, no scrubber, and no way to keep the playhead when switching chart type. Newsrooms and agents who want this form go to Flourish, which is not embeddable as a spec and not agent-writable.

Who it's for: newsroom developers embedding a race in an article, social teams exporting a clip, and agents generating a spec from a dataset. The agent case drives the API shape: an agent that has a long table of `(entity, period, value)` rows should be able to write the spec on the first try, and switching from bars to a table should be a one-field change.

What good looks like, from the research (section 9 lists sources):

- Motion is continuous and linear through time, with no stall at each period.
- Displayed order always agrees with displayed values: a shorter bar never sits above a longer one for long.
- Swaps have their own short duration, independent of how long a period lasts.
- Items enter and leave the top N by sliding through a slot just below the fold, never popping.
- The value axis rescales smoothly, never jumps.
- Value labels count up; the period label ticks with tabular numerals.
- Identity colors are stable for the whole run.
- There is a pause control and a scrubber (WCAG 2.2.2 requires pause for auto-playing motion over 5 seconds), reduced motion is respected, and a screen reader gets a static equivalent.
- Every frame is a pure function of the playhead, so scrubbing, reversing and GIF or video export produce identical frames.

### Non-goals for v1

Per-bar images (logos, flags), log scales, timed captions, a sliding-window line chart, mobile-specific vertical video layout, and MP4 export. Each is a plausible follow-up and none changes the core contracts.

## 2. How existing tools do it

| Tool | Rank source | Swap timing | Enter/exit | Axis | Notes |
| --- | --- | --- | --- | --- | --- |
| Bostock (Observable) | Re-rank interpolated values, k=10 frames per period | One 250ms frame | Sentinel rank `n`, slide from below | Rescale per frame, tweened | Linear easing, count-up labels via `textTween` |
| `bar_chart_race` (Python) | Ranks at real periods only, then lerp rank | Exactly one period | Rank clipped to `n_bars+1` | `fixed_max` option | Order can disagree with bar length mid-period |
| Flourish | Re-rank | Per-step duration | Slide | `auto` / `auto_fixed` / `manual`, `scale_min` | Most complete settings; `totaliser`, images, "Invalid cells" gap modes |
| ECharts | `realtimeSort` on update | Separate `yAxis.animationDurationUpdate: 300` | Slide | `max: 'dataMax'` | Only one with a swap duration separate from the step |
| Plotly / raceplotly | Per frame, no sub-frames | One tween per period | Pop | Fixed `range_x` | `animation_frame` + `animation_group` |
| Animated Vega-Lite (paper) | Per keyframe | Same as step | Poor | `rescale: true/false` | `encoding.time = {field, key, rescale}`; timer param |
| Vega-Lite (shipped, PR #8921) | n/a | Steps, no tweening | n/a | n/a | `time` channel, `on: "timer"`, `scale.animationDuration` |

Two families exist. Value interpolation with re-ranking (Bostock, ECharts) keeps order truthful and puts each swap at the moment values cross, but near-equal values that cross repeatedly make rows flicker. Rank interpolation (`bar_chart_race`, gganimate) is smoother but lies about order mid-period and makes every swap last a full period. We take the first family and fix its flicker (section 5.2).

No grammar has "rank and keep the top N" as a primitive; every race tool hard-codes it. That is the main argument for a dedicated spec type rather than a channel bolted onto `ChartSpec` (section 4.1).

## 3. The spec

```json
{
  "type": "race",
  "mark": "bar",
  "data": [
    { "country": "United States", "year": 1980, "gdp": 2857 },
    { "country": "Japan", "year": 1980, "gdp": 1129 }
  ],
  "encoding": {
    "time":  { "field": "year", "type": "temporal" },
    "key":   { "field": "country" },
    "value": { "field": "gdp", "type": "quantitative", "format": "$~s" },
    "color": { "field": "country" }
  },
  "race": { "top": 10, "duration": 30000 },
  "chrome": {
    "title": "The US has led every year since 1980. China took second in 2010",
    "subtitle": "Largest economies by GDP, current US dollars",
    "source": "World Bank"
  }
}
```

Switching to `"mark": "line"` or `"mark": "table"` changes nothing else. That is the design's central property.

### 3.1 Encoding

All channels are standard `EncodingChannel` definitions (`field`, `type`, `title`, `format`, `scale` where it applies), so an agent that knows Vega-Lite or the rest of OpenChart already knows how to write them.

`time` (required) is the playback field. Its name comes from Vega-Lite's shipped `time` channel and the Animated Vega-Lite paper. Types: `temporal` (dates or bare years), `ordinal` (sorted by `sort`, else first-seen order), `quantitative` (numeric sort). Periods are the distinct values, sorted.

`key` (required) is the identity that persists across periods: what is racing. Same meaning as the existing `ChartSpec` `key` channel and Vega-Lite's `key`, and the same role as Plotly's `animation_group`. Its value is the displayed name unless `label` is set.

`value` (required, quantitative) is what is ranked and drawn. Named `value` to match `BarListSpec`, since in a race it maps to x for bars, y for lines and a column for tables; using `x` or `y` would make the mark switch a re-encoding.

`color` (optional): a field (often the key itself, or a category such as region or sector) or a `{ value }` constant. Defaults to coloring by key with stable assignment in order of first appearance in the top N, so colors never reshuffle mid-run. Uses the theme's categorical palette and its extended ramp; above 12 keys colors repeat, which is acceptable because names are always direct-labelled.

`label` (optional, nominal): display name when the key is an ID (`"key": {"field": "ticker"}, "label": {"field": "company"}`). The last non-null label in time wins, so a renamed company shows its current name.

`description` and `tooltip` follow existing semantics.

### 3.2 `mark`

`"bar" | "line" | "table"`, or an object form `{ "type": "bar", ...markOptions }` matching how `ChartSpec` accepts `mark`. v1 mark options:

- bar: `cornerRadius`, `orient: "horizontal"` (vertical column races are a follow-up).
- line: `window: "reveal" | "all"`. `reveal` (default) expands the x domain from the start to the playhead; `all` fixes it to the full span and draws forward. A sliding `{ "periods": n }` window is a follow-up.
- table: `columns`, an ordered subset of `"rank" | "change" | "name" | "bar" | "value" | "share"`, defaulting to all six on desktop and dropping `bar` below 520px.

### 3.3 `race`

| Field | Type | Default | Meaning |
| --- | --- | --- | --- |
| `top` | number | 10 | Visible slots. Precedents: `n`, `n_bars`, `number_of_bars`. |
| `duration` | ms | `periods × 700`, clamped to 8–90s | Total playback length at 1× speed. Matches how people describe races ("30 seconds"). |
| `step` | ms | none | Per-period duration; mutually exclusive with `duration` (validation error if both). For authors who think per step, as `bar_chart_race`, Flourish and ECharts do. |
| `swap` | ms | 400 | How long a reorder takes, independent of `step`. Only ECharts separates these; it's the single biggest quality lever. |
| `rescale` | `"frame" \| "fixed"` or `{ "min": number }` | `"frame"` | Value domain: follow the visible top N each frame, fix to the global max, or hold a floor and then follow (Flourish `scale_min`). |
| `gaps` | `"interpolate" \| "hold" \| "drop"` | `"interpolate"` | Missing interior periods: lerp across, hold last value, or treat as absent. Leading and trailing absence always means "not in the race yet / any more". |
| `holdEnd` | ms | 1500 | Dwell on the final frame before `loop` restarts or playback stops. |
| `loop` | boolean | false | |
| `autoplay` | `"visible" \| true \| false` | `"visible"` | Start when 25% visible (existing `whenSeen`), at once, or never. Reduced motion forces `false`. |
| `controls` | boolean | true | Play/pause button, scrubber, period readout. Keyboard: Space toggles, arrows step one period. Setting `false` is allowed only with `autoplay: false` or an external player; otherwise validation warns (WCAG 2.2.2). |
| `period` | `{ format?, position? }` or `false` | `{ position: "auto" }` | The large ticking period label. Formatted with the `time` channel's format, tabular numerals. |
| `summary` | `"sum" \| false` | false | Small counter line, e.g. "Top 10 combined: $39.3T" (Flourish `totaliser`). |

Field names follow the closest precedent where one exists and plain English where none does. `race` is a block rather than top-level fields so the schema stays scannable and agents see all timeline config in one place, the same way `animation` is a block.

### 3.4 Everything else

`chrome`, `theme`, `a11y`, `watermark`, `width`, `height` and `labels.format` behave as on other types. `animation: false` is accepted and means "no autoplay, open on the final frame". The existing entrance animation is not used; the race itself is the motion.

### 3.5 Validation

Errors (spec rejected, messages name the field and the fix):

- Missing `time`, `key` or `value`, or `value` not quantitative.
- Two rows with the same `(key, time)` pair: "2 rows have country = 'France' and year = 1995. Aggregate them first, e.g. with an aggregate transform."
- Fewer than two periods.
- Both `duration` and `step`.
- `top` < 1.

Warnings: more than 500 keys (rank precompute cost, section 6), non-finite values (dropped), `controls: false` with autoplay, `top` larger than the number of keys (clamped).

`transform` is supported (filter, calculate, aggregate) so authors can pre-aggregate in the spec, reusing the existing transform pipeline.

## 4. Interface decisions

### 4.1 Why a new `type: "race"` instead of `encoding.time` on `ChartSpec`

The Vega-Lite-native alternative is `ChartSpec` with `mark: "bar"`, `x: value`, `y: { field: "country", sort: "-x" }`, and a new `time` channel. It reads familiar but breaks three ways. Swapping to a line chart means re-mapping `x` to the time field and `y` to the value, so the mark swap stops being one field. A table can't be a `ChartSpec` at all. And the rank and top-N behavior, which is the essence of the form, would be implicit in `sort` plus a filter that has to be recomputed on interpolated values, which neither Vega-Lite nor our compiler does.

So the race gets its own top-level type with role-based encoding (`time`, `key`, `value`), like `BarListSpec` uses `label`/`value`, while every channel definition, `transform`, `chrome` and `theme` stay standard. The two channel names agents are most likely to guess, `time` and `key`, are exactly the Vega-Lite ones.

### 4.2 Total duration versus per-step

Most people state a total ("a 30-second race"); most libraries take a per-step value. We default to `duration` and accept `step`, never both.

### 4.3 Playback outside the spec

Speed, seek and play state are runtime concerns on the instance (section 7), not spec fields, the same way hover state isn't in the spec. The spec says how the race is authored; the instance controls a reader's session.

## 5. Algorithm

The engine turns the spec into a `RaceTimeline` once per compile. Every renderer asks it for `frameAt(t)`, where `t` is a continuous period index in `[0, P-1]`. Nothing depends on wall-clock time or previous frames.

### 5.1 Values

Rows are pivoted into a dense `keys × periods` matrix (`Float64Array` per key, `NaN` for absent). `valueAt(k, t)` lerps between the two surrounding periods. Per `gaps`: interior `NaN` is filled by interpolation or hold at compile time, or left as absent. An item absent at either neighbour is absent between them, except it is present from the exact period it first appears, so entries arrive on their real date.

### 5.2 Rank position: sampled exact rank, triangle-smoothed

1. Sample the exact rank at S = 24 points per period: sort present keys by interpolated value, descending, ties broken by the previous sample's rank and then by key (deterministic, no flip-flopping on ties). Absent keys and keys below the fold get rank `top` (one slot below the last visible one, Bostock's sentinel), so anything from rank 11 or 200 enters from the same place.
2. Smooth each key's rank series with a triangle filter whose width equals `swap` (two passes of a box filter over prefix sums, O(samples) per key, edges padded with the end value so the first and last frames are exact).
3. `rankPos(k, t)` lerps between smoothed samples.

What this buys:

- The swap's midpoint lands exactly when the values cross, so order agrees with values to within half a swap.
- The swap duration is independent of period length, like ECharts, and is the `swap` field.
- Two values that cross back and forth within one swap window average out to a shared position instead of flickering, so it acts as built-in hysteresis.
- It is a pure function of `t`: scrubbing backwards, seeking and frame-stepping for export all give identical frames.
- Overlapping chains of swaps blend into one continuous move instead of stop-start.

The cost is a slight anticipation (a row starts moving half a swap before the crossing), which is invisible at 400ms.

Sampling at 24 per period puts the ranking resolution at about 30ms on a 30-second, 45-period race, well under the swap width.

### 5.3 Frame

```ts
interface RaceFrame {
  t: number;                    // continuous period index
  period: { index: number; value: unknown; label: string };   // floor(t), formatted
  items: RaceItem[];            // only items with rankPos < top
  domain: [number, number];     // value domain this frame, after `rescale`
  summary?: number;
}
interface RaceItem {
  key: string; label: string; color: string;
  value: number; valueLabel: string;
  rank: number;       // exact integer rank at t (for table "#" and change arrows)
  rankPos: number;    // smoothed, continuous; drives position
  opacity: number;    // 1 inside the fold, fading to 0 across the last slot
  change: number;     // rank one period ago minus rank now (table arrows), updates at period boundaries
}
```

`domain` for `rescale: "frame"` is the max interpolated value among visible items, which is continuous because a max of continuous functions is continuous; no extra tween needed.

### 5.4 Axes without snapping

Tick opacity is also a pure function of the domain. The step ladder is nested, each step dividing the next (`1, 5, 10, 50, ...` times a power of ten), so a finer step only adds ticks between existing ones. The active step is the first with at least 64px spacing; ticks of the next finer step fade in by how close that step is to qualifying. The mock's first version used a 1-2-5 ladder and showed `$4T $5T $6T` overlapping mid-fade, because 2 doesn't divide 5. The line mark's x axis uses the same function over years (`1, 5, 10, 20`).

### 5.5 Mark geometry

Each mark gets a static layout computed once per size and theme, then a cheap per-frame geometry function. Both are pure and live in the engine.

Bar: name gutter sized from the widest label that will ever appear (measured once with the existing text measurement), value label after the bar end, row band = plot height / `top`, the period label large and faint in the lower right of the plot (it sits where bars are shortest), summary line above it. The plot is clipped to `top` rows; the sentinel slot is just below the clip. Opacity fades across the last slot.

Line: lines for items currently in the top N, plus items that left within the last period (fading), so lines don't blink out. Path = observed points up to `floor(t)` plus an interpolated head at `t`; gaps break the path. y domain expands monotonically through the run (a line chart that rescales downward reads as a data change). Head labels with name and value, de-overlapped by a sort-and-push pass constrained to the plot height (ECharts `moveOverlap: 'shiftY'`).

Table: row y = `rankPos × rowHeight` (FLIP without measuring, since the engine owns layout). The row moving up draws above the one moving down. Rank number and change arrow update at period boundaries only, so they don't flicker during a swap. Columns: rank, change, name with color chip, inline bar, value, share of total.

## 6. Architecture

Follows the existing package boundaries: core types, engine compile and pure geometry, vanilla DOM and playback, thin framework wrappers.

```
packages/core/src/types/spec.ts           RaceSpec, RaceEncoding, RaceConfig, RaceMarkDef; added to VizSpec and StoredVizSpec
packages/core/src/types/race.ts           RaceFrame, RaceItem, RaceLayout and per-mark geometry types (shared by engine and vanilla)
packages/core/src/types/schema-roots.ts   schema root for RaceSpec

packages/engine/src/race/
  matrix.ts         rows -> dense key x period matrix, period ordering, gap policy; pure
  timeline.ts       valueAt, rank sampling, triangle smoothing, frameAt(t); pure, the only stateful-cache owner
  ticks.ts          nested-step crossfade ticks; pure
  layout-bar.ts     static bar layout + barGeometry(frame)
  layout-line.ts    static line layout + lineGeometry(frame, timeline)
  layout-table.ts   static table layout + tableGeometry(frame)
  compile-race.ts   compileRace(spec, options) -> RaceLayout: validate, transforms, theme, chrome, timeline, mark layout, a11y
packages/engine/src/compiler/validation/race.ts   validation rules and messages

packages/vanilla/src/race-mount.ts        createRace(): lifecycle, resize, theme, destroy, update (keeps playhead across mark swaps)
packages/vanilla/src/race/clock.ts        playback clock: play/pause/seek/speed/loop/holdEnd, reduced motion, rAF only while playing
packages/vanilla/src/race/controls.ts     play button, scrubber, period readout, keyboard
packages/vanilla/src/race/render-bar.ts   keyed SVG writer for bar geometry
packages/vanilla/src/race/render-line.ts  keyed SVG writer for line geometry
packages/vanilla/src/race/render-table.ts keyed DOM writer for table geometry
packages/vanilla/src/race/export.ts       GIF export by frame-stepping frameAt(t), reusing gif-encode

packages/{react,vue,svelte}/src/Race.*    wrappers; Visualization dispatch gains `type: "race"`
```

The race does not go through the existing chart pipeline or the data-update transition driver. Those tween between two compiled layouts; a race is a continuous function of one playhead, sampled at 60fps, and per-frame full compiles would cost text measurement and layout work each frame and make axis ticks jump. It reuses the pieces that fit: theme resolution, chrome layout and rendering, text measurement, number formatting, `whenSeen`, reduced-motion detection, theme tokens and GIF encoding.

Per-frame cost is O(visible items) attribute writes plus O(keys) for lookup. Rank precompute is O(P × S × K log K); at 100 periods and 200 keys that is about 480k small sorts. Measure it in phase 1; if it exceeds ~50ms, compute ranks lazily per period on first need, which keeps every frame pure.

### 6.1 Error model

Spec problems are validation errors and warnings with the same shape and reporting path as other types (`validateSpec`, thrown from compile, surfaced by `createRace`). Runtime: `seek` outside the range clamps; calls after `destroy()` are no-ops; `update()` with an invalid spec throws and leaves the current race untouched. A failed GIF export rejects its promise with the existing export error types.

## 7. Runtime API

```ts
const race = createRace(container, spec, options);
race.play(); race.pause();
race.seek(t);                // continuous period index, or race.seekTo(periodValue)
race.setSpeed(2);
race.update(nextSpec);       // mark swap keeps the playhead and play state
race.getState();             // { t, period, playing, speed }
race.on('period', (p) => {}); // fires when floor(t) changes
race.exportGIF({ fps: 25 }); // deterministic, frame-stepped
race.destroy();
```

React: `<Race spec onPeriod ref />`, ref exposes the instance. Vue and Svelte mirror it.

## 8. Accessibility and reduced motion

- The figure gets an accessible name from the title and a generated description: the span, the leader at start and end, and the biggest climber.
- A visually hidden table lists the top N at each period (first, last, and every period for up to 60 periods; sampled beyond), so a screen reader gets the data without the motion.
- The live region announces only on pause, seek or keyboard step ("1995: United States, Japan, Germany lead"), never per frame.
- Reduced motion: no autoplay, opens on the final frame, keyboard and scrubber step period to period with no tween.
- Controls are keyboard operable with visible focus, and the scrubber has `aria-valuetext` set to the period label.

## 9. Delivery phases

Phase 1 (MVP, demoable): core types, engine matrix + timeline + ticks + bar layout, validation, `createRace` with clock and controls, bar renderer, one gallery story with the GDP data. Demo: the bar race plays, pauses, scrubs, rescales, and reverses frame-identically.

Phase 2: line and table marks (parallel lanes, disjoint files), runtime `update()` mark swap keeping the playhead, a11y description and hidden table.

Phase 3: React, Vue and Svelte wrappers; GIF export; JSON schema and `llms.txt` regeneration; docs page; gallery page with all three marks; visual baselines at fixed `t` values (the frame purity makes these deterministic); skill sync.

## 10. Open questions for review

1. Spec shape: dedicated `type: "race"` with role-based encoding (recommended, section 4.1), or `encoding.time` on `ChartSpec`?
2. Default pacing: 700ms per period clamped to 8–90s, and a 400ms swap. The mock uses 30s for 45 periods (680ms) and 420ms. Should the default feel faster for social clips?
3. Line mark default window: `reveal` (expanding) or `all` (fixed full span)?
4. Should v1 include MP4 export? Most races are distributed as video. It needs WebCodecs (Chromium and Safari 17+ only), so the proposal is GIF in v1 and MP4 as a follow-up.

## Sources

Bostock's notebook (observablehq.com/@d3/bar-chart-race), `bar_chart_race` API and source (dexplo.org/bar_chart_race, github.com/dexplo/bar_chart_race), Flourish bar and line race docs (canva.dev Flourish API, flourish.studio/blog/bar-chart-race and /line-chart-race), ECharts bar race handbook and timeline docs, Plotly animation docs, raceplotly, gganimate reference, Animated Vega-Lite (Zong et al., IEEE VIS 2022, arXiv 2208.03869), Vega-Lite PR #8921, WCAG 2.2 Understanding 2.2.2, and builtin.com/data-science/bar-chart-races for the editorial critique.
