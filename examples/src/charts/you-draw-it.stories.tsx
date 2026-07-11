/**
 * "You draw it" interactive stories (dev playground, not visual-pinned).
 *
 * The reader sketches their guess of the trend from `from` to the right edge,
 * then reveals the real line for comparison. These stories exercise the
 * onReveal callback (delta summary) and the optional comparison line. Drive
 * them by hand (mouse or touch); the visual suite pins the static
 * pre-interaction state via Testing / Fixtures instead.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';
import { useState } from 'react';

export default { title: 'Charts / You Draw It' };

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

const baseSpec: ChartSpec = {
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
  chrome: {
    title: 'You draw it: family income since 1990',
    subtitle: 'Median household income, indexed to 1990 = 100. Drag to guess, then reveal.',
  },
};

/** Actual values from `from` onward, for the delta summary. */
const ACTUAL_FROM_2006 = INCOME.filter((r) => Number(r.year) >= 2006);

export const DrawThenReveal = () => {
  const [summary, setSummary] = useState<string>('Draw your guess, then reveal.');
  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ height: 460 }}>
        <Chart
          spec={baseSpec}
          onReveal={(guess) => {
            if (guess.length === 0) {
              setSummary('You skipped straight to the reveal.');
              return;
            }
            // Average absolute gap between the guess and the actual line.
            const actualByX = new Map(ACTUAL_FROM_2006.map((r) => [r.year, r.income]));
            let total = 0;
            let n = 0;
            for (const g of guess) {
              const actual = actualByX.get(String(g.x));
              if (actual === undefined) continue;
              total += Math.abs(g.y - actual);
              n++;
            }
            const avg = n > 0 ? (total / n).toFixed(1) : '0';
            setSummary(`Your guess was off by ${avg} points on average across ${n} years.`);
          }}
        />
      </div>
      <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: 14, color: '#3f3f46' }}>
        {summary}
      </p>
    </div>
  );
};

const COMPARISON: Array<{ x: string; y: number }> = [
  { x: '2006', y: 141 },
  { x: '2010', y: 150 },
  { x: '2014', y: 162 },
  { x: '2018', y: 175 },
  { x: '2022', y: 190 },
];

export const WithComparisonLine = () => (
  <div style={{ maxWidth: 720, height: 460 }}>
    <Chart
      spec={{
        ...baseSpec,
        youDrawIt: {
          from: '2006',
          prompt: 'Draw your guess (a dashed "crowd" line is shown for reference)',
          revealLabel: 'Reveal',
          comparisonLine: COMPARISON,
        },
        chrome: {
          title: 'You draw it: with a crowd comparison line',
          subtitle: 'The dashed line shows what everyone else guessed.',
        },
      }}
    />
  </div>
);
