import type { Mark, Rect, RuleMarkLayout, TickMarkLayout } from '@opendata-ai/openchart-core';
import { getRepresentativeColor } from '@opendata-ai/openchart-core';
import { dedupeKeys, serializeKeyValue } from '../../compiler/keys';
import type { NormalizedChartSpec } from '../../compiler/types';
import { finiteNumber } from '../../data/finite-number';
import type { ResolvedScales } from '../../layout/scales';
import { getColor, scaleValue } from '../utils';
import { ERRORBAR_CAP_LENGTH, ERRORBAR_OPACITY, ERRORBAR_STROKE_WIDTH } from './constants';

/** Explicit bounds only: intervals are supplied by the host, never synthesized. */
export function computeErrorbarMarks(
  spec: NormalizedChartSpec,
  scales: ResolvedScales,
  _chartArea: Rect,
): Mark[] {
  const { x, y, x2, y2 } = spec.encoding;
  if (!x || !y || !scales.x || !scales.y) return [];
  const horizontal = !!x2;
  const bound = horizontal ? x2 : y2;
  if (!bound) return [];
  const axis = horizontal ? scales.x : scales.y;
  const category = horizontal ? scales.y : scales.x;
  const valueField = horizontal ? x.field : y.field;
  const categoryField = horizontal ? y.field : x.field;
  const color = spec.encoding.color;
  const marks: Mark[] = [];
  const keys = dedupeKeys(
    spec.data.map((row) => serializeKeyValue(row[spec.encoding.key?.field ?? categoryField])),
  );
  for (const [index, row] of spec.data.entries()) {
    const lower = scaleValue(axis.scale, axis.type, row[valueField]);
    const upper = scaleValue(axis.scale, axis.type, row[bound.field]);
    let center = scaleValue(category.scale, category.type, row[categoryField]);
    if (lower === null || upper === null || center === null) continue;
    if (category.type === 'band')
      center += (category.scale as { bandwidth(): number }).bandwidth() / 2;
    const stroke =
      spec.markDef.stroke ??
      getRepresentativeColor(
        getColor(scales, color && 'field' in color ? String(row[color.field]) : '__default__'),
      );
    const suppliedOpacity =
      spec.encoding.opacity && 'field' in spec.encoding.opacity
        ? finiteNumber(row[spec.encoding.opacity.field])
        : finiteNumber(spec.markDef.opacity);
    const opacity = Math.max(0, Math.min(1, suppliedOpacity ?? ERRORBAR_OPACITY));
    const common = {
      stroke,
      strokeWidth: spec.markDef.strokeWidth ?? ERRORBAR_STROKE_WIDTH,
      opacity,
      data: row,
    };
    const whisker: RuleMarkLayout = {
      ...common,
      type: 'rule',
      key: keys[index],
      x1: horizontal ? lower : center,
      x2: horizontal ? upper : center,
      y1: horizontal ? center : lower,
      y2: horizontal ? center : upper,
      aria: { label: `${row[categoryField]}: ${row[valueField]} to ${row[bound.field]}` },
    };
    marks.push(whisker);
    if (spec.markDef.ticks)
      for (const [end, position] of [lower, upper].entries()) {
        const cap: TickMarkLayout = {
          ...common,
          type: 'tick',
          key: `${keys[index]}|cap:${end}`,
          x: horizontal ? position : center,
          y: horizontal ? center : position,
          orient: horizontal ? 'vertical' : 'horizontal',
          length: ERRORBAR_CAP_LENGTH,
          aria: { decorative: true },
        };
        marks.push(cap);
      }
  }
  return marks;
}
