/**
 * Legend rendering: swatches + labels with wrap/overflow handling, plus the
 * continuous variant (gradient bar / binned swatch row) for quantitative
 * color scales.
 */

import type {
  CategoricalLegendLayout,
  ContinuousLegendLayout,
  LegendLayout,
  SizeLegendLayout,
  TextStyle,
} from '@opendata-ai/openchart-core';
import { estimateTextWidth } from '@opendata-ai/openchart-core';
import { nextSvgId } from '../svg-ids';
import { applyTextStyle, createSVGElement, setAttrs } from './svg-dom';

/** Minimum legend hit-target height in px (WCAG 2.2 SC 2.5.8). */
const LEGEND_HIT_HEIGHT = 24;
/** Horizontal slack on each side of the legend hit rect. */
const LEGEND_HIT_PAD = 4;

function isCategorical(legend: LegendLayout): legend is CategoricalLegendLayout {
  return !legend.type || legend.type === 'categorical';
}

/**
 * Detached "no data" swatch + label, set only by maps with unjoined features.
 * Not an entry: it carries no toggle role and no `data-legend-index`.
 *
 * The categorical legend passes a chip (rounded corners, label on the slot's
 * centerline) so the swatch matches its neighbouring entries; the continuous
 * legend keeps the crisp full-height square that matches the color bar.
 */
function renderNoDataSwatch(
  parent: SVGElement,
  noData: NonNullable<CategoricalLegendLayout['noData']>,
  labelStyle: TextStyle,
  chip?: { rx: number; baseline: string },
): void {
  const swatch = createSVGElement('rect');
  swatch.setAttribute('class', 'oc-legend-nodata');
  setAttrs(swatch, {
    x: noData.x,
    y: noData.y,
    width: noData.size,
    height: noData.size,
    fill: noData.fill,
    ...(chip ? { rx: chip.rx, ry: chip.rx } : { 'shape-rendering': 'crispEdges' }),
  });
  parent.appendChild(swatch);

  const label = createSVGElement('text');
  setAttrs(label, {
    x: noData.labelX,
    y: noData.labelY,
    'text-anchor': 'start',
    ...(chip ? { 'dominant-baseline': chip.baseline } : {}),
  });
  applyTextStyle(label, labelStyle);
  label.textContent = noData.label;
  parent.appendChild(label);
}

/**
 * Render a continuous color legend: a gradient-filled bar (gradient mode) or
 * a contiguous swatch row (binned mode) with value labels below.
 *
 * The gradient ID comes from the shared `nextSvgId` counter like every other
 * gradient/clip-path def, so IDs stay deterministic at generation time.
 */
