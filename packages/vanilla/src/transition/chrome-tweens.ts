import type { AxisLayout, ChartLayout } from '@opendata-ai/openchart-core';
import { serializeKeyValue } from '@opendata-ai/openchart-engine';

import type { MarkDomIndex } from './dom-index';
import { keyAnnotations } from './keys';
import type { Tween } from './types';

// ---------------------------------------------------------------------------
// Color tween building
// ---------------------------------------------------------------------------

/**
 * The child element a mark's `fill` or `stroke` is actually written to.
 *
 * Resolved per attribute, not once per mark: an area is two stacked paths, and
 * they do not carry the same channels. `renderAreaMark` appends the closed fill
 * shape first (`stroke: 'none'`) and the `.oc-area-top` line second -- that
 * second path is the only thing carrying the stroke, and it traces the data
 * points alone rather than the baseline. A blanket `querySelector` returns the
 * *first* match, so writing a stroke through it would paint an outline around
 * the whole closed area (baseline included) and `snapTweenToFinal` would leave
 * it there for good.
 */
export function markShapeElement(el: SVGElement, attr: 'fill' | 'stroke'): SVGElement {
  if (el.tagName === 'circle' || el.tagName === 'rect' || el.tagName === 'path') return el;
  if (attr === 'stroke') {
    const areaTop = el.querySelector('.oc-area-top') as SVGElement | null;
    if (areaTop) return areaTop;
  }
  return (el.querySelector('rect, path, circle, line') as SVGElement | null) ?? el;
}

/** Gradient fills are `url(#id)` refs and cannot be interpolated numerically. */
export function isInterpolableColor(v: unknown): v is string {
  return typeof v === 'string' && v !== '' && v !== 'none' && !v.startsWith('url(');
}

/**
 * Build fill/stroke tweens for marks present in both layouts whose color moved.
 *
 * Mark-type agnostic on purpose: every mark carries `fill`/`stroke` resolved by
 * the compiler, so matching on `key` and diffing the two strings covers rects,
 * lines, areas and points in one pass. Marks whose color did not change emit no
 * tween, so the common data-update case costs nothing.
 */
