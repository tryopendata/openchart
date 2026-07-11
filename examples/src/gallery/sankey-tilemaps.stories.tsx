/**
 * Sankey & Tile Maps — flow diagrams and US state tile grids.
 *
 * Two sections. Sankey shows flows from sources to sinks (energy, budget,
 * funnels) plus the link-coloring and node-alignment knobs. Tile Maps show
 * per-state values on a fixed geographic grid: sequential palettes for
 * quantitative data, custom colors for categorical, and graceful missing-data
 * handling. Every demo pulls from the shared dataset pool; the interactive
 * demo wires TileMap's onTileClick into a live readout.
 */

import type { SankeySpec, TileMapSpec } from '@opendata-ai/openchart-core';
import { TileMap } from '@opendata-ai/openchart-react';
import { useState } from 'react';
import { Demo, GalleryPage, Section } from '../components';
import {
  budgetFlow,
  energyFlow,
  userJourney,
  usStateUnemployment,
  vaccineExemptions,
} from '../data';

// ---------------------------------------------------------------------------
// 1. Energy flow — classic three-column sankey
// ---------------------------------------------------------------------------

const energyFlowSpec: SankeySpec = {
  type: 'sankey',
  data: [...energyFlow.data],
  encoding: {
    source: { field: 'source', type: 'nominal' },
    target: { field: 'target', type: 'nominal' },
    value: { field: 'value', type: 'quantitative' },
  },
  valueFormat: '.1f',
  chrome: {
    title: 'Electricity Is the Grand Central of US Energy',
    subtitle: 'Primary sources through carriers to end-use sectors, quadrillion BTU',
    source: energyFlow.source,
    byline: 'Chart: OpenChart',
  },
  animation: true,
};

// ---------------------------------------------------------------------------
// 2. Budget allocation — revenue streams to departments
// ---------------------------------------------------------------------------

const budgetSpec: SankeySpec = {
  type: 'sankey',
  data: [...budgetFlow.data],
  encoding: {
    source: { field: 'source', type: 'nominal' },
    target: { field: 'target', type: 'nominal' },
    value: { field: 'value', type: 'quantitative' },
  },
  valueFormat: '$,.1f',
  chrome: {
    title: 'Engineering Absorbs the Largest Share of Every Revenue Stream',
    subtitle: 'FY 2024 revenue allocation by department, $M',
    source: budgetFlow.source,
    byline: 'Chart: OpenChart',
  },
  animation: true,
};

// ---------------------------------------------------------------------------
// 3. User journey — a conversion funnel
// ---------------------------------------------------------------------------

const userJourneySpec: SankeySpec = {
  type: 'sankey',
  data: [...userJourney.data],
  encoding: {
    source: { field: 'source', type: 'nominal' },
    target: { field: 'target', type: 'nominal' },
    value: { field: 'value', type: 'quantitative' },
  },
  valueFormat: ',.0f',
  chrome: {
    title: '10,000 Visitors In, 720 Paying Users Out',
    subtitle: 'Monthly cohort from landing page through conversion',
    source: userJourney.source,
    byline: 'Chart: OpenChart',
  },
  animation: true,
};

// ---------------------------------------------------------------------------
// 4. Link coloring + node alignment — the layout knobs
// ---------------------------------------------------------------------------

