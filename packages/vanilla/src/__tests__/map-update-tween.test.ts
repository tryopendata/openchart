/**
 * Geo map data updates run through the shared element tween (Seam B): feature
 * fills and point fill/r/cx/cy follow `update.ease`/spring, entering points
 * fade in, removed points leave a fading ghost.
 */

import type { AnimationSpec, GeoMapSpec } from '@opendata-ai/openchart-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { type FrameClock, installFrameClock } from '../__test-fixtures__/graph-frame-clock';
import { createGeoMap, type GeoMapInstance } from '../map-mount';

const MINI_TOPO = {
  type: 'Topology',
  transform: { scale: [1, 1], translate: [0, 0] },
  objects: {
    states: {
      type: 'GeometryCollection',
      geometries: [
        { type: 'Polygon', id: '06', properties: { name: 'California' }, arcs: [[0]] },
        { type: 'Polygon', id: '48', properties: { name: 'Texas' }, arcs: [[1]] },
      ],
    },
  },
  arcs: [
    [
      [-122, 37],
      [4, -3],
      [-3, 2],
      [-1, 1],
    ],
    [
      [-100, 31],
      [6, -1],
      [-3, -4],
      [-3, 5],
    ],
  ],
};

const MOTION: AnimationSpec = { enter: false, update: { duration: 400 } };

type City = { name: string; lat: number; lon: number; value: number };
const spec = (
  values: [number, number],
  cities: City[],
  animation: AnimationSpec = MOTION,
): GeoMapSpec =>
  ({
    type: 'map',
    animation,
    geo: { features: MINI_TOPO, projection: 'mercator' },
    data: [
      { fips: '06', value: values[0] },
      { fips: '48', value: values[1] },
    ],
    encoding: {
      key: { field: 'fips', type: 'nominal' },
      color: { field: 'value', type: 'quantitative' },
    },
    points: {
      data: cities,
      longitude: { field: 'lon', type: 'quantitative' },
      latitude: { field: 'lat', type: 'quantitative' },
      size: { field: 'value', type: 'quantitative' },
      key: { field: 'name', type: 'nominal' },
    },
  }) as GeoMapSpec;

const LA = { name: 'LA', lat: 34, lon: -118, value: 100 };
const SD = { name: 'SD', lat: 32.7, lon: -117, value: 50 };
const HOU = { name: 'HOU', lat: 29.8, lon: -95.4, value: 300 };

const BEFORE = spec([10, 20], [LA, SD]);
// Fills swap, LA shrinks, SD leaves, HOU arrives.
const AFTER = spec([20, 10], [{ ...LA, value: 20 }, HOU]);

let clock: FrameClock;
const instances: GeoMapInstance[] = [];

function mount(s: GeoMapSpec): { container: HTMLElement; chart: GeoMapInstance } {
  const container = createContainer();
  const chart = createGeoMap(container, s, { autoResize: false });
  instances.push(chart);
  return { container, chart };
}

const feature = (c: HTMLElement, key: string) =>
  c.querySelector(`.oc-map-feature[data-key="${key}"]`)!;
const point = (c: HTMLElement, key: string) =>
  c.querySelector(`.oc-map-point[data-point-key="${key}"]`)!;
const ghosts = (c: HTMLElement) => c.querySelectorAll('.oc-ghost');

/** Generated ids differ between renders; normalize them for comparison. */
const markup = (c: HTMLElement) =>
  c.querySelector('svg')!.outerHTML.replace(/oc-[a-z-]+-\d+/g, 'ID');

function stubReducedMotion(): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(prefers-reduced-motion: reduce)',
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

beforeEach(() => {
  clock = installFrameClock();
});

afterEach(() => {
  for (const chart of instances.splice(0)) chart.destroy();
  clock.restore();
  document.body.innerHTML = '';
});

