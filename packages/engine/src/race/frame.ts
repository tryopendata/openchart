import type { RaceFrame } from '@opendata-ai/openchart-core';
import type { RaceMatrix, RaceSample } from './types';

export interface RacePresentation {
  keys: string[];
  labels: string[];
  colors: string[];
  formatValue: (value: number) => string;
  periods: RaceMatrix['periods'];
  periodLabels: string[];
  top: number;
  summary: boolean;
}

export function buildRaceFrame(sample: RaceSample, presentation: RacePresentation): RaceFrame {
  const { t, periodIndex, items, domainMin, domainMax } = sample;
  const { keys, labels, colors, formatValue, periods, periodLabels, top, summary } = presentation;
  const frame: RaceFrame = {
    t,
    period: {
      index: periodIndex,
      value: periods[periodIndex].value,
      label: periodLabels[periodIndex],
    },
    items: items.map(({ keyIndex, value, rank, rankPos, opacity, change }) => ({
      key: keys[keyIndex],
      label: labels[keyIndex],
      color: colors[keyIndex],
      value,
      valueLabel: formatValue(value),
      rank,
      rankPos,
      opacity,
      change,
    })),
    domain: [domainMin, domainMax],
  };
  if (summary) {
    const value = items.reduce((sum, item) => (item.rank < top ? sum + item.value : sum), 0);
    frame.summary = { value, label: formatValue(value) };
  }
  return frame;
}
