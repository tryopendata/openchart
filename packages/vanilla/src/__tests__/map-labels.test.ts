import { afterEach, expect, it, vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { geoLabelSpec } from '../__test-fixtures__/geo-label-spec';
import { createGeoMap } from '../map-mount';
import { renderStaticSVG } from '../static';

const cleanup: Array<() => void> = [];
afterEach(() => {
  for (const fn of cleanup.splice(0)) fn();
  vi.useRealTimers();
  document.body.innerHTML = '';
});
function mount() {
  const container = createContainer();
  const host = document.createElement('aside');
  document.body.append(host);
  const instance = createGeoMap(container, geoLabelSpec, {
    autoResize: false,
    labelInventory: { container: host },
  });
  cleanup.push(() => instance.destroy());
  return { container, host, instance };
}
it('exposes complete inventory by default and replaces disclosure hosts without refitting', () => {
  const { container, host, instance } = mount();
  expect(container.querySelector('.oc-map-label-inventory')?.textContent).toContain(
    'Authored coordinate text. Complete subtitle',
  );
  expect(host.textContent).toContain('Visible at another zoom level');
  const svg = container.querySelector('svg');
  const camera = instance.getCamera();
  const other = document.createElement('div');
  instance.setLabelInventory({ container: other });
  expect(host.querySelector('details')).toBeNull();
  expect(other.querySelector('details')).not.toBeNull();
  expect(container.querySelector('svg')).toBe(svg);
  expect(instance.getCamera()).toEqual(camera);
});
it('keeps map text constant size and exports final placement independently of camera history', () => {
  const { container, instance } = mount();
  const initial = instance.getCamera();
  const size = container.querySelector('[data-geo-label-id] text')?.getAttribute('font-size');
  instance.setCamera({ ...initial, k: 2 });
  expect(container.querySelector('[data-geo-label-id] text')?.getAttribute('font-size')).toBe(size);
  const first = instance.export('svg') as string;
  instance.setCamera(initial);
  instance.setCamera({ ...initial, k: 2 });
  const second = instance.export('svg') as string;
  const stripIds = (s: string) => s.replace(/oc-[\w-]+-\d+/g, 'ID');
  expect(stripIds(first)).toBe(stripIds(second));
  expect(second).toContain('Authored coordinate text');
  expect(second).toContain('data-geo-label-inventory');
});
it('preserves accessible association across update and a rejected compile', () => {
  const { container, instance } = mount();
  const id = container.querySelector('svg')?.getAttribute('aria-describedby');
  instance.update({ ...geoLabelSpec, data: [{ id: 'a', name: 'Replacement name', value: 6 }] });
  expect(container.querySelector('svg')?.getAttribute('aria-describedby')).toBe(id);
  expect(container.querySelector('.oc-map-label-inventory')?.textContent).toContain(
    'Replacement name',
  );
  const svg = container.querySelector('svg');
  expect(() =>
    instance.update({ ...geoLabelSpec, callouts: [{ ...geoLabelSpec.callouts![0], maxWidth: 0 }] }),
  ).toThrow();
  expect(container.querySelector('svg')).toBe(svg);
  expect(container.querySelector('.oc-map-label-inventory')?.textContent).toContain(
    'Replacement name',
  );
});
it('renders deterministic map SSR with full inventory and scoped local references', () => {
  const one = renderStaticSVG(geoLabelSpec, { idPrefix: 'first' });
  const two = renderStaticSVG(geoLabelSpec, { idPrefix: 'second' });
  expect(one).toBe(renderStaticSVG(geoLabelSpec, { idPrefix: 'first' }));
  expect(one).toContain('Authored coordinate text');
  expect(one).toContain('Complete subtitle');
  for (const [svg, prefix] of [
    [one, 'first'],
    [two, 'second'],
  ]) {
    const ids = new Set([...svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
    for (const match of svg.matchAll(/url\(#([^)]+)\)/g)) {
      expect(ids.has(match[1])).toBe(true);
      expect(match[1].startsWith(`${prefix}-`)).toBe(true);
    }
  }
  expect(() => renderStaticSVG(geoLabelSpec, { idPrefix: '<bad' })).toThrow('idPrefix');
  expect(renderStaticSVG(geoLabelSpec, { idPrefix: 'first' })).toBe(one);
});
it('cancels scheduled label reconciliation after destroy', () => {
  vi.useFakeTimers();
  const { container, host, instance } = mount();
  instance.setCamera({ ...instance.getCamera(), k: 2 });
  instance.destroy();
  vi.runAllTimers();
  expect(container.querySelector('.oc-map-labels')).toBeNull();
  expect(container.querySelector('.oc-map-label-inventory')).toBeNull();
  expect(host.querySelector('details')).toBeNull();
});
it('preserves accepted anchors and text boxes during a camera gesture until settle', async () => {
  const { compileGeoMap } = await import('@opendata-ai/openchart-engine');
  const { projectAcceptedGeoOverlay, mapLabelAffine } = await import('../map-labels');
  const layout = compileGeoMap(geoLabelSpec, { width: 600, height: 400 });
  const initial = { cx: layout.mapSize.width / 2, cy: layout.mapSize.height / 2, k: 1 };
  const before = layout.labels!.initialOverlay;
  expect(before.labels.length).toBeGreaterThan(0);
  const after = projectAcceptedGeoOverlay(
    before,
    mapLabelAffine(initial, layout),
    mapLabelAffine({ ...initial, k: 1.1 }, layout),
    layout,
  );
  for (const label of after.labels) {
    const original = before.labels.find((item) => item.id === label.id)!;
    expect(label.block).toBe(original.block);
    expect(label.bounds.width).toBe(original.bounds.width);
    expect(label.bounds.height).toBe(original.bounds.height);
  }
});
it('scales fallback marker numbers and circles with the theme in live and standalone rendering', () => {
  const spec = {
    ...geoLabelSpec,
    callouts: [
      {
        id: 'wide',
        anchor: { kind: 'coordinate' as const, space: 'source' as const, x: 50, y: 50 },
        text: 'Complete authored explanation '.repeat(6),
        maxWidth: 20,
      },
    ],
  };
  const render = (small: number) => {
    const root = createContainer();
    const instance = createGeoMap(root, spec, {
      autoResize: false,
      theme: { fonts: { sizes: { small } } },
    });
    cleanup.push(() => instance.destroy());
    return { root, svg: instance.export('svg') as string };
  };
  const normal = render(12),
    large = render(24);
  const normalCircle = normal.root.querySelector('.oc-map-labels [data-geo-note-id] circle')!,
    largeCircle = large.root.querySelector('.oc-map-labels [data-geo-note-id] circle')!;
  expect(normalCircle).not.toBeNull();
  expect(largeCircle).not.toBeNull();
  expect(Number(largeCircle.getAttribute('r'))).toBe(2 * Number(normalCircle.getAttribute('r')));
  const normalNumber = normalCircle.parentElement!.querySelector('text')!,
    largeNumber = largeCircle.parentElement!.querySelector('text')!;
  expect(Number(largeNumber.getAttribute('font-size'))).toBe(
    2 * Number(normalNumber.getAttribute('font-size')),
  );
  expect(Number(largeNumber.getAttribute('y')) - Number(largeCircle.getAttribute('cy'))).toBe(6);
  const wrapper = new DOMParser().parseFromString(large.svg, 'image/svg+xml');
  const ssr = new DOMParser().parseFromString(
    renderStaticSVG(spec, { width: 600, height: 400, theme: { fonts: { sizes: { small: 24 } } } }),
    'image/svg+xml',
  );
  expect(ssr.querySelector('.oc-map-labels [data-geo-note-id] circle')?.getAttribute('r')).toBe(
    '14',
  );
  expect(
    ssr.querySelector('.oc-map-labels [data-geo-note-id] text')?.getAttribute('font-size'),
  ).toBe('18');
  expect(wrapper.querySelector('.oc-map-labels [data-geo-note-id] circle')?.getAttribute('r')).toBe(
    largeCircle.getAttribute('r'),
  );
  expect(
    wrapper.querySelector('.oc-map-labels [data-geo-note-id] text')?.getAttribute('font-size'),
  ).toBe(largeNumber.getAttribute('font-size'));
  const group = largeCircle.closest('.oc-map-labels')!;
  const clip = group.querySelector('clipPath rect')!;
  const cx = Number(largeCircle.getAttribute('cx')),
    cy = Number(largeCircle.getAttribute('cy')),
    r = Number(largeCircle.getAttribute('r'));
  expect(cx - r).toBeGreaterThanOrEqual(Number(clip.getAttribute('x')));
  expect(cy - r).toBeGreaterThanOrEqual(Number(clip.getAttribute('y')));
  expect(cx + r).toBeLessThanOrEqual(
    Number(clip.getAttribute('x')) + Number(clip.getAttribute('width')),
  );
  expect(cy + r).toBeLessThanOrEqual(
    Number(clip.getAttribute('y')) + Number(clip.getAttribute('height')),
  );
});
