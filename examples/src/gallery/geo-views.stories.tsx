import type { GeoMapSpec } from '@opendata-ai/openchart-core';
import { useVizDarkMode, useVizTheme } from '@opendata-ai/openchart-react';
import {
  createGeoMap,
  createGeoReader,
  type GeoMapInstance,
  type GeoReaderController,
} from '@opendata-ai/openchart-vanilla';
import { geoArea } from 'd3-geo';
import type { FeatureCollection, Geometry } from 'geojson';
import { useEffect, useRef, useState } from 'react';
import usCounties from 'us-atlas/counties-10m.json';
import usStates from 'us-atlas/states-10m.json';
import tractSource from '../../../packages/engine/src/geo/__tests__/fixtures/travis-tracts-2020.geojson?raw';

export default { title: 'Gallery / Geographic views' };

// Census GeoJSON follows RFC 7946 winding; D3 spherical paths use its reverse.
const tracts = JSON.parse(tractSource) as FeatureCollection;
for (const feature of tracts.features) {
  if (geoArea(feature) <= Math.PI * 2) continue;
  const geometry = feature.geometry as Geometry;
  if (geometry.type === 'Polygon')
    geometry.coordinates = geometry.coordinates.map((ring) => [...ring].reverse());
  else if (geometry.type === 'MultiPolygon')
    geometry.coordinates = geometry.coordinates.map((polygon) =>
      polygon.map((ring) => [...ring].reverse()),
    );
}
const texasTopology = {
  ...usCounties,
  objects: {
    counties: {
      ...usCounties.objects.counties,
      geometries: usCounties.objects.counties.geometries.filter((feature) =>
        String(feature.id).startsWith('48'),
      ),
    },
  },
};
const texasDetailSpec: GeoMapSpec = {
  type: 'map',
  animation: false,
  geo: {
    features: texasTopology,
    objectKey: 'counties',
    fitObjectKey: 'counties',
    projection: 'albersUsa',
    zoom: true,
    detailLayers: [{ id: 'travis-tracts', features: tracts, minZoom: 4 }],
  },
  data: [],
  encoding: {},
  points: {
    data: [
      { id: 'austin', name: 'Austin', longitude: -97.7431, latitude: 30.2672 },
      { id: 'mcallen', name: 'McAllen', longitude: -98.23, latitude: 26.2034 },
      { id: 'brownsville', name: 'Brownsville', longitude: -97.4975, latitude: 25.9017 },
      { id: 'san-antonio', name: 'San Antonio', longitude: -98.4936, latitude: 29.4241 },
    ],
    key: { field: 'id', type: 'nominal' },
    longitude: { field: 'longitude', type: 'quantitative' },
    latitude: { field: 'latitude', type: 'quantitative' },
    text: { field: 'name', type: 'nominal' },
    tooltip: [{ field: 'name', type: 'nominal', title: 'City' }],
  },
  chrome: {
    title: 'Texas context, Austin detail',
    subtitle: 'County boundaries stay fixed. Travis County census tracts appear at 4× zoom.',
    source:
      'US Atlas counties; Census Bureau TIGERweb Census2020 tracts, simplified 0.002°. City coordinates are illustrative.',
  },
};
const usInsetSpec: GeoMapSpec = {
  type: 'map',
  animation: false,
  geo: {
    features: usStates,
    objectKey: 'states',
    projection: 'albersUsa',
    zoom: true,
    insets: [
      {
        id: 'alaska',
        label: 'Alaska',
        featureIds: ['02'],
        pointIds: ['anchorage'],
        placement: 'bottom-left',
        width: 140,
      },
      {
        id: 'hawaii',
        label: 'Hawaii',
        featureIds: ['15'],
        pointIds: ['honolulu'],
        placement: 'bottom-right',
        width: 140,
      },
    ],
  },
  data: [],
  encoding: {},
  points: {
    data: [
      { id: 'anchorage', name: 'Anchorage', longitude: -149.9003, latitude: 61.2181 },
      { id: 'honolulu', name: 'Honolulu', longitude: -157.8583, latitude: 21.3069 },
    ],
    key: { field: 'id', type: 'nominal' },
    longitude: { field: 'longitude', type: 'quantitative' },
    latitude: { field: 'latitude', type: 'quantitative' },
    text: { field: 'name', type: 'nominal' },
  },
  chrome: {
    title: 'Separate views, shared places',
    subtitle:
      'Alaska and Hawaii have independent scales and cameras. Their features move explicitly out of the main view.',
    source: 'US Atlas state boundaries. City coordinates are illustrative.',
  },
};

