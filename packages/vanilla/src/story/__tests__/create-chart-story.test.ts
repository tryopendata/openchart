/**
 * Integration tests for `createChartStory`, driven through the public API and
 * the real compile/render pipeline (no mocked internal modules). Assertions
 * target observable output: rendered marks, DOM attributes, the marks-group
 * camera transform, and warning side effects.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContainer } from '../../__test-fixtures__/dom';
import { createChartStory } from '../create-chart-story';

const baseSpec: ChartSpec = {
  mark: 'line',
  data: [
    { year: '2008', value: 10, country: 'US' },
    { year: '2012', value: 40, country: 'US' },
    { year: '2016', value: 25, country: 'US' },
    { year: '2008', value: 15, country: 'Germany' },
    { year: '2012', value: 35, country: 'Germany' },
    { year: '2016', value: 30, country: 'Germany' },
  ],
  encoding: {
    x: { field: 'year', type: 'ordinal' },
    y: { field: 'value', type: 'quantitative' },
    color: { field: 'country', type: 'nominal' },
  },
  chrome: { title: 'Base' },
};

/** Read the current chart title text, or null. */
function title(container: HTMLElement): string | null {
  return container.querySelector('.oc-title')?.textContent ?? null;
}

/** Read the camera transform stamped on the marks group, or null. */
function cameraTransform(container: HTMLElement): string | null {
  return container.querySelector('[data-oc-marks-group]')?.getAttribute('transform') ?? null;
}

/**
 * The neutral gray the color-scale-range applies to non-highlighted line
 * series when a highlight is active (color-scale-range.ts MUTED_COLOR). Its
 * presence on a line stroke is the observable signal that a highlight is
 * active; its absence means no highlight.
 */
const MUTED_STROKE = '#bfc3c8';

/** Keyed beeswarm spec with `count` dots; `shift` perturbs the values. */
function beeswarmStorySpec(count: number, shift: number): ChartSpec {
  return {
    animation: { enter: false },
    mark: 'beeswarm',
    data: Array.from({ length: count }, (_, i) => ({
      entity: `e${i}`,
      value: ((i * 37 + shift) % 500) / 5,
    })),
    encoding: {
      x: { field: 'value', type: 'quantitative' },
      key: { field: 'entity', type: 'nominal' },
    },
  };
}

/** Count line-mark strokes painted the muted gray (i.e. non-highlighted series). */
function mutedStrokeCount(container: HTMLElement): number {
  const paths = container.querySelectorAll('.oc-mark-line path');
  let count = 0;
  for (const p of paths) {
    if (p.getAttribute('stroke')?.toLowerCase() === MUTED_STROKE) count++;
  }
  return count;
}

