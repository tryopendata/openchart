/**
 * Testing / Playback: charts with encoding.time, mounted through createChart so
 * e2e specs can drive window.__chart.playback.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { useVizDarkMode, useVizTheme } from '@opendata-ai/openchart-react';
import { type ChartInstance, createChart } from '@opendata-ai/openchart-vanilla';
import { useEffect, useRef } from 'react';
import { wealthHealthHistory } from '../data';

export default { title: 'Testing / Playback' };

declare global {
  interface Window {
    __chart?: ChartInstance;
  }
}

const wealthAndHealth: ChartSpec = {
  mark: 'point',
  data: wealthHealthHistory.data,
  encoding: {
    x: {
      field: 'gdp',
      type: 'quantitative',
      scale: { type: 'log' },
      title: 'GDP per capita (current US$)',
    },
    y: { field: 'life', type: 'quantitative', title: 'Life expectancy' },
    size: { field: 'pop', type: 'quantitative', title: 'Population' },
    color: { field: 'region', type: 'nominal' },
    key: { field: 'country', type: 'nominal' },
    time: { field: 'year', type: 'temporal' },
  },
  playback: { duration: 20000, labels: ['China', 'India', 'United States'] },
  chrome: {
    title: 'China and India got healthier long before they got rich',
    subtitle: 'GDP per capita and life expectancy, 1960 to 2023',
    source: wealthHealthHistory.source,
  },
};

const withTrails: ChartSpec = {
  ...wealthAndHealth,
  playback: { ...wealthAndHealth.playback, trails: ['China', 'India'] },
};

const paused: ChartSpec = {
  ...wealthAndHealth,
  playback: { ...wealthAndHealth.playback, autoplay: false },
};

function PlaybackStory({ spec, t }: { spec: ChartSpec; t?: number }) {
  const host = useRef<HTMLDivElement>(null);
  const theme = useVizTheme();
  const darkMode = useVizDarkMode();
  useEffect(() => {
    if (!host.current) return;
    const chart = createChart(host.current, spec, { darkMode, theme });
    if (t !== undefined) chart.playback?.seek(t);
    window.__chart = chart;
    return () => {
      chart.destroy();
      window.__chart = undefined;
    };
  }, [spec, darkMode, theme, t]);

  return (
    <div
      ref={host}
      className="oc-root"
      data-testid="playback-host"
      style={{ width: '100%', maxWidth: 800, height: 560 }}
    />
  );
}

export const WealthAndHealth = () => <PlaybackStory spec={wealthAndHealth} />;
export const WealthAndHealthTrails = () => <PlaybackStory spec={withTrails} />;
export const WealthAndHealth1990 = () => <PlaybackStory spec={paused} t={30} />;