function ViewMap({
  spec,
  testId,
  reader = false,
  largeText = false,
}: {
  spec: GeoMapSpec;
  testId: string;
  reader?: boolean;
  largeText?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [largerCaptions, setLargerCaptions] = useState(largeText);
  const instanceRef = useRef<GeoMapInstance | null>(null);
  const readerRef = useRef<GeoReaderController | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const detailEnabled = useRef(true);
  const theme = useVizTheme(),
    darkMode = useVizDarkMode();
  useEffect(() => {
    const node = host.current!;
    const snapshot = () => {
      const instance = instanceRef.current;
      if (!instance) return;
      node.dataset.cameras = JSON.stringify(instance.getCameras());
      node.dataset.points = JSON.stringify(
        instance.layout.pointMarks.map(({ key, cx, cy, r }) => ({ key, cx, cy, r })),
      );
      node.dataset.views = JSON.stringify(
        instance.layout.views?.map((view) => ({
          id: view.viewId,
          features: view.features.map((feature) => feature.id),
          points: view.pointMarks.map((point) => point.key),
        })) ?? [],
      );
    };
    const instance = createGeoMap(node, spec, {
      theme: largerCaptions
        ? { ...theme, fonts: { ...theme?.fonts, sizes: { ...theme?.fonts?.sizes, small: 24 } } }
        : theme,
      darkMode,
      onCameraChange: snapshot,
      onMarkHover: (event) => {
        node.dataset.markEvent = JSON.stringify(event);
      },
    });
    instanceRef.current = instance;
    if (reader)
      readerRef.current = createGeoReader(
        node,
        instance,
        spec,
        (selection) => {
          node.dataset.reader = JSON.stringify(selection);
        },
        { panel: { container: panelRef.current! } },
      );
    snapshot();
    const exportSVG = () => {
      node.dataset.export = String(instance.export('svg'));
    };
    const camera = (event: Event) => {
      const detail = (
        event as CustomEvent<{ viewId?: string; camera: ReturnType<GeoMapInstance['getCamera']> }>
      ).detail;
      instance.setCamera(detail.camera, { viewId: detail.viewId });
      snapshot();
    };
    const rejectPlane = () => {
      try {
        instance.update({
          ...spec,
          geo: {
            ...spec.geo,
            projection: 'identity',
            sourcePlane: 'primary-plane',
            detailLayers: [
              {
                id: 'invalid-plane',
                features: texasTopology,
                minZoom: 2,
                sourcePlane: 'other-plane',
              },
            ],
          },
        });
      } catch (error) {
        node.dataset.validationError = String(error);
      }
      snapshot();
    };
    const rejectScope = (event: Event) => {
      const scope = (event as CustomEvent<'view' | 'layer'>).detail;
      delete node.dataset.scopeError;
      try {
        instance.update({
          ...spec,
          callouts: [
            {
              id: 'invalid-scope',
              text: 'Invalid scope',
              anchor: {
                kind: 'feature',
                id: '48453',
                ...(scope === 'view' ? { viewId: 'missing-view' } : { layerId: 'missing-layer' }),
              },
            },
          ],
        });
      } catch (error) {
        node.dataset.scopeError = String(error);
      }
      snapshot();
    };
    node.addEventListener('fixture-invalid-scope', rejectScope);
    node.addEventListener('fixture-export', exportSVG);
    node.addEventListener('fixture-camera', camera);
    node.addEventListener('fixture-invalid-plane', rejectPlane);
    return () => {
      node.removeEventListener('fixture-invalid-scope', rejectScope);
      node.removeEventListener('fixture-export', exportSVG);
      node.removeEventListener('fixture-camera', camera);
      node.removeEventListener('fixture-invalid-plane', rejectPlane);
      readerRef.current?.destroy();
      readerRef.current = null;
      instance.destroy();
      instanceRef.current = null;
    };
  }, [spec, theme, darkMode, reader, largerCaptions]);
  return (
    <section style={{ marginBottom: 32, paddingTop: 48 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {reader && (
          <button
            type="button"
            onClick={() => readerRef.current?.pin({ kind: 'feature', id: '02', canonicalId: '02' })}
          >
            Pin Alaska
          </button>
        )}
        {spec.geo.detailLayers && (
          <>
            <button
              type="button"
              onClick={() => instanceRef.current?.zoomTo('48453', { duration: 0 })}
            >
              Austin detail
            </button>
            <button
              type="button"
              onClick={() => {
                detailEnabled.current = !detailEnabled.current;
                instanceRef.current?.update({
                  ...spec,
                  geo: {
                    ...spec.geo,
                    detailLayers: detailEnabled.current ? spec.geo.detailLayers : [],
                  },
                });
                const instance = instanceRef.current;
                if (instance)
                  host.current!.dataset.points = JSON.stringify(
                    instance.layout.pointMarks.map(({ key, cx, cy, r }) => ({ key, cx, cy, r })),
                  );
              }}
            >
              Toggle tract context
            </button>
          </>
        )}
        {spec.geo.insets && (
          <>
            <button type="button" onClick={() => setLargerCaptions((value) => !value)}>
              {largerCaptions ? 'Default caption text' : 'Enlarge caption text'}
            </button>
            <button
              type="button"
              onClick={() =>
                instanceRef.current?.zoomTo('02', { viewId: 'alaska', duration: 0, padding: 8 })
              }
            >
              Alaska view
            </button>
            <button
              type="button"
              onClick={() =>
                instanceRef.current?.zoomTo('15', { viewId: 'hawaii', duration: 0, padding: 8 })
              }
            >
              Hawaii view
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => instanceRef.current?.resetView({ viewId: 'root', duration: 0 })}
        >
          Reset main view
        </button>
      </div>
      <div ref={host} data-testid={testId} style={{ width: '100%', height: 680 }} />
      {reader && <div ref={panelRef} data-testid="geo-view-reader-panel" />}
    </section>
  );
}
export function TexasAndAustin() {
  return <ViewMap spec={texasDetailSpec} testId="geo-texas-views" />;
}
export function SeparateScales() {
  return <ViewMap spec={usInsetSpec} testId="geo-inset-views" />;
}
export function TwoMaps() {
  return (
    <>
      <ViewMap spec={usInsetSpec} testId="geo-inset-first" />
      <ViewMap spec={usInsetSpec} testId="geo-inset-second" />
    </>
  );
}

const duplicatedPlaceSpec: GeoMapSpec = {
  ...usInsetSpec,
  geo: {
    ...usInsetSpec.geo,
    insets: usInsetSpec.geo.insets!.map((inset) => ({ ...inset, removeFromMain: false })),
  },
  chrome: {
    ...usInsetSpec.chrome,
    subtitle:
      'The same Alaska observation appears in the main map and a separate-scale inset. Pin it once to highlight both.',
  },
};
export function DuplicatedPlace() {
  return <ViewMap spec={duplicatedPlaceSpec} testId="geo-duplicate-view" reader />;
}
