import type { MarkDef, MarkType } from '@opendata-ai/openchart-core';

/** Authored options with a mark-specific meaning; shared visual properties stay wide in 8.x. */
const APPLIES_TO: Partial<Record<keyof MarkDef, readonly MarkType[]>> = {
  point: ['line', 'area', 'density'],
  interpolate: ['line', 'area', 'density'],
  orient: ['bar', 'histogram'],
  cornerRadius: ['bar', 'rect', 'histogram', 'waffle'],
  innerRadius: ['arc'],
  outerRadius: ['arc'],
  startAngle: ['arc'],
  endAngle: ['arc'],
  centerLabel: ['arc'],
  binCount: ['histogram'],
  normalize: ['histogram'],
  bandwidth: ['density'],
  cumulative: ['density'],
  steps: ['density'],
  trendline: ['point'],
  dx: ['text'],
  dy: ['text'],
  align: ['text'],
  baseline: ['text'],
  fontSize: ['text'],
  style: ['range'],
  colorByDirection: ['range'],
  units: ['waffle'],
  columns: ['waffle'],
  other: ['waffle'],
  weekStart: ['calendar'],
  cellRadius: ['calendar'],
  shape: ['parliament'],
  seatRadius: ['parliament'],
  majorityLine: ['parliament'],
};

/** Run before sugar: diagnostics point to authored fields, including stripped histogram/density options. */
export function collectMarkOptionWarnings(input: unknown, path = ''): string[] {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return [];
  const spec = input as Record<string, unknown>;
  const warnings: string[] = [];
  if (spec.mark && typeof spec.mark === 'object' && !Array.isArray(spec.mark)) {
    const mark = spec.mark as MarkDef;
    for (const [key, allowed] of Object.entries(APPLIES_TO)) {
      if (mark[key as keyof MarkDef] !== undefined && !allowed.includes(mark.type)) {
        warnings.push(
          `[openchart] ${path}/mark/${key} has no effect on mark "${mark.type}". Remove ${key}, or use a supported mark: ${allowed.join(', ')}.`,
        );
      }
    }
  }
  if (Array.isArray(spec.layer))
    spec.layer.forEach((child, i) => {
      warnings.push(...collectMarkOptionWarnings(child, `${path}/layer/${i}`));
    });
  return warnings;
}
