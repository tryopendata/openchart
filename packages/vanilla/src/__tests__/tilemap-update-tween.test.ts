/**
 * Tile map data updates tween through the shared element tween (Seam B).
 * Geography is fixed, so tiles only recolour: fill, fill-opacity and the
 * labels' inline fill.
 */

import type { AnimationSpec, TileMapSpec } from '@opendata-ai/openchart-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { type FrameClock, installFrameClock } from '../__test-fixtures__/graph-frame-clock';
import { createTileMap, type TileMapInstance } from '../tilemap-mount';

const MOTION: AnimationSpec = { enter: false, update: { duration: 400 } };

const spec = (
  data: Record<string, number | null>,
  animation: AnimationSpec = MOTION,
): TileMapSpec => ({ type: 'tilemap', animation, data });

const BEFORE = { CA: 1, TX: 5, NY: 9 };
const AFTER = { CA: 9, TX: 5, NY: 1 };

let clock: FrameClock;
const instances: TileMapInstance[] = [];

function mount(s: TileMapSpec): { container: HTMLElement; chart: TileMapInstance } {
  const container = createContainer();
  const chart = createTileMap(container, s, { autoResize: false });
  instances.push(chart);
  return { container, chart };
}

const tileRect = (c: HTMLElement, state: string) =>
  c.querySelector(`.oc-tilemap-tile[data-state="${state}"] rect`)!;
const codeLabel = (c: HTMLElement, state: string) =>
  c.querySelector<SVGTextElement>(`.oc-tilemap-tile[data-state="${state}"] text`)!;

// The default encoding is one hue at a value-scaled fill-opacity.
const opacity = (c: HTMLElement, state: string) =>
  Number(tileRect(c, state).getAttribute('fill-opacity'));

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

describe('tile map update tween', () => {
  it('writes the from-state synchronously, before the first frame', () => {
    const { container, chart } = mount(spec(BEFORE));
    const before = opacity(container, 'CA');
    chart.update(spec(AFTER));
    const fresh = mount(spec(AFTER)).container;
    expect(opacity(fresh, 'CA')).not.toBe(before);
    expect(opacity(container, 'CA')).toBe(before);
  });

  it('recolours tiles and labels through intermediate values, ending equal to a fresh render', () => {
    const { container, chart } = mount(spec(BEFORE));
    const from = opacity(container, 'CA');
    const fromLabel = codeLabel(container, 'CA').style.getPropertyValue('fill');
    chart.update(spec(AFTER));
    const fresh = mount(spec(AFTER)).container;
    const to = opacity(fresh, 'CA');

    clock.pump(0);
    clock.pump(200);
    const mid = opacity(container, 'CA');
    expect(mid).toBeGreaterThan(Math.min(from, to));
    expect(mid).toBeLessThan(Math.max(from, to));
    // Labels flip between dark and light text with the tile's luminance.
    if (fromLabel !== codeLabel(fresh, 'CA').style.getPropertyValue('fill')) {
      expect(codeLabel(container, 'CA').style.getPropertyValue('fill')).toMatch(/^rgb\(/);
    }

    clock.pump(5000);
    expect(markup(container)).toBe(markup(fresh));
  });

  it('snaps when update motion is off', () => {
    const off: AnimationSpec = { enter: false, update: false };
    const { container, chart } = mount(spec(BEFORE, off));
    chart.update(spec(AFTER, off));
    expect(markup(container)).toBe(markup(mount(spec(AFTER, off)).container));
  });

  it('snaps an update that lands while the entrance plays', () => {
    const animated: AnimationSpec = { update: { duration: 400 } };
    const { container, chart } = mount(spec(BEFORE, animated));
    expect(container.querySelector('svg.oc-animate')).not.toBeNull();
    chart.update(spec(AFTER, animated));
    const fresh = mount(spec(AFTER, MOTION)).container;
    expect(opacity(container, 'CA')).toBe(opacity(fresh, 'CA'));
  });

  it('snaps under reduced motion', () => {
    stubReducedMotion();
    const { container, chart } = mount(spec(BEFORE));
    chart.update(spec(AFTER));
    expect(markup(container)).toBe(markup(mount(spec(AFTER)).container));
  });

  it('snaps to the final state when destroy or a resize interrupts it', () => {
    const { container, chart } = mount(spec(BEFORE));
    chart.update(spec(AFTER));
    clock.pump(0);
    clock.pump(100);
    chart.resize();
    expect(markup(container)).toBe(markup(mount(spec(AFTER)).container));
  });
});
