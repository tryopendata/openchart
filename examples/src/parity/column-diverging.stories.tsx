/**
 * Parity test: Diverging column chart with annotations.
 *
 * Columns extend above/below zero baseline, color-coded by direction.
 * Demonstrates positive/negative value handling, computed color fields,
 * and editorial annotations with connectors.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';

// ---------------------------------------------------------------------------
// Global Temperature Anomaly: Diverging columns by decade
// ---------------------------------------------------------------------------

const tempSpec: ChartSpec = {
  type: 'column',
  data: [
    { year: '1900', anomaly: -0.08, trend: 'Cooler' },
    { year: '1910', anomaly: -0.42, trend: 'Cooler' },
    { year: '1920', anomaly: -0.27, trend: 'Cooler' },
    { year: '1930', anomaly: -0.14, trend: 'Cooler' },
    { year: '1940', anomaly: 0.1, trend: 'Warmer' },
    { year: '1950', anomaly: -0.16, trend: 'Cooler' },
    { year: '1960', anomaly: 0.03, trend: 'Warmer' },
    { year: '1970', anomaly: 0.01, trend: 'Warmer' },
    { year: '1980', anomaly: 0.26, trend: 'Warmer' },
    { year: '1990', anomaly: 0.45, trend: 'Warmer' },
    { year: '2000', anomaly: 0.61, trend: 'Warmer' },
    { year: '2010', anomaly: 0.72, trend: 'Warmer' },
    { year: '2020', anomaly: 1.02, trend: 'Warmer' },
  ],
  encoding: {
    x: { field: 'year', type: 'ordinal' },
    y: {
      field: 'anomaly',
      type: 'quantitative',
      axis: { label: 'Temperature anomaly (°C)' },
    },
    color: { field: 'trend', type: 'nominal' },
  },
  labels: { density: 'none' },
  annotations: [
    {
      type: 'text',
      x: '1910',
      y: -0.42,
      text: 'Coldest decade on record\nat 0.42°C below average',
      connector: true,
      anchor: 'top',
      offset: { dx: 0, dy: -150 },
    },
    {
      type: 'text',
      x: '2020',
      y: 1.02,
      text: 'By 2020, temperatures\nwere 1°C above baseline',
      connector: true,
      anchor: 'left',
      offset: { dx: -180, dy: 20 },
    },
    {
      type: 'refline',
      y: 0,
      style: 'solid',
      strokeWidth: 1,
    },
  ],
  chrome: {
    title: 'Since 1980, every half-decade has been warmer than average',
    subtitle: 'Global surface temperature anomaly relative to 20th century average, °C',
    source: 'Source: NOAA National Centers for Environmental Information',
  },
};

export const TemperatureAnomaly = () => (
  <div style={{ width: 750, height: 450 }}>
    <Chart spec={tempSpec} />
  </div>
);

export const TemperatureAnomalyCompact = () => (
  <div style={{ width: 360, height: 380 }}>
    <Chart spec={tempSpec} />
  </div>
);

export const TemperatureAnomalyWide = () => (
  <div style={{ width: 1200, height: 500 }}>
    <Chart spec={tempSpec} />
  </div>
);

export const TemperatureAnomalyDarkMode = () => (
  <div style={{ width: 750, height: 450 }}>
    <Chart spec={tempSpec} darkMode="force" />
  </div>
);
