import { compileChart } from '@opendata-ai/openchart-engine';
import { describe, expect, it } from 'vitest';
import { renderStaticSVG } from '../static';
import { renderChartSVG } from '../svg-renderer';
import { siteSpecs } from './__fixtures__/static-specs';

const data = [
  { day: '2026-10-25', category: 'A', value: 2, upper: 4, text: '<exact> & authored' },
  { day: '2026-10-26', category: 'A', value: 3, upper: 5, text: '<exact> & authored' },
];
const encoding = {
  x: { field: 'day', type: 'temporal' },
  y: { field: 'value', type: 'quantitative' },
  description: { field: 'text' },
};
const options = { width: 680, height: 320, onWarn: () => {} };
const parse = (svg: string) => new DOMParser().parseFromString(svg, 'image/svg+xml');
describe('data mark shapes', () => {
  it('stamps line and area paths, excludes wrappers, decorative top edge and labels', () => {
    for (const mark of ['line', 'area']) {
      const doc = parse(renderStaticSVG({ data, mark, encoding }, options));
      const shapes = doc.querySelectorAll('[data-mark]');
      expect(shapes.length).toBeGreaterThan(0);
      for (const shape of shapes) {
        expect(shape.tagName).toBe('path');
        expect(shape.firstElementChild?.tagName).toBe('title');
        expect(shape.firstElementChild?.textContent).toBe(data[0].text);
      }
      expect(
        doc.querySelector('g[data-mark], .oc-area-top[data-mark], [data-mark][aria-label]'),
      ).toBeNull();
      expect(doc.querySelector('exact')).toBeNull();
    }
  });
  it('stamps rectangles and rounded paths on stacked bars with identities', () => {
    for (const cornerRadius of [0, 4]) {
      const doc = parse(
        renderStaticSVG(
          {
            data: [
              { day: 'Mon', preset: 'default', value: 40 },
              { day: 'Mon', preset: 'sandbox', value: 25 },
            ],
            mark: { type: 'bar', cornerRadius },
            encoding: {
              x: { field: 'day', type: 'nominal' },
              y: { field: 'value', type: 'quantitative', stack: 'zero' },
              color: { field: 'preset', type: 'nominal' },
              description: { value: 'segments' },
            },
          },
          options,
        ),
      );
      expect(doc.querySelectorAll('[data-mark="bar"][data-day="Mon"][data-preset]')).toHaveLength(
        2,
      );
      expect(
        doc.querySelector(cornerRadius ? 'path[data-mark="bar"]' : 'rect[data-mark="bar"]'),
      ).not.toBeNull();
    }
  });
  it('omits native titles without authored description and per-mark aria-label from static output', () => {
    const doc = parse(
      renderStaticSVG({ data, mark: 'line', encoding: { x: encoding.x, y: encoding.y } }, options),
    );
    expect(doc.querySelector('[data-mark] > title')).toBeNull();
    expect(doc.querySelector('[data-mark][aria-label], [data-mark-id][aria-label]')).toBeNull();
  });
  it('keeps authored live aria labels and omits native titles', () => {
    const host = document.createElement('div');
    const layout = compileChart({ data, mark: 'line', encoding }, options);
    renderChartSVG(layout, host, { animate: false });
    expect(host.querySelector('[data-mark-id]')?.getAttribute('aria-label')).toBe(data[0].text);
    expect(host.querySelector('[data-mark] > title')).toBeNull();
  });
  it('does not stamp decorative dumbbell heads and lollipop stems', () => {
    for (const mark of ['range', 'lollipop']) {
      const doc = parse(
        renderStaticSVG(
          {
            data,
            mark,
            encoding: {
              x: { field: 'value', type: 'quantitative' },
              x2: mark === 'range' ? { field: 'upper' } : undefined,
              y: { field: 'category', type: 'nominal' },
              description: { value: 'span' },
            },
          },
          options,
        ),
      );
      expect(doc.querySelector('[aria-hidden="true"][data-mark]')).toBeNull();
      expect(doc.querySelectorAll('[data-mark]').length).toBeGreaterThan(0);
      if (mark === 'range') expect(doc.querySelector('circle[data-mark]')).toBeNull();
      else expect(doc.querySelector('rect[data-mark]')).toBeNull();
    }
  });
  it('keeps an accessible label on every keyboard-navigable mark', () => {
    for (const mark of ['range', 'lollipop', 'circle'])
      for (const description of [undefined, { value: 'span' }]) {
        const host = document.createElement('div');
        const layout = compileChart(
          {
            data,
            mark,
            encoding: {
              x: { field: 'value', type: 'quantitative' },
              x2: mark === 'range' ? { field: 'upper' } : undefined,
              y: { field: 'category', type: 'nominal' },
              description,
            },
          },
          options,
        );
        renderChartSVG(layout, host, { animate: false });
        const navigable = [...host.querySelectorAll('[data-mark-id]')].filter((el) =>
          layout.tooltipDescriptors.has(el.getAttribute('data-mark-id') ?? ''),
        );
        expect(navigable.length).toBeGreaterThan(0);
        for (const el of navigable) {
          expect(el.getAttribute('aria-hidden')).toBeNull();
          expect(el.getAttribute('aria-label')).toBeTruthy();
          if (description) expect(el.getAttribute('aria-label')).toBe('span');
        }
      }
  });
  it('never derives data-series from an authored description', () => {
    const rows = ['North', 'South'].flatMap((region) =>
      data.map((row, i) => ({ ...row, region, text: `row ${i} ${region}` })),
    );
    for (const mark of [{ type: 'line', point: true }, 'bar'] as const) {
      const host = document.createElement('div');
      const layout = compileChart(
        {
          data: rows,
          mark,
          encoding: {
            ...(mark === 'bar'
              ? {
                  x: { field: 'value', type: 'quantitative' },
                  y: { field: 'day', type: 'nominal' },
                }
              : { x: encoding.x, y: encoding.y }),
            color: { field: 'region', type: 'nominal' },
            description: { field: 'text' },
          },
        },
        options,
      );
      renderChartSVG(layout, host, { animate: false });
      const series = [...host.querySelectorAll('.oc-marks > [data-series]')].map((el) =>
        el.getAttribute('data-series'),
      );
      expect(series.length).toBeGreaterThan(0);
      for (const value of series) expect(['North', 'South']).toContain(value);
    }
  });
  it("renders the time-to-green layer's composed range labels without giving its tick a label", () => {
    const doc = parse(renderStaticSVG(siteSpecs.timeToGreen, options));
    const labels = [...doc.querySelectorAll('text')].map((label) => label.textContent);
    expect(labels).toContain('median 14m');
    expect(labels).toContain('p75 26m');
    expect(labels.filter((text) => text === 'median 14m')).toHaveLength(1);
  });
});
