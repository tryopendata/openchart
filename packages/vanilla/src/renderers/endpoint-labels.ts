/**
 * Endpoint-labels rendering: right-side per-series label column for multi-series
 * line/area charts. Renders, per entry:
 *   - a chip+bar swatch matching the traditional legend (rounded surface chip
 *     with a colored bar through its midline)
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

// Swatch→label and label→value gaps both come from the engine layout
// (`ep.gap` and `ep.valueGap`), so the renderer never has to keep its own
// copies in sync. Leader styling is renderer-only — the engine doesn't
// model stroke width or opacity for the optional connector.
const LEADER_STROKE_WIDTH = 1;
const LEADER_OPACITY = 0.45;

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

  // The column starts at ep.bounds.x; the chip sits flush-left in the column,
  // the label/value text starts after the chip + gap.
  const chipX = ep.bounds.x;
  const chipWidth = ep.swatchSize;
  const textX = chipX + chipWidth + ep.gap;

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
        x1: chipX,
        y1: entry.labelY + labelFontSize / 2,
        x2: chartRightX,
        y2: entry.dataY,
        stroke: entry.color,
        'stroke-width': LEADER_STROKE_WIDTH,
        'stroke-opacity': LEADER_OPACITY,
      });
      entryG.appendChild(leader);
    }

    // Swatch: rounded chip with a colored bar through its midline, matching
    // the traditional legend so a chart never shows two swatch idioms.
    const rowY = entry.labelY + labelFontSize / 2;
    const chipHeight = Math.max(12, Math.round(ep.swatchSize * 0.85));
    const chipY = rowY - chipHeight / 2;
    const chip = createSVGElement('rect');
    chip.setAttribute('class', 'oc-endpoint-swatch-chip');
    setAttrs(chip, {
      x: chipX,
      y: chipY,
      width: chipWidth,
      height: chipHeight,
      rx: 3,
      ry: 3,
      fill: ep.swatchChipFill,
    });
    entryG.appendChild(chip);

    const barWidth = Math.max(8, chipWidth - 8);
    const barHeight = 3;
    const barX = chipX + (chipWidth - barWidth) / 2;
    const barY = rowY - barHeight / 2;
    const bar = createSVGElement('rect');
    bar.setAttribute('class', 'oc-endpoint-swatch-bar');
    setAttrs(bar, {
      x: barX,
      y: barY,
      width: barWidth,
      height: barHeight,
      rx: barHeight / 2,
      ry: barHeight / 2,
      fill: entry.color,
    });
    entryG.appendChild(bar);

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
      entry.labelY +
      labelFontSize +
      (lineCount - 1) * labelLineHeight +
      ep.valueGap +
      valueFontSize;
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
