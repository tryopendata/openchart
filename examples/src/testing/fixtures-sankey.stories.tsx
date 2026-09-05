/**
 * Testing / Fixtures Sankey — pinned e2e stories for the phase-6 sankey
 * anatomy: outside-left first-column labels, outside-right last column, the
 * tabular value tspan, and the opt-in "Other" bucket.
 *
 * Inline data keeps the fixtures frozen. Do not restyle: pixel contract.
 */

import type { SankeySpec } from '@opendata-ai/openchart-core';
import { Sankey } from '@opendata-ai/openchart-react';
import './testing.css';

export default { title: 'Testing / Fixtures Sankey' };

// ---------------------------------------------------------------------------
// Frozen data — US primary energy consumption, quadrillion BTU.
// ---------------------------------------------------------------------------

const energyFlows = [
  { source: 'Petroleum', target: 'Transport', value: 24.6 },
  { source: 'Petroleum', target: 'Industry', value: 9.8 },
  { source: 'Natural gas', target: 'Electricity', value: 12.4 },
  { source: 'Natural gas', target: 'Industry', value: 10.1 },
  { source: 'Natural gas', target: 'Buildings', value: 8.2 },
  { source: 'Coal', target: 'Electricity', value: 8.9 },
  { source: 'Nuclear', target: 'Electricity', value: 8.1 },
  { source: 'Wind', target: 'Electricity', value: 4.4 },
  { source: 'Solar', target: 'Electricity', value: 2.3 },
  { source: 'Hydro', target: 'Electricity', value: 2.2 },
  { source: 'Geothermal', target: 'Electricity', value: 0.2 },
  { source: 'Biomass', target: 'Industry', value: 2.4 },
  { source: 'Electricity', target: 'Buildings', value: 24.7 },
  { source: 'Electricity', target: 'Industry', value: 10.4 },
  { source: 'Electricity', target: 'Transport', value: 3.4 },
];

const baseSpec: SankeySpec = {
  type: 'sankey',
  data: energyFlows,
  encoding: {
    source: { field: 'source', type: 'nominal' },
    target: { field: 'target', type: 'nominal' },
    value: { field: 'value', type: 'quantitative' },
  },
  chrome: {
    title: 'Buildings and Industry Each Outdraw Transport',
    subtitle: 'Primary energy by source and end use, quadrillion BTU',
    source: 'Source: US Energy Information Administration, Monthly Energy Review',
    byline: 'Chart: OpenChart',
  },
  animation: false,
};

// ---------------------------------------------------------------------------
// Energy / EnergyDark — the same diagram in both modes. Dark exercises the
// 0.6 link opacity.
// ---------------------------------------------------------------------------

export const Energy = () => (
  <div className="tfix-chart tfix-h-500">
    <Sankey spec={baseSpec} />
  </div>
);

// The Ladle host page is light and the sankey paints no full-bleed background
// of its own, so the fixture container carries the dark surface.
export const EnergyDark = () => (
  <div className="tfix-chart tfix-h-500 oc-dark" style={{ background: 'var(--oc-bg)' }}>
    <Sankey spec={baseSpec} darkMode="force" />
  </div>
);

// ---------------------------------------------------------------------------
// OtherBucket — `other` folds sub-threshold nodes in each column into one
// neutral "Other" node without changing the diagram's total flow. Wind, solar,
// hydro, geothermal and biomass each sit under 5% of the source column.
// ---------------------------------------------------------------------------

const otherSpec: SankeySpec = {
  ...baseSpec,
  other: 0.05,
  chrome: {
    ...baseSpec.chrome,
    title: 'The Long Tail of Small Sources, Folded Into One',
    subtitle: 'Sources under 5% of their column bucketed as "Other", quadrillion BTU',
  },
};

export const OtherBucket = () => (
  <div className="tfix-chart tfix-h-500">
    <Sankey spec={otherSpec} />
  </div>
);
