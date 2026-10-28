import type { ChartRenderer } from '../registry';
import { computeErrorbarMarks } from './compute';
export const errorbarRenderer: ChartRenderer = (spec, scales, area) =>
  computeErrorbarMarks(spec, scales, area);