describe('geo map update tween', () => {
  it('writes the from-state synchronously, before the first frame', () => {
    const { container, chart } = mount(BEFORE);
    const fromR = Number(point(container, 'LA').getAttribute('r'));
    chart.update(AFTER);

    expect(Number(point(container, 'LA').getAttribute('r'))).toBeCloseTo(fromR, 6);
    expect(point(container, 'HOU').getAttribute('opacity')).toBe('0');
    const ghost = ghosts(container);
    expect(ghost).toHaveLength(1);
    expect(ghost[0].hasAttribute('data-point-key')).toBe(false);
    expect(ghost[0].closest('[data-oc-map-camera]')).not.toBeNull();
  });

  it('moves through intermediate values and ends equal to a fresh render', () => {
    const { container, chart } = mount(BEFORE);
    const fromR = Number(point(container, 'LA').getAttribute('r'));
    const fromFill = feature(container, '06').getAttribute('fill');
    chart.update(AFTER);
    const fresh = mount(AFTER).container;
    const toR = Number(point(fresh, 'LA').getAttribute('r'));
    expect(toR).not.toBe(fromR);

    clock.pump(0);
    clock.pump(250);
    const midR = Number(point(container, 'LA').getAttribute('r'));
    expect(midR).toBeGreaterThan(Math.min(fromR, toR));
    expect(midR).toBeLessThan(Math.max(fromR, toR));
    const midFill = feature(container, '06').getAttribute('fill');
    expect(midFill).not.toBe(fromFill);
    expect(midFill).not.toBe(feature(fresh, '06').getAttribute('fill'));
    // Survivors hold while the removed point's ghost clears; the entering
    // point fades in over the tail of their motion.
    expect(Number(ghosts(container)[0].getAttribute('opacity') ?? 1)).toBeLessThan(1);
    clock.pump(450);
    const midOpacity = Number(point(container, 'HOU').getAttribute('opacity'));
    expect(midOpacity).toBeGreaterThan(0);
    expect(midOpacity).toBeLessThan(1);

    clock.pump(5000);
    expect(ghosts(container)).toHaveLength(0);
    expect(markup(container)).toBe(markup(fresh));
  });

  it('honours a spring update phase', () => {
    const springy: AnimationSpec = { enter: false, update: { spring: { stiffness: 200 } } };
    const { container, chart } = mount(spec([10, 20], [LA, SD], springy));
    const fromR = Number(point(container, 'LA').getAttribute('r'));
    chart.update(spec([20, 10], [{ ...LA, value: 20 }, HOU], springy));
    clock.pump(0);
    clock.pump(250);
    const midR = Number(point(container, 'LA').getAttribute('r'));
    expect(midR).not.toBeCloseTo(fromR, 3);
    clock.pump(5000);
    expect(ghosts(container)).toHaveLength(0);
  });

  it('snaps when update motion is off', () => {
    const off: AnimationSpec = { enter: false, update: false };
    const { container, chart } = mount(spec([10, 20], [LA, SD], off));
    chart.update(spec([20, 10], [{ ...LA, value: 20 }, HOU], off));
    expect(ghosts(container)).toHaveLength(0);
    expect(point(container, 'HOU').hasAttribute('opacity')).toBe(false);
  });

  it('snaps an update that lands while the entrance plays', () => {
    const animated: AnimationSpec = { update: { duration: 400 } };
    const { container, chart } = mount(spec([10, 20], [LA, SD], animated));
    expect(container.querySelector('svg.oc-animate')).not.toBeNull();
    chart.update(spec([20, 10], [{ ...LA, value: 20 }, HOU], animated));
    expect(ghosts(container)).toHaveLength(0);
    expect(point(container, 'HOU').hasAttribute('opacity')).toBe(false);
  });

  it('snaps under reduced motion', () => {
    stubReducedMotion();
    const { container, chart } = mount(BEFORE);
    chart.update(AFTER);
    expect(ghosts(container)).toHaveLength(0);
    expect(point(container, 'HOU').hasAttribute('opacity')).toBe(false);
  });

  it('snaps and drops ghosts when a resize or destroy interrupts it', () => {
    const { container, chart } = mount(BEFORE);
    chart.update(AFTER);
    clock.pump(0);
    clock.pump(100);
    chart.resize();
    expect(ghosts(container)).toHaveLength(0);
    expect(point(container, 'HOU').hasAttribute('opacity')).toBe(false);
  });
});
