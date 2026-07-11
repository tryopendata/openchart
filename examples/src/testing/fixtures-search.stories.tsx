/**
 * Testing / Fixtures: series search ("find your country") pinned e2e stories.
 *
 * A 40-series line chart with `seriesSearch` enabled: muted context lines,
 * a search combobox in the reserved band above the chart, and an authored
 * highlight baseline. Data is a frozen deterministic formula (no Math.random)
 * so the pixel baselines never drift. Do not restyle: this content is a
 * frozen contract for the Playwright visual suite.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';
import './testing.css';

export default { title: 'Testing / Fixtures' };

// ---------------------------------------------------------------------------
// SeriesSearch + SeriesSearchMobile
// ---------------------------------------------------------------------------

const COUNTRIES = [
  'United States',
  'China',
  'Japan',
  'Germany',
  'India',
  'United Kingdom',
  'France',
  'Italy',
  'Brazil',
  'Canada',
  'Russia',
  'South Korea',
  'Australia',
  'Mexico',
  'Spain',
  'Indonesia',
  'Netherlands',
  'Saudi Arabia',
  'Türkiye',
  'Switzerland',
  'Poland',
  'Argentina',
  'Sweden',
  'Norway',
  'Belgium',
  'Ireland',
  'Israel',
  'Austria',
  'Nigeria',
  'Egypt',
  'South Africa',
  'Denmark',
  'Singapore',
  'Philippines',
  'Vietnam',
  'Malaysia',
  'Chile',
  'Finland',
  'Portugal',
  "Côte d'Ivoire",
];

/**
 * Frozen deterministic series: index 100 at 2000, then a per-country growth
 * slope plus a bounded sine wobble. Pure math, stable across runs.
 */
function buildCountryData(): Array<{ year: string; index: number; country: string }> {
  const rows: Array<{ year: string; index: number; country: string }> = [];
  COUNTRIES.forEach((country, i) => {
    for (let t = 0; t <= 12; t++) {
      const year = 2000 + t * 2;
      const growth = 1.5 + (i % 7) * 0.55;
      const wobble = Math.sin(t * (0.6 + (i % 5) * 0.13) + i) * (2 + (i % 4));
      const index = Math.round((100 + growth * t * 2 + wobble) * 10) / 10;
      rows.push({ year: `${year}-01-01`, index, country });
    }
  });
  return rows;
}

const findYourCountrySpec: ChartSpec = {
  mark: 'line',
  data: buildCountryData(),
  encoding: {
    x: { field: 'year', type: 'temporal' },
    y: { field: 'index', type: 'quantitative' },
    color: { field: 'country', type: 'nominal', highlight: ['United States'] },
  },
  seriesSearch: { placeholder: 'Find a country' },
  legend: { show: false },
  labels: { density: 'none' },
  chrome: {
    title: 'Find your country',
    subtitle: 'Economic output per person, indexed to 2000 = 100',
    source: 'Source: Frozen synthetic data (deterministic test fixture)',
  },
};

export const SeriesSearch = () => (
  <div className="tfix-chart tfix-h-550">
    <Chart spec={findYourCountrySpec} />
  </div>
);

export const SeriesSearchMobile = () => (
  <div
    className="tfix-debug-border tfix-fixed-size"
    style={{ '--w': '360px', '--h': '480px' } as React.CSSProperties}
  >
    <Chart spec={findYourCountrySpec} />
  </div>
);
