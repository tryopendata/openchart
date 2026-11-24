import type { RaceSpec } from '@opendata-ai/openchart-core';
import { useVizDarkMode, useVizTheme } from '@opendata-ai/openchart-react';
import { createRace, type RaceInstance } from '@opendata-ai/openchart-vanilla';
import { useEffect, useRef } from 'react';
import { worldGdpRace, worldGdpRaceSource } from '../data/world-gdp-race';

export default { title: 'Testing / Race' };

declare global {
  interface Window {
    __race?: RaceInstance;
  }
}

const gdp: RaceSpec = {
  type: 'race',
  mark: 'bar',
  height: 520,
  data: worldGdpRace.map((row) => ({ ...row, gdp: row.gdp * 1e9 })),
  encoding: {
    time: { field: 'year', type: 'ordinal' },
    key: { field: 'country', type: 'nominal' },
    value: { field: 'gdp', type: 'quantitative', format: '$.3~s' },
  },
  chrome: { title: "The world's largest economies", source: worldGdpRaceSource },
};

const loop: RaceSpec = { ...gdp, race: { loop: true, top: 5 } };
const fixed: RaceSpec = { ...gdp, race: { rescale: 'fixed' } };
const noControls: RaceSpec = { ...gdp, race: { controls: false, autoplay: true } };

function RaceStory({
  spec,
  dark,
  belowFold,
}: {
  spec: RaceSpec;
  dark?: boolean;
  belowFold?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const theme = useVizTheme();
  const ladleDark = useVizDarkMode();
  const darkMode = dark ? 'force' : ladleDark;
  useEffect(() => {
    if (!host.current) return;
    const race = createRace(host.current, spec, { darkMode, theme });
    window.__race = race;
    return () => {
      race.destroy();
      window.__race = undefined;
    };
  }, [spec, darkMode, theme]);

  return (
    <>
      <div aria-hidden="true" style={{ height: belowFold ? '100vh' : 56 }} />
      <div
        ref={host}
        className="oc-root"
        data-testid="race-host"
        style={{ width: '100%', maxWidth: 800, background: dark ? '#18181b' : undefined }}
      />
    </>
  );
}

export const Bar = () => <RaceStory spec={gdp} belowFold />;
export const Loop = () => <RaceStory spec={loop} />;
export const FixedScale = () => <RaceStory spec={fixed} />;
export const NoControls = () => <RaceStory spec={noControls} />;
export const Dark = () => <RaceStory spec={gdp} dark />;
