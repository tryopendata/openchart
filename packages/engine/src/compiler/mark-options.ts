import { jsonPointer, type MarkType } from '@opendata-ai/openchart-core';

import type { NormalizedMarkDef, ValidationError } from './types';

/** Authored options with a mark-specific meaning; shared visual properties remain common. */
const APPLIES_TO: Partial<Record<keyof NormalizedMarkDef, readonly MarkType[]>> = {
  ticks: ['errorbar'],
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

/** Visual options every authored mark accepts. */
const SHARED_OPTIONS = new Set([
  'type',
  'size',
  'filled',
  'opacity',
  'fillOpacity',
  'fill',
  'stroke',
  'strokeWidth',
  'tooltip',
  'clip',
  'fillPattern',
]);

/** Run before sugar: diagnostics point to authored fields, including stripped histogram/density options. */
export function collectMarkOptionErrors(input: unknown, path = ''): ValidationError[] {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return [];
  const spec = input as Record<string, unknown>;
  const errors: ValidationError[] = [];
  if (spec.mark && typeof spec.mark === 'object' && !Array.isArray(spec.mark)) {
    const mark = spec.mark as NormalizedMarkDef;
    for (const [key, allowed] of Object.entries(APPLIES_TO)) {
      if (mark[key as keyof NormalizedMarkDef] !== undefined && !allowed.includes(mark.type)) {
        errors.push({
          code: 'INVALID_VALUE',
          path: `${path}${jsonPointer('mark', key)}`,
          message: `Option "${key}" is not supported by mark "${mark.type}".`,
          suggestion: `Remove ${key}, or use a supported mark: ${allowed.join(', ')}.`,
        });
      }
    }
    for (const key of Object.keys(mark)) {
      // Retired `render` gets its migration error from removed-spec-fields.
      if (key !== 'render' && !SHARED_OPTIONS.has(key) && !(key in APPLIES_TO)) {
        errors.push({
          code: 'INVALID_VALUE',
          path: `${path}${jsonPointer('mark', key)}`,
          message: `Unknown mark option "${key}".`,
          suggestion: `Remove ${key}.`,
        });
      }
    }
  }
  if (Array.isArray(spec.layer))
    spec.layer.forEach((child, i) => {
      errors.push(...collectMarkOptionErrors(child, `${path}/layer/${i}`));
    });
  return errors;
}

/** Reject authored options before sugar can erase or reinterpret them. */
export function assertMarkOptions(input: unknown): void {
  const errors = collectMarkOptionErrors(input);
  if (errors.length) {
    throw new Error(
      `Invalid spec:\n${errors.map((e) => `${e.path}: ${e.message} ${e.suggestion}`).join('\n')}`,
    );
  }
}
