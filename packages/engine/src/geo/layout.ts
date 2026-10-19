import type { Rect } from '@opendata-ai/openchart-core';

/** Chrome and padding define the map frame independently of projection aspect ratio. */
export function geoMapFullArea(
  width: number,
  height: number,
  padding: number,
  topHeight: number,
  bottomHeight: number,
  chromeLayout: 'grow' | 'subtract' | 'notes',
): Rect {
  return {
    x: padding,
    y: padding + topHeight,
    width: width - padding * 2,
    height:
      chromeLayout === 'grow'
        ? height - padding * 2
        : height - topHeight - bottomHeight - padding * 2,
  };
}

/** Measured map reservations, resolved before the single projection fit. */
export interface GeoMapFrame {
  area: Rect;
  legendReserveGap: number;
}

/** Preserve the existing top/bottom map frame without coupling maps to Cartesian axes. */
export function reserveGeoMapArea(
  fullArea: Rect,
  legendBlockHeight: number,
  position: 'top' | 'bottom',
): GeoMapFrame {
  const legendReserveGap = legendBlockHeight > 0 ? 8 : 0;
  return {
    area: {
      x: fullArea.x,
      y:
        position === 'top' && legendBlockHeight > 0
          ? fullArea.y + legendBlockHeight + legendReserveGap
          : fullArea.y,
      width: fullArea.width,
      height: fullArea.height - legendBlockHeight - legendReserveGap,
    },
    legendReserveGap,
  };
}

/** A side gutter must leave a useful viewport and contain the entire key stack. */
export function reserveSideGeoMapArea(
  fullArea: Rect,
  keyWidth: number,
  keyHeight: number,
  position: 'right' | 'bottom-right',
): { area: Rect; legend: Rect } | null {
  const gap = 16;
  const remaining = fullArea.width - keyWidth - gap;
  if (remaining < Math.min(240, fullArea.width * 0.6) || keyHeight > fullArea.height) return null;
  return {
    area: { ...fullArea, width: remaining },
    legend: {
      x: fullArea.x + remaining + gap,
      y: position === 'bottom-right' ? fullArea.y + fullArea.height - keyHeight : fullArea.y,
      width: keyWidth,
      height: keyHeight,
    },
  };
}

/** Translate resolved key geometry; renderers never infer a gutter. */
export function moveGeoMapLegend(
  legend:
    | import('@opendata-ai/openchart-core').ContinuousLegendLayout
    | import('@opendata-ai/openchart-core').CategoricalLegendLayout
    | import('@opendata-ai/openchart-core').SizeLegendLayout,
  x: number,
  y: number,
  position: 'top' | 'bottom' | 'right' | 'bottom-right',
): void {
  const dx = x - legend.bounds.x;
  const dy = y - legend.bounds.y;
  legend.bounds = { ...legend.bounds, x, y };
  legend.position = position;
  if (legend.textRows)
    legend.textRows = legend.textRows.map((row) => ({
      ...row,
      x: row.x + dx,
      y: row.y + dy,
    }));
  if (legend.type === 'continuous') {
    legend.bar = { ...legend.bar, x: legend.bar.x + dx, y: legend.bar.y + dy };
    legend.bins = legend.bins.map((bin) => ({ ...bin, x: bin.x + dx }));
    legend.ticks = legend.ticks.map((tick) => ({ ...tick, x: tick.x + dx }));
    legend.labelY += dy;
    if (legend.titleY !== undefined) legend.titleY += dy;
  } else if (legend.type !== 'size' && legend.entryPositions) {
    legend.entryPositions = legend.entryPositions.map((p) => ({
      ...p,
      x: p.x + dx,
      y: p.y + dy,
      labelX: p.labelX + dx,
      labelY: p.labelY + dy,
    }));
  }
  if ('noData' in legend && legend.noData) {
    legend.noData = {
      ...legend.noData,
      x: legend.noData.x + dx,
      y: legend.noData.y + dy,
      labelX: legend.noData.labelX + dx,
      labelY: legend.noData.labelY + dy,
    };
  }
}

/** Score complete measured corner keys against occupied screen bounds; first wins ties. */
export function occupiedBoundsSizeKeyCandidate(
  area: Rect,
  width: number,
  height: number,
  obstacles: readonly Rect[],
  inset = 18,
): Rect | null {
  if (width + inset * 2 > area.width || height + inset * 2 > area.height) return null;
  const candidates = [
    { x: area.x + area.width - width - inset, y: area.y + area.height - height - inset },
    { x: area.x + inset, y: area.y + area.height - height - inset },
    { x: area.x + area.width - width - inset, y: area.y + inset },
    { x: area.x + inset, y: area.y + inset },
  ].map((point) => ({ ...point, width, height }));
  const overlap = (a: Rect, b: Rect) =>
    Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
    Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return candidates.reduce((best, candidate) =>
    obstacles.reduce((sum, obstacle) => sum + overlap(candidate, obstacle), 0) <
    obstacles.reduce((sum, obstacle) => sum + overlap(best, obstacle), 0)
      ? candidate
      : best,
  );
}

