/**
 * Deterministic per-step fixtures for the scrollytelling visual suite (plan 11).
 *
 * These pin each step of the `Charts / Scrollytelling` narrative at a fixed
 * state (`animation: false`, the step's patch pre-applied) so the Playwright
 * visual suite can screenshot each stage without driving a scroll. They render
 * into a plain `.tfix-chart` container (not the sticky `<ChartStory>` shell) so
 * the screenshot captures only the chart.
 *
 * They live here, under `Testing / Fixtures`, rather than beside the narrative:
 * exported from the Scrollytelling story file they showed up in the public
 * sidebar as four "scrollytelling demos" that were really just static charts.
 * The live narrative demo is `ScrollyNarrative` in
 * `../charts/scrollytelling.stories.tsx`.
 */

import { Chart } from '@opendata-ai/openchart-react';
import { scrollySpecs } from '../charts/scrollytelling-specs';
import './testing.css';

export default { title: 'Testing / Fixtures' };

// Re-exported from the narrative story so the fixtures and the live demo can
// never drift out of sync.
const { base, highlight, zoomed, annotated, payoff } = scrollySpecs;

export const ScrollyBase = () => (
  <div className="tfix-chart tfix-h-440">
    <Chart spec={base} />
  </div>
);

export const ScrollyHighlight = () => (
  <div className="tfix-chart tfix-h-440">
    <Chart spec={highlight} />
  </div>
);

/** Step 2: x-domain clipped to the recent window. The axis must relabel. */
export const ScrollyZoomed = () => (
  <div className="tfix-chart tfix-h-440">
    <Chart spec={zoomed} />
  </div>
);

export const ScrollyAnnotated = () => (
  <div className="tfix-chart tfix-h-440">
    <Chart spec={annotated} />
  </div>
);

export const ScrollyPayoff = () => (
  <div className="tfix-chart tfix-h-440">
    <Chart spec={payoff} />
  </div>
);
