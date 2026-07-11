/**
 * Range chart mark computation (dumbbell / arrow / range bar).
 *
 * A band scale on the nominal axis and two quantitative positions per row
 * (x + x2 horizontal, or y + y2 vertical). Three styles via markDef.style:
 * - 'dumbbell' (default): connector rule + a dot at each end. The start dot
 *   is muted, the end dot carries the accent color.
 * - 'arrow': shaft rule + chevron arrowhead at the x2/y2 end, built from the
 *   shared computeArrowheadPoints geometry.
 * - 'bar': plain floating RectMark spanning start to end.
 *
 * Coloring precedence for the accent (connector/shaft/bar + end dot):
 * field-based encoding.color > markDef.colorByDirection (positive/negative
 * semantic tokens) > scales.defaultColor (markDef.fill or first palette color).
 */

import type {
  Encoding,
  LayoutStrategy,
  Mark,
  MarkAria,
  Rect,
  ResolvedTheme,
} from '@opendata-ai/openchart-core';
import { getRepresentativeColor } from '@opendata-ai/openchart-core';
import type { ScaleBand, ScaleLinear } from 'd3-scale';

import { computeArrowheadPoints } from '../../annotations/geometry';
import { dedupeKeys, serializeKeyValue } from '../../compiler/keys';
import type { NormalizedChartSpec } from '../../compiler/types';
import type { ResolvedScales } from '../../layout/scales';
import { getColor } from '../utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DOT_RADIUS = 6;
const CONNECTOR_WIDTH = 2;
const CONNECTOR_COLOR = '#cccccc';
const ARROW_STROKE_WIDTH = 2;
const ARROWHEAD_LENGTH = 8;
const ARROWHEAD_HALF_WIDTH = 4;

/** Range mark style variants. */
export type RangeStyle = 'dumbbell' | 'arrow' | 'bar';

// ---------------------------------------------------------------------------
// Orientation helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the range orientation from resolved scales.
 * Horizontal (nominal y, the common editorial form) when y is a band scale;
 * vertical when x is a band scale.
 */
