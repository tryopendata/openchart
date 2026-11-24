import { CATEGORICAL_PALETTE, type RaceEncoding } from '@opendata-ai/openchart-core';
import { departingLineOpacity, lineVisibilityRuns } from './line-visibility';
import type { RaceMatrix, RaceModel, RaceTimeline } from './types';

function collectConflicts(matrix: RaceMatrix, timeline: RaceTimeline): Array<Map<number, number>> {
  const conflicts = Array.from({ length: timeline.keyCount }, () => new Map<number, number>());
  const { samplesPerPeriod } = timeline;
  const end = (timeline.periodCount - 1) * samplesPerPeriod;
  const departures = new Map<number, Map<number, number>>();
  matrix.values.forEach((values, key) => {
    for (const run of lineVisibilityRuns(timeline, key, values)) {
      const start = Math.ceil(run.end * samplesPerPeriod);
      const expiry = Math.min(end + 1, Math.ceil((run.end + 1) * samplesPerPeriod));
      for (let sample = start; sample < expiry; sample++) {
        const opacity = departingLineOpacity(run, sample / samplesPerPeriod);
        if (opacity <= 0) continue;
        const series = departures.get(sample) ?? new Map<number, number>();
        series.set(key, Math.max(opacity, series.get(key) ?? 0));
        departures.set(sample, series);
      }
    }
  });

  for (let sample = 0; sample <= end; sample++) {
    const { items } = timeline.sample(sample / samplesPerPeriod);
    const active = new Set(items.map(({ keyIndex }) => keyIndex));
    const ranked = items.map(({ keyIndex, rank }) => ({ keyIndex, rank, weight: 1 }));
    for (const [keyIndex, opacity] of departures.get(sample) ?? []) {
      if (active.has(keyIndex)) continue;
      ranked.push({ keyIndex, rank: timeline.top, weight: opacity });
    }
    for (const [index, a] of ranked.entries()) {
      for (let other = index + 1; other < ranked.length; other++) {
        const b = ranked[other];
        const gap = Math.max(1, Math.abs(a.rank - b.rank));
        // Every sample contributes co-visibility time. The closest ranks
        // dominate because those repeats are the hardest to distinguish.
        const weight = gap === 1 ? 64 : gap === 2 ? 16 : gap === 3 ? 4 : 1;
        const total =
          (conflicts[a.keyIndex].get(b.keyIndex) ?? 0) + weight * Math.min(a.weight, b.weight);
        conflicts[a.keyIndex].set(b.keyIndex, total);
        conflicts[b.keyIndex].set(a.keyIndex, total);
      }
    }
  }
  return conflicts;
}

function conflictAwareSlots(
  order: number[],
  conflicts: Array<Map<number, number>>,
  paletteSize: number,
): number[] {
  const slots = order.map(() => -1);
  const uses = new Array<number>(paletteSize).fill(0);

  function costsFor(key: number): number[] {
    const costs = uses.map(() => 0);
    for (const [other, weight] of conflicts[key]) {
      const slot = slots[other];
      if (slot >= 0) costs[slot] += weight;
    }
    return costs;
  }

  // Start with the keys with the most co-visibility, keeping first appearance for ties.
  const weight = conflicts.map((neighbors) =>
    [...neighbors.values()].reduce((sum, n) => sum + n, 0),
  );
  const priority = [...order].sort((a, b) => weight[b] - weight[a]);
  for (const key of priority) {
    const costs = costsFor(key);
    const slot = costs.reduce(
      (best, cost, candidate) =>
        cost < costs[best] || (cost === costs[best] && uses[candidate] < uses[best])
          ? candidate
          : best,
      0,
    );
    slots[key] = slot;
    uses[slot]++;
  }

  // A later assignment can make a different color cheaper for an earlier key.
  // Each move strictly lowers the total cost, so the result is deterministic.
  let improved = true;
  while (improved) {
    improved = false;
    for (const key of priority) {
      const current = slots[key];
      const costs = costsFor(key);
      const best = costs.reduce(
        (slot, cost, candidate) => (cost < costs[slot] ? candidate : slot),
        current,
      );
      if (best !== current) {
        slots[key] = best;
        improved = true;
      }
    }
  }
  return slots;
}

/** Prepare a stable color assignment and cache it by the active palette size. */
export function assignRaceColors(
  matrix: RaceMatrix,
  timeline: RaceTimeline,
  colorEncoding: RaceEncoding['color'],
  keyField: string,
): (paletteSize: number) => Array<number | string> {
  if (colorEncoding && 'value' in colorEncoding) {
    const slots = matrix.keys.map(() => colorEncoding.value);
    return () => slots;
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
    for (const { keyIndex } of timeline.sample(period).items) assign(keyIndex);
  }
  const slots = matrix.keys.map((_, keyIndex) => assign(keyIndex));
  if (byCategory) return () => slots;

  const order = matrix.keys.map((_, index) => index).sort((a, b) => slots[a] - slots[b]);
  const cache = new Map<number, number[]>();
  let conflicts: ReturnType<typeof collectConflicts> | undefined;
  return (size) => {
    const paletteSize = size || CATEGORICAL_PALETTE.length;
    if (paletteSize >= slots.length) return slots;
    let assigned = cache.get(paletteSize);
    if (!assigned) {
      conflicts ??= collectConflicts(matrix, timeline);
      assigned = conflictAwareSlots(order, conflicts, paletteSize);
      cache.set(paletteSize, assigned);
    }
    return assigned;
  };
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

const assignments = new WeakMap<
  RaceModel,
  {
    slots: RaceModel['colorSlots'];
    paletteSize: number;
    forPalette: ReturnType<typeof assignRaceColors>;
  }
>();

export function cacheRaceColorAssignment(
  model: RaceModel,
  paletteSize: number,
  forPalette: ReturnType<typeof assignRaceColors>,
): void {
  assignments.set(model, { slots: model.colorSlots, paletteSize, forPalette });
}

export function raceColorSlots(model: RaceModel, paletteSize: number): RaceModel['colorSlots'] {
  const assignment = assignments.get(model);
  if (
    !assignment ||
    assignment.slots !== model.colorSlots ||
    assignment.paletteSize === paletteSize
  ) {
    return model.colorSlots;
  }
  return assignment.forPalette(paletteSize);
}
