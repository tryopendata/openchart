import type { ChartSpec, GeoMapSpec } from '@opendata-ai/openchart-core';
import { useVizDarkMode, useVizTheme } from '@opendata-ai/openchart-react';
import {
  createChart,
  createGeoMap,
  createGeoReader,
  createReader,
} from '@opendata-ai/openchart-vanilla';
import { useEffect, useRef } from 'react';
import usStates from 'us-atlas/states-10m.json';

export default { title: 'Gallery / Reader comparison' };
const line: ChartSpec = {
  mark: 'line',
  animation: false,
  data: [
    { id: 'n2022', year: '2022', rate: 12, region: 'North' },
    { id: 'n2023', year: '2023', rate: 15, region: 'North' },
    { id: 'n2024', year: '2024', rate: 18, region: 'North' },
    { id: 's2022', year: '2022', rate: 8, region: 'South' },
    { id: 's2024', year: '2024', rate: 11, region: 'South' },
  ],
  encoding: {
    x: { field: 'year', type: 'ordinal', axis: { title: '' } },
    y: { field: 'rate', type: 'quantitative', title: 'Rate (%)' },
    color: { field: 'region', type: 'nominal' },
    key: { field: 'id', type: 'nominal' },
  },
  fields: { rate: { measure: 'participation', representation: 'percent', unit: '%' } },
  chrome: {
    title: 'Compare two years',
    subtitle: 'Select a date to pin it. Arrow keys inspect; Enter pins.',
    source: 'Illustrative observations. No South observation was recorded in 2023.',
  },
};
export function Dates() {
  const host = useRef<HTMLDivElement>(null),
    panel = useRef<HTMLDivElement>(null),
    alternate = useRef<HTMLDivElement>(null);
  const actions = useRef<{ reorder(): void; remove(): void; move(): void } | null>(null);
  const theme = useVizTheme(),
    darkMode = useVizDarkMode();
  useEffect(() => {
    let spec = line;
    const chart = createChart(host.current!, spec, { theme, darkMode });
    const options = {
      mode: 'slices' as const,
      panel: { container: panel.current! },
      comparison: 'absolute' as const,
    };
    const reader = createReader(
      host.current!,
      chart,
      spec,
      (selection, meta) => {
        host.current!.dataset.reader = JSON.stringify(selection);
        host.current!.dataset.reason = meta.reason;
      },
      options,
    );
    actions.current = {
      reorder() {
        spec = { ...spec, data: [...(line.data as Record<string, unknown>[])].reverse() };
        chart.update(spec);
      },
      remove() {
        spec = {
          ...spec,
          data: (line.data as Record<string, unknown>[]).filter((row) => row.year !== '2024'),
        };
        chart.update(spec);
      },
      move() {
        reader.setOptions({ ...options, panel: { container: alternate.current! } });
      },
    };
    return () => {
      actions.current = null;
      reader.destroy();
      chart.destroy();
    };
  }, [theme, darkMode]);
  return (
    <main style={{ padding: '56px 16px 16px' }}>
      <div data-reader-chart ref={host} style={{ height: 400 }} />
      <aside aria-label="Date comparison" ref={panel} />
      <div style={{ marginBlock: 16 }}>
        <button
          style={{
            padding: '8px 12px',
            border: '1px solid currentColor',
            borderRadius: 5,
            background: 'transparent',
            color: 'inherit',
            cursor: 'pointer',
            minHeight: 36,
          }}
          type="button"
          onClick={() => actions.current?.reorder()}
        >
          Reorder observations
        </button>{' '}
        <button
          style={{
            padding: '8px 12px',
            border: '1px solid currentColor',
            borderRadius: 5,
            background: 'transparent',
            color: 'inherit',
            cursor: 'pointer',
            minHeight: 36,
          }}
          type="button"
          onClick={() => actions.current?.remove()}
        >
          Remove 2024
        </button>{' '}
        <button
          style={{
            padding: '8px 12px',
            border: '1px solid currentColor',
            borderRadius: 5,
            background: 'transparent',
            color: 'inherit',
            cursor: 'pointer',
            minHeight: 36,
          }}
          type="button"
          onClick={() => actions.current?.move()}
        >
          Move comparison panel
        </button>
      </div>
      <aside aria-label="Alternate date comparison" ref={alternate} />
    </main>
  );
}
const map: GeoMapSpec = {
  type: 'map',
  animation: false,
  geo: { features: usStates, projection: 'albersUsa', zoom: true },
  data: [
    { id: '06', place: 'California', value: 42 },
    { id: '48', place: 'Texas', value: 31 },
    { id: '36', place: 'New York', value: 17 },
    { id: '53', place: 'Washington', value: 0 },
  ],
  encoding: {
    key: { field: 'id', type: 'nominal' },
    color: { field: 'value', type: 'quantitative', title: 'Participation (%)' },
    text: { field: 'place', type: 'nominal' },
  },
  fields: { value: { measure: 'participation', representation: 'percent', unit: '%' } },
  colorKey: { activeValue: true, distribution: true },
  chrome: {
    title: 'Compare two places',
    subtitle: 'Find and pin two states. Show on map is a separate action.',
    source: 'Illustrative observations; unjoined states have no data.',
  },
};
export function Places() {
  const host = useRef<HTMLDivElement>(null),
    panel = useRef<HTMLDivElement>(null),
    companion = useRef<HTMLDivElement>(null);
  const theme = useVizTheme(),
    darkMode = useVizDarkMode();
  useEffect(() => {
    const element = host.current!;
    const instance = createGeoMap(element, map, {
      theme,
      darkMode,
      onCameraChange(camera) {
        element.dataset.camera = JSON.stringify(camera);
      },
    });
    element.dataset.camera = JSON.stringify(instance.getCamera());
    const exportSVG = () => {
      element.dataset.export = String(instance.export('svg'));
    };
    element.addEventListener('fixture-export', exportSVG);
    const reader = createGeoReader(
      host.current!,
      instance,
      map,
      (selection, meta) => {
        host.current!.dataset.reader = JSON.stringify(selection);
        host.current!.dataset.reason = meta.reason;
      },
      {
        panel: { container: panel.current! },
        companion: { container: companion.current!, rank: 'descending', pageSize: 8 },
        comparison: 'absolute',
      },
    );
    return () => {
      element.removeEventListener('fixture-export', exportSVG);
      reader.destroy();
      instance.destroy();
    };
  }, [theme, darkMode]);
  return (
    <main style={{ padding: '56px 16px 16px' }}>
      <div data-reader-map ref={host} style={{ height: 720 }} />
      <aside aria-label="Place comparison" ref={panel} />
      <aside
        aria-label="Find and rank places"
        ref={companion}
        style={{ maxWidth: 700, marginTop: 24 }}
      />
    </main>
  );
}
