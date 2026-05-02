/**
 * Axis rendering: axis line, ticks, tick labels, gridlines, axis title.
 */

import type { AxisLayout, ChartLayout } from '@opendata-ai/openchart-core';
import {
  estimateTextWidth,
  getAxisTitleOffset,
  TICK_LABEL_OFFSET,
} from '@opendata-ai/openchart-core';
import { applyTextStyle, createSVGElement, setAttrs } from './svg-dom';

function appendCompoundLabel(
  parent: SVGElement,
  primaryText: string,
  subtitle: string,
  fontWeight: number,
): void {
  const primarySpan = createSVGElement('tspan');
  primarySpan.setAttribute('font-weight', String(fontWeight));
  primarySpan.textContent = primaryText;
  parent.appendChild(primarySpan);

  const subtitleSpan = createSVGElement('tspan');
  subtitleSpan.setAttribute('dx', '0.5em');
  subtitleSpan.textContent = subtitle;
  subtitleSpan.setAttribute('font-weight', '400');
  subtitleSpan.setAttribute('fill-opacity', '0.6');
  parent.appendChild(subtitleSpan);
}

function renderAxis(
  parent: SVGElement,
  axis: AxisLayout,
  orientation: 'x' | 'y',
  layout: ChartLayout,
): void {
  const g = createSVGElement('g');
  const isRight = orientation === 'y' && axis.orient === 'right';
  g.setAttribute('class', `oc-axis oc-axis-${isRight ? 'y2' : orientation}`);

  const { area } = layout;

  // Only draw axis line for x-axis (bottom baseline), unless explicitly disabled.
  // Horizontal gridlines already guide y-values, so the vertical y-axis line is redundant.
  if (orientation === 'x' && axis.domainLine !== false) {
    const line = createSVGElement('line');
    line.setAttribute('class', 'oc-axis-line');
    setAttrs(line, {
      x1: axis.start.x,
      y1: axis.start.y,
      x2: axis.end.x,
      y2: axis.end.y,
      stroke: layout.theme.colors.axis,
      'stroke-width': 1,
    });
    g.appendChild(line);
  }

  // Ticks and labels
  // Tick positions are absolute pixel coordinates from D3 scales whose range
  // was set to [chartArea.x, chartArea.x + chartArea.width] (and similarly for y).
  // Don't add area.x/area.y again or you'll double-offset everything.
  for (const tick of axis.ticks) {
    if (orientation === 'x') {
      // Label (no tick marks -- gridlines provide sufficient reference)
      const label = createSVGElement('text');
      label.setAttribute('class', 'oc-axis-tick');

      if (axis.tickAngle && Math.abs(axis.tickAngle) > 10) {
        // Rotated labels: anchor at the rotation pivot point
        const labelX = tick.position;
        const labelY = area.y + area.height + 6;
        setAttrs(label, {
          x: labelX,
          y: labelY,
          'text-anchor': axis.tickAngle < 0 ? 'end' : 'start',
          'dominant-baseline': 'central',
          transform: `rotate(${axis.tickAngle}, ${labelX}, ${labelY})`,
        });
      } else {
        setAttrs(label, {
          x: tick.position,
          y: area.y + area.height + 14,
          'text-anchor': 'middle',
        });
      }

      applyTextStyle(label, axis.tickLabelStyle);
      label.textContent = tick.label;
      g.appendChild(label);
    } else {
      const label = createSVGElement('text');
      label.setAttribute('class', 'oc-axis-tick');
      setAttrs(label, {
        x: isRight ? area.x + area.width + TICK_LABEL_OFFSET : area.x - TICK_LABEL_OFFSET,
        y: tick.position,
        'text-anchor': isRight ? 'start' : 'end',
        'dominant-baseline': 'central',
      });
      applyTextStyle(label, axis.tickLabelStyle);
      if (!isRight) {
        // Truncate categorical left y-axis labels that exceed available space
        const availableWidth = area.x - TICK_LABEL_OFFSET;
        const fontSize = axis.tickLabelStyle.fontSize;
        const fontWeight = axis.tickLabelStyle.fontWeight;

        if (tick.subtitle) {
          // Compound label: primary + gap + subtitle via tspan elements
          const gapWidth = fontSize * 0.5;
          const subtitleWidth = estimateTextWidth(tick.subtitle, fontSize, fontWeight);
          const primaryWidth = estimateTextWidth(tick.label, fontSize, fontWeight);
          const totalWidth = primaryWidth + gapWidth + subtitleWidth;

          if (totalWidth > availableWidth && availableWidth > 20) {
            const ellipsis = '…';
            const ellipsisWidth = estimateTextWidth(ellipsis, fontSize, fontWeight);
            const budgetForPrimary = availableWidth - gapWidth - subtitleWidth - ellipsisWidth;

            let primaryText = tick.label;
            if (budgetForPrimary > 0) {
              let lo = 0;
              let hi = tick.label.length;
              while (lo < hi) {
                const mid = (lo + hi + 1) >>> 1;
                const candidate = tick.label.slice(0, mid);
                if (estimateTextWidth(candidate, fontSize, fontWeight) <= budgetForPrimary) {
                  lo = mid;
                } else {
                  hi = mid - 1;
                }
              }
              primaryText = lo > 0 ? tick.label.slice(0, lo).trimEnd() + ellipsis : ellipsis;
            } else {
              primaryText = ellipsis;
            }

            appendCompoundLabel(label, primaryText, tick.subtitle, fontWeight);

            const titleEl = createSVGElement('title');
            titleEl.textContent = `${tick.label}  ${tick.subtitle}`;
            label.appendChild(titleEl);
          } else {
            appendCompoundLabel(label, tick.label, tick.subtitle, fontWeight);
          }
        } else {
          // Plain label (no subtitle)
          const fullWidth = estimateTextWidth(tick.label, fontSize, fontWeight);
          if (fullWidth > availableWidth && availableWidth > 20) {
            const ellipsis = '…';
            const ellipsisWidth = estimateTextWidth(ellipsis, fontSize, fontWeight);
            let lo = 0;
            let hi = tick.label.length;
            while (lo < hi) {
              const mid = (lo + hi + 1) >>> 1;
              const candidate = tick.label.slice(0, mid);
              if (
                estimateTextWidth(candidate, fontSize, fontWeight) + ellipsisWidth <=
                availableWidth
              ) {
                lo = mid;
              } else {
                hi = mid - 1;
              }
            }
            label.textContent = lo > 0 ? tick.label.slice(0, lo).trimEnd() + ellipsis : ellipsis;
            const titleEl = createSVGElement('title');
            titleEl.textContent = tick.label;
            label.appendChild(titleEl);
          } else {
            label.textContent = tick.label;
          }
        }
      } else {
        label.textContent = tick.label;
      }
      g.appendChild(label);
    }
  }

  // Gridlines (positions are also absolute from the scales)
  // Skip gridlines for right-side y-axis (left y-axis gridlines are sufficient)
  if (!isRight) {
    for (const gridline of axis.gridlines) {
      const gl = createSVGElement('line');
      gl.setAttribute('class', 'oc-gridline');
      if (orientation === 'y') {
        setAttrs(gl, {
          x1: area.x,
          y1: gridline.position,
          x2: area.x + area.width,
          y2: gridline.position,
          stroke: layout.theme.colors.gridline,
          'stroke-width': 1,
          'stroke-opacity': 0.6,
        });
      } else {
        setAttrs(gl, {
          x1: gridline.position,
          y1: area.y,
          x2: gridline.position,
          y2: area.y + area.height,
          stroke: layout.theme.colors.gridline,
          'stroke-width': 1,
          'stroke-opacity': 0.6,
        });
      }
      g.appendChild(gl);
    }
  }

  // Axis label
  if (axis.label && axis.labelStyle) {
    const axisLabel = createSVGElement('text');
    axisLabel.setAttribute('class', 'oc-axis-title');
    applyTextStyle(axisLabel, axis.labelStyle);
    axisLabel.textContent = axis.label;

    if (orientation === 'x') {
      // Position axis title below tick labels. For rotated labels, compute
      // the vertical extent of the rotated ticks and place the title below.
      let titleY = area.y + area.height + 35;
      if (axis.tickAngle && Math.abs(axis.tickAngle) > 10) {
        const angleRad = Math.abs(axis.tickAngle) * (Math.PI / 180);
        let maxLabelWidth = 40;
        for (const tick of axis.ticks) {
          const w = estimateTextWidth(
            tick.label,
            axis.tickLabelStyle.fontSize,
            axis.tickLabelStyle.fontWeight,
          );
          if (w > maxLabelWidth) maxLabelWidth = w;
        }
        const rotatedHeight = Math.min(maxLabelWidth * Math.sin(angleRad) + 6, 120);
        titleY = area.y + area.height + rotatedHeight + 14;
      }
      setAttrs(axisLabel, {
        x: area.x + area.width / 2,
        y: titleY,
        'text-anchor': 'middle',
      });
    } else if (isRight) {
      // Rotated right y-axis label (tighter offset on compact viewports)
      const titleOffset = getAxisTitleOffset(layout.dimensions.width);
      const titleX = area.x + area.width + titleOffset;
      setAttrs(axisLabel, {
        x: titleX,
        y: area.y + area.height / 2,
        'text-anchor': 'middle',
        transform: `rotate(90, ${titleX}, ${area.y + area.height / 2})`,
      });
    } else {
      // Rotated left y-axis label (tighter offset on compact viewports)
      const titleOffset = getAxisTitleOffset(layout.dimensions.width);
      setAttrs(axisLabel, {
        x: area.x - titleOffset,
        y: area.y + area.height / 2,
        'text-anchor': 'middle',
        transform: `rotate(-90, ${area.x - titleOffset}, ${area.y + area.height / 2})`,
      });
    }
    g.appendChild(axisLabel);
  }

  parent.appendChild(g);
}

export function renderAxes(parent: SVGElement, layout: ChartLayout): void {
  if (layout.axes.x) {
    renderAxis(parent, layout.axes.x, 'x', layout);
  }
  if (layout.axes.y) {
    renderAxis(parent, layout.axes.y, 'y', layout);
  }
  if (layout.axes.y2) {
    renderAxis(parent, layout.axes.y2, 'y', layout);
  }
}
