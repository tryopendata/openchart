/**
 * Maps — geographic choropleths on TopoJSON geometries.
 *
 * US states (pre-projected Albers), US counties, and world countries under
 * different projections. The interactive demo wires onMarkHover into a live
 * readout panel.
 */

import type { MapSpec } from '@opendata-ai/openchart-core';
import { GeoMap } from '@opendata-ai/openchart-react';
import { useState } from 'react';
// @ts-expect-error -- JSON import, no type declarations for us-atlas
import usCountiesTopo from 'us-atlas/counties-albers-10m.json';
// @ts-expect-error -- JSON import, no type declarations for us-atlas
import usStatesTopo from 'us-atlas/states-albers-10m.json';
// @ts-expect-error -- JSON import, no type declarations for world-atlas
import worldTopo from 'world-atlas/countries-110m.json';
import { Demo, GalleryPage, Section } from '../components';
import { usUnemployment, worldGdp } from '../data';

// ---------------------------------------------------------------------------
// 1. US state unemployment — pre-projected Albers
// ---------------------------------------------------------------------------

const usStateSpec: MapSpec = {
  type: 'map',
  geo: { features: usStatesTopo, projection: 'identity' },
  data: [...usUnemployment.data],
  encoding: {
    key: { field: 'id', type: 'nominal' },
    color: { field: 'rate', type: 'quantitative' },
  },
  valueFormat: '.1f',
  chrome: {
    title: 'Where the Job Market Is Tightest',
    subtitle: 'State unemployment rate, seasonally adjusted, %',
    source: usUnemployment.source,
    byline: 'Chart: OpenChart',
  },
  animation: true,
};

// ---------------------------------------------------------------------------
// 2. US counties — pre-projected Albers (no data, topology only)
// ---------------------------------------------------------------------------

const usCountySpec: MapSpec = {
  type: 'map',
  geo: { features: usCountiesTopo, projection: 'identity' },
  data: [],
  encoding: {
    key: { field: 'id', type: 'nominal' },
    color: { field: 'rate', type: 'quantitative' },
  },
  chrome: {
    title: 'County-Level Detail From the Same Pipeline',
    subtitle: '~3,200 features rendered from counties-albers-10m.json',
    byline: 'Chart: OpenChart',
  },
  animation: true,
};

// ---------------------------------------------------------------------------
// 3. World equal-earth — GDP per capita
// ---------------------------------------------------------------------------

const worldEqualEarthSpec: MapSpec = {
  type: 'map',
  geo: { features: worldTopo, projection: 'equalEarth' },
  data: [...worldGdp.data],
  encoding: {
    key: { field: 'id', type: 'nominal' },
    color: { field: 'gdp', type: 'quantitative' },
  },
  valueFormat: '$,.0f',
  chrome: {
    title: 'The World in Dollars Per Person',
    subtitle: 'GDP per capita, current US$, 2023',
    source: worldGdp.source,
    byline: 'Chart: OpenChart',
  },
  animation: true,
};

// ---------------------------------------------------------------------------
// 4. World mercator — same data, different projection
// ---------------------------------------------------------------------------

const worldMercatorSpec: MapSpec = {
  type: 'map',
  geo: { features: worldTopo, projection: 'mercator' },
  data: [...worldGdp.data],
  encoding: {
    key: { field: 'id', type: 'nominal' },
    color: { field: 'gdp', type: 'quantitative' },
  },
  valueFormat: '$,.0f',
  chrome: {
    title: 'Same Data, Mercator Projection',
    subtitle: 'Greenland looks enormous, but carries no data here',
    source: worldGdp.source,
    byline: 'Chart: OpenChart',
  },
  animation: true,
};

// ---------------------------------------------------------------------------
// 5. Interactive choropleth — hover readout
// ---------------------------------------------------------------------------

const interactiveSpec: MapSpec = {
  type: 'map',
  geo: { features: usStatesTopo, projection: 'identity' },
  data: [...usUnemployment.data],
  encoding: {
    key: { field: 'id', type: 'nominal' },
    color: { field: 'rate', type: 'quantitative' },
  },
  valueFormat: '.1f',
  chrome: {
    title: 'Hover a State to Read Its Rate',
    subtitle: 'onMarkHover drives the live readout below the map',
    source: usUnemployment.source,
  },
};

function InteractiveMap() {
  const [hovered, setHovered] = useState<{
    id: string | number;
    name?: string;
    data: Record<string, unknown> | null;
  } | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-3)' }}>
      <div style={{ height: 500 }}>
        <GeoMap spec={interactiveSpec} onMarkHover={(feature) => setHovered(feature)} />
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
        <span style={{ color: 'var(--oc-text-muted)' }}>hovered</span>
        {hovered ? (
          <span style={{ color: 'var(--oc-text)' }}>
            {hovered.name ?? hovered.id}
            {hovered.data?.rate != null ? ` — ${hovered.data.rate}%` : ''}
          </span>
        ) : (
          <span>none</span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default { title: 'Maps' };

export const Maps = () => (
  <GalleryPage
    title="Maps"
    lede="Geographic choropleths built on standard TopoJSON geometries. Swap the topology and projection to move between US states, counties, and world maps. The encoding channels work exactly like other chart types: map a key field to join data rows to geo features, then encode color by a quantitative or nominal field."
  >
    <Section
      id="us-choropleth"
      title="US choropleth"
      lede="Pre-projected Albers geometries from us-atlas. The projection: 'identity' setting tells the renderer the coordinates are already in pixel space."
    >
      <Demo
        id="us-state-unemployment"
        title="US state unemployment"
        description="State FIPS codes join the data to states-albers-10m.json features. A sequential color ramp encodes unemployment rate."
        spec={usStateSpec}
        height={500}
      />
      <Demo
        id="us-counties"
        title="US counties"
        description="Same pipeline, higher-resolution TopoJSON. counties-albers-10m.json has ~3,200 features; the renderer handles the density."
        spec={usCountySpec}
        height={500}
      />
    </Section>

    <Section
      id="world-maps"
      title="World maps"
      lede="Unprojected world geometries from world-atlas rendered through d3-geo projections. The projection choice reshapes the map without touching the data or encoding."
    >
      <Demo
        id="world-equal-earth"
        title="World equal-earth"
        description="Equal Earth preserves area, so country sizes are visually honest. ISO numeric codes in the data join to countries-110m.json features."
        spec={worldEqualEarthSpec}
        height={400}
      />
      <Demo
        id="world-mercator"
        title="World mercator"
        description="Mercator inflates polar regions but preserves local angles. Same data, same encoding, different projection."
        spec={worldMercatorSpec}
        height={400}
      />
    </Section>

    <Section
      id="interaction"
      title="Interaction"
      lede="Wire onMarkHover or onMarkClick into your own UI. The callback receives the feature's id, resolved name, and the matched data row."
    >
      <Demo
        id="interactive-choropleth"
        title="Interactive choropleth"
        description="onMarkHover reports the hovered feature's id, name, and data. The escape hatch renders a stateful React component while the spec panel still shows the base spec."
        specForPanel={interactiveSpec}
        height={580}
      >
        <InteractiveMap />
      </Demo>
    </Section>
  </GalleryPage>
);
