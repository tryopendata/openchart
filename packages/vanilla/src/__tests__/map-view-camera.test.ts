import type { GeoViewLayout } from '@opendata-ai/openchart-core';
import { compileGeoMap } from '@opendata-ai/openchart-engine';
import { afterEach, expect, it, vi } from 'vitest';
import { geoLabelSpec } from '../__test-fixtures__/geo-label-spec';
import { createMapViewCameras } from '../map-view-camera';

const layout = compileGeoMap(geoLabelSpec, { width: 600, height: 400 });
const view = (viewId: string, width = 100, height = 100): GeoViewLayout => ({
  viewId,
  frame: { x: 0, y: 0, width, height },
  viewport: { x: 0, y: 0, width, height },
  mapSize: { width, height },
  features: layout.features,
  borders: layout.borders,
  pointMarks: [],
  focus: null,
  detailLayers: [],
  projectionContext: { projection: 'identity', space: 'source' },
});
afterEach(() => vi.useRealTimers());
it('keeps independent defensive camera snapshots and rejects unknown views before mutation', () => {
  const frames = vi.fn(),
    settle = vi.fn();
  const controller = createMapViewCameras(frames, settle);
  controller.update([view('root'), view('island')]);
  controller.set('island', { cx: 30, cy: 40, k: 2 });
  expect(controller.get('root')).toEqual({ cx: 50, cy: 50, k: 1 });
  const camera = controller.get('island');
  camera.k = 8;
  expect(controller.get('island').k).toBe(2);
  expect(() => controller.set('missing', { cx: 0, cy: 0, k: 2 })).toThrow(
    'Available views: root, island',
  );
  expect(controller.get('island').k).toBe(2);
  controller.destroy();
});
it('rescales the same view center on resize and completes snaps but cancels pending view tweens on destroy', () => {
  vi.useFakeTimers();
  const frames = vi.fn(),
    settle = vi.fn();
  const controller = createMapViewCameras(frames, settle);
  controller.update([view('root'), view('island')]);
  controller.set('island', { cx: 20, cy: 30, k: 3 });
  controller.update([view('root'), view('island', 200, 300)]);
  expect(controller.get('island')).toEqual({ cx: 40, cy: 90, k: 3 });
  controller.animate('island', { cx: 50, cy: 70, k: 2 }, 0);
  expect(settle).toHaveBeenLastCalledWith('island');
  controller.animate('island', { cx: 40, cy: 60, k: 4 }, 100);
  const count = frames.mock.calls.length,
    settled = settle.mock.calls.length;
  controller.destroy();
  vi.runAllTimers();
  expect(frames).toHaveBeenCalledTimes(count);
  expect(settle).toHaveBeenCalledTimes(settled);
});
