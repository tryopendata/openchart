/**
 * Axis rendering: axis line, ticks, tick labels, gridlines, axis title.
 */

import type { AxisLayout, ChartLayout } from '@opendata-ai/openchart-core';
import {
  axisTitleOffset,
  estimateTextWidth,
  getAxisTitleOffset,
  TICK_LABEL_OFFSET,
  textAscent,
} from '@opendata-ai/openchart-core';
import { serializeKeyValue } from '@opendata-ai/openchart-engine';
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
  opts?: { skipGridlines?: boolean },
): void {
  const g = createSVGElement('g');
  const isRight = orientation === 'y' && axis.orient === 'right';
  const isInlineY = orientation === 'y' && axis.tickPosition === 'inline' && !isRight;
  g.setAttribute(
    'class',
    `oc-axis oc-axis-${isRight ? 'y2' : orientation}${isInlineY ? ' oc-axis-inline' : ''}`,
  );

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
    // Stable key for data-update transitions
    const tickKey = serializeKeyValue(tick.value);

    if (orientation === 'x') {
      // Label (no tick marks -- gridlines provide sufficient reference)
      const label = createSVGElement('text');
      label.setAttribute('class', 'oc-axis-tick');
      label.setAttribute('data-tick-key', tickKey);

      if (axis.tickAngle && Math.abs(axis.tickAngle) > 10) {
        // Rotated labels: anchor at the rotation pivot point
        const labelX = tick.labelPosition ?? tick.position;
        const xLabelPad = axis.labelPadding ?? layout.theme.spacing.xAxisLabelPadding;
        const labelY = area.y + area.height + xLabelPad;
        setAttrs(label, {
          x: labelX,
          y: labelY,
          'text-anchor': axis.tickAngle < 0 ? 'end' : 'start',
          'dominant-baseline': 'central',
          transform: `rotate(${axis.tickAngle}, ${labelX}, ${labelY})`,
        });
      } else {
        const xLabelPad = axis.labelPadding ?? layout.theme.spacing.xAxisLabelPadding;
        // xLabelPad is the literal gap between the axis line and the TOP of
        // the label regardless of font size, so shift down by the ascent to
        // land on the alphabetic baseline. (dominant-baseline:hanging would
        // express this directly, but WebKit positions hanging from different
        // font metrics than Blink, drifting labels on iOS Safari.)
        setAttrs(label, {
          x: tick.labelPosition ?? tick.position,
          y: area.y + area.height + xLabelPad + textAscent(axis.tickLabelStyle.fontSize),
          'text-anchor': 'middle',
        });
      }

      applyTextStyle(label, axis.tickLabelStyle);
      label.textContent = tick.label;
      // The engine ellipsizes rotated labels that would overflow the reserved
      // band and stashes the original in `fullLabel`. Expose it as a <title> so
      // the complete category is still reachable on hover and to a screen
      // reader — truncation is a visual affordance, not data loss.
      if (tick.fullLabel) {
        const title = createSVGElement('title');
        title.textContent = tick.fullLabel;
        label.appendChild(title);
      }
      g.appendChild(label);
    } else if (isInlineY) {
      // Inline y-tick: label sits above its gridline at the chart-area left
      // edge, no gutter reserved. The gridline itself is the visual axis.
      const label = createSVGElement('text');
      label.setAttribute('class', 'oc-axis-tick oc-axis-tick-inline');
      label.setAttribute('data-tick-key', tickKey);
      setAttrs(label, {
        x: area.x,
        y: tick.position - 6,
        'text-anchor': 'start',
      });
      applyTextStyle(label, axis.tickLabelStyle);
      label.textContent = tick.label;
      g.appendChild(label);
    } else {
      const label = createSVGElement('text');
      label.setAttribute('class', 'oc-axis-tick');
      label.setAttribute('data-tick-key', tickKey);
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
  if (!isRight && !opts?.skipGridlines) {
    // Build position -> tick value map for keying gridlines
    const posToTickKey = new Map<number, string>();
    for (const tick of axis.ticks) {
      posToTickKey.set(tick.position, serializeKeyValue(tick.value));
    }

    for (const gridline of axis.gridlines) {
      const gl = createSVGElement('line');
      gl.setAttribute('class', 'oc-gridline');
      // Stamp data-tick-key for data-update transitions
      const glKey = posToTickKey.get(gridline.position);
      if (glKey) {
        gl.setAttribute('data-tick-key', glKey);
      }
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

    const tp = axis.titlePosition;
    if (tp) {
      const attrs: Record<string, string | number> = {
        x: tp.x,
        y: tp.y,
        'text-anchor': 'middle',
      };
      if (tp.angle) {
        attrs.transform = `rotate(${tp.angle}, ${tp.x}, ${tp.y})`;
      }
      setAttrs(axisLabel, attrs);
    } else if (orientation === 'x') {
      const tickFontSize = axis.tickLabelStyle.fontSize;
      const tickBand = Math.max(26, 4 + tickFontSize + Math.max(11, Math.ceil(tickFontSize * 0.7)));
      let titleY = area.y + area.height + tickBand + 9;
      if (axis.tickAngle && Math.abs(axis.tickAngle) > 10) {
        const angleRad = Math.abs(axis.tickAngle) * (Math.PI / 180);
        let maxLabelWidth = 40;
        for (const tick of axis.ticks) {
          const w = estimateTextWidth(tick.label, tickFontSize, axis.tickLabelStyle.fontWeight);
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
      const titleOffset = getAxisTitleOffset(layout.dimensions.width);
      const titleX = area.x + area.width + titleOffset;
      setAttrs(axisLabel, {
        x: titleX,
        y: area.y + area.height / 2,
        'text-anchor': 'middle',
        transform: `rotate(90, ${titleX}, ${area.y + area.height / 2})`,
      });
    } else {
      const maxTickLabelWidth = axis.ticks.reduce((max, t) => {
        const w = estimateTextWidth(
          t.label,
          axis.tickLabelStyle.fontSize,
          axis.tickLabelStyle.fontWeight ?? 400,
        );
        return Math.max(max, w);
      }, 0);
      // Inline y-ticks live inside the plot, so the title clears only the chart
      // edge — mirror the engine's reservation (see axisTitleOffset).
      const titleOffset = axisTitleOffset(
        maxTickLabelWidth,
        axis.labelStyle.fontSize,
        layout.dimensions.width,
        isInlineY,
      );
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

/**
 * Render the chart's axes.
 *
 * `opts.skipGridlines` suppresses the gridline pass for canvas mark mode,
 * where the canvas layer paints gridlines beneath the marks instead. Ticks,
 * tick labels, and axis titles still render as SVG either way.
 */
export function renderAxes(
  parent: SVGElement,
  layout: ChartLayout,
  opts?: { skipGridlines?: boolean },
): void {
  if (layout.axes.x) {
    renderAxis(parent, layout.axes.x, 'x', layout, opts);
  }
  if (layout.axes.y) {
    renderAxis(parent, layout.axes.y, 'y', layout, opts);
  }
  if (layout.axes.y2) {
    renderAxis(parent, layout.axes.y2, 'y', layout, opts);
  }
}
