import type { MarkDef, MarkType } from '@opendata-ai/openchart-core';

/** Independently specified authoring contract, checked by TypeScript and exercised
 * against published JSON Schema and runtime diagnostics. */
export const MARK_CONTRACT_TYPES = [
  'bar',
  'line',
  'area',
  'point',
  'circle',
  'arc',
  'text',
  'rule',
  'tick',
  'rect',
  'lollipop',
  'beeswarm',
  'range',
  'waffle',
  'calendar',
  'parliament',
  'histogram',
  'density',
] as const satisfies readonly MarkType[];

export const MARK_OPTION_CASES = {
  orient: { value: 'horizontal', marks: ['bar', 'histogram'] },
  cornerRadius: { value: 3, marks: ['bar', 'rect', 'histogram', 'waffle'] },
  point: { value: true, marks: ['line', 'area', 'density'] },
  interpolate: { value: 'linear', marks: ['line', 'area', 'density'] },
  innerRadius: { value: 20, marks: ['arc'] },
  outerRadius: { value: 80, marks: ['arc'] },
  startAngle: { value: 0, marks: ['arc'] },
  endAngle: { value: 3.14, marks: ['arc'] },
  centerLabel: { value: 'Total', marks: ['arc'] },
  binCount: { value: 8, marks: ['histogram'] },
  normalize: { value: true, marks: ['histogram'] },
  bandwidth: { value: 2, marks: ['density'] },
  cumulative: { value: true, marks: ['density'] },
  steps: { value: 25, marks: ['density'] },
  trendline: { value: true, marks: ['point'] },
  dx: { value: 10, marks: ['text'] },
  dy: { value: -10, marks: ['text'] },
  align: { value: 'left', marks: ['text'] },
  baseline: { value: 'top', marks: ['text'] },
  fontSize: { value: 12, marks: ['text'] },
  style: { value: 'arrow', marks: ['range'] },
  colorByDirection: { value: true, marks: ['range'] },
  units: { value: 100, marks: ['waffle'] },
  columns: { value: 10, marks: ['waffle'] },
  other: { value: 0.05, marks: ['waffle'] },
  weekStart: { value: 'monday', marks: ['calendar'] },
  cellRadius: { value: 2, marks: ['calendar'] },
  shape: { value: 'hemicycle', marks: ['parliament'] },
  seatRadius: { value: 3, marks: ['parliament'] },
  majorityLine: { value: true, marks: ['parliament'] },
  size: { value: 5, marks: MARK_CONTRACT_TYPES },
  filled: { value: true, marks: MARK_CONTRACT_TYPES },
  opacity: { value: 0.6, marks: MARK_CONTRACT_TYPES },
  fillOpacity: { value: 0.5, marks: MARK_CONTRACT_TYPES },
  fill: { value: '#ff0000', marks: MARK_CONTRACT_TYPES },
  stroke: { value: '#333333', marks: MARK_CONTRACT_TYPES },
  strokeWidth: { value: 2, marks: MARK_CONTRACT_TYPES },
  tooltip: { value: true, marks: MARK_CONTRACT_TYPES },
  clip: { value: true, marks: MARK_CONTRACT_TYPES },
  fillPattern: { value: 'none', marks: MARK_CONTRACT_TYPES },
} as const;

type UnionKeys<T> = T extends unknown ? keyof T : never;
type AllowedMarks<K extends PropertyKey, T = MarkDef> = T extends { type: infer M }
  ? K extends keyof T
    ? M
    : never
  : never;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
type Cases = typeof MARK_OPTION_CASES;
/** These compile as part of engine typecheck, unlike Vitest-only type assertions. */
export type MarkContractTypeChecks = [
  Assert<Equal<(typeof MARK_CONTRACT_TYPES)[number], MarkType>>,
  Assert<Equal<keyof Cases, Exclude<UnionKeys<MarkDef>, 'type'>>>,
  Assert<
    Equal<
      { [K in keyof Cases]: Equal<Cases[K]['marks'][number], AllowedMarks<K>> }[keyof Cases],
      true
    >
  >,
];
