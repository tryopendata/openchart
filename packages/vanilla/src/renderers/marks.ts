/**
 * Mark rendering: dispatches to per-mark-type sub-renderers (line, area, rect,
 * arc, point, text, rule, tick).
 *
 * Mark renderers read module-level animation and gradient state so their
 * signatures stay `(mark, index) => SVGElement`. Callers must invoke
 * `setMarkRenderState()` before `renderMarks()` and `resetMarkRenderState()`
 * after.
 */

import type {
  ArcMark,
  AreaMark,
  ChartLayout,
  LineMark,
  Mark,
  PointMark,
  RectMark,
  ResolvedAnimation,
  ResolvedFillPattern,
  RuleMarkLayout,
  TextMarkLayout,
  TickMarkLayout,
} from '@opendata-ai/openchart-core';
import { resolveMarkFill } from '../gradient-utils';
import { resolvePatternFill } from '../pattern-utils';
import { applyTextStyle, createSVGElement, setAttrs } from './svg-dom';

/**
 * Module-level animation state. Set by the orchestrator before rendering marks
 * so mark renderers can read it without changing their function signatures.
 */
let currentAnimation: ResolvedAnimation | undefined;

/**
 * Module-level gradient map. Set by the orchestrator after building gradient defs
 * so mark renderers can resolve gradient fills without signature changes.
 */
let currentGradientMap: Map<string, string> = new Map();

/**
 * Module-level pattern map. Same lifecycle as the gradient map, built from
 * pattern defs (see pattern-utils.ts).
 */
let currentPatternMap: Map<string, string> = new Map();

/** Set animation + gradient + pattern state before rendering marks. */
export function setMarkRenderState(state: {
  animation: ResolvedAnimation | undefined;
  gradientMap: Map<string, string>;
  patternMap?: Map<string, string>;
}): void {
  currentAnimation = state.animation;
  currentGradientMap = state.gradientMap;
  currentPatternMap = state.patternMap ?? new Map();
}

/** Reset animation + gradient + pattern state after rendering. */
export function resetMarkRenderState(): void {
  currentAnimation = undefined;
  currentGradientMap = new Map();
  currentPatternMap = new Map();
}

/**
 * Resolve a filled mark's paint: the pattern url when the engine assigned a
 * fill pattern, the plain/gradient fill otherwise.
 */
function resolveFillOrPattern(
  fill: Parameters<typeof resolveMarkFill>[0],
  pattern: ResolvedFillPattern | undefined,
): string {
  if (pattern) return resolvePatternFill(pattern, currentPatternMap);
  return resolveMarkFill(fill, currentGradientMap);
}

/**
 * Stamp animation index attributes on a mark element when animation is enabled.
 * Sets `data-animation-index` (for querySelector) and `--oc-mark-index`
 * (for CSS calc-based stagger delay).
 */
function stampAnimationAttrs(
  el: SVGElement,
  mark: { animationIndex?: number; key?: string },
  fallbackIndex: number,
): void {
  // Stamp stable identity key for data-update transitions (always, not just enter)
  if (mark.key) {
    el.setAttribute('data-key', mark.key);
  }
  if (!currentAnimation?.enter) return;
  const idx = mark.animationIndex ?? fallbackIndex;
  el.setAttribute('data-animation-index', String(idx));
  (el as SVGElement & ElementCSSInlineStyle).style.setProperty('--oc-mark-index', String(idx));
}

type MarkRenderer<T extends Mark> = (mark: T, index: number) => SVGElement;

const markRenderers: Record<string, MarkRenderer<Mark>> = {};

/**
 * Register a mark renderer for a specific mark type.
 * Built-in renderers are registered below for all chart types.
 */
export function registerMarkRenderer<T extends Mark>(
  type: T['type'],
  renderer: MarkRenderer<T>,
): void {
  markRenderers[type] = renderer as MarkRenderer<Mark>;
}