describe('createChartStory', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = createContainer();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('mounts the base spec at step 0', () => {
    const story = createChartStory(container, {
      spec: baseSpec,
      steps: [{}, { spec: { chrome: { title: 'Step 1' } } }],
    });

    expect(container.querySelector('svg')).not.toBeNull();
    expect(title(container)).toBe('Base');
    expect(story.currentStep).toBe(-1);
    expect(story.totalSteps).toBe(2);

    story.destroy();
  });

  it('applies cumulative patches: goTo(n) reflects patches 0..n', () => {
    const story = createChartStory(container, {
      spec: baseSpec,
      steps: [
        {},
        { spec: { chrome: { title: 'One' } } },
        { spec: { chrome: { subtitle: 'Two' } } },
      ],
    });

    story.goTo(2);

    expect(title(container)).toBe('One');
    expect(container.querySelector('.oc-subtitle')?.textContent).toBe('Two');
    expect(story.currentStep).toBe(2);

    story.destroy();
  });

  it('goTo(n) from step 0 converges to the same state as stepping 0..n', () => {
    const steps = [
      {},
      { spec: { chrome: { title: 'A' } } },
      { spec: { chrome: { subtitle: 'B' } } },
      { spec: { chrome: { source: 'C' } } },
      { highlight: ['US'] },
    ];

    const jumpContainer = createContainer();
    const jump = createChartStory(jumpContainer, { spec: baseSpec, steps });
    jump.goTo(4);

    const stepContainer = createContainer();
    const stepwise = createChartStory(stepContainer, { spec: baseSpec, steps });
    for (let i = 0; i <= 4; i++) stepwise.goTo(i);

    // Same observable chrome DOM after the jump vs. sequential stepping.
    expect(jumpContainer.querySelector('.oc-title')?.textContent).toBe(
      stepContainer.querySelector('.oc-title')?.textContent,
    );
    expect(jumpContainer.querySelector('.oc-subtitle')?.textContent).toBe(
      stepContainer.querySelector('.oc-subtitle')?.textContent,
    );
    expect(jumpContainer.querySelector('.oc-source')?.textContent).toBe(
      stepContainer.querySelector('.oc-source')?.textContent,
    );
    expect(jump.currentStep).toBe(stepwise.currentStep);

    jump.destroy();
    stepwise.destroy();
  });

  it('highlight sugar sets encoding.color.highlight without a nested spec patch', () => {
    const story = createChartStory(container, {
      spec: baseSpec,
      steps: [{}, { highlight: ['Germany'] }],
    });

    story.goTo(1);

    // Highlighting Germany resolves through the color encoding: US (the
    // non-highlighted series) gets the muted gray stroke. So exactly one line
    // stroke should be muted.
    expect(container.querySelector('svg')).not.toBeNull();
    expect(mutedStrokeCount(container)).toBe(1);

    story.destroy();
  });

  it('highlight null clears an earlier highlight', () => {
    const story = createChartStory(container, {
      spec: baseSpec,
      steps: [{}, { highlight: ['Germany'] }, { highlight: null }],
    });

    // Step 1 highlights Germany, so US is muted.
    story.goTo(1);
    expect(mutedStrokeCount(container)).toBe(1);

    // Step 2 clears the highlight (null -> []). No series should stay muted:
    // if the clear were a no-op, US would still carry the muted gray stroke.
    story.goTo(2);
    expect(container.querySelector('svg')).not.toBeNull();
    expect(mutedStrokeCount(container)).toBe(0);

    story.destroy();
  });

  it('clamps out-of-range indices', () => {
    const story = createChartStory(container, {
      spec: baseSpec,
      steps: [{}, { spec: { chrome: { title: 'One' } } }],
    });

    story.goTo(99);
    expect(story.currentStep).toBe(1);
    expect(title(container)).toBe('One');

    story.goTo(-5);
    expect(story.currentStep).toBe(0);
    expect(title(container)).toBe('Base');

    story.destroy();
  });

  it('re-encode steps (outside the morph gate) swap without throwing', () => {
    const story = createChartStory(container, {
      spec: baseSpec,
      steps: [{}, { spec: { encoding: { y: { field: 'value', type: 'quantitative' } } } }],
    });

    // Step 1 re-encodes: this falls outside the morph gate and takes the
    // crossfade path. It must still land on a valid rendered chart.
    story.goTo(1);
    expect(container.querySelector('svg')).not.toBeNull();

    story.destroy();
  });

  it('a keyed beeswarm step under the mark cap takes the morph path, not the crossfade', () => {
    const story = createChartStory(container, {
      spec: beeswarmStorySpec(40, 0),
      steps: [{}, { spec: { data: beeswarmStorySpec(40, 7).data } }],
    });

    story.goTo(0);
    story.goTo(1);
    // The crossfade fallback clones the SVG as an absolutely-positioned ghost;
    // the morph path never adds a second svg element.
    expect(container.querySelectorAll('svg').length).toBe(1);

    story.destroy();
  });

  it('a beeswarm step over the mark cap falls back to the crossfade instead of snapping', () => {
    const story = createChartStory(container, {
      spec: beeswarmStorySpec(600, 0),
      steps: [{}, { spec: { data: beeswarmStorySpec(600, 7).data } }],
    });

    story.goTo(0);
    story.goTo(1);
    // 600 dots > DEFAULT_UPDATE_MAX_MARKS: the runtime gate would veto the
    // morph after render() already swapped, so the story layer must predict
    // the veto and keep the crossfade ghost.
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBe(2);
    expect(svgs[0].getAttribute('aria-hidden')).toBe('true');

    story.destroy();
  });

  it('animation.update.maxMarks re-enables the morph path for a large beeswarm', () => {
    const bigSpec = {
      ...beeswarmStorySpec(600, 0),
      animation: { enter: false, update: { maxMarks: 2000 } },
    } as ChartSpec;
    const story = createChartStory(container, {
      spec: bigSpec,
      steps: [{}, { spec: { data: beeswarmStorySpec(600, 7).data } }],
    });

    story.goTo(0);
    story.goTo(1);
    expect(container.querySelectorAll('svg').length).toBe(1);

    story.destroy();
  });

  it('resolves a data-coordinate camera target to a marks-group transform', () => {
    const story = createChartStory(container, {
      spec: baseSpec,
      steps: [{}, { camera: { x: ['2008', '2012'] } }],
    });

    // Step 0 has no camera: identity-ish full-view transform (or none yet).
    story.goTo(1);

    const t = cameraTransform(container);
    expect(t).not.toBeNull();
    // A framed region zooms in (scale > 1), so the transform must contain a
    // scale factor greater than 1.
    const scaleMatch = t?.match(/scale\(([\d.]+)\)/);
    expect(scaleMatch).not.toBeNull();
    expect(Number(scaleMatch?.[1])).toBeGreaterThan(1);

    story.destroy();
  });

  it('returns the camera to full view on a step with no camera', () => {
    const story = createChartStory(container, {
      spec: baseSpec,
      steps: [{}, { camera: { x: ['2008', '2012'] } }, {}],
    });

    story.goTo(1);
    const zoomed = cameraTransform(container);
    const zoomedScale = Number(zoomed?.match(/scale\(([\d.]+)\)/)?.[1] ?? '1');
    expect(zoomedScale).toBeGreaterThan(1);

    story.goTo(2);
    const reset = cameraTransform(container);
    const resetScale = Number(reset?.match(/scale\(([\d.]+)\)/)?.[1] ?? '1');
    // Full-view fit is scale 1 (within rounding).
    expect(resetScale).toBeCloseTo(1, 3);

    story.destroy();
  });

  it('snaps camera moves immediately under prefers-reduced-motion', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));

    const story = createChartStory(container, {
      spec: baseSpec,
      steps: [{}, { camera: { x: ['2008', '2012'] } }],
    });

    story.goTo(1);

    // Reduced motion snaps: the zoomed transform is present synchronously with
    // no rAF pumping.
    const t = cameraTransform(container);
    const scale = Number(t?.match(/scale\(([\d.]+)\)/)?.[1] ?? '1');
    expect(scale).toBeGreaterThan(1);

    story.destroy();
  });

  it('warns and disables the drive loop when edit-mode callbacks are passed', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const story = createChartStory(
      container,
      { spec: baseSpec, steps: [{}, { spec: { chrome: { title: 'One' } } }] },
      { onSelect: () => {} },
    );

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('mutually exclusive'));

    // goTo still applies (public control stays live); the scroll driver is what
    // gets disabled.
    story.goTo(1);
    expect(title(container)).toBe('One');

    warn.mockRestore();
    story.destroy();
  });

  it('destroy tears down the chart and is idempotent', () => {
    const story = createChartStory(container, {
      spec: baseSpec,
      steps: [{}, { spec: { chrome: { title: 'One' } } }],
    });

    story.destroy();
    expect(container.querySelector('svg')).toBeNull();

    // Second destroy is a no-op, not a throw.
    expect(() => story.destroy()).not.toThrow();
    // goTo after destroy is inert.
    story.goTo(1);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('registerStep and setContainer are safe no-ops in edit mode', () => {
    const story = createChartStory(
      container,
      { spec: baseSpec, steps: [{}, {}] },
      { onEdit: () => {} },
    );

    const stepEl = document.createElement('div');
    expect(() => story.registerStep(0, stepEl)).not.toThrow();
    expect(() => story.setContainer(document.createElement('div'))).not.toThrow();

    story.destroy();
  });
});
