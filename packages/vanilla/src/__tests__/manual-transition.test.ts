/**
 * Manual (seekable) update transition — the primitive `exportSpecSequence` uses
 * to capture the on-screen bar tween headlessly, driving the transition by
 * explicit elapsed time instead of the rAF clock.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { createChart } from '../mount';

/**
 * Two-category bar spec with a FIXED y domain. A fixed domain is essential: with
 * a single auto-scaled bar the domain is always [0, value], so the bar fills the
 * full plot height at every value and its <rect> height never changes. Pinning
 * the domain (and keeping category B constant) makes bar A's height track its
 * value, which is what the tween actually animates.
 */
function columnSpec(valueA: number): ChartSpec {
  return {
    // enter:false so the first render is settled; update:true so a spec swap tweens.
    animation: { enter: false, update: true },
    mark: 'bar',
    data: [
      { category: 'A', value: valueA },
      { category: 'B', value: 100 },
    ],
    encoding: {
      x: { field: 'category', type: 'nominal' },
      y: { field: 'value', type: 'quantitative', scale: { domain: [0, 100] } },
    },
  };
}

/** Height of bar A's <rect>, as a number. data-key is series-prefixed ("|A"). */
function barHeight(container: HTMLElement): number {
  const group = container.querySelector('.oc-mark-rect[data-series="A"]');
  const rect = group?.querySelector('rect');
  return rect ? parseFloat(rect.getAttribute('height') ?? '0') : NaN;
}

describe('beginManualUpdate (seekable transition)', () => {
  // Fail loudly if the manual transition ever schedules an rAF — the whole point
  // is that it does not.
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', () => {
      throw new Error('manual transition must not schedule requestAnimationFrame');
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a handle with a positive totalMs and steps geometry without rAF', () => {
    const container = createContainer();
    const chart = createChart(container, columnSpec(10));

    const startH = barHeight(container);

    const handle = chart.beginManualUpdate(columnSpec(100));
    expect(handle).not.toBeNull();
    expect(handle!.totalMs).toBeGreaterThan(0);

    // runTransition applies the t=0 (previous) geometry synchronously, so
    // stepping near the start holds bar A close to its old (short) height.
    handle!.step(1);
    const earlyH = barHeight(container);

    // Step to the end: geometry snaps to the final (taller) bar.
    const stillRunning = handle!.step(handle!.totalMs);
    const finalH = barHeight(container);
    handle!.cancel();

    // Bar A grew 10 -> 100 over the tween: early-step height below the final one.
    expect(earlyH).toBeLessThan(finalH);
    expect(finalH).toBeGreaterThan(startH);
    // step(totalMs) reports the tween is done.
    expect(stillRunning).toBe(false);

    chart.destroy();
  });

  it('step is monotonic across the tween (bar grows as t increases)', () => {
    const container = createContainer();
    const chart = createChart(container, columnSpec(5));
    const handle = chart.beginManualUpdate(columnSpec(80));
    expect(handle).not.toBeNull();

    const total = handle!.totalMs;
    handle!.step(total * 0.1);
    const h1 = barHeight(container);
    handle!.step(total * 0.5);
    const h2 = barHeight(container);
    handle!.step(total * 0.9);
    const h3 = barHeight(container);
    handle!.cancel();

    // Strictly increasing (not just >=), so a frozen/no-op tween would fail.
    expect(h2).toBeGreaterThan(h1);
    expect(h3).toBeGreaterThan(h2);

    chart.destroy();
  });
});
