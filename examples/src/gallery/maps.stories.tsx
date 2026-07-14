/**
 * Maps — geographic choropleths on TopoJSON geometries.
 *
 * US states (pre-projected Albers), US counties, and world countries under
 * different projections. The interactive demo wires onMarkHover into a live
 * readout panel.
 */

import type { MapSpec } from '@opendata-ai/openchart-core';
import type { MapHandle } from '@opendata-ai/openchart-react';
import { ChartStory, GeoMap } from '@opendata-ai/openchart-react';
import { useRef, useState } from 'react';
import usCountiesTopo from 'us-atlas/counties-albers-10m.json';
import usStatesTopo from 'us-atlas/states-albers-10m.json';
import worldTopo from 'world-atlas/countries-110m.json';
import { Demo, GalleryPage, Section, useOcMode } from '../components';
import { usUnemployment, usUnemploymentPrior, worldGdp } from '../data';

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
// Shared button style
// ---------------------------------------------------------------------------

const btnStyle: React.CSSProperties = {
  padding: 'var(--oc-space-2) var(--oc-space-4)',
  borderRadius: 'var(--oc-radius-control)',
  border: '1px solid var(--oc-border)',
  background: 'var(--oc-surface-raised)',
  color: 'var(--oc-text)',
  cursor: 'pointer',
  fontSize: 'var(--oc-type-caption)',
  fontFamily: 'inherit',
};

// ---------------------------------------------------------------------------
// 6. Entrance animation — replay via key bump
// ---------------------------------------------------------------------------

