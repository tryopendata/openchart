---
title: "Animation"
description: "Animation presets, entrance and update phase settings, and data-update transitions."
section: spec
order: 9
---

# Animation

Charts animate by default: marks enter when the chart first scrolls into view, and data updates tween from the old layout to the new one. The `animation` field picks a preset, sets each phase's timing, or turns motion off with `false`. Static renders and exports never animate, and a reader's reduced-motion setting always wins.

See it: [Motion](https://openchart.steamfield.io/docs/behavior/motion/).

## Animation

Controls entrance animations and data-update transitions. Source: `core/src/types/spec.ts`.

### Quick start

```ts
// Enable all animation phases with defaults
{ animation: true }

// Entrance only (no update/exit transitions)
{ animation: { enter: true, update: false, exit: false } }

// Full control
{
  animation: {
    enter: { duration: 800, ease: 'smooth', stagger: true, trigger: 'visible' },
    update: { duration: 500, ease: 'smooth' },
    exit: { duration: 120, ease: 'gentle' },
    annotationDelay: 150,
  }
}
```

### AnimationSpec

`boolean | AnimationConfig`

- `true` / omitted: sensible defaults for all three phases (enter, update, exit).
- `false`: no animation.
- `AnimationConfig`: per-phase control.

### AnimationConfig

| Field             | Type                              | Default     | Description                                        |
| ----------------- | --------------------------------- | ----------- | -------------------------------------------------- |
| `enter`           | `EnterPhaseConfig \| boolean`     | `true`      | Entrance animation, played when the chart first scrolls into view (see `trigger`). |
| `update`          | `UpdatePhaseConfig \| boolean`    | `true`      | Transition animation when data updates via `.update()`. |
| `exit`            | `AnimationPhaseConfig \| boolean` | `true`      | Exit animation when marks are removed during updates. A removed mark fades out (bars and slices also collapse) over the exit duration, and surviving marks wait for it before they move, so nothing slides over a mark that is still fading. |
| `annotationDelay` | `number`                          | `150`       | Gap in ms after the last mark reaches 90% of its entrance before annotations start (`0` under a preset). |

### AnimationPhaseConfig

| Field      | Type                          | Default    | Description                                  |
| ---------- | ----------------------------- | ---------- | -------------------------------------------- |
| `duration` | `number`                      | `800` enter / `500` update / `120` exit | Duration in ms.                              |
| `ease`     | `AnimationEase`               | `'smooth'` (`'gentle'` for exit) | Easing preset: `'smooth'` (the `glide` curve: gentle start, long deceleration), `'snappy'` (faster, settles by about half the duration), `'gentle'` (the previous slower ease-out). |
| `stagger`  | `AnimationStagger \| boolean` | `true`     | Stagger config for entrance. `false` = simultaneous. `delay` (default `80`) is a ceiling: the whole stagger spans at most 450ms, so n elements land `min(delay, 450 / (n - 1))` apart. |

### EnterPhaseConfig

Everything in `AnimationPhaseConfig`, plus:

| Field     | Type                     | Default     | Description |
| --------- | ------------------------ | ----------- | ----------- |
| `trigger` | `'visible' \| 'mount'`   | `'visible'` | When the entrance starts. `'visible'` holds every element in its from-state until at least 25% of the chart is in the viewport (or, for a chart taller than four viewports, until it fills 25% of the viewport's height), then plays. A chart already in view at mount plays at once. `'mount'` plays at mount whether or not the chart is on screen. |

Play-when-seen uses one shared `IntersectionObserver` per page on the chart's
container. It applies to charts, tables, bar lists, tile maps, geo maps and
sankeys and graphs. Without an `IntersectionObserver` or
a layout engine (server rendering, jsdom/happy-dom) the entrance plays at once,
and under `prefers-reduced-motion` nothing waits. Export (SVG, PNG, JPG, GIF)
never animates and is never gated. Resizes and the webfont reload re-render a
waiting chart immediately and keep it waiting. An `.update()` while the
entrance is still waiting keeps it armed: it plays on the updated data once the
chart is seen, so mounting empty and updating when a fetch resolves still
animates the real marks. A render with nothing to draw (no marks, rows, nodes
or features yet) doesn't arm the entrance. An `.update()` while the entrance is
playing snaps to the new data. Hosts whose tests or screenshots assume
the entrance runs at mount should set `trigger: 'mount'`.

### UpdatePhaseConfig

Everything in `AnimationPhaseConfig`, plus:

| Field      | Type     | Default | Description                                                        |
| ---------- | -------- | ------- | ------------------------------------------------------------------ |
| `maxMarks` | `number` | `500` (SVG) / `20000` (canvas) | Largest mark count that still tweens. Above it, updates swap instantly. |

`maxMarks` is update-only: enter and exit animate via CSS, which does not have
the same per-frame cost.

The default depends on the rendering surface. SVG mode writes attributes on one
DOM element per mark, so its cap is deliberately low. [Canvas mark
mode](./marks.md#canvas-mark-mode) writes into typed arrays and issues one batched fill per
color bucket, so its default is 20,000. An explicit `maxMarks` overrides both.

The count checked is `max(previous, next)`, not the new layout alone. Exit ghosts
render on the destination surface, so a 4,000-point chart updating down to 400
still has ~3,600 departing marks to animate.

### Data-update transitions

When `animation.update` is enabled and `.update(newSpec)` is called, the chart animates marks from their previous positions to the new layout instead of doing an instant swap. The engine matches marks across layouts using keys derived from data values.

**Supported mark types:** bar, column, line, area, point (scatter/dot), beeswarm, arc (pie/donut), histogram, density, rect (heatmap), waffle, calendar, parliament, range, errorbar, tick, circle, lollipop, text. Bar lists, tile maps, sankeys and geo maps tween on update too (see below). Because the gate now covers these marks, a `createChartStory` step that changes data on one of them morphs instead of crossfading.

**What transitions:**
- Rect marks (bars/columns): position + size tween
- Line/area marks: point-matched path morphing with enter/exit interpolation
- Point marks (scatter): cx/cy/r tween
- Beeswarm dots: same cx/cy/r tween as scatter. Set `encoding.key` to a stable
  entity field (state, country) so each dot tracks its entity across updates.
  Without it the fallback identity is `lane|value`, which changes whenever the
  value does: duplicate values re-pair by row order and dots shuffle within the
  swarm instead of tracking. Keyed transitions are not supported on faceted
  beeswarms (panel marks share un-namespaced keys, matching scatter).
- Heatmap, waffle and calendar cells fade in on entrance (a 300ms fade, no bar wipe); on update they tween fill and geometry.
- Axis ticks and gridlines: position slide for updated, fade for enter/exit
- Annotations, endpoint labels, mark labels: delayed crossfade (40% delay, 60% fade-in)

**Fallback to instant swap** when any of these conditions is true:
- Mark type changes between updates
- Encoding fields change (x/y/color/key/facet field names)
- Dimensions change (container resized)
- Mark count exceeds `animation.update.maxMarks` (default 500). The cap exists
  because per-frame SVG attribute writes on thousands of elements drop frames on
  low-end devices. Raise it when the audience is desktop-heavy and you have
  measured the frame budget: `animation: { update: { maxMarks: 5000 } }`.
- `prefers-reduced-motion` is active
- Entrance animation is still in flight

**Legend-hidden series:** When series are hidden via legend toggle, they are removed from the data. On the next `.update()` call, those series re-enter with enter animations as new marks.

**Bar lists:** rows slide to their new slot while bars resize and recolour; new rows fade in and removed rows fade out as ghosts. Rows are keyed by label.

**Tile maps:** tile fill, fill-opacity and label colour tween.

**Sankeys** support update and exit: nodes move and resize, link ribbons morph (including gradient endpoints), labels slide, new nodes and links fade in and removed ones fade out as ghosts.

**Geo maps:** feature fills and points follow `update.ease` and `update.spring`. Entering points fade in and removed points fade out as ghosts. Set `encoding.key` on the points layer to track points across updates.

For bar lists, tile maps, sankeys and geo maps, an `.update()` while the entrance is playing snaps, and a resize never tweens (a resize during an update tween snaps it). While an element tween runs, CSS hover transitions on those elements are held off.

**Tables:** entrance only (rows and cells on first render). Sort, search, pagination and data updates swap instantly. `animation: false` disables it.

**Graphs** take `GraphAnimationSpec`: omitted or `true` is full defaults, `false` disables choreography (warmup still applies), and an object tunes each phase. A graph phase is a tween (`duration`, `ease`) or a `spring`, never both.

| Phase    | Default                                                          | Notes |
| -------- | ---------------------------------------------------------------- | ----- |
| `enter`  | `{ duration: 500, ease: 'smooth', stagger: true, trigger: 'visible' }` | `trigger: 'mount'` plays at mount; `stagger` is on/off only (the `{ delay, order }` object is deprecated and ignored). |
| `update` | `{ duration: 300, ease: 'smooth' }`                              | Enter-fade for newly added marks. |
| `exit`   | `{ duration: 300, ease: 'smooth' }`                              | Ghost fade-out for removed marks. |
| `camera` | duration `'auto'`                                                | Camera flight easing. |
| `hover`  | `{ duration: 150, ease: 'smooth' }`                              | Emphasis crossfade. |
