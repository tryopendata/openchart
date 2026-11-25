# RFC: Playback charts (animated bubbles, time-lapse maps, population pyramids)

Status: draft, revised after devil's advocate review (blockers and should-fix items addressed; see section 8).
Date: 2026-11-24
Builds on: `plans/done/rfc-race-chart.md` (shipped in 9.1.0)

## 1. Problem

The race chart covers one of the animated forms that spread on social platforms: a ranked leaderboard over time. Three other forms come up just as often, and openchart can't make any of them today:

1. The animated bubble scatter. Gapminder's "wealth and health of nations" is the canonical one: every country is a bubble, x is GDP per capita on a log scale, y is life expectancy, bubble area is population, color is region, and the whole cloud drifts up and to the right as a large year label counts from 1960 to today.
2. The time-lapse map. A choropleth or symbol map that plays through periods: unemployment by state through 2020, a disease spreading county by county, election swing by decade. The geographic shape is fixed; only fills and symbol sizes move.
3. The animated population pyramid. Back-to-back horizontal bars, men on the left and women on the right, age groups up the middle, scrubbing from 1950 to 2100 while the base narrows and the top widens. "Japan 1950 to 2100" posts are a staple.

The race RFC lists the alternatives authors have today. `exportSpecSequence` with a timer calling `chart.update()` per period gives one eased tween per period, a stop-start rhythm, no scrubber, axes that rescale between periods, and no GIF export of the playback. Authors go to Flourish or Plotly (`animation_frame`) instead, neither of which is an agent-writable embeddable spec.

All three need the same machinery that already exists inside the race: a period axis, value interpolation between periods with a gap policy, a playback clock with play, pause, scrub, speed and loop, a large period label, keyboard and screen-reader behavior, reduced-motion stepping, and deterministic frame-stepped GIF export. Today that machinery is wired directly into `race-mount.ts` and `packages/engine/src/race/`. The core of this RFC is to pull it out into a shared playback layer, keep the race working on top of it, and then add the three forms as `time`-encoded variants of chart types that already exist.

Who it's for is the same as the race: newsroom developers embedding an interactive, social teams exporting a clip, and agents turning a long `(entity, period, values...)` table into a spec on the first try.

What good looks like, from the conventions of Gapminder Trendalyzer, Flourish's scatter and map templates, Plotly's `animation_frame` and the Animated Vega-Lite work:

- Axes and color scales are fixed for the whole run, computed over every period. Gapminder never rescales; a scale that moves under the data reads as a data change. This is the main difference from the race, whose value axis follows the top N.
- Motion is linear in time between periods, with no stall at each period boundary.
- Identity (color, label) is stable per key for the whole run.
- Entities that appear or disappear fade in place over part of a period instead of popping.
- There is a pause control and a scrubber (WCAG 2.2.2), reduced motion is respected, and a screen reader gets a static equivalent.
- Every frame is a pure function of the playhead, so scrubbing backwards, frame-stepped export and visual baselines are deterministic.

### Non-goals for v1

Line and area charts with `time` (the progressive line reveal is a separate follow-up), canvas mark mode during playback, time-proportional period spacing, hover-to-show-trail, the pyramid's "reference year" outline, map camera moves during playback, MP4 export, and faceted playback. None of these changes the contracts below.

## 2. Spec shape

### 2.1 Recommendation: `encoding.time` on existing types, plus a shared `playback` block

The race got its own `type: "race"` because ranking and top-N are its essence and no existing type could express them (race RFC section 4.1). None of the three forms here has that problem. A bubble scatter is a point chart, a pyramid is a horizontal bar chart, and a time-lapse map is a map. The only new idea in each is "this field is the playback axis", which is exactly Vega-Lite's shipped `time` channel (PR #8921) and the Animated Vega-Lite paper's `encoding.time`. So:

- `encoding.time` is a new optional channel on `ChartSpec` (marks `point`, `circle`, `bar`), `GeoMapSpec` (and its `points` layer), and `TileMapSpec`.
- `encoding.key` (already on `ChartSpec`) carries identity across periods. Maps already have identity: `encoding.key` on geo maps, `encoding.state` on tile maps, and `points.key` on the points layer.
- A top-level `playback` block holds timing and control config, the subset of the race's `race` block that isn't about ranking.

An agent that has written one openchart scatter adds two fields to animate it. The same holds for a map. Removing `time` gives back the static chart, which is also what static export and the no-JS fallback should show.

### 2.2 Bubble scatter

```json
{
  "mark": "point",
  "data": [
    { "country": "China", "region": "East Asia", "year": 1960, "gdp_pc": 90, "life": 33.3, "pop": 667070000 }
  ],
  "encoding": {
    "x":     { "field": "gdp_pc", "type": "quantitative", "scale": { "type": "log" }, "title": "GDP per capita" },
    "y":     { "field": "life", "type": "quantitative", "title": "Life expectancy" },
    "size":  { "field": "pop", "type": "quantitative" },
    "color": { "field": "region", "type": "nominal" },
    "key":   { "field": "country" },
    "time":  { "field": "year", "type": "temporal" }
  },
  "playback": { "duration": 20000, "trails": ["China", "India", "United States"] },
  "chrome": {
    "title": "China and India closed most of the life expectancy gap before they got rich",
    "source": "World Bank"
  }
}
```

