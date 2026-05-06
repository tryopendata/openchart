/**
 * Endpoint-labels rendering: right-side per-series label column for multi-series
 * line/area charts. Renders, per entry:
 *   - a stroke-segment swatch (matches the refreshed traditional legend swatch)
 *   - the colored series label (with wrap support via tspans)
 *   - a muted formatted value below the label
 *   - an optional thin leader line back to the data point's true y
 *   - an optional open-ring marker on the line at the chart's right edge
 *
 * The engine resolves all positions, colors, and styles. This renderer is dumb:
 * it reads `layout.endpointLabels` and stamps SVG. Suppression logic lives in
 * the engine — when entries is empty, the renderer is a no-op.
 */

import type { ChartLayout } from '@opendata-ai/openchart-core';
import { applyTextStyle, createSVGElement, setAttrs } from './svg-dom';

/** Width of the colored stroke-segment swatch drawn left of the label. */
const SWATCH_WIDTH = 14;
/** Stroke width of the swatch line (matches the refreshed legend swatch). */
const SWATCH_STROKE = 3;
/** Gap between swatch and label text. */
const SWATCH_GAP = 6;
/** Gap between label baseline and the value text below it. */
const VALUE_GAP = 2;
/** Stroke width for the optional leader line. */
const LEADER_STROKE_WIDTH = 0.5;
/** Opacity for the optional leader line. */
const LEADER_OPACITY = 0.3;

export function renderEndpointLabels(parent: SVGElement, layout: ChartLayout): void {
  const ep = layout.endpointLabels;
  if (!ep || ep.entries.length === 0) return;

  const chartArea = layout.area;
  const chartRightX = chartArea.x + chartArea.width;

  const root = createSVGElement('g');
  root.setAttribute('class', 'oc-endpoint-labels');
  root.setAttribute('role', 'list');
  root.setAttribute('aria-label', 'Endpoint labels');

  const labelFontSize = ep.labelStyle.fontSize ?? 11;
  const labelLineHeight = labelFontSize * (ep.labelStyle.lineHeight ?? 1.25);
  const valueFontSize = ep.valueStyle.fontSize ?? 11;

  // The column starts at ep.bounds.x; the swatch sits flush-left in the column,
  // the label/value text starts after the swatch + gap.
  const swatchX1 = ep.bounds.x;
  const swatchX2 = swatchX1 + SWATCH_WIDTH;
  const textX = swatchX2 + SWATCH_GAP;

  for (let i = 0; i < ep.entries.length; i++) {
    const entry = ep.entries[i];

    const entryG = createSVGElement('g');
    entryG.setAttribute('class', 'oc-endpoint-label-entry');
    entryG.setAttribute('role', 'listitem');
    entryG.setAttribute('data-endpoint-index', String(i));
    entryG.setAttribute('data-endpoint-key', entry.seriesKey);
    entryG.setAttribute('aria-label', `${entry.seriesKey}: ${entry.value}`);

    // Leader line: drawn first so swatch/text sit on top.
    if (entry.showLeader) {
      const leader = createSVGElement('line');
      leader.setAttribute('class', 'oc-endpoint-leader');
      setAttrs(leader, {
        x1: swatchX1,
        y1: entry.labelY + labelFontSize / 2,
        x2: chartRightX,
        y2: entry.dataY,
        stroke: entry.color,
        'stroke-width': LEADER_STROKE_WIDTH,
        'stroke-opacity': LEADER_OPACITY,
      });
      entryG.appendChild(leader);
    }

    // Swatch: short colored stroke segment, vertically centered on the first
    // line of label text (use labelFontSize/2 as the visual baseline mid).
    const swatchY = entry.labelY + labelFontSize / 2;
    const swatch = createSVGElement('line');
    swatch.setAttribute('class', 'oc-endpoint-swatch');
    setAttrs(swatch, {
      x1: swatchX1,
      y1: swatchY,
      x2: swatchX2,
      y2: swatchY,
      stroke: entry.color,
      'stroke-width': SWATCH_STROKE,
      'stroke-linecap': 'round',
    });
    entryG.appendChild(swatch);

    // Label text. Multi-line via tspans when wrapped.
    const label = createSVGElement('text');
    label.setAttribute('class', 'oc-endpoint-label');
    setAttrs(label, { x: textX, y: entry.labelY + labelFontSize });
    applyTextStyle(label, ep.labelStyle);
    // Engine-resolved color always wins so theme overrides at the CSS layer
    // don't fight per-series colors.
    (label as SVGElement & ElementCSSInlineStyle).style.setProperty('fill', entry.color);

    if (entry.labelLines.length <= 1) {
      label.textContent = entry.labelLines[0] ?? entry.seriesKey;
    } else {
      for (let li = 0; li < entry.labelLines.length; li++) {
        const tspan = createSVGElement('tspan');
        setAttrs(tspan, { x: textX, dy: li === 0 ? 0 : labelLineHeight });
        tspan.textContent = entry.labelLines[li];
        label.appendChild(tspan);
      }
    }
    entryG.appendChild(label);

    // Value text directly underneath the last label line.
    const lineCount = Math.max(entry.labelLines.length, 1);
    const valueY =
      entry.labelY + labelFontSize + (lineCount - 1) * labelLineHeight + VALUE_GAP + valueFontSize;
    const value = createSVGElement('text');
    value.setAttribute('class', 'oc-endpoint-value');
    setAttrs(value, { x: textX, y: valueY });
    applyTextStyle(value, ep.valueStyle);
    value.textContent = entry.value;
    entryG.appendChild(value);

    // Marker: open-ring circle at the chart's right edge on the line.
    if (entry.marker) {
      const marker = createSVGElement('circle');
      marker.setAttribute('class', 'oc-endpoint-marker');
      setAttrs(marker, {
        cx: entry.marker.x,
        cy: entry.marker.y,
        r: entry.marker.radius,
        fill: entry.marker.fill,
        stroke: entry.marker.stroke,
        'stroke-width': entry.marker.strokeWidth,
      });
      entryG.appendChild(marker);
    }

    root.appendChild(entryG);
  }

  parent.appendChild(root);
}