function renderContinuousLegend(parent: SVGElement, legend: ContinuousLegendLayout): void {
  if (legend.bounds.width <= 0 || legend.bounds.height <= 0) return;

  const g = createSVGElement('g');
  g.setAttribute('class', 'oc-legend oc-legend--continuous');
  g.setAttribute('role', 'img');
  const first = legend.ticks[0];
  const last = legend.ticks[legend.ticks.length - 1];
  if (first && last) {
    g.setAttribute('aria-label', `Color scale from ${first.label} to ${last.label}`);
  } else {
    g.setAttribute('aria-label', 'Color scale');
  }

  if (legend.mode === 'gradient') {
    // linearGradient def + one rect. Defs may already exist (clip paths).
    let defs: SVGElement | null = parent.querySelector('defs');
    if (!defs) {
      defs = createSVGElement('defs');
      parent.insertBefore(defs, parent.firstChild);
    }
    const gradientId = nextSvgId('oc-legend-gradient');
    const grad = createSVGElement('linearGradient');
    grad.setAttribute('id', gradientId);
    setAttrs(grad, { x1: '0%', y1: '0%', x2: '100%', y2: '0%' });
    for (const stop of legend.colorStops) {
      const s = createSVGElement('stop');
      const attrs: Record<string, string | number> = {
        offset: `${stop.offset * 100}%`,
        'stop-color': stop.color,
      };
      if (stop.opacity !== undefined) attrs['stop-opacity'] = stop.opacity;
      setAttrs(s, attrs);
      grad.appendChild(s);
    }
    defs.appendChild(grad);

    const bar = createSVGElement('rect');
    bar.setAttribute('class', 'oc-legend-gradient-bar');
    setAttrs(bar, {
      x: legend.bar.x,
      y: legend.bar.y,
      width: legend.bar.width,
      height: legend.bar.height,
      rx: 2,
      ry: 2,
      fill: `url(#${gradientId})`,
    });
    g.appendChild(bar);
  } else {
    // Binned: contiguous class swatches, square-cornered (Datawrapper-style).
    // `crispEdges` keeps the seams between classes on whole pixels; at 12px
    // tall an antialiased seam reads as a sixth, paler class.
    for (let i = 0; i < legend.bins.length; i++) {
      const bin = legend.bins[i];
      const rect = createSVGElement('rect');
      rect.setAttribute('class', 'oc-legend-bin');
      setAttrs(rect, {
        x: bin.x,
        y: legend.bar.y,
        width: bin.width,
        height: legend.bar.height,
        fill: bin.color,
        'shape-rendering': 'crispEdges',
      });
      rect.setAttribute('data-bin-index', String(i));
      g.appendChild(rect);
    }
  }

  if (legend.title && legend.titleY !== undefined) {
    const title = createSVGElement('text');
    title.setAttribute('class', 'oc-legend-title');
    setAttrs(title, { x: legend.bar.x, y: legend.titleY, 'text-anchor': 'start' });
    applyTextStyle(title, legend.titleStyle ?? legend.labelStyle);
    title.textContent = legend.title;
    g.appendChild(title);
  }

  for (const tick of legend.ticks) {
    const label = createSVGElement('text');
    setAttrs(label, { x: tick.x, y: legend.labelY, 'text-anchor': tick.anchor });
    applyTextStyle(label, legend.labelStyle);
    label.textContent = tick.label;
    g.appendChild(label);
  }

  if (legend.noData) {
    renderNoDataSwatch(g, legend.noData, legend.labelStyle);
  }

  parent.appendChild(g);
}

/**
 * Render a size legend: graduated circles, nested (concentric, sharing a bottom
 * edge) so the ratio between magnitudes reads, not just their order.
 *
 * Emits **no** `data-legend-index`. That attribute is what
 * `wireLegendInteraction` sweeps up to wire click-to-toggle-series, and a size
 * circle is not a series -- clicking "500M" must not try to hide a series named
 * "500M". The circles are inert, and `aria-hidden` keeps them out of the AT tree
 * as decorative chrome (the values are already in each mark's aria label).
 */
