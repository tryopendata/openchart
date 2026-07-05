/**
 * Endpoint-labels rendering: per-series label columns for multi-series
 * line/area charts. Supports trailing (right) and optional leading (left)
 * columns when `ends: 'both'` is set.
 *
 * The engine resolves all positions, colors, and styles. This renderer is dumb:
 * it reads `layout.endpointLabels` and stamps SVG. Suppression logic lives in
 * the engine — when entries is empty, the renderer is a no-op.
 */

import type {
  ChartLayout,
  EndpointLabelEntry,
  EndpointLabelsLayout,
  Rect,
} from '@opendata-ai/openchart-core';
import { applyTextStyle, createSVGElement, setAttrs } from './svg-dom';

const LEADER_STROKE_WIDTH = 1;
const LEADER_OPACITY = 0.45;

function renderColumn(
  root: SVGElement,
  entries: EndpointLabelEntry[],
  bounds: Rect,
  ep: EndpointLabelsLayout,
  leaderAnchorX: number,
  side: 'trailing' | 'leading',
): void {
  const labelFontSize = ep.labelStyle.fontSize ?? 11;
  const labelLineHeight = labelFontSize * (ep.labelStyle.lineHeight ?? 1.25);
  const valueFontSize = ep.valueStyle.fontSize ?? 11;

  const chipX = bounds.x;
  const chipWidth = ep.swatchSize;
  const textX = chipX + chipWidth + ep.gap;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    const entryG = createSVGElement('g');
    entryG.setAttribute('class', 'oc-endpoint-label-entry');
    entryG.setAttribute('role', 'listitem');
    entryG.setAttribute('data-endpoint-index', String(i));
    entryG.setAttribute('data-endpoint-key', entry.seriesKey);
    entryG.setAttribute('data-endpoint-side', side);
    entryG.setAttribute('aria-label', `${entry.seriesKey}: ${entry.value}`);

    if (entry.showLeader) {
      const leader = createSVGElement('line');
      leader.setAttribute('class', 'oc-endpoint-leader');
      setAttrs(leader, {
        x1: chipX,
        y1: entry.labelY + labelFontSize / 2,
        x2: leaderAnchorX,
        y2: entry.dataY,
        stroke: entry.color,
        'stroke-width': LEADER_STROKE_WIDTH,
        'stroke-opacity': LEADER_OPACITY,
      });
      entryG.appendChild(leader);
    }

    const rowY = entry.labelY + labelFontSize / 2;
    const line = createSVGElement('line');
    line.setAttribute('class', 'oc-endpoint-swatch-line');
    setAttrs(line, {
      x1: chipX,
      y1: rowY,
      x2: chipX + chipWidth,
      y2: rowY,
      stroke: entry.color,
      'stroke-width': 2,
      'stroke-linecap': 'round',
    });
    entryG.appendChild(line);

    const label = createSVGElement('text');
    label.setAttribute('class', 'oc-endpoint-label');
    setAttrs(label, { x: textX, y: entry.labelY + labelFontSize });
    applyTextStyle(label, ep.labelStyle);
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
}

export function renderEndpointLabels(parent: SVGElement, layout: ChartLayout): void {
  const ep = layout.endpointLabels;
  if (!ep || ep.entries.length === 0) return;

  const chartArea = layout.area;

  const root = createSVGElement('g');
  root.setAttribute('class', 'oc-endpoint-labels');
  root.setAttribute('role', 'list');
  root.setAttribute('aria-label', 'Endpoint labels');

  // Trailing column (right side).
  const chartRightX = chartArea.x + chartArea.width;
  renderColumn(root, ep.entries, ep.bounds, ep, chartRightX, 'trailing');

  // Leading column (left side) when `ends: 'both'`.
  if (ep.leading && ep.leading.length > 0 && ep.leadingBounds) {
    const chartLeftX = chartArea.x;
    renderColumn(root, ep.leading, ep.leadingBounds, ep, chartLeftX, 'leading');
  }

  parent.appendChild(root);
}
