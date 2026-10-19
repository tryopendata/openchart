import type { GeoMapLayout, GeoViewLayout } from '@opendata-ai/openchart-core';
import { compileGeoMap } from '@opendata-ai/openchart-engine';
import { expect, it } from 'vitest';
import { geoLabelSpec } from '../__test-fixtures__/geo-label-spec';
import { applyMapCamera } from '../map-camera';
import { renderMapReaderOverlay } from '../map-reader-overlays';
import { renderMapSVG } from '../map-renderer';
import { applyGeoDetailVisibility, findGeoViewScene, geoViewMapLayout } from '../map-view-renderer';

it('isolates clips, camera transforms, detail visibility and shared selected outlines per view', () => {
  const base = compileGeoMap(geoLabelSpec, { width: 600, height: 400 });
  const make = (viewId: string, x: number): GeoViewLayout => ({
    viewId,
    frame: { x, y: 0, width: 180, height: 160 },
    viewport: { x, y: 20, width: 180, height: 140 },
    mapSize: { width: 180, height: 140 },
    features: base.features,
    borders: base.borders,
    pointMarks: [],
    labels: undefined,
    focus: null,
    detailLayers: [{ id: 'context', minZoom: 2, maxZoom: 4, paths: [base.features[0].path] }],
    projectionContext: { projection: 'identity', space: 'source' },
  });
  const layout: GeoMapLayout = { ...base, views: [make('root', 0), make('island', 200)] };
  const svg = renderMapSVG(layout, { animate: false });
  const root = findGeoViewScene(svg, 'root')!,
    island = findGeoViewScene(svg, 'island')!;
  const rootTransform = root.querySelector('[data-oc-map-camera]')!.getAttribute('transform');
  applyMapCamera(island, { cx: 70, cy: 60, k: 3 }, geoViewMapLayout(layout, layout.views![1]));
  applyGeoDetailVisibility(island, 3);
  expect(root.querySelector('[data-oc-map-camera]')!.getAttribute('transform')).toBe(rootTransform);
  expect(root.querySelector('[data-geo-layer-id]')!.getAttribute('display')).toBe('none');
  expect(island.querySelector('[data-geo-layer-id]')!.hasAttribute('display')).toBe(false);
  const clips = [...svg.querySelectorAll('.oc-map-group')].map((group) =>
    group.getAttribute('clip-path'),
  );
  expect(new Set(clips).size).toBe(2);
  const observation = {
    entity: {
      kind: 'feature' as const,
      id: base.features[0].id,
      canonicalId: String(base.features[0].id),
    },
    observation: `feature:${base.features[0].id}`,
    persistent: true,
    datum: base.features[0].data,
    state: 'visible' as const,
  };
  const record = {
    observation,
    name: 'place',
    valueLabel: '1',
    valueStatus: 'value' as const,
    identityStatus: 'persistent' as const,
    fields: [],
  };
  renderMapReaderOverlay(
    svg,
    layout,
    { cx: 90, cy: 70, k: 1 },
    {
      records: [record],
      byObservation: new Map([[observation.observation, record]]),
      diagnostics: [],
    },
    { preview: null, pinned: [observation], announcement: '' },
    (id) => (id === 'root' ? { cx: 90, cy: 70, k: 1 } : { cx: 70, cy: 60, k: 3 }),
  );
  const paths = [...svg.querySelectorAll('[data-oc-reader-overlay] path')];
  expect(paths).toHaveLength(2);
  expect(paths[0].getAttribute('transform')).not.toBe(paths[1].getAttribute('transform'));
});

import { vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { createGeoMap } from '../map-mount';
import { createGeoReader } from '../map-reader';
import { renderStaticSVG } from '../static';

const authoredViews = {
  ...geoLabelSpec,
  geo: {
    ...geoLabelSpec.geo,
    insets: [
      {
        id: 'island',
        label: 'Island copy',
        featureIds: ['a'],
        placement: 'bottom-left' as const,
        width: 120,
        removeFromMain: false,
      },
    ],
  },
};
it('runs authored view cameras independently, rejects ambiguous focus, and exports current cameras', () => {
  const container = createContainer();
  const changed = vi.fn();
  const map = createGeoMap(container, authoredViews, {
    autoResize: false,
    onCameraChange: changed,
  });
  expect(Object.keys(map.getCameras())).toEqual(['root', 'island']);
  const root = map.getCamera();
  const camera = { ...map.getCamera('island'), k: 3 };
  map.setCamera(camera, { viewId: 'island' });
  expect(map.getCamera()).toEqual(root);
  expect(changed).toHaveBeenLastCalledWith(camera, { viewId: 'island' });
  expect(() => map.zoomTo('a')).toThrow('ambiguous');
  expect(() => map.setCamera(camera, { viewId: 'absent' })).toThrow('Available views');
  const inset = map.layout.views!.find((view) => view.viewId === 'island')!;
  const bounds = container.getBoundingClientRect();
  const scene = container.querySelector('[data-geo-view-id="island"]')!;
  const wheelInit = {
    bubbles: true,
    cancelable: true,
    ctrlKey: true,
    deltaY: -100,
    clientX:
      bounds.left +
      ((map.layout.area.x + inset.viewport.x + inset.viewport.width / 2) * bounds.width) /
        map.layout.width,
    clientY:
      bounds.top +
      ((map.layout.area.y + inset.viewport.y + inset.viewport.height / 2) * bounds.height) /
        map.layout.height,
  };
  const wheel = new WheelEvent('wheel', wheelInit);
  for (const key of ['clientX', 'clientY', 'ctrlKey'] as const)
    Object.defineProperty(wheel, key, { value: wheelInit[key] });
  scene.dispatchEvent(wheel);
  expect(map.getCamera()).toEqual(root);
  expect(map.getCamera('island').k).toBeGreaterThan(3);
  const reader = createGeoReader(container, map, authoredViews, vi.fn());
  reader.pin({ kind: 'feature', id: 'a', canonicalId: 'a' });
  expect(reader.selection.pinned).toHaveLength(1);
  expect(container.querySelectorAll('[data-oc-reader-overlay] path')).toHaveLength(2);
  const exported = new DOMParser().parseFromString(map.export('svg') as string, 'image/svg+xml');
  expect(exported.querySelectorAll('[data-geo-view-id]')).toHaveLength(2);
  expect(
    exported
      .querySelector('[data-geo-view-id="island"] [data-oc-map-camera]')
      ?.getAttribute('transform'),
  ).toBe(
    container
      .querySelector('[data-geo-view-id="island"] [data-oc-map-camera]')
      ?.getAttribute('transform'),
  );
  expect(exported.querySelector('[data-oc-reader-overlay]')).toBeNull();
  reader.destroy();
  map.destroy();
  container.remove();
});
it('renders deterministic static views with complete inventory and locally scoped clip references', () => {
  const first = renderStaticSVG(authoredViews, { width: 600, height: 400, idPrefix: 'first' });
  expect(first).toBe(
    renderStaticSVG(authoredViews, { width: 600, height: 400, idPrefix: 'first' }),
  );
  const second = renderStaticSVG(authoredViews, { width: 600, height: 400, idPrefix: 'second' });
  const document = new DOMParser().parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg">${first}${second}</svg>`,
    'image/svg+xml',
  );
  const ids = [...document.querySelectorAll('[id]')].map((node) => node.id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(document.querySelectorAll('[data-geo-view-id]')).toHaveLength(4);
  for (const node of document.querySelectorAll('[clip-path]')) {
    const id = node.getAttribute('clip-path')!.slice(5, -1);
    expect(node.closest('svg')!.querySelector(`[id="${id}"]`)).not.toBeNull();
  }
  expect(document.querySelector('desc[data-geo-label-inventory]')?.textContent).toContain(
    'Exact custom region',
  );
});

it('keeps one complete fallback note and inventory entry for a duplicated place', () => {
  const spec = {
    ...authoredViews,
    callouts: [
      {
        id: 'shared-note',
        anchor: { kind: 'feature' as const, id: 'a' },
        text: 'Complete duplicated place note',
        offset: { dx: 10000, dy: 10000 },
      },
    ],
  };
  const container = createContainer();
  const map = createGeoMap(container, spec, { autoResize: false });
  expect(
    container.querySelectorAll('.oc-map-label-notes [data-geo-note-id="callout:shared-note"]'),
  ).toHaveLength(1);
  expect(
    container
      .querySelector('.oc-map-label-inventory')
      ?.textContent?.match(/Complete duplicated place note/g),
  ).toHaveLength(1);
  const exported = new DOMParser().parseFromString(map.export('svg') as string, 'image/svg+xml');
  expect(
    exported.querySelectorAll('.oc-map-label-notes [data-geo-note-id="callout:shared-note"]'),
  ).toHaveLength(1);
  const stat = new DOMParser().parseFromString(
    renderStaticSVG(spec, { width: 600, height: 400 }),
    'image/svg+xml',
  );
  expect(
    stat.querySelectorAll('.oc-map-label-notes [data-geo-note-id="callout:shared-note"]'),
  ).toHaveLength(1);
  map.destroy();
  container.remove();
});

it('shows a persistent pin in its surviving root representation after its activated inset is removed', () => {
  const container = createContainer(),
    panel = document.createElement('aside');
  const map = createGeoMap(container, authoredViews, { autoResize: false });
  const reader = createGeoReader(container, map, authoredViews, vi.fn(), {
    panel: { container: panel },
  });
  const svg = container.querySelector('svg')!;
  Object.defineProperty(svg, 'getBoundingClientRect', {
    value: () => container.getBoundingClientRect(),
  });
  const mark = container.querySelector('[data-geo-view-id="island"] [data-feature-id="a"]')!;
  mark.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 10, pointerId: 1 }),
  );
  mark.dispatchEvent(
    new PointerEvent('pointerup', { bubbles: true, clientX: 10, clientY: 10, pointerId: 1 }),
  );
  expect(reader.selection.pinned).toHaveLength(1);
  map.update(geoLabelSpec);
  const button = [...panel.querySelectorAll('button')].find((button) =>
    button.textContent?.startsWith('Show '),
  )!;
  expect(button).toBeDefined();
  const focus = vi.spyOn(map, 'zoomTo');
  expect(() => button.click()).not.toThrow();
  expect(focus).toHaveBeenCalledWith('a', { viewId: undefined });
  expect(reader.selection.pinned).toHaveLength(1);
  reader.destroy();
  map.destroy();
  container.remove();
});

it('closes an open Show chooser on update and makes retained stale buttons resolve current views', () => {
  const container = createContainer(),
    panel = document.createElement('aside');
  const map = createGeoMap(container, authoredViews, { autoResize: false });
  const reader = createGeoReader(container, map, authoredViews, vi.fn(), {
    panel: { container: panel },
  });
  reader.pin({ kind: 'feature', id: 'a', canonicalId: 'a' });
  [...panel.querySelectorAll('button')]
    .find((button) => button.textContent?.startsWith('Show '))!
    .click();
  const chooser = container.querySelector('.oc-map-overlap-chooser')!;
  const stale = [...chooser.querySelectorAll('button')].find((button) =>
    button.textContent?.includes('Island'),
  )!;
  expect(stale).toBeDefined();
  map.update(geoLabelSpec);
  expect(container.querySelector('.oc-map-overlap-chooser')).toBeNull();
  const focus = vi.spyOn(map, 'zoomTo');
  stale.click();
  expect(focus).toHaveBeenCalledWith('a', { viewId: undefined });
  reader.destroy();
  map.destroy();
  container.remove();
});