function renderLineMark(mark: LineMark, index: number): SVGElement {
  const g = createSVGElement('g');
  g.setAttribute('data-mark-id', `line-${mark.seriesKey ?? index}`);
  g.setAttribute('class', 'oc-mark oc-mark-line');
  stampAnimationAttrs(g, mark, index);

  if (mark.points.length > 1) {
    const path = createSVGElement('path');
    // Use the pre-computed D3 curve path when available (smooth monotone),
    // otherwise fall back to straight M/L segments.
    const d =
      mark.path ?? mark.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    setAttrs(path, {
      d,
      fill: 'none',
      stroke: mark.stroke,
      'stroke-width': mark.strokeWidth,
      // Round joins/caps: at 2px a mitre on a sharp data spike renders as a
      // spur past the vertex, and a butt cap leaves a squared-off line end.
      'stroke-linejoin': 'round',
      'stroke-linecap': 'round',
    });
    if (mark.strokeDasharray) {
      path.setAttribute('stroke-dasharray', mark.strokeDasharray);
    }
    if (mark.opacity != null) {
      path.setAttribute('opacity', String(mark.opacity));
    }
    // Note: line drawing animation is handled via CSS clip-path on the group,
    // no inline dasharray/dashoffset needed.
    g.appendChild(path);
  }

  // Render end-of-line label if present and visible
  if (mark.label?.visible) {
    const label = createSVGElement('text');
    label.setAttribute('class', 'oc-mark-label');
    if (mark.seriesKey) {
      label.setAttribute('data-series', mark.seriesKey);
    }
    setAttrs(label, { x: mark.label.x, y: mark.label.y });
    applyTextStyle(label, mark.label.style);
    label.textContent = mark.label.text;
    g.appendChild(label);

    // Render connector line if label was offset from anchor
    if (mark.label.connector) {
      const connector = createSVGElement('line');
      connector.setAttribute('class', 'oc-mark-connector');
      setAttrs(connector, {
        x1: mark.label.connector.from.x,
        y1: mark.label.connector.from.y,
        x2: mark.label.connector.to.x,
        y2: mark.label.connector.to.y,
        stroke: mark.label.connector.stroke,
        'stroke-width': 1,
        'stroke-opacity': 0.5,
      });
      g.appendChild(connector);
    }
  }

  return g;
}

function renderAreaMark(mark: AreaMark, index: number): SVGElement {
  const g = createSVGElement('g');
  g.setAttribute('data-mark-id', `area-${mark.seriesKey ?? index}`);
  g.setAttribute('class', 'oc-mark oc-mark-area');
  stampAnimationAttrs(g, mark, index);

  if (mark.path) {
    // Area fill: the full closed shape (top line + baseline), no stroke
    const fill = createSVGElement('path');
    setAttrs(fill, {
      d: mark.path,
      fill: resolveFillOrPattern(mark.fill, mark.pattern),
      'fill-opacity': mark.fillOpacity,
      stroke: 'none',
    });
    g.appendChild(fill);

    // Top-line stroke: only along the data points, not the baseline
    if (mark.stroke && mark.topPath) {
      const strokePath = createSVGElement('path');
      strokePath.setAttribute('class', 'oc-area-top');
      setAttrs(strokePath, {
        d: mark.topPath,
        fill: 'none',
        stroke: mark.stroke,
        'stroke-width': mark.strokeWidth ?? 1,
        'stroke-linejoin': 'round',
        'stroke-linecap': 'round',
      });
      // Note: area drawing animation is handled via CSS clip-path on the group,
      // no inline dasharray/dashoffset needed.
      g.appendChild(strokePath);
    }
  }

  return g;
}

/**
 * Build an SVG path describing a rectangle with selectively rounded corners.
 * Used by stacked segments where only the leading edge (top of a vertical
 * stack, right of a horizontal stack) should round so the seams between
 * adjacent segments stay flush.
 */
export function rectPathWithCorners(
  mark: RectMark,
  sides: NonNullable<RectMark['cornerRadiusSides']>,
): string {
  const { x, y, width: w, height: h } = mark;
  // Clamp the radius so it never exceeds half of the shorter side, otherwise
  // the arcs would overlap and the path would render as a degenerate shape.
  const r = Math.max(0, Math.min(mark.cornerRadius ?? 0, w / 2, h / 2));
  const tl = sides.tl ? r : 0;
  const tr = sides.tr ? r : 0;
  const br = sides.br ? r : 0;
  const bl = sides.bl ? r : 0;
  return [
    `M${x + tl},${y}`,
    `H${x + w - tr}`,
    tr ? `A${tr},${tr} 0 0 1 ${x + w},${y + tr}` : '',
    `V${y + h - br}`,
    br ? `A${br},${br} 0 0 1 ${x + w - br},${y + h}` : '',
    `H${x + bl}`,
    bl ? `A${bl},${bl} 0 0 1 ${x},${y + h - bl}` : '',
    `V${y + tl}`,
    tl ? `A${tl},${tl} 0 0 1 ${x + tl},${y}` : '',
    'Z',
  ]
    .filter(Boolean)
    .join(' ');
}

