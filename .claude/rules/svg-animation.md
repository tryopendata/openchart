# SVG Animation

The animation system lives across the CSS partials in `packages/core/src/styles/` (keyframes in `keyframes.css`, animation rules in `animation.css`), `packages/vanilla/src/svg-renderer.ts` (DOM attributes + CSS custom properties), `packages/vanilla/src/mount.ts` (lifecycle), and `packages/engine/src/compiler/animation.ts` (spec resolution + defaults).

## How It Works

Animations are pure CSS. The engine resolves the spec into a `ResolvedAnimation` config, the renderer stamps CSS custom properties and data attributes on the SVG, and the CSS keyframes do the rest. No WAAPI, no JS animation libraries.

The `oc-animate` class on the SVG root scopes all animation rules. It gets added before the SVG enters the DOM (to avoid a flash of final state) and removed after animations complete via a computed timeout.

## SVG Is Not HTML

These will bite you if you assume SVG elements behave like HTML elements.

**`clip-path: inset()` on `<g>` does nothing.** SVG groups have no intrinsic bounding box, so percentage-based insets resolve to zero. Apply clip-path to individual child elements (rect, path, circle), not groups. Groups containing `<path>` children sometimes work because the path provides a box, but don't count on it.

**CSS `transform` replaces SVG `transform` attributes.** An element with `<g transform="translate(100,50)">` can't also have `transform: scale(0.5)` in CSS. They occupy the same slot and CSS wins, displacing the element. Arc/pie marks use SVG translate for positioning, so only use opacity animations on those.

**Point marks are bare `<circle>` elements, not wrapped in `<g>`.** The CSS selector `.oc-mark-point circle` doesn't match because the circle IS the `.oc-mark-point` element. Use `circle.oc-mark-point` instead. Other marks (rect, line, area, arc) are wrapped in `<g>` groups. Always verify DOM structure before writing selectors.

## Mount Lifecycle

**`oc-animate` goes on before DOM insertion.** The renderer accepts `{ animate: true }` from mount.ts. If you add the class after `appendChild`, elements flash in their final state for one frame before `animation-fill-mode: both` kicks in.

**ResizeObserver fires on first layout, not just resizes.** When the SVG enters the DOM, the observer fires immediately. If the callback triggers `render()`, it tears down the animated SVG and rebuilds without animation. That's why `resize()` bails out when `cleanupAnimations` is set.

**React StrictMode double-mounts.** Mount, destroy, mount. Each `createChart()` call gets a fresh closure with its own `isFirstRender` flag. Don't use DOM attributes to track animation state across closures because they persist through destroy+remount but the SVG doesn't.

## Animation Cleanup

Don't use `animationend` events. The event fires per-element, so the first staggered element to finish would trigger cleanup while the rest are still running. Instead, compute total time: `lastElementStagger + duration + annotationDelay + 500ms buffer`, then `setTimeout` to remove `oc-animate`.

`setupAnimationCleanup()` accepts an `onComplete` callback that fires only on natural completion (timer expiry), not on cancellation. Mount uses this to null out the cleanup reference and replay any resize that was skipped during the animation window. The cancellation path (returned cleanup function) clears the timer and cancels CSS animations but does not fire `onComplete`, so destroy logic stays simple and doesn't trigger resize side effects.

## Stacked Bar Sequencing

Stacked bars chain segment animations so the full bar reveals as one fluid sweep. Each segment gets a `--oc-stack-pos` (0, 1, 2...) and the renderer computes `--oc-stack-segment-duration` as `duration / maxSegments`. Delay for each segment = category stagger + (position * segment duration).

The segments must use `animation-timing-function: linear`. Non-linear easing (smooth, snappy) creates jitter at segment handoffs because segment N decelerates while segment N+1 accelerates. Linear keeps constant velocity across the whole bar.

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

**Path-morph freeze-and-crossfade on interruption.** When `.update()` is called while a line/area series is mid-morph, the interpolated point array matches neither layout's data. Re-matching is intractable. Instead: `snapshot()` captures the current interpolated path `d` string, creates a ghost carrying that frozen path, crossfades to the new final path. Rects/points retarget smoothly from their current interpolated position.
