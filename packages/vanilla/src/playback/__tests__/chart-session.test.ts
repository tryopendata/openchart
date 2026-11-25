import type { ChartPlayback } from '@opendata-ai/openchart-engine';
import { afterEach, describe, expect, it } from 'vitest';
import { renderChartSVG } from '../../svg-renderer';
import { type ChartPlaybackMountOptions, mountChartPlayback } from '../chart-session';
import { createFakePlayback } from './fake-playback';

function setup(
  playback: ChartPlayback = createFakePlayback(),
  overrides: Partial<ChartPlaybackMountOptions> = {},
) {
  const container = document.createElement('div');
  document.body.append(container);
  const svg = renderChartSVG(playback.base, container, { animate: false });
  const seen: Array<() => void> = [];
  const mounted = mountChartPlayback({
    container,
    svg,
    playback,
    darkMode: false,
    // Frames run only when a test asks; nothing advances on its own.
    scheduler: { request: () => 0, cancel: () => {} },
    reducedMotion: () => false,
    whenSeen(_element, cb) {
      seen.push(cb);
      return () => {};
    },
    ...overrides,
  });
  const strip = () => container.querySelector('.oc-playback-controls');
  return { container, svg, mounted, seen, strip };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('mountChartPlayback', () => {
  it('mounts the controls strip below the SVG', () => {
    const { svg, strip } = setup();
    const controls = strip();
    expect(controls).not.toBeNull();
    expect(
      svg.compareDocumentPosition(controls as Node) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(controls?.textContent).toContain('2000');
  });

  it('mounts no strip with controls off', () => {
    const { strip } = setup(createFakePlayback({ timing: { controls: false } }));
    expect(strip()).toBeNull();
  });

  it('starts "visible" autoplay from the first period once seen', () => {
    const { mounted, seen } = setup();
    expect(mounted.controller.getState()).toMatchObject({ t: 0, playing: false });
    for (const cb of seen) cb();
    expect(mounted.controller.getState().playing).toBe(true);
  });

  it('opens on the final period without autoplay under reduced motion', () => {
    const { mounted, seen } = setup(undefined, { reducedMotion: () => true });
    for (const cb of seen) cb();
    expect(mounted.controller.getState()).toMatchObject({ t: 2, playing: false });
    expect(mounted.controller.getState().period.label).toBe('2002');
  });

  it('opens on the final period without autoplay when animation is off', () => {
    const { mounted, seen } = setup(undefined, { animate: false });
    for (const cb of seen) cb();
    expect(mounted.controller.getState()).toMatchObject({ t: 2, playing: false });
  });

  it('reports periods from the playback and clamps seeks', () => {
    const { mounted } = setup();
    const periods: string[] = [];
    mounted.controller.on('period', (period) => periods.push(period.label));
    mounted.controller.seek(1);
    mounted.controller.seek(40);
    expect(periods).toEqual(['2001', '2002']);
    expect(mounted.controller.getState().t).toBe(2);
  });

  it('cannot play a single period and keeps no visible strip', () => {
    const { mounted, strip } = setup(createFakePlayback({ periodCount: 1 }));
    mounted.controller.play();
    expect(mounted.controller.getState().playing).toBe(false);
    const controls = strip() as HTMLElement | null;
    expect(controls === null || controls.hidden || controls.style.visibility === 'hidden').toBe(
      true,
    );
  });

  it('removes the strip on destroy and ignores later calls', () => {
    const { mounted, strip } = setup();
    mounted.destroy();
    expect(strip()).toBeNull();
    expect(() => {
      mounted.controller.play();
      mounted.controller.pause();
      mounted.destroy();
    }).not.toThrow();
    expect(mounted.controller.getState().playing).toBe(false);
  });
});
