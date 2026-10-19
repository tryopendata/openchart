import type { GeoMapSpec } from '@opendata-ai/openchart-core';
import { useVizDarkMode, useVizTheme } from '@opendata-ai/openchart-react';
import { createGeoMap, type GeoMapInstance } from '@opendata-ai/openchart-vanilla';
import { useEffect, useRef } from 'react';
import usStates from 'us-atlas/states-10m.json';

export default { title: 'Gallery / Geographic labels' };

const labelSpec: GeoMapSpec = {
  type: 'map',
  animation: false,
  geo: { features: usStates, projection: 'albersUsa', zoom: true },
  data: [
    { id: '06', place: 'California coast', value: 39, priority: 8 },
    { id: '48', place: 'Texas triangle', value: 31, priority: 10 },
    { id: '36', place: 'New York', value: 20, priority: 7 },
    { id: '53', place: 'Pacific Northwest', value: 8, priority: 6 },
  ],
  encoding: {
    key: { field: 'id', type: 'nominal' },
    color: { field: 'value', type: 'quantitative', title: 'Population (millions)' },
    text: { field: 'place', type: 'nominal' },
    textPriority: { field: 'priority', type: 'quantitative' },
  },
  points: {
    data: [
      { id: 'austin', name: 'Austin', lon: -97.7431, lat: 30.2672, value: 2.5 },
      { id: 'houston', name: 'Houston', lon: -95.3698, lat: 29.7604, value: 7.5 },
    ],
    longitude: { field: 'lon', type: 'quantitative' },
    latitude: { field: 'lat', type: 'quantitative' },
    key: { field: 'id', type: 'nominal' },
    text: { field: 'name', type: 'nominal' },
    size: { field: 'value', type: 'quantitative', title: 'Metro population' },
  },
  callouts: [
    {
      id: 'texas-growth',
      anchor: { kind: 'feature', id: '48' },
      text: 'The Texas triangle',
      subtitle: 'An authored explanation stays available when its label cannot fit.',
      priority: 10,
      maxWidth: 200,
    },
    {
      id: 'coordinate-place',
      anchor: { kind: 'coordinate', space: 'geographic', x: -104.99, y: 39.74 },
      text: 'A place without a data row',
      maxWidth: 160,
    },
    {
      id: 'austin-detail',
      anchor: { kind: 'point', id: 'austin' },
      text: 'Austin detail at a closer zoom',
      minZoom: 3,
      maxWidth: 180,
    },
  ],
  chrome: {
    title: 'Places stay attached as the view changes',
    subtitle: 'Explicit place names and authored callouts; values are illustrative.',
    source: 'Geometry: US Census Bureau. Illustrative observations.',
  },
};

function LabelMap({
  secondary = false,
  largeText = false,
}: {
  secondary?: boolean;
  largeText?: boolean;
}) {
  const theme = useVizTheme();
  const darkMode = useVizDarkMode();
  const hostRef = useRef<HTMLDivElement>(null);
  const inventoryRef = useRef<HTMLDivElement>(null);
  const alternateRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<GeoMapInstance | null>(null);
  useEffect(() => {
    const host = hostRef.current!;
    const instance = createGeoMap(host, labelSpec, {
      labelInventory: secondary ? false : { container: inventoryRef.current! },
      darkMode,
      theme: largeText
        ? {
            ...theme,
            fonts: { ...theme?.fonts, sizes: { title: 52, subtitle: 28, body: 26, small: 24 } },
          }
        : theme,
      onCameraChange: (camera) => {
        host.dataset.camera = JSON.stringify(camera);
      },
    });
    instanceRef.current = instance;
    host.dataset.camera = JSON.stringify(instance.getCamera());
    const exportSVG = () => {
      host.dataset.export = String(instance.export('svg'));
    };
    const setCamera = (event: Event) => {
      instance.setCamera((event as CustomEvent<ReturnType<GeoMapInstance['getCamera']>>).detail);
    };
    // Rejection is an automated fixture, not a public gallery action.
    const rejectInvalidUpdate = () => {
      try {
        instance.update({
          ...labelSpec,
          callouts: [labelSpec.callouts![0], labelSpec.callouts![0]],
        });
      } catch (error) {
        host.dataset.validationError = String(error);
      }
    };
    host.addEventListener('fixture-invalid-update', rejectInvalidUpdate);
    host.addEventListener('fixture-export', exportSVG);
    host.addEventListener('fixture-camera', setCamera);
    return () => {
      host.removeEventListener('fixture-invalid-update', rejectInvalidUpdate);
      host.removeEventListener('fixture-export', exportSVG);
      host.removeEventListener('fixture-camera', setCamera);
      instance.destroy();
      instanceRef.current = null;
    };
  }, [secondary, largeText, theme, darkMode]);

  return (
    <section aria-label={secondary ? 'Second map' : 'Interactive labeled map'}>
      {!secondary && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          <button type="button" onClick={() => instanceRef.current?.zoomTo('48', { duration: 0 })}>
            Show Texas
          </button>
          <button type="button" onClick={() => instanceRef.current?.resetView({ duration: 0 })}>
            Full map
          </button>
          <button
            type="button"
            onClick={() =>
              instanceRef.current?.update({
                ...labelSpec,
                data: labelSpec.data.map((row) =>
                  row.id === '48' ? { ...row, place: 'Texas updated' } : row,
                ),
              })
            }
          >
            Update a place name
          </button>
          <button
            type="button"
            onClick={() =>
              instanceRef.current?.setLabelInventory({ container: alternateRef.current! })
            }
          >
            Move place list
          </button>
        </div>
      )}
      <div
        ref={hostRef}
        data-testid={secondary ? 'geo-label-second' : 'geo-label-host'}
        style={{ width: '100%', height: largeText ? 1000 : 700 }}
      />
      <div ref={inventoryRef} data-testid="geo-label-disclosure" />
      <div ref={alternateRef} data-testid="geo-label-alternate" />
    </section>
  );
}

