/**
 * Testing / Map playback: a choropleth and a tile map with encoding.time, mounted through
 * createGeoMap and createTileMap so e2e specs can drive window.__chart.playback.
 */

import type { GeoMapSpec, TileMapSpec } from '@opendata-ai/openchart-core';
import { useVizDarkMode, useVizTheme } from '@opendata-ai/openchart-react';
import { createGeoMap, createTileMap } from '@opendata-ai/openchart-vanilla';
import { useEffect, useRef } from 'react';
import usStatesTopo from 'us-atlas/states-albers-10m.json';
import { insuredUnemployment2020 } from '../data/insured-unemployment-2020';

export default { title: 'Testing / Map playback' };

const RATE = {
  field: 'rate',
  type: 'quantitative',
  title: 'Insured unemployment rate (%)',
  format: '.1f',
} as const;
const WEEK = { field: 'week', type: 'temporal' } as const;
const PLAYBACK = { duration: 20000, period: { format: '%b %Y' } };

const choropleth: GeoMapSpec = {
  type: 'map',
  geo: { features: usStatesTopo, projection: 'identity', idField: 'name' },
  data: insuredUnemployment2020.data,
  encoding: {
    key: { field: 'state', type: 'nominal' },
    color: RATE,
    time: WEEK,
  },
  playback: PLAYBACK,
  chrome: {
    title: 'Unemployment claims rose tenfold by July 2020, then eased',
    subtitle: 'Insured unemployment rate by state, 13-week average, weekly through 2020',
    source: insuredUnemployment2020.source,
  },
} as GeoMapSpec;

const tileMap: TileMapSpec = {
  type: 'tilemap',
  data: insuredUnemployment2020.data,
  encoding: {
    state: { field: 'code', type: 'nominal' },
    value: RATE,
    time: WEEK,
  },
  playback: PLAYBACK,
  chrome: {
    title: 'Every state ended 2020 with more workers on unemployment than it started with',
    subtitle: 'Insured unemployment rate by state, 13-week average, weekly through 2020',
    source: insuredUnemployment2020.source,
  },
} as TileMapSpec;

/** The pandemic peak (week ending July 4), paused for screenshots. */
const PEAK_WEEK = 26;

const paused = <S extends GeoMapSpec | TileMapSpec>(spec: S): S => ({
  ...spec,
  playback: { ...PLAYBACK, autoplay: false },
});

type Mounted = ReturnType<typeof createGeoMap> | ReturnType<typeof createTileMap>;

function MapPlaybackStory({ spec, t }: { spec: GeoMapSpec | TileMapSpec; t?: number }) {
  const host = useRef<HTMLDivElement>(null);
  const theme = useVizTheme();
  const darkMode = useVizDarkMode();
  useEffect(() => {
    if (!host.current) return;
    const options = { darkMode, theme };
    const map: Mounted =
      spec.type === 'tilemap'
        ? createTileMap(host.current, spec, options)
        : createGeoMap(host.current, spec as GeoMapSpec, options);
    if (t !== undefined) map.playback?.seek(t);
    // Shared with the chart playback stories, which declare it as a ChartInstance.
    const testWindow = window as unknown as { __chart?: Mounted };
    testWindow.__chart = map;
    return () => {
      map.destroy();
      testWindow.__chart = undefined;
    };
  }, [spec, darkMode, theme, t]);

  return (
    <div
      ref={host}
      className="oc-root"
      data-testid="map-playback-host"
      style={{ width: '100%', maxWidth: 800, height: 600 }}
    />
  );
}

export const Choropleth = () => <MapPlaybackStory spec={choropleth} />;
export const TileMap = () => <MapPlaybackStory spec={tileMap} />;
export const ChoroplethPeak = () => <MapPlaybackStory spec={paused(choropleth)} t={PEAK_WEEK} />;
export const TileMapPeak = () => <MapPlaybackStory spec={paused(tileMap)} t={PEAK_WEEK} />;
