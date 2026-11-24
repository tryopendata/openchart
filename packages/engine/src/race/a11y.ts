import type { A11yMetadata } from '@opendata-ai/openchart-core';
import type { RaceModel, RaceTimeline } from './types';

const MAX_PERIOD_ROWS = 60;
const metadataByModel = new WeakMap<RaceModel, A11yMetadata>();

function rankedKeys(timeline: RaceTimeline, t: number): number[] {
  const present: Array<{ key: number; value: number }> = [];
  for (let key = 0; key < timeline.keyCount; key++) {
    const value = timeline.valueAt(key, t);
    if (Number.isFinite(value)) present.push({ key, value });
  }
  const tiedRanks = new Map<number, number>();
  function rank(key: number): number {
    const known = tiedRanks.get(key);
    if (known !== undefined) return known;
    const exact = timeline.exactRank(key, t);
    tiedRanks.set(key, exact);
    return exact;
  }
  return present
    .sort((a, b) => b.value - a.value || rank(a.key) - rank(b.key))
    .map(({ key }) => key);
}

function accessibleLabel(matrix: RaceModel['matrix'], key: number): string {
  return matrix.labels[key].trim() || matrix.keys[key].trim() || 'Unnamed entry';
}

/** Read up to three leaders for a live announcement, including any hidden by a transition. */
export function raceA11yLeaders(model: RaceModel, t: number): string[] {
  return rankedKeys(model.timeline, t)
    .slice(0, Math.min(model.timeline.top, 3))
    .map((key) => accessibleLabel(model.matrix, key));
}

function describeRace(model: RaceModel, first: number[], last: number[]): string {
  const { matrix, periodLabels } = model;
  const startLabel = periodLabels[0];
  const endLabel = periodLabels[periodLabels.length - 1];
  const lead = (ranked: number[], period: string) =>
    ranked.length
      ? `${accessibleLabel(matrix, ranked[0])} leads in ${period}.`
      : `No ranked entries in ${period}.`;
  const sentences = [
    `${startLabel} to ${endLabel}.`,
    lead(first, startLabel),
    lead(last, endLabel),
  ];

  const startRanks = new Map(first.map((key, rank) => [key, rank + 1]));
  let biggestClimb = 0;
  let climberSentence: string | undefined;
  last.forEach((key, rank) => {
    const startRank = startRanks.get(key);
    const endRank = rank + 1;
    if (startRank !== undefined && startRank - endRank > biggestClimb) {
      biggestClimb = startRank - endRank;
      climberSentence = `${accessibleLabel(matrix, key)} climbs the most, from rank ${startRank} to rank ${endRank}.`;
    }
  });
  if (climberSentence) sentences.push(climberSentence);
  return sentences.join(' ');
}

function buildMetadata(model: RaceModel): A11yMetadata {
  const { matrix, periodLabels, timeline, formatValue, spec } = model;
  const { hidden, table, description } = spec.a11y ?? {};
  const { periodCount, top } = timeline;
  const lastPeriod = periodCount - 1;
  const rowCount = Math.min(periodCount, MAX_PERIOD_ROWS);
  const showTable = !hidden && table !== false;
  const first = rankedKeys(timeline, 0);
  const last = rankedKeys(timeline, lastPeriod);
  const dataTableFallback: string[][] = [];
  if (showTable) {
    dataTableFallback.push(['Period', ...Array.from({ length: top }, (_, i) => `Rank ${i + 1}`)]);
    for (let row = 0; row < rowCount; row++) {
      const period = Math.round((row * lastPeriod) / (rowCount - 1));
      const ranked =
        period === 0 ? first : period === lastPeriod ? last : rankedKeys(timeline, period);
      const values = Array.from({ length: top }, (_, rank) => {
        const key = ranked[rank];
        return key === undefined
          ? ''
          : `${accessibleLabel(matrix, key)} (${formatValue(matrix.values[key][period])})`;
      });
      dataTableFallback.push([periodLabels[period], ...values]);
    }
  }
  return {
    altText: description ?? describeRace(model, first, last),
    dataTableFallback,
    role: 'img',
    keyboardNavigable: false,
    ...(hidden && { hidden }),
    ...(showTable && rowCount < periodCount && { totalRows: periodCount }),
  };
}

/** Build the size-independent description and period table once per prepared model. */
export function raceA11y(model: RaceModel): A11yMetadata {
  let metadata = metadataByModel.get(model);
  if (!metadata) {
    metadata = buildMetadata(model);
    metadataByModel.set(model, metadata);
  }
  return { ...metadata, dataTableFallback: metadata.dataTableFallback.map((row) => [...row]) };
}
