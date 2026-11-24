/**
 * Charts / Race.
 *
 * Five demos built from the same GDP data. Bar, line, and table races show
 * how the rankings change. The last two demos loop the top five and hold
 * the bar scale fixed across years.
 */

import type { RaceSpec } from '@opendata-ai/openchart-core';
import { Demo, GalleryPage, Section } from '../components';
import { worldGdpRace, worldGdpRaceSource } from '../data/world-gdp-race';

const subtitle = 'Annual GDP in current US dollars, 1980–2024';
const shortCountryNames = new Map([
  ['United States', 'US'],
  ['United Kingdom', 'UK'],
]);

const bar: RaceSpec = {
  type: 'race',
  mark: 'bar',
  height: 520,
  data: worldGdpRace.map((row) => ({
    ...row,
    gdp: row.gdp * 1e9,
    name: shortCountryNames.get(row.country) ?? row.country,
  })),
  encoding: {
    time: { field: 'year', type: 'quantitative' },
    key: { field: 'country', type: 'nominal' },
    value: { field: 'gdp', type: 'quantitative', format: '$.3~s' },
    label: { field: 'name', type: 'nominal' },
  },
  chrome: {
    title: 'The US Led the GDP Ranking From 1980 to 2024',
    subtitle,
    source: worldGdpRaceSource,
  },
};

const line: RaceSpec = {
  ...bar,
  mark: 'line',
  chrome: { ...bar.chrome, title: 'China Passed Japan in 2010' },
};

const table: RaceSpec = {
  ...bar,
  mark: 'table',
  chrome: { ...bar.chrome, title: 'Germany Overtook Japan in 2023' },
};

const loop: RaceSpec = {
  ...bar,
  race: { top: 5, loop: true },
  chrome: { ...bar.chrome, title: 'China Climbs Into the Top Five' },
};

const fixed: RaceSpec = {
  ...bar,
  race: { rescale: 'fixed' },
  chrome: { ...bar.chrome, title: 'US GDP Reached $28.8 Trillion in 2024' },
};

export default { title: 'Charts' };

export const Race = () => (
  <GalleryPage
    title="Race"
    lede="Use a race when changes in rank are the story and readers have time to watch them unfold. A static chart works better for a quick scan or a comparison between two moments."
  >
    <Section id="marks" title="Marks">
      <Demo id="bar" title="Bar race" spec={bar} height={bar.height} />
      <Demo id="line" title="Line race" spec={line} height={line.height} />
      <Demo id="table" title="Table race" spec={table} height={table.height} />
    </Section>
    <Section id="playback-and-scale" title="Playback and scale">
      <Demo
        id="looping-top-five"
        title="Looping top five"
        description="Playback restarts after a pause on 2024."
        spec={loop}
        height={loop.height}
      />
      <Demo
        id="fixed-scale"
        title="Fixed scale"
        description="One scale for the full race keeps bar lengths comparable across years."
        spec={fixed}
        height={fixed.height}
      />
    </Section>
  </GalleryPage>
);