function renderRectMark(mark: RectMark, index: number): SVGElement {
  const g = createSVGElement('g');
  g.setAttribute('data-mark-id', `rect-${index}`);
  g.setAttribute('class', 'oc-mark oc-mark-rect');
  stampAnimationAttrs(g, mark, index);
  // Use engine-provided orientation for animation direction
  if (currentAnimation?.enter && mark.orient === 'horizontal') {
    g.setAttribute('data-orient', 'horizontal');
  }

  // When `cornerRadiusSides` selects a subset of corners (e.g. top-only for
  // the topmost segment of a stacked column), SVG's `rx`/`ry` won't do —
  // it rounds all four corners or none. Emit a `<path>` with per-corner
  // arcs in that case so the stacked segments stay flush at the seam.
  const sides = mark.cornerRadiusSides;
  const partialCorners =
    !!sides && (!sides.tl || !sides.tr || !sides.br || !sides.bl) && !!mark.cornerRadius;
  const shapeEl = partialCorners ? createSVGElement('path') : createSVGElement('rect');
  if (partialCorners) {
    shapeEl.setAttribute('d', rectPathWithCorners(mark, sides));
  } else {
    setAttrs(shapeEl, {
      x: mark.x,
      y: mark.y,
      width: mark.width,
      height: mark.height,
    });
    if (mark.cornerRadius) {
      setAttrs(shapeEl, { rx: mark.cornerRadius, ry: mark.cornerRadius });
    }
  }
  shapeEl.setAttribute('fill', resolveFillOrPattern(mark.fill, mark.pattern));
  if (mark.stroke) {
    shapeEl.setAttribute('stroke', mark.stroke);
  }
  if (mark.strokeWidth) {
    shapeEl.setAttribute('stroke-width', String(mark.strokeWidth));
  }
  if (mark.shapeRendering) {
    shapeEl.setAttribute('shape-rendering', mark.shapeRendering);
  }
  g.appendChild(shapeEl);

  // Labels for rect marks are rendered in a dedicated overlay group by
  // renderMarks() so they always paint above all bars in SVG z-order.
  // See the two-pass logic in renderMarks() below.

  return g;
}

function renderArcMark(mark: ArcMark, index: number): SVGElement {
  const g = createSVGElement('g');
  g.setAttribute('data-mark-id', `arc-${index}`);
  g.setAttribute('class', 'oc-mark oc-mark-arc');
  g.setAttribute('transform', `translate(${mark.center.x},${mark.center.y})`);
  stampAnimationAttrs(g, mark, index);

  const path = createSVGElement('path');
  setAttrs(path, {
    d: mark.path,
    fill: resolveFillOrPattern(mark.fill, mark.pattern),
    stroke: mark.stroke,
    'stroke-width': mark.strokeWidth,
  });
  g.appendChild(path);

  // Render label if present and visible
  if (mark.label?.visible) {
    const label = createSVGElement('text');
    label.setAttribute('class', 'oc-mark-label');
    // Label position is in absolute coords, but we're in a translated group,
    // so subtract the center offset
    setAttrs(label, {
      x: mark.label.x - mark.center.x,
      y: mark.label.y - mark.center.y,
    });
    applyTextStyle(label, mark.label.style);
    label.textContent = mark.label.text;
    g.appendChild(label);
  }

  return g;
}

function renderPointMark(mark: PointMark, index: number): SVGElement {
  const circle = createSVGElement('circle');
  circle.setAttribute('data-mark-id', `point-${index}`);
  circle.setAttribute('class', 'oc-mark oc-mark-point');
  stampAnimationAttrs(circle, mark, index);

  setAttrs(circle, {
    cx: mark.cx,
    cy: mark.cy,
    r: mark.r,
    fill: resolveMarkFill(mark.fill, currentGradientMap),
    stroke: mark.stroke,
    'stroke-width': mark.strokeWidth,
  });
  if (mark.fillOpacity !== undefined) {
    circle.setAttribute('fill-opacity', String(mark.fillOpacity));
  }
  return circle;
}

