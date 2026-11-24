import { CATEGORICAL_PALETTE, type RaceEncoding } from '@opendata-ai/openchart-core';
import type { RaceMatrix, RaceTimeline } from './types';

export function assignRaceColors(
  matrix: RaceMatrix,
  timeline: RaceTimeline,
  palette: readonly string[],
  colorEncoding: RaceEncoding['color'],
  keyField: string,
): string[] {
  if (colorEncoding && 'value' in colorEncoding) {
    const { value } = colorEncoding;
    return matrix.keys.map(() => value);
  }

  const colors = palette.length > 0 ? palette : CATEGORICAL_PALETTE;
  const byCategory = colorEncoding !== undefined && colorEncoding.field !== keyField;
  const groupColors = new Map<number | string | null, string>();
  const assign = (keyIndex: number) => {
    const group = byCategory ? matrix.colorValues[keyIndex] : keyIndex;
    const color = groupColors.get(group) ?? colors[groupColors.size % colors.length];
    groupColors.set(group, color);
    return color;
  };

  for (let period = 0; period < timeline.periodCount; period++) {
    for (const { keyIndex } of timeline.sample(period).items) {
      assign(keyIndex);
    }
  }
  return matrix.keys.map((_, keyIndex) => assign(keyIndex));
}
