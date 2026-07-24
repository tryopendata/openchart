/**
 * Multi-spec GIF export tests.
 *
 * `exportSpecSequence` itself can't run under happy-dom (it rasterizes every
 * frame), so the testable unit is `settleAnimation`: the wrapper both the
 * offscreen mount and each step apply to an author's spec. It must force
 * `enter:false` without discarding the author's own update config.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { afterEach, describe, expect, it } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { settleAnimation } from '../export-sequence';
import { createChart } from '../mount';

const baseSpec: ChartSpec = {
  mark: 'bar',
  data: [
    { name: 'A', value: 10 },
    { name: 'B', value: 30 },
  ],
  encoding: {
    x: { field: 'value', type: 'quantitative' },
    y: { field: 'name', type: 'nominal' },
  },
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('settleAnimation', () => {
  it('produces {enter:false, update:true} when the spec has no animation', () => {
    expect(settleAnimation(baseSpec).animation).toEqual({ enter: false, update: true });
  });

  it('produces {enter:false, update:true} when animation is the boolean shorthand', () => {
    expect(settleAnimation({ ...baseSpec, animation: true }).animation).toEqual({
      enter: false,
      update: true,
    });
    expect(settleAnimation({ ...baseSpec, animation: { update: true } }).animation).toEqual({
      enter: false,
      update: true,
    });
    expect(settleAnimation({ ...baseSpec, animation: { update: false } }).animation).toEqual({
      enter: false,
      update: true,
    });
  });

  it("keeps the author's update config (maxMarks) while still forcing enter:false", () => {
    const settled = settleAnimation({
      ...baseSpec,
      animation: { enter: true, update: { maxMarks: 5000, duration: 900 } },
    });
    expect(settled.animation).toEqual({
      enter: false,
      update: { maxMarks: 5000, duration: 900 },
    });
  });

  it("does not mutate the author's spec", () => {
    const spec: ChartSpec = { ...baseSpec, animation: { update: { maxMarks: 5000 } } };
    settleAnimation(spec);
    expect(spec.animation).toEqual({ update: { maxMarks: 5000 } });
  });

  it('carries maxMarks through compilation into the rendered layout', () => {
    const container = createContainer();
    const settled = settleAnimation({
      ...baseSpec,
      animation: { update: { maxMarks: 5000 } },
    });
    const chart = createChart(container, settled, { width: 600, height: 400 });

    const animation = (chart.layout as { animation?: { update?: { maxMarks?: number } } })
      .animation;
    expect(animation?.update?.maxMarks).toBe(5000);

    chart.destroy();
  });
});
