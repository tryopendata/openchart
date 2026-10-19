import type { GeoReaderIndex, GeoReaderRecord } from '@opendata-ai/openchart-engine';
import { expect, it, vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { geoLabelSpec } from '../__test-fixtures__/geo-label-spec';
import { createMapCompanion } from '../map-companion';
import { createGeoMap } from '../map-mount';
import { createGeoReaderBinding } from '../reader-binding';

it('keeps the last pointer preview when its companion row moves away and retains focus and pin actions', () => {
  const record = {
    name: 'California',
    valueLabel: '42',
    valueStatus: 'value',
    unit: '%',
    fields: [],
    observation: {
      observation: 'feature:06',
      entity: { kind: 'feature', id: '06', canonicalId: '06' },
      persistent: true,
      datum: {},
      state: 'visible',
    },
  } as unknown as GeoReaderRecord;
  const container = document.createElement('div');
  document.body.append(container);
  const actions = { preview: vi.fn(), pin: vi.fn(), show: vi.fn() };
  const companion = createMapCompanion(actions);
  companion.setOptions({ container, search: false });
  companion.update({
    records: [record],
    byObservation: new Map([[record.observation.observation, record]]),
  } as unknown as GeoReaderIndex);
  const button = container.querySelector('button')!;
  button.dispatchEvent(new MouseEvent('mouseenter'));
  button.dispatchEvent(new MouseEvent('mouseleave'));
  expect(actions.preview.mock.calls).toEqual([[record]]);
  button.focus();
  expect(actions.preview).toHaveBeenLastCalledWith(record);
  button.click();
  expect(actions.pin).toHaveBeenCalledExactlyOnceWith(record);
  companion.destroy();
  container.remove();
});

const record = (name: string) =>
  ({
    name,
    valueLabel: 'No data',
    valueStatus: 'no-data',
    fields: [],
    observation: {
      observation: `feature:${name}`,
      entity: { kind: 'feature', id: name, canonicalId: name },
      persistent: true,
      datum: null,
      state: 'visible',
    },
  }) as unknown as GeoReaderRecord;
const index = (names: string[]) =>
  ({ records: names.map(record), byObservation: new Map() }) as unknown as GeoReaderIndex;
it('shows the search label, pin instruction and useful empty-search status', () => {
  const container = document.createElement('div');
  document.body.append(container);
  const companion = createMapCompanion({ preview: vi.fn(), pin: vi.fn(), show: vi.fn() });
  companion.setOptions({ container });
  companion.update(index(['California']));
  expect(container.querySelector('label')?.textContent).toContain('Find a place');
  expect(container.textContent).toContain('pin');
  const search = container.querySelector('input')!;
  search.value = 'not a place';
  search.dispatchEvent(new Event('input'));
  expect(container.querySelector('[role="status"]')?.textContent).toBe(
    'No places match your search.',
  );
  expect(container.querySelector('ol')!.children).toHaveLength(0);
  companion.destroy();
  container.remove();
});
it('clamps the current page after replacement data shrinks instead of showing a false empty page', () => {
  const container = document.createElement('div');
  document.body.append(container);
  const companion = createMapCompanion({ preview: vi.fn(), pin: vi.fn(), show: vi.fn() });
  companion.setOptions({ container, pageSize: 1 });
  companion.update(index(['Alpha', 'Beta', 'Gamma']));
  const next = () =>
    [...container.querySelectorAll('button')].find((button) => button.textContent === 'Next')!;
  next().click();
  next().click();
  expect(container.querySelector('ol')!.textContent).toContain('Gamma');
  companion.update(index(['Alpha']));
  expect(container.querySelector('ol')!.textContent).toContain('Alpha');
  expect(next().disabled).toBe(true);
  companion.destroy();
  container.remove();
});
it('keeps page and focused record when controlled bindings resend equivalent options', () => {
  const container = document.createElement('div');
  document.body.append(container);
  const companion = createMapCompanion({ preview: vi.fn(), pin: vi.fn(), show: vi.fn() });
  const options = { container, pageSize: 1 };
  companion.setOptions(options);
  companion.update(index(['Alpha', 'Beta', 'Gamma']));
  [...container.querySelectorAll('button')]
    .find((button) => button.textContent === 'Next')!
    .click();
  const beta = container.querySelector('ol button') as HTMLButtonElement;
  beta.focus();
  companion.setOptions({ ...options });
  expect(container.querySelector('ol button')).toBe(beta);
  expect(document.activeElement).toBe(beta);
  expect(beta.textContent).toContain('Beta');
  companion.destroy();
  container.remove();
});
it('restores a surviving focused observation after a necessary index rerender', () => {
  const container = document.createElement('div');
  document.body.append(container);
  const companion = createMapCompanion({ preview: vi.fn(), pin: vi.fn(), show: vi.fn() });
  companion.setOptions({ container, pageSize: 1 });
  companion.update(index(['Alpha', 'Beta', 'Gamma']));
  [...container.querySelectorAll('button')]
    .find((button) => button.textContent === 'Next')!
    .click();
  (container.querySelector('ol button') as HTMLButtonElement).focus();
  companion.update(index(['Alpha', 'Beta']));
  expect(container.querySelector('ol button')!.textContent).toContain('Beta');
  expect(document.activeElement).toBe(container.querySelector('ol button'));
  companion.destroy();
  container.remove();
});

it('preserves companion page and focus through a controlled wrapper binding sync', () => {
  const host = createContainer(),
    list = document.createElement('div');
  document.body.append(list);
  const spec = {
    ...geoLabelSpec,
    points: {
      data: [{ id: 'point', x: 50, y: 50 }],
      key: { field: 'id', type: 'nominal' as const },
      longitude: { field: 'x', type: 'quantitative' as const },
      latitude: { field: 'y', type: 'quantitative' as const },
    },
  };
  const map = createGeoMap(host, spec, { autoResize: false }),
    binding = createGeoReaderBinding();
  const options = { companion: { container: list, pageSize: 1 } };
  binding.sync(host, map, spec, options, undefined, () => {});
  [...list.querySelectorAll('button')].find((button) => button.textContent === 'Next')!.click();
  const focused = list.querySelector('ol button') as HTMLButtonElement;
  focused.focus();
  const label = focused.textContent;
  binding.sync(
    host,
    map,
    spec,
    { ...options, companion: { ...options.companion } },
    undefined,
    () => {},
  );
  expect(list.querySelector('ol button')).toBe(focused);
  expect(document.activeElement).toBe(focused);
  expect(focused.textContent).toBe(label);
  binding.destroy();
  map.destroy();
  host.remove();
  list.remove();
});