export function buildColorTweens(
  prevLayout: ChartLayout,
  nextLayout: ChartLayout,
  dom: MarkDomIndex,
  tweens: Tween[],
): void {
  type Colored = { key?: string; fill?: unknown; stroke?: unknown };
  const prevByKey = new Map<string, Colored>();
  for (const m of prevLayout.marks as Colored[]) {
    if (m.key) prevByKey.set(m.key, m);
  }

  for (const next of nextLayout.marks as Colored[]) {
    if (!next.key) continue;
    const prev = prevByKey.get(next.key);
    if (!prev) continue;

    const group = dom.any(next.key);
    if (!group) continue;

    for (const attr of ['fill', 'stroke'] as const) {
      const from = prev[attr];
      const to = next[attr];
      if (from === to) continue;
      if (!isInterpolableColor(from) || !isInterpolableColor(to)) continue;
      tweens.push({
        tweenType: 'color',
        kind: 'update',
        el: markShapeElement(group, attr),
        attr,
        from,
        to,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Annotation tween building
// ---------------------------------------------------------------------------

/**
 * Build keyed enter/update/exit tweens for annotations.
 *
 * Follows the `buildAxisTweens` pattern rather than the mark builders': the
 * annotation group is a SIBLING of the clipped marks group, so it must be
 * queried from the `svg` root. A `marksContainer.querySelector` would never
 * find it.
 *
 * Surviving annotations tween from their old position to their new one via a
 * transform offset (the alternative -- re-resolving label x/y, connector path,
 * dot, subtitle and background rect individually -- is a lot of surface for no
 * extra fidelity). Entering ones fade in. See the note at the bottom for why
 * exiting ones do not fade out.
 */
export function buildAnnotationTweens(
  svg: SVGSVGElement,
  prevLayout: ChartLayout,
  nextLayout: ChartLayout,
  tweens: Tween[],
): void {
  const prev = prevLayout.annotations ?? [];
  const next = nextLayout.annotations ?? [];
  if (prev.length === 0 && next.length === 0) return;

  const container = svg.querySelector('.oc-annotations');
  if (!container) return;

  const prevByKey = new Map(keyAnnotations(prev).map((k, i) => [k, prev[i]]));
  const nextKeys = keyAnnotations(next);

  // The rendered DOM matches nextLayout, so index i is nextKeys[i].
  const els = container.querySelectorAll('.oc-annotation');

  for (let i = 0; i < next.length; i++) {
    const el = els[i] as SVGElement | undefined;
    if (!el) continue;
    const before = prevByKey.get(nextKeys[i]);

    if (!before) {
      // Entering: fade in on the annotation cadence.
      tweens.push({
        tweenType: 'annotation',
        kind: 'enter',
        el,
        fromDx: 0,
        fromDy: 0,
        fromOpacity: 0,
        toOpacity: 1,
      });
      continue;
    }

    // Surviving: hold at full opacity, slide from the old position if it moved.
    const dx = (before.label?.x ?? 0) - (next[i].label?.x ?? 0);
    const dy = (before.label?.y ?? 0) - (next[i].label?.y ?? 0);
    if (dx === 0 && dy === 0) continue;
    tweens.push({
      tweenType: 'annotation',
      kind: 'update',
      el,
      fromDx: dx,
      fromDy: dy,
    });
  }

  // Exiting annotations are NOT ghosted. render() has already torn down the old
  // SVG, so the removed node is gone and there is nothing left to clone -- the
  // elements still in the DOM belong to nextLayout, and cloning one by the old
  // index would ghost an annotation that actually survived. Building a faithful
  // ghost would mean re-rendering the annotation from prevLayout (the marks
  // path can do this via `renderSingleMark`; annotations have no such entry
  // point that takes a single ResolvedAnnotation).
  //
  // So a removed annotation disappears immediately. That matches the behavior
  // before this change and is not what the blink bug was about; adding a real
  // exit fade means exposing a single-annotation renderer first.
}

// ---------------------------------------------------------------------------
// Axis tick and gridline tween building
// ---------------------------------------------------------------------------

/**
 * Build tweens for axis tick labels and gridlines across both x and y axes.
 * Matches ticks by `data-tick-key` (stamped at render time).
 */
export function buildAxisTweens(
  svg: SVGSVGElement,
  prevLayout: ChartLayout,
  nextLayout: ChartLayout,
  tweens: Tween[],
  ghosts: SVGElement[],
): void {
  // Process each axis orientation
  buildSingleAxisTweens(svg, prevLayout.axes.x, nextLayout.axes.x, 'x', nextLayout, tweens, ghosts);
  buildSingleAxisTweens(svg, prevLayout.axes.y, nextLayout.axes.y, 'y', nextLayout, tweens, ghosts);
}

/**
 * Match an axis's gridlines between two layouts, keyed by TICK VALUE.
 *
 * Gridlines carry no key of their own, so identity is borrowed from the tick
 * that shares their position -- a value-keyed match, which is why a rescale
 * that keeps no tick values (900 -> 20) reads as a full fade-out/fade-in rather
 * than a slide, and why one that keeps them all slides even when every position
 * moved.
 *
 * The `g.position === tick.position` join is an exact float compare, which is
 * only safe because both arrays come out of the same scale call in the same
 * layout pass. Anything that recomputes gridline positions independently --
 * even via an algebraically identical expression -- would silently match
 * nothing and degrade every gridline to a fade.
 *
 * Pure so the canvas path can consume the same deltas without a DOM.
 */
export function computeGridlineDeltas(
  prevAxis: AxisLayout,
  nextAxis: AxisLayout,
): { prevGridByValue: Map<string, number>; nextGridByValue: Map<string, number> } {
  const byValue = (axis: AxisLayout): Map<string, number> => {
    const map = new Map<string, number>();
    for (const tick of axis.ticks) {
      const matching = axis.gridlines.find((g) => g.position === tick.position);
      if (matching) map.set(serializeKeyValue(tick.value), matching.position);
    }
    return map;
  };
  return { prevGridByValue: byValue(prevAxis), nextGridByValue: byValue(nextAxis) };
}

export function buildSingleAxisTweens(
  svg: SVGSVGElement,
  prevAxis: AxisLayout | undefined,
  nextAxis: AxisLayout | undefined,
  orientation: 'x' | 'y',
  layout: ChartLayout,
  tweens: Tween[],
  ghosts: SVGElement[],
): void {
  if (!prevAxis || !nextAxis) return;

  const axisClass = `oc-axis-${orientation}`;
  const axisGroup = svg.querySelector(`.${axisClass}`) as SVGElement | null;
  if (!axisGroup) return;

  const isRotated = !!(nextAxis.tickAngle && Math.abs(nextAxis.tickAngle) > 10);

  // Build tick value -> position maps from layouts (NOT from DOM)
  const prevTickMap = new Map<string, number>();
  for (const tick of prevAxis.ticks) {
    prevTickMap.set(serializeKeyValue(tick.value), tick.position);
  }
  const nextTickMap = new Map<string, number>();
  for (const tick of nextAxis.ticks) {
    nextTickMap.set(serializeKeyValue(tick.value), tick.position);
  }

  // Position attribute: 'x' for x-axis tick labels, 'y' for y-axis tick labels
  const posAttr = orientation === 'x' ? 'x' : 'y';

  // Tick labels
  const tickLabels = axisGroup.querySelectorAll('.oc-axis-tick[data-tick-key]');
  const matchedNextKeys = new Set<string>();

  for (const labelEl of tickLabels) {
    const key = labelEl.getAttribute('data-tick-key');
    if (!key) continue;

    const nextPos = nextTickMap.get(key);
    const prevPos = prevTickMap.get(key);

    if (prevPos !== undefined && nextPos !== undefined) {
      // Updated tick: slide to new position
      matchedNextKeys.add(key);
      tweens.push({
        tweenType: 'axisTick',
        kind: 'update',
        el: labelEl as SVGElement,
        posAttr,
        fromPos: prevPos,
        toPos: nextPos,
        crossfade: isRotated,
      });
    } else if (prevPos === undefined && nextPos !== undefined) {
      // Entering tick: fade in
      matchedNextKeys.add(key);
      tweens.push({
        tweenType: 'axisTick',
        kind: 'enter',
        el: labelEl as SVGElement,
        posAttr,
        fromPos: nextPos,
        toPos: nextPos,
        crossfade: false,
        fromOpacity: 0,
        toOpacity: 1,
      });
    }
    // Exiting ticks are handled below (they won't be in the new SVG's DOM,
    // so we clone from the prev state)
  }

  // Exiting tick labels: create ghost elements
  for (const [key, prevPos] of prevTickMap) {
    if (nextTickMap.has(key)) continue;
    // Find the tick label in the rendered SVG by data-tick-key
    // It won't be there since the SVG was already re-rendered from nextLayout,
    // so we need to create a ghost text element
    const prevTick = prevAxis.ticks.find((t) => serializeKeyValue(t.value) === key);
    if (!prevTick) continue;

    const ghost = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    ghost.setAttribute('class', 'oc-axis-tick oc-ghost');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.setAttribute('pointer-events', 'none');
    ghost.textContent = prevTick.label;
    // Copy positioning from prevAxis ticks
    const area = layout.area;
    if (orientation === 'x') {
      ghost.setAttribute('x', String(prevPos));
      const xLabelPad = nextAxis.labelPadding ?? layout.theme.spacing.xAxisLabelPadding;
      const fontSize = nextAxis.tickLabelStyle.fontSize;
      ghost.setAttribute('y', String(area.y + area.height + xLabelPad + fontSize * 0.8));
      ghost.setAttribute('text-anchor', 'middle');
    } else {
      const TICK_LABEL_OFFSET = 8;
      ghost.setAttribute('x', String(area.x - TICK_LABEL_OFFSET));
      ghost.setAttribute('y', String(prevPos));
      ghost.setAttribute('text-anchor', 'end');
      ghost.setAttribute('dominant-baseline', 'central');
    }
    axisGroup.appendChild(ghost);
    ghosts.push(ghost);

    tweens.push({
      tweenType: 'axisTick',
      kind: 'exit',
      el: ghost,
      posAttr,
      fromPos: prevPos,
      toPos: prevPos,
      crossfade: false,
      ghost,
      fromOpacity: 1,
      toOpacity: 0,
    });
  }

  // Gridlines
  const { prevGridByValue, nextGridByValue } = computeGridlineDeltas(prevAxis, nextAxis);

  const gridlines = axisGroup.querySelectorAll('.oc-gridline[data-tick-key]');

  for (const glEl of gridlines) {
    const key = glEl.getAttribute('data-tick-key');
    if (!key) continue;

    const nextPos = nextGridByValue.get(key);
    const prevPos = prevGridByValue.get(key);

    if (prevPos !== undefined && nextPos !== undefined) {
      tweens.push({
        tweenType: 'gridline',
        kind: 'update',
        el: glEl as SVGElement,
        orientation,
        fromPos: prevPos,
        toPos: nextPos,
      });
    } else if (prevPos === undefined && nextPos !== undefined) {
      tweens.push({
        tweenType: 'gridline',
        kind: 'enter',
        el: glEl as SVGElement,
        orientation,
        fromPos: nextPos,
        toPos: nextPos,
        fromOpacity: 0,
        toOpacity: 1,
      });
    }
  }

  // Exiting gridlines
  for (const [key, prevPos] of prevGridByValue) {
    if (nextGridByValue.has(key)) continue;

    const ghost = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    ghost.setAttribute('class', 'oc-gridline oc-ghost');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.setAttribute('pointer-events', 'none');
    if (orientation === 'y') {
      // Horizontal gridline at y=prevPos
      const area = layout.area;
      ghost.setAttribute('x1', String(area.x));
      ghost.setAttribute('y1', String(prevPos));
      ghost.setAttribute('x2', String(area.x + area.width));
      ghost.setAttribute('y2', String(prevPos));
    } else {
      // Vertical gridline at x=prevPos
      const area = layout.area;
      ghost.setAttribute('x1', String(prevPos));
      ghost.setAttribute('y1', String(area.y));
      ghost.setAttribute('x2', String(prevPos));
      ghost.setAttribute('y2', String(area.y + area.height));
    }
    axisGroup.appendChild(ghost);
    ghosts.push(ghost);

    tweens.push({
      tweenType: 'gridline',
      kind: 'exit',
      el: ghost,
      orientation,
      fromPos: prevPos,
      toPos: prevPos,
      ghost,
      fromOpacity: 1,
      toOpacity: 0,
    });
  }
}