function renderSizeLegend(parent: SVGElement, legend: SizeLegendLayout): void {
  if (legend.circles.length === 0) return;

  const g = createSVGElement('g');
  g.setAttribute('class', 'oc-legend oc-legend--size');
  // Decorative, not announced. `role="img"` + a bare "Size legend" label would
  // tell a screen-reader user a key exists while conveying none of the values it
  // keys -- pure noise. The magnitudes are already in each mark's own aria label,
  // which is where a non-sighted reader actually gets them.
  g.setAttribute('aria-hidden', 'true');

  // Absolute coordinates, NOT a group `transform`. `getBBox()` reports a group's
  // box in its own local space and ignores the group's transform, so a
  // translated legend measures as if it sat at the origin -- which is exactly
  // how a size/color legend collision slipped past the rendered-invariant
  // overlap checks. Every other legend bakes absolute coords into its children;
  // this one does too, so the same measurement sees it where it really is.
  const ox = legend.bounds.x;
  const oy = legend.bounds.y;
  const labelX = ox + legend.circles[0].cx + legend.circles[0].radius + 8;
  const leaderX = ox + legend.circles[0].cx + legend.circles[0].radius + 4;

  if (legend.title && legend.titleY !== undefined) {
    const title = createSVGElement('text');
    title.setAttribute('class', 'oc-legend-title');
    setAttrs(title, { x: ox, y: oy + legend.titleY, 'text-anchor': 'start' });
    applyTextStyle(title, legend.titleStyle ?? legend.labelStyle);
    title.textContent = legend.title;
    g.appendChild(title);
  }

  for (const circle of legend.circles) {
    const c = createSVGElement('circle');
    setAttrs(c, {
      cx: ox + circle.cx,
      cy: oy + circle.cy,
      r: circle.radius,
      fill: 'none',
      stroke: legend.stroke,
      'stroke-width': 1,
    });
    g.appendChild(c);

    // Leader line from the circle's top edge out to its label.
    const line = createSVGElement('line');
    setAttrs(line, {
      x1: ox + circle.cx,
      y1: oy + circle.cy - circle.radius,
      x2: leaderX,
      y2: oy + circle.cy - circle.radius,
      stroke: legend.stroke,
      'stroke-width': 1,
      'stroke-dasharray': '2 2',
    });
    g.appendChild(line);

    const label = createSVGElement('text');
    setAttrs(label, {
      x: labelX,
      y: oy + circle.labelY,
    });
    applyTextStyle(label, legend.labelStyle);
    label.textContent = circle.label;
    g.appendChild(label);
  }

  parent.appendChild(g);
}