### 2.3 Time-lapse map

```json
{
  "type": "map",
  "geo": { "topology": "us-states", "object": "states", "key": "name" },
  "data": [{ "state": "Michigan", "month": "2020-04", "rate": 22.7 }],
  "encoding": {
    "key":   { "field": "state" },
    "color": { "field": "rate", "type": "quantitative", "title": "Unemployment rate" },
    "time":  { "field": "month", "type": "temporal", "format": "%b %Y" }
  },
  "playback": { "step": 500 }
}
```

The same `time` channel goes on `TileMapSpec` (`encoding.state` is the identity) and on a geo map's `points` layer (`points.time`, keyed by `points.key`), so a symbol map of city populations can play by itself or on top of a playing choropleth with the same field.

### 2.4 Population pyramid

A pyramid needs one new static capability before time applies: mirrored bars. Recommendation: a bar mark option, `mirror`, driven by a two-valued `color` field.

```json
{
  "mark": { "type": "bar", "mirror": true },
  "data": [{ "age": "0-4", "sex": "Male", "year": 1950, "pop": 5550000 }],
  "encoding": {
    "y":     { "field": "age", "type": "ordinal", "sort": "descending" },
    "x":     { "field": "pop", "type": "quantitative", "format": "~s" },
    "color": { "field": "sex", "type": "nominal", "sort": ["Male", "Female"] },
    "time":  { "field": "year", "type": "temporal" }
  }
}
```

