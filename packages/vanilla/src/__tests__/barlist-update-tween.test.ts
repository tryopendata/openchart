/**
 * Bar list data updates tween through the shared element tween (Seam B):
 * surviving rows slide to their new slot while the bar resizes and recolours,
 * new rows fade in, removed rows leave a fading ghost.
 */

import type { AnimationSpec, BarListSpec } from '@opendata-ai/openchart-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { type FrameClock, installFrameClock } from '../__test-fixtures__/graph-frame-clock';
import { type BarListInstance, createBarList } from '../barlist-mount';

const MOTION: AnimationSpec = { enter: false, update: { duration: 400 } };

const spec = (
  rows: Array<{ name: string; value: number }>,
  animation: AnimationSpec = MOTION,
): BarListSpec => ({
  type: 'barlist',
  animation,
  data: rows,
  encoding: {
    label: { field: 'name', type: 'nominal' },
    value: { field: 'value', type: 'quantitative' },
  },
});

const BEFORE = [
  { name: 'A', value: 9 },
  { name: 'B', value: 6 },
  { name: 'C', value: 3 },
];
// A and B swap order, B grows, C leaves, D arrives.
const AFTER = [
  { name: 'B', value: 12 },
  { name: 'A', value: 9 },
  { name: 'D', value: 2 },
];

let clock: FrameClock;
const instances: BarListInstance[] = [];

function mount(s: BarListSpec): { container: HTMLElement; chart: BarListInstance } {
  const container = createContainer();
  const chart = createBarList(container, s, { autoResize: false });
  instances.push(chart);
  return { container, chart };
}

const row = (c: HTMLElement, key: string) => c.querySelector(`.oc-barlist-row[data-key="${key}"]`);
const bar = (c: HTMLElement, key: string) => row(c, key)?.querySelector('.oc-barlist-bar');
const ghosts = (c: HTMLElement) => c.querySelectorAll('.oc-ghost');

/** The rendered SVG with page-scoped ids normalized, for comparing renders. */
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

describe('bar list update tween', () => {
  it('stamps row keys on live rows', () => {
    const { container } = mount(spec(BEFORE));
    expect(row(container, 'A')).not.toBeNull();
    expect(row(container, 'C')).not.toBeNull();
  });

  it('writes the from-state synchronously, before the first frame', () => {
    const { container, chart } = mount(spec(BEFORE));
    const fromWidth = bar(container, 'B')!.getAttribute('width');
    const fromY = Number(bar(container, 'B')!.getAttribute('y'));

    chart.update(spec(AFTER));

    // B moved up a slot and grew, but nothing has painted yet: it is drawn
    // where it was, at its old width.
    const b = row(container, 'B')!;
    const dy = Number(/translate\(0, ([-\d.]+)\)/.exec(b.getAttribute('transform') ?? '')?.[1]);
    expect(Number(bar(container, 'B')!.getAttribute('y')) + dy).toBeCloseTo(fromY, 6);
    expect(bar(container, 'B')!.getAttribute('width')).toBe(fromWidth);
    // D is new and starts invisible; C is a ghost at full opacity.
    expect(row(container, 'D')!.getAttribute('opacity')).toBe('0');
    expect(ghosts(container)).toHaveLength(1);
    expect(ghosts(container)[0].getAttribute('data-row-index')).not.toBeNull();
    expect(ghosts(container)[0].hasAttribute('data-key')).toBe(false);
  });

  it('moves through intermediate values and ends equal to a fresh render', () => {
    const { container, chart } = mount(spec(BEFORE));
    const fromWidth = Number(bar(container, 'B')!.getAttribute('width'));
    chart.update(spec(AFTER));
    const fresh = mount(spec(AFTER)).container;
    const toWidth = Number(bar(fresh, 'B')!.getAttribute('width'));

    clock.pump(0);
    clock.pump(300);
    const mid = Number(bar(container, 'B')!.getAttribute('width'));
    expect(mid).toBeGreaterThan(fromWidth);
    expect(mid).toBeLessThan(toWidth);

    clock.pump(5000);
    expect(ghosts(container)).toHaveLength(0);
    expect(row(container, 'B')!.hasAttribute('transform')).toBe(false);
    expect(row(container, 'D')!.hasAttribute('opacity')).toBe(false);
    expect(markup(container)).toBe(markup(fresh));
  });

  it('snaps when update motion is off', () => {
    const { container, chart } = mount(spec(BEFORE, { enter: false, update: false }));
    chart.update(spec(AFTER, { enter: false, update: false }));
    expect(ghosts(container)).toHaveLength(0);
    expect(row(container, 'B')!.hasAttribute('transform')).toBe(false);
    expect(markup(container)).toBe(
      markup(mount(spec(AFTER, { enter: false, update: false })).container),
    );
  });

  it('snaps an update that lands while the entrance plays', () => {
    const animated: AnimationSpec = { update: { duration: 400 } };
    const { container, chart } = mount(spec(BEFORE, animated));
    // happy-dom plays the entrance at mount; it is still running.
    expect(container.querySelector('svg.oc-animate')).not.toBeNull();
    chart.update(spec(AFTER, animated));
    expect(ghosts(container)).toHaveLength(0);
    expect(row(container, 'D')!.hasAttribute('opacity')).toBe(false);
    expect(row(container, 'B')!.hasAttribute('transform')).toBe(false);
  });

  it('snaps under reduced motion', () => {
    stubReducedMotion();
    const { container, chart } = mount(spec(BEFORE));
    chart.update(spec(AFTER));
    expect(ghosts(container)).toHaveLength(0);
    expect(row(container, 'D')!.hasAttribute('opacity')).toBe(false);
    expect(row(container, 'B')!.hasAttribute('transform')).toBe(false);
  });

  it('snaps and drops ghosts when a resize or destroy interrupts it', () => {
    const { container, chart } = mount(spec(BEFORE));
    chart.update(spec(AFTER));
    clock.pump(0);
    clock.pump(100);
    chart.resize();
    expect(ghosts(container)).toHaveLength(0);
    expect(row(container, 'B')!.hasAttribute('transform')).toBe(false);

    chart.update(spec(BEFORE));
    expect(ghosts(container).length).toBeGreaterThan(0);
    chart.destroy();
    clock.pump(200);
    expect(ghosts(container)).toHaveLength(0);
  });
});
