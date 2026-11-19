/**
 * Which chart marks tween on a keyed data update (`TRANSITIONABLE_MARKS`).
 *
 * A mark joins the set only when a keyed data change returns a running
 * transition handle and, once stepped to the end, leaves every mark at the
 * geometry and fill a fresh render of the next spec has. Each mark below was
 * added on the strength of its case; one that fails here goes back to snap.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { createChart } from '../mount';
import { TRANSITIONABLE_MARKS } from '../transition/gate';

const ANIMATION = { enter: false, update: true, exit: true } as const;

type Rows = Record<string, unknown>[];

function spec(mark: string, data: Rows, encoding: Record<string, unknown>): ChartSpec {
  return { animation: ANIMATION, mark, data, encoding } as unknown as ChartSpec;
}

function days(count: number, value: (i: number) => number): Rows {
  return Array.from({ length: count }, (_, i) => ({
    date: new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10),
    value: value(i),
  }));
}

/** Each mark's prev/next spec: same encoding, keyed data whose values change. */
const CASES: Record<string, [ChartSpec, ChartSpec]> = (() => {
  const heat = (shift: number) =>
    spec(
      'rect',
      ['a', 'b', 'c'].flatMap((x, i) =>
        ['p', 'q', 'r'].map((y, j) => ({ x, y, v: ((i * 3 + j + shift) % 9) + 1 })),
      ),
      {
        x: { field: 'x', type: 'nominal' },
        y: { field: 'y', type: 'nominal' },
        color: { field: 'v', type: 'quantitative' },
      },
    );
  const waffle = (a: number) =>
    spec(
      'waffle',
      [
        { source: 'Coal', share: a },
        { source: 'Gas', share: 60 - a },
        { source: 'Wind', share: 40 },
      ],
      {
        theta: { field: 'share', type: 'quantitative' },
        color: { field: 'source', type: 'nominal' },
      },
    );
  const calendar = (k: number) =>
    spec(
      'calendar',
      days(60, (i) => ((i * k) % 13) + 1),
      {
        x: { field: 'date', type: 'temporal' },
        color: { field: 'value', type: 'quantitative' },
      },
    );
  const parliament = (d: number) =>
    spec(
      'parliament',
      [
        { party: 'Democratic', seats: d },
        { party: 'Republican', seats: 120 - d },
      ],
      {
        theta: { field: 'seats', type: 'quantitative' },
        color: { field: 'party', type: 'nominal' },
      },
    );
  const range = (k: number) =>
    spec(
      'range',
      ['US', 'UK', 'FR'].map((country, i) => ({ country, a: 60 + i * k, b: 75 + i * 2 + k })),
      {
        y: { field: 'country', type: 'nominal' },
        x: { field: 'a', type: 'quantitative', scale: { domain: [50, 100] } },
        x2: { field: 'b' },
      },
    );
  const errorbar = (k: number) =>
    spec(
      'errorbar',
      ['A', 'B', 'C'].map((category, i) => ({ category, lower: 10 + i * k, upper: 40 + i * k })),
      {
        x: { field: 'lower', type: 'quantitative', scale: { domain: [0, 100] } },
        x2: { field: 'upper' },
        y: { field: 'category', type: 'nominal' },
      },
    );
  const tick = (k: number) =>
    spec(
      'tick',
      ['A', 'A', 'B', 'B'].map((group, i) => ({ id: `r${i}`, group, hours: 2 + i * k })),
      {
        x: { field: 'hours', type: 'quantitative', scale: { domain: [0, 40] } },
        y: { field: 'group', type: 'nominal' },
      },
    );
  const text = (k: number) =>
    spec(
      'text',
      ['A', 'B', 'C', 'D'].map((label, i) => ({ label, x: 1 + i, y: 2 + ((i * k) % 7) })),
      {
        x: { field: 'x', type: 'quantitative', scale: { domain: [0, 5] } },
        y: { field: 'y', type: 'quantitative', scale: { domain: [0, 10] } },
        text: { field: 'label', type: 'nominal' },
      },
    );
  const dot = (mark: string, k: number) =>
    spec(
      mark,
      ['A', 'B', 'C'].map((category, i) => ({ category, value: 20 + i * k })),
      {
        x: { field: 'value', type: 'quantitative', scale: { domain: [0, 100] } },
        y: { field: 'category', type: 'nominal' },
      },
    );
  return {
    rect: [heat(0), heat(4)],
    waffle: [waffle(20), waffle(45)],
    calendar: [calendar(3), calendar(7)],
    parliament: [parliament(50), parliament(80)],
    range: [range(3), range(8)],
    errorbar: [errorbar(5), errorbar(15)],
    tick: [tick(3), tick(7)],
    circle: [dot('circle', 10), dot('circle', 25)],
    lollipop: [dot('lollipop', 10), dot('lollipop', 25)],
    text: [text(3), text(5)],
  };
})();

