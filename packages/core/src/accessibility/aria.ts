/**
 * ARIA label generation for individual marks.
 *
 * Produces per-mark labels for screen reader navigation, enabling
 * users to explore data points individually.
 */

import { defaultNumberFormatter } from '../locale/format';
import type { Mark } from '../types/layout';

/**
 * Generate ARIA labels for a set of marks.
 *
 * Returns a Map keyed by a mark identifier (index-based) with
 * descriptive labels like "Data point: US GDP 42 in 2020-01".
 *
 * @param marks - Array of mark objects from the compiled chart layout.
 */
export function generateAriaLabels(marks: Mark[]): Map<string, string> {
  const labels = new Map<string, string>();

  for (let i = 0; i < marks.length; i++) {
    const mark = marks[i];
    const key = `mark-${i}`;

    switch (mark.type) {
      case 'line': {
        const series = mark.seriesKey ?? 'Series';
        const pointCount = mark.points.length;
        labels.set(key, `Line series: ${series} with ${pointCount} points`);
        break;
      }

      case 'area': {
        const series = mark.seriesKey ?? 'Area';
        labels.set(key, `Area series: ${series}`);
        break;
      }

      case 'rect': {
        const dataEntries = Object.entries(mark.data).filter(([k]) => !k.startsWith('_'));
        const description = dataEntries.map(([k, v]) => `${k}: ${formatValue(v)}`).join(', ');
        labels.set(key, `Data point: ${description}`);
        break;
      }

      case 'arc': {
        const dataEntries = Object.entries(mark.data).filter(([k]) => !k.startsWith('_'));
        const description = dataEntries.map(([k, v]) => `${k}: ${formatValue(v)}`).join(', ');
        labels.set(key, `Slice: ${description}`);
        break;
      }

      case 'point': {
        const dataEntries = Object.entries(mark.data).filter(([k]) => !k.startsWith('_'));
        const description = dataEntries.map(([k, v]) => `${k}: ${formatValue(v)}`).join(', ');
        labels.set(key, `Data point: ${description}`);
        break;
      }
    }
  }

  return labels;
}

const ariaNumberFormatter = defaultNumberFormatter();

function formatValue(value: unknown): string {
  if (value == null) return 'N/A';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'number') {
    return ariaNumberFormatter(value);
  }
  return String(value);
}
