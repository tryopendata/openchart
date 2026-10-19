import type { ChartSpec, ReaderObservation } from '@opendata-ai/openchart-core';
import { expect, it } from 'vitest';
import { observationPanelModel } from '../reader-view-model';

const observation = (id: string, datum: Record<string, unknown>): ReaderObservation =>
  ({ observation: id, datum, persistent: true, state: 'visible' }) as ReaderObservation;
it.each([
  false,
  true,
])('uses inferred numeric value semantics for omitted channel types (horizontal=%s)', (horizontal) => {
  const spec: ChartSpec = {
    mark: 'bar',
    data: [
      { name: 'Alpha', value: 42 },
      { name: 'Beta', value: 50 },
    ],
    encoding: horizontal
      ? { x: { field: 'value' }, y: { field: 'name' } }
      : { x: { field: 'name' }, y: { field: 'value' } },
    fields: { value: { unit: 'USD', measure: 'revenue', representation: 'number' } },
  };
  const model = observationPanelModel(
    {
      preview: null,
      pinned: spec.data.map((datum, i) => observation(String(i), datum)),
      announcement: '',
    },
    spec,
    { comparison: 'absolute' },
  );
  expect(model.pinned.map((item) => item.record.name)).toEqual(['Alpha', 'Beta']);
  expect(model.pinned.map((item) => item.record.valueLabel)).toEqual(['42', '50']);
  expect(model.pinned[0].record.unit).toBe('USD');
  expect(model.comparisons?.[0].absolute).toBe(8);
});