const GEOMETRY_ATTRS = ['x', 'y', 'width', 'height', 'cx', 'cy', 'r', 'x1', 'y1', 'x2', 'y2'];
const PAINT_ATTRS = ['fill', 'stroke', 'transform', 'opacity', 'fill-opacity'];

/** Every number in an attribute value, rounded so float noise compares equal. */
function normalize(value: string | null): string | null {
  if (value === null) return null;
  return value.replace(/-?\d*\.?\d+(?:e-?\d+)?/gi, (n) => {
    const r = Math.round(Number(n) * 100) / 100;
    return String(Object.is(r, -0) ? 0 : r);
  });
}

/** Keyed mark elements and what the tween owns on them and their shapes. */
function markState(container: HTMLElement): Map<string, Record<string, string | null>> {
  const out = new Map<string, Record<string, string | null>>();
  for (const el of container.querySelectorAll('.oc-marks [data-key]:not(.oc-ghost)')) {
    if (el.closest('.oc-ghost')) continue;
    const state: Record<string, string | null> = {};
    for (const [i, node] of [el, ...el.querySelectorAll('*')].entries()) {
      for (const attr of [...GEOMETRY_ATTRS, ...PAINT_ATTRS, 'd']) {
        state[`${i}:${node.tagName}:${attr}`] = normalize(node.getAttribute(attr));
      }
      const style = (node as SVGElement).style;
      // An entered mark's fade ends at an inline opacity of 1: the same paint as none.
      const opacity = style?.opacity;
      state[`${i}:style.opacity`] = opacity && Number(opacity) !== 1 ? opacity : null;
      state[`${i}:style.fill`] = style?.fill || null;
      if (node.tagName.toLowerCase() === 'text') state[`${i}:text`] = node.textContent;
    }
    out.set(el.getAttribute('data-key')!, state);
  }
  return out;
}

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', () => {
    throw new Error('manual transition must not schedule requestAnimationFrame');
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('transitionable marks', () => {
  it.each(Object.keys(CASES))('%s: a keyed update runs and settles to the next layout', (mark) => {
    expect(TRANSITIONABLE_MARKS.has(mark)).toBe(true);
    const [prev, next] = CASES[mark];

    const expected = createContainer();
    const reference = createChart(expected, next);
    const want = markState(expected);
    reference.destroy();
    expect(want.size).toBeGreaterThan(0);

    const container = createContainer();
    const chart = createChart(container, prev);
    const before = markState(container);
    expect(before).not.toEqual(want);

    const handle = chart.beginManualUpdate(next);
    expect(handle).not.toBeNull();
    expect(handle!.running).toBe(true);
    expect(handle!.totalMs).toBeGreaterThan(0);

    // Halfway it is neither state: something actually moves or recolours.
    expect(handle!.step(handle!.totalMs / 2)).toBe(true);
    const mid = markState(container);
    expect(mid).not.toEqual(want);
    expect(mid).not.toEqual(before);

    expect(handle!.step(handle!.totalMs)).toBe(false);
    handle!.cancel();
    expect(container.querySelector('.oc-ghost')).toBeNull();
    expect(markState(container)).toEqual(want);
    chart.destroy();
  });
});
