/**
 * Testing / Pyramid: static mirrored bars (population pyramids) from the UN WPP fixture.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';
import { JAPAN_AGE_GROUPS, japanPopulation } from '../data';
import './testing.css';

export default { title: 'Testing / Pyramid' };

const japan2025: ChartSpec = {
  mark: { type: 'bar', mirror: true },
  data: japanPopulation.data.filter((row) => row.year === 2025),
  encoding: {
    y: { field: 'age', type: 'ordinal', sort: JAPAN_AGE_GROUPS },
    x: { field: 'pop', type: 'quantitative', format: '.2~s' },
    color: { field: 'sex', type: 'nominal', sort: ['Male', 'Female'] },
  },
  chrome: {
    title: 'Japan is getting older',
    subtitle: 'Population by age and sex, 2025',
    source: japanPopulation.source,
  },
};

export const Japan2025 = () => (
  <div className="tfix-chart tfix-h-600">
    <Chart spec={japan2025} />
  </div>
);

export const Japan2025Narrow = () => (
  <div className="tfix-chart tfix-h-600" style={{ maxWidth: 360 }}>
    <Chart spec={japan2025} />
  </div>
);
