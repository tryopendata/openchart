import states from 'us-atlas/states-10m.json';
import { expect, it, vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { createGeoMap } from '../map-mount';
import { createGeoReader } from '../map-reader';

it('keeps clipped territories searchable and pinnable while Show explains unavailable geometry without moving camera', () => {
  const spec = {
    type: 'map' as const,
    geo: { features: states, projection: 'albersUsa' as const },
    data: [{ id: '06', rate: 42 }],
    encoding: {
      key: { field: 'id', type: 'nominal' as const },
      color: { field: 'rate', type: 'quantitative' as const },
    },
    animation: false as const,
  };
  const host = createContainer(),
    panel = document.createElement('div'),
    list = document.createElement('div');
  document.body.append(panel, list);
  const map = createGeoMap(host, spec, { autoResize: false });
  const reader = createGeoReader(host, map, spec, () => {}, {
    panel: { container: panel },
    companion: { container: list, pageSize: 100 },
  });
  expect(list.textContent).toContain('56 places available');
  const puertoRico = [...list.querySelectorAll('button')].find(
    (button) => button.textContent === 'Puerto Rico: No data',
  )!;
  puertoRico.click();
  expect(reader.selection.pinned[0].entity.id).toBe('72');
  const camera = map.getCamera(),
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  list.querySelector<HTMLButtonElement>('[aria-label="Show Puerto Rico on map"]')!.click();
  expect(reader.selection.announcement).toMatch(/not visible.*projection/i);
  expect(panel.textContent).toMatch(/compatible projection or inset/i);
  expect(map.getCamera()).toEqual(camera);
  expect(warn).not.toHaveBeenCalled();
  warn.mockRestore();
  reader.destroy();
  map.destroy();
  host.remove();
  panel.remove();
  list.remove();
});