const linkStyleSpec: SankeySpec = {
  type: 'sankey',
  data: [...energyFlow.data],
  encoding: {
    source: { field: 'source', type: 'nominal' },
    target: { field: 'target', type: 'nominal' },
    value: { field: 'value', type: 'quantitative' },
    color: { field: 'source', type: 'nominal' },
  },
  linkStyle: 'source',
  nodeAlign: 'left',
  valueFormat: '.1f',
  chrome: {
    title: 'Same Flow, Tinted by Its Source',
    subtitle:
      "linkStyle: 'source' colors each ribbon by where it starts; nodeAlign: 'left' packs nodes to the left edge",
    source: energyFlow.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 5. Quantitative tilemap — US unemployment, sequential palette
// ---------------------------------------------------------------------------

const unemploymentSpec: TileMapSpec = {
  type: 'tilemap',
  data: { ...usStateUnemployment.data },
  palette: 'blue',
  valueFormat: '.1f',
  chrome: {
    title: 'Where the Job Market Is Tightest',
    subtitle: 'State unemployment rate, seasonally adjusted, %',
    source: usStateUnemployment.source,
    byline: 'Chart: OpenChart',
  },
  animation: true,
};

// ---------------------------------------------------------------------------
// 6. Categorical tilemap — custom color per category
// ---------------------------------------------------------------------------

const categoricalSpec: TileMapSpec = {
  type: 'tilemap',
  data: { ...vaccineExemptions.data },
  colors: {
    medical_only: '#ee4a73',
    religious: '#e07d00',
    philosophical: '#06b6d4',
  },
  chrome: {
    title: 'Most States Allow a Non-Medical Vaccine Exemption',
    subtitle: 'Broadest exemption type each state permits',
    source: vaccineExemptions.source,
    byline: 'Chart: OpenChart',
  },
  animation: true,
};

// ---------------------------------------------------------------------------
// 7. Partial data — graceful missing-state handling
// ---------------------------------------------------------------------------

// Ten states carry a value; the rest render as empty tiles rather than gaps.
const PARTIAL_STATES = ['CA', 'TX', 'NY', 'FL', 'IL', 'WA', 'MA', 'GA', 'OH', 'MI'] as const;
const partialData: Record<string, number> = Object.fromEntries(
  PARTIAL_STATES.map((code) => [code, usStateUnemployment.data[code]]),
);

const partialSpec: TileMapSpec = {
  type: 'tilemap',
  data: partialData,
  palette: 'purple',
  valueFormat: '.1f',
  chrome: {
    title: 'The Ten Largest States, the Rest Left Blank',
    subtitle: 'Only states with data are colored; missing states keep their place on the grid',
    source: usStateUnemployment.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 8. Palette variants — one dataset across the five sequential scales
// ---------------------------------------------------------------------------

const PALETTES = ['blue', 'green', 'orange', 'purple', 'teal'] as const;

const paletteSpecs: TileMapSpec[] = PALETTES.map((palette) => ({
  type: 'tilemap',
  data: { ...usStateUnemployment.data },
  palette,
  valueFormat: '.1f',
  chrome: {
    title: palette.charAt(0).toUpperCase() + palette.slice(1),
    source: usStateUnemployment.source,
  },
}));

function PaletteGrid() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 'var(--oc-space-4)',
      }}
    >
      {paletteSpecs.map((spec) => (
        <div key={spec.palette} style={{ minWidth: 0 }}>
          <TileMap spec={spec} />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 9. Interactive — click a state for a live readout
// ---------------------------------------------------------------------------

const interactiveSpec: TileMapSpec = {
  type: 'tilemap',
  data: { ...usStateUnemployment.data },
  palette: 'teal',
  valueFormat: '.1f',
  chrome: {
    title: 'Click a State to Read Its Rate',
    subtitle: 'onTileClick drives a live readout below the grid',
    source: usStateUnemployment.source,
  },
};

function InteractiveTileMap() {
  const [selected, setSelected] = useState<{
    stateCode: string;
    stateName: string;
    value: number | null;
  } | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-3)' }}>
      <div style={{ height: 560 }}>
        <TileMap
          spec={interactiveSpec}
          onTileClick={(tile) =>
            setSelected({
              stateCode: tile.stateCode,
              stateName: tile.stateName,
              value: tile.value,
            })
          }
        />
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--oc-space-3)',
          padding: 'var(--oc-space-3) var(--oc-space-4)',
          border: '1px solid var(--oc-border)',
          borderRadius: 'var(--oc-radius-control)',
          background: 'var(--oc-surface-raised)',
          fontSize: 'var(--oc-type-caption)',
          color: 'var(--oc-text-muted)',
          fontFamily:
            'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
        }}
      >
        <span style={{ color: 'var(--oc-text-muted)' }}>last click</span>
        {selected ? (
          <span style={{ color: 'var(--oc-text)' }}>
            {selected.stateName} ({selected.stateCode}) —{' '}
            {selected.value === null ? 'no data' : `${selected.value}%`}
          </span>
        ) : (
          <span>none yet</span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default { title: 'Sankey & Tile Maps' };

export const SankeyAndTileMaps = () => (
  <GalleryPage
    title="Sankey & Tile Maps"
    lede="Two specialty viz types for structure the chart primitives can't carry. Sankey diagrams trace how quantities flow from sources to sinks. Tile maps drop every US state onto a fixed grid so a state is always where you expect it, no matter its geographic size."
  >
    <Section
      id="sankey"
      title="Sankey"
      lede="Flows from source to sink: energy through the grid, revenue through departments, visitors through a funnel. Ribbon width is proportional to value."
    >
      <Demo
        id="energy-flow"
        title="Energy flow"
        description="A three-column flow — primary source, carrier, end-use sector — where every ribbon's width is the quantity moving through it."
        spec={energyFlowSpec}
        height={460}
      />
      <Demo
        id="budget-allocation"
        title="Budget allocation"
        description="Revenue streams on the left fan out to spending departments on the right; the value format carries a currency prefix."
        spec={budgetSpec}
        height={440}
      />
      <Demo
        id="user-journey"
        title="User journey"
        description="A staged funnel reads left to right, with drop-off branches peeling away at each step so the leak is as visible as the conversion."
        spec={userJourneySpec}
        height={440}
      />
      <Demo
        id="link-coloring"
        title="Link coloring & node alignment"
        description="linkStyle picks how ribbons are tinted (gradient, source, target, or neutral) and nodeAlign controls how columns pack — here source coloring with left alignment."
        spec={linkStyleSpec}
        height={460}
      />
    </Section>

    <Section
      id="tile-maps"
      title="Tile maps"
      lede="Every state gets one equal-sized tile in a roughly geographic grid. Small states stay readable, big states stop dominating, and the eye can compare values instead of areas."
    >
      <Demo
        id="quantitative"
        title="Quantitative (sequential palette)"
        description="Numeric values map to a sequential color ramp. A record of state code to number is all the spec needs; the legend and scale are inferred."
        spec={unemploymentSpec}
        height={560}
      />
      <Demo
        id="categorical"
        title="Categorical (custom colors)"
        description="String categories switch the map into categorical mode; a colors map assigns one hue per category and drives a discrete legend."
        spec={categoricalSpec}
        height={560}
      />
      <Demo
        id="partial-data"
        title="Partial data"
        description="When only some states have values, the rest keep their grid position as empty tiles instead of collapsing — the map's shape never changes."
        spec={partialSpec}
        height={560}
      />
      <Demo
        id="palettes"
        title="Palette variants"
        description="The five built-in sequential palettes — blue, green, orange, purple, teal — on one dataset. Pick the one that fits your publication's accent."
        height={720}
      >
        <PaletteGrid />
      </Demo>
      <Demo
        id="interactive"
        title="Interactive (click to read)"
        description="onTileClick reports the clicked state's code, name, and value; the escape hatch renders a stateful React component while the spec panel still shows the base spec."
        specForPanel={interactiveSpec}
        height={640}
      >
        <InteractiveTileMap />
      </Demo>
    </Section>
  </GalleryPage>
);