function renderTextMark(mark: TextMarkLayout, index: number): SVGElement {
  const text = createSVGElement('text');
  text.setAttribute('data-mark-id', `textMark-${index}`);
  text.setAttribute('class', 'oc-mark oc-mark-text');
  stampAnimationAttrs(text, mark, index);

  setAttrs(text, {
    x: mark.x,
    y: mark.y,
    'font-size': mark.fontSize,
    'text-anchor': mark.textAnchor,
  });
  // Only when set: calendar and parliament text marks hand-compute their y
  // against the default alphabetic baseline, so stamping one would shift them.
  if (mark.dominantBaseline) {
    text.setAttribute('dominant-baseline', mark.dominantBaseline);
  }
  (text as SVGElement & ElementCSSInlineStyle).style.setProperty('fill', mark.fill);
  if (mark.fontWeight) {
    text.setAttribute('font-weight', String(mark.fontWeight));
  }
  if (mark.fontFamily) {
    text.setAttribute('font-family', mark.fontFamily);
  }
  if (mark.angle) {
    text.setAttribute('transform', `rotate(${mark.angle}, ${mark.x}, ${mark.y})`);
  }
  text.textContent = mark.text;
  return text;
}

function renderRuleMark(mark: RuleMarkLayout, index: number): SVGElement {
  const line = createSVGElement('line');
  line.setAttribute('data-mark-id', `rule-${index}`);
  line.setAttribute('class', 'oc-mark oc-mark-rule');
  stampAnimationAttrs(line, mark, index);

  setAttrs(line, {
    x1: mark.x1,
    y1: mark.y1,
    x2: mark.x2,
    y2: mark.y2,
    stroke: mark.stroke,
    'stroke-width': mark.strokeWidth,
  });
  if (mark.strokeDasharray) {
    line.setAttribute('stroke-dasharray', mark.strokeDasharray);
  }
  if (mark.strokeOpacity != null) {
    line.setAttribute('stroke-opacity', String(mark.strokeOpacity));
  }
  if (mark.opacity != null) {
    line.setAttribute('opacity', String(mark.opacity));
  }
  return line;
}

function renderTickMark(mark: TickMarkLayout, index: number): SVGElement {
  const line = createSVGElement('line');
  line.setAttribute('data-mark-id', `tick-${index}`);
  line.setAttribute('class', 'oc-mark oc-mark-tick');
  stampAnimationAttrs(line, mark, index);

  // Tick is a short line segment centered at (x, y)
  const half = mark.length / 2;
  if (mark.orient === 'vertical') {
    setAttrs(line, {
      x1: mark.x,
      y1: mark.y - half,
      x2: mark.x,
      y2: mark.y + half,
      stroke: mark.stroke,
      'stroke-width': mark.strokeWidth,
    });
  } else {
    setAttrs(line, {
      x1: mark.x - half,
      y1: mark.y,
      x2: mark.x + half,
      y2: mark.y,
      stroke: mark.stroke,
      'stroke-width': mark.strokeWidth,
    });
  }

  if (mark.opacity != null) {
    line.setAttribute('opacity', String(mark.opacity));
  }
  return line;
}

// Register built-in renderers
registerMarkRenderer('line', renderLineMark as MarkRenderer<Mark>);
registerMarkRenderer('area', renderAreaMark as MarkRenderer<Mark>);
registerMarkRenderer('rect', renderRectMark as MarkRenderer<Mark>);
registerMarkRenderer('arc', renderArcMark as MarkRenderer<Mark>);
registerMarkRenderer('point', renderPointMark as MarkRenderer<Mark>);
registerMarkRenderer('textMark', renderTextMark as MarkRenderer<Mark>);
registerMarkRenderer('rule', renderRuleMark as MarkRenderer<Mark>);
registerMarkRenderer('tick', renderTickMark as MarkRenderer<Mark>);

/**
 * Render a single mark to an SVG element without appending it anywhere.
 * Used by the transition module to create ghost elements for exiting marks.
 */
export function renderSingleMark(mark: Mark, index: number): SVGElement | undefined {
  const renderer = markRenderers[mark.type];
  if (!renderer) return undefined;
  return renderer(mark, index);
}

