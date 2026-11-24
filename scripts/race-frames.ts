import type { RaceSpec } from '@opendata-ai/openchart-core';
import { worldGdpRace, worldGdpRaceSource } from '../examples/src/data/world-gdp-race';
import { raceGeometryAt } from '../packages/engine/src/race/geometry';
import { layoutRace } from '../packages/engine/src/race/layout';
import { buildRaceMatrix } from '../packages/engine/src/race/matrix';
import { formatPeriodLabels } from '../packages/engine/src/race/period-labels';
import { prepareRace } from '../packages/engine/src/race/prepare';
import { createRaceTimeline } from '../packages/engine/src/race/timeline';

const spec = {
  type: 'race',
  mark: 'bar',
  data: worldGdpRace,
  encoding: {
    time: { field: 'year', type: 'temporal' },
    key: { field: 'country' },
    value: { field: 'gdp', type: 'quantitative' },
  },
  race: { top: 5 },
  chrome: { source: worldGdpRaceSource },
} satisfies RaceSpec;

if (process.argv.includes('--geometry')) {
  const markFlag = process.argv.indexOf('--mark');
  const mark = markFlag >= 0 && process.argv[markFlag + 1] === 'line' ? 'line' : spec.mark;
  const model = prepareRace({ ...spec, mark }, {});
  const layout = layoutRace(model, { width: 800, height: 500 });
  for (const t of [0, 8.5, model.timeline.periodCount - 1]) {
    console.log(JSON.stringify({ t, geometry: raceGeometryAt(model, layout, t) }, null, 2));
  }
} else {
  const matrix = buildRaceMatrix(spec.data, spec.encoding, 'interpolate', console.warn);
  const timeline = createRaceTimeline(matrix, {
    top: spec.race.top,
    swapPeriods: 400 / 700,
    samplesPerPeriod: 24,
    rescale: 'frame',
  });
  const periodLabels = formatPeriodLabels(matrix.periods, spec.encoding.time);
  for (const t of [0, 8.5, timeline.periodCount - 1]) {
    const { periodIndex, items } = timeline.sample(t);
    console.log(`${periodLabels[periodIndex]} (t = ${t})`);
    for (const item of items.slice(0, spec.race.top)) {
      console.log(`${matrix.labels[item.keyIndex]}: ${item.value}`);
    }
  }
}
