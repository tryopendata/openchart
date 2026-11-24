import { CATEGORICAL_PALETTE, type RaceEncoding } from '@opendata-ai/openchart-core';
import { departingLineOpacity, lineVisibilityRuns } from './line-visibility';
import { VISIBILITY_EPSILON } from './timeline';
import type { RaceColorAssignment, RaceMatrix, RaceModel, RaceTimeline } from './types';

function firstAppearanceOrder(timeline: RaceTimeline): number[] {
  const { samplesPerPeriod, keyCount, periodCount, top } = timeline;
  const periods = Array.from({ length: periodCount }, () => [] as { key: number; rank: number }[]);
  for (let key = 0; key < keyCount; key++) {
    const { exact, smoothed } = timeline.rankSamples(key);
    for (let period = 0; period < periodCount; period++) {
      const sample = period * samplesPerPeriod;
      const rank = smoothed[sample];
      if (rank < top - VISIBILITY_EPSILON && exact[sample] < keyCount) {
        periods[period].push({ key, rank });
      }
    }
  }
  const order = new Set<number>();
  for (const items of periods) {
    items.sort((a, b) => a.rank - b.rank || a.key - b.key);
    for (const { key } of items) order.add(key);
  }
  for (let key = 0; key < keyCount; key++) order.add(key);
  return [...order];
}

interface ColorConflicts {
  keys: number[];
  weights: number[];
  total: number;
}

function collectConflicts(matrix: RaceMatrix, timeline: RaceTimeline): ColorConflicts[] {
  const { keyCount, samplesPerPeriod, top } = timeline;
  // Score at six samples per period on the standard 24-sample rank grid.
  // The rank cache still gives the exact order and smoothed visibility at each scored frame.
  const stride = samplesPerPeriod % 4 === 0 ? 4 : 1;
  const scoresPerPeriod = samplesPerPeriod / stride;
  const count = (timeline.periodCount - 1) * scoresPerPeriod + 1;
  const frames = Array.from(
    { length: count },
    () => [] as { key: number; rank: number; weight: number }[],
  );
  // Barely visible rows and trails carry little visual conflict but can
  // comprise most pairs on a leaderboard that turns over every period.
  const minOpacity = 0.1;
  const threshold = top - minOpacity;
  const trailWeights = new Float64Array(count);
  for (let key = 0; key < keyCount; key++) {
    const { exact, smoothed } = timeline.rankSamples(key);
    let wasVisible = false;
    for (let score = 0; score < count; score++) {
      const sample = score * stride;
      if (smoothed[sample] >= threshold || exact[sample] === keyCount) continue;
      frames[score].push({ key, rank: exact[sample], weight: Math.min(1, top - smoothed[sample]) });
      wasVisible = true;
    }
    // A brief lead between score samples can still leave a visible line trail.
    if (!wasVisible && !smoothed.some((rank) => rank < threshold)) continue;

    trailWeights.fill(0);
    let first = count;
    let last = 0;
    for (const run of lineVisibilityRuns(timeline, key, matrix.values[key])) {
      const start = Math.ceil(run.end * scoresPerPeriod);
      const expiry = Math.min(count, Math.ceil((run.end + 1) * scoresPerPeriod));
      first = Math.min(first, start);
      last = Math.max(last, expiry);
      for (let score = start; score < expiry; score++) {
        const sample = score * stride;
        if (smoothed[sample] < threshold && exact[sample] < keyCount) continue;
        const opacity = departingLineOpacity(run, score / scoresPerPeriod);
        trailWeights[score] = Math.max(opacity, trailWeights[score]);
      }
    }
    for (let score = first; score < last; score++) {
      if (trailWeights[score] > minOpacity)
        frames[score].push({ key, rank: top, weight: trailWeights[score] });
    }
  }

  const comparisons = frames.reduce((sum, frame) => sum + frame.length ** 2, 0);
  // Direct indexing avoids hashing crowded frames. Cap the workspace at 8 MiB
  // and keep sparse storage for larger datasets or timelines with fewer overlaps.
  const dense =
    keyCount <= 1024 && comparisons > keyCount ** 2 ? new Float64Array(keyCount ** 2) : undefined;
  const sparse = dense ? [] : matrix.keys.map(() => new Map<number, number>());
  for (const ranked of frames) {
    for (let index = 0; index < ranked.length; index++) {
      const a = ranked[index];
      for (let other = index + 1; other < ranked.length; other++) {
        const b = ranked[other];
        const gap = Math.max(1, Math.abs(a.rank - b.rank));
        // Every sample contributes co-visibility time. The closest ranks
        // dominate because those repeats are the hardest to distinguish.
        const weight = gap === 1 ? 64 : gap === 2 ? 16 : gap === 3 ? 4 : 1;
        const contribution = weight * Math.min(a.weight, b.weight);
        if (dense) dense[a.key * keyCount + b.key] += contribution;
        else sparse[a.key].set(b.key, (sparse[a.key].get(b.key) ?? 0) + contribution);
      }
    }
  }
  const graph = matrix.keys.map((): ColorConflicts => ({ keys: [], weights: [], total: 0 }));
  function connect(a: number, b: number, weight: number) {
    graph[a].keys.push(b);
    graph[a].weights.push(weight);
    graph[a].total += weight;
    graph[b].keys.push(a);
    graph[b].weights.push(weight);
    graph[b].total += weight;
  }

  for (let a = 0; a < keyCount; a++) {
    if (dense) {
      for (let b = a + 1; b < keyCount; b++) {
        const weight = dense[a * keyCount + b];
        if (weight > 0) connect(a, b, weight);
      }
    } else {
      for (const [b, weight] of sparse[a]) connect(a, b, weight);
    }
  }
  return graph;
}