function EntranceAnimationDemo() {
  const [key, setKey] = useState(0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-3)' }}>
      <div style={{ height: 500 }}>
        <GeoMap key={key} spec={usStateSpec} />
      </div>
      <button type="button" onClick={() => setKey((k) => k + 1)} style={btnStyle}>
        Replay entrance
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 7. Data-update recolor — toggle between datasets
// ---------------------------------------------------------------------------

function RecolorDemo() {
  const [usePrior, setUsePrior] = useState(false);
  const spec: MapSpec = {
    ...usStateSpec,
    data: usePrior ? [...usUnemploymentPrior] : [...usUnemployment.data],
    chrome: {
      ...usStateSpec.chrome,
      subtitle: usePrior ? 'Previous period data' : 'Current period data',
    },
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-3)' }}>
      <div style={{ height: 500 }}>
        <GeoMap spec={spec} />
      </div>
      <button type="button" onClick={() => setUsePrior((v) => !v)} style={btnStyle}>
        {usePrior ? 'Show current data' : 'Show previous data'}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 8. Zoom to feature — imperative camera API
// ---------------------------------------------------------------------------

function ZoomDemo() {
  const mapRef = useRef<MapHandle>(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-3)' }}>
      <div style={{ height: 500 }}>
        <GeoMap ref={mapRef} spec={{ ...usStateSpec, animation: false }} />
      </div>
      <div style={{ display: 'flex', gap: 'var(--oc-space-2)', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => mapRef.current?.instance?.zoomTo('06')}
          style={btnStyle}
        >
          Zoom to California
        </button>
        <button
          type="button"
          onClick={() => mapRef.current?.instance?.zoomTo('48')}
          style={btnStyle}
        >
          Zoom to Texas
        </button>
        <button
          type="button"
          onClick={() => mapRef.current?.instance?.resetView()}
          style={btnStyle}
        >
          Reset
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 9. Map scrollytelling — ChartStory with geo.focus
// ---------------------------------------------------------------------------

const NARRATIVE_CSS = `
.ocs-map-step h3 {
  font-family: var(--oc-font-body, system-ui, -apple-system, sans-serif);
  font-size: 1.375rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--oc-text-strong, #0f172a);
  margin: 0 0 0.5rem;
}
.ocs-map-step p {
  font-family: var(--oc-font-body, system-ui, -apple-system, sans-serif);
  font-size: 1rem;
  line-height: 1.65;
  color: var(--oc-text-muted, #64748b);
  margin: 0;
  max-width: 34rem;
}
`;

const mapStoryBase: MapSpec = {
  type: 'map',
  geo: { features: usStatesTopo, projection: 'identity' },
  data: [...usUnemployment.data],
  encoding: {
    key: { field: 'id', type: 'nominal' },
    color: { field: 'rate', type: 'quantitative' },
  },
  chrome: {
    title: 'A Guided Tour of US Unemployment',
    subtitle: 'Scroll to explore regional patterns',
    source: usUnemployment.source,
  },
  animation: true,
};

const mapSteps = [
  { spec: {} },
  { spec: { geo: { focus: '06' }, chrome: { subtitle: 'California: 5.3% unemployment' } } },
  { spec: { geo: { focus: '48' }, chrome: { subtitle: 'Texas: 4.3% unemployment' } } },
  {
    spec: {
      geo: { focus: ['36', '34', '09', '25'] },
      chrome: { subtitle: 'Northeast corridor' },
    },
  },
  { spec: { geo: { focus: null }, chrome: { subtitle: 'Back to the full picture' } } },
];

const mapNarrative = [
  <div className="ocs-map-step" key="0">
    <h3>The national picture</h3>
    <p>
      State unemployment rates range from around 2% to nearly 6%, with the coasts generally running
      hotter than the interior. Scroll to zoom into individual states.
    </p>
  </div>,
  <div className="ocs-map-step" key="1">
    <h3>California</h3>
    <p>
      At 5.3%, California sits above the national average. High housing costs and a services-heavy
      economy contribute to persistent slack in the labor market.
    </p>
  </div>,
  <div className="ocs-map-step" key="2">
    <h3>Texas</h3>
    <p>
      Texas comes in at 4.3%, benefiting from a diversified economy spanning energy, tech, and
      manufacturing. Lower cost of living keeps workforce participation high.
    </p>
  </div>,
  <div className="ocs-map-step" key="3">
    <h3>The Northeast corridor</h3>
    <p>
      New York, New Jersey, Connecticut, and Massachusetts cluster between 4.4% and 4.9%. Dense
      labor markets and higher wages mask pockets of structural unemployment.
    </p>
  </div>,
  <div className="ocs-map-step" key="4">
    <h3>The full map</h3>
    <p>
      Zooming back out, the pattern is clear: low unemployment in the plains and mountain states,
      higher rates along the coasts and in the industrial Midwest.
    </p>
  </div>,
];

function MapScrollyDemo() {
  const mode = useOcMode();
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static CSS constant, no user input */}
      <style dangerouslySetInnerHTML={{ __html: NARRATIVE_CSS }} />
      <ChartStory
        spec={mapStoryBase}
        steps={mapSteps}
        narrative={mapNarrative}
        mountOptions={{ darkMode: mode === 'dark' ? 'force' : 'off' }}
      />
      <div style={{ height: '60vh' }} />
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
        height={600}
      />
      <Demo
        id="world-mercator"
        title="World mercator"
        description="Mercator inflates polar regions but preserves local angles. Same data, same encoding, different projection."
        spec={worldMercatorSpec}
        height={600}
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

    <Section
      id="entrance-animation"
      title="Entrance animation"
      lede="Features fade in with a staggered entrance. Hit the button to remount the map and replay the animation."
    >
      <Demo
        id="entrance-animation"
        title="Entrance animation"
        description="Remounting the GeoMap via a React key bump replays the CSS entrance animation. Each feature fades in with a stagger delay."
        specForPanel={usStateSpec}
        height={580}
      >
        <EntranceAnimationDemo />
      </Demo>
    </Section>

    <Section
      id="data-update-recolor"
      title="Data-update recolor"
      lede="Swap the underlying data and the fill colors tween smoothly to the new values. No remount, no flash."
    >
      <Demo
        id="data-update-recolor"
        title="Data-update recolor"
        description="Toggling between two datasets triggers a fill tween on every feature. The map instance stays mounted and calls update() with the new spec."
        specForPanel={usStateSpec}
        height={580}
      >
        <RecolorDemo />
      </Demo>
    </Section>

    <Section
      id="zoom-to-feature"
      title="Zoom to feature"
      lede="The imperative camera API lets you programmatically zoom, pan, and reset the map viewport."
    >
      <Demo
        id="zoom-to-feature"
        title="Zoom to feature"
        description="useRef<MapHandle> exposes the MapInstance with zoomTo, panTo, and resetView methods. Animation is disabled so the camera is the only motion."
        specForPanel={usStateSpec}
        height={580}
      >
        <ZoomDemo />
      </Demo>
    </Section>

    <Section
      id="map-scrollytelling"
      title="Map scrollytelling"
      lede="ChartStory drives a map through a sequence of geo.focus patches as the reader scrolls. Each step zooms to a feature or region while the narrative text describes what the reader is looking at."
    >
      <MapScrollyDemo />
    </Section>
  </GalleryPage>
);