export function renderLegend(parent: SVGElement, legend: LegendLayout): void {
  if (legend.type === 'continuous') {
    renderContinuousLegend(parent, legend);
    return;
  }
  if (legend.type === 'size') {
    renderSizeLegend(parent, legend);
    return;
  }
  if (!isCategorical(legend) || legend.entries.length === 0) return;

  const g = createSVGElement('g');
  g.setAttribute('class', 'oc-legend');
  // A group of toggle buttons, not a list: each entry is an interactive
  // control with aria-pressed, and role="listitem" inside role="list" would
  // announce them as static content.
  g.setAttribute('role', 'group');
  g.setAttribute('aria-label', 'Chart legend');

  const isHorizontal =
    legend.position === 'top' || legend.position === 'top-left' || legend.position === 'bottom';
  const positions = 'entryPositions' in legend ? legend.entryPositions : undefined;
  let offsetX = legend.bounds.x;
  let offsetY = legend.bounds.y;

  for (let i = 0; i < legend.entries.length; i++) {
    const entry = legend.entries[i];

    const pos = positions?.[i];
    if (pos) {
      offsetX = pos.x;
      offsetY = pos.y;
    } else if (isHorizontal && i > 0) {
      const labelWidth = estimateTextWidth(
        entry.label,
        legend.labelStyle.fontSize,
        legend.labelStyle.fontWeight,
      );
      const entryWidth = legend.swatchSize + legend.swatchGap + labelWidth + legend.entryGap;
      if (offsetX + entryWidth > legend.bounds.x + legend.bounds.width) {
        offsetX = legend.bounds.x;
        offsetY += legend.swatchSize + 6;
      }
    }
    const entryG = createSVGElement('g');
    entryG.setAttribute('class', 'oc-legend-entry');
    entryG.setAttribute('data-legend-index', String(i));
    entryG.setAttribute('data-legend-label', entry.label);
    if (entry.overflow) {
      entryG.setAttribute('data-legend-overflow', 'true');
      entryG.setAttribute('aria-label', entry.label);
      entryG.setAttribute('opacity', '0.5');
    } else {
      const visible = entry.active !== false;
      entryG.setAttribute('role', 'button');
      entryG.setAttribute('tabindex', '0');
      entryG.setAttribute('aria-pressed', String(visible));
      // Read by the hover-emphasis controller, which must not touch a
      // toggled-off entry (it already carries opacity 0.3 as an attribute).
      entryG.setAttribute('data-legend-active', String(visible));
      entryG.setAttribute('aria-label', `${entry.label}: ${visible ? 'visible' : 'hidden'}`);
      entryG.setAttribute('style', 'cursor: pointer');

      // Apply dimming for inactive entries
      if (!visible) {
        entryG.setAttribute('opacity', '0.3');
      }

      // Transparent hit + focus target, at least 24px tall (WCAG 2.2 SC 2.5.8).
      // First child so it paints behind the swatch and label.
      const labelWidth = estimateTextWidth(
        entry.label,
        legend.labelStyle.fontSize,
        legend.labelStyle.fontWeight,
      );
      const hit = createSVGElement('rect');
      hit.setAttribute('class', 'oc-legend-hit');
      setAttrs(hit, {
        x: offsetX - LEGEND_HIT_PAD,
        y: offsetY + legend.swatchSize / 2 - LEGEND_HIT_HEIGHT / 2,
        width: legend.swatchSize + legend.swatchGap + labelWidth + LEGEND_HIT_PAD * 2,
        height: LEGEND_HIT_HEIGHT,
        rx: 2,
        fill: 'transparent',
      });
      entryG.appendChild(hit);
    }

    // Swatch: bare colored mark matching the chart type.
    // Circle for point/scatter, line segment for line/area, filled rect for bar.
    const midX = offsetX + legend.swatchSize / 2;
    const midY = offsetY + legend.swatchSize / 2;
    if (entry.shape === 'circle') {
      const circle = createSVGElement('circle');
      setAttrs(circle, {
        cx: midX,
        cy: midY,
        r: legend.swatchSize / 2,
        fill: entry.color,
      });
      entryG.appendChild(circle);
    } else if (entry.shape === 'line') {
      const lineWidth = legend.swatchSize;
      const line = createSVGElement('line');
      line.setAttribute('class', 'oc-legend-swatch-line');
      setAttrs(line, {
        x1: offsetX,
        y1: midY,
        x2: offsetX + lineWidth,
        y2: midY,
        stroke: entry.color,
        'stroke-width': 2,
        'stroke-linecap': 'round',
      });
      entryG.appendChild(line);
    } else {
      const rectSize = Math.round(legend.swatchSize * 0.6);
      const rect = createSVGElement('rect');
      rect.setAttribute('class', 'oc-legend-swatch-rect');
      setAttrs(rect, {
        x: offsetX + (legend.swatchSize - rectSize) / 2,
        y: midY - rectSize / 2,
        width: rectSize,
        height: rectSize,
        rx: 2,
        ry: 2,
        fill: entry.color,
      });
      entryG.appendChild(rect);
    }

    // Label
    const label = createSVGElement('text');
    setAttrs(label, {
      x: offsetX + legend.swatchSize + legend.swatchGap,
      y: offsetY + legend.swatchSize / 2,
      'dominant-baseline': 'central',
    });
    applyTextStyle(label, legend.labelStyle);
    label.textContent = entry.label;
    entryG.appendChild(label);

    g.appendChild(entryG);

    if (!pos) {
      if (isHorizontal) {
        const labelWidth = estimateTextWidth(
          entry.label,
          legend.labelStyle.fontSize,
          legend.labelStyle.fontWeight,
        );
        const entryWidth = legend.swatchSize + legend.swatchGap + labelWidth + legend.entryGap;
        offsetX += entryWidth;
      } else {
        offsetY +=
          'rowHeight' in legend && legend.rowHeight
            ? legend.rowHeight
            : legend.swatchSize + legend.entryGap;
      }
    }
  }

  if (legend.noData) {
    renderNoDataSwatch(g, legend.noData, legend.labelStyle, { rx: 2, baseline: 'central' });
  }

  parent.appendChild(g);
}
