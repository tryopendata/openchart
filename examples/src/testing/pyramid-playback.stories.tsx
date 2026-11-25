/**
 * Testing / Pyramid playback: Japan's mirrored population pyramid with encoding.time,
 * 1950 to 2100, mounted through createChart so e2e specs can drive window.__chart.playback.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { useVizDarkMode, useVizTheme } from '@opendata-ai/openchart-react';
import { type ChartInstance, createChart } from '@opendata-ai/openchart-vanilla';
import { useEffect, useRef } from 'react';
import { JAPAN_AGE_GROUPS, japanPopulation } from '../data';

export default { title: 'Testing / Pyramid playback' };

declare global {
  interface Window {
    __chart?: ChartInstance;
  }
}

const japanPyramid: ChartSpec = {
  mark: { type: 'bar', mirror: true },
  data: japanPopulation.data,
  encoding: {
    y: { field: 'age', type: 'ordinal', sort: JAPAN_AGE_GROUPS },
    x: { field: 'pop', type: 'quantitative', format: '.2~s' },
    color: { field: 'sex', type: 'nominal', sort: ['Male', 'Female'] },
    time: { field: 'year', type: 'temporal' },
  },
  playback: { duration: 15000 },
  chrome: {
    title: "Japan's population ages: the base narrows as the bulge moves up",
    subtitle: 'Population by age and sex, 1950 to 2100; 2025 onward projected',
    source: 'Source: UN World Population Prospects 2024',
  },
};

const paused: ChartSpec = {
  ...japanPyramid,
  playback: { ...japanPyramid.playback, autoplay: false },
};

/** Period index of 2025 in the five-yearly run from 1950. */
const YEAR_2025 = 15;

function PyramidPlaybackStory({ spec, t }: { spec: ChartSpec; t?: number }) {
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
      style={{ width: '100%', maxWidth: 800, height: 600 }}
    />
  );
}

export const Japan = () => <PyramidPlaybackStory spec={japanPyramid} />;
export const Japan2025 = () => <PyramidPlaybackStory spec={paused} t={YEAR_2025} />;