export const PlacesAndNotes = () => (
  <main style={{ padding: '56px 16px 24px', maxWidth: 1440, margin: '0 auto' }}>
    <LabelMap />
  </main>
);

export const LargeText = () => (
  <main style={{ padding: '56px 16px 24px', maxWidth: 1440, margin: '0 auto' }}>
    <LabelMap largeText />
  </main>
);

export const MultipleMaps = () => (
  <main style={{ padding: '56px 16px 24px', maxWidth: 1440, margin: '0 auto' }}>
    <LabelMap />
    <LabelMap secondary />
  </main>
);

const islandTopology = {
  type: 'Topology',
  objects: {
    places: {
      type: 'GeometryCollection',
      geometries: [
        { type: 'Polygon', id: 'ring', properties: { place: 'Around the lake' }, arcs: [[0], [1]] },
        {
          type: 'MultiPolygon',
          id: 'islands',
          properties: { place: 'Island group' },
          arcs: [[[2]], [[3]]],
        },
        { type: 'Polygon', id: 'coast', properties: { place: 'The sheltered coast' }, arcs: [[4]] },
      ],
    },
  },
  arcs: [
    [
      [0, 0],
      [0, 100],
      [100, 100],
      [100, 0],
      [0, 0],
    ],
    [
      [30, 30],
      [70, 30],
      [70, 70],
      [30, 70],
      [30, 30],
    ],
    [
      [120, 0],
      [120, 100],
      [220, 100],
      [220, 0],
      [120, 0],
    ],
    [
      [260, 10],
      [260, 50],
      [300, 50],
      [300, 10],
      [260, 10],
    ],
    [
      [0, 130],
      [100, 130],
      [100, 230],
      [65, 230],
      [65, 165],
      [35, 165],
      [35, 230],
      [0, 230],
      [0, 130],
    ],
  ],
};

export const IslandsAndHoles = () => {
  const theme = useVizTheme();
  const darkMode = useVizDarkMode();
  const hostRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<GeoMapInstance | null>(null);
  useEffect(() => {
    const instance = createGeoMap(
      hostRef.current!,
      {
        type: 'map',
        animation: false,
        geo: { features: islandTopology, projection: 'identity', zoom: true },
        data: [{ id: 'ring', value: 10 }],
        encoding: {
          key: { field: 'id', type: 'nominal' },
          color: { field: 'value', type: 'quantitative' },
          text: { field: 'place', type: 'nominal' },
        },
        callouts: [
          {
            id: 'unresolved',
            anchor: { kind: 'feature', id: 'not-in-this-map' },
            text: 'A place outside this supplied geography',
          },
          {
            id: 'source-place',
            anchor: { kind: 'coordinate', space: 'source', x: 145, y: 75 },
            text: 'An authored position',
            maxWidth: 130,
          },
        ],
        chrome: {
          title: 'Labels find the visible land',
          subtitle:
            'Schematic islands, a lake and a concave coast. Names remain accessible when hidden.',
        },
      },
      { theme, darkMode, labelInventory: { container: listRef.current! } },
    );
    instanceRef.current = instance;
    return () => {
      instance.destroy();
      instanceRef.current = null;
    };
  }, [theme, darkMode]);
  const showSmallIsland = () => {
    const instance = instanceRef.current;
    const components = instance?.layout.labels?.geometries.find(
      (g) => g.featureId === 'islands',
    )?.components;
    if (!instance || !components?.length) return;
    const component = [...components].sort(
      (a, b) => Math.min(...b.exterior.map((p) => p.x)) - Math.min(...a.exterior.map((p) => p.x)),
    )[0];
    const x = Math.min(...component.exterior.map((p) => p.x));
    const y = Math.min(...component.exterior.map((p) => p.y));
    const width = Math.max(...component.exterior.map((p) => p.x)) - x;
    const height = Math.max(...component.exterior.map((p) => p.y)) - y;
    instance.fitBounds({ x, y, width, height, padding: 12 }, { duration: 0 });
  };
  return (
    <main style={{ padding: '56px 16px 24px', maxWidth: 1440, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button type="button" onClick={showSmallIsland}>
          Show the small island
        </button>
        <button type="button" onClick={() => instanceRef.current?.resetView({ duration: 0 })}>
          All islands
        </button>
      </div>
      <div ref={hostRef} data-testid="geo-geometry-host" style={{ height: 600 }} />
      <div ref={listRef} />
    </main>
  );
};
