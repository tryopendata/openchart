/**
 * Layout invariant assertions.
 *
 * Extracts bounding boxes from a compiled ChartLayout and checks that
 * layout elements don't overlap where they shouldn't.
 */

import type {
  CategoricalLegendLayout,
  ChartLayout,
  LegendLayout,
  Rect,
} from '@opendata-ai/openchart-core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NamedRect extends Rect {
  name: string;
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

function isCategoricalLegend(legend: LegendLayout): legend is CategoricalLegendLayout {
  return 'entries' in legend && (!legend.type || legend.type === 'categorical');
}

/**
 * Every legend on the layout. Falls back to the singular `legend` slot so this
 * still works against layouts built by older code paths (and by tests that
 * hand-assemble a ChartLayout).
 */
function allLegends(layout: ChartLayout): LegendLayout[] {
  if (layout.legends?.length) return layout.legends;
  return layout.legend ? [layout.legend] : [];
}

// ---------------------------------------------------------------------------
// Box extraction
// ---------------------------------------------------------------------------

const CHROME_KEYS = [
  'eyebrow',
  'title',
  'subtitle',
  'source',
  'byline',
  'footer',
  'brand',
] as const;

/**
 * Extracts every layout element's bounding box as a NamedRect.
 */
export function extractBoxes(layout: ChartLayout): NamedRect[] {
  const boxes: NamedRect[] = [];

  // Chart area
  boxes.push({ ...layout.area, name: 'chartArea' });

  // Legend bounds -- EVERY legend, not just the primary. A chart can carry both
  // a color legend and a size legend; registering only `layout.legend` would
  // leave the overlap invariants blind to exactly the element most likely to be
  // mis-reserved, and they would pass a chart whose size legend sits on the plot.
  for (const legend of allLegends(layout)) {
    const suffix = legend.channel && legend.channel !== 'color' ? `-${legend.channel}` : '';
    boxes.push({ ...legend.bounds, name: `legend${suffix}` });

    // Legend entry positions (categorical only)
    if (isCategoricalLegend(legend) && legend.entryPositions) {
      const rowHeight = legend.rowHeight ?? 16;
      for (let i = 0; i < legend.entryPositions.length; i++) {
        const pos = legend.entryPositions[i];
        boxes.push({
          x: pos.x,
          y: pos.y,
          width: pos.width,
          height: rowHeight,
          name: `legend${suffix}-entry-${i}`,
        });
      }
    }
  }

  // X-axis label band
  if (layout.axes.x?.extent && layout.axes.x.extent > 0) {
    boxes.push({
      x: layout.area.x,
      y: layout.area.y + layout.area.height,
      width: layout.area.width,
      height: layout.axes.x.extent,
      name: 'x-axis-labels',
    });
  }

  // Y-axis label band
  if (layout.axes.y?.extent && layout.axes.y.extent > 0) {
    boxes.push({
      x: layout.area.x - layout.axes.y.extent,
      y: layout.area.y,
      width: layout.axes.y.extent,
      height: layout.area.height,
      name: 'y-axis-labels',
    });
  }

  // Chrome elements store y as the TOP edge of the text box (renderers convert
  // to the alphabetic baseline via textAscent), so y is the box top directly.
  for (const key of CHROME_KEYS) {
    const el = layout.chrome[key];
    if (el) {
      const h = el.style.fontSize * el.style.lineHeight;
      boxes.push({ x: el.x, y: el.y, width: el.maxWidth, height: h, name: key });
    }
  }

  // Annotation bounds
  for (let i = 0; i < layout.annotations.length; i++) {
    const annotation = layout.annotations[i];
    if (annotation.bounds) {
      boxes.push({ ...annotation.bounds, name: `annotation-${i}` });
    }
  }

  // Endpoint labels
  if (layout.endpointLabels?.bounds) {
    boxes.push({ ...layout.endpointLabels.bounds, name: 'endpoint-labels' });
  }

  return boxes;
}

// ---------------------------------------------------------------------------
// Overlap check
// ---------------------------------------------------------------------------

/**
 * Throws if two rects overlap by more than epsilon pixels.
 */
