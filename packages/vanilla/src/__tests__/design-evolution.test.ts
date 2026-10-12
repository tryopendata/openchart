import { type ChartSpec, sampleMotion } from '@opendata-ai/openchart-core';
import { compileChart, resolveAnimation, validateSpec } from '@opendata-ai/openchart-engine';
import { afterEach, describe, expect, it } from 'vitest';
import { createContainer, createMouseEvent } from '../__test-fixtures__/dom';
import { stampAnimationVars } from '../animation-vars';
import { applyFrameState } from '../export-gif';
import { createChart } from '../mount';
import { createReader } from '../reader';
import { entranceAlphaAt } from '../scatter-canvas/entrance';

const spec: ChartSpec = {
  mark: 'bar',
  animation: false,
  data: [
    { id: 'a', name: 'Alpha', value: 20 },
    { id: 'b', name: 'Beta', value: 80 },
  ],
  encoding: {
    key: { field: 'id', type: 'nominal' },
    x: { field: 'name', type: 'nominal', sort: null },
    y: { field: 'value', type: 'quantitative', scale: { domain: [0, 100] } },
  },
  chrome: { title: 'Short' },
};
afterEach(() => {
  document.body.innerHTML = '';
});

describe('authoring and reading real compiled charts', () => {
  it('preserves the root while title edits wrap and unwrap without stale text', () => {
    const container = createContainer(320, 500);
    const chart = createChart(container, spec);
    const root = container.querySelector('svg');
    chart.update({
      ...spec,
      chrome: { title: 'A long editorial title that wraps across several lines at a phone width' },
    });
    expect(container.querySelector('svg')).toBe(root);
    expect(container.querySelector('.oc-title')?.textContent).toContain('A long editorial');
    expect(container.querySelector('.oc-title')?.textContent).not.toContain('Short');
    expect(container.querySelector('.oc-title tspan')).not.toBeNull();
    chart.update({ ...spec, chrome: { title: 'Again' } });
    expect(container.querySelector('.oc-title')?.textContent).toBe('Again');
    expect(container.querySelector('.oc-title tspan')).toBeNull();
    chart.destroy();
  });
  it('pins sampled geometry with exact source values and clears deleted identity', () => {
    const container = createContainer();
    const chart = createChart(container, { ...spec, animation: { preset: 'fluid', enter: false } });
    const reader = createReader(container, chart, spec, () => {});
    const next = {
      ...spec,
      animation: { preset: 'fluid' as const, enter: false as const },
      data: spec.data.map((row) => ({ ...row, value: row.id === 'a' ? 90 : 10 })),
    };
    const motion = chart.beginManualUpdate(next);
    expect(motion).not.toBeNull();
    motion!.step(120);
    reader.update(next);
    const svg = container.querySelector('svg')!;
    Object.defineProperty(svg, 'getBoundingClientRect', {
      value: () => container.getBoundingClientRect(),
    });
    const bar = chart
      .sampleLayout()
      .marks.find((mark) => mark.type === 'rect' && mark.data.id === 'a');
    expect(bar?.type).toBe('rect');
    if (bar?.type !== 'rect') throw new Error('Missing bar');
    container.dispatchEvent(
      createMouseEvent('click', bar.x + bar.width / 2, bar.y + bar.height / 2),
    );
    expect(reader.selection.pinned[0].datum.value).toBe(90);
    expect(reader.selection.pinned[0].observation).toBe('string:a');
    motion!.cancel();
    reader.update({ ...next, data: next.data.filter((row) => row.id !== 'a') });
    expect(reader.selection.pinned).toEqual([]);
    reader.destroy();
    chart.destroy();
  });
  it('inspects histogram groups through pointer and keyboard, never a fictional raw row', () => {
    const histogram: ChartSpec = {
      mark: 'histogram',
      data: [{ v: 1 }, { v: 2 }, { v: 2 }, { v: 3 }],
      encoding: { x: { field: 'v', type: 'quantitative', bin: true } },
    };
    const container = createContainer();
    const chart = createChart(container, histogram);
    const reader = createReader(container, chart, histogram, () => {});
    Object.defineProperty(container.querySelector('svg')!, 'getBoundingClientRect', {
      value: () => container.getBoundingClientRect(),
    });
    const bar = chart.layout.marks.find((mark) => mark.type === 'rect' && mark.height > 0);
    if (bar?.type !== 'rect') throw new Error('Missing histogram bin');
    container.dispatchEvent(
      createMouseEvent('click', bar.x + bar.width / 2, bar.y + bar.height / 2),
    );
    expect(reader.selection.pinned[0].kind).toBe('aggregate');
    expect(reader.selection.pinned[0].datum).toEqual(bar.data);
    reader.clear();
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(reader.selection.pinned[0].kind).toBe('aggregate');
    const rebinned: ChartSpec = {
      ...histogram,
      encoding: { x: { field: 'v', type: 'quantitative', bin: { maxbins: 2 } } },
    };
    chart.update(rebinned);
    reader.update(rebinned);
    expect(reader.selection.pinned).toEqual([]);
    expect(reader.selection.announcement).toContain('grouping');
    reader.destroy();
    chart.destroy();
  });
  it('rejects malformed metadata at the import boundary', () => {
    expect(validateSpec({ ...spec, chrome: { title: { text: { bad: true } } } }).valid).toBe(false);
    expect(
      validateSpec({ ...spec, fields: { value: { label: {}, unit: {}, type: 'arbitrary' } } })
        .valid,
    ).toBe(false);
    expect(
      validateSpec({ ...spec, fields: { value: { interval: { lower: 1, upper: 'value' } } } })
        .valid,
    ).toBe(false);
    expect(
      validateSpec({
        ...spec,
        fields: { value: { label: 'Measure', unit: 'USD', type: 'number' } },
      }).valid,
    ).toBe(true);
  });
  it('wraps summary labels and reserves every line at phone width', () => {
    const line: ChartSpec = {
      mark: 'line',
      responsive: { labelSummary: true },
      chromeLayout: 'grow',
      data: [
        'A very long international company name with additional context',
        'Another particularly long category with a unit',
      ].flatMap((company, i) => [
        { company, year: 2020, value: i + 1 },
        { company, year: 2024, value: i + 5 },
      ]),
      encoding: {
        x: { field: 'year', type: 'ordinal' },
        y: { field: 'value', type: 'quantitative' },
        color: { field: 'company', type: 'nominal' },
      },
      labels: { density: 'endpoints' },
    };
    const layout = compileChart(line, { width: 320, height: 500 });
    expect(layout.chrome.seriesSummary?.length).toBe(2);
    expect(layout.chrome.seriesSummary?.every((entry) => entry.lines.length > 1)).toBe(true);
  });
  it('samples the same authored spring in SVG CSS, canvas and animated export', () => {
    const enter = resolveAnimation({ enter: { spring: { stiffness: 100, damping: 22 } } })!.enter!;
    const element = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    stampAnimationVars(element, { ...enter, stagger: 0 });
    const samples = element.style
      .getPropertyValue('--oc-animation-ease')
      .slice(7, -1)
      .split(',')
      .map(Number);
    const t = enter.duration * 0.37;
    const expected = sampleMotion(enter, t).position;
    expect(samples[37]).toBeCloseTo(expected, 5);
    expect(entranceAlphaAt(t * 0.4, 0, enter, 1, () => 0)).toBeCloseTo(expected, 6);
    applyFrameState(
      { el: element, kind: 'fade', startMs: 0, durationMs: enter.duration * 0.4 },
      t * 0.4,
      enter.ease,
      enter,
    );
    expect(Number(element.style.opacity)).toBeCloseTo(expected, 6);
  });
});