function conflictAwareSlots(
  order: number[],
  conflicts: ColorConflicts[],
  paletteSize: number,
  slots: number[],
): void {
  const uses = new Array<number>(paletteSize).fill(0);
  for (const slot of slots) {
    if (slot >= 0) uses[slot]++;
  }

  function costsFor(key: number): number[] {
    const costs = uses.map(() => 0);
    const { keys, weights } = conflicts[key];
    for (let index = 0; index < keys.length; index++) {
      const slot = slots[keys[index]];
      if (slot >= 0) costs[slot] += weights[index];
    }
    return costs;
  }

  // Start with the keys with the most co-visibility, keeping first appearance for ties.
  const priority = [...order].sort((a, b) => conflicts[b].total - conflicts[a].total);
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
}

/** Copy the assignments already used by the prior model without retaining its data. */
function seedSlots(
  matrix: RaceMatrix,
  categoryField: string | undefined,
  previous?: RaceModel,
): Map<number, number[]> {
  const seeds = new Map<number, number[]>();
  if (!previous) return seeds;
  const { encoding } = previous.spec;
  const color = encoding.color;
  if (color && 'value' in color) return seeds;
  const previousCategory = color?.field === encoding.key.field ? undefined : color?.field;
  if (categoryField !== previousCategory) return seeds;

  const previousIndices = new Map(previous.matrix.keys.map((key, index) => [key, index]));
  const matching = matrix.keys.map((key, index) => {
    const oldIndex = previousIndices.get(key);
    if (oldIndex === undefined) return -1;
    if (categoryField && previous.matrix.colorValues[oldIndex] !== matrix.colorValues[index])
      return -1;
    return oldIndex;
  });
  for (const [size, slots] of previous.colorAssignment.byPaletteSize) {
    seeds.set(
      size,
      matching.map((index) => {
        const slot = slots[index];
        return typeof slot === 'number' ? slot : -1;
      }),
    );
  }
  return seeds;
}

/** Prepare a stable color assignment and cache it by the active palette size. */
export function assignRaceColors(
  matrix: RaceMatrix,
  timeline: RaceTimeline,
  colorEncoding: RaceEncoding['color'],
  keyField: string,
  previous?: RaceModel,
): RaceColorAssignment {
  const byPaletteSize = new Map<number, readonly (number | string)[]>();
  if (colorEncoding && 'value' in colorEncoding) {
    const slots = matrix.keys.map(() => colorEncoding.value);
    return { slotsFor: () => slots, byPaletteSize };
  }

  const order = firstAppearanceOrder(timeline);
  const field = colorEncoding?.field;
  const categoryField = field === keyField ? undefined : field;
  const seeds = seedSlots(matrix, categoryField, previous);
  let conflicts: ReturnType<typeof collectConflicts> | undefined;
  return {
    byPaletteSize,
    slotsFor(size) {
      const paletteSize = size || CATEGORICAL_PALETTE.length;
      const cached = byPaletteSize.get(paletteSize);
      if (cached) return cached;

      const slots = seeds.get(paletteSize) ?? matrix.keys.map(() => -1);
      const unassigned = order.filter((key) => slots[key] < 0);
      if (categoryField || paletteSize >= slots.length) {
        const byGroup = new Map<number | string | null, number>();
        const used = new Set<number>();
        const group = (key: number) => (categoryField ? matrix.colorValues[key] : key);
        for (const key of order) {
          if (slots[key] < 0) continue;
          byGroup.set(group(key), slots[key]);
          used.add(slots[key]);
        }
        const uses = new Array<number>(paletteSize).fill(0);
        for (const slot of used) uses[slot % paletteSize]++;
        for (const key of unassigned) {
          const id = group(key);
          let slot = byGroup.get(id);
          if (slot === undefined) {
            const effective = uses.reduce(
              (best, count, candidate) => (count < uses[best] ? candidate : best),
              0,
            );
            slot = effective;
            while (used.has(slot)) slot += paletteSize;
            used.add(slot);
            uses[effective]++;
            byGroup.set(id, slot);
          }
          slots[key] = slot;
        }
      } else if (unassigned.length > 0) {
        conflicts ??= collectConflicts(matrix, timeline);
        conflictAwareSlots(unassigned, conflicts, paletteSize, slots);
      }
      byPaletteSize.set(paletteSize, slots);
      return slots;
    },
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
