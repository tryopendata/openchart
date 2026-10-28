import type { ChartSpec } from '@opendata-ai/openchart-core';
import { geoLabelSpec } from '../../__test-fixtures__/geo-label-spec';
import { barSpec, lineSpec, pieSpec } from '../../__test-fixtures__/specs';
export const chromeSpec: ChartSpec = {
  ...lineSpec,
  chrome: {
    eyebrow: 'Research',
    title: 'Rates & <observations>',
    subtitle: 'Measured across years',
    source: 'Data source',
    byline: 'Research team',
    footer: 'Methods available',
    brand: 'Research lab',
  },
  metrics: [{ label: 'Rate', value: '85%', delta: '+2%', secondary: 'n=40' }],
  watermark: false,
};
export const legendNotesSpec: ChartSpec = {
  ...barSpec,
  width: 330,
  height: 180,
  responsive: { compactAnnotationLimit: 0 },
  annotations: Array.from({ length: 8 }, (_, i) => ({
    type: 'text' as const,
    x: 10,
    y: 'A',
    text: `Long annotation ${i} competing for the same limited plot area`,
  })),
  watermark: false,
};
export const staticPlatformSpecs = {
  tilemap: { type: 'tilemap' as const, data: { CA: 5.4, TX: 4.1, NY: 4.5, FL: 3.3, IL: 4.6 } },
  chrome: chromeSpec,
  'legend-notes': legendNotesSpec,
  line: lineSpec,
  bar: barSpec,
  pie: pieSpec,
  map: geoLabelSpec,
};
