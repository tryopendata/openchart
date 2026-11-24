import type { A11yMetadata } from '@opendata-ai/openchart-core';

export function raceA11y(title?: string): A11yMetadata {
  return {
    altText: title ?? 'Race chart',
    dataTableFallback: [],
    role: 'img',
    keyboardNavigable: false,
  };
}
