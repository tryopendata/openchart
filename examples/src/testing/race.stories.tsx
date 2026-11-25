import type { RaceMarkType, RaceSpec } from '@opendata-ai/openchart-core';
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
const playbackBlock: RaceSpec = {
  ...gdp,
  race: { top: 5 },
  playback: { duration: 12000, loop: true },
};
const fixed: RaceSpec = { ...gdp, race: { rescale: 'fixed' } };
const noControls: RaceSpec = { ...gdp, race: { controls: false, autoplay: true } };
const barStill: RaceSpec = { ...gdp, race: { autoplay: false } };
const lineStill: RaceSpec = { ...barStill, mark: 'line' };
const tableStill: RaceSpec = { ...barStill, mark: 'table' };
const tableLargeText: RaceSpec = {
  ...tableStill,
  theme: { fonts: { sizes: { axisTick: 14, body: 14 } } },
};
const fixedStill: RaceSpec = { ...fixed, race: { ...fixed.race, autoplay: false } };
// All ten ranks are settled in 2002, so the mid-race captures have no crossing rows.
const mid = 22;
const last = new Set(worldGdpRace.map(({ year }) => year)).size - 1;
const marks: { value: RaceMarkType; label: string }[] = [
  { value: 'bar', label: 'Bar' },
  { value: 'line', label: 'Line' },
  { value: 'table', label: 'Table' },
];

function RaceStory({
  spec,
  dark,
  belowFold,
  t,
  switchMarks,
}: {
  spec: RaceSpec;
  dark?: boolean;
  belowFold?: boolean;
  t?: number;
  switchMarks?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const instance = useRef<RaceInstance | null>(null);
  const selectedMark = useRef<RaceMarkType>('bar');
  const theme = useVizTheme();
  const ladleDark = useVizDarkMode();
  const darkMode = dark ? 'force' : ladleDark;
  useEffect(() => {
    if (!host.current) return;
    const race = createRace(
      host.current,
      switchMarks ? { ...spec, mark: selectedMark.current } : spec,
      { darkMode, theme },
    );
    if (t !== undefined) race.seek(t);
    instance.current = race;
    window.__race = race;
    return () => {
      race.destroy();
      instance.current = null;
      window.__race = undefined;
    };
  }, [spec, darkMode, theme, t, switchMarks]);

  return (
    <>
      <div aria-hidden="true" style={{ height: belowFold ? '100vh' : 56 }} />
      {switchMarks && (
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            margin: '0 20px 12px',
            font: '14px system-ui',
          }}
        >
          Mark
          <select
            defaultValue={selectedMark.current}
            onChange={(event) => {
              const mark = marks.find(({ value }) => value === event.currentTarget.value)?.value;
              if (!mark) return;
              instance.current?.update({ ...spec, mark });
              selectedMark.current = mark;
            }}
            style={{ colorScheme: darkMode === 'force' ? 'dark' : 'light' }}
          >
            {marks.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      )}
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
export const PlaybackBlock = () => <RaceStory spec={playbackBlock} />;
export const FixedScale = () => <RaceStory spec={fixed} />;
export const NoControls = () => <RaceStory spec={noControls} />;
export const Dark = () => <RaceStory spec={gdp} dark />;
export const Marks = () => <RaceStory spec={gdp} switchMarks />;

export const BarStart = () => <RaceStory spec={barStill} t={0} />;
export const BarMid = () => <RaceStory spec={barStill} t={mid} />;
export const BarEnd = () => <RaceStory spec={barStill} t={last} />;
export const LineStart = () => <RaceStory spec={lineStill} t={0} />;
export const LineMid = () => <RaceStory spec={lineStill} t={mid} />;
export const LineEnd = () => <RaceStory spec={lineStill} t={last} />;
export const TableStart = () => <RaceStory spec={tableStill} t={0} />;
export const TableMid = () => <RaceStory spec={tableStill} t={mid} />;
export const TableEnd = () => <RaceStory spec={tableStill} t={last} />;
export const TableEndLargeText = () => <RaceStory spec={tableLargeText} t={last} />;
export const BarMidDark = () => <RaceStory spec={barStill} t={mid} dark />;
export const FixedScaleMid = () => <RaceStory spec={fixedStill} t={mid} />;
