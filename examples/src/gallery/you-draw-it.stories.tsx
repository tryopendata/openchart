/**
 * Features / You Draw It — interactive guess-then-reveal charts.
 *
 * The reader sketches their guess of the trend, then reveals the real data for
 * comparison. Two demos: a basic draw-then-reveal with a delta summary, and a
 * variant with a crowd comparison line.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';
import { useState } from 'react';
import { Demo, GalleryPage, Section } from '../components';

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

const ACTUAL_FROM_2006 = INCOME.filter((r) => Number(r.year) >= 2006);

function DrawThenRevealDemo() {
  const [summary, setSummary] = useState<string>('Draw your guess, then reveal.');
  return (
    <div>
      <div style={{ height: 460 }}>
        <Chart
          spec={baseSpec}
          onReveal={(guess) => {
            if (guess.length === 0) {
              setSummary('You skipped straight to the reveal.');
              return;
            }
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
      <p
        style={{
          fontFamily: 'var(--oc-font-body, system-ui, sans-serif)',
          fontSize: 'var(--oc-type-caption)',
          color: 'var(--oc-text-muted)',
          marginTop: 'var(--oc-space-3)',
        }}
      >
        {summary}
      </p>
    </div>
  );
}

const COMPARISON: Array<{ x: string; y: number }> = [
  { x: '2006', y: 141 },
  { x: '2010', y: 150 },
  { x: '2014', y: 162 },
  { x: '2018', y: 175 },
  { x: '2022', y: 190 },
];

const comparisonSpec: ChartSpec = {
  ...baseSpec,
  youDrawIt: {
    from: '2006',
    prompt: 'Draw your guess (a dashed crowd line is shown for reference)',
    revealLabel: 'Reveal',
    comparisonLine: COMPARISON,
  },
  chrome: {
    title: 'You draw it: with a crowd comparison line',
    subtitle: 'The dashed line shows what everyone else guessed.',
  },
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default { title: 'Features' };

export const YouDrawIt = () => (
  <GalleryPage
    title="You Draw It"
    lede="The reader sketches their guess of the trend from a midpoint to the right edge, then reveals the real data for comparison. A single youDrawIt config on the spec turns any line chart into an interactive quiz. Wire onReveal for a delta summary."
  >
    <Section
      id="basics"
      title="Basics"
      lede="Add youDrawIt.from to the spec: the chart hides data past that point and lets the reader draw. Hit 'reveal' to see the real line overlaid."
    >
      <Demo
        id="draw-then-reveal"
        title="Draw then reveal"
        description="The reader draws from 2006 onward, then reveals the real trend. The onReveal callback receives the guess points for a delta computation."
        specForPanel={baseSpec}
        height={540}
      >
        <DrawThenRevealDemo />
      </Demo>
      <Demo
        id="comparison-line"
        title="With a comparison line"
        description="youDrawIt.comparisonLine adds a dashed reference line (e.g. a crowd average) the reader can compare their guess against alongside the real data."
        spec={comparisonSpec}
        height={480}
      />
    </Section>
  </GalleryPage>
);
