import type { RaceBarGeometry, RaceBarStatic, RaceFrame, Rect } from '@opendata-ai/openchart-core';

export interface BarStaticInput {
  area: Rect;
  top: number;
  maxLabelWidth: number;
  maxValueLabelWidth: number;
  fontSize: { name: number; value: number; tick: number };
  showPeriod: boolean;
  showSummary: boolean;
}

export function computeBarStatic(_input: BarStaticInput): RaceBarStatic {
  throw new Error('not implemented');
}

export function barGeometry(
  _stat: RaceBarStatic,
  _frame: RaceFrame,
  _formatTick: (value: number) => string,
): RaceBarGeometry {
  throw new Error('not implemented');
}
