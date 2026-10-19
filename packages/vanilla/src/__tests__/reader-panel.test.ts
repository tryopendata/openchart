import { expect, it, vi } from 'vitest';
import { createReaderPanel } from '../reader-panel';

it('preserves focused controls and the live node while updating exact adapter text', () => {
  const host = document.createElement('div');
  document.body.append(host);
  const panel = createReaderPanel(host, { clear: vi.fn(), unpin: vi.fn() });
  const vm = {
    pinned: [
      {
        slot: 'A' as const,
        record: {
          id: 'a',
          name: '<A>',
          valueLabel: 'No data',
          state: 'visible' as const,
          fields: [],
        },
      },
    ],
    announcement: 'Pinned A',
  };
  panel.update(vm);
  const live = host.querySelector('[aria-live]');
  const clear = [...host.querySelectorAll('button')].find(
    (button) => button.textContent === 'Clear selection',
  )!;
  clear.focus();
  panel.update({ ...vm, announcement: 'Updated A' });
  expect(document.activeElement?.textContent).toBe('Clear selection');
  expect(host.querySelector('[aria-live]')).toBe(live);
  expect(live?.textContent).toBe('Updated A');
  expect(host.querySelector('h3')?.textContent).toBe('A: <A>');
  expect(host.querySelector('A')).toBeNull();
  panel.destroy();
  host.remove();
});
it('announces enabled readers without a panel host and moves the same live node to a host', () => {
  const fallback = document.createElement('div');
  const host = document.createElement('div');
  document.body.append(fallback, host);
  const panel = createReaderPanel(undefined, { clear: vi.fn(), unpin: vi.fn() }, fallback);
  panel.update({ pinned: [], announcement: 'Selection dismissed.' });
  const live = fallback.querySelector('[aria-live]');
  expect(live?.textContent).toBe('Selection dismissed.');
  panel.setContainer(host);
  expect(host.querySelector('[aria-live]')).toBe(live);
  expect(fallback.querySelector('[aria-live]')).toBeNull();
  panel.destroy();
  expect(host.querySelector('[aria-live]')).toBeNull();
  fallback.remove();
  host.remove();
});
