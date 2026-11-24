import { CATEGORICAL_PALETTE, type RaceEncoding } from '@opendata-ai/openchart-core';
import type { RaceMatrix, RaceTimeline } from './types';

/**
 * Assigns palette indices in order of first appearance in integer-period samples,
 * followed by any remaining keys in matrix order. An omitted color field or one
 * matching the key field assigns slots per key. Constant colors stay as strings.
 */
export function assignRaceColors(
  matrix: RaceMatrix,
  timeline: RaceTimeline,
  colorEncoding: RaceEncoding['color'],
  keyField: string,
): Array<number | string> {
  if (colorEncoding && 'value' in colorEncoding) {
    const { value } = colorEncoding;
    return matrix.keys.map(() => value);
  }

  const byCategory = colorEncoding !== undefined && colorEncoding.field !== keyField;
  const groupSlots = new Map<number | string | null, number>();
  const assign = (keyIndex: number) => {
    const group = byCategory ? matrix.colorValues[keyIndex] : keyIndex;
    const slot = groupSlots.get(group) ?? groupSlots.size;
    groupSlots.set(group, slot);
    return slot;
  };

  for (let period = 0; period < timeline.periodCount; period++) {
    for (const { keyIndex } of timeline.sample(period).items) {
      assign(keyIndex);
    }
  }
  return matrix.keys.map((_, keyIndex) => assign(keyIndex));
}

/**
 * Resolve palette indices against the active palette, preserving constant colors.
 * An empty palette uses the core categorical palette.
 */
export function resolveRaceColors(
  slots: readonly (number | string)[],
  palette: readonly string[],
): string[] {
  const colors = palette.length > 0 ? palette : CATEGORICAL_PALETTE;
  return slots.map((slot) => (typeof slot === 'number' ? colors[slot % colors.length] : slot));
}
