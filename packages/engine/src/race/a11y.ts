import type { A11yMetadata } from '@opendata-ai/openchart-core';
import type { RaceModel } from './types';

export function raceA11y(model: RaceModel): A11yMetadata {
  return {
    altText: model.spec.chrome.title?.text ?? 'Race chart',
    dataTableFallback: [],
    role: 'img',
    keyboardNavigable: false,
  };
}