/** Decide every reservation and fallback before any projection is fitted. */
export function planGeoMapFrame(
  fullArea: Rect,
  legendBlockHeight: number,
  bandPosition: 'top' | 'bottom',
  authoredPosition: string | undefined,
  sideWidth: number,
  sideHeight: number,
  viewport: { width: number; height: number },
): GeoMapFrame & {
  sideLegend?: Rect;
  diagnostics: import('@opendata-ai/openchart-core').DesignDiagnostic[];
} {
  const diagnostics: import('@opendata-ai/openchart-core').DesignDiagnostic[] = [];
  if ((authoredPosition === 'right' || authoredPosition === 'bottom-right') && sideHeight > 0) {
    const side = reserveSideGeoMapArea(fullArea, sideWidth, sideHeight, authoredPosition);
    if (side) return { area: side.area, sideLegend: side.legend, legendReserveGap: 0, diagnostics };
    diagnostics.push({
      code: 'MAP_SIDE_LEGEND_FALLBACK',
      severity: 'warning',
      status: 'failed',
      path: '/legend/position',
      viewport,
      origin: 'author',
      message:
        'The side legend does not fit this viewport; using the top band before fitting the map.',
    });
  }
  if (authoredPosition === 'inline') {
    diagnostics.push({
      code: 'MAP_INLINE_LEGEND_UNSUPPORTED',
      severity: 'warning',
      status: 'failed',
      path: '/legend/position',
      viewport,
      origin: 'author',
      message: 'Inline legends do not apply to maps; using the top band.',
    });
  }
  return { ...reserveGeoMapArea(fullArea, legendBlockHeight, bandPosition), diagnostics };
}

/** Complete continuous-key ink extent, measured before choosing a side gutter. */
export function measureGeoContinuousKey(options: {
  content: Pick<
    import('../legend/continuous').ContinuousLegendContent,
    'barWidth' | 'barHeight' | 'ticks'
  >;
  labelStyle: import('@opendata-ai/openchart-core').TextStyle;
  title?: { text: string; weight: number };
  noData?: { label: string; swatchGap: number; labelGap: number };
  measureText: import('@opendata-ai/openchart-core').MeasureTextFn;
}): { width: number; inset: number } {
  const { content, labelStyle, measureText, title, noData } = options;
  let left = 0;
  let right = content.barWidth;
  for (const tick of content.ticks) {
    const width = measureText(tick.label, labelStyle.fontSize, labelStyle.fontWeight).width;
    const x = tick.x - (tick.anchor === 'middle' ? width / 2 : tick.anchor === 'end' ? width : 0);
    left = Math.min(left, x);
    right = Math.max(right, x + width);
  }
  if (title)
    right = Math.max(right, measureText(title.text, labelStyle.fontSize, title.weight).width);
  if (noData) {
    right = Math.max(
      right,
      content.barWidth +
        noData.swatchGap +
        content.barHeight +
        noData.labelGap +
        measureText(noData.label, labelStyle.fontSize, labelStyle.fontWeight).width,
    );
  }
  return { width: Math.ceil(right - left), inset: -left };
}

/** Include every circle, label and title in a map size key's placement extent. */
export function measureGeoSizeKey(
  content: import('../legend/size').SizeLegendContent,
  style: import('@opendata-ai/openchart-core').TextStyle,
  measure: import('@opendata-ai/openchart-core').MeasureTextFn,
  maxWidth = Number.POSITIVE_INFINITY,
): import('../legend/size').SizeLegendContent & { titleLines?: string[]; titleAdvance?: number } {
  const titlePlan = content.title
    ? measureGeoKeyText(content.title, maxWidth, { ...style, fontWeight: 500 }, measure)
    : undefined;
  const oldTitleHeight = content.title ? Math.ceil(style.fontSize * 1.3) + 6 : 0;
  const shift = titlePlan ? titlePlan.height + 6 - oldTitleHeight : 0;
  const circles = content.circles.map((circle) => ({
    ...circle,
    cy: circle.cy + shift,
    labelY: circle.labelY + shift,
  }));
  const first = circles[0];
  const labelX = first.cx + first.radius + 8;
  const width = Math.max(
    ...circles.map(
      (circle) => labelX + measure(circle.label, style.fontSize, style.fontWeight).width,
    ),
    ...(titlePlan?.lines.map((line) => measure(line, style.fontSize, 500).width) ?? [0]),
    ...circles.map((circle) => circle.cx + circle.radius),
  );
  const height = Math.max(
    content.height + shift,
    ...circles.map(
      (circle) =>
        circle.labelY +
        Math.max(
          style.fontSize * 0.5,
          measure(circle.label, style.fontSize, style.fontWeight).height * 0.5,
        ),
    ),
  );
  return {
    ...content,
    circles,
    width: Math.ceil(width),
    height: Math.ceil(height),
    titleLines: titlePlan?.lines,
    titleAdvance: titlePlan?.advance,
  };
}

/** Wrap static key prose using the host's metrics before projection fitting. */
export function measureGeoKeyText(
  text: string,
  width: number,
  style: import('@opendata-ai/openchart-core').TextStyle,
  measure: import('@opendata-ai/openchart-core').MeasureTextFn,
): { lines: string[]; height: number; advance: number } {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    const words = paragraph.split(/\s+/).flatMap((word) => {
      if (measure(word, style.fontSize, style.fontWeight).width <= width) return [word];
      const parts: string[] = [];
      let part = '';
      for (const char of word) {
        if (part && measure(part + char, style.fontSize, style.fontWeight).width > width) {
          parts.push(part);
          part = char;
        } else part += char;
      }
      if (part) parts.push(part);
      return parts;
    });
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (line && measure(next, style.fontSize, style.fontWeight).width > width) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  const advance = Math.ceil(
    Math.max(style.fontSize * 1.35, measure('Mg', style.fontSize, style.fontWeight).height + 4),
  );
  return { lines, height: lines.length * advance, advance };
}