export function assertNoOverlap(a: NamedRect, b: NamedRect, epsilon = 0.5): void {
  const overlaps =
    a.x < b.x + b.width - epsilon &&
    a.x + a.width > b.x + epsilon &&
    a.y < b.y + b.height - epsilon &&
    a.y + a.height > b.y + epsilon;

  if (overlaps) {
    throw new Error(
      `Overlap detected between "${a.name}" and "${b.name}": ` +
        `a=${JSON.stringify({ x: a.x, y: a.y, width: a.width, height: a.height })}, ` +
        `b=${JSON.stringify({ x: b.x, y: b.y, width: b.width, height: b.height })}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Containment helper
// ---------------------------------------------------------------------------

function isContained(inner: Rect, outer: Rect, tolerance: number): boolean {
  return (
    inner.x >= outer.x - tolerance &&
    inner.y >= outer.y - tolerance &&
    inner.x + inner.width <= outer.x + outer.width + tolerance &&
    inner.y + inner.height <= outer.y + outer.height + tolerance
  );
}

function rectsOverlap(a: Rect, b: Rect, epsilon: number): boolean {
  return (
    a.x < b.x + b.width - epsilon &&
    a.x + a.width > b.x + epsilon &&
    a.y < b.y + b.height - epsilon &&
    a.y + a.height > b.y + epsilon
  );
}

function formatRect(r: Rect): string {
  return JSON.stringify({ x: r.x, y: r.y, width: r.width, height: r.height });
}

// ---------------------------------------------------------------------------
// Full invariant check
// ---------------------------------------------------------------------------

/**
 * Returns a list of violation strings. Empty when clean.
 */
export function checkLayoutInvariants(
  layout: ChartLayout,
  opts: { svgWidth: number; svgHeight: number },
): string[] {
  const violations: string[] = [];

  // 1. No legend intrudes into chartArea (top/bottom only; right/bottom-right
  //    use area.width reduction, so overlap is a horizontal concern checked by rule 4)
  //
  //    Checked for EVERY legend and every legend type. A size legend is not
  //    categorical, and it is the one whose space is most likely to be
  //    under-reserved -- gating this on `isCategoricalLegend` would skip it.
  for (const legend of allLegends(layout)) {
    if (legend.bounds.width <= 0 || legend.bounds.height <= 0) continue;
    const pos = legend.position;
    if (pos === 'top' || pos === 'bottom') {
      if (rectsOverlap(legend.bounds, layout.area, 0.5)) {
        const name = legend.channel ?? 'color';
        violations.push(
          `${name} legend intrudes into chartArea: legend=${formatRect(legend.bounds)} chartArea=${formatRect(layout.area)}`,
        );
      }
    }
  }

  // 1b. Legends don't overlap each other.
  const legends = allLegends(layout).filter((l) => l.bounds.width > 0 && l.bounds.height > 0);
  for (let i = 0; i < legends.length; i++) {
    for (let j = i + 1; j < legends.length; j++) {
      if (rectsOverlap(legends[i].bounds, legends[j].bounds, 0.5)) {
        violations.push(
          `legends overlap: ${legends[i].channel ?? 'color'}=${formatRect(legends[i].bounds)} ${legends[j].channel ?? 'color'}=${formatRect(legends[j].bounds)}`,
        );
      }
    }
  }

  // 2. Every legend entryPosition box lies inside legend bounds
  if (isCategoricalLegend(layout.legend) && layout.legend.entryPositions) {
    const rowHeight = layout.legend.rowHeight ?? 16;
    // Entry width includes trailing entryGap; the last entry in a row doesn't
    // need that gap to fit inside bounds, so allow entryGap as extra tolerance.
    const gapTolerance = layout.legend.entryGap + 1;
    for (let i = 0; i < layout.legend.entryPositions.length; i++) {
      const pos = layout.legend.entryPositions[i];
      const entryBox: Rect = {
        x: pos.x,
        y: pos.y,
        width: pos.width,
        height: rowHeight,
      };
      if (!isContained(entryBox, layout.legend.bounds, gapTolerance)) {
        violations.push(
          `legend entry ${i} outside legend bounds: entry=${formatRect(entryBox)} bounds=${formatRect(layout.legend.bounds)}`,
        );
      }
    }
  }

  // 3. X-axis label band doesn't intersect bottom chrome
  const xExtent = layout.axes.x?.extent;
  if (xExtent && xExtent > 0) {
    const xAxisBand: Rect = {
      x: layout.area.x,
      y: layout.area.y + layout.area.height,
      width: layout.area.width,
      height: xExtent,
    };
    const bottomChromeKeys = ['source', 'byline', 'footer'] as const;
    for (const key of bottomChromeKeys) {
      const el = layout.chrome[key];
      if (el) {
        const h = el.style.fontSize * el.style.lineHeight;
        const chromeBox: Rect = { x: el.x, y: el.y, width: el.maxWidth, height: h };
        if (rectsOverlap(xAxisBand, chromeBox, 0.5)) {
          violations.push(
            `x-axis labels intersect ${key}: xAxis=${formatRect(xAxisBand)} ${key}=${formatRect(chromeBox)}`,
          );
        }
      }
    }
  }

  // 4. All boxes stay within SVG viewport
  const viewport: Rect = {
    x: 0,
    y: 0,
    width: opts.svgWidth,
    height: opts.svgHeight,
  };
  const allBoxes = extractBoxes(layout);
  for (const box of allBoxes) {
    if (!isContained(box, viewport, 2)) {
      violations.push(
        `${box.name} outside SVG viewport: box=${formatRect(box)} viewport=${formatRect(viewport)}`,
      );
    }
  }

  // 5. Reserved margins cover drawn content
  if (layout.area.y < layout.chrome.topHeight - 1) {
    violations.push(
      `top chrome overflows into chart area: area.y=${layout.area.y} chrome.topHeight=${layout.chrome.topHeight}`,
    );
  }

  return violations;
}