`mirror: true` means: the first color value (by the color channel's `sort`, else first seen) extends left from a shared center, the second extends right, both sides share one symmetric value domain, value axis labels read as absolute values on both sides, the category labels sit in a center gutter, and the two color values label the halves above the plot. It works with no `time` channel too, so static pyramids and any two-group back-to-back comparison come free.

The pyramid needs no `key`: a bar's identity is already derived from its category and color value (section 2.9).

What `mirror` costs, so it gets its own phase (section 6):

- Stacking. Bars with a color field stack by default (`core/src/types/spec.ts:691-699`). `mirror: true` replaces that default with no stacking; an authored `stack` with `mirror` is an error, checked on the authored value, not the resolved default.
- One axis with a gap. `AxisLayout` already places each tick by pixel position (`core/src/types/layout.ts:193-239`), so the value axis stays a single `x` axis whose ticks are emitted for both halves (0 at each inner edge, absolute-value labels) through a piecewise mapping: left half `[-M, 0] -> [left, gutterStart]`, right half `[0, M] -> [gutterEnd, right]`. `domainLine` is off so no line crosses the gutter. Gridlines, edit-mode axis selection and transitions keep working because they read tick positions, not the scale. The crosshair is off on mirrored bars.
- The gutter. The category axis renders its tick labels centered in the gutter instead of on the left; the gutter width comes from the widest category label, the same measurement the y axis uses today.
- The legend. The two color values label the halves above the plot, and the swatch legend is suppressed. Legend hover maps to the half labels.
- Value labels use `outside` placement only, on the outer end of each bar.

Why a mark option and not the alternatives:

- Negative values plus an absolute-value tick format is what Plotly and Highcharts do. It's a trick authors have to know, it leaks into tooltips and exports, and the category labels still collide with the left bars.
- Vega-Lite's pyramid example is a three-view `hconcat` with one reversed x scale. It's far too much for an agent to write, and openchart has no `hconcat`.
- `stack: 'center'` already means a centered stack (streamgraph-style) and can't carry the gutter.
- A new `type: 'pyramid'` would break the rule that new chart types compose from existing marks.

### 2.5 `encoding.time`

A standard `EncodingChannel` with `field`, `type` (`temporal`, `ordinal`, `quantitative`), `sort` (for ordinal) and `format` (the period label and readout). Periods are its distinct values in order, using the race's period ordering unchanged (`orderPeriods` in `packages/engine/src/race/matrix.ts`). Exactly the same semantics as the race's `encoding.time`, so a race spec and a bubble spec over the same table use the same `time` object.

### 2.6 `playback`

| Field | Type | Default | Meaning |
| --- | --- | --- | --- |
| `duration` | ms | `periods × 700`, clamped to 8–90s | Total playback length at 1×. Same rule as the race. |
| `step` | ms | none | Per-period duration; mutually exclusive with `duration`. |
| `gaps` | `"interpolate" \| "hold" \| "drop"` | `"interpolate"` | Missing interior periods. Same meaning as the race. |
| `holdEnd` | ms | 1500 | Dwell on the final frame. |
| `loop` | boolean | false | |
| `autoplay` | `"visible" \| boolean` | `"visible"` | Reduced motion forces `false`. |
| `controls` | boolean | true | Play button, scrubber, readout, keyboard. Same WCAG warning as the race. |
| `period` | `{ format?, position? } \| false` | `{ position: "auto" }` | The large faint period label. Scatter puts it centered behind the plot (the Gapminder look); maps put it in the lower left of the map area; the pyramid puts it in the upper right. |
| `labels` | `string[]` | none | Scatter only: keys whose name is drawn next to the bubble for the whole run (Gapminder labels a handful of countries). Always shown, never collision-hidden, so labels never pop. |
| `trails` | `boolean \| string[]` | false | Scatter only: draw each key's past positions as a thin line with small dots at each period. `true` is every key; an array names keys. Validation warns on `true` above 30 keys. |

Every field shared with the race has the race's name, type and default, so an agent that has written `race: { duration, loop }` writes `playback: { duration, loop }` without looking anything up.

### 2.7 Validation

`time` is declared on `PointEncoding`, `CircleEncoding` and `BarEncoding` and their `MARK_ENCODING_RULES` entries, not on the base `Encoding`, so the schema and the mark rules reject it elsewhere without new code.

Errors:

- `time` on an unsupported mark (`line`, `area`, `arc`, and others in v1), with a message naming the supported ones; `time` with `facet`, in a `LayerSpec`, or with `youDrawIt`.
- Missing identity per section 2.9.
- Two rows with the same identity and period ("2 rows have country = 'France' and year = 1995. Aggregate them first."), using the derived key for bars.
- Both `duration` and `step`.
- `mirror` with a color field that doesn't have exactly two values, with vertical bars, or with an authored `stack`.
- `trails` or `labels` on a non-point mark; an authored `trendline` on a time spec.
- An `aggregate` or `timeUnit` that drops the time field (section 3.4).

Fewer than two periods is a warning, not an error, for charts and maps (section 4.4), so the empty-then-load flow keeps working. The race keeps its `TOO_FEW_PERIODS` and `NO_VALUES` errors.

Warnings:

- `time` on a bar chart whose y sort is by value (rows will slide through each other at period boundaries; suggest `type: "race"`).
- More than 1,000 marks per period, the auto-canvas threshold (`compiler/mark-render-mode.ts:16`): playback is SVG-only in v1 (section 4.4).
- Temporal periods with irregular spacing, such as 1960, 1970, 1980, 1985: "Periods are spaced evenly in playback, but the gaps between them range from 5 to 10 years." Every period gets equal playback time in v1; time-proportional spacing is a non-goal.
- Fewer than 50ms of playback per period (more than 20 period labels a second), suggesting a longer `duration` or a coarser `timeUnit`.
- A matrix over 2,000,000 cells (keys × periods × channels, 16MB of `Float64Array`), naming the counts.
- `playback` present without `time` (ignored); `controls: false` with autoplay.

### 2.8 Relationship to the race's `race` block

The race keeps its `race` block unchanged in 9.x, since it has shipped. Internally its timing fields resolve through the same playback resolver as `playback`. Open question 1 asks whether the race should also accept `playback` for those fields and deprecate them in `race` at the next major.

`animation: false` means what it means for the race (`race/normalize.ts:40`): autoplay off, the chart opens on the final period, and the controls still work.

### 2.9 Identity

Identity is what carries a mark from one period to the next, and it has to be the same in validation, the matrix, the base layout and the frame writer.

| Form | Identity | Required |
| --- | --- | --- |
| Point and circle | `encoding.key` | Yes. The scatter fallback key, `seriesKey\|x` (`charts/scatter/compute.ts:217-223`), changes every period. |
| Bar (including `mirror`) | The derived `color\|category` key bars already use (`charts/bar/compute.ts:258-267`) | No. `encoding.key` on a bar is ignored with a warning, as today. |
| Geo map features | `encoding.key`, joined to `geo.key` | Already required. |
| Geo map points | `points.key` | Required when `points.time` is set; optional otherwise, as today (`core/src/types/spec.ts:3109-3111`). |
| Tile map | `encoding.state` | Already required. |

The duplicate check, the matrix rows and `mark.key` on every frame use these values.

## 3. The frame model

Every frame is produced the same way for all three forms: values come from one matrix, interpolated in value space, and run through scales and a layout that were computed once and frozen. Nothing is compiled per period, and no pixel geometry is interpolated. (An earlier draft compiled one ordinary layout per period and lerped pixels between them. Review showed that path bypasses the gap policy, can't give maps values to color from, and doesn't keep axes and legends still. See `plans/rfc-playback-charts-review.md`, blockers 1 and 2.)

### 3.1 The matrix is the only source of values

After transforms run (section 3.4), rows are pivoted into a `keys × periods` matrix, generalizing the race's `buildRaceMatrix`:

- One `Float64Array` per key per numeric channel the frame reads: x, y and size for scatter; the length value for bars; the color value for maps, plus size for map points; and any quantitative tooltip fields. `NaN` means absent.
- Per-key static fields: color category, label and nominal tooltip fields, each taking the last non-null value in time, as the race does.
- Interior gaps are filled at build time by the `gaps` policy. On channels with a log scale, `interpolate` fills geometrically (lerp in log space), and values ≤ 0 are treated as absent with a warning that gives the count, since `buildLogScale` drops them (`engine/src/layout/scales.ts:341`) and the key would otherwise vanish mid-run without explanation.

Periods are ordered by `orderPeriods`, which in phase 1 also learns ordinal `sort: "descending"` (today it handles only sort arrays, `race/matrix.ts:29-38`).

`valueAt(key, channel, t)` lerps between the two neighbouring periods, again geometrically on log channels. Displayed text (value labels, tile values, tooltip numbers, the a11y announcement) is formatted from these values with the frozen formatter (section 3.2), so text and geometry always agree.

### 3.2 The frozen frame

One compile, at mount and on resize or theme change, produces everything that must stay still for the run. Its input is the envelope: the spec with `data` replaced by every present, gap-filled cell of the matrix across all periods. Run through the normal compiler, the envelope naturally gives the all-period extent with ordinary nice rounding, every color category, and formatter context over every value. The compile also applies these playback overrides, each fixing a place where the layout depends on one period's data:

| What would move | Where | Frozen rule |
| --- | --- | --- |
| Axis extents and rounding | `layout/scales.ts:317, 354` call `nice()` only without an explicit domain | Domains come from the envelope compile, so nice rounding still applies. Never pin by writing `scale.domain` into the spec. An authored `scale.domain` still wins. |
| Quantile color breaks | `scales.ts:718-720`, `legend/continuous.ts:321-325` compute breaks from current values | Breaks computed once over all matrix values, then used as a threshold scale for the run. |
| Sequential color domain | `scales.ts:662-664` | Taken from the envelope. |
| Ordinal color slots | `scales.ts:644-646` derive the domain from present values | The envelope contains every category, so slots are stable. |
| Scatter fill opacity | `charts/scatter/compute.ts:156`, 0.85 under 200 rows and 0.6 at or above | Decided once from the largest per-period key count and passed to the mark step as a constant. |
| Scatter trendline | `charts/scatter/index.ts:30-48`, on by default, fit to current marks | Off when `time` is present. An authored `trendline` is a validation error in v1. |
| "No data" legend row | `geo/compile-geo-map.ts:557-568` adds it only if a feature lacks data now | Shown if any feature lacks data in any period. |
| Map size-legend corner | `compile-geo-map.ts:1656-1677` avoids current point positions | Chosen once against the union of point positions over all periods. |
| Auto-placed annotations | `annotations/collisions.ts:498-531` route around current marks | Placed once against the final period's marks, then fixed. Data-anchored annotations keep their data anchor. |
| Bar label margin | `charts/bar/label-plan.ts:52-60` reserves space from current formatted values | The label plan is computed from the envelope (widest label over all periods) and reused every frame. |
| Formatter precision and SI suffix | `resolveFieldFormatter({ values })` in `label-plan.ts:55`; `computeFieldFormatContext(values)` in `legend/continuous.ts:426` | One formatter per field, resolved over all matrix values. |
| Label visibility from collision passes | per-compile de-overlap | Bar value labels in playback use `outside` placement only, so no inside/outside flip. Scatter point labels are opt-in per key (`playback.labels`, section 2.6) and always shown. No per-frame collision pass. |

The frozen frame keeps the resolved scales, the plot area, the label plan, the theme and the full non-mark layout: chrome, axes, gridlines, legend, annotations and the period label slot. Phase 2 opens with a spike (section 6) that proves this list is complete before anything else is built on it.

### 3.3 Per-frame marks

Charts: build the frame's rows from the matrix at `t` (one row per present key, values from `valueAt`, static fields attached), then call the mark type's registered renderer with the frozen scales, plot area and label plan. The renderers already take exactly those inputs (`ChartRenderer` in `engine/src/charts/registry.ts:33-42`), so `computeScatterMarks` and `computeBarMarks` are reused as they are. They don't re-resolve scales, measure the layout or place chrome. This is O(keys) arithmetic per frame with no caching, so period count doesn't affect frame cost. The frozen-opacity and trendline overrides above are passed in, not recomputed.

Maps: no per-frame compile at all. Geometry, projection, feature paths and labels come from the frozen frame. Each frame sets each feature's fill to `classScale.color(valueAt(key, t))` and its `data-bin-index` to `classScale.binIndex(...)`, which keeps legend-swatch hover working (`core/src/types/layout.ts:2093-2097`). `ClassScale` already exposes both (`legend/continuous.ts:352-373`); the geo and tile map layouts gain a reference to it. Map points keep their frozen positions in v1 and take radius from the frozen size scale and fill from the frozen point color scale. Tile maps also update the tile's value text from the frozen formatter.

Fills are never blended as colors, because on a stepped scale a blend shows colors that aren't in the legend. A feature changes class at the moment its interpolated value crosses a break.

### 3.4 Order against transforms

Transforms (`filter`, `calculate`, `aggregate`, `window`, `timeUnit`) run first, on the whole dataset, exactly as `prepareChartSpec` runs them today. The time field must survive them: an `aggregate` whose `groupby` drops the time field (or a `timeUnit` that renames it without `encoding.time` following) is a validation error naming the field. Pivoting to the matrix happens after.

### 3.5 Entering and leaving

A key present at period `i` and absent at `i+1` holds its last values and fades out over the first half of that interval. A key that first appears at `i+1` fades in over the second half, holding its first values. Opacity is a multiplier applied by the frame writer on top of the renderer's mark opacity. On maps, a feature with no value takes the existing no-data fill, crossfading over the same half interval. All of this is a pure function of `t`.

## 4. Architecture

### 4.1 The shared playback layer (phase 1)

Extract the reusable parts of the race into `playback` modules. Race behavior must not change: the existing race tests and race visual baselines are the gate for this phase.

```
packages/engine/src/playback/
  periods.ts       period reading and ordering (moved from race/matrix.ts: readPeriod, orderPeriods)
  matrix.ts        buildPlaybackMatrix(rows, { identity, time, channels[] }, gaps): one Float64Array per key per channel; fillInteriorGaps moved here
  interpolate.ts   moved from race/interpolate.ts; adds log-space interpolation
  options.ts       resolvePlayback(spec): duration/step/holdEnd/loop/autoplay/controls/period, shared with race
  period-labels.ts moved from race/period-labels.ts
packages/engine/src/compiler/validation/playback.ts   shared field validation; race-options.ts calls into it for the shared fields

packages/vanilla/src/playback/
  clock.ts         moved from race/clock.ts, renamed types (PlaybackClock, PlaybackClockState); race imports it
  controls.ts      moved from race/controls.ts
  announcer.ts     the live region and "announce on pause, seek or step only" policy from race/a11y-dom.ts
  export-gif.ts    frame-stepped GIF export generalized from race/export.ts: takes { svg, draw(t), periodCount, durationMs }
  session.ts       createPlaybackSession(): clock + controls + announcer + whenSeen autoplay + reduced-motion stepping, the wiring currently inline in race-mount.ts
```

`race-mount.ts` becomes a consumer of `createPlaybackSession`. The race-specific parts (rank sampling and smoothing, top-N, rescale, the three mark layouts) stay in `race/`.

Four modules don't move cleanly, and each gets the same treatment: the shared part takes what was race-specific as a parameter, and the race passes today's values, so its output is byte-identical.

- `race/a11y-dom.ts` is typed to `RaceShell` and `RaceModel` and calls `raceA11yLeaders` (`race/a11y-dom.ts:1-11, 118`). The shared `announcer.ts` keeps the live region and the announce-on-pause, seek or step policy and takes `describe(t): string`. The race passes a function wrapping `raceA11yLeaders`; the leaders logic and the hidden table stay in `race/`.
- `race/export.ts` takes `RaceLayout`, snapshots styles from `.oc-race-*` selectors, seeds its palette from `layout.colors` and hard-codes `END_HOLD_MS` and `dpi: 1` (`race/export.ts:34-57`). The shared `export-gif.ts` takes `{ svg, draw(t), durationMs, holdEndMs, styleSelectors, paletteSeed }`. Of `GIFExportOptions` (`export-gif.ts:54-84`), playback export honors `fps`, `dpi`, `loop`, `embedFonts`, `backgroundColor` and `theme`; `durationMs` replaces the playback duration (the hold-end is added after it). The race passes `dpi: 1` and its current hold as defaults, so its GIFs don't change.
- The controls emit `oc-race-*` classes styled in `core/src/styles/race.css`. `createControls` takes a class prefix: the race passes `oc-race`, the new forms pass `oc-playback`. The control rules move to `core/src/styles/playback.css` with both prefixes in each selector, so the race's DOM and pixels don't change.
- Validation in `validation/race-options.ts:33-65, 76` hard-codes `race.` in messages and `/race/` in paths with pinned ordering. The shared validator takes the block name (`race` or `playback`) and keeps the same field order. The matrix's errors become `PlaybackDataError` with the same codes; `RaceDataError` extends it so existing `instanceof` checks and messages hold. The 500-key warning text takes the form's noun ("bars" for the race, "keys" elsewhere).

Phase 1 also lands every new core type (`encoding.time` on the three encodings, `playback`, `mark.mirror`, `points.time`, the time channel on map encodings) and the JSON schema, plus a one-line hook in `validation/chart.ts` that calls `validation/mirror.ts`. That way the later lanes don't share `spec.ts`, `encoding.ts`, `validation/chart.ts` or the schema.

### 4.2 Charts and maps with `time` (phases 2 and 4)

Section 3 defines the frame model. The modules:

```
packages/engine/src/playback/
  matrix.ts           (from 4.1) multi-channel matrix, static per-key fields, gap fill, log-aware fill
  freeze.ts           envelope construction and the playback overrides in section 3.2's table
  chart-playback.ts   compileChartPlayback(spec, options) -> { frame: FrozenChartFrame, base: ChartLayout,
                      periods: string[], marksAt(t): Mark[] }; marksAt calls the registered ChartRenderer
                      with the frozen scales, area and label plan. base holds one mark per key in the union
                      of all periods, ordered by maximum size so small bubbles draw on top, and is the only
                      layout the DOM and interactions are built from.
  map-playback.ts     compileGeoMapPlayback / compileTileMapPlayback -> { frame, base, periods,
                      fillsAt(t), pointsAt(t) }; one geo compile per size and theme, never per period
  trails.ts           per-key polyline through the period values up to t, plus the interpolated head, in frozen scale space
packages/engine/src/charts/bar/mirror.ts   static mirrored-bar layout (center gutter, symmetric domain, half labels)

packages/vanilla/src/playback/
  chart-frames.ts     writes marksAt(t) onto base elements, matched by mark.key (never by array position or data-mark-id)
  map-frames.ts       writes fills, data-bin-index and point radius/fill, matched by data-key / data-point-key
```

The engine's public `compileChart`, `compileGeoMap` and `compileTileMap` return the frozen frame's layout with marks at the final period when given a time spec. MCP renderers and anything else outside the mount then get a correct static chart rather than every period overplotted. `renderStaticSVG` accepts a `t` option and uses the same path.

Mounting is covered in section 4.4.

Instance API: the existing instances gain a `playback` property, `null` when the spec has no `time`:

```ts
const chart = createChart(el, spec);
chart.playback?.play(); chart.playback?.pause();
chart.playback?.seek(t);  chart.playback?.setSpeed(2);
chart.playback?.getState();               // { t, period, playing, speed }
chart.playback?.on('period', (p) => {});
chart.export('gif');                      // frame-stepped playback when time is present
```

Method names and semantics match `RaceInstance` exactly. Open question 2 covers the alternative of flattening them onto the instance.

`chart.playback` is a getter. The controller behind it is created the first time the instance renders a time spec and reused for the instance's lifetime, so listeners registered with `on()` survive every update. While the current spec has no `time`, the getter returns `null` and the controller is dormant (no events, methods no-op). The React `ChartHandle` already exposes `instance` as a getter (`react/src/Chart.tsx:257-269`), and the Vue and Svelte refs do the same, so `ref.current.instance.playback` is never stale when a spec gains or loses `time`. No new components.

Hover during playback: tooltips show the nearest period's observed values, labelled with that period ("1987: GDP per capita $2,140"), rather than interpolated numbers that look like data. When the nearest period was gap-filled, the tooltip says so. The tooltip follows the bubble. Hover highlights the hovered key (and its trail if trails are on) using the existing hover emphasis classes. This needs a new content builder in `chart-frames.ts`; the existing descriptors are static.

Static output: `renderStaticSVG` and the no-JS render show the final period, matching the race. A `t` option on static render (also used by visual baselines) picks any frame.

### 4.3 Error model

Same as the race: spec problems are validation errors and warnings through the existing `validateSpec` path, thrown from compile and surfaced by the mount; `seek` clamps; calls after `destroy()` are no-ops; `update()` with an invalid spec throws and leaves the current playback untouched; a failed GIF export rejects with the existing export error types.

### 4.4 Mount behavior

`createChart` has no shell: it renders straight into the container and `render()` tears everything down (`vanilla/src/mount.ts:275-310`). Playback keeps that. `render()` runs only on mount, resize, theme change, font reload, `update()` and series visibility changes; it builds the SVG from the base layout and then writes the current frame. Per-frame drawing never calls `render()`: the frame writer mutates attributes on the existing elements, matched by `mark.key`.

The controls strip. For a time spec with `controls` on, the mount wraps its output in a flex column, the SVG root above the 44px strip the race uses (`race/size.ts:1`). The chart sizer latches auto-height by comparing the container's height with the SVG's own (`chart-sizing.ts:47-86`), which the strip would break. `createChartSizer` gains a `reservedHeight` option: explicit-height hosts get `height - reservedHeight` for the chart, and the own-height check compares against `svgHeight + reservedHeight`. Auto-height hosts grow by the strip. Maps use the same option in their sizing.

What each existing feature does on a time spec:

| Feature | Behavior during playback |
| --- | --- |
| Entrance animation | Off. The playback is the motion, as with the race. |
| Data-update transitions | Off. `update()` follows the rules below and snaps. |
| Edit mode (`interaction: "edit"`) | Supported. Autoplay is off and the chart opens on the final period; the controls work. Chrome, annotation and legend edits apply to the frozen frame and re-freeze it (one compile). Mark drags are disabled on time specs. Starting any edit gesture pauses playback. Edit mode gets its own example story in phase 5. |
| Series visibility (legend toggle) | Hiding a series hides its keys in the frame writer. The frozen frame is not recompiled, so axes and color slots don't move, which matches Gapminder. |
| Series search and highlight | Applied to the base marks' emphasis classes by key; no re-freeze. Highlighted keys draw their trails when `trails` is on. |
| youDrawIt | Validation error with `time`. |
| `rowHover` | Works on base marks by key. |
| Crosshair and voronoi hit-testing | The crosshair is off on time specs. Tooltips use element hit-testing while playing; on pause, seek or step the spatial index is rebuilt from the current frame. |
| Keyboard mark navigation | Reads marks by key, never by the `data-mark-id` index (`interactions/keyboard-nav.ts:49, 65, 167`), and is wired only to the base layout. |
| `layout` and `sampleLayout()` (`mount-types.ts:96, 111`) | Return the base layout with marks at the current `t`. |
| `beginManualUpdate` | Pauses playback, applies the spec under the `update()` rules and returns `null` (no transition to drive). Frame-stepped capture of a playback goes through `export('gif')`. |
| Canvas mark mode | Off. Time specs always render SVG. An explicit `renderer: "canvas"` gets the existing refusal warning (`mark-render-mode.ts:71-73`) and SVG. |
| `export('svg' \| 'png')` | The current frame. |
| `export('csv')` | The source rows after transforms, every period, long format. |
| `export('gif')` | Frame-stepped playback (section 4.1). |
| Map zoom, pan and the camera API | Work during playback; fills are written per feature, independent of the camera. Story camera moves during playback are a non-goal. |
| Map focus and dimming | Work; focus follows the key, not the period. |
| Reduced motion | As section 5. |

Empty and single-period data. With zero or one period, a time spec renders as the static chart of whatever data is present (empty or that one period) with a warning, and the controls strip is hidden but its height stays reserved so the layout doesn't jump when data arrives. `chart.playback` is non-null and reports `{ periods: 0 or 1, playing: false }`; `play()` is a no-op. When an `update()` brings a second period, the controls appear and autoplay applies as if the chart had just been seen.

`update(nextSpec)` on a time spec:

- Compatible means the same mark type, the same time field and type, and the same identity field. A compatible update keeps the playing state and seeks to the same period value in the new period list; if that value is gone, to the nearest period by sort key. The frozen frame is recompiled from the new envelope, so axes can change on an update, never during playback.
- Anything else, including adding or removing `time`, rebuilds from scratch and resets the playhead to the start (the final period when autoplay is off).
- `chart.playback` keeps its identity across both, per section 4.2.

## 5. Accessibility

- Description: generated from title plus the span and, per form: for scatter, the keys with the largest movement on x and y; for maps, the features with the highest and lowest values at the first and last period; for the pyramid, the median age group at the start and end (computed from the bar values).
- The hidden data table lists the values per period for the first, last and up to 60 sampled periods, through the existing chart and map table generators applied per period, and is capped at 5,000 cells: above that, the period sample shrinks to fit and the table caption says how many periods it shows.
- The live region announces only on pause, seek or keyboard step: the period label and the same per-form one-line summary.
- Reduced motion: no autoplay, opens on the final period, keyboard and scrubber step period to period with no tween. Same code path as the race, via the shared session.

## 6. Delivery phases

Phase 1, shared playback layer: the moves and renames in section 4.1, `playback` and `encoding.time` types in core, the shared validation and resolver, `race-mount.ts` rewired onto `createPlaybackSession`. Gate: the full race unit suite, the race e2e specs and the race visual baselines pass unchanged. No user-visible change.

Phase 2 starts with a spike that runs before anything else in the phase and decides whether the frame model in section 3 holds. Build the envelope compile and `marksAt(t)` for scatter only, then assert three things in tests on the Gapminder data and on a fixture whose periods differ in key count (one under and one over 200), category set and value magnitude:

- the frozen non-mark layout (area, axes, legend, chrome) is computed once and is the same object for every `t`;
- `marksAt(p)` at an integer period `p` gives the same point geometry as `compileChart` on that period's rows with the envelope's scales;
- a 200-key frame costs under 2ms.

If any assertion needs an override missing from the section 3.2 table, add it to the table before continuing. If the renderer path can't take frozen inputs without forking it, stop and revisit the RFC.

Then phase 2 proper, in two steps that each land on their own. First the engine: `compileChartPlayback` for `point` and `circle`, log-space interpolation, the frozen frame, enter/exit fades, trails, and the public `compileChart` and static `t` behavior. Then the mount: section 4.4's behavior table and sizer change, `chart.playback`, the centered period label, the tooltip builder, GIF export (measuring palette banding on overlapping translucent bubbles and trails; if it bands, seed the palette with blended pairs), and the hidden data table. Demo: the Gapminder chart built from the OpenData `worldbank/gdp-per-capita`, `worldbank/life-expectancy` and `worldbank/population` datasets (joinable on `country_code` and `year`, 1960 onwards), with region color.

Phase 3, mirrored bars, static only: the layout in `charts/bar/mirror.ts`, the stack override, the piecewise axis ticks, the center gutter, half labels in place of the legend, `outside` value labels, `validation/mirror.ts`, and a static pyramid story and baseline. It depends only on phase 1, so it runs in parallel with phase 2; its files (`charts/bar/`, `validation/mirror.ts`, the axis tick emitter) don't overlap phase 2's (`engine/src/playback/`, `vanilla/src/playback/`, `charts/scatter/`).

Phase 4, two lanes with disjoint files, after phases 2 and 3:

- Maps: `compileGeoMapPlayback` (choropleth fills plus the points layer) and `compileTileMapPlayback`, stepped-scale class changes, no-data crossfade, map period label, `reservedHeight` in map sizing. Files: `engine/src/playback/map-playback.ts`, `vanilla/src/playback/map-frames.ts`, the geo and tile map compile and mount files, and `validation/geo*.ts`. Demo: insured unemployment rate by state through 2020 from `dol/weekly-claims` on the tile map and the states choropleth.
- Animated pyramid: `time` on bars through the phase 2 chart path. Files: the bar branch of `chart-playback.ts`, and bar tests. Demo data needs a source: OpenData has county age brackets without sex (`census/county-population-by-age`) and UN totals without age (`un/population-prospects`). Either request the UN WPP population by age and sex dataset through OpenData, or ship a fixture from the UN WPP CSV. Decide before phase 4 starts.

Phase 5: wrapper ref plumbing and tests for React, Vue and Svelte; JSON schema and `llms.txt` regeneration; the docs and blog posts in section 6.1; gallery entries; visual baselines at fixed `t`; openchart skill sync.

### 6.1 Documentation and blog posts

Docs and posts live in `site/src/content/docs/` and `site/src/content/blog/`. Every post uses a live `Demo` with real data and links its docs pages through `related`, as the race posts do.

New docs pages:

| Page | Covers |
| --- | --- |
| `change-over-time/playback` | The shared `playback` block: every option, defaults, controls, keyboard, reduced motion, `chart.playback`. The race page links here for its timing fields instead of repeating the table. |
| `correlation/bubble-playback` | The Gapminder chart: `encoding.time`, `key`, log x, frozen axes, `labels`, `trails`, enter and exit fades. |
| `maps/time-lapse` | Choropleth, tile map and points layer with `time`; stepped class changes; no-data handling. |
| `comparison/pyramid` | Static `mirror` bars, then with `time`. |

Existing pages to update:

| Page | Change |
| --- | --- |
| `the-spec/encoding` | The `time` channel and the identity table from section 2.9. |
| `behavior/motion` | How playback differs from the entrance animation; `animation: false` on time specs. |
| `behavior/edit-mode` | What editing does on a time spec (section 4.4). |
| `output/export` | Playback GIFs, which `GIFExportOptions` apply, the static `t` option, CSV of every period. |
| `output/canvas` | Time specs always render SVG. |
| `maps/choropleth`, `maps/tile-map`, `maps/symbol-map` | A short time section linking to `maps/time-lapse`. |
| `correlation/bubble` | Link to `correlation/bubble-playback`. |
| `comparison/bar` | Mirrored bars, linking to `comparison/pyramid`. |
| `change-over-time/race` | Point the timing options at `change-over-time/playback`. |

Blog posts, following the pair the race shipped with (a developer how-to and a chart-choice post):

| Post | Tags | Demo | Ships with |
| --- | --- | --- | --- |
| How to make an animated bubble chart in JavaScript | `developers` | Gapminder from World Bank GDP per capita, life expectancy and population | Phase 5 |
| When to use an animated chart instead of small multiples | `chart-choice` | The same data as a bubble playback, a connected scatter and small multiples | Phase 5 |
| How to make an animated choropleth map | `developers`, `maps` | Insured unemployment by state through 2020, choropleth and tile map | Phase 5 |
| How to make a population pyramid in JavaScript | `developers` | Static pyramid first, animated at the end once phase 4 lands | Static version after phase 3; the animated section added in phase 5. Blocked on the pyramid data source (phase 4). |

Existing posts to update: `export-a-chart-as-png-svg-or-gif` (playback GIFs) and `choropleth-vs-tile-map` (link to the animated map post).

## 7. Open questions

1. Should the race accept `playback` for its timing fields now (both accepted in 9.x, `race.duration` and friends deprecated at v10), so there's one place to look? Recommended yes, since agents will otherwise mix the two.
2. `chart.playback.play()` (recommended: keeps `ChartInstance` from growing nine methods that only apply with `time`) or `chart.play()` to match `race.play()`?
3. Pyramid as `mark: { type: "bar", mirror: true }` (recommended) or a `stack: "mirror"` value on the x channel, which reads closer to how Vega-Lite users think about bar layout but overloads `stack`?
4. Trails default: off (recommended, Gapminder's default) or on for the three largest keys?
5. Annotations placed by auto-placement are fixed against the final period's marks (section 3.2). Is the final period the right reference, or should it be the period an annotation's data anchor falls in?

## 8. Review status

The devil's advocate review (`plans/rfc-playback-charts-review.md`) raised two blockers and a set of should-fix and minor items. All are addressed in this revision:

| Review item | Where |
| --- | --- |
| Two frame models (blocker 1) | Section 3 |
| Pinned domains don't freeze the layout (blocker 2) | Section 3.2, with the spike in section 6 |
| Option B wrong for maps | Section 3.3 (compile once) |
| Identity rules | Section 2.9 |
| Mark ids are positions | Sections 4.2 and 4.4 (match by key; only the base layout is wired) |
| Mount integration, controls strip vs. sizer | Section 4.4 |
| Phase-1 extraction | Section 4.1 |
| Cost of `mirror` | Section 2.4 and its own phase 3 |
| Canvas thresholds | Sections 2.7 and 4.4 |
| Behavior without the mount | Section 4.2 |
| Order against transforms | Section 3.4 |
| Empty and one-period data | Sections 2.7 and 4.4 |
| Many periods | Section 2.7 (frame cost no longer depends on period count; warnings on pace and matrix size) |
| Irregular spacing | Section 2.7 (warning; proportional spacing is a non-goal) |
| Log axes with values ≤ 0 | Section 3.1 |
| `update()` and wrapper refs | Sections 4.2 and 4.4 |
| Labels pop | Section 3.2 |
| Minor: encoding placement, facet and layer errors | Section 2.7 |
| Minor: descending ordinal sort | Section 3.1 |
| Minor: `animation: false` | Section 2.8 |
| Minor: bubble z-order | Section 4.2 (base sorted by maximum size) |
| Minor: data table size | Section 5 |
| Minor: GIF palette banding | Section 6, phase 2 |
| Minor: interpolated tooltips | Section 4.2 |

What's still unverified is whether the mark renderers accept frozen inputs without forking, which the phase 2 spike decides. The open product questions are in section 7.

## Sources

Gapminder Trendalyzer and Gapminder Tools (gapminder.org/tools), Hans Rosling's 2006 TED talk for the canonical form, Flourish scatter, bubble and projection map templates, Plotly `animation_frame` / `animation_group` docs, Vega-Lite PR #8921 (`time` channel), Animated Vega-Lite (Zong et al., IEEE VIS 2022), the Vega-Lite population pyramid example, Highcharts population pyramid demo, the UN WPP data portal for pyramid conventions, WCAG 2.2 Understanding 2.2.2, and the race RFC for the shared playback decisions.
