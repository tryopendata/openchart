# SVG Animation

The animation system lives across the CSS partials in `packages/core/src/styles/` (keyframes in `keyframes.css`, animation rules in `animation.css`), `packages/vanilla/src/svg-renderer.ts` (DOM attributes + CSS custom properties), `packages/vanilla/src/mount.ts` (lifecycle), and `packages/engine/src/compiler/animation.ts` (spec resolution + defaults).

## How It Works

Animations are pure CSS. The engine resolves the spec into a `ResolvedAnimation` config, the renderer stamps CSS custom properties and data attributes on the SVG, and the CSS keyframes do the rest. No WAAPI, no JS animation libraries.

The `oc-animate` class on the SVG root scopes all animation rules. It gets added before the SVG enters the DOM (to avoid a flash of final state) and removed after animations complete via a computed timeout.

## SVG Is Not HTML

These will bite you if you assume SVG elements behave like HTML elements.

**`clip-path: inset()` on `<g>` does nothing.** SVG groups have no intrinsic bounding box, so percentage-based insets resolve to zero. Apply clip-path to individual child elements (rect, path, circle), not groups. Groups whose children give them a box (the stack reveal's `<g>` of rects) do work, checked in Chromium and WebKit; verify in both before relying on it elsewhere.

**CSS `transform` replaces SVG `transform` attributes.** An element with `<g transform="translate(100,50)">` can't also have `transform: scale(0.5)` in CSS. They occupy the same slot and CSS wins, displacing the element. Arc/pie marks use SVG translate for positioning, so only use opacity animations on those.

**Scale entrances carry an inline px `transform-origin`.** Line points (`oc-enter-pop`) and grid cells (`oc-enter-cell`) scale about their own centre; the renderer stamps `transform-origin: <x>px <y>px` inline instead of relying on `transform-box: fill-box`, because GIF frame clones carry no animation CSS. Pie slices (`oc-enter-arc` on `.oc-mark-arc > path`) need none: the path is drawn around its group's translated origin, so the default `0 0` is the pie centre (checked in Chromium and WebKit).

**Point marks are bare `<circle>` elements, not wrapped in `<g>`.** The CSS selector `.oc-mark-point circle` doesn't match because the circle IS the `.oc-mark-point` element. Use `circle.oc-mark-point` instead. Other marks (rect, line, area, arc) are wrapped in `<g>` groups. Always verify DOM structure before writing selectors.

## Mount Lifecycle

**Every mount owns one `createEntranceLifecycle`** (`vanilla/src/entrance-lifecycle.ts`): chart (incl. canvas mode), table, sankey, bar list, tile map, geo map, and the graphs (`completion: 'js'`). Don't hand-roll `cancelSeen`, cleanup, pending-resize or owed-entrance state in a mount. Each render calls `reset()` (cancel), then `animate = entrance.claim(hasContent, enterEnabled)`, renders with `animate`, and `arm()`s the new root when it's true. The entrance is owed from mount until a render has content, and again whenever `reset()` cancels one that was still waiting, so a waiting entrance survives any re-render (resize, font reload, sort, an update, even an update to empty data) and plays on the next root with content once seen. A render with content settles the debt whether or not it animates, so an update while the entrance plays snaps. Edit mode passes `enabled: false`. The graphs re-arm nothing: they keep one host, stay armed through a waiting `update()`, and drop (drawing at full alpha) when the update turns `enter` off. Stamps (`--oc-*` timing vars, mark indexes, stack reveals) render only when `animate` is set, so resizes and settled exports carry none; exports never copy the timing tokens from the live cascade either (`theme-style-block.ts`), and the GIF clone keeps the ones it stamped.

**`oc-animate` goes on before DOM insertion.** The renderer accepts `{ animate: true }` from mount.ts. If you add the class after `appendChild`, elements flash in their final state for one frame before `animation-fill-mode: both` kicks in.

**Resizes go through `admitResize()`.** The ResizeObserver fires on first layout, not just on resizes. While the entrance waits, `resize()` re-renders at once (nothing is moving yet) and the render re-arms the paused entrance on the new root. While it plays, `admitResize()` returns false and records the resize; the lifecycle replays it once through `onDeferredResize` after the entrance settles, and a `reset()`/`drop()` discards it (the re-render already lays out at the current size). Canvas mark mode drops the playing entrance and re-renders instead, so the fixed-pixel canvas never drifts from the fluid SVG. The graphs never defer (their per-frame fit follows the viewport), so they pass no `onDeferredResize`.

**React StrictMode double-mounts.** Mount, destroy, mount. Each `createChart()` call creates its own lifecycle, and `destroy()` cancels it (observer and clock). Don't use DOM attributes to track animation state across mounts: they persist through destroy+remount but the SVG doesn't.

## Animation Cleanup

Don't use `animationend` events. The event fires per-element, so the first staggered element to finish would trigger cleanup while the rest are still running. And don't trust a mount-time timer: on a busy page (a 12-chart dashboard) the next style recalc, which is when CSS animations actually start, can land hundreds of ms after mount JS.

`setupAnimationCleanup()` waits one rAF, then `Promise.allSettled(root.getAnimations({ subtree: true }).map(a => a.finished))` (plus `canvasFinished`, the canvas entrance's promise), then removes `oc-animate`. Collecting in the next frame avoids forcing a style recalc per chart at mount. Where `getAnimations` is missing (happy-dom in unit tests), it falls back to a timer at the choreography table's end for the elements present (`entranceEndMs` via `scanEntrance`) plus 500ms (tables 300ms). `totalMs` overrides that fallback window for canvas mark mode.

`onComplete` fires only on natural completion, never after cancellation: a `cancelled` flag guards it. The entrance lifecycle uses this to settle and replay any resize deferred during the animation window. The cancellation path (returned cleanup function) clears the frame and both timers and removes `oc-animate`, which cancels the CSS animations and rejects their `finished` promises; `allSettled` absorbs those, so nothing goes unhandled. It does not fire `onComplete`, so destroy logic stays simple and doesn't trigger resize side effects.

**Reduced motion opens no entrance window.** Animation is on by default, so this is the path an unconfigured chart takes for users who prefer reduced motion. `reduced-motion.css` sets `animation: none`. The check lives in `entrance-lifecycle.ts`, not in the mounts: `playWhenSeen` plays at once, and with no JS entrance to await the lifecycle settles synchronously without calling `setupAnimationCleanup`, so resizes and updates aren't deferred. `oc-animate` stays on the root (inert there; `e2e/a11y/reduced-motion.spec.ts` asserts it with zero animations), so JS that keys on the class must also check reduced motion (see `raiseFeature` in `map-mount.ts`).

## Stacked Bar Sequencing

Every animated stack reveals as one shape on the author's curve; segments no longer chain. The old linear per-segment chain (`--oc-stack-pos`, `--oc-stack-segment-duration`) is gone and nothing stamps or reads those vars. Don't bring it back: chaining forces linear easing (eased segments jitter at the handoffs), which can't follow the author's curve.

`wrapStackReveals()` in `svg-renderer.ts` finds the segments inside `g.oc-marks` (not the clip group's direct children, where they never are) and wraps each stack, in faceted panels too, in one `.oc-stack-reveal` `<g>` carrying the stack's `--oc-mark-index`; the segments' own animations are suppressed. `clip-path: inset()` on that `<g>` works in Chromium and WebKit because its rect children give it a box. A stack crossing zero (`stack: 'center'`) gets `--oc-stack-from`, the starting inset that collapses the clip onto the baseline, so it grows both ways from zero. The baseline comes from `RectMark.baseline`, which the bar/column computes set; unstacked bars get the same treatment through `--oc-bar-from` on the shape. Value labels don't move: the `label` role fades each one in place once the bar (or stack) at its `--oc-mark-index` reaches 0.995, within a pixel of its end, so a label never floats ahead of its mark. Stacked labels carry the stack's index, faceted labels add the panel's `markIndexOffset`. Pie labels use `arc-label`, anchored on their own slice. Separate positive/negative groups can't do this: the middle segment straddles zero, so either group's box starts past the baseline.

## Orientation

Bar orientation comes from the engine via `RectMark.orient` (`'horizontal' | 'vertical'`), set based on encoding (x: quantitative = horizontal bar, y: quantitative = vertical column). Don't infer from geometry (`width > height`) because grouped columns with short bars get misclassified. The renderer puts `data-orient="horizontal"` on the mark group and CSS switches between `oc-enter-bar` (bottom-to-top) and `oc-enter-bar-h` (left-to-right).

## Update/Exit Transitions

Data-update transitions live in `packages/vanilla/src/transition/` (barrel: `transition.ts`) and use a rAF loop, not CSS animations. This is a fundamentally different mechanism from the CSS-based entrance animations.

**rAF-not-CSS rationale.** Entrance animations are fire-and-forget: CSS keyframes handle them with zero JS per frame. Update transitions need to interpolate between two computed layouts (prev geometry -> next geometry), which requires reading layout data and writing SVG attributes per frame. CSS can't do that.

**FLIP-from-layout (never measure DOM).** The transition driver reads geometry from `ChartLayout` objects (prev and next), not from DOM measurements. The engine already computed exact pixel positions; the driver interpolates between them. Never call `getBBox()` or `getBoundingClientRect()` during a transition frame.

**Cancellation lives in render() and why.** `render()` tears down the SVG and rebuilds from scratch. Any in-flight transition must be cancelled before teardown, otherwise the rAF callback writes to removed DOM nodes. The cancel path: `render()` calls `transitionHandle.cancel()`, which stops the rAF loop, snaps to final geometry, and removes ghosts.

**Synchronous from-state rule.** All tween from-states are applied synchronously before the first `requestAnimationFrame`. This prevents a flash of final-state on the first frame. The SVG is already rendered from `nextLayout`, so without this step elements would appear at their final positions for one frame before snapping to the from-state.

**Ghost pattern.** Exiting marks get ghost elements: clones rendered from `prevLayout` mark data, appended to the marks container. Ghosts:
- Have `.oc-ghost` class, `aria-hidden="true"`, `pointer-events: none`
- Do NOT have `data-key` (prevents key-matching with real elements)
- For gradient fills: gradient defs are built into the new SVG's `<defs>` so ghost `url(#id)` references resolve correctly
- Are removed after the transition completes or is cancelled

**Never-tween-opacity-on-updates rule.** Updated marks (same key in prev and next) should NOT have their opacity tweened. The renderer may have set `opacity="0"` on points suppressed under endpoint markers. Tweening opacity would make those points flash visible during the transition. Only enter/exit tweens use opacity.

**Path-morph interruption.** Line snapshots retain sampled points and point keys, so the next update retargets from visible geometry when correspondence is available. Area snapshots (and line snapshots without point correspondence) retain the current path as a frozen ghost and crossfade to the new final path. Rects and points retarget from their sampled position. Preserve missing-observation gaps in both paths.

**Labels of entering marks wait.** `buildLabelMotion` (`transition/labels.ts`) holds the label of a mark that enters on an update at opacity 0 until the marks have landed, then fades it in place over `LABEL_FADE_MS` (260ms, the entrance's label fade). That tail extends the transition's `totalMs`, and an interrupting update carries the wait through the snapshot (`label:<key>:opacity`). Surviving labels ride their mark's geometry and are never faded.

**Arc transitions.** Pie/donut slices tween angles and radii (plus the pie center), rebuilding the path per frame via the engine's `buildArcPath` — geometry-based, so interruption retargets like rects (the snapshot stores angles/radii/center; no freeze-and-crossfade needed). Snap-to-final writes the engine's exact `mark.path`. Exiting slices ghost and collapse to their midpoint angle while fading. Sparklines are no longer excluded from transitions — a live-updating sparkline is the canonical real-time tile.

**Non-chart mounts.** Bar list, tile map, sankey and geo map tween updates with `runElementTweens` (`motion/element-tween.ts`), not the chart driver. Same rules: from-states applied synchronously, `url()` paints never interpolated, ghosts for removed elements via `makeGhost` (which re-homes gradient defs), the drawn state captured before `render()` snaps an in-flight tween, and `transition: none` on driven elements while the tween runs (hover transitions would trail every frame). Updates during a playing entrance snap, and a resize never tweens. Tables snap on update.