/** Extract series name from a mark for legend toggle matching. */
function getMarkSeries(mark: Mark): string | undefined {
  // Line and area marks have an explicit seriesKey
  if (mark.type === 'line' || mark.type === 'area') {
    return mark.seriesKey;
  }
  // Rect/arc/point marks carry an explicit seriesKey whenever a color field
  // groups them. It is the authoritative value: the aria fallback below yields
  // "Jan, US" for a grouped bar, which matches no legend entry.
  const explicitSeries = (mark as { seriesKey?: string }).seriesKey;
  if (explicitSeries) {
    return explicitSeries;
  }
  // For arc marks, the category name is the first part of the aria label (before ':')
  if (mark.type === 'arc') {
    const label = mark.aria.label;
    if (!label) return undefined;
    const i = label.indexOf(':');
    return (i === -1 ? label : label.slice(0, i)).trim();
  }
  // For rect/point, the aria label may be "category: value" or "category, group: value".
  // The series name is the category part (before the colon).
  if (mark.aria?.label) {
    const label = mark.aria.label;
    const i = label.indexOf(':');
    const beforeColon = (i === -1 ? label : label.slice(0, i)).trim();
    if (beforeColon) return beforeColon;
  }
  return undefined;
}

/**
 * Render chart marks into `parent`.
 *
 * Returns an optional overlay group containing rect mark value labels.
 * The caller should append this group to the outer SVG (outside any clip path)
 * so tall labels above near-full-height bars are not clipped by the chart-area
 * clip path that constrains the marks themselves.
 */
export function renderMarks(
  parent: SVGElement,
  layout: ChartLayout,
  opts?: { skipPoints?: boolean },
): SVGElement | undefined {
  const g = createSVGElement('g');
  g.setAttribute('class', 'oc-marks');

  for (let i = 0; i < layout.marks.length; i++) {
    const mark = layout.marks[i];
    // Canvas mark mode paints point marks on the canvas layer instead. The
    // point renderer stays registered: SVG mode, exit ghosts, and full-fidelity
    // exports all still go through it.
    if (opts?.skipPoints && mark.type === 'point') continue;
    const renderer = markRenderers[mark.type];
    if (!renderer) continue;

    const el = renderer(mark, i);
    // Decorative marks (e.g. sparkline endpoint dots) are hidden from
    // assistive tech because they duplicate an existing data point.
    if (mark.aria?.decorative) {
      el.setAttribute('aria-hidden', 'true');
    } else if (mark.aria?.label) {
      el.setAttribute('aria-label', mark.aria.label);
    }
    // Add data-series attribute for legend toggle matching
    const series = getMarkSeries(mark);
    if (series) {
      el.setAttribute('data-series', series);
    }

    // For stacked segments, set stack position for sequential animation chaining.
    // stackPos is computed by the engine on RectMark during compilation.
    if (currentAnimation?.enter && mark.type === 'rect') {
      const rect = mark as RectMark;
      if (rect.stackGroup && rect.stackPos !== undefined) {
        el.setAttribute('data-stack-pos', String(rect.stackPos));
        (el as SVGElement & ElementCSSInlineStyle).style.setProperty(
          '--oc-stack-pos',
          String(rect.stackPos),
        );
      }
    }

    g.appendChild(el);
  }

  parent.appendChild(g);

  // Second pass: render rect mark labels in a dedicated overlay group so they
  // always paint above all bars in SVG z-order. On grouped column charts, a
  // later-rendered bar can otherwise paint over a label from an adjacent column
  // when the label extends into a neighbor's airspace.
  //
  // Each overlay label gets --oc-mark-index stamped directly on it so the CSS
  // animation delay calc (which reads that property) works without inheriting
  // from a parent group.
  let labelsGroup: SVGElement | undefined;
  for (let i = 0; i < layout.marks.length; i++) {
    const mark = layout.marks[i];
    if (mark.type !== 'rect') continue;
    const rect = mark as RectMark;
    if (!rect.label?.visible) continue;

    if (!labelsGroup) {
      labelsGroup = createSVGElement('g');
      labelsGroup.setAttribute('class', 'oc-mark-labels');
    }

    const label = createSVGElement('text');
    label.setAttribute('class', 'oc-mark-label');
    setAttrs(label, { x: rect.label.x, y: rect.label.y });
    applyTextStyle(label, rect.label.style);
    label.textContent = rect.label.text;

    // Stamp animation index so the CSS stagger delay works for overlay labels
    // (they're not children of a .oc-mark-rect group that carries --oc-mark-index).
    if (currentAnimation?.enter) {
      const idx = rect.animationIndex ?? i;
      label.setAttribute('data-animation-index', String(idx));
      (label as SVGElement & ElementCSSInlineStyle).style.setProperty(
        '--oc-mark-index',
        String(idx),
      );
    }

    labelsGroup.appendChild(label);
  }

  return labelsGroup;
}
