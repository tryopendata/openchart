/**
 * Testing / Fixtures: "you draw it" (`youDrawIt`) pinned e2e stories.
 *
 * A single-series line chart with `youDrawIt` enabled: the line renders up to
 * `from`, then a hatched "draw here" region with a prompt and a skip-to-reveal
 * button covers the rest. The pre-interaction state is fully deterministic
 * (frozen data, animation: false), so the Playwright baselines never drift.
 * Do not restyle: this content is a frozen contract for the visual suite.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';
import type React from 'react';
import './testing.css';

export default { title: 'Testing / Fixtures' };

// ---------------------------------------------------------------------------
// Frozen income-trend series (the classic NYT "you draw it" subject).
// ---------------------------------------------------------------------------

/** Median family income indexed to 1990 = 100, deterministic (no randomness). */
const INCOME: Array<{ year: string; income: number }> = [
  { year: '1990', income: 100 },
  { year: '1994', income: 108 },
  { year: '1998', income: 121 },
  { year: '2002', income: 129 },
  { year: '2006', income: 141 },
  { year: '2010', income: 138 },
  { year: '2014', income: 152 },
  { year: '2018', income: 168 },
  { year: '2022', income: 181 },
];

const youDrawItSpec: ChartSpec = {
  mark: 'line',
  data: INCOME,
  encoding: {
    x: { field: 'year', type: 'temporal' },
    y: { field: 'income', type: 'quantitative' },
  },
  youDrawIt: {
    from: '2006',
    prompt: 'Draw what you think happened',
    revealLabel: 'Show me the answer',
  },
  animation: false,
  labels: { density: 'none' },
  chrome: {
    title: 'You draw it: family income since 1990',
    subtitle: 'Median household income, indexed to 1990 = 100',
    source: 'Source: Frozen synthetic data (deterministic test fixture)',
  },
};

export const YouDrawIt = () => (
  <div className="tfix-chart tfix-h-450">
    <Chart spec={youDrawItSpec} />
  </div>
);

export const YouDrawItDark = () => (
  <div className="tfix-chart tfix-h-450">
    <Chart spec={youDrawItSpec} darkMode="force" />
  </div>
);

export const YouDrawItMobile = () => (
  <div
    className="tfix-debug-border tfix-fixed-size"
    style={{ '--w': '360px', '--h': '440px' } as React.CSSProperties}
  >
    <Chart spec={youDrawItSpec} />
  </div>
);