export function resolveRangeOrientation(scales: ResolvedScales): 'horizontal' | 'vertical' | null {
  if (
    scales.y?.type === 'band' &&
    typeof (scales.y.scale as ScaleBand<string>).bandwidth === 'function'
  ) {
    return 'horizontal';
  }
  if (
    scales.x?.type === 'band' &&
    typeof (scales.x.scale as ScaleBand<string>).bandwidth === 'function'
  ) {
    return 'vertical';
  }
  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute range marks from a normalized chart spec.
 *
 * Emission order per data row is stable and load-bearing for the label pass:
 * connector/shaft/bar first (so dots layer on top), then the start dot, then
 * the end dot (dumbbell style only).
 */
export function computeRangeMarks(
  spec: NormalizedChartSpec,
  scales: ResolvedScales,
  _chartArea: Rect,
  _strategy: LayoutStrategy,
  theme: ResolvedTheme,
): Mark[] {
  const encoding = spec.encoding as Encoding;
  const orientation = resolveRangeOrientation(scales);
  if (!orientation || !scales.x || !scales.y) return [];

  const horizontal = orientation === 'horizontal';
  const catChannel = horizontal ? encoding.y : encoding.x;
  const startChannel = horizontal ? encoding.x : encoding.y;
  const endChannel = horizontal ? encoding.x2 : encoding.y2;
  if (!catChannel || !startChannel || !endChannel) return [];

  const bandScale = (horizontal ? scales.y.scale : scales.x.scale) as ScaleBand<string>;
  const valueScale = (horizontal ? scales.x.scale : scales.y.scale) as ScaleLinear<number, number>;
  const bandwidth = bandScale.bandwidth();

  const style: RangeStyle = spec.markDef.style ?? 'dumbbell';
  const colorEnc = encoding.color && 'field' in encoding.color ? encoding.color : undefined;
  const colorByDirection = spec.markDef.colorByDirection === true && !colorEnc;

  // Stable identity keys per category row (deduped for repeated categories).
  const catKeys = dedupeKeys(spec.data.map((row) => serializeKeyValue(row[catChannel.field])));

  const marks: Mark[] = [];

  for (let i = 0; i < spec.data.length; i++) {
    const row = spec.data[i];
    const category = String(row[catChannel.field] ?? '');
    const bandPos = bandScale(category);
    if (bandPos === undefined) continue;

    const startRaw = row[startChannel.field];
    const endRaw = row[endChannel.field];
    if (startRaw == null || endRaw == null) continue;
    const startVal = Number(startRaw);
    const endVal = Number(endRaw);
    if (!Number.isFinite(startVal) || !Number.isFinite(endVal)) continue;

    const center = bandPos + bandwidth / 2;
    const pStart = valueScale(startVal);
    const pEnd = valueScale(endVal);
    const delta = endVal - startVal;
    const catKey = catKeys[i];

    // Accent: field color > direction color > default (markDef.fill / palette).
    const accent = colorEnc
      ? getColor(scales, String(row[colorEnc.field] ?? ''))
      : colorByDirection
        ? delta > 0
          ? theme.colors.positive
          : delta < 0
            ? theme.colors.negative
            : theme.colors.axis
        : getColor(scales, '__default__');
    const accentStroke = getRepresentativeColor(accent);

    const spanAria: MarkAria = {
      label: `${category}: ${startVal} to ${endVal}`,
    };

    // Pixel endpoints in x/y space
    const x1 = horizontal ? pStart : center;
    const y1 = horizontal ? center : pStart;
    const x2 = horizontal ? pEnd : center;
    const y2 = horizontal ? center : pEnd;
    const spanLength = Math.abs(pEnd - pStart);

    if (style === 'bar') {
      marks.push({
        type: 'rect',
        x: horizontal ? Math.min(pStart, pEnd) : bandPos,
        y: horizontal ? bandPos : Math.min(pStart, pEnd),
        width: horizontal ? spanLength : bandwidth,
        height: horizontal ? bandwidth : spanLength,
        fill: accent,
        data: row as Record<string, unknown>,
        aria: spanAria,
        key: catKey,
        orient: horizontal ? 'horizontal' : 'vertical',
      });
      continue;
    }

    if (style === 'arrow') {
      if (spanLength > 0) {
        marks.push({
          type: 'rule',
          x1,
          y1,
          x2,
          y2,
          stroke: accentStroke,
          strokeWidth: ARROW_STROKE_WIDTH,
          data: row as Record<string, unknown>,
          aria: spanAria,
          key: `${catKey}|range`,
        });

        // Chevron arrowhead at the end value, from the shared geometry helper.
        const head = computeArrowheadPoints(
          x2,
          y2,
          x2 - x1,
          y2 - y1,
          ARROWHEAD_LENGTH,
          ARROWHEAD_HALF_WIDTH,
        );
        const headAria: MarkAria = { label: spanAria.label, decorative: true };
        marks.push(
          {
            type: 'rule',
            x1: head.baseLeft.x,
            y1: head.baseLeft.y,
            x2: head.tip.x,
            y2: head.tip.y,
            stroke: accentStroke,
            strokeWidth: ARROW_STROKE_WIDTH,
            data: row as Record<string, unknown>,
            aria: headAria,
            key: `${catKey}|head-left`,
          },
          {
            type: 'rule',
            x1: head.baseRight.x,
            y1: head.baseRight.y,
            x2: head.tip.x,
            y2: head.tip.y,
            stroke: accentStroke,
            strokeWidth: ARROW_STROKE_WIDTH,
            data: row as Record<string, unknown>,
            aria: headAria,
            key: `${catKey}|head-right`,
          },
        );
      }
      continue;
    }

    // Dumbbell (default): connector + muted start dot + accent end dot.
    if (spanLength > 0) {
      const connectorColor = colorEnc || colorByDirection ? accentStroke : CONNECTOR_COLOR;
      marks.push({
        type: 'rule',
        x1,
        y1,
        x2,
        y2,
        stroke: connectorColor,
        strokeWidth: CONNECTOR_WIDTH,
        data: row as Record<string, unknown>,
        aria: spanAria,
        key: `${catKey}|range`,
      });
    }

    marks.push(
      {
        type: 'point',
        cx: x1,
        cy: y1,
        r: DOT_RADIUS,
        fill: theme.colors.axis,
        stroke: '#ffffff',
        strokeWidth: 2,
        data: row as Record<string, unknown>,
        aria: { label: `${category}, start: ${startVal}` },
        key: `${catKey}|start`,
      },
      {
        type: 'point',
        cx: x2,
        cy: y2,
        r: DOT_RADIUS,
        fill: accent,
        stroke: '#ffffff',
        strokeWidth: 2,
        data: row as Record<string, unknown>,
        aria: { label: `${category}, end: ${endVal}` },
        key: `${catKey}|end`,
      },
    );
  }

  return marks;
}
